import { beforeEach, describe, expect, it } from 'vitest'
import { marks } from '../../_shared/state/ambush.mts'
import { seeded } from '../../_shared/state/random.mts'
import { createRunGame, type RunGame } from '../state/game.mts'
import { runConfig } from '../state/run.mts'
import { fixtureQuiz } from '../../_temp/quiz.mts'
import { commitAmbush, missShare, openAmbush } from './ambush.mts'
import { startRun, tickRun } from './run.mts'

let game: RunGame

function openSingle() {
	game.run.value.beginAmbush()
	game.ninjas.value.clear()
	game.ninjas.value.spawn([{ id: 0, wave: 0, options: [0] }, { id: 1, wave: 0, options: [1] }])
	game.ambush.value.start({
		kind: 'single',
		at: game.quiz.value.current() ?? { question: 0, part: 0 },
		query: 'Which attribute?',
		options: [
			{ answer: '`alt`', correct: true, mark: marks[0]!, ninja: 0, pick: 0, source: 0, rank: 0 },
			{ answer: '`title`', correct: false, mark: marks[1]!, ninja: 1, pick: 0, source: 1, rank: 0 },
		],
		choose: 1,
		seconds: 10,
		round: 1,
		rounds: 1,
	})
}

function answer(mark: number) {
	openSingle()
	game.ambush.value.pick(marks[mark]!)
	commitAmbush(game)
}

beforeEach(() => {
	game = createRunGame()
	startRun(game, fixtureQuiz)
	tickRun(game, 2, 2)
})

describe('commitAmbush', () => {
	it('scores a correct answer, slays the slashed ninja and resumes the run', () => {
		answer(0)

		expect(game.score.value).toMatchObject({ points: 100, correct: 1, answered: 1 })
		expect(game.life.value.value).toBe(1)
		expect(game.ninjas.value.active.map((ninja) => ninja.pose)).toEqual(['slain', 'blocked'])
		expect(game.shogun.value).toMatchObject({ pose: 'strike', target: 0 })
		expect(game.run.value.phase).toBe('running')
		expect(game.quiz.value.answered).toBe(1)
	})

	it('takes the question share off the life bar on a miss and keeps the score', () => {
		answer(1)

		expect(game.score.value).toMatchObject({ points: 0, correct: 0, answered: 1 })
		expect(game.life.value.value).toBeCloseTo(1 - missShare(game))
		expect(game.shogun.value.pose).toBe('hurt')
		expect(game.quiz.value.misses()).toHaveLength(1)
	})

	it('falls when the pass mark is out of reach', () => {
		// Four questions at a 70% pass mark leave a margin of 1.2 points: the second miss is too many.
		answer(1)
		answer(1)

		expect(game.life.value.empty()).toBe(true)
		expect(game.run.value.phase).toBe('fallen')
		expect(game.shogun.value.pose).toBe('fallen')
	})

	it('finishes the run after the last question', () => {
		fixtureQuiz.questions.forEach(() => { answer(0) })

		expect(game.run.value.phase).toBe('finished')
		expect(game.score.value.points).toBe(fixtureQuiz.questions.length * 100)
	})
})

describe('openAmbush', () => {
	it('slows the world down, spawns a ninja per option and opens the scroll on the next question', () => {
		openAmbush(game, 1, seeded(1))

		expect(game.run.value.phase).toBe('ambush')
		expect(game.ambush.value).toMatchObject({ open: true, kind: 'yes-no', at: { question: 0, part: 0 } })
		expect(game.ambush.value.seconds).toBeGreaterThan(0)
		expect(game.ninjas.value.active).toMatchObject([{ id: 0, wave: 0, options: [0, 1], approach: 0, pose: 'approach' }])
	})

	it('opens without a time limit on Novice', () => {
		openAmbush(game, undefined, seeded(1))
		expect(game.ambush.value.seconds).toBe(0)
	})

	it('plays a whole quiz with the right answers', () => {
		for (const _ of fixtureQuiz.questions) {
			openAmbush(game, 1, seeded(2))
			const { kind, options } = game.ambush.value
			const right = kind === 'order'
				? options.filter((option) => option.rank > 0).toSorted((first, second) => first.rank - second.rank)
				: options.filter((option) => option.correct)
			for (const option of right) game.ambush.value.pick(option.mark)
			commitAmbush(game)
		}
		expect(game.run.value.phase).toBe('finished')
		expect(game.score.value.correct).toBe(fixtureQuiz.questions.length)
	})
})

describe('tickRun', () => {
	// An ambush slows the world down, but its time limit runs on real time.
	const tickReal = (seconds: number) => { tickRun(game, seconds * runConfig.ambushWorldScale, seconds) }

	it('lets the ninjas creep in as the ambush time runs out', () => {
		openSingle()
		tickReal(5)
		expect(game.ambush.value.secondsLeft).toBeCloseTo(5)
		expect(game.ninjas.value.active[0]?.approach).toBeCloseTo(0.5)
	})

	it('ends the ambush unanswered when the time runs out, half-swiped or not', () => {
		openSingle()
		game.ambush.value.pick(marks[0]!)
		tickReal(10)

		expect(game.ambush.value.open).toBe(false)
		expect(game.quiz.value.records).toEqual([{ at: { question: 0, part: 0 }, outcome: 'unanswered', picked: [0] }])
		expect(game.life.value.value).toBeCloseTo(1 - missShare(game))
		expect(game.score.value.points).toBe(0)
	})
})
