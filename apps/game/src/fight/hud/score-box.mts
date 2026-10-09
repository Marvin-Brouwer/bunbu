/**
 * The score with the best to beat under it ([3 Running](../../../../../docs/design/screens.md#3-running)),
 * and `+100` rising out of it on every correct answer ([5A](../../../../../docs/design/screens.md#5-outcome)).
 */

import { component } from '@rooted/components'
import { pointsPerCorrect, type Score, type ScoreState } from '../state/score.mts'
import { formatWhole } from '../../_shared/numbers.mts'
import styles from './hud.css'

export type ScoreBoxOptions = {
	readonly score: Score
}

export const ScoreBox = component<ScoreBoxOptions>({
	name: 'score-box',
	styles,
	onMount({ append, element, options, signal }) {
		const { score } = options

		const points = element('span', {
			classes: styles.points,
		})
		const best = element('span', {
			classes: styles.best,
		})
		const box = append(
			element('div', {
				classes: [
					styles.panel,
					styles.score,
				],
				aria: {
					live: 'polite',
				},
				children: [
					element('span', {
						classes: styles.label,
						textContent: 'SCORE',
					}),
					points,
					best,
				],
			})
		)

		const show = (state: ScoreState) => {
			points.textContent = formatWhole(state.points)
			best.textContent = state.best === undefined ? '' : `best ${formatWhole(state.best.points)}`
		}

		const pop = () => {
			box.append(
				element('span', {
					classes: styles.pop,
					textContent: `+${pointsPerCorrect}`,
					aria: {
						hidden: 'true',
					},
					on: {
						animationend(event) {
							event.currentTarget.remove()
						},
					},
				})
			)
		}

		let correct = score.value.correct
		show(score.value)
		score.on('change', signal, ({ detail }) => {
			show(detail.state)
			if (detail.state.correct > correct) pop()
			correct = detail.state.correct
		})
	},
})
