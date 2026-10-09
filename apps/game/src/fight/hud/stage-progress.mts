/**
 * How far the samurai has come: the stage name, the distance, and a tick per ambush
 * ([3 Running](../../../../../docs/design/screens.md#3-running)). No boss block in M1 to M4
 * ([open questions](../../../../../docs/plan.md#open-questions)).
 */

import { component, match } from '@rooted/components'
import type { Quiz, QuizState } from '../../_shared/state/quiz.mts'
import { selection } from '../../_shared/state/selection.mts'
import type { Run, RunState } from '../state/run.mts'
import { formatWhole } from './numbers.mts'
import styles from './hud.css'

export type StageProgressOptions = {
	readonly run: Run
	readonly quiz: Quiz
}

export const StageProgress = component<StageProgressOptions>({
	name: 'stage-progress',
	styles,
	onMount({ append, element, options, signal }) {
		const { run, quiz } = options

		const stage = match(selection.value.stage, {
			'rice-fields': 'Rice fields',
			'bamboo-forest': 'Bamboo forest',
			'mountain-temple': 'Mountain temple',
			'castle-town': 'Castle town',
			'edo-castle': 'Edo castle',
		})
		const ticks = element('div', {
			classes: styles.ticks,
		})
		const track = element('div', {
			classes: styles.track,
			children: [
				element('div', {
					classes: styles.travelled,
				}),
				ticks,
			],
		})
		const caption = element('span', {
			classes: styles.distance,
		})
		append(
			element('div', {
				classes: styles.progress,
				children: [
					track,
					caption,
				],
			})
		)

		let metres = -1
		const showRun = (state: RunState) => {
			const fraction = state.stageLength === 0 ? 0 : state.distance / state.stageLength
			track.style.setProperty('--travelled', String(fraction))
			// The run changes every frame; the caption only when the metres do.
			const now = Math.floor(state.distance)
			if (now === metres) return
			metres = now
			caption.textContent = `${stage} · ${formatWhole(now)} / ${formatWhole(state.stageLength)} m`
		}

		// The ambushes are spread evenly over the stage (docs/plan.md#open-questions); the ones behind
		// the samurai are dimmed.
		const showTicks = (state: Pick<QuizState, 'refs' | 'answered'>) => {
			const count = state.refs.length
			ticks.replaceChildren(
				...state.refs.map((_, index) => element('span', {
					classes: styles.tick,
					'data-passed': String(index < state.answered),
					style: {
						left: `${((index + 0.5) / count) * 100}%`,
					},
				}))
			)
		}

		showRun(run.value)
		showTicks(quiz.value)
		run.on('change', signal, ({ detail }) => {
			showRun(detail.state)
		})
		quiz.on('change', signal, ({ detail }) => {
			showTicks(detail.state)
		})
	},
})
