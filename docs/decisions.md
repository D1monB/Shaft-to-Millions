# Decisions log

Numbered log of game and technical decisions: what we decided and why. Newest at the bottom.

## 001. Infrastructure from the starter kit

- **Date:** 2026-11-24
- **Decision:** roblox-ts + Rojo, tests with @rbxts/lunit under Lune, feature slices by runtime, CI on every PR.
- **Why:** strict typing, fast headless tests of pure logic, server authority enforced by structure.

## 002. Layer 1: ores, name, currency

- **Date:** 2026-11-24
- **Decision:**
    - Layer 1 is called "Сірі Пласти" (id `grey_seams`).
    - Ores (id, price per piece, hits with the starter pickaxe): `coal` 2 / 2 hits, `copper` 5 / 3 hits, `iron` 9 / 5 hits.
    - Currency is "Долари", shown with the `$` symbol.
- **Why:** familiar ores that match the later processing chain (ore → crusher → furnace); cheap-to-expensive order teaches the player to dig for better ore. Numbers are a starting point and will be tuned after play tests.
- **Note:** death penalty is still undecided. Temporary rule: respawn at the camp, nothing lost.

## 003. Layers 2 and 3, the quartz teaser, pickaxe tiers

- **Date:** 2026-11-24
- **Decision:** layers "Іржаві Порожнини" (silver, gold) and "Базальтова Глибина" (obsidian, cobalt). Quartz on layer 1 needs a
  steel pickaxe. Pickaxes: iron, steel, obsidian, hand drill, plasma drill; `tier` decides which ore, `power` how many hits.
- **Why:** a locked ore that is visible from the first minute is the clearest "what next" goal. Names are our own.
- **Status:** layer names are proposals, change them freely in `layers.ts`.

## 004. Mining is per player and goes through ClickDetector

- **Date:** 2026-11-24
- **Decision:** a broken block disappears only for the player who broke it. Clicks are read on the server (ClickDetector),
  there is no "I hit" remote.
- **Why:** players do not fight over blocks; the client cannot claim hits at all.

## 005. Factory: warehouse, queues by timestamp, manual collect

- **Date:** 2026-11-24
- **Decision:** ore goes bag → warehouse → machine queue (inputs reserved immediately) → "ready" → warehouse. Queues are
  computed from server time, so they finish while the player is offline. Coal is fuel for iron/silver/gold.
- **Why:** correct after leaving and joining another server; no ore can be sold and smelted at once.

## 006. Auto drill rules

- **Date:** 2026-11-24
- **Decision:** a layer's drill unlocks after reaching the NEXT layer's camp, mines only ore the player's pickaxe can mine,
  is ~10x slower than mining by hand, has a buffer, delivers by conveyor into the warehouse, counts at most 8 h offline.
- **Why:** automation adds income but must never make manual mining pointless.

## 007. Chests and Robux

- **Date:** 2026-11-24
- **Decision:** three chests (pets, speed auras, pickaxe auras), odds shown before any payment, dollars or Robux.
  Dollars are never sold for Robux. Robux is blocked for PolicyService-restricted players (fail closed).
  Each receipt is granted once and saved before it is acknowledged.
- **Why:** Roblox paid-random-items policy (see docs/chests.md); the game must be fully playable without Robux.

## 008. Equipment slots and bonus caps

- **Date:** 2026-11-24
- **Decision:** 1 speed aura, 1 pickaxe aura, 3 pets. Pet bonuses add up, capped at +150%; speed +30% (WalkSpeed ≤ 40);
  ore yield +100%. Spare items sell for a small fixed price.
- **Why:** stacking must not trivialise progression; caps are guarded by tests.

## 009. Death in the mine (temporary)

- **Date:** 2026-11-24
- **Decision:** respawn at the last reached camp, nothing is lost.
- **Status:** temporary until play tests; the real penalty is still an open question.

## 010. Fixes after the first security review

