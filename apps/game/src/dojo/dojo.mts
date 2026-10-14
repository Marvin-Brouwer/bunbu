/**
 * D1 Dojo menu ([screens.md](../../../../docs/design/screens.md#d1-dojo-menu)): the chosen quiz,
 * then Study, Practice all questions and, when the last run was on this quiz and missed some,
 * Practice mistakes, each a card with its art. Without a quiz the cards can't be opened, and a
 * line leads to the quizzes.
 */

import type { BunbuData } from '@bunbu/data'
import { component, environment } from '@rooted/components'
import { href, navigate, type Path } from '@rooted/router'
import { lastRun } from '../fight/state/lastrun.mts'
import { MenuButton } from '../_shared/menu/menu-button.mts'
import { MenuScreen } from '../_shared/menu/menu-screen.mts'
import { MenuSection } from '../_shared/menu/menu-section.mts'
import { formatWhole } from '../_shared/numbers.mts'
import { selection, type SelectionState } from '../_shared/state/selection.mts'
import { snapshot } from '../_shared/state/store.mts'
import { library } from '../_shared/storage/library.mts'
import { QuizzesRoute } from '../quizzes/_routes.mts'
import { PracticeMistakesRoute, PracticeRoute, StudyRoute } from './_routes.mts'
import { missedQuestions } from './state/mistakes.mts'
import practiceArt from './practice-art.svg'
import studyArt from './study-art.svg'
import styles from './dojo.css'

/**
 * A click the browser should handle itself: another button than the main one, or with a key held,
 * which opens the link in a new tab or window.
 */
const openedElsewhere = (event: MouseEvent) =>
	event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey

type ModeCardOptions = {
	readonly title: string
	readonly text: string
	readonly art: string
	/** Where the card leads; `undefined` while there is no quiz. */
	readonly target: Path | undefined
}

/** Study or a Practice: the art, the name and what it is, the whole card a link. */
const ModeCard = component<ModeCardOptions>({
	name: 'dojo-mode-card',
	styles,
	onMount({ append, element, options }) {
		const { target } = options
		const children = [
			element('img', {
				classes: styles.art,
				src: options.art,
				alt: '',
			}),
			element('span', {
				classes: styles.cardText,
				children: [
					element('span', {
						classes: styles.cardTitle,
						textContent: options.title,
					}),
					element('span', {
						textContent: options.text,
					}),
				],
			}),
		]

		append(
			target === undefined
				? element('div', {
					classes: styles.card,
					aria: {
						disabled: 'true',
					},
					children,
				})
				: element('a', {
					classes: styles.card,
					href: target.href,
					children,
					on: {
						click(event) {
							if (openedElsewhere(event)) return
							event.preventDefault()
							navigate(target)
						},
					},
				})
		)
	},
})

/** The chosen quiz, as on the fight screen: its title, its version and how many questions. */
const QuizPanel = component<{ readonly quiz: BunbuData }>({
	name: 'dojo-quiz',
	styles,
	onMount({ append, element, options }) {
		const { quiz } = options
		append(
			element('a', {
				classes: styles.quiz,
				href: href.for(QuizzesRoute).href,
				aria: {
					label: `${quiz.title}, change quiz`,
				},
				on: {
					click(event) {
						if (openedElsewhere(event)) return
						event.preventDefault()
						navigate(href.for(QuizzesRoute))
					},
				},
				children: [
					element('span', {
						classes: styles.quizTitle,
						textContent: quiz.title,
					}),
					element('span', {
						classes: styles.quizNote,
						textContent: `v${quiz.version} · ${formatWhole(quiz.questions.length)} ${quiz.questions.length === 1 ? 'question' : 'questions'} ▾`,
					}),
				],
			})
		)
	},
})

export const DojoMenu = component({
	name: 'dojo',
	styles,
	onMount({ create, element, replace, signal }) {
		const show = () => {
			const { quiz } = snapshot<SelectionState>(selection)
			const loading = environment.is('preRenderer') || !library.value.restored
			const missed = quiz === undefined ? 0 : missedQuestions(lastRun.value.missesOf(quiz.id, quiz.version)).length

			replace(
				create(MenuScreen, {
					title: '道場 · Dojo',
					children: [
						create(MenuSection, {
							label: 'Quiz',
							children: quiz === undefined
								? [
									element('p', {
										classes: styles.quizNote,
										textContent: loading ? 'Loading…' : 'Choose a quiz to study or practise first.',
									}),
									loading
										? undefined
										: create(MenuButton, {
											kind: 'primary',
											label: 'Select quiz',
											href: href.for(QuizzesRoute),
										}),
								]
								: create(QuizPanel, {
									quiz,
								}),
						}),
						element('div', {
							classes: styles.cards,
							children: [
								create(ModeCard, {
									title: 'Study',
									text: 'Every question with its correct answer, shuffled and read aloud on a loop. Hands-free.',
									art: studyArt,
									target: quiz === undefined ? undefined : href.for(StudyRoute),
								}),
								create(ModeCard, {
									title: 'Practice all questions',
									text: 'The ambush without the risk: no life bar, no death. A miss shows the right answer.',
									art: practiceArt,
									target: quiz === undefined ? undefined : href.for(PracticeRoute),
								}),
								missed === 0
									? undefined
									: create(ModeCard, {
										title: 'Practice mistakes',
										text: `Only the ${missed === 1 ? 'question' : `${formatWhole(missed)} questions`} you missed in your last run.`,
										art: practiceArt,
										target: href.for(PracticeMistakesRoute),
									}),
							],
						}),
					],
				})
			)
		}

		show()
		selection.on('change', signal, show)
		library.on('change', signal, show)
		lastRun.on('change', signal, show)
	},
})
