/**
 * D3 to D5 Practice ([dojo.md](../../../../docs/design/dojo.md)). The practice session's state
 * lives as long as this screen: created on mount, dropped on unmount.
 */

import { component } from '@rooted/components'
import { createPracticeGame } from './state/practice.mts'
import { selection } from '../_shared/state/selection.mts'
import { snapshot } from '../_shared/state/store.mts'
import { goBack } from '../_shared/menu/back-link.mts'
import { Placeholder } from '../_shared/placeholder.mts'
import { show } from '../canvas/stage.mts'
import { createDojoWorld } from './world.mts'

export const Practice = component({
	name: 'practice',
	onMount({ append, create, signal }) {
		const game = createPracticeGame()
		const { quiz } = snapshot(selection)
		if (quiz !== undefined) game.quiz.value.load(quiz)

		append(
			create(Placeholder, {
				title: 'Practice',
				note: 'The training dummy, the scroll, the swipe zone and the right vs wrong count go here.',
				links: [
					{
						label: 'Back',
						action: () => {
							goBack()
						},
					},
				],
			})
		)

		show((viewport) => createDojoWorld(viewport, game.tally), signal)
	},
})