- **Date:** 2026-11-24
- **Decision:** ore can only be mined on opened layers; at least 45 s between layer unlocks; camps are not Roblox spawn
  points (the server moves the character to the last opened camp); unknown keys in id maps never make a save unloadable;
  item uids must be `i<digits>`; the Robux policy flag is a Player attribute with retries; ProcessReceipt decisions are unit tested.
- **Why:** the review found that a teleport exploit could open every layer within seconds and mine deep ore, and that a
  save written by a newer server could lock a player out. A full server-side movement check is still on the roadmap.

## 011. Dev shortcuts exist only in Studio

- **Date:** 2026-11-24
- **Decision:** play-test shortcuts (money presets, max gear, all layers) are a feature whose server service returns at once
  unless `RunService.IsStudio()`. No admin list, no chat commands. Money amounts are fixed presets.
- **Why:** an "admin" check on live servers is a permanent backdoor and a target. Not registering the remote at all means
  there is nothing to attack. If real admin tools are ever needed (moderation), they get their own design and security review.

## 012. Player plots around a shared pit

- **Date:** 2026-11-24
- **Decision:** up to 6 players per server. Each player gets a free plot (1–6) with its own colour on join; the factory,
  storage and the conveyor from the central pit stand on that plot. The plot is released on leave. Progress stays in the
  profile, not in the plot, so any plot works for any player.
- **Why:** matches the agreed map concept (shared open pit in the middle, factories on the rim). Needs a new map contract.

## 013. Client UI on React

- **Date:** 2026-11-24
- **Decision:** all client UI is rebuilt with `@rbxts/react` + `@rbxts/react-roblox` (hooks: `@rbxts/pretty-react-hooks`,
  springs: `@rbxts/ripple`). The old instance-based `client/lib/ui.ts` is removed panel by panel. Fonts are Roblox built-in.
- **Why:** React is the most used UI library in roblox-ts, the developer already knows it, and components make a
  consistent themed UI (wood, gold, player colour) much cheaper than hand-built instances.
- **Order:** UI first, then the Studio play-test of gameplay, then plots.

## 014. Server-side movement check

- **Date:** 2026-11-24
- **Decision:** every 0.25 s the server compares the character's horizontal position with an honest "anchor" (moved forward
  once per second). Allowed distance is the server's own walk speed (shoes + aura) x 1.5 x time + 4 studs. Small excess is a
  strike (3 in a row pull the player back), a jump of 50+ studs beyond the allowance is pulled back at once. Vertical
  movement has its own limits (rise 50 studs/s, fall 700 studs/s, because falls in the shaft are fast and legal).
  Dead characters are skipped without losing the baseline. `Humanoid.Sit` is NOT trusted (the client controls it).
  After a server stall longer than 3 s the check starts over. Numbers live in `shared/features/movement/tuning.ts`.
- **Server moves are marked:** code that moves a character itself (camp respawn now; elevator and fast travel later) must
  call `resetMovementBaseline(player)` afterwards, or the honest player is pulled back.
- **Why:** the first security review showed a teleport exploit. The anchor (not "previous sample") is used because the slack
  would otherwise be granted again for every sample and a 3x speed hack would pass. Known limit: a hack of about 1.7x or less
  is not caught; that is the price of not punishing lag.

## 015. Fast travel

- **Date:** 2026-11-24
- **Decision:** a menu button opens a list of the surface and every opened camp. Travel is free with a 30 s pause per
  player (`shared/features/travel/tuning.ts`). The server checks the destination (integer 0..N, camp opened, character
  alive, pause over), moves the character and calls `resetMovementBaseline`. The surface point is a new map tag
  `SurfaceSpawn` (one Part). The pause starts only after a successful trip.
- **Why:** going up must never feel like a punishment (CLAUDE.md). The pause stops constant hopping and keeps the descent
  meaningful. Not free or tied to depth for now: the economy is not measured yet.
- **Not included:** an elevator with its own animation. A later feature can reuse the same service.

## 016. Machine and warehouse upgrades

