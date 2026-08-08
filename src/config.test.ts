import { test } from "node:test";
import assert from "node:assert/strict";

import { ConfigError, loadConfig } from "./config.js";

/** Every env var the config reads — cleared by default in each test. */
const ALL_VARS: Record<string, string | undefined> = {
  YANDEX_DELIVERY_TOKEN: undefined,
  YANDEX_DELIVERY_EXPRESS_TOKEN: undefined,
  YANDEX_DELIVERY_PLATFORM_TOKEN: undefined,
  YANDEX_DELIVERY_EXPRESS_BASE_URL: undefined,
  YANDEX_DELIVERY_PLATFORM_BASE_URL: undefined,
  YANDEX_DELIVERY_LANG: undefined,
  YANDEX_DELIVERY_TIMEOUT_MS: undefined,
  YANDEX_DELIVERY_MAX_RETRIES: undefined,
};

function withEnv(vars: Record<string, string | undefined>, run: () => void): void {
  const merged = { ...ALL_VARS, ...vars };
  const saved = new Map(Object.keys(merged).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    run();
  } finally {
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

/**
 * The reason codes below are the vocabulary the telemetry dashboard groups by —
 * renaming one silently splits a bar in two, so they are pinned here.
 */
function reasonOf(vars: Record<string, string | undefined>): string {
  let caught: unknown;
  withEnv(vars, () => {
    try {
      loadConfig();
    } catch (err) {
      caught = err;
    }
  });
  assert.ok(caught instanceof ConfigError, "config problems must throw ConfigError, not exit");
  return caught.reason;
}

test("no tokens at all reports missing_token", () => {
  assert.equal(reasonOf({}), "missing_token");
});

test("only an express token leaves the platform contour bare", () => {
  assert.equal(reasonOf({ YANDEX_DELIVERY_EXPRESS_TOKEN: "exp" }), "missing_platform_token");
});

test("only a platform token leaves the express contour bare", () => {
  assert.equal(reasonOf({ YANDEX_DELIVERY_PLATFORM_TOKEN: "plt" }), "missing_express_token");
});

test("the shared token fills both contours and defaults apply", () => {
  withEnv({ YANDEX_DELIVERY_TOKEN: "shared" }, () => {
    const config = loadConfig();
    assert.equal(config.expressToken, "shared");
    assert.equal(config.platformToken, "shared");
    assert.equal(config.expressBase, "https://b2b.taxi.yandex.net");
    assert.equal(config.platformBase, "https://b2b-authproxy.taxi.yandex.net");
    assert.equal(config.lang, "ru");
    assert.equal(config.timeoutMs, 60_000);
    assert.equal(config.maxRetries, 3);
  });
});

test("per-contour tokens override the shared one", () => {
  withEnv(
    {
      YANDEX_DELIVERY_TOKEN: "shared",
      YANDEX_DELIVERY_EXPRESS_TOKEN: "exp",
      YANDEX_DELIVERY_PLATFORM_TOKEN: "plt",
    },
    () => {
      const config = loadConfig();
      assert.equal(config.expressToken, "exp");
      assert.equal(config.platformToken, "plt");
    },
  );
});

test("two per-contour tokens work without the shared one", () => {
  withEnv(
    { YANDEX_DELIVERY_EXPRESS_TOKEN: "exp", YANDEX_DELIVERY_PLATFORM_TOKEN: "plt" },
    () => {
      const config = loadConfig();
      assert.equal(config.expressToken, "exp");
      assert.equal(config.platformToken, "plt");
    },
  );
});

test("the platform base override points at the test contour", () => {
  withEnv(
    {
      YANDEX_DELIVERY_TOKEN: "shared",
      YANDEX_DELIVERY_PLATFORM_BASE_URL: "https://b2b.taxi.tst.yandex.net",
      YANDEX_DELIVERY_LANG: "en",
    },
    () => {
      const config = loadConfig();
      assert.equal(config.platformBase, "https://b2b.taxi.tst.yandex.net");
      assert.equal(config.expressBase, "https://b2b.taxi.yandex.net");
      assert.equal(config.lang, "en");
    },
  );
});

test("garbage numbers fall back to the defaults", () => {
  withEnv(
    {
      YANDEX_DELIVERY_TOKEN: "shared",
      YANDEX_DELIVERY_TIMEOUT_MS: "soon",
      YANDEX_DELIVERY_MAX_RETRIES: "-5",
    },
    () => {
      const config = loadConfig();
      assert.equal(config.timeoutMs, 60_000);
      assert.equal(config.maxRetries, 3);
    },
  );
});
