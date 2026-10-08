/**
 * D3 to D5 Practice ([dojo.md](../../../../docs/design/dojo.md)). The practice session's state
 * lives as long as this screen: created on mount, dropped on unmount.
 */

import { component } from '@rooted/components'
import { href } from '@rooted/router'
import { createPracticeGame } from './state/practice.mts'
import { selection } from '../_shared/state/selection.mts'
import { snapshot } from '../_shared/state/store.mts'
import { Placeholder } from '../_shared/placeholder.mts'
import { DojoRoute } from './_routes.mts'

export const Practice = component({
	name: 'practice',
	onMount({ append, create }) {
		const game = createPracticeGame()
		const { quiz } = snapshot(selection)
		if (quiz !== undefined) game.quiz.value.load(quiz)

		append(
			create(Placeholder, {
				title: 'Practice',
				note: 'The training dummy, the scroll, the swipe zone and the right vs wrong count go here.',
				links: [{ label: 'Back to the dojo', href: href.for(DojoRoute) }],
			})
		)
	},
})
