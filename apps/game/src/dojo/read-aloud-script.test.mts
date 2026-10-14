// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { pronouncerOf } from '../_shared/speech/line.mts'
import { linesOfBlocks } from './read-aloud-script.mts'

const texts = (blocks: readonly string[], dictionary: Record<string, string> = {}) =>
	linesOfBlocks(blocks, pronouncerOf(dictionary)).map((line) => line.text)

describe('linesOfBlocks', () => {
	it('reads each block in turn, a sentence a line', () => {
		expect(texts(['Orders arrive in bursts. They pile up.', 'Does a queue help?']))
			.toEqual(['Orders arrive in bursts.', 'They pile up.', 'Does a queue help?'])
	})

	it('reads Markdown as its text, without the code blocks', () => {
		expect(texts(['Which **attribute** describes `img`?\n\n```html\n<img src="chart.png">\n```']))
			.toEqual(['Which attribute describes img?'])
	})

	it('says terms as the pronunciations do', () => {
		expect(texts(['The answer is:', 'Use SQL.'], { SQL: 'sequel' })).toEqual(['The answer is:', 'Use sequel.'])
	})
})
