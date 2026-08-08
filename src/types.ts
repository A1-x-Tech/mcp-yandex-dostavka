/**
 * The server talks to the Yandex Delivery B2B API, which has two independent
 * contours:
 *
 *   - Express (same-day courier claims): https://b2b.taxi.yandex.net,
 *     paths under /b2b/cargo/integration/v2/*.
 *   - Platform (NDD — "next-day delivery", pickup points, parcel lockers):
 *     https://b2b-authproxy.taxi.yandex.net, paths under /api/b2b/platform/*.
 *
 * Auth on both contours is `Authorization: Bearer <token>`; the token comes from
 * the dostavka.yandex.ru cabinet ("Интеграции" → "Получить токен"), never
 * expires but is reset when the account password changes. The contours may live
 * in different cabinets, hence the per-contour token overrides in the config.
 */

/** Express delivery class (wire values are identical to the normalized ones). */
export type TaxiClass = "courier" | "express" | "cargo" | "sdd_multislot";

/** Cargo vehicle body type for taxi_class=cargo. */
export type CargoType = "van" | "lcv_m" | "lcv_l";

/** Cancellation mode reported by claims/cancel-info and sent to claims/cancel. */
export type CancelState = "free" | "paid";

/** Platform payment methods for the recipient. */
export type PaymentMethod = "already_paid" | "card_on_receipt" | "postpay";

/** Platform point types: ПВЗ, parcel locker, drop-off warehouse. */
export type PickupPointType = "pickup_point" | "terminal" | "warehouse";

export interface DeliveryConfig {
  /** Bearer token for the express (claims) contour. Treated as a secret. */
  expressToken: string;
  /** Bearer token for the platform (NDD) contour. Treated as a secret. */
  platformToken: string;
  /** Express API root. Defaults to https://b2b.taxi.yandex.net. */
  expressBase: string;
  /**
   * Platform API root. Defaults to https://b2b-authproxy.taxi.yandex.net;
   * point it at https://b2b.taxi.tst.yandex.net for the platform test contour.
   */
  platformBase: string;
  /** Accept-Language header (required by the express methods). */
  lang: string;
  /** Per-request timeout in milliseconds. Defaults to 60_000. */
  timeoutMs?: number;
  /** Max retries for transient errors (429 rate limit, 5xx). Defaults to 3. */
  maxRetries?: number;
  /** Base backoff in milliseconds, doubled each retry. Defaults to 500. */
  retryBaseMs?: number;
}

/**
 * Both contours report failures as a non-2xx HTTP status with a JSON body of
 * `{ code, message }` (e.g. `not_found`, `inappropriate_status`,
 * `no_delivery_options`). The parsed body is kept alongside the status and a
 * short readable message is derived. Note: the express claims/info method can
 * additionally embed estimation errors as an `error_messages` array inside a
 * 200 response — those pass through to the caller untouched.
 */
export class DeliveryError extends Error {
  readonly status: number;
  readonly body?: unknown;

  constructor(status: number, body: unknown) {
    super(`HTTP ${status}: ${formatErrorBody(body)}`);
    this.name = "DeliveryError";
    this.status = status;
    this.body = body;
  }
}

/** Turns a parsed Yandex Delivery error body into a short, readable message. */
function formatErrorBody(body: unknown): string {
  if (body == null) return "(no body)";
  if (typeof body === "string") return body.slice(0, 500);
  if (typeof body !== "object") return String(body);
  const obj = body as Record<string, unknown>;

  // Both contours: { code: "not_found", message: "..." }
  if (typeof obj.message === "string") {
    const code = obj.code !== undefined ? `[${String(obj.code)}] ` : "";
    return `${code}${obj.message}`.slice(0, 500);
  }

  // Some express responses carry an array of { code, message } items.
  if (Array.isArray(obj.error_messages)) {
    return JSON.stringify(obj.error_messages).slice(0, 500);
  }

  return JSON.stringify(obj).slice(0, 500);
}
