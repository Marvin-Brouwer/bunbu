/**
 * The swipe zone ([ambush](../../../../../docs/design/gameplay.md#ambush)): the footer of the
 * scroll, a sheet of paper where swipes answer the open ambush, with the answers picked so far
 * above it. Only swipes on the paper count, so the text above keeps its own native scrolling.
 *
 * The pointer leaves a faint trace on the paper, and each pick cuts it with a red slash in the
 * direction of its mark, through the middle of the swipe.
 *
 * A swipe toward a mark picks it. `yes-no` and `single` strike at once; `multiple` and `order`
 * strike once the pointer has been lifted for the commit pause, and touching down again before
 * that keeps the answer open. Lifting between swipes is optional: one continuous stroke can pick
 * several marks ([stroke.mts](./stroke.mts)).
 *
 * The scroll puts it in its footer, in the run and in dojo practice. It picks through the
 * ambush store and strikes through the mode's own `commit`, which spreads the result over the
 * mode's other stores.
 */

import { component } from '@rooted/components'
import { buzz, buzzes } from '../haptics.mts'
import { ambushConfig } from '../state/ambush-time.mts'
import { timeUp, type Ambush, type AmbushState, type Mark } from '../state/ambush.mts'
import { SwipePaper } from './swipe-paper.mts'
import { SwipePicks } from './swipe-picks.mts'
import { directionOf, finish, follow, strikesAtOnce, strokeAt, type Point, type Stroke } from './stroke.mts'
import styles from './swipe.css'

export type SwipeZoneOptions = {
	readonly ambush: Ambush
	/** Strikes: commits the ambush through the mode's flow, like `commitAmbush` in a run. */
	readonly commit: () => void
	/**
	 * Whether the mode is paused or counting down to resume. A strike that comes due then waits
	 * for another commit pause, so it never lands in the pause menu.
	 */
	readonly held?: () => boolean
}

const pointOf = (event: PointerEvent): Point => ({ x: event.clientX, y: event.clientY })

const anyPicked = (state: AmbushState) => state.options.some((option) => option.pick > 0)

const isPicked = (state: AmbushState, mark: Mark) =>
	state.options.some((option) => option.mark === mark && option.pick > 0)

/** A swipe, from where it started to how far it got, in pointer coordinates. */
type Swipe = {
	readonly from: Point
	readonly to: Point
}

/** The shortest slash drawn, in CSS pixels, so a swipe just past the dead zone still shows. */
const shortestSlash = 72

export const SwipeZone = component<SwipeZoneOptions>({
	name: 'swipe-zone',
	styles,
	onMount({ append, create, element, options, signal }) {
		const { ambush, commit, held = () => false } = options

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
				if (!ambush.value.open || !anyPicked(ambush.value)) return
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

		/** Cuts the paper along `mark`, through the middle of the swipe. */
		const slash = (mark: Mark, swipe: Swipe) => {
			const from = onPaper(swipe.from)
			const to = onPaper(swipe.to)
			const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
			const half = Math.max(shortestSlash, Math.hypot(to.x - from.x, to.y - from.y)) / 2
			const toward = directionOf(mark)
			overlay.append(element('svg:line', {
				classes: styles.slash,
				x1: middle.x - toward.x * half,
				y1: middle.y - toward.y * half,
				x2: middle.x + toward.x * half,
				y2: middle.y + toward.y * half,
				pathLength: 1,
			}))
		}

		// A swipe is final: swiping a mark that is picked already does nothing.
		const choose = (mark: Mark | undefined, swipe: Swipe) => {
			const state = ambush.value
			if (mark === undefined || !state.open || timeUp(state) || isPicked(state, mark)) return
			state.pick(mark)
			slash(mark, swipe)
			buzz(buzzes.pick)
			if (strikesAtOnce(state.kind)) strike()
		}

		// `finishing` is false when the browser took the pointer over (pointercancel): the last
		// swipe was not meant as one, but what was picked before it still strikes.
		const lift = (event: PointerEvent, finishing: boolean) => {
			if (event.pointerId !== pointer) return
			const last = stroke
			forgetStroke()
			clearTrace()
			if (finishing && last !== undefined) choose(finish(last, available()), { from: last.from, to: last.furthest })
			const state = ambush.value
			if (state.open && !strikesAtOnce(state.kind) && anyPicked(state)) strikeAfterPause()
		}

		const zone = element('div', {
			classes: styles.zone,
			'data-open': 'false',
			on: {
				pointerdown(event) {
					if (pointer !== undefined || !ambush.value.open) return
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
					const before = stroke
					const step = follow(before, pointOf(event), available())
					stroke = step.stroke
					traceTo(pointOf(event))
					choose(step.mark, { from: before.from, to: before.furthest })
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
				create(SwipePaper, {
					kind: ambush.value.kind,
				}),
				overlay,
			],
		})

		append(
			element('div', {
				classes: styles.swipe,
				children: [
					create(SwipePicks, {
						ambush,
					}),
					zone,
				],
			})
		)

		const show = (state: AmbushState) => {
			zone.dataset.open = String(state.open)
			if (state.open) return
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
