# Маршрутизація через OmniRoute

## Що встановлено

- `omniroute@3.8.53` (npm, глобально). Це та сама офіційна кодова база: `diegosouzapw/OmniRoute` переїхав у
  `cheaper-inference/OmniRoute`. Свіжішу 3.8.54 я не брав.
- Конфігурація: `C:\Users\Dimon\.omniroute\`.
- **Claude Code, Roblox Studio MCP і скіли не змінювалися.** У коді проєкту нічого не змінено.

## Безпека (чому є власний скрипт запуску)

За замовчуванням OmniRoute слухає на `0.0.0.0`, тобто доступний усій мережі, без ключа й із паролем `CHANGEME`.
`start-omniroute.ps1` прив'язує його до `127.0.0.1` і задає випадковий пароль. Перевірено: порти 20128, 20131 і
20132 слухають тільки на `127.0.0.1`, а `/v1/models` без ключа повертає 401. **Запускай лише через цей скрипт.**

## Як запустити

1. PowerShell: `& $env:USERPROFILE\.omniroute\start-omniroute.ps1`. Вікно не закривай.
2. Відкрий http://127.0.0.1:20128. Пароль у `C:\Users\Dimon\.omniroute\dashboard-password.txt`.
3. **Providers → Add:** додай ключі з [FREE_PROVIDERS.md](FREE_PROVIDERS.md), почни з `gemini`.
4. **API Keys → Create:** це ключ самого OmniRoute.
5. Тести: `$env:OMNIROUTE_API_KEY="<ключ OmniRoute>"; node $env:USERPROFILE\.omniroute\test-models.mjs --list`,
   потім `node ...\test-models.mjs <model1> <model2>`.

## Ланцюжки з fallback (створити після тестів: Dashboard → Combos)

Тип комбо: **priority**. Наступна модель береться лише тоді, коли попередня впала або вичерпала ліміт. Порядок
поки **попередній**; остаточний визначать тести.

| Комбо | Для чого | Попередній порядок |
|---|---|---|
| `free-coding` | Claude Code, код, MCP (потрібен tool calling) | Gemini (найновіша безкоштовна Flash) → OpenRouter `:free` з tool calling → Mistral (код-модель) |
| `free-fast` | Короткі питання, тексти, переклади | Groq → Cerebras → Gemini Flash-Lite |

У `free-coding` додавай **тільки моделі, які пройшли тест `tools`**.

## Claude Code через OmniRoute

`& $env:USERPROFILE\.omniroute\claude-via-omniroute.ps1` (спершу задай `$env:OMNIROUTE_API_KEY`).
Скрипт змінює змінні **лише в цьому вікні термінала**. Звичайний Claude Code (і VS Code) працює як раніше, на твоїй
підписці.

## Чесні обмеження

- Claude Code надсилає великі запити (десятки тисяч токенів). Багато безкоштовних тарифів їх не пропускають через
  ліміт токенів за хвилину. Реально придатний передусім Gemini.
- Безкоштовні моделі помітно слабші за Claude в roblox-ts і архітектурі. Давай їм дрібні задачі й перевіряй
  результат: `npm run build`, `npm test`, `npm run lint`.
- Правила проєкту (CLAUDE.md, безпека remotes) безкоштовна модель може порушити. Перед merge зміни в безпеці й
  грошах перевіряй окремо.