- **Date:** 2026-11-25
- **Decision:** each machine has two upgrade tracks (speed x1 / 1.25 / 1.6 / 2, queue 10 / 15 / 20 / 30) and the warehouse has
  capacity levels (1000 / 2000 / 4000 / 8000). Levels are saved (`machines.<id>.speedLevel/queueLevel`, `levels.warehouse`).
  Prices are guesses in `shared/config/machines.ts`. Buying happens through two server-checked remotes at the machine or
  the warehouse; money and level change in one frame. Finished crafts are settled at the OLD speed before a level changes.
- **Schema:** version 2 with a migration that adds the new fields (an older server must refuse a v2 save instead of cutting
  the longer queue and deleting crafts). The queue cut in `sanitize` uses the machine's own queue level.
- **Why:** the balance analysis showed the factory stops mattering after about tier 3. Upgrades give a reason to invest in it.
- **Upgrade mid-craft:** a speed upgrade keeps the share of the craft in progress (`setSpeedLevel`), so it never finishes at once.
- **Open:** prices and multipliers need a play-test (see docs/balance-tuning.md). The sell-vs-process estimate already uses
  the upgraded speed.

## 017. Pets are drawn by every client

- **Date:** 2026-11-25
- **Decision:** the server no longer welds pet balls to characters. It publishes the equipped pet item ids as a Player
  attribute (`EquippedPets`). Each client draws the pets of all players from an object pool and moves them with frame-rate
  independent smoothing and a small bob, fanned out behind the owner. Players farther than 120 studs from the camera get no
  pets drawn. Pets jump to their target after a teleport instead of flying across the map.
- **Why:** smooth movement needs per-frame updates, which welds cannot give without network ownership problems, and the
  server should do no per-frame work (CLAUDE.md: effects on the client with object pools). The attribute is read
  defensively (`decodePets` keeps only known pet ids, at most 3).
- **Not included:** real pet models. The friend's Blender models can replace the balls later; only `acquirePart` and
  `style` in `client/features/pets/pets-controller.ts` need to change.

## 018. Bigger UI and a font comparison

- **Date:** 2026-11-25
- **Decision:** the first play-test found the UI too small. The screen scale is now computed from a design height of 620
  (was 760) with limits 0.7..1.5 (was 0.6..1.2), text sizes are about 18% larger (body 20, title 30), chips, menu buttons,
  the title sign and the goal banner are bigger, and the menu column moved to the right edge so it never overlaps the stat chips.
  The UI showcase (Dev panel) shows 12 fonts with Ukrainian letters for choosing the final font.
- **Why:** on a 720 px high window the old scale gave about 12 px chip text; on a phone it shrank to 0.6 and gave about 10 px.
  `FredokaOne` has no Cyrillic, so titles used a fallback font. The font is chosen by the player in the showcase, not guessed.
- **Font:** BuilderSans (ExtraBold for titles and numbers, Bold for text), chosen by the developer in the showcase.

## 019. "Juicy" 2.5D UI style

- **Date:** 2026-11-25
- **Decision:** the UI follows the developer's HTML reference (Pet Simulator / Mining Simulator style): thick dark outlines,
  a dark block under every button, ribbon and panel ("3D" depth), top-to-bottom colour ramps, a glossy highlight on buttons,
  white outlined text, a gold ribbon title over each panel, a big red close button, dark inset wells for grouped content,
  and a light sweep on the main buy button. All of it is in `client/lib/ui-kit` (`theme.ts` ramps, `effects.tsx`), so
  features get the style without changes.
- **How (Roblox limits):** outlines are UIStroke, ramps are a UIGradient on a white background, the depth is a dark sibling
  frame, rays behind legendary items must sit in a CanvasGroup (ClipsDescendants does not clip rotated children).
- **Not included yet:** custom icons. The reference uses drawings; in Roblox they must be images owned by the game owner.
  Until the map author draws them, emoji sit inside coloured tiles.
