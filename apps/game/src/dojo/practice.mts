/**
 * D3 to D5 Practice ([dojo.md](../../../../docs/design/dojo.md#practice)): the start screen, then
 * the ambushes. The practice session's state lives as long as this screen: created on mount,
 * dropped on unmount.
 *
 * `/dojo/practice/?mistakes` asks only the questions the last run on the quiz missed.
 */

import type { BunbuData } from '@bunbu/data'
import { component } from '@rooted/components'
import { href } from '@rooted/router'
import { lastRun } from '../fight/state/lastrun.mts'
import { MenuButton } from '../_shared/menu/menu-button.mts'
import { MenuScreen } from '../_shared/menu/menu-screen.mts'
import { Placeholder } from '../_shared/placeholder.mts'
import { selection } from '../_shared/state/selection.mts'
import { snapshot } from '../_shared/state/store.mts'
import { show } from '../canvas/stage.mts'
import { QuizzesRoute } from '../quizzes/_routes.mts'
import { DojoRoute, mistakesOnly, withMistakes } from './_routes.mts'
import { goBack } from '../_shared/menu/back-link.mts'
import { preparePractice } from './flows/practice.mts'
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
				back: href.for(DojoRoute),
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

		const showPhase = () => {
			if (game.session.value.phase === 'start') {
				replace(
					create(PracticeStart, {
						title: quiz.title,
						questions: game.quiz.value.order.length,
						mistakesOnly: missed.length > 0,
						start: () => { game.session.value.begin() },
					})
				)
				return
			}
			replace(
				create(Placeholder, {
					title: 'Practice',
					note: 'The scroll, the swipe zone and the right vs wrong count go here.',
					links: [
						{
							label: 'Back',
							action: () => { goBack(withMistakes(href.for(DojoRoute), missed.length > 0)) },
						},
					],
				})
			)
		}
		let phase = game.session.value.phase
		game.session.on('change', signal, ({ detail }) => {
			if (detail.state.phase === phase) return
			phase = detail.state.phase
			showPhase()
		})
		showPhase()

		show((viewport) => createDojoWorld(viewport, game.tally), signal)
	},
})
