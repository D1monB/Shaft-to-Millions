# Моделі за категоріями задач

**Рейтинг ще не виставлено.** За твоєю вимогою, спершу практичні тести на задачах з проєкту (див.
[TEST_RESULTS.md](TEST_RESULTS.md)). Для них потрібні безкоштовні ключі.

## Проєкт (що саме мають уміти моделі)

roblox-ts (TypeScript → Luau), Rojo, feature slices `src/{shared,server,client}/features/*`, баланс як дані в
`src/shared/config`, чиста логіка з тестами lunit під Lune, UI на `@rbxts/react`, 4 мови в `config/i18n`,
сервер вирішує все важливе (правила в CLAUDE.md). Докладніше: [../architecture.md](../architecture.md).
Graphify на цьому ПК не запустився (Windows Application Control блокує `_socket.pyd`), а в хмарному Graphify цього
репозиторію немає, тому опис зроблено з коду й документації.

## Категорії та що потрібно від моделі

| Категорія | Потрібно | Тест у скрипті |
|---|---|---|
| Luau / roblox-ts | знає roblox-ts, а не чистий Lua; перевіряє поганий ввід | `luau` |
| Архітектура | великий контекст, дотримання правил проєкту | вручну (поки немає) |
| Дебаг і security review | бачить довіру до клієнта, NaN, спам | `security` |
| Roblox UI | `@rbxts/react`, а не веб-HTML | `ui` |
| Roblox Studio MCP | **tool calling** обов'язково | `tools` |
| Продуктивність | розуміє object pool, StreamingEnabled | вручну (поки немає) |
| Документація й локалізація | грамотна українська | `uk` |

## Кандидати для тестів

Gemini (Flash і Flash-Lite), моделі OpenRouter `:free` з tool calling (сімейства Qwen Coder, DeepSeek,
Llama), Groq (Llama / gpt-oss), Cerebras (Llama / gpt-oss), Mistral (Codestral / Devstral). Точні id покаже
`test-models.mjs --list` після підключення ключів.

Roblox Studio MCP залишається в основному Claude Code. Через безкоштовні моделі **не давай їм писати в Studio.**
