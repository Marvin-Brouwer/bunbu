/**
 * D3 to D5 Practice ([dojo.md](../../../../docs/design/dojo.md#practice)): the start screen, then
 * the ambushes, which pause and end over themselves. The practice session's state lives as long
 * as this screen: created on mount, dropped on unmount.
 *
 * `/dojo/practice/?mistakes` asks only the questions the last run on the quiz missed.
 */

import type { BunbuData } from '@bunbu/data'
import { component } from '@rooted/components'
import { href } from '@rooted/router'
import { lastRun } from '../fight/state/lastrun.mts'
import { MenuButton } from '../_shared/menu/menu-button.mts'
import { MenuScreen } from '../_shared/menu/menu-screen.mts'
import { selection } from '../_shared/state/selection.mts'
import { snapshot } from '../_shared/state/store.mts'
import { show } from '../canvas/stage.mts'
import { QuizzesRoute } from '../quizzes/_routes.mts'
import { mistakesOnly } from './_routes.mts'
import { beginPractice, preparePractice } from './flows/practice.mts'
import { PracticeAmbush } from './practice-ambush.mts'
import { PracticeStart } from './practice-start.mts'
import { missedQuestions } from './state/mistakes.mts'
import { createPracticeGame } from './state/practice.mts'
import { createDojoWorld } from './world.mts'
import styles from './practice.css'

/** Asks for a quiz when none is chosen. */
const NoQuiz = component({
	name: 'practice-no-quiz',
	styles,
	onMount({ append, create, element }) {
		append(
			create(MenuScreen, {
				title: 'Practice',
				children: [
					element('p', {
						classes: styles.startNote,
						textContent: 'Choose a quiz to practise first.',
					}),
					create(MenuButton, {
						kind: 'primary',
						label: 'Choose a quiz',
						href: href.for(QuizzesRoute),
					}),
				],
			})
		)
	},
})

/**
 * The chosen quiz's practice, or the way to choose one. Opened straight from a link, the saved
 * quiz comes back a moment after the screen is up.
 */
export const Practice = component({
	name: 'practice',
	onMount({ create, replace, signal }) {
		/** The quiz on screen, by id and version; `''` for none. */
		let practising: string | undefined
		const showQuiz = () => {
			const { quiz } = snapshot(selection)
			const key = quiz === undefined ? '' : `${quiz.id}@${quiz.version}`
			if (key === practising) return
			practising = key
			replace(quiz === undefined ? create(NoQuiz) : create(PracticeSession, { quiz }))
		}
		selection.on('change', signal, showQuiz)
		showQuiz()
	},
})

type PracticeSessionOptions = {
	readonly quiz: BunbuData
}

const PracticeSession = component<PracticeSessionOptions>({
	name: 'practice-session',
	onMount({ create, options, replace, signal }) {
		const { quiz } = options
		const game = createPracticeGame()
		// Only the mistakes when they were asked for and the last run on this quiz made some.
		const missed = mistakesOnly(href.url(location.href).path)
			? missedQuestions(lastRun.value.missesOf(quiz.id, quiz.version))
			: []
		preparePractice(game, quiz, missed.length > 0 ? missed : undefined, Math.random)

		// The start screen, then the ambushes: these stay up through the pause and the end of
		// practice, which show over them, so play is guarded from Start until practice is left.
		const showPhase = (starting: boolean) => {
			replace(starting
				? create(PracticeStart, {
					title: quiz.title,
					questions: game.quiz.value.order.length,
					mistakesOnly: missed.length > 0,
					start: () => { beginPractice(game) },
				})
				: create(PracticeAmbush, {
					game,
					quiz,
				}))
		}
		let starting = game.session.value.phase === 'start'
		game.session.on('change', signal, ({ detail }) => {
			const next = detail.state.phase === 'start'
			if (next === starting) return
			starting = next
			showPhase(starting)
		})
		showPhase(starting)

		show((viewport) => createDojoWorld(viewport, game.tally), signal)
	},
})
