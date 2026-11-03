import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { isSeq, LineCounter, parseDocument, type Document } from 'yaml'
import schemaV1 from '../../../schema/v1.json' with { type: 'json' }
import schemaV2 from '../../../schema/v2.json' with { type: 'json' }
import { duplicateQuestions } from './duplicates'
import { isGfmMarkdown } from './markdown'
import { readSchemaReference } from './modeline'
import type { BunbuData } from './types'

export type ValidationIssue = {
	/** JSON pointer to the invalid value, such as `/questions/0/query`. Empty for the document itself. */
	path: string
	message: string
	/** 1-based line in the YAML file, when known. */
	line?: number
}

/** Returned by {@link validate} when a quiz file is invalid. */
export class BunbuValidationError extends Error {
	readonly issues: ValidationIssue[]

	constructor(issues: ValidationIssue[]) {
		super(
			issues.length === 1
				? `Invalid quiz file: ${formatIssue(issues[0]!)}`
				: `Invalid quiz file, ${issues.length} issues:\n${issues.map((issue) => `- ${formatIssue(issue)}`).join('\n')}`
		)
		this.name = 'BunbuValidationError'
		this.issues = issues
	}
}

const schemas: Record<number, object> = { 1: schemaV1, 2: schemaV2 }
const validators = new Map<number, ValidateFunction>()

function getValidator(version: number): ValidateFunction | undefined {
	const schema = schemas[version]
	if (!schema) return undefined

	let validator = validators.get(version)
	if (!validator) {
		const ajv = new Ajv2020({ allErrors: true, discriminator: true, strict: true, allowUnionTypes: true })
		addFormats(ajv, ['uri'])
		ajv.addFormat('gfm', isGfmMarkdown)
		validator = ajv.compile(schema)
		validators.set(version, validator)
	}
	return validator
}

/**
 * Parses and validates a quiz file against the schema version named in its first line.
 * Never rejects for invalid input: returns a {@link BunbuValidationError} instead.
 */
// `async` is part of the published API: a future schema version may load its validator on demand.
// oxlint-disable-next-line typescript/require-await
export async function validate(fileBlob: string): Promise<BunbuData | BunbuValidationError> {
	// Without a schema reference it is not a quiz file, so it isn't parsed: reading a picture or other
	// binary file as YAML only adds a page of parser errors.
	const reference = readSchemaReference(fileBlob)
	if (typeof reference === 'string') return new BunbuValidationError([{ path: '', message: reference, line: 1 }])
	if (!getValidator(reference.version)) {
		return new BunbuValidationError([{ path: '', message: `Unknown schema version v${reference.version}`, line: 1 }])
	}

	const issues: ValidationIssue[] = []
	const lineCounter = new LineCounter()
	let document: Document
	let data: unknown
	try {
		document = parseDocument(fileBlob, { lineCounter })
		for (const error of document.errors) {
			issues.push({ path: '', message: error.message.split('\n')[0]!, line: error.linePos?.[0].line })
		}

		if (issues.length > 0) return new BunbuValidationError(issues)
		data = document.toJS()
	} catch {
		return new BunbuValidationError([{ path: '', message: 'YAML data cannot be converted safely; reduce nesting or alias expansion' }])
	}

	const schemaIssues = checkData(data, reference.version, (pointer) => findLine(document, lineCounter, pointer))
	if (schemaIssues.length > 0) return new BunbuValidationError(schemaIssues)

	const quiz = data as BunbuData
	warnAboutDuplicates(quiz, (pointer) => findLine(document, lineCounter, pointer))
	// The schema types `version` as a string, but YAML parses an unquoted `version: 3` as a number.
	// oxlint-disable-next-line typescript/no-unnecessary-type-conversion
	return { ...quiz, version: String(quiz.version) }
}

