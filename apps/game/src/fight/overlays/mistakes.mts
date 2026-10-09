/**
 * The mistakes on the results scroll ([7 Finished](../../../../../docs/design/screens.md#7-finished-results-and-mistakes),
 * [8 Fallen](../../../../../docs/design/screens.md#8-fallen)): each missed ambush with ✗ the pick,
 * ✓ the right answer, the explanations and the references. On the fallen screen the entries start
 * closed, a tap opens one.
 */

import type { BunbuData, Markdown as MarkdownText } from '@bunbu/data'
import { component } from '@rooted/components'
import { Markdown } from '@rooted/markdown'
import { renderMarkdown } from '../../_shared/markdown/render.mts'
import type { AnswerRecord } from '../../_shared/state/quiz.mts'
import { reviewOf, type Review } from './review.mts'
import styles from './mistakes.css'

export type MistakesOptions = {
	readonly title: string
	readonly quiz: BunbuData
	readonly misses: readonly AnswerRecord[]
	/** Whether the entries start open, explanations and all. */
	readonly open: boolean
}

export type MistakeAnswerOptions = {
	readonly kind: 'picked' | 'right'
	readonly choices: readonly MarkdownText[]
	readonly ordered: boolean
}

/** `✗ title` or `✓ alt`: one side of what was answered. */
export const MistakeAnswer = component<MistakeAnswerOptions>({
	name: 'mistake-answer',
	styles,
	onMount({ append, create, element, options }) {
		const { kind, choices } = options
		append(
			element('span', {
				classes: styles.side,
				'data-kind': kind,
				'data-ordered': String(options.ordered),
				children: [
					element('span', {
						classes: styles.sign,
						textContent: kind === 'picked' ? '✗' : '✓',
						aria: {
							label: kind === 'picked' ? 'your answer' : 'right answer',
						},
					}),
					element('span', {
						classes: styles.choices,
						children: choices.length === 0
							? 'no answer, time ran out'
							: choices.map((choice) => element('span', {
								classes: styles.choice,
								children: create(Markdown, {
									source: renderMarkdown(choice),
									tag: 'span',
								}),
							})),
					}),
				],
			})
		)
	},
})

export type MistakeOptions = {
	readonly review: Review
	readonly open: boolean
}

export const Mistake = component<MistakeOptions>({
	name: 'mistake',
	styles,
	onMount({ append, create, element, options }) {
		const { review } = options
		append(
			element('details', {
				classes: styles.entry,
				open: options.open,
				children: [
					element('summary', {
						children: [
							...review.asked.map((text) => create(Markdown, {
								source: renderMarkdown(text),
								classes: styles.prose,
							})),
							element('span', {
								classes: styles.answers,
								children: [
									create(MistakeAnswer, {
										kind: 'picked',
										choices: review.picked,
										ordered: review.ordered,
									}),
									create(MistakeAnswer, {
										kind: 'right',
										choices: review.right,
										ordered: review.ordered,
									}),
								],
							}),
						],
					}),
					element('div', {
						classes: styles.details,
						children: [
							...review.explanations.map((text) => create(Markdown, {
								source: renderMarkdown(text),
								classes: styles.prose,
							})),
							review.references.length === 0
								? undefined
								: element('ul', {
									classes: styles.references,
									children: review.references.map((reference) => element('li', {
										children: element('a', {
											href: reference.url,
											target: '_blank',
											rel: 'noopener noreferrer',
											textContent: reference.text,
										}),
									})),
								}),
						],
					}),
				],
			})
		)
	},
})

export const Mistakes = component<MistakesOptions>({
	name: 'mistakes',
	styles,
	onMount({ append, create, element, options }) {
		const reviews = options.misses.flatMap((miss) => reviewOf(options.quiz, miss) ?? [])

		append(
			element('section', {
				classes: styles.mistakes,
				children: [
					element('div', {
						classes: styles.top,
						children: [
							element('h2', {
								classes: styles.title,
								textContent: `${options.title} (${reviews.length})`,
							}),
							reviews.length === 0 || options.open
								? undefined
								: element('span', {
									classes: styles.hint,
									textContent: 'tap to expand',
								}),
						],
					}),
					...reviews.length === 0
						? [element('p', {
							classes: styles.none,
							textContent: 'Not one. A clean run.',
						})]
						: reviews.map((review) => create(Mistake, {
							review,
							open: options.open,
						})),
				],
			})
		)
	},
})
