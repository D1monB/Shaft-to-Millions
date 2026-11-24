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
