/**
 * One option on the scroll: its mark, its text, and what the player did with it: `MARKED`, or the
 * place it was swiped in for `order`. With more options than ninjas it also says which ninja carries it.
 */

import { component, optional } from '@rooted/components'
import type { Ambush, AmbushKind, AmbushOption } from '../state/ambush.mts'
import { QuizMarkdown } from '../markdown/quiz-markdown.mts'
import { arrows, ninjaName } from './heading.mts'
import styles from './scroll-option.css'

export type ScrollOptionOptions = {
	readonly option: AmbushOption
	readonly kind: AmbushKind
	/** Whether to say which ninja carries the option. */
	readonly bundled: boolean
	/** The open ambush, to follow the picks; left out for a scroll that no longer changes. */
	readonly ambush?: Ambush
}

export const ScrollOption = component<ScrollOptionOptions>({
	name: 'scroll-option',
	styles,
	onMount({ append, create, element, options, signal }) {
		const { option, kind, bundled, ambush } = options

		const picked = element('span', {
			classes: styles.picked,
		})
		const row = append(
			element('div', {
				classes: styles.option,
				'data-kind': kind,
				children: [
					element('span', {
						classes: styles.mark,
						textContent: arrows[option.mark],
						aria: {
							label: `swipe ${option.mark.replaceAll('-', ' ')}`,
						},
					}),
					element('div', {
						classes: styles.answer,
						children: create(QuizMarkdown, {
							source: option.answer,
						}),
					}),
					element('span', {
						classes: styles.notes,
						children: [
							picked,
							optional(bundled,
								element('span', {
									classes: styles.ninja,
									textContent: `ninja ${ninjaName(option.ninja)}`,
								})
							),
						],
					}),
				],
			})
		)

		const show = (pick: number) => {
			row.dataset.picked = String(pick > 0)
			picked.textContent = pick === 0 ? '' : kind === 'order' ? String(pick) : 'MARKED'
		}
		show(option.pick)

		// Once the ambush closes its options are gone; the scroll keeps showing the last picks.
		ambush?.on('change', signal, ({ detail }) => {
			const current = detail.state.options.find((each) => each.mark === option.mark)
			if (current !== undefined) show(current.pick)
		})
	},
})
