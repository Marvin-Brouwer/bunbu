import { beforeEach, describe, expect, it } from 'vitest'
import { createAgreements, type Agreement, type Agreements } from './agreements.mts'

let agreements: Agreements

const written: Agreement = { content: 'abc', terms: 'written', termsVersion: 1 }

beforeEach(() => {
	agreements = createAgreements()
})

describe('agreements', () => {
	it('holds for the same quiz content under the same terms', () => {
		agreements.value.agree('a', '1', written)

		expect(agreements.value.holds('a', '1', written)).toBe(true)
		expect(agreements.value.holds('a', '2', written)).toBe(false)
		expect(agreements.value.holds('b', '1', written)).toBe(false)
	})

	it('asks again when the content, the terms or their version changed', () => {
		agreements.value.agree('a', '1', written)

		expect(agreements.value.holds('a', '1', { ...written, content: 'abd' })).toBe(false)
		expect(agreements.value.holds('a', '1', { ...written, terms: 'shared' })).toBe(false)
		expect(agreements.value.holds('a', '1', { ...written, termsVersion: 2 })).toBe(false)
	})

	it('forgets one quiz version', () => {
		agreements.value.agree('a', '1', written)
		agreements.value.agree('a', '2', written)

		agreements.value.forget('a', '1')

		expect(agreements.value.holds('a', '1', written)).toBe(false)
		expect(agreements.value.holds('a', '2', written)).toBe(true)
	})

	it('keeps what was agreed this session over what was saved', () => {
		agreements.value.agree('a', '1', written)

		agreements.value.restore({ [JSON.stringify(['a', '1'])]: { ...written, termsVersion: 0 }, [JSON.stringify(['b', '1'])]: written })

		expect(agreements.value.holds('a', '1', written)).toBe(true)
		expect(agreements.value.holds('b', '1', written)).toBe(true)
	})
})
