/**
 * D4 Practice ambush ([screens.md](../../../../docs/design/screens.md#d4-practice-ambush)): the
 * ambush's scroll and swipe zone, as in a run, over the dojo world. On top the pause button, the
 * running right vs wrong percentage and the speaker button. No timer, no life bar. A wrong answer
 * shows the miss screen over the scroll's place until **Continue**.
 *
 * It plays like a run on a phone ([play guard](../_shared/play-guard.mts)): full screen, the screen
 * kept on, and Back or leaving full screen pauses. Back while paused, or after the last question,
 * leaves practice.
 */

import { resolvePronunciations, type BunbuData } from '@bunbu/data'
import { component } from '@rooted/components'
import { href, type Path } from '@rooted/router'
import { MenuButton } from '../_shared/menu/menu-button.mts'
import { guardPlay } from '../_shared/play-guard.mts'
import { ScrollSheet } from '../_shared/scroll/scroll-sheet.mts'
import { Scroll } from '../_shared/scroll/scroll.mts'
import { formatWhole } from '../_shared/numbers.mts'
import { play } from '../canvas/loop.mts'
import { DojoRoute } from './_routes.mts'
import { commitPractice, continuePractice, practiseAgain, progressOf, tickPractice } from './flows/practice.mts'
import { missBlocksOf, PracticeMiss } from './practice-miss.mts'
import { ReadAloud } from './read-aloud.mts'
import { percentRight, type Miss, type PracticeGame, type SessionPhase, type TallyState } from './state/practice.mts'
import styles from './practice.css'

/** `✓ 6 · ✗ 2 · 75% right`, or `no answers yet`. */
function tallyText(tally: TallyState): string {
	const percent = percentRight(tally)
	if (percent === undefined) return 'no answers yet'
	return `✓ ${formatWhole(tally.right)} · ✗ ${formatWhole(tally.wrong)} · ${percent}% right`
}

type PracticeBarOptions = {
	readonly game: PracticeGame
	readonly quiz: BunbuData
}

/** The top of the screen: pause, the running right vs wrong count, and read aloud. */
const PracticeBar = component<PracticeBarOptions>({
	name: 'practice-bar',
	styles,
	onMount({ append, create, element, options, signal }) {
		const { game, quiz } = options

		const pause = element('button', {
			type: 'button',
			classes: [
				styles.panel,
				styles.iconButton,
				styles.pause,
			],
			aria: {
				label: 'Pause',
			},
			on: {
				click() {
					game.session.value.pause()
				},
			},
		})
		const tally = element('p', {
			classes: [
				styles.panel,
				styles.tally,
			],
			aria: {
				live: 'polite',
			},
		})

		append(
			element('div', {
				classes: styles.bar,
				children: [
					pause,
					tally,
					create(ReadAloud, {
						language: quiz.language,
						// The quiz's own and the built-in dictionaries, as Study reads them.
						pronunciations: resolvePronunciations(quiz),
						// The card, or on the miss screen the right answer and the explanation.
						blocks: () => {
							const { missed } = game.tally.value
							if (missed !== undefined) return missBlocksOf(quiz, missed)
							const { query, options: answers } = game.ambush.value
							return [query, ...answers.map((answer) => answer.answer)]
						},
						stopWhen(stop, until) {
							// Continue leaves the miss screen that was read.
							let missed = game.tally.value.missed
							game.tally.on('change', until, ({ detail }) => {
								if (detail.state.missed !== missed) stop()
								missed = detail.state.missed
							})
							// Answering closes the scroll that was read.
							game.ambush.on('change', until, ({ detail }) => {
								if (!detail.state.open) stop()
							})
							game.session.on('change', until, ({ detail }) => {
								if (detail.state.phase !== 'practising') stop()
							})
						},
					}),
				],
			})
		)

		const show = () => {
			tally.textContent = tallyText(game.tally.value)
			pause.disabled = game.session.value.phase !== 'practising'
		}
		show()
		game.tally.on('change', signal, show)
		game.session.on('change', signal, show)
	},
})

type PracticeDialogOptions = {
	readonly game: PracticeGame
	readonly leave: (to: Path) => void
}

/** Paused: how practice is going, with Resume and Leave practice. */
const PracticePause = component<PracticeDialogOptions>({
	name: 'practice-pause',
	styles,
	onMount({ append, create, element, options }) {
		const { game } = options
		const { quiz, order } = game.quiz.value

		append(
			element('div', {
				classes: styles.dialog,
				role: 'dialog',
				aria: {
					label: 'Paused',
					modal: 'true',
				},
				children: create(ScrollSheet, {
					unroll: true,
					children: element('div', {
						classes: styles.sheetBody,
						children: [
							element('h2', {
								classes: styles.dialogTitle,
								textContent: 'Paused',
							}),
							element('p', {
								classes: styles.dialogNote,
								textContent: `${quiz?.title ?? ''} · ${formatWhole(order.length)} ${order.length === 1 ? 'question' : 'questions'}`,
							}),
							element('p', {
								textContent: tallyText(game.tally.value),
							}),
						],
					}),
					footer: element('div', {
						classes: styles.actions,
						children: [
							create(MenuButton, {
								kind: 'primary',
								label: 'Resume',
								action: () => { game.session.value.resume() },
							}),
							create(MenuButton, {
								label: 'Leave practice',
								action: () => { options.leave(href.for(DojoRoute)) },
							}),
						],
					}),
				}),
			})
		)
	},
})