/** Checks parsed quiz data against a schema version. Returns no issues when the data is valid. */
export function checkData(data: unknown, schemaVersion: number, lineOf?: (pointer: string) => number | undefined): ValidationIssue[] {
	const validator = getValidator(schemaVersion)
	if (!validator) return [{ path: '', message: `Unknown schema version v${schemaVersion}` }]
	// YAML aliases and JavaScript callers can supply cycles. Reject them before the recursive
	// metadata schema runs, rather than overflowing its stack or losing values when sharing.
	if (schemaVersion === 2) {
		const issue = metadataIssue(data)
		if (issue) return [{ ...issue, ...(lineOf ? { line: lineOf(issue.path) } : {}) }]
	}
	if (validator(data)) return []

	const seen = new Set<string>()
	const issues: ValidationIssue[] = []
	for (const error of validator.errors ?? []) {
		const issue: ValidationIssue = { path: error.instancePath, message: describe(error) }
		const line = lineOf?.(error.instancePath)
		if (line !== undefined) issue.line = line
		const key = `${issue.path} ${issue.message}`
		if (seen.has(key)) continue
		seen.add(key)
		issues.push(issue)
	}
	return issues
}

const maxMetadataDepth = 64
const maxMetadataValues = 100_000
const maxMetadataBytes = 16 * 1024 * 1024

/** UTF-8 size of a JSON string, including quotes and escapes, without allocating that string. */
function jsonStringBytes(value: string): number {
	if (value.length > maxMetadataBytes) return maxMetadataBytes + 1
	let bytes = 2
	for (let index = 0; index < value.length; index++) {
		const code = value.charCodeAt(index)
		if (code === 0x22 || code === 0x5c) bytes += 2
		else if (code < 0x20) bytes += [8, 9, 10, 12, 13].includes(code) ? 2 : 6
		else if (code < 0x80) bytes++
		else if (code < 0x800) bytes += 2
		else if (code >= 0xd800 && code <= 0xdbff && value.charCodeAt(index + 1) >= 0xdc00 && value.charCodeAt(index + 1) <= 0xdfff) {
			bytes += 4
			index++
		} else bytes += code >= 0xd800 && code <= 0xdfff ? 6 : 3
		if (bytes > maxMetadataBytes) return bytes
	}
	return bytes
}

function metadataValueIssue(value: unknown): string | undefined {
	const pending: [unknown, number, boolean][] = [[value, 1, false]]
	const ancestors = new WeakSet<object>()
	let scheduled = 1
	let bytes = 0
	try {
		while (pending.length > 0) {
			const [item, depth, leaving] = pending.pop()!
			if (leaving) {
				ancestors.delete(item as object)
				continue
			}
			if (item === null) bytes += 4
			else if (typeof item === 'string') bytes += jsonStringBytes(item)
			else if (typeof item === 'boolean') bytes += item ? 4 : 5
			else if (typeof item === 'number' && Number.isFinite(item)) bytes += String(item).length
			else if (typeof item !== 'object') return 'must contain only JSON-compatible values'
			else {
				if (depth > maxMetadataDepth) return `must not be nested deeper than ${maxMetadataDepth} object or array levels`
				if (ancestors.has(item)) return 'must contain JSON-compatible values without cycles'
				if ((!Array.isArray(item) && Object.prototype.toString.call(item) !== '[object Object]') || typeof (item as { toJSON?: unknown }).toJSON === 'function') {
					return 'must contain only JSON-compatible objects and values without custom serialization'
				}
				if (Array.isArray(item) && item.length > maxMetadataValues - scheduled) return `must contain at most ${maxMetadataValues} JSON values after expanding shared references`
				const keys = Array.isArray(item) ? undefined : Object.keys(item)
				const count = keys ? keys.length : (item as unknown[]).length
				scheduled += count
				if (scheduled > maxMetadataValues) return `must contain at most ${maxMetadataValues} JSON values after expanding shared references`
				bytes += 2 + Math.max(0, count - 1)
				if (keys) for (const key of keys) {
					bytes += jsonStringBytes(key) + 1
					if (bytes > maxMetadataBytes) return `must fit within ${maxMetadataBytes} bytes of JSON after expanding shared references`
				}
				if (bytes > maxMetadataBytes) return `must fit within ${maxMetadataBytes} bytes of JSON after expanding shared references`
				ancestors.add(item)
				pending.push([item, depth, true])
				if (keys) for (const key of keys) pending.push([(item as Record<string, unknown>)[key], depth + 1, false])
				else for (let index = 0; index < count; index++) pending.push([(item as unknown[])[index], depth + 1, false])
			}
			if (bytes > maxMetadataBytes) return `must fit within ${maxMetadataBytes} bytes of JSON after expanding shared references`
		}
	} catch {
		return 'must contain only JSON-compatible objects and values'
	}
	return undefined
}

