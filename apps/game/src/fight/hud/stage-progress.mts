/**
 * How far the samurai has come: the stage name, how many questions are done, and a mark at each
 * quarter of the stage ([3 Running](../../../../../docs/design/screens.md#3-running)). No boss block
 * in M1 to M4 ([open questions](../../../../../docs/plan.md#open-questions)).
 */

import { component } from '@rooted/components'
import { questionsAnswered, type Quiz, type QuizState } from '../../_shared/state/quiz.mts'
import { selection, stageNames } from '../../_shared/state/selection.mts'
import { marksPassed, quarterMarks, stageDistanceOf, type Run, type RunState } from '../state/run.mts'
import { formatWhole } from '../../_shared/numbers.mts'
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

		const stage = stageNames[selection.value.stage]
		const marks = quarterMarks.map((mark) => element('span', {
			classes: styles.mark,
			style: {
				left: `${mark * 100}%`,
			},
		}))
		const track = element('div', {
			classes: styles.track,
			children: [
				element('div', {
					classes: styles.travelled,
				}),
				...marks,
			],
		})
		const caption = element('span', {
			classes: styles.caption,
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

		// The run changes every frame; the marks only when one is passed.
		let passed = -1
		const showRun = (state: RunState) => {
			const distance = stageDistanceOf(state)
			const fraction = state.stageLength === 0 ? 0 : distance / state.stageLength
			track.style.setProperty('--travelled', String(fraction))
			const now = marksPassed(state)
			if (now === passed) return
			passed = now
			marks.forEach((mark, index) => {
				mark.dataset.passed = String(index < now)
			})
		}

		const showQuiz = (state: Pick<QuizState, 'order' | 'refs' | 'answered'>) => {
			caption.textContent = `${stage} · ${formatWhole(questionsAnswered(state))} / ${formatWhole(state.order.length)}`
		}

		showRun(run.value)
		showQuiz(quiz.value)
		run.on('change', signal, ({ detail }) => {
			showRun(detail.state)
		})
		quiz.on('change', signal, ({ detail }) => {
			showQuiz(detail.state)
		})
	},
})
