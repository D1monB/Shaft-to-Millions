# CLAUDE.md: Roblox-гра «глибока шахта» (робоча назва: Shaft to Millions)

Цей файл пояснює Claude, що ми робимо і як із нами працювати. Читай його на початку кожної сесії.
Перша половина описує гру, друга містить технічні правила (стек, архітектуру, безпеку, тести, git).

## Хто ми і як працювати разом

- Розробник: вміє TypeScript/React, але це **перша гра** і перший проєкт на Roblox. Друг робить карту й моделі в Blender, потім переносить їх у Roblox Studio.
- Відповідай **українською**. Код, імена змінних, файлів і коментарі в коді пиши **англійською**.
- Працюй **малими кроками**. Після кожного кроку скажи, що саме перевірити в Roblox Studio (Play-тест) і що має бути видно.
- Ти не можеш запустити Studio, тому **не стверджуй, що щось працює**, поки розробник не перевірив. Кажи «має працювати, перевір так: ...».
- Не додавай функцій, яких немає в поточному етапі. Якщо ідея здається корисною, запропонуй її окремо й запитай.
- Перед великою зміною структури проєкту спершу запитай. Перед великою фічею дай короткий план і дочекайся згоди.
- Пояснюй неочевидні рішення коротко, щоб розробник вивчав екосистему Roblox.
- Якщо вимога суперечить правилу безпеки, зупинись і запитай, а не обирай небезпечний варіант.
- Можна й варто робити короткі опитування (кілька варіантів відповіді), щоб уточнювати дизайн.

## Ідея гри (поточний напрямок)

Гравець спускається у **глибоку діру-шахту** з шарами. На кожному шарі своя руда, настрій і небезпека. Видобуту руду гравець продає або переробляє на **фабриці на поверхні** і росте від бідняка до мільйонера. Цільова аудиторія: 13+.

Ключові механіки:

1. **Шари (глибина).** Чим глибше, тим дорожча руда, але важче дістатися. Глибина це прогрес, ризик і лідерборд («хто найглибше»).
2. **Спуск займає кілька хвилин** і має бути цікавим, а не просто ходьбою (лінії-спуски, гачок, планер, коротка спритність). Підйом не має бути покаранням: ліфт, телепорт у табір.
3. **Конвеєри знизу вгору.** Гравець будує вертикальну лінію (бур + конвеєр/ліфтові секції на кожному шарі), яка піднімає руду до фабрики. Це головна фішка гри.
4. **Табір на кожному шарі:** склад, точка відродження, швидка подорож між відкритими шарами.
5. **Прокачка гравця:** кирка (залізна, сталева, обсидіанова, далі бур), сумка (місткість), кросівки (швидкість). Опційно: ліхтар/кисень як другий обмежувач глибини.
6. **Сундуки з модифікаторами:** улюбленці (збільшують ціну продажу), аура швидкості, аура кирки (більше видобутку). Відкриваються за ігрову валюту або за Robux.
7. **Соціальне:** лише лідерборд (глибина і багатство). Усе інше пізніше.

## Фабрика і ланцюг переробки

Руда їде конвеєрною стрічкою від машини до машини, готовий товар іде на продаж. Продати можна на будь-якому кроці: чим далі по лінії, тим дорожче, але потрібен час.

Руда → Дробарка → Промивка → Горн (злитки) → Лиття (пластини, прути) → Верстат (деталі) → Збирання (механізми) → Продаж.

- Кожну машину потрібно купити. На старті в гравця немає нічого.
- Покращення машини: швидкість, місткість, якість виходу, шанс подвійного виходу.
- Автоматизація: бур із конвеєром, автоподача руди, сортувальник.
- **Ідеї, ще не затверджені:** побічні продукти (пил, шлак), чистота руди, сплави (залізо + вугілля = сталь), різні лінії для різної руди.
- Над кожною машиною видно шкалу прогресу, щоб гравець бачив, скільки чекати.

## Етапи розробки (йдемо по порядку)

- [x] **Етап 0.** Інфраструктура: конфіги, тести під Lune, скіли, агенти, CI.

