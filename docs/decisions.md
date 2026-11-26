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

## 032. Balance pass after the ore shift (2026-11-25, balance-analyst, approved by the developer)

- Plasma drill power 16 -> 25 (it was the same as the hand drill for 3x the price); hammer power 12 -> 13 (gold in
  one hit, as described); light pickaxe $2,000 -> $1,200; steel pickaxe $4,000 -> $2,800 (wall before silver);
  silver pickaxe $12,000 -> $8,000.
- Late machines: M10 $650k -> $1.5M, M11 $1.6M -> $4M, M12 $4M -> $10M (deep-ore players paid them back in minutes).
- Drills on layers 4 and 5 faster: 3.5 -> 2 and 3 -> 1.5 seconds per hardness. Drill names follow the layer names.
- Numbers are first estimates; confirm in a play-test.

## 033. Languages: English source, our own texts for en/uk/ru/pl, Roblox auto-translation for the rest (2026-11-25)

- **What:** every player-visible text is a key in `src/shared/config/i18n/{en,uk,ru,pl}.ts` (English is the source;
  the compiler and a test check that every language has every key and the same `{placeholders}`). Configs keep ids
  only; names come from keys built from ids (`nameKeys`, e.g. `ore.copper`, `machine.M01`, `gear.pickaxe_iron`).
  The server never picks a language: `notify` sends a key plus values (names as `@key` refs), world texts (prompts,
  sign labels) carry the key as an attribute with tag `Localized`, and each client writes the words itself.
- **Which language:** the menu choice (saved as profile `language`, `""` = automatic; no schema bump, the default
  fills old saves), else the player's Roblox language (`Player.LocaleId`), else when Roblox is in English the country
  Roblox reports (UA -> uk, PL -> pl, RU/BY/KZ/KG -> ru; asked on the client, never sent or stored), else English.
  A Roblox language we do not have gets English with `AutoLocalize` on, so Roblox's automatic translation may
  translate it (needs Automatic translation turned on for the experience in Creator Hub). Our own languages have
  `AutoLocalize` off.
- **Why:** the developer wants English first plus the players' own languages; own tables work in Studio, are tested,
  and translate texts with numbers correctly, which Roblox's auto-capture does poorly.
- **Notes:** texts avoid plural forms ("Ore sold: {count}") so one template fits every language. Studio-only tools
  (devtools panel, placeholders) are plain English. Inventory cards now sort by item id, not by name.

## 034. Ore blocks on the map author's spawn points; iridium near the portal (2026-11-25)

- **What:** at server start, every BasePart in `Map/Mine/OreSpawns/Tier<N>` gets a 4-stud ore block of layer N's
  main ore (copper, iron, silver, gold, titanium), tagged `OreNode` with `OreId`, so the mining service needs no
  change. Points of the deepest layer within `PORTAL_ORE_RADIUS` (60 studs, ground plane) of
  `Map/Mine/TunnelEntrance/Portal` grow iridium (`nearPortal` ore); on the current map that is 2 of 11 Tier5 points.
  Blocks are plain coloured parts in `Workspace/MapOre` until the map author models ore blocks.
- **Why:** the map author placed spawn points instead of tagged blocks; without this the live game had no ore.

## 035. Belt route follows the pieces' direction of travel (2026-11-25, bug fix)

- **What:** the item route joins belt pieces end to start using the map author's rules (`ConveyorFlow`, straight along
  local X, quarter-turn arc on corners), walks back to the head of the belt, then forward. Replaces "nearest piece
  centre" ordering.
- **Why:** the old ordering started at machine 1, walked against the belt and covered only 19 of 89 pieces, so most
  machine places collapsed onto two path points and items could not ride between them. Checked in Play on the
  friend's map: no coverage warning, the 12 machine places follow each other along the path.

## 036. Machine upgrades in the UI, progress bars and the next-machine goal (2026-11-26)

- **What:** every bought machine has an invisible point with a prompt (R, gamepad R1, tap) that opens a panel with
  the four upgrade tracks; a progress bar and queue counter hang above each machine of the player's own plot; the
  "what next" banner also offers the next line machine. The server does nothing on the prompt press: a level is still
  bought only through `UpgradeLineMachine`. Trying it from too far now tells the player to come closer instead of
  logging abuse.
- **Why:** upgrades existed on the server but a player had no way to buy them. The bars are drawn on the client from
  the player's own line state, so they need no extra network traffic; other players do not see them.
