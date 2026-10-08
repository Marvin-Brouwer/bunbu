import { route } from '@rooted/router/routes'

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