Стан на 2026-11-24: код етапів 1–3 (крім лідерборду, дробарки, промивки й покращень машин) написаний і покритий тестами,
але **ще не перевірений у Studio**. Що саме є: `docs/README.md`. Наступний крок: Play-тест за чек-листом звідти.
- [ ] **Етап 1.** Перший шар, кирка, сумка, кросівки, продаж, базові ефекти, збереження прогресу.
- [ ] **Етап 2.** Фабрика: горн, дробарка, конвеєр, верстат, покращення машин.
- [ ] **Етап 3.** Бур із конвеєром до поверхні, сундуки з аурами й улюбленцями, лідерборд, другий і третій шари.
- [ ] **Етап 4.** Моби на шарах з приборканням.
- [ ] **Етап 5.** Решта шарів, випадкові події та печери, пізні функції (rebirth, квести, сезонні події).

Перші три етапи вже мають давати повноцінну гру, яку можна випускати. Не починай наступний етап, доки попередній не перевірений.
Задачі ведемо в `docs/roadmap.md` (позначки [код] / [модель] / [разом]); рішення фіксуємо в `docs/decisions.md`.
Як моделі з Studio знаходяться кодом (теги й атрибути): `docs/map-contract.md`.

## Ігрові правила архітектури

- **Сервер вирішує все важливе:** гроші, шкода, видобуток, виробництво, відкриття сундуків. Клієнт лише показує ефекти й надсилає наміри. Ніколи не довіряй клієнту числа.
- **Все налаштовується даними:** шари, руди, машини, кирки, сундуки описуються таблицями в `src/shared/config`. Новий шар або машина це новий запис у конфігу, а не новий код. Жодних «магічних чисел» усередині логіки.
- **Конвеєри:** сервер рахує час і вартість, предмети на стрічці це візуальний ефект на клієнті. Сотні предметів не повинні лагати.
- **Ефекти** (цифри шкоди, частинки, політ руди до гравця) робимо на клієнті з перевикористанням об'єктів (object pool).
- **Глибока карта:** шари це окремі блоки, які підвантажуються за мірою спуску (потокове завантаження карти, StreamingEnabled). Враховуй мобільні пристрої.
- **Збереження:** прогрес не повинен губитися. Зберігай при виході та періодично, обробляй помилки DataStore.

## Обмеження

- **Права.** Ідея глибокої шахти з шарами навіяна аніме, але ми **не використовуємо** назв, персонажів, істот, назв шарів чи дизайну з нього. Те саме щодо будь-яких чужих брендів або людей (назва гри теж). Назви й персонажі лише власні.
- **Сундуки за Robux.** Для платних випадкових предметів Roblox вимагає показувати шанси випадіння. Реалізацію й чек-лист перед публікацією описано в `docs/chests.md`. Гра має проходитися без Robux. **Долари ніколи не продаються за Robux**, інакше всі скрині підпадуть під правила платних випадкових предметів.
- Не використовуй чужі моделі, аудіо та зображення без права на це.
- Тримай гру зрозумілою: перші 10 хвилин лише кирка, продаж і перша піч, потім усе відкривається поступово. Одна чітка підказка «що купити далі».

## Відкриті питання (запитай, перш ніж вирішувати самостійно)

