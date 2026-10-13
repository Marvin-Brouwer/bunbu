import { describe, expect, it } from 'vitest'
import { noAmbush } from '../../_shared/state/ambush.mts'
import { createPracticeGame } from './practice.mts'
import { createStudyGame } from './study.mts'

describe('dojo', () => {
	it('keeps practice apart from the run: no life, no score, only a tally', () => {
		const practice = createPracticeGame()
		practice.tally.value.addRight()
		practice.tally.value.addWrong({ ambush: noAmbush, record: { at: { question: 0, part: 0 }, outcome: 'wrong', picked: [1] } })
		expect(practice.tally.value).toMatchObject({ right: 1, wrong: 1, missed: { record: { outcome: 'wrong' } } })
		practice.tally.value.carryOn()
		expect(practice.tally.value.missed).toBeUndefined()
		expect(Object.keys(practice)).not.toContain('life')
	})

	it('restarts study at the first card', () => {
		const study = createStudyGame()
		study.reading.value.reach(3)
		study.reading.value.speak([{ block: 0, start: 0, end: 3 }])
		study.reading.value.restart()
		expect(study.reading.value).toMatchObject({ card: 0, said: [] })
	})
})
