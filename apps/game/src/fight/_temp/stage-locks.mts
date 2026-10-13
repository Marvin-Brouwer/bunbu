/**
 * Dev only, on the fight setup: unlocks every stage of the chosen quiz, or locks them all again, so
 * the stage picker and the runs after it can be tried without passing every stage first.
 */

import type { BunbuData } from '@bunbu/data'
import { component } from '@rooted/components'
import { MenuButton } from '../../_shared/menu/menu-button.mts'
import { stages } from '../../_shared/state/selection.mts'
import { stageResults } from '../state/stage-results.mts'
import styles from '../select/select.css'

export type StageLocksOptions = {
	readonly quiz: BunbuData
}

export const StageLocks = component<StageLocksOptions>({
	name: 'stage-locks',
	styles,
	onMount({ append, create, element, options }) {
		const { id, version } = options.quiz

		append(
			element('div', {
				classes: styles.stageLocks,
				children: [
					create(MenuButton, {
						label: 'Unlock all',
						note: 'dev',
						action: () => {
							// A cleared result keeps the best distance there was; a new one counts as no distance.
							for (const stage of stages) {
								const distance = stageResults.value.of(id, version, stage)?.distance ?? 0
								stageResults.value.submit(id, version, stage, { distance, cleared: true })
							}
						},
					}),
					create(MenuButton, {
						label: 'Lock all',
						note: 'dev · clears the results',
						action: () => {
							stageResults.value.forget(id, version)
						},
					}),
				],
			})
		)
	},
})
