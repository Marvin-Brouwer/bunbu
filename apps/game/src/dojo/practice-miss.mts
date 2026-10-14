/**
 * D5 Practice miss ([screens.md](../../../../docs/design/screens.md#d5-practice-miss)): the scroll
 * of the question just missed, `PRACTICE · MISSED`, with ✓ next to the right answer and ✗ next to
 * the wrong pick, then the explanation and read out loud. Meanwhile the dummy swings back in the
 * world. **Continue** moves on.
 */

import { resolvePronunciations, type BunbuData, type Markdown as MarkdownText } from '@bunbu/data'
import { component } from '@rooted/components'
import { Markdown } from '@rooted/markdown'
import { renderMarkdown } from '../_shared/markdown/render.mts'
import { MenuButton } from '../_shared/menu/menu-button.mts'
import { arrows } from '../_shared/scroll/heading.mts'
import scrollStyles from '../_shared/scroll/scroll.css'
import { ScrollSheet } from '../_shared/scroll/scroll-sheet.mts'
import { reviewOf } from '../_shared/state/review.mts'
import { ReadAloud } from './read-aloud.mts'
import { answerBlocksOf, verdictOf } from './state/miss.mts'
import type { Miss } from './state/practice.mts'
import styles from './practice.css'

/** What the miss screen reads aloud: "The answer is …", then the explanations. */
export function missBlocksOf(quiz: BunbuData, miss: Miss): string[] {
	return [...answerBlocksOf(miss.ambush), ...reviewOf(quiz, miss.record)?.explanations ?? []]
}

const markdownOf = (source: MarkdownText | string) => ({
	source: renderMarkdown(source),
	classes: scrollStyles.markdown,
})

export type PracticeMissOptions = {
	readonly quiz: BunbuData
	readonly miss: Miss
	readonly carryOn: () => void
}

export const PracticeMiss = component<PracticeMissOptions>({
	name: 'practice-miss',
	styles,
	onMount({ append, create, element, options }) {
		const { quiz, miss } = options
		const { ambush } = miss
		const explanations = reviewOf(quiz, miss.record)?.explanations ?? []

		append(
			create(ScrollSheet, {
				fill: true,
				unroll: true,
				children: [
					element('p', {
						classes: scrollStyles.heading,
						textContent: 'PRACTICE · MISSED',
					}),
					element('div', {
						classes: scrollStyles.query,
						children: create(Markdown, markdownOf(ambush.query)),
					}),
					element('ul', {
						classes: styles.missOptions,
						children: ambush.options.map((option) => {
							const verdict = verdictOf(ambush.kind, option)
							return element('li', {
								classes: styles.missOption,
								'data-verdict': verdict === undefined ? 'none' : verdict.sign === '✓' ? 'right' : 'wrong',
								children: [
									element('span', {
										classes: styles.missMark,
										textContent: arrows[option.mark],
										aria: {
											hidden: 'true',
										},
									}),
									element('div', {
										classes: styles.missAnswer,
										children: create(Markdown, markdownOf(option.answer)),
									}),
									verdict === undefined
										? undefined
										: element('span', {
											classes: styles.missVerdict,
											textContent: `${verdict.sign} ${verdict.text}`,
										}),
								],
							})
						}),
					}),
					...explanations.map((explanation) => element('div', {
						classes: styles.explanation,
						children: create(Markdown, markdownOf(explanation)),
					})),
					create(ReadAloud, {
						language: quiz.language,
						pronunciations: resolvePronunciations(quiz),
						blocks: () => missBlocksOf(quiz, miss),
					}),
				],
				footer: element('div', {
					classes: styles.actions,
					children: create(MenuButton, {
						kind: 'primary',
						label: 'Continue',
						action: options.carryOn,
					}),
				}),
			})
		)
	},
})
