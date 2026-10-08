/**
 * D2 Study ([dojo.md](../../../../docs/design/dojo.md)). The study session's state lives as
 * long as this screen: created on mount, dropped on unmount.
 */

import { component } from '@rooted/components'
import { href } from '@rooted/router'
import { selection } from '../_shared/state/selection.mts'
import { snapshot } from '../_shared/state/store.mts'
import { createStudyGame } from './state/study.mts'
import { Placeholder } from '../_shared/placeholder.mts'
import { DojoRoute } from './_routes.mts'

export const Study = component({
	name: 'study',
	onMount({ append, create }) {
		const game = createStudyGame()
		const { quiz } = snapshot(selection)
		if (quiz !== undefined) game.quiz.value.load(quiz)

		append(
			create(Placeholder, {
				title: 'Study',
				note: 'The card, the spoken word highlighted, Pause, Restart, Voice and Speed go here.',
				links: [{ label: 'Back to the dojo', href: href.for(DojoRoute) }],
			})
		)
	},
})
