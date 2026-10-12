/**
 * The text of rendered quiz Markdown as it is read aloud, and the way from a character range of
 * it back to the page, to highlight the spoken word.
 *
 * Code blocks are skipped, as the [data format](../../../../../docs/design/data-format.md#pronunciations)
 * says; inline code is read. An image is read by its alt text. Blocks (paragraphs, list items) are
 * kept apart by an empty line, so their sentences don't run together.
 *
 * The same walk gives the same text for the same HTML, so text taken from Markdown that isn't on
 * screen yet ({@link readableMarkdown}) lines up with the page once it is.
 */

import { renderMarkdown } from '../markdown/render.mts'

type Run = {
	readonly start: number
	readonly text: string
	/** The text node it is on screen; an image's alt text and the breaks have none. */
	readonly node: Text | undefined
}

export type Readable = {
	readonly text: string
	/** The range on the page of `start` up to `end`, or `undefined` where there is no text to mark. */
	readonly rangeOf: (start: number, end: number) => Range | undefined
}

const blocks = new Set(['P', 'LI', 'BLOCKQUOTE', 'DIV', 'TR', 'TD', 'TH', 'UL', 'OL', 'TABLE', 'BR', 'HR'])
const skipped = new Set(['PRE', 'SCRIPT', 'STYLE', 'TEMPLATE'])

/** The text of `root` as it is read aloud. */
export function readableText(root: Node): Readable {
	const runs: Run[] = []
	let text = ''
	const push = (part: string, node: Text | undefined) => {
		if (part === '') return
		runs.push({ start: text.length, text: part, node })
		text += part
	}
	const breakBlock = () => {
		if (text === '' || text.endsWith('\n\n')) return
		push(text.endsWith('\n') ? '\n' : '\n\n', undefined)
	}

	const walk = (node: Node) => {
		if (node instanceof Text) {
			// The line breaks between blocks in the HTML; the blocks are kept apart already.
			const between = node.data.trim() === '' && (text === '' || text.endsWith('\n'))
			if (!between) push(node.data, node)
			return
		}
		if (!(node instanceof Element) || skipped.has(node.tagName)) return
		if (node.tagName === 'IMG') {
			const alt = node.getAttribute('alt')?.trim() ?? ''
			if (alt !== '') push(` ${alt} `, undefined)
			return
		}
		const block = blocks.has(node.tagName)
		if (block) breakBlock()
		for (const child of node.childNodes) walk(child)
		if (block) breakBlock()
	}
	for (const child of root.childNodes) walk(child)

	const runAt = (index: number) => runs.find((run) => index >= run.start && index < run.start + run.text.length)

	return {
		text,
		rangeOf(start, end) {
			const first = runAt(start)
			const last = runAt(end - 1)
			if (first?.node === undefined || last?.node === undefined) return undefined
			const range = new Range()
			range.setStart(first.node, start - first.start)
			range.setEnd(last.node, end - last.start)
			return range
		},
	}
}

/** The text of quiz Markdown as it is read aloud, without putting it on the page. */
export function readableMarkdown(source: string): string {
	// A template's content is inert: images in it don't load.
	const template = document.createElement('template')
	template.innerHTML = renderMarkdown(source)
	return readableText(template.content).text
}