function metadataIssue(data: unknown): ValidationIssue | undefined {
	if (data === null || typeof data !== 'object') return undefined
	const quiz = data as Record<string, unknown>
	const fields: [string, unknown][] = [['/metadata', quiz.metadata]]
	if (Array.isArray(quiz.questions)) {
		quiz.questions.forEach((question: unknown, index) => {
			if (question !== null && typeof question === 'object') fields.push([`/questions/${index}/metadata`, (question as Record<string, unknown>).metadata])
		})
	}
	for (const [path, value] of fields) {
		if (value === undefined) continue
		const message = metadataValueIssue(value)
		if (message) return { path, message }
	}
	return undefined
}

function describe(error: ErrorObject): string {
	switch (error.keyword) {
		case 'format':
			return error.params.format === 'gfm'
				? 'must be GitHub-flavored Markdown without headings or raw HTML'
				: (error.message ?? 'has an invalid format')
		case 'additionalProperties':
		case 'unevaluatedProperties': {
			const property = (error.params.additionalProperty ?? error.params.unevaluatedProperty) as string
			return `must not have property '${property}'`
		}
		case 'contains':
			return 'has the wrong number of options with `correct: true`'
		case 'enum':
			return `must be one of: ${(error.params.allowedValues as unknown[]).join(', ')}`
		default:
			return error.message ?? `failed '${error.keyword}'`
	}
}

/**
 * A repeated question isn't an error: the quiz still works, and a reader can leave it out with
 * `withoutDuplicates`. It is only reported, so whoever made the file can see it.
 */
function warnAboutDuplicates(quiz: BunbuData, lineOf: (pointer: string) => number | undefined): void {
	const duplicates = duplicateQuestions(quiz)
	if (duplicates.length === 0) return
	const where = (index: number) => {
		const line = lineOf(`/questions/${index}`)
		return line === undefined ? `question ${index + 1}` : `question ${index + 1} (line ${line})`
	}
	console.warn(
		`[bunbu] ${quiz.id} repeats ${duplicates.length === 1 ? 'a question' : `${duplicates.length} questions`}:\n` +
			duplicates.map(({ question, of }) => `- ${where(question)} repeats ${where(of)}`).join('\n')
	)
}

/**
 * The 1-based line each question of a quiz file starts on, by its place in `questions`, to point at
 * a question the file got right but a reader still reports, such as a duplicate.
 */
export function questionLines(fileBlob: string): (number | undefined)[] {
	const lineCounter = new LineCounter()
	const document = parseDocument(fileBlob, { lineCounter })
	const questions = document.get('questions', true)
	if (!isSeq(questions)) return []
	return questions.items.map((item) => {
		const offset = (item as { range?: [number, number, number] } | null)?.range?.[0]
		return offset === undefined ? undefined : lineCounter.linePos(offset).line
	})
}

function findLine(document: Document, lineCounter: LineCounter, pointer: string): number | undefined {
	const path = pointer
		.split('/')
		.slice(1)
		.map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'))
		.map((segment) => (/^\d+$/.test(segment) ? Number(segment) : segment))
	const node = path.length === 0 ? document.contents : document.getIn(path, true)
	const offset = (node as { range?: [number, number, number] } | null)?.range?.[0]
	return offset === undefined ? undefined : lineCounter.linePos(offset).line
}

function formatIssue(issue: ValidationIssue): string {
	const location = [issue.line && `line ${issue.line}`, issue.path].filter(Boolean).join(', ')
	return location ? `${issue.message} (${location})` : issue.message
}
