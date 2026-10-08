import { beforeEach, describe, expect, it } from 'vitest'
import { ambush, marks } from '../state/ambush.mts'
import { life } from '../state/life.mts'
import { ninjas } from '../state/ninjas.mts'
import { quiz } from '../state/quiz.mts'
import { run } from '../state/run.mts'
import { score } from '../state/score.mts'
import { screen } from '../state/screen.mts'
import { shogun } from '../state/shogun.mts'
import { fixtureQuiz } from '../fixtures/quiz.mts'
import { commitAmbush, missShare } from './ambush.mts'
import { startRun } from './run.mts'

function openSingle() {
	run.beginAmbush()
	ninjas.spawn([{ id: 0, wave: 0, options: [0] }, { id: 1, wave: 0, options: [1] }])
	ambush.open({
		kind: 'single',
		at: quiz.current() ?? { question: 0, part: 0 },
		query: 'Which attribute?',
		options: [
			{ answer: '`alt`', correct: true, mark: marks[0]!, ninja: 0, pick: 0 },
			{ answer: '`title`', correct: false, mark: marks[1]!, ninja: 1, pick: 0 },
		],
		choose: 1,
		seconds: 10,
	})
}

beforeEach(() => {
	screen.reset()
	ninjas.clear()
	shogun.reset()
	startRun(fixtureQuiz)
	run.tick(2)
})

describe('commitAmbush', () => {
	it('scores a correct answer, slays the slashed ninja and resumes the run', () => {
		openSingle()
		ambush.pick(marks[0]!)
		commitAmbush()

		expect(score.get()).toMatchObject({ points: 100, correct: 1, answered: 1 })
		expect(life.get().value).toBe(1)
		expect(ninjas.get().active.map((ninja) => ninja.pose)).toEqual(['slain', 'blocked'])
		expect(shogun.get()).toMatchObject({ pose: 'strike', target: 0 })
		expect(run.get().phase).toBe('running')
		expect(quiz.get().answered).toBe(1)
	})

	it('takes the question share off the life bar on a miss and keeps the score', () => {
		openSingle()
		ambush.pick(marks[1]!)
		commitAmbush()

		expect(score.get()).toMatchObject({ points: 0, correct: 0, answered: 1 })
		expect(life.get().value).toBeCloseTo(1 - missShare())
		expect(shogun.get().pose).toBe('hurt')
		expect(quiz.misses()).toHaveLength(1)
	})

	it('falls when the pass mark is out of reach', () => {
		for (let question = 0; question < 2; question++) {
			openSingle()
			ambush.pick(marks[1]!)
			commitAmbush()
		}

		// Four questions at a 70% pass mark leave a margin of 1.2 points, so one miss is nearly all of it.
		expect(life.empty()).toBe(true)
		expect(run.get().phase).toBe('fallen')
		expect(screen.get().current).toBe('fallen')
	})

	it('finishes the run after the last question', () => {
		life.reset()
		shogun.run()
		for (const question of fixtureQuiz.questions) {
			expect(question.type).toBeTypeOf('string')
			openSingle()
			ambush.pick(marks[0]!)
			commitAmbush()
		}

		expect(run.get().phase).toBe('finished')
		expect(screen.get().current).toBe('results')
		expect(score.get().points).toBe(fixtureQuiz.questions.length * 100)
	})
})
