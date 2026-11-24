// PostToolUse hook: formats a file with the project's Prettier right after Claude edits it.
// Why: style fixes never cost a conversation turn, and `npm run lint` stays green.
// Reads the hook payload (JSON) from stdin. Never fails the tool call: any problem is ignored.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { extname, resolve } from "node:path";

const FORMATTABLE = new Set([".ts", ".tsx", ".mjs", ".json", ".yml", ".yaml"]);

let input = "";
for await (const chunk of process.stdin) {
	input += chunk;
}

try {
	const filePath = JSON.parse(input)?.tool_input?.file_path;
	if (typeof filePath !== "string" || !FORMATTABLE.has(extname(filePath))) {
		process.exit(0);
	}

	const prettier = resolve(import.meta.dirname, "../../node_modules/prettier/bin/prettier.cjs");
	if (!existsSync(prettier) || !existsSync(filePath)) {
		process.exit(0);
	}

	// execFile without a shell: the path is passed as an argument, never interpolated into a command line.
	// Files listed in .prettierignore are skipped by Prettier itself.
	execFileSync(process.execPath, [prettier, "--write", "--log-level", "silent", filePath], { stdio: "ignore" });
} catch {
	// Formatting is a convenience, not a gate (CI runs the real check).
}
process.exit(0);
