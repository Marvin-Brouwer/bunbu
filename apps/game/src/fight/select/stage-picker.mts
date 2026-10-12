/**
 * 2 · Stage: the five stages, one to choose ([2 Fight setup](../../../../../docs/design/screens.md#2-fight-setup)),
 * each with how far the player got on it with the chosen quiz. The stages without a world yet
 * are shown but can't be chosen.
 */

import { component } from '@rooted/components'
import { formatWhole } from '../../_shared/numbers.mts'
import { builtStages, selection, stageNames, stages, type Stage } from '../../_shared/state/selection.mts'
import { stageResults } from '../state/stage-results.mts'
import styles from './select.css'

/** `Best 860 m`, or `Best 1,440 m · cleared`; nothing before the stage was run on this quiz. */
function resultOf(stage: Stage): string | undefined {
	const { quiz } = selection.value
	const result = quiz === undefined ? undefined : stageResults.value.of(quiz.id, quiz.version, stage)
	if (result === undefined) return undefined
	const best = `Best ${formatWhole(result.distance)} m`
	return result.cleared ? `${best} · cleared` : best
}

export const StagePicker = component({
	name: 'stage-picker',
	styles,
	onMount({ append, element }) {
		append(
			element('div', {
				classes: styles.stages,
				role: 'radiogroup',
				aria: {
					label: 'Stage',
				},
				children: stages.map((stage, index) => {
					const result = resultOf(stage)
					return element('label', {
						classes: styles.stage,
						children: [
							element('input', {
								type: 'radio',
								name: 'stage',
								value: stage,
								checked: selection.value.stage === stage,
								disabled: !builtStages.has(stage),
								on: {
									change() {
										selection.value.chooseStage(stage)
									},
								},
							}),
							element('span', {
								classes: styles.stageText,
								children: [
									element('span', {
										children: [
											element('span', {
												classes: styles.stageNumber,
												textContent: `${index + 1} · `,
											}),
											stageNames[stage],
										],
									}),
									result === undefined
										? undefined
										: element('span', {
											classes: styles.stageResult,
											textContent: result,
										}),
								],
							}),
							builtStages.has(stage)
								? undefined
								: element('span', {
									classes: styles.stageSoon,
									textContent: 'soon',
								}),
						],
					})
				}),
			})
		)
	},
})
