/**
 * The papyrus scroll of an ambush ([4 Ambush](../../../../../docs/design/screens.md#4-ambush)): it
 * unrolls when an ambush opens, marks the options as the player swipes, rolls up when the ambush
 * is answered, and is sliced in half when the time runs out
 * ([5 Outcome](../../../../../docs/design/screens.md#5-outcome)).
 *
 * Shared by the run and dojo practice: each hands it its own ambush and quiz, and the `commit`
 * that answers it. The answers are in its answer drawer, on the swipe zone where the ambush is
 * answered. Without a `commit` the scroll only shows the ambush.
 */

import { component } from '@rooted/components'
import { noAmbush, type Ambush, type AmbushState } from '../state/ambush.mts'
import type { Quiz } from '../state/quiz.mts'
import { headingOf } from './heading.mts'
import { scrollChangeOf } from './scroll-change.mts'
import { ScrollPaper } from './scroll-paper.mts'
import { AnswerDrawer } from './answer-drawer.mts'
import { AnswerSheet } from '../swipe/answer-sheet.mts'
import { SwipeZone } from '../swipe/swipe-zone.mts'
import styles from './scroll.css'

export type ScrollOptions = {
	readonly ambush: Ambush
	readonly quiz: Quiz
	/** The first word of the heading: `AMBUSH` in a run, `PRACTICE` in the dojo. */
	readonly label: string
	/** Strikes: commits the ambush through the mode's flow, like `commitAmbush` in a run. */
	readonly commit?: () => void
	/** Whether the mode is paused or counting down to resume; see {@link SwipeZone}. */
	readonly held?: () => boolean
}

/**
 * Unrolling, turning to the next round's page, open, rolling up, sliced, or nothing to show. Each
 * stage has its own CSS animation.
 */
type Stage = 'unroll' | 'turn' | 'open' | 'roll-up' | 'slice' | 'hidden'

export const Scroll = component<ScrollOptions>({
	name: 'scroll',
	styles,
	onMount({ append, create, element, options, signal }) {
		const { ambush, quiz, label, commit, held } = options

		const heading = (state: AmbushState) => headingOf(label, state, quiz.value.question(state.at)?.type)

		const scroll = append(
			element('section', {
				classes: styles.scroll,
				'data-stage': 'hidden',
				on: {
					// Unrolling, rolling up and slicing end with an animation on the scroll itself, after which it settles.
					animationend(event) {
						if (event.target !== scroll) return
						if (stage === 'unroll' || stage === 'turn') setStage('open')
						else if (stage === 'roll-up' || stage === 'slice') hide()
					},
				},
			})
		)

		let stage: Stage = 'hidden'
		const setStage = (next: Stage) => {
			stage = next
			scroll.dataset.stage = next
		}

		const hide = () => {
			scroll.replaceChildren()
			setStage('hidden')
		}

		// Whether the answers are drawn up, so the halves of a sliced scroll show them as they were.
		let drawn = false

		const paperOf = (state: AmbushState) => create(ScrollPaper, {
					state,
					heading: heading(state),
					drawer: create(AnswerDrawer, {
						onDraw(next) {
							drawn = next
						},
						still: commit === undefined,
						children: commit === undefined
							? create(AnswerSheet, {
								state,
								ambush,
							})
							: create(SwipeZone, {
								state,
								ambush,
								commit,
								held,
							}),
					}),
				})

		const unroll = (state: AmbushState) => {
			drawn = false
			scroll.replaceChildren(paperOf(state))
			setStage('unroll')
		}

		// The next round of a question is the next page of the same scroll: the page that was
		// answered turns over, a still copy of it, and shows the next one underneath.
		const turn = (state: AmbushState) => {
			const answered = scroll.firstElementChild?.cloneNode(true)
			drawn = false
			scroll.replaceChildren(
				paperOf(state),
				element('div', {
					classes: styles.turningPage,
					aria: {
						hidden: 'true',
					},
					children: answered,
				})
			)
			setStage('turn')
		}

		// The front ninja cuts through the scroll: the halves are two copies of it, each clipped to
		// its side of the cut, falling apart.
		const slice = (state: AmbushState) => {
			if (stage === 'slice') return
			const half = (side: string | null | undefined) => element('div', {
				classes: [
					styles.half,
					side,
				],
				children: create(ScrollPaper, {
					state,
					heading: heading(state),
					drawer: create(AnswerDrawer, {
						drawn,
						still: true,
						children: create(AnswerSheet, {
							state,
						}),
					}),
				}),
			})
			scroll.replaceChildren(
				half(styles.upper),
				half(styles.lower),
				element('div', {
					classes: styles.cut,
				})
			)
			setStage('slice')
		}

		let shown: AmbushState = noAmbush
		// A new scroll that has not unrolled yet.
		let due = false
		const follow = (next: AmbushState) => {
			const change = scrollChangeOf(shown, next)
			if (change === 'unroll') due = true
			// The first scroll of an ambush unrolls at once, as the world slows down and the view
			// moves; the swipes and the time wait for the ninjas to come in. A next round turns the
			// page of the scroll that is open; a scroll still rolling up is waited for.
			if (due && next.round > 1 && shown.open && (stage === 'open' || stage === 'unroll' || stage === 'turn')) {
				due = false
				turn(next)
			}
			else if (due && (next.openingLeft === 0 || (next.round === 1 && stage === 'hidden'))) {
				due = false
				unroll(next)
			}
			// Picks are followed by the options themselves.
			else if (change === 'slice') {
				due = false
				slice(next.open ? next : shown)
			}
			else if (change === 'roll-up') {
				due = false
				setStage('roll-up')
			}
			shown = next
		}

		follow(ambush.value)
		ambush.on('change', signal, ({ detail }) => {
			follow(detail.state)
		})
	},
})