/** After the last question: the final right vs wrong, then Again (reshuffled) and Dojo. */
const PracticeDone = component<PracticeDialogOptions>({
	name: 'practice-done',
	styles,
	onMount({ append, create, element, options }) {
		const { game } = options
		const percent = percentRight(game.tally.value) ?? 0

		append(
			element('div', {
				classes: styles.dialog,
				role: 'dialog',
				aria: {
					label: 'Practice done',
					modal: 'true',
				},
				children: create(ScrollSheet, {
					unroll: true,
					children: element('div', {
						classes: styles.sheetBody,
						children: [
							element('h2', {
								classes: styles.dialogTitle,
								textContent: 'Practice done',
							}),
							element('p', {
								classes: styles.percent,
								textContent: `${percent}%`,
							}),
							element('p', {
								classes: styles.dialogNote,
								textContent: `${formatWhole(game.tally.value.right)} right · ${formatWhole(game.tally.value.wrong)} wrong · not a score, not kept`,
							}),
						],
					}),
					footer: element('div', {
						classes: styles.actions,
						children: [
							create(MenuButton, {
								kind: 'primary',
								label: 'Again',
								action: () => { practiseAgain(game) },
							}),
							create(MenuButton, {
								label: 'Dojo',
								action: () => { options.leave(href.for(DojoRoute)) },
							}),
						],
					}),
				}),
			})
		)
	},
})

export type PracticeAmbushOptions = {
	readonly game: PracticeGame
	readonly quiz: BunbuData
}

export const PracticeAmbush = component<PracticeAmbushOptions>({
	name: 'practice-ambush',
	styles,
	onMount({ append, create, element, options, signal }) {
		const { game, quiz } = options
		const practising = () => game.session.value.phase === 'practising'

		play({
			update: (_, realDelta) => { tickPractice(game, realDelta) },
			paused: () => !practising(),
			worldScale: () => 1,
			pause: () => { game.session.value.pause() },
		}, signal)

		// Full screen on a phone, and Back pauses; both come back on Resume and on Again.
		const guard = guardPlay({
			pause: () => { game.session.value.pause() },
			pausable: practising,
		}, signal)

		// The miss screen, until Continue. It takes the focus when it shows, on Continue, so a screen
		// reader says that the answer was missed and what to do next.
		const miss = element('div', {
			classes: [
				styles.layer,
				styles.miss,
			],
			role: 'region',
			aria: {
				label: 'Missed',
			},
		})
		let shownMiss: Miss | undefined
		const showMiss = (next: Miss | undefined) => {
			if (next === shownMiss) return
			shownMiss = next
			miss.replaceChildren(
				...next === undefined
					? []
					: [create(PracticeMiss, {
						quiz,
						miss: next,
						carryOn: () => { continuePractice(game) },
					})]
			)
			// Its buttons are there once it has mounted.
			if (next !== undefined) setTimeout(() => { miss.querySelector('button')?.focus() })
		}

		const overlays = element('div', {
			classes: [
				styles.layer,
				styles.overlays,
			],
		})
		const top = element('div', {
			classes: [
				styles.layer,
				styles.top,
			],
			children: create(PracticeBar, {
				game,
				quiz,
			}),
		})
		const scroll = element('div', {
			classes: [
				styles.layer,
				styles.scroll,
			],
			children: create(Scroll, {
				ambush: game.ambush,
				quiz: game.quiz,
				label: 'PRACTICE',
				commit: () => { commitPractice(game) },
				// The pause, and the next round's scroll coming in under the answered one. A new
				// question opens with no wait of its own: it comes once the answered scroll is gone.
				held: () => !practising() || game.ambush.value.openingLeft > 0,
				progress: (state) => progressOf(game, state.at),
			}),
		})
		/** What a dialog over practice shuts off: nothing behind it can be reached until it closes. */
		const behind = [top, scroll, miss]

		let phase: SessionPhase | undefined
		/** Where the focus was before a dialog took it, to give it back when the dialog closes. */
		let returnFocus: Element | null = null
		const showPhase = (next: SessionPhase) => {
			if (next === phase) return
			if (next === 'practising' && phase !== undefined) guard.resumed()
			phase = next
			const modal = next === 'paused' || next === 'done'
			if (modal && overlays.childElementCount === 0) returnFocus = document.activeElement
			overlays.replaceChildren(
				...next === 'paused'
					? [create(PracticePause, {
						game,
						leave: guard.leave,
					})]
					: next === 'done'
						? [create(PracticeDone, {
							game,
							leave: guard.leave,
						})]
						: []
			)
			for (const layer of behind) layer.inert = modal
			if (modal) {
				// The dialog's buttons are there once it has mounted.
				setTimeout(() => { overlays.querySelector('button')?.focus() })
			}
			else if (returnFocus !== null) {
				// Back where it was; the pause button itself loses the focus as it is disabled while paused.
				const before = returnFocus
				returnFocus = null
				// After the bar has enabled its buttons again.
				setTimeout(() => {
					const back = before instanceof HTMLElement && before.isConnected && before !== document.body
						? before
						: top.querySelector('button')
					back?.focus()
				})
			}
		}

		append(
			element('div', {
				classes: styles.practice,
				children: [
					top,
					scroll,
					miss,
					overlays,
				],
			})
		)

		showMiss(game.tally.value.missed)
		game.tally.on('change', signal, ({ detail }) => { showMiss(detail.state.missed) })

		showPhase(game.session.value.phase)
		game.session.on('change', signal, ({ detail }) => { showPhase(detail.state.phase) })
	},
})
