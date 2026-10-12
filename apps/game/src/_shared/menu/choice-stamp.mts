/**
 * The 選 ("chosen") stamp on a choice, as a stage or a quiz: the hanko of the answer drawer,
 * slapped on the top left corner once the choice is chosen. Put it after the choice's radio.
 */

import { component } from '@rooted/components'
import { Hanko } from '../scroll/hanko.mts'
import styles from './menu.css'

export const ChoiceStamp = component({
	name: 'choice-stamp',
	styles,
	onMount({ append, create, element }) {
		append(
			element('span', {
				classes: styles.choiceStamp,
				lang: 'ja',
				children: create(Hanko, {
					character: '選',
				}),
			})
		)
	},
})
