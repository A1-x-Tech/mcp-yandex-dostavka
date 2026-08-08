# Changelog

Все заметные изменения проекта документируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/),
проект придерживается [семантического версионирования](https://semver.org/lang/ru/).

## [Unreleased]

## [0.1.0] — 2026-08-09

Первый полноценный релиз (версии 0.0.x были заглушкой для резервирования имени).

### Добавлено

- 16 MCP-инструментов для двух контуров B2B API Яндекс Доставки:
  - **Экспресс** (день в день, `b2b.taxi.yandex.net`): `express_check_price`,
    `express_create_claim` (идемпотентный `request_id`), `express_accept_claim`,
    `express_get_claim`, `express_cancel_info`, `express_cancel_claim`,
    `express_search_claims`, `express_performer_position`, `express_tracking_links`.
  - **Платформа** (НДД/ПВЗ, `b2b-authproxy.taxi.yandex.net`):
    `platform_list_pickup_points`, `platform_create_offers`, `platform_confirm_offer`,
    `platform_get_request`, `platform_request_history`, `platform_cancel_request`.
  - `raw_request` — прямой вызов любого метода обоих контуров (с выбором контура).
- Двухконтурный HTTP-клиент: Bearer-токен и хост по контуру (переопределяются
  `YANDEX_DELIVERY_EXPRESS_*`/`YANDEX_DELIVERY_PLATFORM_*`), `Accept-Language`,
  таймаут через AbortController, ретраи с бэкоффом (429 — всегда; 5xx/сеть — только
  для идемпотентных вызовов), SSRF-guard на путях `raw_request`, разбор обоих
  форматов ошибок экспресс-контура (`{code, message}` и `error_messages[]`).
- Аннотации на каждом туле (`READ_ONLY`/`WRITE`/`DESTRUCTIVE`) — сервер пишущий,
  отмены помечены как destructive.
- Анонимная телеметрия использования (opt-out `ASKADS_TELEMETRY=0`).
- Тесты: 65 юнит-тестов (офлайн) + 3 smoke-теста собранного `dist/`
  (включая реальный MCP-хендшейк по stdio); CI на Node 20/22/24.
