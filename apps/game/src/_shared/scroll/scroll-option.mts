/**
 * One answer in the answer drawer ([4 Ambush](../../../../../docs/design/screens.md#4-ambush)): the
 * arrow of its mark and the answer in ink on the lined paper. A pick cuts the line in two along a
 * thin red edge, and for `order` the place it was cut in is brushed next to it.
 */

import { component } from '@rooted/components'
import { Markdown } from '@rooted/markdown'
import type { Ambush, AmbushKind, AmbushOption } from '../state/ambush.mts'
import { renderMarkdown } from '../markdown/render.mts'
import { cutOf } from './cut.mts'
import { arrows } from './heading.mts'
import styles from './scroll.css'

export type ScrollOptionOptions = {
	readonly option: AmbushOption
	readonly kind: AmbushKind
	/** The open ambush, to follow the picks; left out for a scroll that no longer changes. */
	readonly ambush?: Ambush
}

export const ScrollOption = component<ScrollOptionOptions>({
	name: 'scroll-option',
	styles,
	onMount({ append, create, element, options, signal }) {
		const { option, kind, ambush } = options
		const cut = cutOf(option.mark)

		// The face is made again for each half of a cut, with the place it was cut in for `order`.
		const faceOf = (place: string) => element('div', {
			classes: styles.face,
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
					children: create(Markdown, {
						source: renderMarkdown(option.answer),
						classes: styles.markdown,
					}),
				}),
				element('span', {
					classes: styles.place,
					textContent: place,
				}),
			],
		})
		const line = append(
			element('li', {
				classes: styles.option,
				'data-kind': kind,
				'data-picked': 'false',
			})
		)
		line.style.setProperty('--cut-left', `${cut.left}%`)
		line.style.setProperty('--cut-right', `${cut.right}%`)

		// A cut line: the face, hidden, keeps the line's height; the two halves are copies of it, each
		// clipped to its side of the cut, with the red edge between them.
		const cutLine = (place: string) => [
			faceOf(place),
			element('div', {
				classes: [
					styles.lineHalf,
					styles.lineUpper,
				],
				aria: {
					hidden: 'true',
				},
				children: faceOf(place),
			}),
			element('div', {
				classes: [
					styles.lineHalf,
					styles.lineLower,
				],
				aria: {
					hidden: 'true',
				},
				children: faceOf(place),
			}),
			element('svg', {
				classes: styles.lineCut,
				viewBox: '0 0 100 100',
				preserveAspectRatio: 'none',
				aria: {
					hidden: 'true',
				},
				children: element('svg:line', {
					x1: 0,
					y1: cut.left,
					x2: 100,
					y2: cut.right,
				}),
			}),
		]

		let shown: number | undefined
		const show = (pick: number) => {
			if (pick === shown) return
			shown = pick
			line.replaceChildren(...(pick > 0 ? cutLine(kind === 'order' ? String(pick) : '') : [faceOf('')]))
			line.dataset.picked = String(pick > 0)
		}
		show(option.pick)

		// Once the ambush closes its options are gone; the drawer keeps showing the last picks.
		ambush?.on('change', signal, ({ detail }) => {
			const current = detail.state.options.find((each) => each.mark === option.mark)
			if (current !== undefined) show(current.pick)
		})
	},
})
