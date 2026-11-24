---
name: pre-pr
description: Run the full pre-PR check (build, lint, tests, audit) and report a short summary. Use before opening a pull request or when asked to verify that everything passes.
disable-model-invocation: true
---

Run the project's four gates in this order and stop at the first failure:

1. `npm run build`
2. `npm run lint`
3. `npm test`
4. `npm run audit`

Token-saving rules (this is the point of the skill):
- Do NOT paste full logs. On success, report one line per gate.
- On failure, show only the failing lines (the error messages with `file:line`), at most ~30 lines, then fix or ask.
- Do not re-read generated files in `out/`, `include/` or `node_modules/`.

Final answer format:

```
build  ✓
lint   ✓
test   ✓ (N passed)
audit  ✓ (0 vulnerabilities)
```

If everything passes, also state the current branch and whether `git status` is clean.
Do not commit or push: the developer decides that.
