/**
 * Every style sheet ends up on the same page, and animation names aren't scoped to the sheet that
 * declares them. Two sheets declaring the same `@keyframes` name means the one that loads last
 * runs for both, so the scroll's cut once played the swipe zone's slash, and a timed-out scroll
 * only turned red instead of being sliced.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Read from disk: through Vite, a style sheet imported in a test comes back empty.
const source = new URL('../src/', import.meta.url)
const sheets = Object.fromEntries(readdirSync(source, { recursive: true, encoding: 'utf8' })
	.filter((file) => file.endsWith('.css'))
	.map((file) => [file, readFileSync(new URL(file, source), 'utf8')]))

describe('styles', () => {
	it('finds the style sheets', () => {
		expect(Object.keys(sheets).length).toBeGreaterThan(0)
	})

	it('names every animation once', () => {
		const filesByName = new Map<string, string[]>()
		for (const [file, css] of Object.entries(sheets)) {
			for (const [, name] of css.matchAll(/@keyframes\s+([\w-]+)/g)) {
				filesByName.set(name!, [...filesByName.get(name!) ?? [], file])
			}
		}
		const repeated = [...filesByName].filter(([, files]) => files.length > 1)
		expect(repeated).toEqual([])
	})
})
