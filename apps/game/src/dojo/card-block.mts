/**
 * One block of a study card: quiz Markdown, set like the text on the ambush scroll (code blocks,
 * lists, tables), in an element of its own so what is being said can be found in it.
 *
 * The block marks what is being said in its own text: it follows the reading and adds its part of
 * the spoken ranges to the page's highlight, and takes them out again when it goes. Its text is
 * there as it mounts, so a line that starts as the card is drawn is marked straight away.
 */

import { component, type CssClass } from '@rooted/components'
import { renderMarkdown } from '../_shared/markdown/render.mts'
import styles from '../_shared/scroll/scroll.css'
import { readableText } from '../_shared/speech/readable.mts'
import type { Reading } from './state/study.mts'

export type CardBlockOptions = {
	readonly source: string
	readonly classes: CssClass
	/** The block's number on the card, as the spoken ranges count them. */
	readonly block: number
	readonly reading: Reading
	/** The page's highlight of what is being said; `undefined` where the browser can't mark text. */
	readonly highlight: Highlight | undefined
}

export const CardBlock = component<CardBlockOptions>({
	name: 'card-block',
	styles,
	onMount({ append, element, options, signal }) {
		const { block, reading, highlight } = options
		const host = element('div', {
			classes: options.classes,
			children: element('div', {
				classes: styles.markdown,
				// Sanitised by renderMarkdown. Set here rather than through Rooted's Markdown, so the
				// text is there as the block mounts.
				innerHTML: renderMarkdown(options.source),
			}),
		})
		append(host)
		if (highlight === undefined) return

		const readable = readableText(host)
		let said: Reading['value']['said'] = []
		let marked: Range[] = []
		const mark = (next: Reading['value']['said']) => {
			if (next === said) return
			said = next
			for (const range of marked) highlight.delete(range)
			marked = next
				.filter((range) => range.block === block)
				.flatMap(({ start, end }) => readable.rangeOf(start, end) ?? [])
			for (const range of marked) highlight.add(range)
		}
		reading.on('change', signal, ({ detail }) => { mark(detail.state.said) })
		signal.addEventListener('abort', () => { mark([]) }, { once: true })
		mark(reading.value.said)
	},
})
