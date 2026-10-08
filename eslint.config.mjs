// @ts-check
import eslint from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// Globals that mean "this code touches the browser". Stores and flows are plain TypeScript
// (docs/architecture/state.md), so they must not use any of these. The ones below are part of the
// language everywhere, in a browser and in a test run alike, so they stay allowed.
const platformGlobals = ['console', 'queueMicrotask', 'structuredClone', 'AbortController', 'AbortSignal']

const browserGlobals = Object.keys(globals.browser)
	.filter((name) => !platformGlobals.includes(name))
	.map((name) => ({
		name,
		message: 'state/ and flows/ must not touch the DOM or browser APIs (docs/architecture/state.md).',
	}))

export default defineConfig(
	globalIgnores(['**/dist/', '**/node_modules/', '**/*.g.json', '**/*.g.mts', 'packages/data/bench/']),
	eslint.configs.recommended,
	tseslint.configs.strictTypeChecked,
	tseslint.configs.stylisticTypeChecked,
	{
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			// Numbers in template literals are fine and very common in this code base.
			'@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
			// `type` and `interface` are both fine; the code base uses `type` for data shapes.
			'@typescript-eslint/consistent-type-definitions': 'off',
			// With `noUncheckedIndexedAccess` on, `items[index]!` is how you say "this index exists",
			// which reads better than a guard that can never fail.
			'@typescript-eslint/no-non-null-assertion': 'off',
		},
	},
	{
		// Config files are not part of a tsconfig project.
		files: ['**/*.config.{mjs,mts,ts}', 'eslint.config.mjs'],
		extends: [tseslint.configs.disableTypeChecked],
	},
	{
		files: ['apps/game/src/**'],
		languageOptions: { globals: globals.browser },
	},
	{
		files: ['**/*.test.{ts,mts}', '**/test/**'],
		rules: {
			// Matchers such as `expect.stringContaining` are typed `any`.
			'@typescript-eslint/no-unsafe-assignment': 'off',
		},
	},
	{
		// The import boundary from docs/architecture/state.md#folder-layout.
		files: ['apps/game/src/state/**', 'apps/game/src/flows/**'],
		ignores: ['**/*.test.mts'],
		languageOptions: { globals: {} },
		rules: {
			'no-restricted-globals': ['error', ...browserGlobals],
			'no-restricted-imports': ['error', {
				patterns: [
					{ group: ['three', 'three/*'], message: 'state/ and flows/ must not use three.js. Rendering reads the stores instead.' },
					{ group: ['@rooted/*'], message: 'state/ and flows/ must not use Rooted. UI components read the stores instead.' },
					{ group: ['**/render', '**/render/**', '**/ui', '**/ui/**'], message: 'state/ and flows/ may not import from render/ or ui/.' },
				],
			}],
		},
	},
)
