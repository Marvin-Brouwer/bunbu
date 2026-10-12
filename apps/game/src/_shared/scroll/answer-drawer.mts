/**
 * The answer drawer ([4 Ambush](../../../../../docs/design/screens.md#4-ambush)): the footer of an
 * ambush scroll. Closed, only its edge shows at the bottom of the scroll, with the {@link Hanko}
 * on it and a line on how to open it, so the question has the whole scroll. Tapping the seal or
 * swiping it up draws the answers up over the question; swiping it down, or tapping it again,
 * puts them away to read the question again.
 *
 * Only the seal opens and closes it: swipes on the answers themselves are the player's answer.
 */

import { component } from '@rooted/components'
import type { ElementChildren } from '@rooted/components/elements'
import { Hanko } from './hanko.mts'
import styles from './scroll.css'

export type AnswerDrawerOptions = {
	/** What is drawn up: the answers, as the swipe zone in an open ambush. */
	readonly children: ElementChildren
	/** Whether it starts drawn; `false` by default, so the question is read first. */
	readonly drawn?: boolean
	/** Told each time the player draws or puts away the answers. */
	readonly onDraw?: (drawn: boolean) => void
	/** A drawer that no longer moves, such as the halves of a sliced scroll. */
	readonly still?: boolean
}

const labels = {
	put: 'Tap or swipe up to answer',
	drawn: 'Swipe down to read the question',
} as const

/** How far, in CSS pixels, the seal has to be dragged to count as a swipe instead of a tap. */
const dragDistance = 12

export const AnswerDrawer = component<AnswerDrawerOptions>({
	name: 'answer-drawer',
	styles,
	onMount({ append, create, element, options }) {
		const { children, onDraw, still = false } = options

		let drawn = options.drawn ?? false
		// Where a pointer landed on the seal: a tap toggles, a swipe up draws and a swipe down puts away.
		let pressedAt: number | undefined

		const change = (next: boolean) => {
			if (next === drawn) return
			drawn = next
			show()
			onDraw?.(drawn)
		}

		const label = element('span', {
			classes: styles.drawerLabel,
		})
		const handle = element('button', {
			classes: styles.drawerHandle,
			type: 'button',
			disabled: still,
			on: {
				pointerdown(event) {
					pressedAt = event.clientY
					event.currentTarget.setPointerCapture(event.pointerId)
				},
				pointerup(event) {
					if (pressedAt === undefined) return
					const moved = event.clientY - pressedAt
					pressedAt = undefined
					change(Math.abs(moved) < dragDistance ? !drawn : moved < 0)
				},
				pointercancel() {
					pressedAt = undefined
				},
				click(event) {
					// A click from the keyboard has no pointer before it (`detail` 0); pointer clicks were handled on pointerup.
					if (event.detail === 0) change(!drawn)
				},
			},
			children: [
				label,
				element('span', {
					classes: styles.seal,
					children: create(Hanko),
				}),
			],
		})
		const slide = element('div', {
			classes: styles.drawerSlide,
			children: [
				handle,
				element('div', {
					classes: styles.drawerPaper,
					children,
				}),
			],
		})

		append(
			element('div', {
				classes: styles.drawer,
				children: slide,
			})
		)

		function show() {
			slide.dataset.drawn = String(drawn)
			label.textContent = drawn ? labels.drawn : labels.put
			handle.setAttribute('aria-expanded', String(drawn))
			handle.setAttribute('aria-label', drawn ? 'Put the answers away and read the question' : 'Draw the answers')
		}
		show()
	},
})
