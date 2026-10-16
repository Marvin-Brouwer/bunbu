/**
 * How far the samurai has come: the stage name, how many questions are done, and a mark at each
 * quarter of the stage ([3 Running](../../../../../docs/design/screens.md#3-running)). No boss block
 * in M1 to M4 ([open questions](../../../../../docs/plan.md#open-questions)).
 *
 * In endless the bar is the stage that is on, and the count goes on with no end:
 * `Endless · Castle town · 47` ([endless](../../../../../docs/design/gameplay.md#endless)).
 */

import { component } from '@rooted/components'
import { questionsAnswered, type Asked, type Quiz, type QuizState } from '../../_shared/state/quiz.mts'
import { selection, stageNames } from '../../_shared/state/selection.mts'
import { marksPassed, quarterMarks, stageDistanceOf, type Run, type RunState } from '../state/run.mts'
import { formatWhole } from '../../_shared/numbers.mts'
import { answersOn, endlessStage, stageAt, stageQuestions, stageStart } from '../flows/endless.mts'
import type { Life } from '../state/life.mts'
import styles from './hud.css'

export type StageProgressOptions = {
	readonly run: Run
	readonly quiz: Quiz
	/** In endless, a fall keeps the bar on the stage he fell in. */
	readonly life: Life
}

export const StageProgress = component<StageProgressOptions>({
	name: 'stage-progress',
	styles,
	onMount({ append, element, options, signal }) {
		const { run, quiz } = options

		const { endless } = selection.value
		/** In endless, how many questions a stage asks; the stage on show, from the run. */
		const questions = () => {
			const data = quiz.value.quiz
			return data === undefined ? 1 : stageQuestions(data)
		}
		let stage = stageNames[endless ? endlessStage(0) : selection.value.stage]
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
			if (endless) {
				// The stage of endless that is on, its marks its own.
				const index = stageAt(state.distance, questions(), answersOn(quiz.value, options.life.value.empty()))
				const start = stageStart(index, questions())
				const end = stageStart(index + 1, questions())
				const fraction = Math.max(0, Math.min(1, (state.distance - start) / (end - start)))
				track.style.setProperty('--travelled', String(fraction))
				if (stageNames[endlessStage(index)] !== stage) {
					stage = stageNames[endlessStage(index)]
					showQuiz(quiz.value)
				}
				showMarks(quarterMarks.filter((mark) => fraction >= mark).length)
				return
			}
			const distance = stageDistanceOf(state)
			const fraction = state.stageLength === 0 ? 0 : distance / state.stageLength
			track.style.setProperty('--travelled', String(fraction))
			showMarks(marksPassed(state))
		}
		function showMarks(now: number) {
			if (now === passed) return
			passed = now
			marks.forEach((mark, index) => {
				mark.dataset.passed = String(index < now)
			})
		}

		function showQuiz(state: Asked & Pick<QuizState, 'answered'>) {
			caption.textContent = endless
				? `Endless · ${stage} · ${formatWhole(questionsAnswered(state))}`
				: `${stage} · ${formatWhole(questionsAnswered(state))} / ${formatWhole(state.order.length)}`
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