- **HUD layout (1:1 with the reference picture, the developer asked for it):** money and bag capsules side by side at the top
  centre, one column of square stat tiles on the left edge (a short value on the tile, the full text on hover or tap), the
  coloured dock on the right edge, the goal at the bottom with a progress bar (`pickGoalInfo` gives title, status, progress).
  Not copied on purpose: the green "+" next to the balance (it would read as "buy money"; dollars are never sold) and a
  "Chest" dock button (chests open at their stands).
- **Chest panel:** rewards as rarity cards in a grid (chance, icon, name, rarity, effect), the legendary card with turning
  rays, a storage pill and a big green open button; the odds stay visible before any payment (Roblox policy).
- **Inventory:** tabs by category (pets, speed auras, pickaxe auras) with counts; one rarity card per kind of item with
  "×N" for copies (`groupInventory`, unit tested), equipped items first with a green outline and "✔ НАДІТО". The rarity card
  (`client/lib/item-card.tsx`) is shared with the chest odds grid.
- **Phones first:** the close cross is drawn (BuilderSans has no "✕"), the close button stays inside the board, stat tiles
  start a second column only when a short screen has no room, and on touch screens the dock sits higher, away from the jump
  button.

## 020. Gear catalogue instead of gear levels

- **Date:** 2026-11-25
- **Decision:** pickaxes, bags and shoes are separate items, not levels 1–6. The developer wanted many of them, like the
  material ladders in sandbox mining games (wood, stone, copper, iron ...), so the game is more interesting. Names are plain
  materials, no item names from other games.
- **Rules (chosen in a poll):** a main line where each item is better, plus side items with a different strength (⚡ the
  light pickaxe hits fast but weak, the hammer pickaxe is slow but one-shots hard ore). Price = money + materials from the
  warehouse (ingots from the furnace, ore, parts), so the furnace matters for progress. Everything is for sale at once; the
  materials themselves gate the order. Bought items are kept forever, the player equips any owned item anywhere.
- **Data:** profile schema v3: `gear.owned` (ids) + `gear.equipped` (one id per slot) replace `levels.pickaxe/bag/shoes`.
  The migration turns each old level into the closest new item that is never weaker (old ore tier is kept). Unknown ids are
  kept in the save (an item from a newer server is never taken away) and fall back to the starter at runtime.
- **Server:** `BuyGear(id)` checks distance to a shop, money and materials, then takes money and materials, adds the item
  and equips it in one frame (atomic); owning the item already is a refusal, so a double click never charges twice. `EquipGear(id)` only
  accepts owned items. Both are rate limited.
- **To check in a play test:** the first 10 minutes. The copper pickaxe and the miner backpack now need copper ingots, so the
  furnace comes earlier than before; `balance-analyst` should look at it after the play test.

## 021. Server-to-client remotes are declared at startup

- **Date:** 2026-11-25 (draft, check)
- **Decision:** every RemoteEvent that only the server fires (`StateUpdate`, `Notify`, `MineProgress`, `NodeBroken`,
  `ChestResult`) is created at server start with `declareClientEvent(name)` (`server/lib/remotes.ts`), before any player joins.
- **Why:** created lazily on the first `FireClient`, the remote did not exist yet when the client started. The client waited
  ("Infinite yield" warning) and could connect its handler only after the first message, so exactly that message was lost.
  Client-to-server remotes are still created by `onClientRequest`.

## 022. UI automation: Studio MCP clicks in ask mode

