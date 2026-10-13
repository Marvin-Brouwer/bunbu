import { describe, expect, it } from 'vitest'
import { pronouncerOf, sentencesOf, shownWordAt, spokenLine, type SpokenLine } from './line.mts'

const shown = (text: string, block = 0, offset = 0) => ({ shown: text, block, offset })

/** The shown text the engine's word at `spoken` (a word of the line's text) points back to. */
function shownFor(line: SpokenLine, spoken: string, texts: readonly string[]): string | undefined {
	const range = shownWordAt(line, line.text.indexOf(spoken))
	return range === undefined ? undefined : texts[range.block]?.slice(range.start, range.end)
}

describe('pronunciations', () => {
	it('says a term as the dictionary has it, and only whole, case-sensitive words', () => {
		const pronouncer = pronouncerOf({ SQL: 'sequel' })
		expect(spokenLine([shown('SQL, MySQLi and sql')], pronouncer).text).toBe('sequel, MySQLi and sql')
	})

	it('matches a longer term before a shorter one', () => {
		const pronouncer = pronouncerOf({ HTTP: 'H T T P', 'HTTP/2': 'H T T P two' })
		expect(spokenLine([shown('Use HTTP/2 over HTTP')], pronouncer).text).toBe('Use H T T P two over H T T P')
	})

	it('matches terms that end in a sign', () => {
		const pronouncer = pronouncerOf({ 'C#': 'C sharp' })
		expect(spokenLine([shown('C# and F#')], pronouncer).text).toBe('C sharp and F#')
	})

	it('reads as written without a dictionary', () => {
		expect(spokenLine([shown('Plain text')], pronouncerOf({})).text).toBe('Plain text')
	})
})

describe('the spoken word on screen', () => {
	const texts = ['Which SQL keyword sorts?', 'ORDER BY.']
	const line = spokenLine([
		shown(texts[0]!, 0),
		{ said: 'The answer is' },
		shown(texts[1]!, 1),
	], pronouncerOf({ SQL: 'sequel' }))

	it('puts a space between the pieces', () => {
		expect(line.text).toBe('Which sequel keyword sorts? The answer is ORDER BY.')
	})

	it('finds a word as written', () => {
		expect(shownFor(line, 'keyword', texts)).toBe('keyword')
		expect(shownFor(line, 'ORDER', texts)).toBe('ORDER')
	})

	it('leaves closing marks out', () => {
		expect(shownFor(line, 'sorts?', texts)).toBe('sorts')
		expect(shownFor(line, 'BY.', texts)).toBe('BY')
	})

	it('finds a replaced term as the written term as a whole', () => {
		expect(shownFor(line, 'sequel', texts)).toBe('SQL')
	})

	it('has nothing to show for words that are only said', () => {
		expect(shownFor(line, 'answer', texts)).toBeUndefined()
	})

	it('uses the length the engine gives, without closing marks', () => {
		const at = line.text.indexOf('ORDER')
		expect(shownWordAt(line, at, 'ORDER BY'.length)).toEqual({ block: 1, start: 0, end: 8 })
		expect(shownWordAt(line, at, 'ORDER BY.'.length)).toEqual({ block: 1, start: 0, end: 8 })
	})

	it('maps pieces that start inside their block', () => {
		const sentence = spokenLine([shown('second one.', 2, 10)], pronouncerOf({}))
		expect(shownWordAt(sentence, 7)).toEqual({ block: 2, start: 17, end: 20 })
	})
})

describe('sentences', () => {
	it('splits on sentence ends and empty lines, without the space around', () => {
		const text = 'One. Two? Three\n\nFour…  five\nsix'
		expect(sentencesOf(text).map(({ start, end }) => text.slice(start, end))).toEqual(['One.', 'Two?', 'Three', 'Four…', 'five\nsix'])
	})

	it('keeps a dot inside a word', () => {
		const text = 'Use node.js here.'
		expect(sentencesOf(text).map(({ start, end }) => text.slice(start, end))).toEqual(['Use node.js here.'])
	})
})
