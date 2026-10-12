/**
 * The answers on the paper of the answer drawer
 * ([4 Ambush](../../../../../docs/design/screens.md#4-ambush)): a brush-lettered line on how to
 * answer, then each option on its own line. The swipe zone puts it under the player's finger; a
 * scroll that no longer changes shows it on its own.
 */

import { component } from '@rooted/components'
import type { Ambush, AmbushState } from '../state/ambush.mts'
import { ScrollOption } from '../scroll/scroll-option.mts'
import { hintOf } from './hint.mts'
import styles from './swipe.css'

export type AnswerSheetOptions = {
	/** The ambush as it was when the scroll opened. */
	readonly state: AmbushState
	/** The open ambush, to follow the picks; left out for a sheet that no longer changes. */
	readonly ambush?: Ambush
}

export const AnswerSheet = component<AnswerSheetOptions>({
	name: 'answer-sheet',
	styles,
	onMount({ append, create, element, options }) {
		const { state, ambush } = options

		append(
			element('p', {
				classes: styles.hint,
				textContent: hintOf(state),
			})
		)
		append(
			element('ul', {
				classes: styles.answers,
				children: state.options.map((option) => create(ScrollOption, {
					option,
					kind: state.kind,
					ambush,
				})),
			})
		)
	},
})
