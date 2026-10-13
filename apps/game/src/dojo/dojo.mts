/**
 * D1 Dojo menu ([screens.md](../../../../docs/design/screens.md#d1-dojo-menu)): the chosen quiz,
 * then Study and Practice, each a card with its art, and **Only my mistakes from the last run**
 * when the last run was on this quiz and missed some. Without a quiz the cards can't be opened,
 * and a line leads to the quizzes.
 *
 * `/dojo/?mistakes` opens it with the mistakes ticked, as **Practise mistakes** on the results does;
 * Practice then opens with them too.
 */

import type { BunbuData } from '@bunbu/data'
import { component, environment } from '@rooted/components'
import { href, navigate, type Path } from '@rooted/router'
import { lastRun } from '../fight/state/lastrun.mts'
import { ChoiceStamp } from '../_shared/menu/choice-stamp.mts'
import { MenuButton } from '../_shared/menu/menu-button.mts'
import { MenuScreen } from '../_shared/menu/menu-screen.mts'
import { MenuSection } from '../_shared/menu/menu-section.mts'
import { formatWhole } from '../_shared/numbers.mts'
import { selection, type SelectionState } from '../_shared/state/selection.mts'
import { snapshot } from '../_shared/state/store.mts'
import { library } from '../_shared/storage/library.mts'
import { QuizzesRoute } from '../quizzes/_routes.mts'
import { mistakesOnly, PracticeRoute, StudyRoute, withMistakes } from './_routes.mts'
import { missedQuestions } from './state/mistakes.mts'
import practiceArt from './practice-art.svg'
import studyArt from './study-art.svg'
import styles from './dojo.css'

type ModeCardOptions = {
	readonly title: string
	readonly text: string
	readonly art: string
	/** Where the card leads, read when it is opened; `undefined` while there is no quiz. */
	readonly target: (() => Path) | undefined
}

/** Study or Practice: the art, the name and what it is, the whole card a link. */
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
					href: target().href,
					children,
					on: {
						// The target can change while the card shows, as when "only my mistakes" is ticked:
						// the address is brought up to date before it is opened, in a new tab too.
						pointerdown(event) {
							event.currentTarget.href = target().href
						},
						focus(event) {
							event.currentTarget.href = target().href
						},
						click(event) {
							event.preventDefault()
							navigate(target())
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
						textContent: `v${quiz.version} · ${formatWhole(quiz.questions.length)} questions ▾`,
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
		// Ticked by the link that opened the menu; the box changes it from there.
		let mistakes = mistakesOnly(href.url(location.href).path)

		const show = () => {
			const { quiz } = snapshot<SelectionState>(selection)
			const loading = environment.is('preRenderer') || !library.value.restored
			const missed = quiz === undefined ? 0 : missedQuestions(lastRun.value.missesOf(quiz.id, quiz.version)).length
			const practice = () => missed > 0 && mistakes ? withMistakes(href.for(PracticeRoute)) : href.for(PracticeRoute)

			replace(
				create(MenuScreen, {
					title: '道場 · Dojo',
					back: href.path('/'),
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
									target: quiz === undefined ? undefined : () => href.for(StudyRoute),
								}),
								create(ModeCard, {
									title: 'Practice',
									text: 'The ambush without the risk: no life bar, no death. A miss shows the right answer.',
									art: practiceArt,
									target: quiz === undefined ? undefined : practice,
								}),
							],
						}),
						missed === 0
							? undefined
							: element('label', {
								classes: styles.mistakes,
								children: [
									element('input', {
										type: 'checkbox',
										checked: mistakes,
										on: {
											change(event) {
												mistakes = event.currentTarget.checked
												// In the address too, so coming back to the menu finds the box as it was left.
												history.replaceState(history.state, '', withMistakes(href.url(location.href).path, mistakes).href)
											},
										},
									}),
									create(ChoiceStamp),
									element('span', {
										textContent: `Only my mistakes from the last run (${formatWhole(missed)})`,
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
