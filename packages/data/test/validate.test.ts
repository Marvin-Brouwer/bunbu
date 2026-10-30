import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BunbuValidationError, validate, type BunbuData } from '../src'
import { checkData } from '../src/validate'
import type { Metadata } from '../src'

const modeline = '# yaml-language-server: $schema=https://marvin-brouwer.github.io/bunbu/schema/v1.json'
const designDoc = readFileSync(new URL('../../../docs/design/data-format.md', import.meta.url), 'utf8')
const yamlBlocks = [...designDoc.matchAll(/^(`{3,})yaml\n([\s\S]*?)^\1$/gm)].map((match) => match[2]!)

function quiz(questions: string): string {
	return `${modeline}\n\nid: test\ntitle: Test\nversion: 1\nlanguage: en\npassingScore: 70\nquestions:\n${questions}`
}

function indent(text: string): string {
	return text.replace(/^(?=.)/gm, '  ')
}

async function expectValid(text: string): Promise<BunbuData> {
	const result = await validate(text)
	if (result instanceof Error) throw result
	return result
}

async function expectIssues(text: string): Promise<BunbuValidationError> {
	const result = await validate(text)
	expect(result).toBeInstanceOf(BunbuValidationError)
	return result as BunbuValidationError
}

const single = `
  - type: single
    query: >-
      Which is a query language?
    options:
      - correct: true
        answer: SQL
      - correct: false
        answer: HTML
`

describe('validate', () => {
	it('accepts v2 without requiring custom metadata fields', async () => {
		const data = await expectValid(quiz(single).replace('/v1.json', '/v2.json'))
		expect(data.metadata).toBeUndefined()
		expect(data.questions[0]!.metadata).toBeUndefined()
	})

	it('preserves arbitrary v2 metadata at quiz and question level', async () => {
		const text = quiz(single)
			.replace('/v1.json', '/v2.json')
			.replace('passingScore: 70', 'passingScore: 70\nmetadata:\n  anotherApp:\n    labels: [one, two]\n    enabled: false\n    value: null')
			.replace('    options:', '    metadata:\n      anyNamespace:\n        anything: 42\n    options:')
		const data = await expectValid(text)
		expect(data.metadata).toEqual({ anotherApp: { labels: ['one', 'two'], enabled: false, value: null } })
		expect(data.questions[0]!.metadata).toEqual({ anyNamespace: { anything: 42 } })
	})

	it('keeps the v1 schema unchanged and rejects metadata in v1', async () => {
		for (const text of [
			`${quiz(single)}metadata: {}\n`,
			quiz(single.replace('    options:', '    metadata: {}\n    options:')),
		]) {
			const error = await expectIssues(text)
			expect(error.issues.some((issue) => issue.message.includes("'metadata'"))).toBe(true)
		}
	})

	it('requires metadata to be an object without requiring a particular namespace', async () => {
		await expectValid(`${quiz(single).replace('/v1.json', '/v2.json')}metadata: {}\n`)
		for (const value of ['null', 'text', '42', '[one, two]']) {
			const error = await expectIssues(`${quiz(single).replace('/v1.json', '/v2.json')}metadata: ${value}\n`)
			expect(error.issues).toContainEqual(expect.objectContaining({ path: '/metadata', message: 'must be object' }))
		}
	})

	it('still rejects unknown top-level fields in v2', async () => {
		const error = await expectIssues(`${quiz(single).replace('/v1.json', '/v2.json')}custom: true\n`)
		expect(error.issues).toContainEqual(expect.objectContaining({ path: '', message: "must not have property 'custom'" }))
	})

	it('rejects cyclic metadata from YAML aliases without throwing', async () => {
		const error = await expectIssues(`${quiz(single).replace('/v1.json', '/v2.json')}metadata: &loop\n  self: *loop\n`)
		expect(error.issues).toContainEqual(expect.objectContaining({ path: '/metadata', message: expect.stringContaining('without cycles') }))
	})

	it.each([1, 2])('returns a validation error when v%s YAML alias conversion exceeds its limit', async (version) => {
		const text = quiz(single).replace('/v1.json', `/v${version}.json`) + 'metadata:\n' +
			'  a: &a [x, x]\n  b: &b [*a, *a]\n  c: &c [*b, *b]\n  d: &d [*c, *c]\n  e: &e [*d, *d]\n  f: &f [*e, *e]\n  g: [*f, *f]\n'
		const error = await expectIssues(text)
		expect(error.issues[0]!.message).toContain('cannot be converted safely')
	})

	it('returns a validation error for deeply nested v2 YAML instead of rejecting', async () => {
		await expectIssues(quiz(single).replace('/v1.json', '/v2.json') + 'metadata: ' + '{child: '.repeat(10_000) + 'null' + '}'.repeat(10_000))
	})

	it('bounds shared-reference expansion before recursive validation or serialization', () => {
		let metadata: Metadata = { value: 'leaf' }
		for (let depth = 0; depth < 18; depth++) metadata = { left: metadata, right: metadata }
		expect(checkData({ metadata }, 2)).toEqual([{ path: '/metadata', message: expect.stringContaining('100000 JSON values') }])
	})

	it('counts repeated Unicode text against the JSON byte budget', () => {
		const shared = { text: '🧭'.repeat(2_100_000) }
		expect(checkData({ metadata: { left: shared, right: shared } }, 2)).toEqual([{ path: '/metadata', message: expect.stringContaining('16777216 bytes') }])
	})

	it('rejects sparse metadata arrays without serializing their missing entries', () => {
		const sparse: null[] = []
		sparse.length = 1_000_000
		expect(checkData({ metadata: { values: sparse } }, 2)[0]!.message).toContain('100000 JSON values')
		sparse.length = 2
		expect(checkData({ metadata: { values: sparse } }, 2)[0]!.message).toContain('JSON-compatible values')
	})

	it('rejects inherited serialization hooks without invoking them', () => {
		let called = false
		const metadata: unknown = Object.create({ toJSON: () => { called = true; return {} } })
		expect(checkData({ metadata }, 2)[0]!.message).toContain('without custom serialization')
		expect(called).toBe(false)
	})

	it('accepts the full example from the design doc', async () => {
		const fullExample = yamlBlocks.find((block) => block.startsWith('# yaml-language-server') && block.includes('questions:'))
		expect(fullExample).toBeDefined()

		const data = await expectValid(fullExample!)
		expect(data.id).toBe('example')
		expect(data.version).toBe('1')
		expect(data.questions[1]!.type).toBe('single')
	})

	it('accepts every question example from the design doc', async () => {
		const questions = yamlBlocks.filter((block) => block.startsWith('- type:'))
		expect(questions.length).toBeGreaterThanOrEqual(6)

		const data = await expectValid(quiz(indent(questions.join(''))))
		expect(new Set(data.questions.map((question) => question.type))).toEqual(
			new Set(['yes-no', 'single', 'multiple', 'order', 'match', 'solutions'])
		)
	})

	it('normalizes a numeric version to a string', async () => {
		const data = await expectValid(quiz(single))
		expect(data.version).toBe('1')
	})

	it('accepts a time per question in hours, minutes and seconds', async () => {
		for (const time of ['45s', '3m', '1m30s', '1h', '1h2m3s']) {
			const data = await expectValid(quiz(single).replace('passingScore: 70', `passingScore: 70\ntimePerQuestion: ${time}`))
			expect(data.timePerQuestion).toBe(time)
		}
	})

	it('rejects a time per question without units, out of order or of no time', async () => {
		for (const time of ['30', '30x', '30s1m', '0s', '0m0s', '1.5m', "''"]) {
			const error = await expectIssues(quiz(single).replace('passingScore: 70', `passingScore: 70\ntimePerQuestion: ${time}`))
			expect(error.issues[0]?.path).toBe('/timePerQuestion')
		}
	})

	it('accepts a number of questions per test', async () => {
		const data = await expectValid(quiz(single).replace('passingScore: 70', 'passingScore: 70\nquestionsPerTest: 40'))
		expect(data.questionsPerTest).toBe(40)
	})

	it('rejects a number of questions per test that is not a whole number above zero', async () => {
		for (const count of ['0', '-1', '2.5', 'many']) {
			const error = await expectIssues(quiz(single).replace('passingScore: 70', `passingScore: 70\nquestionsPerTest: ${count}`))
			expect(error.issues[0]?.path).toBe('/questionsPerTest')
		}
	})

	it('requires the schema modeline', async () => {
		const error = await expectIssues(quiz(single).replace(modeline, '# just a comment'))
		expect(error.issues).toEqual([expect.objectContaining({ line: 1, message: expect.stringContaining('first line') })])
	})

	it('accepts the raw GitHub schema URL as well', async () => {
		await expectValid(
			quiz(single).replace(
				modeline,
				'# yaml-language-server: $schema=https://raw.githubusercontent.com/Marvin-Brouwer/bunbu/main/schema/v1.json'
			)
		)
	})

	it("doesn't parse a file without the schema modeline", async () => {
		const error = await expectIssues('\u0089PNG\r\n\u001a\n: : :\n\t- [ {')
		expect(error.issues).toEqual([expect.objectContaining({ line: 1, message: expect.stringContaining('first line') })])
	})

	it('rejects an unknown schema version', async () => {
		const error = await expectIssues(quiz(single).replace('/v1.json', '/v99.json'))
		expect(error.issues[0]!.message).toBe('Unknown schema version v99')
	})

	it('reports YAML syntax errors with a line number', async () => {
		const error = await expectIssues(`${modeline}\nid: test\ntitle: [unclosed\n`)
		expect(error.issues[0]!.line).toBeGreaterThan(1)
	})

	it('rejects a single question with two correct options', async () => {
		const error = await expectIssues(quiz(single.replace('correct: false', 'correct: true')))
		expect(error.issues).toContainEqual(expect.objectContaining({ path: '/questions/0/options' }))
	})

	it('rejects an invalid yes-no answer', async () => {
		const error = await expectIssues(quiz('  - type: yes-no\n    query: Is it?\n    answer: maybe\n'))
		expect(error.issues).toContainEqual(expect.objectContaining({ path: '/questions/0/answer', message: 'must be one of: yes, no' }))
	})

	it('rejects an unknown question type', async () => {
		const error = await expectIssues(quiz('  - type: essay\n    query: Write something\n'))
		expect(error.issues[0]!.path).toBe('/questions/0/type')
	})

	it('requires source to be text: url entries, not Markdown', async () => {
		const withSource = (source: string) => quiz(single.replace('    options:', `    source:${source}\n    options:`))
		await expectValid(withSource('\n      - Origin: https://example.com/origin'))
		const error = await expectIssues(withSource(' >-\n      [Origin](https://example.com/origin)'))
		expect(error.issues).toContainEqual(expect.objectContaining({ path: '/questions/0/source', message: 'must be array' }))
	})

	it('rejects unknown properties', async () => {
		const error = await expectIssues(`${quiz(single)}tags: [a]\n`)
		expect(error.issues).toContainEqual(expect.objectContaining({ path: '', message: "must not have property 'tags'" }))
	})

	it('rejects headings and HTML in Markdown fields, pointing at the line', async () => {
		const text = quiz(single.replace('answer: HTML', 'answer: |-\n          ## Heading'))
		const error = await expectIssues(text)
		const issue = error.issues.find((candidate) => candidate.path === '/questions/0/options/1/answer')
		expect(issue?.message).toContain('Markdown')
		expect(text.split('\n')[issue!.line! - 1]).toContain('answer:')
	})

	it('returns errors with a readable message', async () => {
		const error = await expectIssues(quiz('  - type: yes-no\n    answer: yes\n'))
		expect(error.message).toContain("must have required property 'query'")
	})
})
