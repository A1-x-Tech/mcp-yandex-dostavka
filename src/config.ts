import type { DeliveryConfig } from "./types.js";

/** Default express (claims) contour host. */
const DEFAULT_EXPRESS_BASE = "https://b2b.taxi.yandex.net";
/** Default platform (NDD) contour host; the test contour is b2b.taxi.tst.yandex.net. */
const DEFAULT_PLATFORM_BASE = "https://b2b-authproxy.taxi.yandex.net";

/**
 * A missing or malformed environment variable. Thrown instead of exiting on the
 * spot so index.ts can report the drop-off before the process dies; `reason` is
 * the machine-readable code that ships with that ping (never a variable's value).
 */
export class ConfigError extends Error {
  readonly reason: string;

  constructor(message: string, reason: string) {
    super(message);
    this.name = "ConfigError";
    this.reason = reason;
  }
}

function die(message: string, reason: string): never {
  throw new ConfigError(message, reason);
}

/**
 * Builds the client config from environment variables, throwing ConfigError if
 * a required one is missing.
 *
 *   YANDEX_DELIVERY_TOKEN              Bearer token shared by both contours
 *   YANDEX_DELIVERY_EXPRESS_TOKEN      express-contour override (optional)
 *   YANDEX_DELIVERY_PLATFORM_TOKEN     platform-contour override (optional)
 *   YANDEX_DELIVERY_EXPRESS_BASE_URL   express API root override
 *   YANDEX_DELIVERY_PLATFORM_BASE_URL  platform API root override (test contour:
 *                                      https://b2b.taxi.tst.yandex.net)
 *   YANDEX_DELIVERY_LANG               Accept-Language (default ru)
 *   YANDEX_DELIVERY_TIMEOUT_MS         per-request timeout (default 60000)
 *   YANDEX_DELIVERY_MAX_RETRIES        transient-error retries (default 3)
 *
 * The common token fills whichever contour has no override; a contour left
 * without any token is an error (the express and platform cabinets may issue
 * different tokens, so a half-configured server would fail confusingly late).
 */
export function loadConfig(): DeliveryConfig {
  const common = process.env.YANDEX_DELIVERY_TOKEN;
  const expressToken = process.env.YANDEX_DELIVERY_EXPRESS_TOKEN || common;
  const platformToken = process.env.YANDEX_DELIVERY_PLATFORM_TOKEN || common;

  if (!expressToken && !platformToken) {
    die(
      "YANDEX_DELIVERY_TOKEN is required (Bearer token from dostavka.yandex.ru → «Интеграции» → «Получить токен»).",
      "missing_token",
    );
  }
  if (!expressToken) {
    die(
      "Express-contour token is missing: set YANDEX_DELIVERY_TOKEN (shared) or YANDEX_DELIVERY_EXPRESS_TOKEN.",
      "missing_express_token",
    );
  }
  if (!platformToken) {
    die(
      "Platform-contour token is missing: set YANDEX_DELIVERY_TOKEN (shared) or YANDEX_DELIVERY_PLATFORM_TOKEN.",
      "missing_platform_token",
    );
  }

  const timeoutMs = Number(process.env.YANDEX_DELIVERY_TIMEOUT_MS);
  const maxRetries = Number(process.env.YANDEX_DELIVERY_MAX_RETRIES);

  return {
    expressToken,
    platformToken,
    expressBase: process.env.YANDEX_DELIVERY_EXPRESS_BASE_URL || DEFAULT_EXPRESS_BASE,
    platformBase: process.env.YANDEX_DELIVERY_PLATFORM_BASE_URL || DEFAULT_PLATFORM_BASE,
    lang: process.env.YANDEX_DELIVERY_LANG || "ru",
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 60_000,
    maxRetries: Number.isFinite(maxRetries) && maxRetries >= 0 ? maxRetries : 3,
  };
}