- **Play-test:** the map author's machines are rotated by 90 degrees and up to 30 studs tall, so the bar height is
  measured from the parts' world extents, capped at 12 studs and drawn on top of the model.

## 037. The map author's 10 pickaxe tools, a pickaxe hotbar, hits with the Tool (2026-11-26)

- **What:** the pickaxe catalog is now the map author's 10 Tools (`ServerStorage.PickaxeTemplates`: wood, copper,
  iron, silver, obsidian, gold, lava, titanium, luck, iridium). Schema v7 moves old pickaxes to the new one with the
  same ore tier and at least the same power. The server hands out only the Tool of the equipped pickaxe and puts it
  in the hand; the copies in `StarterPack` are removed at server start (the place file is unchanged). A swing sends
  `MineHit(node)`; the server checks it exactly like a click. Our hotbar (owned pickaxes, keys 1..0, tap) replaces
  Roblox's backpack bar. Belt items are found by their `Ore` and `Stage` attributes.
- **Why:** Roblox switches ClickDetectors off while a Tool is held, so a pickaxe in hand could not mine; and all 10
  pickaxes in StarterPack would have been free for everyone. Prices and power are first guesses (balance pass due).

## 038. Pets from the map author's models, scattered ore from the map author's ore models (2026-11-26)

- **What:** the pets controller clones `ReplicatedStorage.PetModels/<itemId>` itself (wing flap, facing, sway; neon
  ball only if a model is missing). Ore: only 40% of each layer's spawn points hold a block, picked at random; every
  60 s a quarter of the blocks that no player stands near (24 studs) move to free points. A block is the map author's
  raw-ore model (`ServerStorage.ItemTemplates/<ore>`, `Stage = 0`) scaled to 4 studs. Numbers in `mining/tuning.ts`.
- **Why:** the map author's `PetVisuals` script matched balls by the Ukrainian display name and stopped working when
  pets were named by id; a block on every point looked like a ring of plain cubes. Depletion stays per player, so
  players do not fight over a block; moved blocks are new instances, so nobody keeps damage or a cooldown on them.

## 039. Intake booth at the start of the belt (2026-11-26)

- **What:** ore is handed in at a booth on the first point of the belt, and rides out of it to machine 1 (before,
  the drop prompt stood on machine 1's place, so ore looked like it went straight into the washer). The booth is the
  map author's `ServerStorage.LineTemplates.IntakeBooth` (pivot = belt start, facing the way items ride); while it
  is missing, a plain wooden box stands behind the belt start. Economy unchanged.
- **Why:** the developer's design: resources come out of a booth and travel the belt.

## 040. The lift between the mine and the surface (2026-11-26)

- **What:** the map author's `Lift_Cage` rides the `Lift_Tower` (`Map/Mine/Decor/LiftTower`). "Ride" (inside the
  cage) carries everyone standing in it to the other stop; "Call the lift" at a stop brings the empty cage. The server
  moves the cage and the riders (anchored), pauses the movement check for them (`holdCharacter`) and puts them down
  with `teleportCharacter`. Riding down needs the bottom stop's layer opened for everyone aboard; riding up is always
  allowed. Stops: optional parts `LiftBottom` (attribute `Layer`) and `LiftTop`; without them the cage rides from
  where it stands to the top of the tower. Speed 14 studs/s, 3–12 s per ride (`lift/tuning.ts`).
- **Why:** climbing out must not be a punishment (CLAUDE.md), and a lift skipping the descent would break layers.

## 041. Layers open by walking to their ore; ore blocks 8 studs (2026-11-26)

- **What:** in the map author's open pit there are no camps, so only layers 1–2 were ever open and silver, gold,
  titanium and iridium could not be mined. Now layer N+1 opens when an honest position (one that passed the
  movement check) comes within 30 studs of a `Tier<N+1>` ore spawn point; camps still work where they exist. The
  pause between unlocks is 10 s (was 45). Ore blocks are 8 studs (the map author's size; their `OreNodeScale` script
  can go), mining reach 24 studs, click distance 20.
- **Why:** play-test 2026-11-26; Output showed `mining on a layer that is not opened`.

## 042. Gear shop from the HUD (2026-11-26)

- **What:** a "Shop" button in the right dock opens the gear shop (pickaxes, bags, shoes) anywhere; `BuyGear` no
  longer requires standing near a `Shop`-tagged part (a tagged shop still opens it with E).
