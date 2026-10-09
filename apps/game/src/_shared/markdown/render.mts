/**
 * Quiz Markdown to HTML, at runtime: the player loads the quiz, so it arrives after the build and
 * is untrusted input ([Markdown](../../../../../docs/design/data-format.md#markdown)).
 *
 * GitHub-flavoured Markdown with highlighted code blocks. Raw HTML is escaped, headings come out as
 * bold paragraphs, and images stay `<img>`, so an SVG never ends up inline. DOMPurify goes over
 * the result as well, in case a Markdown rule ever lets something through.
 */

import DOMPurify from 'dompurify'
import highlighter from 'highlight.js/lib/common'
import markdownIt from 'markdown-it'

/** Images may be embedded as `data:` URIs ([media](../../../../../docs/design/data-format.md#media)), SVG included. */
const imageData = /^data:image\/(?:gif|png|jpeg|webp|svg\+xml)[;,]/i
/** Schemes that run code or reach the player's machine. */
const forbiddenScheme = /^(?:javascript|vbscript|file|data):/i

const parser = markdownIt({
	html: false,
	linkify: true,
	typographer: false,
	highlight(code, language) {
		if (language === '' || highlighter.getLanguage(language) === undefined) return ''
		return highlighter.highlight(code, { language, ignoreIllegals: true }).value
	},
})

// The app owns the page structure, so a heading is only text that stands out.
parser.renderer.rules.heading_open = () => '<p><strong>'
parser.renderer.rules.heading_close = () => '</strong></p>\n'

// markdown-it allows only a few `data:` image types; SVG is safe as an `<img>`. DOMPurify drops a
// `data:` URI from anything that is not an image, so a link can't use this.
parser.validateLink = (url) => {
	const trimmed = url.trim()
	return imageData.test(trimmed) || !forbiddenScheme.test(trimmed)
}

let purifierReady = false

/** Links leave the game in a new tab, without handing it the game's window. */
function preparePurifier(): void {
	if (purifierReady) return
	purifierReady = true
	DOMPurify.addHook('afterSanitizeAttributes', (node) => {
		if (node.tagName !== 'A') return
		node.setAttribute('target', '_blank')
		node.setAttribute('rel', 'noopener noreferrer')
	})
}

/** Renders quiz Markdown to sanitised HTML, ready to append. */
export function renderMarkdown(source: string): DocumentFragment {
	preparePurifier()
	return DOMPurify.sanitize(parser.render(source), {
		USE_PROFILES: { html: true },
		ADD_ATTR: ['target'],
		RETURN_DOM_FRAGMENT: true,
	})
}
