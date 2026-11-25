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

## 018. Bigger UI and a font comparison

- **Date:** 2026-11-25
- **Decision:** the first play-test found the UI too small. The screen scale is now computed from a design height of 620
  (was 760) with limits 0.7..1.5 (was 0.6..1.2), text sizes are about 18% larger (body 20, title 30), chips, menu buttons,
  the title sign and the goal banner are bigger, and the menu column moved to the right edge so it never overlaps the stat chips.
  The UI showcase (Dev panel) shows 12 fonts with Ukrainian letters for choosing the final font.
- **Why:** on a 720 px high window the old scale gave about 12 px chip text; on a phone it shrank to 0.6 and gave about 10 px.
  `FredokaOne` has no Cyrillic, so titles used a fallback font. The font is chosen by the player in the showcase, not guessed.
- **Open:** the final font (`FONTS` in `client/lib/ui-kit/theme.ts`).
