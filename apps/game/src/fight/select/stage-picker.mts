/**
 * 2 · Stage: the five stages, one to choose ([2 Fight setup](../../../../../docs/design/screens.md#2-fight-setup)),
 * each with how far the player got on it with the chosen quiz. A stage that is still locked on the
 * chosen quiz ([stages](../../../../../docs/design/gameplay.md#stages)) has a lock over its number and
 * says which stage unlocks it. The stages without a world yet are shown but can't be chosen.
 */

import { component } from '@rooted/components'
import { ChoiceStamp } from '../../_shared/menu/choice-stamp.mts'
import { formatWhole } from '../../_shared/numbers.mts'
import { builtStages, selection, stageNames, stages, type Stage } from '../../_shared/state/selection.mts'
import { stageBefore, stageResults } from '../state/stage-results.mts'
import styles from './select.css'

/** Whether the stage is open on the chosen quiz. */
function unlocked(stage: Stage): boolean {
	const { quiz } = selection.value
	return quiz === undefined || stageResults.value.unlocked(quiz.id, quiz.version, stage)
}

/**
 * `Best 860 m`, or `Best 1,440 m · cleared`; nothing before the stage was run on this quiz.
 * `Clear Rice fields to unlock` while it is locked.
 */
function resultOf(stage: Stage): string | undefined {
	const before = stageBefore(stage)
	if (!unlocked(stage) && before !== undefined) return `Clear ${stageNames[before]} to unlock`
	const { quiz } = selection.value
	const result = quiz === undefined ? undefined : stageResults.value.of(quiz.id, quiz.version, stage)
	if (result === undefined) return undefined
	const best = `Best ${formatWhole(result.distance)} m`
	return result.cleared ? `${best} · cleared` : best
}

export const StagePicker = component({
	name: 'stage-picker',
	styles,
	onMount({ append, create, element }) {
		append(
			element('div', {
				classes: styles.stages,
				role: 'radiogroup',
				aria: {
					label: 'Stage',
				},
				children: stages.map((stage, index) => {
					const result = resultOf(stage)
					const locked = !unlocked(stage)
					return element('label', {
						classes: styles.stage,
						'data-locked': String(locked),
						children: [
							element('input', {
								type: 'radio',
								name: 'stage',
								value: stage,
								checked: selection.value.stage === stage,
								disabled: locked || !builtStages.has(stage),
								on: {
									change() {
										selection.value.chooseStage(stage)
									},
								},
							}),
							create(ChoiceStamp),
							element('span', {
								classes: styles.stageText,
								children: [
									element('span', {
										children: [
											element('span', {
												classes: styles.stageNumber,
												children: [
													element('span', {
														classes: styles.stageDigit,
														children: [
															`${index + 1}`,
															locked
																? element('span', {
																	classes: styles.stageLock,
																	aria: {
																		hidden: 'true',
																	},
																})
																: undefined,
														],
													}),
													' · ',
												],
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