- **Date:** 2026-11-25 (draft, check)
- **Decision:** `user_mouse_input`, `user_keyboard_input` and `character_navigation` moved from deny to `ask` in
  `.claude/settings.json`, so Claude can click through the game UI in Play mode (each call needs the developer's confirmation).
  Rules: only in Play mode, only on the game's own UI, never on Studio windows or publish/settings dialogs; targets are
  found by `instance_path` only, never by screen coordinates. For that, React elements get stable instance names
  (Tabs, the recipe button row, machine panel cards and buttons) and lists use stable keys.
- **Why:** the play-test checklist is long; clicks by path do not break when the layout or window size changes.
  Everything else that changes the place or the account stays denied.

## 023. Gear reachability fix and open balance questions

- **Date:** 2026-11-25
- **Fix:** the cobalt pickaxe needed cobalt ore, which only a tier 4 pickaxe can mine, so it could not be bought before the
  hand drill (and the drill is stronger). It now needs obsidian and gold ingots (reachable with tier 3). A unit test walks
  the progression from the starter and fails if any pickaxe's materials need a higher tier than the player can have.
- **Known and kept on purpose until the play-test (from the balance analysis):** the hammer pickaxe is the first way to tier 3
  (the gold and obsidian pickaxes need tier 3 ore), the hand drill is the first way to tier 4; the light pickaxe, the copper
  pickaxe and a few shoe/bag steps give little for their price; the first furnace comes at about 7-9 minutes, tight against
  the 10-minute rule. Numbers to tune after timing a real run: first stone pickaxe, leather bag, furnace, iron pickaxe.

## 024. Early-game price trim (draft, check)

- **Date:** 2026-11-25 (draft, check)
- **Decision:** furnace $500 -> $400; copper pickaxe $200 + 5 copper ingots -> $120 + 3 ingots; iron pickaxe 8 -> 6 iron
  ingots. The goal hint (`nextGearToBuy` with the pickaxe tier) now skips items whose materials the current tier cannot
  reach, and prefers a cheaper higher-tier side pickaxe (the hammer, $15 000) over the main line item (the drill, $200 000).
- **Why:** the balance-analyst model estimated the first furnace at about 8 minutes and the iron pickaxe at 11-12 minutes,
  against the 10-minute rule; the copper pickaxe gave only about +14 $/min. The hint pointed at items the player could not
  yet buy.
- **Left unchanged on purpose:** bags above 150, shoes Riveted/Silver, the light pickaxe. Tune them only after a timed
  Play-test measures the real trip time and seconds per node (the model is not a measurement).

## 025. Leaderboard: two boards on OrderedDataStore (draft, check)

- **Date:** 2026-11-25 (draft, check)
- **Decision:** two boards, depth (`deepestLayer * 100000 + deepestMeters`) and wealth (`stats.totalEarned`). Stored in
  OrderedDataStore `Leaderboard_Depth_v1` and `Leaderboard_Wealth_v1`, written with `UpdateAsync` that keeps the higher
  score. Sync every 60 s, plus a write on profile release and in `BindToClose`; the top 10 goes server -> client
  through `LeaderboardUpdate`. In Studio a memory store is used instead. The profile gets a field `deepestMeters`
  (no schema bump, default 0, sanitized on load).
- **Depth rules:** recorded only from movement samples with verdict ok AND a server raycast down onto anchored map
  geometry; capped by the camp of the first locked layer (no record if that camp is missing; the last layer is capped
  at `MAX_DEPTH_METERS` 99 999). Meters = studs below the highest `SurfaceSpawn` * 0.5.
- **Why OrderedDataStore, not profile stats:** a profile is locked to its owner's session, so other players' scores
  cannot be read or ranked from it; an ordered store gives a global top without loading profiles.
- **Why `totalEarned`:** it only grows, so the board does not drop after spending money on gear.
- **Why a raycast, not `FloorMaterial`:** `FloorMaterial` is computed on the client (which owns its character) and
  can be faked; a server raycast onto anchored geometry cannot.
- **Why a memory store in Studio:** Studio test sessions must not write test scores to the live ordered stores.
- **Open:** a ban list (cheaters stay on the board until removed by hand); bumping the store version (`_v2`) to reset
  the boards.

## 026. Sounds: licensed only, silent by default (draft, check)

- **Date:** 2026-11-25 (draft, check)
- **Decision:** sound ids live in `src/shared/config/sounds.ts` (`SOUNDS`, `ORE_BREAK_SOUNDS`). The client keeps a pool of 3
  `Sound` instances per sound with a `minGap` rate limit (`src/client/lib/sounds.ts`, `playSound` / `playOreBreak`). Sounds
  play on mining hit and ore break, toasts (success, error), chest open and the rare-drop fanfare, machine enqueue, done
  and collect.
- **Licensing rule:** only sounds from licensed Creator Store libraries (now ProSoundEffects and RBLXEssentials) are used.
  Nothing from outside, no ripped or unknown-origin audio.
- **Silent = empty `assetId`:** an empty id means no sound is played. The error sound is silent for now, because no
  licensed one was found. A sound can be added later by filling in the id, with no code change.
- **Per-ore sound via pitch:** every ore uses the same file at a different `speed`, so each ore sounds distinct without
  needing many licensed files.
- **Machine-done is polled on the client:** production is timestamp based and the server sends no "done" event, so the
  client checks the queue once a second and plays the sound once per finished item.
- **Why a pool:** many hits per second must not create or destroy `Sound` instances (mobile performance).

## 027. Tycoon line instead of recipes (draft, check)

- **Date:** 2026-11-25 (draft, check)
- **Decision:** the factory becomes a tycoon line on the player's plot (one of `Map/Plots/Plot1..6`), built from the
  friend's 12 machines `M01_HydroWasher` .. `M12_QuantumAssembler`. An item is "ore + stage" (stage 0 = raw ore,
  stage 12 = reactor); each machine turns stage N into stage N + 1. There are no recipes and no ingots any more.
