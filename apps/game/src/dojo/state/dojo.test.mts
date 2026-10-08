import { describe, expect, it } from 'vitest'
import { createPracticeGame } from './practice.mts'
import { createStudyGame } from './study.mts'

describe('dojo', () => {
	it('keeps practice apart from the run: no life, no score, only a tally', () => {
		const practice = createPracticeGame()
		practice.tally.right()
		practice.tally.wrong()
		expect(practice.tally.get()).toEqual({ right: 1, wrong: 1, missed: true })
		expect(Object.keys(practice)).not.toContain('life')
	})

	it('loops study cards back to the first', () => {
		const study = createStudyGame()
		study.reading.next(2)
		study.reading.next(2)
		expect(study.reading.get().card).toBe(0)
	})
})