- **Why:** the map author's map has no shop building, so there was no way to buy pickaxes or shoes. Buying away from
  a shop gains nothing: price, materials and tier order are still checked on the server.

## 043. Crystals, the second currency (2026-11-26)

- **What:** `crystals` in the profile (new field with default 0, no schema bump; repaired like money). Breaking a block
  by hand gives one crystal with the ore's `crystalChance` (2% copper … 6% iridium, `config/ores.ts`). The three
  chests now cost crystals (pets 15, speed aura 10, pickaxe aura 20) instead of dollars; everything else stays in
  dollars. HUD capsule under the money; Dev panel "+100 crystals".
- **Why:** the developer's design. Crystals are NEVER sold for Robux: otherwise every chest becomes a paid random
  item under Roblox policy. A crystal may come back as at most $50 through chest item resale (`CRYSTAL_RESALE_LIMIT`,
  tested). Quests that reward crystals come later as their own step.

## 044. The SellStation sells the bag and shows live prices (2026-11-26)

- **What:** the built `SellStation` on an owned plot gets the `SellZone` tag on its `ButtonText` part, so E there
  opens the usual sell panel and sells the whole bag of raw ore (cheaper than running it through the line). Its
  boards are rewritten in each viewer's language: "SELL", "PRICES", "Raw ore: ×1", "After your line: ×N" (the
  value multiplier of the owner's last machine), "Your bag now: $X" (refreshed every line tick, sent only on change),
  "E: sell the bag".
- **Why:** the developer's design; the boards were fixed Ukrainian text with no real numbers.

## 045. HUD icons from images, emoji as fallback (2026-11-26)

- **What:** `config/icons.ts` maps each HUD emoji to an image id; the ui-kit `Glyph` draws the image when one is set,
  else the emoji. Stat tiles, dock buttons and capsule badges all go through it, so switching to an icon pack is a
  config change only. Chosen pack (to confirm its terms first): "Simulator Icon Pack" by DevJoob (Creator Store
  99176447965360, free, 125 icons). Claude cannot insert assets (Studio MCP is read-only), so the developer inserts
  the pack into ServerStorage once and the ids are read from it.
- **Why:** the developer wants nicer icons than emoji; uploading our own images to the account is not allowed for Claude.

## 046. Rich veins (2026-11-26)

- **What:** each placed ore block (at start and after every shuffle) is a rich vein with 8% chance: it sparkles in the
  ore's colour and gives 3× ore (still capped by bag room). The server marks it with the `Rich` attribute and reads it
  when the block breaks. Numbers in `mining/tuning.ts`.
- **Why:** the developer asked for ore generation "like the best tycoons": a visible jackpot worth walking to, which
  moves with the shuffle, keeps the pit interesting without changing per-player depletion.

## 047. The map author's silo is the line's intake (2026-11-26)

- **What:** when a plot's Factory has `Silo` (template `ServerStorage.MachineTemplates.Silo`), ore is handed in under
  its `SiloIntake` (E, chest height) instead of at the plain booth (decision 039, still the fallback). The ore waits
  in the silo (the line's existing intake queue, up to 500) and comes onto the belt at `SiloOutlet` (new `i` index in
  the stored belt path, tested). `Silo_Glow` grows brighter with the fill, `FX_Dust` puffs while ore leaves, a
  counter "N / 500" floats over the silo. Economy unchanged.
- **Why:** the map author built the silo for exactly this; before, ore passed through it without stopping.

## 048. Critical hits and ore rush (2026-11-26)

- **What:** 12% of counted swings are critical hits (3× pickaxe power), rolled on the server and shown on the client
  as "CRIT!". Every 8 minutes an ore rush: for 60 s, 35% of the plain blocks nobody stands at become rich veins
  (decision 046), announced to everyone; afterwards exactly those turn plain again. Numbers in `mining/tuning.ts`.
- **Why:** the developer found mining a bit dull. Crits make each swing a small gamble; the rush gives the pit a
  rhythm and a reason to go down now.

## 049. Line machines make a sound (2026-11-26)

- **What:** when a machine on a plot lets an item go, a quiet positional sound plays at it (`machineWork`, the
  licensed fire whoosh already in config, at most every 2 s per machine, heard within ~90 studs). Client only, from
  the belt-visual messages; nothing changes on the server.
- **Why:** the line felt silent (feedback 2026-11-26). A machine-specific licensed sound can replace the id later.

## 050. Treasure crates in the pit (2026-11-26)

