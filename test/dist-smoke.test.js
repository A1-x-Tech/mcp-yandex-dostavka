import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { DeliveryClient } from "../dist/client.js";
import { registerExpressTools } from "../dist/tools/express.js";
import { registerPlatformTools } from "../dist/tools/platform.js";
import { registerRawTool } from "../dist/tools/raw.js";

const ALL_TOOLS = [
  "express_accept_claim",
  "express_cancel_claim",
  "express_cancel_info",
  "express_check_price",
  "express_create_claim",
  "express_get_claim",
  "express_performer_position",
  "express_search_claims",
  "express_tracking_links",
  "platform_cancel_request",
  "platform_confirm_offer",
  "platform_create_offers",
  "platform_get_request",
  "platform_list_pickup_points",
  "platform_request_history",
  "raw_request",
];

test("dist client rejects foreign-origin paths before sending the Bearer token", async () => {
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response("{}", { status: 200 });
  };

  const client = new DeliveryClient({
    expressToken: "SECRET",
    platformToken: "SECRET",
    expressBase: "https://b2b.taxi.yandex.net",
    platformBase: "https://b2b-authproxy.taxi.yandex.net",
    lang: "ru",
    timeoutMs: 1000,
    maxRetries: 0,
  });

  await assert.rejects(
    () => client.request("express", "POST", "https://example.invalid/steal", { body: {} }),
    /foreign origin/,
  );
  await assert.rejects(
    () => client.request("platform", "GET", "https://example.invalid/steal"),
    /foreign origin/,
  );
  assert.equal(called, false);
});

test("dist registers the full tool set", () => {
  const names = [];
  const server = {
    registerTool(name) {
      names.push(name);
    },
  };
  const client = {};

  registerExpressTools(server, client);
  registerPlatformTools(server, client);
  registerRawTool(server, client);

  assert.deepEqual(names.sort(), ALL_TOOLS);
});

test("dist bin completes an MCP handshake over stdio and lists every tool", async () => {
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("../dist/index.js", import.meta.url))],
    env: {
      ...process.env,
      YANDEX_DELIVERY_TOKEN: "smoke-test-token",
      ASKADS_TELEMETRY: "0",
    },
  });
  const client = new Client({ name: "dist-smoke", version: "0.0.0" });
  await client.connect(transport);
  try {
    const res = await client.listTools();
    assert.deepEqual(res.tools.map((t) => t.name).sort(), ALL_TOOLS);
    // The handshake reported the real server identity.
    const server = client.getServerVersion();
    assert.equal(server?.name, "mcp-yandex-dostavka");
    // ...and the prose the calling model reads before picking a tool.
    const instructions = client.getInstructions();
    assert.equal(typeof instructions, "string");
    assert.ok(instructions.length > 0, "initialize result must carry non-empty instructions");
  } finally {
    await client.close();
  }
});
