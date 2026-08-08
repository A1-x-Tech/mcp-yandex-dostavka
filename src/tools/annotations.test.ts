import { test } from "node:test";
import assert from "node:assert/strict";
import { registerExpressTools } from "./express.js";
import { registerPlatformTools } from "./platform.js";
import { registerRawTool } from "./raw.js";
import { DESTRUCTIVE, READ_ONLY, WRITE } from "./util.js";

interface Annotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

/** Registers every tool against a fake server, capturing each tool's annotations. */
function collectAnnotations(): Record<string, Annotations | undefined> {
  const annotations: Record<string, Annotations | undefined> = {};
  const server = {
    registerTool: (name: string, cfg: { annotations?: Annotations }) => {
      annotations[name] = cfg.annotations;
    },
  };
  // Registration reads the client only inside handlers, so a stub is fine here.
  registerExpressTools(server as never, {} as never);
  registerPlatformTools(server as never, {} as never);
  registerRawTool(server as never, {} as never);
  return annotations;
}

const ANN = collectAnnotations();

/**
 * Yandex Delivery is a write API, so this is a per-tool map, not a single
 * invariant: reads are READ_ONLY, state-changing calls are WRITE and
 * cancellations (plus the raw escape hatch) are DESTRUCTIVE. Adding a tool
 * means adding it here consciously.
 */
const EXPECTED: Record<string, Annotations> = {
  express_check_price: READ_ONLY,
  express_create_claim: WRITE,
  express_get_claim: READ_ONLY,
  express_accept_claim: WRITE,
  express_cancel_info: READ_ONLY,
  express_cancel_claim: DESTRUCTIVE,
  express_search_claims: READ_ONLY,
  express_performer_position: READ_ONLY,
  express_tracking_links: READ_ONLY,
  platform_list_pickup_points: READ_ONLY,
  platform_create_offers: WRITE,
  platform_confirm_offer: WRITE,
  platform_get_request: READ_ONLY,
  platform_request_history: READ_ONLY,
  platform_cancel_request: DESTRUCTIVE,
  raw_request: DESTRUCTIVE,
};

test("registers all sixteen tools with annotations", () => {
  assert.deepEqual(Object.keys(ANN).sort(), Object.keys(EXPECTED).sort());
  for (const [name, a] of Object.entries(ANN)) {
    assert.ok(a, `${name} is missing annotations`);
  }
});

test("every tool carries its expected hints, all four set explicitly", () => {
  for (const [name, expected] of Object.entries(EXPECTED)) {
    assert.deepEqual(ANN[name], expected, `${name} annotations drifted`);
  }
});

test("no read-only tool is marked destructive and vice versa", () => {
  for (const [name, a] of Object.entries(ANN)) {
    if (a?.readOnlyHint) {
      assert.equal(a.destructiveHint, false, `${name}: a read cannot be destructive`);
      assert.equal(a.idempotentHint, true, `${name}: re-reading yields the same result`);
    } else {
      assert.equal(a?.idempotentHint, false, `${name}: writes are not idempotent for the client`);
    }
    assert.equal(a?.openWorldHint, true, `${name} should set openWorldHint`);
  }
});
