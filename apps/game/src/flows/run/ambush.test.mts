import { beforeEach, describe, expect, it } from 'vitest'
import { marks } from '../../state/ambush.mts'
import { createRunGame, type RunGame } from '../../state/run/game.mts'
import { fixtureQuiz } from '../../fixtures/quiz.mts'
import { commitAmbush, missShare } from './ambush.mts'
import { startRun, tickRun } from './run.mts'

let game: RunGame

function openSingle() {
	game.run.beginAmbush()
	game.ninjas.clear()
	game.ninjas.spawn([{ id: 0, wave: 0, options: [0] }, { id: 1, wave: 0, options: [1] }])
	game.ambush.open({
		kind: 'single',
		at: game.quiz.current() ?? { question: 0, part: 0 },
		query: 'Which attribute?',
		options: [
			{ answer: '`alt`', correct: true, mark: marks[0]!, ninja: 0, pick: 0 },
			{ answer: '`title`', correct: false, mark: marks[1]!, ninja: 1, pick: 0 },
		],
		choose: 1,
		seconds: 10,
	})
}

function answer(mark: number) {
	openSingle()
	game.ambush.pick(marks[mark]!)
	commitAmbush(game)
}

beforeEach(() => {
	game = createRunGame()
	startRun(game, fixtureQuiz)
	tickRun(game, 2)
})

describe('commitAmbush', () => {
	it('scores a correct answer, slays the slashed ninja and resumes the run', () => {
		answer(0)

		expect(game.score.get()).toMatchObject({ points: 100, correct: 1, answered: 1 })
		expect(game.life.get().value).toBe(1)
		expect(game.ninjas.get().active.map((ninja) => ninja.pose)).toEqual(['slain', 'blocked'])
		expect(game.shogun.get()).toMatchObject({ pose: 'strike', target: 0 })
		expect(game.run.get().phase).toBe('running')
		expect(game.quiz.get().answered).toBe(1)
	})

	it('takes the question share off the life bar on a miss and keeps the score', () => {
		answer(1)

		expect(game.score.get()).toMatchObject({ points: 0, correct: 0, answered: 1 })
		expect(game.life.get().value).toBeCloseTo(1 - missShare(game))
		expect(game.shogun.get().pose).toBe('hurt')
		expect(game.quiz.misses()).toHaveLength(1)
	})

	it('falls when the pass mark is out of reach', () => {
		// Four questions at a 70% pass mark leave a margin of 1.2 points: the second miss is too many.
		answer(1)
		answer(1)

		expect(game.life.empty()).toBe(true)
		expect(game.run.get().phase).toBe('fallen')
		expect(game.shogun.get().pose).toBe('fallen')
	})

	it('finishes the run after the last question', () => {
		fixtureQuiz.questions.forEach(() => { answer(0) })

		expect(game.run.get().phase).toBe('finished')
		expect(game.score.get().points).toBe(fixtureQuiz.questions.length * 100)
	})
})

describe('tickRun', () => {
	it('lets the ninjas creep in as the ambush time runs out', () => {
		openSingle()
		tickRun(game, 5)
		expect(game.ninjas.get().active[0]?.approach).toBeCloseTo(0.5)
	})
})
