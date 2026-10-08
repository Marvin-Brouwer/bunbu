import { route } from '@rooted/router/routes'

/**
 * 3 to 8: the run, from the first step to the results or the fall. Pause, results and fallen are
 * phases of the run shown over its world, not routes of their own.
 */
export const RunRoute = route`/run/`({
	async resolve({ create }) {
		const { RunScreen } = await import('./run.mts')
		return create(RunScreen)
	},
	seo: { title: 'Run' },
})
