/**
 * The swipe zone ([ambush](../../../../../docs/design/gameplay.md#ambush)): the answers on the
 * paper of the answer drawer, where swipes answer the open ambush. Only swipes on the paper count,
 * so the question above keeps its own native scrolling.
 *
 * The pointer leaves a faint trace on the paper, and each pick cuts its answer in two
 * ([ScrollOption](../scroll/scroll-option.mts)).
 *
 * A swipe toward a mark picks it. `yes-no` and `single` strike at once, `order` as soon as each of
 * its items has its place (its distractors left out) and `multiple` as soon as as many are cut as
 * the scroll asks for ([answered.mts](./answered.mts)). A `multiple` that doesn't give the count
 * away strikes once the pointer has been lifted for the commit pause, and touching down again
 * before that keeps the answer open. Lifting between swipes is optional:
 * one continuous stroke can pick several marks ([stroke.mts](./stroke.mts)).
 *
 * The scroll puts it in its answer drawer, in the run and in dojo practice. It picks through the
 * ambush store and strikes through the mode's own `commit`, which spreads the result over the
 * mode's other stores.
 */

import { component } from '@rooted/components'
import { buzz, buzzes } from '../haptics.mts'
import { ambushConfig } from '../state/ambush-time.mts'
import { timeUp, type Ambush, type AmbushState, type Mark } from '../state/ambush.mts'
import { AnswerSheet } from './answer-sheet.mts'
import { answered, strikesWhenAnswered } from './answered.mts'
import { finish, follow, strikesAtOnce, strokeAt, type Point, type Stroke } from './stroke.mts'
import styles from './swipe.css'

export type SwipeZoneOptions = {
	/** The ambush as it was when the scroll opened. */
	readonly state: AmbushState
	readonly ambush: Ambush
	/** Strikes: commits the ambush through the mode's flow, like `commitAmbush` in a run. */
	readonly commit: () => void
	/**
	 * Whether the scroll can't be answered now: the mode is paused or counting down to resume, or
	 * the scroll is still coming in (`openingLeft`). Swipes then pick nothing, and a strike that comes
	 * due waits for another commit pause, so it never lands in the pause menu.
	 */
	readonly held?: () => boolean
}

const pointOf = (event: PointerEvent): Point => ({ x: event.clientX, y: event.clientY })

const isPicked = (state: AmbushState, mark: Mark) =>
	state.options.some((option) => option.mark === mark && option.pick > 0)

export const SwipeZone = component<SwipeZoneOptions>({
	name: 'swipe-zone',
	styles,
	onMount({ append, create, element, options, signal }) {
		const { state, ambush, commit, held = () => false } = options

		// One pointer at a time: a second finger is ignored until the first one lifts.
		let pointer: number | undefined
		let stroke: Stroke | undefined
		let strikeTimer: ReturnType<typeof setTimeout> | undefined

		const available = () => ambush.value.options.map((option) => option.mark)

		const cancelStrike = () => {
			clearTimeout(strikeTimer)
			strikeTimer = undefined
		}
		signal.addEventListener('abort', cancelStrike, { once: true })

		const forgetStroke = () => {
			pointer = undefined
			stroke = undefined
		}

		const strike = () => {
			cancelStrike()
			forgetStroke()
			commit()
		}

		const strikeAfterPause = () => {
			cancelStrike()
			strikeTimer = setTimeout(() => {
				strikeTimer = undefined
				if (!ambush.value.open || !answered(ambush.value)) return
				if (held()) strikeAfterPause()
				else strike()
			}, ambushConfig.commitPauseSeconds * 1000)
		}

		const trace = element('svg:polyline', {
			classes: styles.trace,
		})
		const overlay = element('svg', {
			classes: styles.overlay,
			aria: {
				hidden: 'true',
			},
			children: trace,
		})
		let traced: Point[] = []

		/** `point` on the paper, from the pointer's coordinates. */
		const onPaper = (point: Point): Point => {
			const bounds = overlay.getBoundingClientRect()
			return { x: point.x - bounds.left, y: point.y - bounds.top }
		}

		const traceTo = (point: Point) => {
			traced.push(onPaper(point))
			trace.setAttribute('points', traced.map(({ x, y }) => `${x},${y}`).join(' '))
		}

		const clearTrace = () => {
			traced = []
			trace.setAttribute('points', '')
		}

		// A swipe is final: swiping a mark that is picked already does nothing.
		const choose = (mark: Mark | undefined) => {
			const current = ambush.value
			// Held, nothing is picked: a `single` or `yes-no` would strike at once, before the scroll
			// can be answered. A stroke the hold caught halfway is dropped as a whole, so it can't pick
			// once the hold is over either.
			if (held()) {
				forgetStroke()
				clearTrace()
				return
			}
			if (mark === undefined || !current.open || timeUp(current) || isPicked(current, mark)) return
			current.pick(mark)
			buzz(buzzes.pick)
			const next = ambush.value
			if (strikesAtOnce(next.kind) || (strikesWhenAnswered(next) && answered(next))) strike()
		}

		// `finishing` is false when the browser took the pointer over (pointercancel): the last
		// swipe was not meant as one, but what was picked before it still strikes.
		const lift = (event: PointerEvent, finishing: boolean) => {
			if (event.pointerId !== pointer) return
			const last = stroke
			forgetStroke()
			clearTrace()
			if (finishing && last !== undefined) choose(finish(last, available()))
			const current = ambush.value
			if (current.open && !strikesAtOnce(current.kind) && answered(current)) strikeAfterPause()
		}

		const zone = element('div', {
			classes: styles.zone,
			'data-open': 'false',
			on: {
				pointerdown(event) {
					// A stroke begun while held is never taken up: it would answer when the hold ends.
					if (pointer !== undefined || !ambush.value.open || held()) return
					cancelStrike()
					pointer = event.pointerId
					stroke = strokeAt(pointOf(event))
					clearTrace()
					traceTo(pointOf(event))
					// Keeps the stroke when the finger slides out of the zone, over the scroll.
					event.currentTarget.setPointerCapture(event.pointerId)
				},
				pointermove(event) {
					if (event.pointerId !== pointer || stroke === undefined) return
					const step = follow(stroke, pointOf(event), available())
					stroke = step.stroke
					traceTo(pointOf(event))
					choose(step.mark)
				},
				pointerup(event) {
					lift(event, true)
				},
				pointercancel(event) {
					lift(event, false)
				},
				// Should the capture go without a pointerup or pointercancel, the next touch still starts a stroke.
				lostpointercapture(event) {
					lift(event, false)
				},
			},
			children: [
				create(AnswerSheet, {
					state,
					ambush,
				}),
				overlay,
			],
		})

		append(zone)

		const show = (next: AmbushState) => {
			zone.dataset.open = String(next.open)
			if (next.open) return
			cancelStrike()
			forgetStroke()
			clearTrace()
		}

		show(ambush.value)
		ambush.on('change', signal, ({ detail }) => {
			show(detail.state)
		})
	},
})