- **Value:** `ore base value * stage multiplier * quality bonus of the machines passed`. The stage table grows about
  x1.84 per stage, so a $10 ore becomes a ~$15 000 reactor (friend's target).
- **Flow:** machines are bought in order; the player drops ore from the bag into the hopper (queue of the first machine);
  the item leaves the last owned machine and is sold automatically. The server counts time and money; items on the
  belts are only drawn by the client.
- **Machine upgrades:** speed, double-output chance, quality (value bonus) and queue capacity (so a slow machine is a
  bottleneck worth upgrading, not a silent loss).
- **Ores:** the friend's 6 ores (copper, iron, gold, titanium, obsidian, etherium) on the 5 floors of his pit.
- **Gear:** costs money only (no materials).
- **Offline:** the line keeps running while the player is away at half speed, for at most 8 hours (tunable).
- **Why:** matches the friend's map and the tycoon genre; one generic rule instead of a recipe per product, so a new
  ore works on the whole line with one config entry.
- **Schema v4 (step 2, ores):** removed ores and products (coal, quartz, silver, cobalt, silver ingot, silver contact)
  are paid out at their old prices; removed recipes leave machine queues and are refunded; a drill on an ore that
  moved to another layer switches to the layer ore and its buffer is paid out. The bump also raises the layer cap
  from 3 to 5. Gear item ids are kept (saved in profiles); only display names changed (silver -> steel, the old
  obsidian/cobalt pickaxes are now titanium/obsidian).
- **Schema v5 (step 3, line state):** the furnace, the workbench and the warehouse are removed. Their price, every
  upgrade level paid, the warehouse level, the stock and the queued and finished crafts are paid back at version 4
  prices. The profile gets `line` (bought machines, levels, queues) and `lastSeen` (for the offline run). Drills now
  deliver into the hopper of the line; without a line machine the ore waits in the drill buffer. The tags `Warehouse`,
  `Machine` and the attribute `MachineId` are gone from the map contract (plot tags come with the line service).
- **Plots (step 4b, developer's design 2026-11-25):** plots start empty; the map author's Factory is a template kept in
  ServerStorage. A player claims a free plot by holding E on its sign; then the belt and the SellStation are built,
  and each machine appears on its place only after it is bought (strictly in order). The belt always runs: ore is
  dropped at the start of the belt (the first machine's place); with no machine raw ore sells at the SellStation, each
  bought machine raises the value. New players appear on the first free plot, owners on their plot (an opened camp
  still wins). The line state gained `intake` and `beltProgress` (v5 was not released, so no new schema version).
- **Open:** AFK plot squatting (an idle owner keeps a plot until they leave); an idle timeout is a later task.
- **Play-test on the friend's map (2026-11-25):** passed - plots claimed, belt and SellStation built, machine bought
  and placed in its belt gap, ore dropped and sold (balance grew by the line price). Two fixes: the claim prompt moved
  from the sign (50 studs up, unreachable) to a ground point at the plot spawn; players standing on a new machine are
  moved aside. Not tested: save across sessions (Studio API access is off in the friend's experience).

## 028. Faster walking, softer movement check (2026-11-25)

- **What:** shoes now go from 20 (start) to 50 (best), was 16..30; the cap after a speed aura is 65 (50 x 1.3).
  The movement check allows 1.8x the walk speed (was 1.5x), 8 studs of slack (was 4: the belt carries players) and
  treats a single jump of 80+ studs over the allowance as a teleport (was 50). In Studio the check only warns and
  never pulls back.
- **Why:** the developer found walking too slow for a deep shaft, and the pull-back fought Studio tools (moving or
  scaling a character during Play) and could catch players carried by the belt. Live servers still pull back.

## 029. UI restyle: "dark glass + neon", left-right card rows (2026-11-25)

- **What:** the timber "juicy" theme is replaced by translucent graphite panels with a thin neon outline in the
  section colour (pets pink, pickaxe aura violet, speed aura teal, default orange), a compact title on the left and a
  small close button. Cards are dark with the rarity colour glowing from the top. The UI is about 30% smaller on a PC
  (design height 760 instead of 620, smaller text, strokes, depth and HUD); phones keep the 0.7 floor. Card lists
  (chest odds, shop, equipment) are one row that scrolls left-right; the main action of a panel (open chest, equip
  best) is pinned under the content (`PanelSpec.footer`) and never scrolls away.
- **Why:** the developer found the UI bulky and the vertical grids awkward (opening a chest needed scrolling down),
  and the brown timber clashed with the friend's map (light concrete, orange rocks, neon terminals).

## 030. Movement check waits for server teleports to arrive (2026-11-25)

- **What:** after the server moves a character (plot spawn, camp respawn, fast travel) the movement check gets the
  target and skips samples until the character is within 12 studs of it (at most 2 s), then starts a new baseline
  there. A character that does not arrive in time is put at the target (live servers; Studio only warns).
  The wait is not a free pass (exploit review): a sample is accepted only near the target or within walking reach
  of the spot the character was teleported from; anything else is put at the target at once. Server code moves
  characters only through `teleportCharacter` (movement feature), which records that spot.
- **Why:** the client owns its character, so for a few frames after a server teleport the server still saw the old
  position; the check measured from it and flagged honest players on every join (would pull them back live).

## 031. One ore per layer; silver and iridium replace obsidian and etherium (2026-11-25)

- **What:** layers 1-5 hold copper, iron, silver, gold, titanium (one ore each); iridium grows only in the portal zone
  at the bottom of layer 5 and is never drilled (`drillable: false`). Prices 5 / 12 / 30 / 70 / 150 / 400. Ore ids
  match the map author's `ServerStorage.ItemTemplates/<ore>` folders. Schema v6 shifts every saved ore to the ore with
  the same price, all at once: gold $30 -> silver, titanium $70 -> gold, obsidian $150 -> titanium, etherium $400 ->
  iridium (bag, belt intake, machine queues, drills; an etherium drill moves to titanium, iridium is never drilled).
  First version renamed only obsidian/etherium and would have repriced old gold and titanium 2x (security review).
  Pickaxe and bag display names follow the ores (ids unchanged): tier 3 "Срібна", tier 4 "Золота", tier 5 "Титанова".
  Ore blocks stay as before: any Part/Model tagged `OreNode` with an `OreId` attribute.
- **Why:** the developer and the map author changed the design (each ore on its own layer, iridium only near the
  portal); the earlier per-spawn ore tables were dropped. Renaming by price means no player loses value.
- **Later:** the portal will lead to another location (another canyon and mine with other ores). Not in this stage.
