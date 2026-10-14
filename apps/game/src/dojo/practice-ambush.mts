/**
 * D4 Practice ambush ([screens.md](../../../../docs/design/screens.md#d4-practice-ambush)): the
 * ambush's scroll and swipe zone, as in a run, over the dojo world, with read out loud after the
 * query. On top the back link and the running right vs wrong percentage. No timer, no life bar and
 * no pause. A wrong answer shows the miss screen over the scroll's place until **Continue**.
 *
 * On a phone it plays full screen with the screen kept on, as a run
 * ([keepFullscreen](../_shared/play-guard.mts)). Back leaves practice.
 */

import { resolvePronunciations, type BunbuData } from '@bunbu/data'
import { component } from '@rooted/components'
import { href, navigate } from '@rooted/router'
import { BackLink } from '../_shared/menu/back-link.mts'
import { MenuButton } from '../_shared/menu/menu-button.mts'
import { keepFullscreen } from '../_shared/play-guard.mts'
import { ScrollSheet } from '../_shared/scroll/scroll-sheet.mts'
import { Scroll } from '../_shared/scroll/scroll.mts'
import { formatWhole } from '../_shared/numbers.mts'
import { play } from '../canvas/loop.mts'
import { DojoRoute } from './_routes.mts'
import { commitPractice, continuePractice, practiseAgain, progressOf, tickPractice } from './flows/practice.mts'
import { PracticeMiss } from './practice-miss.mts'
import { ReadAloud } from './read-aloud.mts'
import { percentRight, type Miss, type PracticeGame, type TallyState } from './state/practice.mts'
import styles from './practice.css'

/** `✓ 6 · ✗ 2 · 75% right`, or `no answers yet`. */
function tallyText(tally: TallyState): string {
	const percent = percentRight(tally)
	if (percent === undefined) return 'no answers yet'
	return `✓ ${formatWhole(tally.right)} · ✗ ${formatWhole(tally.wrong)} · ${percent}% right`
}

type PracticeScreenOptions = {
	readonly game: PracticeGame
}

/** The top of the screen: back, and the running right vs wrong count. */
const PracticeBar = component<PracticeScreenOptions>({
	name: 'practice-bar',
	styles,
	onMount({ append, create, element, options, signal }) {
		const { game } = options

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
					create(BackLink),
					tally,
				],
			})
		)

		const show = () => {
			tally.textContent = tallyText(game.tally.value)
		}
		show()
		game.tally.on('change', signal, show)
	},
})

/** After the last question: the final right vs wrong, then Again (reshuffled) and Dojo. */
const PracticeDone = component<PracticeScreenOptions>({
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
								// In practice's place in history, so Back from the dojo doesn't come back here.
								action: () => { navigate.replace(href.for(DojoRoute)) },
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
		}, signal)
		keepFullscreen(signal)

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
				// Done, and the next round's scroll coming in under the answered one. A new question
				// opens with no wait of its own: it comes once the answered scroll is gone.
				held: () => !practising() || game.ambush.value.openingLeft > 0,
				progress: (state) => progressOf(game, state.at),
				readAloud: (state) => create(ReadAloud, {
					language: quiz.language,
					// The quiz's own and the built-in dictionaries, as Study reads them.
					pronunciations: resolvePronunciations(quiz),
					blocks: () => [state.query, ...state.options.map((option) => option.answer)],
					stopWhen(stop, until) {
						// Answering closes the scroll that was read.
						game.ambush.on('change', until, ({ detail }) => {
							if (!detail.state.open) stop()
						})
					},
				}),
			}),
		})
		/** What the end of practice shuts off: nothing behind it can be reached until Again. */
		const behind = [top, scroll, miss]

		let done: boolean | undefined
		/** Where the focus was before the end of practice took it, to give it back on Again. */
		let returnFocus: Element | null = null
		const showDone = (next: boolean) => {
			if (next === done) return
			done = next
			if (next) returnFocus = document.activeElement
			overlays.replaceChildren(
				...next
					? [create(PracticeDone, {
						game,
					})]
					: []
			)
			for (const layer of behind) layer.inert = next
			if (next) {
				// The dialog's buttons are there once it has mounted.
				setTimeout(() => { overlays.querySelector('button')?.focus() })
			}
			else if (returnFocus !== null) {
				const before = returnFocus
				returnFocus = null
				setTimeout(() => {
					const back = before instanceof HTMLElement && before.isConnected && before !== document.body
						? before
						: top.querySelector('a')
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

		showDone(game.session.value.phase === 'done')
		game.session.on('change', signal, ({ detail }) => { showDone(detail.state.phase === 'done') })
	},
})
