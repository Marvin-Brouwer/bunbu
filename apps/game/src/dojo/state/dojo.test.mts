import { describe, expect, it } from 'vitest'
import { createPracticeGame } from './practice.mts'
import { createStudyGame } from './study.mts'

describe('dojo', () => {
	it('keeps practice apart from the run: no life, no score, only a tally', () => {
		const practice = createPracticeGame()
		practice.tally.value.addRight()
		practice.tally.value.addWrong()
		expect(practice.tally.value).toMatchObject({ right: 1, wrong: 1, missed: true })
		expect(Object.keys(practice)).not.toContain('life')
	})

	it('keeps the study speed between half and double', () => {
		const study = createStudyGame()
		study.reading.value.setRate(3)
		expect(study.reading.value.rate).toBe(2)
		study.reading.value.setRate(0.25)
		expect(study.reading.value.rate).toBe(0.5)
	})

	it('restarts study at the first card', () => {
		const study = createStudyGame()
		study.reading.value.reach(3)
		study.reading.value.speak({ block: 0, start: 0, end: 3 })
		study.reading.value.restart()
		expect(study.reading.value).toMatchObject({ card: 0, word: undefined })
	})
})
