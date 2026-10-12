import type { Markdown } from '@bunbu/data'
import { describe, expect, it } from 'vitest'
import { pronouncerOf, shownWordAt } from '../_shared/speech/line.mts'
import { studyCardOf } from './state/study-card.mts'
import { blocksOf, linesOf } from './study-script.mts'

const md = (text: string) => text as Markdown

describe('the study script', () => {
	const card = studyCardOf({
		type: 'solutions',
		scenario: md('Orders arrive in bursts. They pile up.'),
		query: md('Does it help?'),
		options: [{ answer: md('Add a SQL queue'), correct: true }],
	})
	// The text of each block as read aloud, as the page gives it: with the space between blocks.
	const texts = ['Orders arrive in bursts. They pile up.\n\n', 'Does it help?\n\n', 'Add a SQL queue\n\n', 'Yes\n\n']
	const lines = linesOf(card, texts, pronouncerOf({ SQL: 'sequel' }))

	it('numbers the blocks as they are shown: asked, then each prompt and answer', () => {
		expect(blocksOf(card)).toEqual(['Orders arrive in bursts. They pile up.', 'Does it help?', 'Add a SQL queue', 'Yes'])
	})

	it('reads each sentence of what is asked, then each answer with its lead', () => {
		expect(lines.map((line) => line.text)).toEqual([
			'Orders arrive in bursts.',
			'They pile up.',
			'Does it help?',
			'Solution 1: Add a sequel queue Yes',
		])
	})

	it('finds the spoken word in its block', () => {
		const answer = lines[3]!
		expect(shownWordAt(answer, answer.text.indexOf('sequel'))).toEqual({ block: 2, start: 6, end: 9 })
		expect(shownWordAt(answer, answer.text.indexOf('Yes'))).toEqual({ block: 3, start: 0, end: 3 })
		const second = lines[1]!
		expect(shownWordAt(second, second.text.indexOf('pile'))).toEqual({ block: 0, start: 30, end: 34 })
	})

	it('reads only the lead for an answer that is a code block', () => {
		const code = studyCardOf({ type: 'single', query: md('Which?'), options: [{ answer: md('```\nx\n```'), correct: true }] })
		expect(linesOf(code, ['Which?\n\n', ''], pronouncerOf({})).map((line) => line.text)).toEqual(['Which?', 'The answer is'])
	})
})
