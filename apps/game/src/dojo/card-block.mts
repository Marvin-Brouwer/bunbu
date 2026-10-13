/**
 * One block of a study card: quiz Markdown, set like the text on the ambush scroll (code blocks,
 * lists, tables), in an element of its own so the spoken word can be found in it.
 */

import { component, type CssClass } from '@rooted/components'
import { Markdown } from '@rooted/markdown'
import { renderMarkdown } from '../_shared/markdown/render.mts'
import styles from '../_shared/scroll/scroll.css'

export type CardBlockOptions = {
	readonly source: string
	readonly classes: CssClass
}

export const CardBlock = component<CardBlockOptions>({
	name: 'card-block',
	styles,
	onMount({ append, create, element, options }) {
		append(
			element('div', {
				classes: options.classes,
				children: create(Markdown, {
					source: renderMarkdown(options.source),
					classes: styles.markdown,
				}),
			})
		)
	},
})
