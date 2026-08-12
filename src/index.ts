#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DeliveryClient } from "./client.js";
import { ConfigError, loadConfig } from "./config.js";
import { instrumentToolCalls, Telemetry } from "./telemetry.js";
import type { DeliveryConfig } from "./types.js";
import { registerExpressTools } from "./tools/express.js";
import { registerPlatformTools } from "./tools/platform.js";
import { registerRawTool } from "./tools/raw.js";

/**
 * Prose handed to the calling model in the `initialize` result — the only place
 * it learns what the tool list cannot say: which API this is, where the money
 * and the point of no return are, and which failures lie about their cause.
 */
const INSTRUCTIONS =
  "Это B2B API Яндекс Доставки: отправления корпоративного клиента с договором и токеном из " +
  "кабинета dostavka.yandex.ru, а не сервис для частных отправителей; хост экспресса " +
  "b2b.taxi.yandex.net — это Доставка, а не API Такси. Контура два и они независимы: экспресс (день " +
  "в день, заявки) и платформа (доставка в другой день, ПВЗ и постаматы) — разные хосты, иногда " +
  "токены разных кабинетов, разные единицы: у экспресса деньги строкой-decimal и метры/кг, у " +
  "платформы копейки целым числом и см/граммы. Лимиты Яндекса не опубликованы: 429 повторяется " +
  "автоматически с учётом Retry-After, 5xx и обрывы связи — только для расчётов, чтений и создания " +
  "заявки, поэтому после сбоя записи не повторяйте её, а перечитайте состояние. Если 401/403 идут " +
  "по всему контуру, а второй работает, это токен другого кабинета или смена пароля в ЛК, а не " +
  "нехватка прав. Расчёты ничего не бронируют, но реальную доставку заказывают " +
  "express_accept_claim, platform_confirm_offer и express_create_claim с auto_accept=true, а отмена " +
  "бывает платной; тестовая среда есть только у платформы — у экспресса безопасны лишь расчёт и " +
  "чтение.";

/** Reads the package version so the server reports its real version to MCP clients. */
function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/**
 * Loads the config, reporting the drop-off if it is missing. An unconfigured
 * server dies before the MCP handshake, so this ping is the only trace such an
 * install ever leaves — and it has to be awaited, or process.exit() below would
 * kill the request in flight.
 */
async function loadConfigOrExit(telemetry: Telemetry): Promise<DeliveryConfig> {
  try {
    return loadConfig();
  } catch (err) {
    if (!(err instanceof ConfigError)) throw err;
    console.error(`Error: ${err.message}`);
    await telemetry.sendBlocking("startup_failed", { reason: err.reason });
    process.exit(1);
  }
}

async function main(): Promise<void> {
  // Anonymous usage pings (ids/names/versions only, never data or arguments);
  // opt out with ASKADS_TELEMETRY=0. Built before the config so a missing token
  // can be reported; wired to the server before tools register.
  const telemetry = new Telemetry(readVersion());
  const config = await loadConfigOrExit(telemetry);
  const client = new DeliveryClient(config);

  const server = new McpServer(
    {
      name: "mcp-yandex-dostavka",
      version: readVersion(),
    },
    // Surfaces as `instructions` in the initialize result.
    { instructions: INSTRUCTIONS },
  );

  instrumentToolCalls(server, telemetry);
  server.server.oninitialized = () => {
    telemetry.setClientInfo(server.server.getClientVersion());
    telemetry.send("server_start");
  };

  registerExpressTools(server, client);
  registerPlatformTools(server, client);
  registerRawTool(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("mcp-yandex-dostavka running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting mcp-yandex-dostavka:", err);
  process.exit(1);
});
