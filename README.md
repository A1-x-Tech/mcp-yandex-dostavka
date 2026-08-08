# Yandex Delivery MCP (Яндекс Доставка)

[![npm](https://img.shields.io/npm/v/mcp-yandex-dostavka)](https://www.npmjs.com/package/mcp-yandex-dostavka)
[![CI](https://github.com/A1-x-Tech/mcp-yandex-dostavka/actions/workflows/ci.yml/badge.svg)](https://github.com/A1-x-Tech/mcp-yandex-dostavka/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

MCP-сервер для **B2B API [Яндекс Доставки](https://dostavka.yandex.ru)**: считайте стоимость,
создавайте и подтверждайте заявки на курьерскую экспресс-доставку, рассчитывайте и бронируйте
доставку в ПВЗ и постаматы, отслеживайте курьера — из Claude, Cursor, Codex и других AI-клиентов
на естественном языке.

Сервер закрывает оба контура API: **«Экспресс»** (доставка день в день: курьер, экспресс, грузовой)
и **«Платформу»** (доставка «в другой день» — НДД, ПВЗ, постаматы). Ассистент сам собирает тело
заявки, следит за статусами, проверяет условия отмены и отдаёт получателю ссылку на трекинг.

## Быстрый старт

1. [Получите токен](#получение-доступа) в личном кабинете Яндекс Доставки.
2. Добавьте сервер — например, в Claude Code ([другие клиенты](#установка)):

   ```bash
   claude mcp add yandex-dostavka \
     -e YANDEX_DELIVERY_TOKEN=ваш_токен \
     -- npx -y mcp-yandex-dostavka
   ```

3. Спросите ассистента: «Сколько будет стоить доставка посылки 2 кг с Льва Толстого 16 на Тверскую 7?»

## Что умеет

**Экспресс-доставка (день в день):**

- **Оценка стоимости** — `express_check_price`: цена, расстояние и ETA без создания заявки.
- **Заявки** — `express_create_claim` (создать, с идемпотентным `request_id`),
  `express_accept_claim` (подтвердить и запустить поиск курьера), `express_get_claim`
  (статус, курьер, цена), `express_search_claims` (поиск по фильтрам с пагинацией).
- **Отмена** — `express_cancel_info` (бесплатная/платная/невозможна) и `express_cancel_claim`.
- **Трекинг** — `express_performer_position` (геопозиция курьера) и
  `express_tracking_links` (публичные ссылки для получателя).

**Платформа (в другой день, ПВЗ/постаматы):**

- **Точки выдачи** — `platform_list_pickup_points`: ПВЗ, постаматы и точки самопривоза с фильтрами.
- **Заказы** — `platform_create_offers` (варианты доставки с ценами),
  `platform_confirm_offer` (бронирует оффер — создаёт заказ), `platform_get_request` (статус заказа),
  `platform_request_history` (история статусов), `platform_cancel_request` (отмена).

**Общее:**

- **Универсальный `raw_request`** — прямой вызов любого метода обоих контуров
  (тарифы, ярлыки, акты, склады и другие ~30 методов без выделенного тула).
- **Устойчивость** — ретраи на 429 с бэкоффом (5xx/сетевые — только для чтений и
  идемпотентного создания заявки), таймаут запроса, защита от утечки токена на чужой хост.

## Примеры запросов

Попросите ассистента на русском — например:

- «Посчитай, сколько стоит отправить курьером коробку 3 кг из нашего офиса клиенту на Арбат 10»
- «Создай заявку на экспресс-доставку букета к 18:00 и подтверди её»
- «Где сейчас курьер по заявке … и дай ссылку на трекинг для клиента»
- «Покажи ПВЗ в Москве в районе метро Сокол и рассчитай доставку туда»
- «Отмени вчерашний заказ — сначала проверь, будет ли отмена бесплатной»

## Доступ к API

Сервер работает с двумя независимыми контурами B2B API Яндекс Доставки:

| Контур | Назначение | Хост |
|---|---|---|
| **Экспресс** | Доставка день в день (courier/express/cargo) | `b2b.taxi.yandex.net` |
| **Платформа** | Доставка «в другой день», ПВЗ, постаматы | `b2b-authproxy.taxi.yandex.net` |

Авторизация в обоих — заголовок `Authorization: Bearer <токен>`; токен выдаётся в личном
кабинете [dostavka.yandex.ru](https://dostavka.yandex.ru) и действует бессрочно.

> **Один или два токена?** Обычно достаточно общего `YANDEX_DELIVERY_TOKEN`. Если кабинеты
> экспресса и платформы у вас разные, задайте `YANDEX_DELIVERY_EXPRESS_TOKEN` и/или
> `YANDEX_DELIVERY_PLATFORM_TOKEN` — они переопределяют общий для своего контура.

> **Тестовый контур** есть только у платформы: направьте `YANDEX_DELIVERY_PLATFORM_BASE_URL`
> на `https://b2b.taxi.tst.yandex.net` (тестовый токен и `platform_station_id` — в
> [документации](https://yandex.ru/support/delivery-profile/ru/api/other-day/access)).
> У экспресс-контура тестового окружения нет — заявки создаются по-настоящему.

## Установка

<details open>
<summary><b>Claude Code</b></summary>

```bash
claude mcp add yandex-dostavka \
  -e YANDEX_DELIVERY_TOKEN=ваш_токен \
  -- npx -y mcp-yandex-dostavka
```

</details>

<details>
<summary><b>Claude Desktop</b></summary>

`claude_desktop_config.json` — macOS `~/Library/Application Support/Claude/`, Windows `%APPDATA%\Claude\`

```json
{
  "mcpServers": {
    "yandex-dostavka": {
      "command": "npx",
      "args": ["-y", "mcp-yandex-dostavka"],
      "env": { "YANDEX_DELIVERY_TOKEN": "ваш_токен" }
    }
  }
}
```

</details>

<details>
<summary><b>Cursor</b></summary>

`~/.cursor/mcp.json` (или `.cursor/mcp.json` в проекте)

```json
{
  "mcpServers": {
    "yandex-dostavka": {
      "command": "npx",
      "args": ["-y", "mcp-yandex-dostavka"],
      "env": { "YANDEX_DELIVERY_TOKEN": "ваш_токен" }
    }
  }
}
```

</details>

<details>
<summary><b>VS Code</b></summary>

`.vscode/mcp.json` — ключ `servers` (не `mcpServers`)

```json
{
  "servers": {
    "yandex-dostavka": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-yandex-dostavka"],
      "env": { "YANDEX_DELIVERY_TOKEN": "ваш_токен" }
    }
  }
}
```

</details>

## Получение доступа

1. Зарегистрируйтесь как корпоративный клиент на [dostavka.yandex.ru](https://dostavka.yandex.ru)
   и заключите договор (для платформенного контура — подключите станцию отгрузки).
2. В личном кабинете откройте вкладку **«Интеграции»** и нажмите **«Получить токен»**.
3. Запишите токен в `YANDEX_DELIVERY_TOKEN`.

⚠️ Токен хранится **открытым текстом** в конфиге клиента — относитесь как к паролю.
Токен действует бессрочно, но **сбрасывается при смене пароля** аккаунта.

## Настройка

| Переменная | Обяз. | По умолчанию | Описание |
|---|---|---|---|
| `YANDEX_DELIVERY_TOKEN` | да* | — | Общий Bearer-токен для обоих контуров. |
| `YANDEX_DELIVERY_EXPRESS_TOKEN` | нет | — | Токен экспресс-контура (переопределяет общий). |
| `YANDEX_DELIVERY_PLATFORM_TOKEN` | нет | — | Токен платформенного контура (переопределяет общий). |
| `YANDEX_DELIVERY_EXPRESS_BASE_URL` | нет | `https://b2b.taxi.yandex.net` | Хост экспресс-контура. |
| `YANDEX_DELIVERY_PLATFORM_BASE_URL` | нет | `https://b2b-authproxy.taxi.yandex.net` | Хост платформы; для теста — `https://b2b.taxi.tst.yandex.net`. |
| `YANDEX_DELIVERY_LANG` | нет | `ru` | Заголовок `Accept-Language` (обязателен в экспресс-методах). |
| `YANDEX_DELIVERY_TIMEOUT_MS` | нет | `60000` | Таймаут запроса, мс. |
| `YANDEX_DELIVERY_MAX_RETRIES` | нет | `3` | Повторы при 429 (и 5xx для чтений). |

\* Общий токен можно не задавать, если заданы оба контурных.

## Требования

- Node.js 20+ (запускается через `npx`, отдельная установка не нужна).
- Кабинет корпоративного клиента Яндекс Доставки с токеном интеграции.

## Ограничения

- **Это НЕ read-only сервер.** `express_create_claim` + `express_accept_claim` и
  `platform_confirm_offer` реально заказывают доставку и приводят к списаниям;
  отмена подтверждённой заявки может быть платной (проверяйте `express_cancel_info`).
- **Rate limits не опубликованы** — известен только HTTP 429; сервер ретраит его с бэкоффом.
- Тестовое окружение есть только у платформенного контура (см. выше).

## Документация

- [Все инструменты](https://github.com/A1-x-Tech/mcp-yandex-dostavka/blob/main/docs/TOOLS.md) — полный список с описанием.
- [Разработка](https://github.com/A1-x-Tech/mcp-yandex-dostavka/blob/main/docs/DEVELOPMENT.md) — сборка, тесты, smoke-проверка.
- [Публикация](https://github.com/A1-x-Tech/mcp-yandex-dostavka/blob/main/docs/PUBLISHING.md) — релиз и листинг в каталогах MCP.

## Поддержка

Вопросы, идеи и доработки — пишите в Telegram: [@gistrec](http://t.me/gistrec).

## Лицензия

MIT — см. [LICENSE](./LICENSE).
