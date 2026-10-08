/**
 * D2 Study ([dojo.md](../../../../../docs/design/dojo.md)). The study session's state lives as
 * long as this screen: created on mount, dropped on unmount.
 */

import { component } from '@rooted/components'
import { href } from '@rooted/router'
import { selection } from '../../state/selection.mts'
import { createStudyGame } from '../../state/study/game.mts'
import { placeholder } from '../placeholder.mts'
import { DojoRoute } from './_routes.mts'

const Screen = placeholder('bunbu-study-placeholder', {
	title: 'Study',
	note: 'The card, the spoken word highlighted, Pause, Restart, Voice and Speed go here.',
	links: [{ label: 'Back to the dojo', href: href.for(DojoRoute) }],
})

export const Study = component({
	name: 'bunbu-study',
	onMount({ append, create }) {
		const game = createStudyGame()
		const { quiz } = selection.get()
		if (quiz !== undefined) game.quiz.load(quiz)

		append(create(Screen))
	},
})
