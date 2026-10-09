/**
 * The life bar: full is 100%, empty is the quiz's pass mark
 * ([life bar](../../../../../docs/design/gameplay.md#life-bar)). On a miss the chunk it lost flashes
 * and drops off the bar ([5B](../../../../../docs/design/screens.md#5-outcome)).
 */

import { component } from '@rooted/components'
import type { Quiz } from '../../_shared/state/quiz.mts'
import type { Life, LifeState } from '../state/life.mts'
import styles from './hud.css'

export type LifeBarOptions = {
	readonly life: Life
	readonly quiz: Quiz
}

export const LifeBar = component<LifeBarOptions>({
	name: 'life-bar',
	styles,
	onMount({ append, element, options, signal }) {
		const { life, quiz } = options

		const passingScore = quiz.value.quiz?.passingScore
		const bar = element('div', {
			classes: styles.bar,
			role: 'meter',
			aria: {
				label: 'Life',
				valueMin: '0',
				valueMax: '100',
			},
			children: element('div', {
				classes: styles.fill,
			}),
		})
		append(
			element('div', {
				classes: styles.life,
				children: [
					element('div', {
						classes: styles.caption,
						children: [
							element('span', {
								classes: styles.label,
								textContent: 'LIFE',
							}),
							element('span', {
								classes: styles.label,
								textContent: passingScore === undefined ? '' : `empty = ${passingScore}%`,
							}),
						],
					}),
					bar,
				],
			})
		)

		const show = (state: LifeState) => {
			bar.style.setProperty('--life', String(state.value))
			bar.setAttribute('aria-valuenow', String(Math.round(state.value * 100)))
		}

		// The lost chunk sits where the bar ends now and is as wide as the share the miss took.
		const dropChunk = (state: LifeState) => {
			bar.append(
				element('div', {
					classes: styles.lost,
					style: {
						left: `${state.value * 100}%`,
						width: `${Math.min(state.lastLoss, 1 - state.value) * 100}%`,
					},
					on: {
						animationend(event) {
							event.currentTarget.remove()
						},
					},
				})
			)
		}

		let hits = life.value.hits
		show(life.value)
		life.on('change', signal, ({ detail }) => {
			show(detail.state)
			if (detail.state.hits > hits) dropChunk(detail.state)
			hits = detail.state.hits
		})
	},
})
