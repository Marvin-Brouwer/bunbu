import { href, type Path } from '@rooted/router'
import { route } from '@rooted/router/routes'

/**
 * 2 to 8: choosing a quiz and stage, then the run itself, from the first step to the results or
 * the fall. One route, so a run can only start from the quiz and stage the player chose, never from
 * a URL typed halfway in. Pause, results and fallen are phases of the run shown over its world.
 */
export const FightRoute = route`/fight/`({
	async resolve({ create }) {
		const { Fight } = await import('./fight.mts')
		return create(Fight)
	},
	seo: { title: 'Fight' },
})

/** The query that skips the select screen and starts a run on what is chosen already. */
export const runQuery = 'run'

/** `/fight/?run`: the title's Run, straight into a run on the chosen quiz and stage. */
export function runNow(): Path {
	const path = href.for(FightRoute)
	path.query.set(runQuery, '')
	return path
}
