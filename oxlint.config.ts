import globals from 'globals'
import { defineConfig } from 'oxlint'

// Globals that mean "this code touches the browser". Stores and flows are plain TypeScript
// (docs/architecture/state.md), so they must not use any of these. The ones below are part of the
// language everywhere, in a browser and in a test run alike, so they stay allowed.
const platformGlobals = new Set(['console', 'queueMicrotask', 'structuredClone', 'AbortController', 'AbortSignal'])

const browserGlobals = Object.keys(globals.browser)
	.filter((name) => !platformGlobals.has(name))
	.map((name) => ({
		name,
		message: 'state/ and flows/ must not touch the DOM or browser APIs (docs/architecture/state.md).',
	}))

export default defineConfig({
	plugins: ['typescript', 'unicorn', 'oxc', 'import', 'vitest'],
	categories: {
		correctness: 'error',
		suspicious: 'error',
		perf: 'error',
	},
	options: {
		typeAware: true,
		denyWarnings: true,
		reportUnusedDisableDirectives: 'error',
	},
	ignorePatterns: ['**/dist/', '**/*.g.json', '**/*.g.mts', 'packages/data/bench/'],
	rules: {
		// The rest of typescript-eslint's strict and stylistic type-checked sets, which the categories
		// above don't switch on. `no-unsafe-enum-assignment` is the one oxlint doesn't have.
		'no-array-constructor': 'error',
		'no-empty-function': 'error',
		'typescript/adjacent-overload-signatures': 'error',
		'typescript/array-type': 'error',
		'typescript/ban-ts-comment': 'error',
		'typescript/ban-tslint-comment': 'error',
		'typescript/class-literal-property-style': 'error',
		'typescript/consistent-generic-constructors': 'error',
		'typescript/consistent-indexed-object-style': 'error',
		'typescript/consistent-type-assertions': 'error',
		'typescript/dot-notation': 'error',
		'typescript/no-confusing-void-expression': 'error',
		'typescript/no-deprecated': 'error',
		'typescript/no-dynamic-delete': 'error',
		'typescript/no-empty-object-type': 'error',
		'typescript/no-explicit-any': 'error',
		'typescript/no-inferrable-types': 'error',
		'typescript/no-invalid-void-type': 'error',
		'typescript/no-misused-promises': 'error',
		'typescript/no-mixed-enums': 'error',
		'typescript/no-namespace': 'error',
		'typescript/no-non-null-asserted-nullish-coalescing': 'error',
		'typescript/no-require-imports': 'error',
		'typescript/no-unnecessary-condition': 'error',
		'typescript/no-unsafe-argument': 'error',
		'typescript/no-unsafe-assignment': 'error',
		'typescript/no-unsafe-call': 'error',
		'typescript/no-unsafe-function-type': 'error',
		'typescript/no-unsafe-member-access': 'error',
		'typescript/no-unsafe-return': 'error',
		'typescript/non-nullable-type-assertion-style': 'error',
		'typescript/only-throw-error': 'error',
		'typescript/prefer-find': 'error',
		'typescript/prefer-for-of': 'error',
		'typescript/prefer-function-type': 'error',
		'typescript/prefer-includes': 'error',
		'typescript/prefer-literal-enum-member': 'error',
		'typescript/prefer-nullish-coalescing': 'error',
		'typescript/prefer-optional-chain': 'error',
		'typescript/prefer-promise-reject-errors': 'error',
		'typescript/prefer-reduce-type-parameter': 'error',
		'typescript/prefer-regexp-exec': 'error',
		'typescript/prefer-return-this-type': 'error',
		'typescript/prefer-string-starts-ends-with': 'error',
		'typescript/related-getter-setter-pairs': 'error',
		'typescript/require-await': 'error',
		'typescript/restrict-plus-operands': 'error',
		'typescript/return-await': 'error',
		'typescript/unified-signatures': 'error',
		'typescript/use-unknown-in-catch-callback-variable': 'error',

		// Numbers in template literals are fine and very common in this code base.
		'typescript/restrict-template-expressions': ['error', { allowNumber: true }],
		// Branded types such as `Markdown` are made by a cast, on purpose. typescript-eslint's strict
		// set doesn't include this one either.
		'typescript/no-unsafe-type-assertion': 'off',
		// State is immutable, so `{ ...item, field }` inside a `map` is how a store changes one entry.
		// The arrays are a handful of options or ninjas.
		'oxc/no-map-spread': 'off',
	},
	overrides: [
		{
			// Tests check many cases in one go and keep their helpers next to the cases that use them.
			files: ['**/*.test.{ts,mts}', '**/test/**'],
			rules: {
				'no-await-in-loop': 'off',
				'vitest/no-conditional-expect': 'off',
				'unicorn/consistent-function-scoping': 'off',
				'vitest/expect-expect': ['error', { assertFunctionNames: ['expect', 'expect*'] }],
				// Matchers such as `expect.stringContaining` are typed `any`.
				'typescript/no-unsafe-assignment': 'off',
			},
		},
		{
			// The import boundary from docs/architecture/state.md#folder-layout: a slice's `state/` and
			// `flows/` are plain TypeScript, so the rules can be tested without a browser.
			files: ['apps/game/src/**/state/**', 'apps/game/src/**/flows/**'],
			excludeFiles: ['**/*.test.mts'],
			rules: {
				'no-restricted-globals': ['error', ...browserGlobals],
				'no-restricted-imports': ['error', {
					patterns: [
						{ group: ['three', 'three/*'], message: 'state/ and flows/ must not use three.js. Rendering reads the stores instead.' },
						{ group: ['@rooted/*', '!@rooted/store'], message: 'state/ and flows/ must not use Rooted, except @rooted/store. UI components read the stores instead.' },
						{
							// Anything relative, except a sibling module or a module in a state/ or flows/ folder.
							group: ['./**', '../**', '!./*.mts', '!../**/state/*.mts', '!../**/flows/*.mts'],
							message: 'state/ and flows/ may only import from other state/ and flows/ folders, not from components, the canvas or styles.',
						},
					],
				}],
			},
		},
	],
})
