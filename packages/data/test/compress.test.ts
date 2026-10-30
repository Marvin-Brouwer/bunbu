import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
	BunbuShareError,
	BunbuValidationError,
	compress,
	fileExtension,
	mimeType,
	uncompress,
	validate,
	type BunbuData,
	type BunbuShareErrorReason,
	type Metadata,
	type MetadataValue,
} from '../src'
import builtInV1 from '../pronunciations/v1.g.json' with { type: 'json' }
import builtInV2 from '../pronunciations/v2.g.json' with { type: 'json' }
import { generateLargeQuiz } from './fixtures/generate-large-quiz'
import legacy from './fixtures/share-v1.json' with { type: 'json' }
import { compressBytes, decompressBytes } from '../src/share/codec'
import { pack } from '../src/share/pack'

const designDoc = readFileSync(new URL('../../../docs/design/data-format.md', import.meta.url), 'utf8')
const docQuestions = [...designDoc.matchAll(/^(`{3,})yaml\n(- type:[\s\S]*?)^\1$/gm)].map((match) => match[2]!)
const docYaml = `# yaml-language-server: $schema=https://marvin-brouwer.github.io/bunbu/schema/v1.json
id: doc
title: Doc examples
version: 1
language: en
passingScore: 70
questions:
${docQuestions.join('').replace(/^(?=.)/gm, '  ')}`

/** What uncompress returns for a quiz: the same, with that format's built-in pronunciations added. */
function restored(data: BunbuData, version: 1 | 2 = 2): BunbuData {
	return { ...data, pronunciations: { ...(version === 1 ? builtInV1 : builtInV2), ...data.pronunciations } }
}

async function docExamples(): Promise<BunbuData> {
	const data = await validate(docYaml)
	if (data instanceof Error) throw data
	return data
}

function nestedMetadata(depth: number): Metadata {
	let value: Metadata = {}
	for (let level = 1; level < depth; level++) value = { child: value }
	return value
}

const smallQuiz: BunbuData = {
	id: 'small',
	title: 'Small',
	version: '2',
	language: 'nl-NL',
	passingScore: 62.5,
	authors: ['Ada', 'Grace'],
	license: 'CC-BY-4.0',
	timePerQuestion: '1m30s',
	questionsPerTest: 300,
	description: 'Een **kleine** quiz met één vraag — en emoji 🎉' as BunbuData['description'],
	// fromEntries, because a literal __proto__ key would set the prototype instead.
	pronunciations: Object.fromEntries([
		['__proto__', 'proto'],
		['SQL', 'sequel'],
	]),
	questions: [
		{
			type: 'match',
			query: 'Match' as never,
			rows: [
				{ text: 'a' as never, answer: 'same' as never },
				{ text: 'b' as never, answer: 'same' as never },
				{
					text: 'c' as never,
					options: [
						{ answer: 'x' as never, correct: false, explanation: 'no' as never },
						{ answer: 'same' as never, correct: true },
					],
				},
			],
			distractors: [],
			references: [{ 'Docs: x': 'https://example.com/x' }],
		},
		{ type: 'yes-no', query: 'Yes?' as never, answer: 'no' },
		{
			type: 'multiple',
			query: 'Pick' as never,
			options: Array.from({ length: 10 }, (_, index) => ({ answer: `o${index}` as never, correct: index % 3 === 0 })),
		},
	],
}

describe('compress / uncompress', () => {
	it('round-trips every question example from the design doc', async () => {
		const data = await docExamples()
		expect(await uncompress(await compress(data))).toEqual(restored(data))
	})

	it('round-trips optional fields, unicode, repeated strings and a fractional score', async () => {
		const result = await uncompress(await compress(smallQuiz))
		expect(result).toEqual(restored(smallQuiz))
		expect(Object.hasOwn(result.pronunciations!, '__proto__')).toBe(true)
		expect(Object.getPrototypeOf(result.pronunciations)).toBe(Object.prototype)
	})

	it('round-trips a large generated quiz', { timeout: 60_000 }, async () => {
		const data = generateLargeQuiz(250, 1)
		expect(await uncompress(await compress(data))).toEqual(restored(data))
	})

	it('writes a .bunbu file that starts with its signature and version', async () => {
		const file = await compress(await docExamples())
		expect(new TextDecoder().decode(file.subarray(0, 5))).toBe('BUNBU')
		expect(file[5]).toBe(0)
		expect(file[6]).toBe(2)
		expect(fileExtension).toBe('.bunbu')
		expect(mimeType).toBe('application/vnd.bunbu')
	})

	it('keeps files small', { timeout: 60_000 }, async () => {
		// Regression guards, a few percent above the sizes measured when the format was introduced.
		expect((await compress(await docExamples())).length).toBeLessThan(1800)
		expect((await compress(generateLargeQuiz(250, 1))).length).toBeLessThan(27_500)
	})

	it('reads a File, a Blob, an ArrayBuffer or bytes', async () => {
		const data = await docExamples()
		const bytes = await compress(data)
		const buffer = bytes.slice().buffer
		for (const input of [new File([buffer], `quiz${fileExtension}`, { type: mimeType }), new Blob([buffer]), buffer, bytes]) {
			expect(await uncompress(input)).toEqual(restored(data))
		}
	})

	it('rejects invalid data', async () => {
		const data = await docExamples()
		const single = data.questions.find((question) => question.type === 'single')!
		const invalid = { ...data, questions: [{ ...single, options: single.options.map((option) => ({ ...option, correct: true })) }] }
		await expect(compress(invalid)).rejects.toBeInstanceOf(BunbuValidationError)
	})

	async function expectShareError(input: Uint8Array, reason: BunbuShareErrorReason): Promise<void> {
		const error = await uncompress(input).catch((caught: unknown) => caught)
		expect(error).toBeInstanceOf(BunbuShareError)
		expect((error as BunbuShareError).reason).toBe(reason)
	}

	const encode = (text: string) => new TextEncoder().encode(text)

	it.each([
		['an empty file', new Uint8Array(), 'unknown-format'],
		['a text file', encode('id: quiz\ntitle: Not compressed\n'), 'unknown-format'],
		['an older text share code', encode('AqbIAH8HvRcNjxvWk7hc8tV'), 'unknown-format'],
		['a signature without the NUL byte', Uint8Array.from([...encode('BUNBU'), 1, 1, 1, 0, 0, 0, 0, 0]), 'unknown-format'],
		['a newer format version', Uint8Array.from([...encode('BUNBU'), 0, 3, 1, 1, 0, 0, 0, 0, 0]), 'unknown-format'],
		['garbage after the signature', Uint8Array.from([...encode('BUNBU'), 0, 1, ...Array.from<number>({ length: 20 }).fill(0)]), 'corrupt'],
		['a size claim far beyond the limit', Uint8Array.from([...encode('BUNBU'), 0, 1, 0xff, 0xff, 0xff, 0x7f, 1, 0, 0, 0, 0, 0]), 'corrupt'],
	] as const)('rejects %s', async (_, input, reason) => {
		await expectShareError(input, reason)
	})

	it('reports cut-off files as incomplete', async () => {
		const file = await compress(await docExamples())
		for (const length of [3, 7, 9, 14, Math.floor(file.length / 2), file.length - 1]) {
			await expectShareError(file.subarray(0, length), 'incomplete')
		}
	})

	it('reads a v1 file made before metadata support and keeps the v1 packing unchanged', async () => {
		const data = await validate(legacy.yaml)
		if (data instanceof Error) throw data
		const file = Uint8Array.from(Buffer.from(legacy.base64, 'base64'))
		expect(file[6]).toBe(1)
		expect(await uncompress(file)).toEqual(restored(data, 1))
		expect(pack(data, 1)).toEqual(await decompressBytes(file))
		expect(pack(data, 2)).toEqual(pack(data, 1))
	})

	it('round-trips optional metadata on the quiz and every question type', async () => {
		const original = await docExamples()
		const data: BunbuData = {
			...original,
			metadata: { anotherApp: { label: '日本語', tags: ['a', 'b'], enabled: true, weight: 1.5, empty: null }, empty: {} },
			questions: original.questions.map((question, index) => ({
				...question,
				metadata: { custom: { group: `group-${index}`, active: false, values: [null, 0, {}, []] } },
			})),
		}
		const before = structuredClone(data)
		expect(await uncompress(await compress(data))).toEqual(restored(data))
		expect(data).toEqual(before)
	})

	it('keeps absent metadata absent and preserves explicitly empty metadata', async () => {
		const data = await docExamples()
		const plain = await uncompress(await compress(data))
		expect(Object.hasOwn(plain, 'metadata')).toBe(false)
		expect(plain.questions.every((question) => !Object.hasOwn(question, 'metadata'))).toBe(true)
		const mixed = { ...data, metadata: {}, questions: data.questions.map((question, index) => index === 0 ? { ...question, metadata: {} } : question) }
		expect(await uncompress(await compress(mixed))).toEqual(restored(mixed))
	})

	it('preserves custom keys as data without changing object prototypes', async () => {
		const metadata = Object.fromEntries<MetadataValue>([['__proto__', { polluted: true }], ['constructor', { prototype: { custom: true } }]])
		const data = { ...await docExamples(), metadata }
		const result = await uncompress(await compress(data))
		expect(result.metadata).toEqual(metadata)
		expect(Object.hasOwn(result.metadata!, '__proto__')).toBe(true)
		expect(Object.getPrototypeOf(result.metadata)).toBe(Object.prototype)
		expect(Object.getPrototypeOf({})).toBe(Object.prototype)
	})

	it('round-trips metadata at the maximum supported nesting depth', async () => {
		const data = { ...await docExamples(), metadata: nestedMetadata(64) }
		expect(await uncompress(await compress(data))).toEqual(restored(data))
	})

	it.each(['quiz', 'question'] as const)('rejects deeply nested %s metadata with a validation error', async (location) => {
		const data = await docExamples()
		if (location === 'quiz') data.metadata = nestedMetadata(2_000)
		else data.questions[0]!.metadata = nestedMetadata(2_000)
		const file = await compressBytes(pack(data, 2), 2)
		await expect(uncompress(file)).rejects.toBeInstanceOf(BunbuValidationError)
		await expect(compress(data)).rejects.toBeInstanceOf(BunbuValidationError)
	})

	it('checks every path to shared metadata when applying the nesting limit', async () => {
		const shared = nestedMetadata(33)
		let deep: Metadata = shared
		for (let level = 0; level < 32; level++) deep = { child: deep }
		const data = { ...await docExamples(), metadata: { deep, shallow: shared } }
		await expect(compress(data)).rejects.toBeInstanceOf(BunbuValidationError)
	})

	it('round-trips ordinary shared metadata values without treating sharing as a cycle', async () => {
		const shared = { values: [null, true, 3, '日本語', '\ud800'] }
		const data = { ...await docExamples(), metadata: { left: shared, right: shared } }
		expect(await uncompress(await compress(data))).toEqual(restored(data))
	})

	it('rejects oversized shared graphs through the public compression API', async () => {
		let metadata: Metadata = { value: 'leaf' }
		for (let depth = 0; depth < 18; depth++) metadata = { left: metadata, right: metadata }
		await expect(compress({ ...await docExamples(), metadata })).rejects.toBeInstanceOf(BunbuValidationError)
	})

	it('rejects malformed metadata JSON in an otherwise sealed v2 file', async () => {
		const data = { ...await docExamples(), metadata: { custom: true } }
		const packed = pack(data, 2)
		// Metadata is one interned JSON string; change its opening brace without changing its size.
		const marker = new TextEncoder().encode('{"custom":true}')
		const offset = Buffer.from(packed).indexOf(marker)
		expect(offset).toBeGreaterThan(0)
		packed[offset] = 0x21
		await expectShareError(await compressBytes(packed, 2), 'corrupt')
	})

	it.each([new Date(), Number.POSITIVE_INFINITY, undefined, BigInt(1)])('rejects non-JSON metadata values (%s)', async (value) => {
		const data = { ...await docExamples(), metadata: { custom: value } } as BunbuData
		await expect(compress(data)).rejects.toBeInstanceOf(BunbuValidationError)
	})

	it('reports altered files as corrupt, or decodes them to the identical quiz', { timeout: 60_000 }, async () => {
		// The last few bytes hold LZMA's final range-coder bits, where several endings decode to the
		// same output; anything else that changes must be reported, never decode to different data.
		const data = await docExamples()
		const file = await compress(data)
		const flip = (position: number) => {
			const altered = file.slice()
			altered[position]! ^= 0x01
			return altered
		}
		for (let position = 7; position < file.length; position += 11) {
			const result = await uncompress(flip(position)).catch((caught: unknown) => caught)
			// A flipped length field can also claim more bytes than the file has: "incomplete".
			if (result instanceof BunbuShareError) expect(['corrupt', 'incomplete']).toContain(result.reason)
			else expect(result).toEqual(restored(data))
		}
		// Byte 11 is in the CRC; the others are in the LZMA body.
		for (const position of [11, 30, Math.floor(file.length / 2)]) await expectShareError(flip(position), 'corrupt')
		await expectShareError(Uint8Array.from([...file, 0, 0]), 'corrupt')
	})
})
