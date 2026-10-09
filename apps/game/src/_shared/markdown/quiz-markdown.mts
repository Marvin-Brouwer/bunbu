/**
 * A piece of quiz Markdown on the page: a query, an option, an explanation. Renders once, from
 * the source it is created with; for new text, create a new one.
 */

import { component } from '@rooted/components'
import { renderMarkdown } from './render.mts'
import styles from './quiz-markdown.css'

export type QuizMarkdownOptions = {
	/** The Markdown from the quiz file. Untrusted: it is sanitised before it reaches the page. */
	readonly source: string
}

export const QuizMarkdown = component<QuizMarkdownOptions>({
	name: 'quiz-markdown',
	styles,
	onMount({ append, element, options }) {
		append(
			element('div', {
				classes: styles.markdown,
				children: renderMarkdown(options.source),
			})
		)
	},
})