- **What:** every 2 minutes, when none is waiting, a treasure crate (the map author's `PropTemplates/Crate`, scaled to
  6 studs, gold sparkles, light and a "💰 TREASURE" label seen from 250 studs) appears on a free ore point of a random
  layer, announced to everyone. It mines like that layer's ore (same layer and pickaxe rules). The first player to
  break it gets the ore price ×30 in dollars and 2–6 crystals; it is destroyed for everyone in the same frame, others
  are told who found it. Reward rule is pure and tested (`treasureReward`).
- **Why:** mining felt like "run and break" (feedback 2026-11-26). A visible prize somewhere in the pit gives a goal
  to run to and a small race between players.

## 051. Each machine has its own sound, also when idle (2026-11-26)

- **What:** `MACHINE_SOUNDS` in `config/sounds.ts`: every line machine has a quiet loop (always on once bought, heard
  within ~130 studs, added only to machines within 160 studs of the camera) and its own "work" sound when it lets an
  item go (replaces the shared one of decision 049). Built from three licensed ProSoundEffects factory loops ("Oil
  Refinery Ambience") at different pitches and licensed one-shots (clang, metal hits, whoosh, electric arc, robot
  buzz); a test checks that no two machines sound the same.
- **Why:** the developer wants machines to sound alive and different. Better per-machine recordings can replace an id
  in the config without code changes; the Creator Store search found few licensed industrial loops.

## 052. Every hit chips ore off a block, slower swings (2026-11-26)

- **Decision:** a block holds `pieces` pieces; `hardness` is damage per piece. Every hit chips `floor(damage / hardness)` pieces (carry-over kept), a crit chips more, the last chip empties the block (respawn per player). The first pickaxe of each tier has power = hardness of its ore, so it gives ore on every hit. Swings are about 45% slower. Drills keep their old seconds per piece.
- **Why:** the developer wanted ore on every hit, and mining felt far too fast.

## 053. Home button and sound switch (2026-11-26)

