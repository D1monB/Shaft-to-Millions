# Decisions log

Numbered log of game and technical decisions: what we decided and why. Newest at the bottom.

## 001. Infrastructure from the starter kit

- **Date:** 2026-11-24
- **Decision:** roblox-ts + Rojo, tests with @rbxts/lunit under Lune, feature slices by runtime, CI on every PR.
- **Why:** strict typing, fast headless tests of pure logic, server authority enforced by structure.
