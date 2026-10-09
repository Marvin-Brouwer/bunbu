/**
 * The swipe zone ([ambush](../../../../../docs/design/gameplay.md#ambush)): the footer of the
 * scroll, where swipes answer the open ambush, with the mark legend in it. Only swipes here count,
 * so the text above keeps its own native scrolling.
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
import { MarkLegend } from './mark-legend.mts'
import { finish, follow, strikesAtOnce, strokeAt, type Point, type Stroke } from './stroke.mts'
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

		const choose = (mark: Mark | undefined) => {
			const state = ambush.value
			if (mark === undefined || !state.open || timeUp(state)) return
			state.pick(mark)
			buzz(buzzes.pick)
			if (strikesAtOnce(state.kind)) strike()
		}

		// `finishing` is false when the browser took the pointer over (pointercancel): the last
		// swipe was not meant as one, but what was picked before it still strikes.
		const lift = (event: PointerEvent, finishing: boolean) => {
			if (event.pointerId !== pointer) return
			const last = stroke
			forgetStroke()
			if (finishing && last !== undefined) choose(finish(last, available()))
			const state = ambush.value
			if (state.open && !strikesAtOnce(state.kind) && anyPicked(state)) strikeAfterPause()
		}

		const zone = append(
			element('div', {
				classes: styles.zone,
				'data-open': 'false',
				on: {
					pointerdown(event) {
						if (pointer !== undefined || !ambush.value.open) return
						cancelStrike()
						pointer = event.pointerId
						stroke = strokeAt(pointOf(event))
						// Keeps the stroke when the finger slides out of the zone, over the scroll.
						event.currentTarget.setPointerCapture(event.pointerId)
					},
					pointermove(event) {
						if (event.pointerId !== pointer || stroke === undefined) return
						const step = follow(stroke, pointOf(event), available())
						stroke = step.stroke
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
			})
		)

		// The ambush changes every frame while its time runs down; the legend only when the picks do.
		// Once the ambush closes the legend stays as it was while the scroll rolls up.
		let drawn = ''
		const show = (state: AmbushState) => {
			zone.dataset.open = String(state.open)
			if (!state.open) {
				cancelStrike()
				forgetStroke()
				return
			}
			const picks = `${state.kind} ${state.options.map((option) => `${option.mark}:${option.ninja}:${option.pick}`).join(' ')}`
			if (picks === drawn) return
			drawn = picks
			zone.replaceChildren(
				create(MarkLegend, {
					state,
				})
			)
		}

		show(ambush.value)
		ambush.on('change', signal, ({ detail }) => {
			show(detail.state)
		})
	},
})
