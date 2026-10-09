/**
 * The papyrus scroll of an ambush ([4 Ambush](../../../../../docs/design/screens.md#4-ambush)): it
 * unrolls when an ambush opens, marks the options as the player swipes, rolls up when the ambush
 * is answered, and is sliced in half when the time runs out
 * ([5 Outcome](../../../../../docs/design/screens.md#5-outcome)).
 *
 * Shared by the run and dojo practice: each hands it its own ambush and quiz, and the `commit`
 * that answers it. Its footer is the swipe zone, where the ambush is answered.
 * Without a `commit` the scroll only shows the ambush.
 */

import { component } from '@rooted/components'
import { noAmbush, type Ambush, type AmbushState } from '../state/ambush.mts'
import type { Quiz } from '../state/quiz.mts'
import { headingOf } from './heading.mts'
import { scrollChangeOf } from './scroll-change.mts'
import { ScrollPaper } from './scroll-paper.mts'
import { MarkLegend } from '../swipe/mark-legend.mts'
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

/** Unrolling, open, rolling up, sliced, or nothing to show. Each stage has its own CSS animation. */
type Stage = 'unroll' | 'open' | 'roll-up' | 'slice' | 'hidden'

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
						if (stage === 'unroll') setStage('open')
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

		const unroll = (state: AmbushState) => {
			scroll.replaceChildren(
				create(ScrollPaper, {
					state,
					heading: heading(state),
					ambush,
					footer: commit === undefined
						? undefined
						: create(SwipeZone, {
							ambush,
							commit,
							held,
						}),
				})
			)
			setStage('unroll')
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
					footer: commit === undefined
						? undefined
						: create(MarkLegend, {
							state,
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
		const follow = (next: AmbushState) => {
			const change = scrollChangeOf(shown, next)
			// Picks are followed by the options themselves.
			if (change === 'unroll') unroll(next)
			else if (change === 'slice') slice(next.open ? next : shown)
			else if (change === 'roll-up') setStage('roll-up')
			shown = next
		}

		follow(ambush.value)
		ambush.on('change', signal, ({ detail }) => {
			follow(detail.state)
		})
	},
})
