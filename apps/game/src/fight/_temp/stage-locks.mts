/**
 * Dev only, on the fight setup: one button that unlocks every stage of the chosen quiz, and
 * endless with them (each cleared on Shogun), or, once they are all open, locks them all again, so
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
	onMount({ create, element, options, replace, signal }) {
		const { id, version } = options.quiz
		const allOpen = () => stages.every((stage) => stageResults.value.unlocked(id, version, stage)) && stageResults.value.endlessUnlocked(id, version)

		const unlockAll = () => {
			// A cleared result keeps the best distance there was; a new one counts as no distance.
			for (const stage of stages) {
				const distance = stageResults.value.of(id, version, stage)?.distance ?? 0
				stageResults.value.submit(id, version, stage, { distance, cleared: true, shogun: true })
			}
		}

		const show = () => replace(
			element('div', {
				classes: styles.stageLocks,
				children: allOpen()
					? create(MenuButton, {
						label: 'Lock all stages',
						note: 'dev · clears the results',
						action: () => { stageResults.value.forget(id, version) },
					})
					: create(MenuButton, {
						label: 'Unlock all stages',
						note: 'dev',
						action: unlockAll,
					}),
			})
		)
		show()

		stageResults.on('change', signal, show)
	},
})
