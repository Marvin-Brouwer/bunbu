/**
 * Quizzes ([screens.md](../../../../docs/design/screens.md#1b-quizzes)): the loaded quizzes to
 * choose from, the button and area to load a quiz file, and what is wrong with a file or won't fit
 * in a fight. Kept off the title, so the title stays calm. Back leads to the title, or to the dojo
 * when that is where the quizzes were opened.
 */

import { component } from '@rooted/components'
import { href } from '@rooted/router'
import { MenuScreen } from '../_shared/menu/menu-screen.mts'
import { DojoRoute } from '../dojo/_routes.mts'
import { openedFromDojo } from './_routes.mts'
import { QuizShelf } from './quiz-shelf.mts'

export const Quizzes = component({
	name: 'quizzes',
	onMount({ append, create }) {
		append(
			create(MenuScreen, {
				title: 'Quizzes',
				back: openedFromDojo(href.url(location.href).path) ? href.for(DojoRoute) : href.path('/'),
				children: create(QuizShelf),
			})
		)
	},
})