- **Decision:** travel gets a HOME destination (the player's own plot, always allowed, same 30 s pause) and a dock button. A sound switch in the More menu puts every sound into one local SoundGroup; the choice is saved (`profile.soundOn`).
- **Why:** the developer's list; both are cheap comfort features.

## 054. Conveyor level and sale coins (2026-11-26)

- **Decision:** `line.beltLevel` (6 levels, x1 to x2) speeds up the whole line, bought from a card in every machine panel. A bag sale throws coins into the money counter (client only, `SaleMade` remote).
- **Why:** the developer asked for conveyor speed and a visible "money" moment.

## 055. Quests: daily, story chain, login streak (2026-11-26)

- **Decision:** 3 daily quests from a pool (new every UTC day; targets x1.6 and money x4 per layer), a bonus for all three, a 29-step story chain (tutorial first, then long goals across all layers), a 7-day login streak. The server counts events (`trackQuest`); the client only names the reward to claim.
- **Why:** reasons to come back every day and a clear "what next" for weeks.

## 056. Long progression economy (2026-11-26)

- **Decision:** ore 2 / 8 / 30 / 100 / 300 / 1000. The first pickaxe of each tier gates the next layer: 20k, 400k, 4M, 15M. Line `STAGE_VALUE` tops at x10 (was x1500), quality bonuses add up instead of multiplying, double output max 10% per machine. Gear, machines, drills and conveyor follow steep curves checked by the balance-analyst model: about 8-9 h of play on layer 1, 17 h on layer 2, 28 h on layer 3, 45 h on layer 4.
- **Why:** the game was beaten in about an hour. The developer wants roughly a week for the first area at 1-1.5 h a day and 2-3 weeks for later ones. Numbers are model estimates; the play-test decides.

## 057. Boosters and the Robux store (2026-11-26)

- **Decision:** boosters x2 money (sales + line), x2 ore per hit, line x1.5, bought with crystals (15 min portions) or Robux, capped at 24 h. The store sells boosters, crystal packs and money packs (money scales with depth). One ProcessReceipt in the store feature serves every product; chests register theirs. **The developer chose to sell crystals and money for Robux.** So chests opened with crystals count as paid random items: odds are always shown, and crystal packs are hidden and refused for players with `ArePaidRandomItemsRestricted`. Money never buys anything random. Robux items stay hidden until product ids are set.
- **Why:** monetisation like other long Roblox tycoons, kept within Roblox rules; the game stays playable without Robux.

## 058. Physical gear shops (2026-11-26)

- **Decision:** pickaxes, bags and shoes are bought at their own stands (tag `Shop`, attribute `ShopSlot`); the server checks the buyer stands near a stand that sells that slot. Until the map author places real ones, three stands are built near the surface point (or the middle of the plots) and removed when a real Shop appears. The dock shop button became the Robux store.
- **Why:** the developer's request: three physical shops, the old HUD shop becomes the donation store.

## 059. Drill levels (2026-11-26)

- **Decision:** 6 drill levels: speed x1 to x3.5, buffer x1 to x4, for 1.5x to 60x the drill price, bought at the drill site. Schema v8 (old drills get level 1; the bump covers the raised buffer and receipt caps).
- **Why:** drills are the passive income for players who play less; levels make them a long goal.

## 060. Geodes (2026-11-26)

- **Decision:** 3% of placed ore blocks are geodes (purple glow, server attribute `Geode`). Emptying one pays 1-3 crystals and with 25% chance a random booster for 5 minutes.
- **Why:** something to hunt for on a layer besides plain blocks; links mining with boosters.

## 061. Three shop buildings in a market district (2026-11-26)

- **Decision:** the server builds three separate shop buildings (pickaxes, bags, shoes: walls, roof, striped awning, lamps, sign, goods on display) 40 studs in front of the SpawnLocation, 46 studs apart. Only a shop with a `ShopSlot` covers its slot. A dock button and a travel destination (`SHOP_DISTRICT`) lead there. The dev "Gear Shop" and (on maps with plots) sell-zone placeholders are gone.
- **Why:** the old placeholder had no `ShopSlot`, counted as a shop that sells everything and stopped the three stands from being built, so all gear was bought in one place.

## 062. Visual sell panel (2026-11-26)

- **Decision:** a card per ore with its 3D model, a gold total banner with bonus chips, bag fill, and "through your line ≈ $X". The preview includes the money booster and the market bonus, as the server does.
- **Why:** the developer found the text-only panel dull; the line comparison teaches the factory.

## 063. Base building with timers (2026-11-26)

- **Decision:** Office (gates other levels), Market (+5% money per level), Warehouse (+8% bag per level), Workshop (+5% line speed), Booster Lab (+3 min per crystal portion), Miner Hut (+3% ore). 6 levels, 1 min to 24 h (office build time x1.5), builds continue offline by unix time, 1 builder plus 2 for crystals (60, 200), finish-now at 1 crystal per 5 min. Drawn on free spots of the owner's plot that keep clear of every machine slot; `ServerStorage.BuildingTemplates/<id>` models replace the part houses. The dock became two columns for phones.
- **Why:** the developer's request, Clash of Clans style: a goal measured in days.

## 064. Aura roll machine (2026-11-26)

- **Decision:** spin for speed and pickaxe auras: free spin every 20 min (6 stored, also offline; 2 at the start), or 15 crystals; epic or better guaranteed within 25 spins; odds shown (crystals are sold for Robux); reel animation; rarer equipped auras glow and throw more particles; "sell all duplicates" keeps one copy and everything equipped.
- **Why:** the developer's request to knock out and keep auras; free spins give a reason to come back.

## 065. Layer events (2026-11-26)

- **Decision:** cave-ins (red circle, rocks after 3 s, 40% slower for 5 s, nothing lost), shared crystal clusters (40 swings by anyone, crystals to all with 3+ hits), a 2-minute raid scored by ore value with a weekly top (one OrderedDataStore per week, memory in Studio), at most 15 crystals, 10 min cooldown.
- **Why:** something happening in the mine besides hitting blocks, and a weekly competition.

## 066. Fixes after the security and balance reviews (2026-11-26)

- **Decision:** one swing cooldown for ore and clusters; one sell cap (x7) for the sell zone and the line; the raid counts pieces before boosters and auras; the line's offline run uses the base as the player left it; capped boost time is refunded in money (not crystals) for players with paid random items restricted; the aura panel also shows the guaranteed spin's odds. Balance: the warehouse now gives bag capacity (offline line time was capped by the silo, so its old bonus did nothing); item resale 10/25/60/150/400 (free spins no longer print money); treasure every 5 min paying 40x ore price, cluster every 10 min, both only on layers someone has opened and gone after 4 min; office and market cheaper; builders 60/200 crystals.
- **Why:** security-reviewer and balance-analyst findings.
