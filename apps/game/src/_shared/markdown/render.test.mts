// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './render.mts'

const html = (source: string) => {
	const container = document.createElement('div')
	container.append(renderMarkdown(source))
	return container.innerHTML
}

describe('renderMarkdown', () => {
	it('renders GitHub-flavoured Markdown', () => {
		expect(html('Is `PUT` **idempotent**?')).toBe('<p>Is <code>PUT</code> <strong>idempotent</strong>?</p>\n')
		expect(html('~~gone~~')).toContain('<s>gone</s>')
		expect(html('| a | b |\n| - | - |\n| 1 | 2 |')).toContain('<table>')
	})

	it('highlights fenced code with a known language', () => {
		const code = html('```js\nconst answer = 42\n```')
		expect(code).toContain('<pre><code class="language-js">')
		expect(code).toContain('<span class="hljs-keyword">const</span>')
	})

	it('escapes fenced code with an unknown language', () => {
		expect(html('```nope\n<b>x</b>\n```')).toContain('&lt;b&gt;x&lt;/b&gt;')
	})

	it('escapes raw HTML', () => {
		expect(html('<script>alert(1)</script>')).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>\n')
		expect(html('<img src=x onerror=alert(1)>')).not.toContain('<img')
		expect(html('<svg onload=alert(1)></svg>')).not.toContain('<svg')
	})

	it('turns headings into bold paragraphs', () => {
		expect(html('# Title')).toBe('<p><strong>Title</strong></p>\n')
		expect(html('Title\n=====')).toBe('<p><strong>Title</strong></p>\n')
	})

	it('drops links that run code', () => {
		expect(html('[click](javascript:alert(1))')).not.toContain('<a')
		expect(html('[click](vbscript:msgbox)')).not.toContain('<a')
		expect(html('[click](data:text/html;base64,PHNjcmlwdD4=)')).not.toContain('href')
		expect(html('[svg](data:image/svg+xml;base64,PHN2Zz4=)')).not.toContain('href')
	})

	it('opens links in a new tab', () => {
		expect(html('[spec](https://example.com/)')).toBe(
			'<p><a href="https://example.com/" target="_blank" rel="noopener noreferrer">spec</a></p>\n'
		)
	})

	it('keeps images as images, data URIs included', () => {
		expect(html('![Box model](https://example.com/box.svg)')).toBe('<p><img src="https://example.com/box.svg" alt="Box model"></p>\n')
		expect(html('![Box model](data:image/svg+xml;base64,PHN2Zz4=)')).toContain('<img src="data:image/svg+xml;base64,PHN2Zz4="')
		expect(html('![Box model](data:image/png;base64,iVBORw0KGgo=)')).toContain('<img src="data:image/png;base64,iVBORw0KGgo="')
		expect(html('![Box model](data:image/svg+xml,%3Csvg%3E%3C/svg%3E)')).toContain('<img src="data:image/svg+xml,%3Csvg%3E%3C/svg%3E"')
	})
})
