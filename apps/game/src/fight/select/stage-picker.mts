/**
 * 2 · Stage: the five stages, one to choose ([2 Fight setup](../../../../../docs/design/screens.md#2-fight-setup)).
 * The stages without a world yet are shown but can't be chosen.
 */

import { component } from '@rooted/components'
import { builtStages, selection, stageNames, stages } from '../../_shared/state/selection.mts'
import styles from './select.css'

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
				children: stages.map((stage, index) => element('label', {
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
							classes: styles.stageNumber,
							textContent: `${index + 1} ·`,
						}),
						stageNames[stage],
						builtStages.has(stage)
							? undefined
							: element('span', {
								classes: styles.stageSoon,
								textContent: 'soon',
							}),
					],
				})),
			})
		)
	},
})
