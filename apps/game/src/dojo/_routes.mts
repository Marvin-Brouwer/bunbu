import { route } from '@rooted/router/routes'
import type { Path } from '@rooted/router'

/** D1 Dojo menu ([screens.md](../../../../docs/design/screens.md#d1-dojo-menu)). */
export const DojoRoute = route`/dojo/`({
	async resolve({ create }) {
		const { DojoMenu } = await import('./dojo.mts')
		return create(DojoMenu)
	},
	seo: { title: 'Dojo' },
})

/** D2 Study: its own game state, created when the route mounts. */
export const StudyRoute = route`/${DojoRoute}/study/`({
	async resolve({ create }) {
		const { Study } = await import('./study.mts')
		return create(Study)
	},
	seo: { title: 'Study' },
})

/** D3 to D5 Practice: its own game state, created when the route mounts. */
export const PracticeRoute = route`/${DojoRoute}/practice/`({
	async resolve({ create }) {
		const { Practice } = await import('./practice.mts')
		return create(Practice)
	},
	seo: { title: 'Practice' },
})

/** The query that ticks "Only my mistakes from the last run": `/dojo/?mistakes`, `/dojo/practice/?mistakes`. */
const mistakesQuery = 'mistakes'

/** `path` with "only my mistakes" ticked, or unticked when `ticked` is false. */
export function withMistakes(path: Path, ticked = true): Path {
	if (ticked) path.query.set(mistakesQuery, '')
	else path.query.delete(mistakesQuery)
	return path
}

/** Whether "only my mistakes" is ticked on `path`. */
export function mistakesOnly(path: Path): boolean {
	return path.query.has(mistakesQuery)
}
