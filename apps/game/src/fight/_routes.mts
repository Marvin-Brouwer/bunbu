import { route } from '@rooted/router/routes'

/**
 * 2 to 8: choosing the stage and difficulty for the quiz chosen on the title, then the run itself, from the first step to the results or
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