- Назва гри.
- Скільки шарів у першому релізі та як вони називаються (власні назви).
- Що робить гравець під час спуску, щоб не нудьгувати.
- Що відбувається при загибелі в шахті (штраф має бути м'яким). Поки що: відродження в останньому таборі без втрат.
- Назви шарів 2 і 3 (зараз пропозиції: «Іржаві Порожнини», «Базальтова Глибина»).
- Чи потрібні ліхтар/кисень як окрема механіка.
- Які саме побічні продукти й сплави залишаємо.

---

# Technical rules

## Division of work

- The developer owns all code. Models, map and design are made by the friend in Blender / Roblox Studio.
- Scripts live in Git and sync through Rojo. Map and models are NOT edited through this repo's code.
- Never edit binary place files (.rbxl / .rbxm). Models are consumed through documented paths only
  (agree on the Workspace path / names with the map author and record them in `docs/`).
- Roblox Studio MCP (if registered) is READ-ONLY for Claude: inspect the game tree, scripts and Output.
  Tools that change the place or the account are denied in `.claude/settings.json`.
  Exception, chosen by the developer: `user_mouse_input`, `user_keyboard_input` and `character_navigation` need
  confirmation (`ask`), so Claude can click through the game UI in Play mode to test it. Use them only in Play mode, on
  the game's own UI, never on Studio's own windows, publish or settings dialogs.

## Stack

roblox-ts 3.0.0 (TypeScript exactly 5.5.3), Rojo 7.7.1, Lune 0.11.1 (via Rokit), @rbxts/lunit for tests,
ESLint + Prettier, GitHub Actions + Dependabot. Editor: VS Code. Node ≥ 24.

## Commands (keep this list current)

- `rokit install`: install pinned CLI tools from `rokit.toml` (rojo, lune). Once per machine / after changes.
- `npm ci`: install npm dependencies exactly as locked.
- `npm run build`: `rbxtsc` (TypeScript → Luau in `out/`)
- `npm run watch`: `rbxtsc -w`
- `npm run lint`: `eslint . && prettier --check .`
- `npm run format`: Prettier write + ESLint autofix
- `npm test`: build, then run unit tests headless under Lune
- `npm run audit`: `npm audit --audit-level=moderate`
- `npx skills install`: restore third-party agent skills from `skills-lock.json` (pinned commits) into `.agents/skills` and link them for Claude Code. Review a skill before adding it: it runs with full agent permissions.
- `rojo serve`: live sync to Studio (run together with `npm run watch`), Studio Rojo plugin → Connect (port 34872)
- Before finishing any task: build, lint and tests must all pass.

## Architecture: feature slices, adapted to Roblox

Roblox has three runtimes (server, client, shared), so the top level is split by runtime and each runtime is split by feature.

    src/
      shared/   config/  features/<feature>/  lib/   # both sides: NO secrets, NO trust decisions
      server/   app/  features/<feature>/  lib/       # authoritative logic, data, validation
      client/   app/  features/<feature>/  lib/       # input, camera, UI, effects only

Rules:

1. A feature exposes only its `index.ts`. Never import another feature's internals (ESLint enforces it).
2. Dependency direction: `app` → `features` → `lib`. Features talk through their public API or events.
3. Pure game logic (formulas, prices, production timing, state machines, validation) lives in `shared/features/*`
   with NO Roblox API calls, so it can be unit tested without Studio.
4. Game content (layers, ores, machines, pickaxes, bags, shoes, chests) is DATA in `src/shared/config/*`,
   not hard-coded in logic. Balance numbers of a feature live in its `tuning.ts`.
5. Small files, clear names, no clever tricks. Readability beats brevity. Comments explain WHY.
6. No `any`, no non-null assertions without a comment, strict TypeScript.
7. `app/` only starts services/controllers in a fixed order (`main.server.ts`, `main.client.ts`).

Features: profile, mining, bag, upgrades, selling, goals, factory, layers, movement, drill, chests, equipment, world (Studio placeholders), hud.
Details: `docs/architecture.md`, numbers: `docs/economy.md`.

## Security rules (highest priority)

### Authority

- The SERVER decides everything: mining yield, ore value, sales, currency, inventory/bag, production, chest rolls, progression.
- The client sends intent only and renders results. Never trust client-supplied values (amounts, prices, position, cooldowns, IDs).

### Every RemoteEvent / RemoteFunction handler MUST

- Validate argument count and types at runtime with `typeIs` / `@rbxts/t` (TypeScript types do not exist at runtime).
- Validate ranges, enums, NaN/inf, and that referenced instances/IDs exist and belong to the player.
- Check game-state legality (in range of the ore/machine, bag not full, owns the machine, cooldown ready, can afford).
- Be rate limited per player (`shared/lib/rate-limiter.ts`); reject and log abuse (UserId only, rate-limited logging).
  Never throw on bad input from a client, just drop it.
- Never return data the player must not see.

### Player data

- ProfileStore with SESSION LOCKING. One live session per player, no raw DataStore writes for profiles.
- Data schema is versioned. Every schema change ships with a migration and a test. Never break old saves.
- Profile writes happen only on the server. Release the profile on leave and on server shutdown (BindToClose).
- Operations that move value (sell, buy, craft/produce, chest open, store/withdraw from camp storage) must be atomic, to prevent duplication.
- Robux purchases go through `MarketplaceService.ProcessReceipt`, granted exactly once and saved before returning `PurchaseGranted`.
- Store the minimum data needed. No personal information beyond the Roblox user ID. Do not log personal data.

### Secrets and supply chain

- No keys, cookies or tokens in the repo, ever. `.env` is git-ignored; GitHub Actions secrets in CI.
- Do not read, print or commit `.env` or any secrets file.
- Pin dependencies with the lockfile. Add a new package only with a stated reason.
- Run `npm audit` in CI. Dependabot and GitHub secret scanning are enabled.

## Testing

- Pure logic in `shared/features/*` and `shared/lib/*` must have unit tests, including BAD input (wrong types, out of range, NaN, `math.huge`, spam, duplicates).
- Every bug fix gets a regression test.
- Runner: `@rbxts/lunit` under Lune via `scripts/run-tests.luau`. Test files: `*.test.ts` next to the code,
  one class per file, `export = ClassName`. Rojo ignores `*.test.luau`, so tests never ship in the game.
- Code that needs Roblox (DataStore, Players) is tested through ports (interfaces) with fakes.
- CI runs build, lint, tests, `rojo build` and audit on every pull request.

## Git workflow

- `main` = stable releases, `develop` = integration. Short-lived branches `feat/...`, `fix/...`, `chore/...` from `develop`, merged by PR.
- `main` and `develop` are protected: PR only, CI must pass.
- Small commits, clear messages (`feat(mining): add ore node hit`). Do not commit `out/`, `node_modules/`, `.env`, `.rbxl`.
- Game decisions are recorded in `docs/decisions.md` (numbered log: what and why).

## Token efficiency

- Never read `node_modules/`, `out/`, `include/` or `package-lock.json` (blocked in `.claude/settings.json`).
- Show only failing lines of build/lint/test output. `/pre-pr` does this for the four gates.
- Project skills: `/pre-pr`, `/new-feature <name>`. Third-party (reviewed, pinned): `roblox-ui`, `roblox-networking`, `roblox-luau`, `find-skills`.
  They are advice; where they disagree with this file (e.g. `execute_luau`, plain-Luau examples), this file wins.
- A hook formats edited files with Prettier automatically; do not spend turns on formatting.
- Subagents: `security-reviewer` (read-only; run after changes to remotes, player data, inventory, currency,
  mining, production or chests, and before a PR) and `test-writer` (lunit tests incl. bad input for pure logic).
  Also: `exploit-hunter` (cheater mindset, before PRs on value/movement), `balance-analyst` (after price/config changes),
  `game-designer` (ideas only), `ui-reviewer` (after any src/client/**/*.tsx change: phone fit, touch, glyphs, ui-kit),
  `studio-verifier` (when Studio is open: Rojo sync, Output errors, screenshots; read-only MCP),
  `playtest-planner` (the Ukrainian "what to check in Studio" list after each step), `docs-keeper` (updates docs/ only, after a feature).

## Roblox / roblox-ts pitfalls

- Luau reserved words cannot be TS identifiers: `next`, `until`, `end`, `repeat`, `then`. Rename (`updated`, `endsAt`).
- Use `.size()` on arrays, `typeIs(x, "number")` instead of `typeof`, `x === x` to reject NaN.
- Float error: `10 + 1.2 - 10 !== 1.2`. Compare with tolerance in tests.
- Network ownership: the client moves its own character, so everything fairness-critical (money, bag, cooldowns) stays on the server.
- Wrap per-player work in `Heartbeat` in `pcall`, so one failure does not stop everyone.
- Only animations owned by the experience owner/group play; plan animation ownership with the map author.

## First step in a new session

Read this file, review the current state of the project together and propose the next small task from the current stage. Do not jump into a large implementation.
