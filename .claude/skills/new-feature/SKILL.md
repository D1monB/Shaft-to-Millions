---
name: new-feature
description: Scaffold a new game feature slice (shared/server/client) following the architecture in CLAUDE.md. Use when adding a feature such as `mining` or `factory`. Argument is the feature name in lowercase.
disable-model-invocation: true
argument-hint: <feature-name>
---

Create the feature `$ARGUMENTS` following the architecture rules in CLAUDE.md.

1. Validate the name: lowercase letters only (`^[a-z][a-z0-9]*$`), and `src/*/features/$ARGUMENTS` must not exist yet. If invalid or taken, stop and say why.
2. Ask (briefly) which runtimes the feature needs. Default: all three. Pure logic and data always go to `shared`.
3. For each chosen runtime create `src/<runtime>/features/$ARGUMENTS/index.ts`:
   - one comment line saying what the feature does in that runtime and why it exists there,
   - `export {};` until real exports exist.
   Import conventions: other code imports this feature only through `index.ts` (ESLint enforces this).
4. In `shared`, if the feature has pure logic, add one small file with a pure function (no Roblox API calls) and a `*.test.ts` next to it, following `src/shared/lib/rate-limiter.test.ts` (lunit, one class, `export = ClassName`). Include tests for BAD input (wrong range, NaN, non-integers).
5. Content such as items/abilities/enemies is DATA in a separate definitions file, not hard-coded in logic.
6. Run `npm run build`, `npm run lint`, `npm test`. Report one line per gate; show only failures.
7. Add the feature to the "Features" line in CLAUDE.md.

Security reminder: if the feature adds a RemoteEvent/RemoteFunction, stop and apply the "Every RemoteEvent / RemoteFunction handler MUST" checklist from CLAUDE.md before writing the handler. Do not commit or push.
