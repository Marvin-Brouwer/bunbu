// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { readableMarkdown, readableText } from './readable.mts'

const rendered = (html: string) => {
	const host = document.createElement('div')
	host.innerHTML = html
	return host
}

describe('readable text', () => {
	it('reads inline code, skips code blocks and keeps blocks apart', () => {
		const text = readableText(rendered('<p>Use <code>alt</code>:</p><pre><code>&lt;img&gt;</code></pre><p>Which one?</p>')).text
		expect(text).toBe('Use alt:\n\nWhich one?\n\n')
	})

	it('reads an image by its alt text', () => {
		expect(readableText(rendered('<p>See <img src="x.png" alt="the box model"></p>')).text).toBe('See  the box model \n\n')
	})

	it('finds a range back on the page, across elements', () => {
		const host = rendered('<p>The <strong>alt</strong> attribute</p>')
		const readable = readableText(host)
		const start = readable.text.indexOf('alt')
		expect(readable.rangeOf(start, start + 3)?.toString()).toBe('alt')
		expect(readable.rangeOf(0, readable.text.indexOf(' attribute'))?.toString()).toBe('The alt')
	})

	it('has no range for what has no text on the page', () => {
		const readable = readableText(rendered('<p><img src="x.png" alt="diagram"></p>'))
		expect(readable.rangeOf(1, 8)).toBeUndefined()
	})

	it('gives the same text for Markdown that is not on the page yet', () => {
		const source = 'Which **SQL** keyword?\n\n```sql\nSELECT 1\n```\n\nPick one.'
		expect(readableMarkdown(source)).toBe('Which SQL keyword?\n\nPick one.\n\n')
	})
})
