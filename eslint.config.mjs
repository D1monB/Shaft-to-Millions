// ESLint flat config. Lints only TypeScript game code; Prettier owns formatting.
import roblox from "eslint-plugin-roblox-ts";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";

// CLAUDE.md rule 1: a feature exposes only its index.ts.
// Matches e.g. "shared/features/mining/formulas" but allows "shared/features/mining".
const featureInternals = {
	regex: "features/[^/]+/(?!index$).+",
	message: "Import a feature only through its index.ts (public API), not its internal files.",
};

export default tseslint.config(
	{ ignores: ["out/**", "include/**", "node_modules/**", "*.mjs"] },
	{
		files: ["src/**/*.ts", "src/**/*.tsx"],
		extends: [tseslint.configs.recommended, roblox.configs.recommended],
		languageOptions: {
			parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
		},
		rules: {
			// CLAUDE.md rule 6
			"@typescript-eslint/no-explicit-any": "error",
			"@typescript-eslint/no-non-null-assertion": "error",
			"no-restricted-imports": ["error", { patterns: [featureInternals] }],
		},
	},
	{
		// React UI: hooks must be called unconditionally and effects must list their dependencies.
		files: ["src/client/**/*.tsx", "src/client/**/*.ts"],
		plugins: { "react-hooks": reactHooks },
		rules: {
			"react-hooks/rules-of-hooks": "error",
			"react-hooks/exhaustive-deps": "warn",
		},
	},
	{
		// Top-level files of a feature: "../other/x" would reach into a sibling feature's internals.
		files: ["src/*/features/*/*.ts", "src/*/features/*/*.tsx"],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					patterns: [
						featureInternals,
						{
							regex: "^\.\./[^./][^/]*/.+",
							message: "Do not import another feature's internals. Use its index.ts.",
						},
					],
				},
			],
		},
	},
	prettier,
);
