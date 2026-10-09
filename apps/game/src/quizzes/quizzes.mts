/**
 * Quizzes ([screens.md](../../../../docs/design/screens.md#1b-quizzes)): the loaded quizzes to
 * choose from, the area to drop or choose a quiz file, and what is wrong with a file or won't fit
 * in a fight. Kept off the title, so the title stays calm.
 */

import { component } from '@rooted/components'
import { href } from '@rooted/router'
import { MenuScreen } from '../_shared/menu/menu-screen.mts'
import { QuizShelf } from './quiz-shelf.mts'

export const Quizzes = component({
	name: 'quizzes',
	onMount({ append, create }) {
		append(
			create(MenuScreen, {
				title: 'Quizzes',
				back: href.path('/'),
				children: create(QuizShelf),
			})
		)
	},
})
