import { beforeEach, describe, expect, it } from 'vitest'
import { marks } from '../../_shared/state/ambush.mts'
import { createRunGame, type RunGame } from '../state/game.mts'
import { highScores } from '../state/highscores.mts'
import { lastRun } from '../state/lastrun.mts'
import { runConfig } from '../state/run.mts'
import { moveSeconds } from '../state/shogun.mts'
import { settings } from '../../settings/state/settings.mts'
import { fixtureQuiz } from '../../_temp/quiz.mts'
import { seeded } from '../../_temp/random.mts'
import { commitAmbush, missShare, openAmbush, outcomeDelaySeconds } from './ambush.mts'
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

/** Lets the scroll roll out of the way, until the samurai meets the first ninja. */
function untilFirstMove() {
	tickRun(game, outcomeDelaySeconds, outcomeDelaySeconds)
}

/** Lets the hold after an answer run out. */
function playOut() {
	const { recovery } = game.run.value
	tickRun(game, recovery, recovery)
}

beforeEach(() => {
	// Ending a run writes the app-wide high scores and last run, and starting one reads them.
	highScores.value.reset()
	lastRun.value.reset()
	settings.value.reset()
	game = createRunGame()
	startRun(game, fixtureQuiz)
	tickRun(game, 2, 2)
})

describe('commitAmbush', () => {
	it('is refused while paused, and the ambush stays open', () => {
		openSingle()
		game.run.value.pause()
		game.ambush.value.pick(marks[0]!)
		commitAmbush(game)
		expect(game.ambush.value.open).toBe(true)
		expect(game.quiz.value.answered).toBe(0)
	})

	it('is refused during the countdown after resuming, then goes through', () => {
		openSingle()
		game.run.value.pause()
		game.run.value.resume()
		game.ambush.value.pick(marks[0]!)
		commitAmbush(game)
		expect(game.ambush.value.open).toBe(true)

		tickRun(game, runConfig.countdownSeconds, runConfig.countdownSeconds)
		commitAmbush(game)
		expect(game.ambush.value.open).toBe(false)
		expect(game.run.value).toMatchObject({ phase: 'running', countdown: 0, resumeTo: 'running' })
	})


	it('scores a correct answer, slays the slashed ninja and resumes the run', () => {
		answer(0)

		expect(game.score.value).toMatchObject({ points: 100, correct: 1, answered: 1 })
		expect(game.life.value.value).toBe(1)
		untilFirstMove()
		expect(game.ninjas.value.active[0]?.pose).toBe('slain')
		expect(game.shogun.value).toMatchObject({ pose: 'strike', target: 0 })
		expect(game.run.value.phase).toBe('running')
		expect(game.quiz.value.answered).toBe(1)
	})

	it('blocks the ninjas that were not picked, one after another, while the run holds', () => {
		answer(0)
		expect(game.run.value.recovery).toBe(outcomeDelaySeconds + moveSeconds + runConfig.strikeSeconds)
		untilFirstMove()
		expect(game.ninjas.value.active[1]?.pose).toBe('approach')

		tickRun(game, moveSeconds, moveSeconds)
		expect(game.shogun.value).toMatchObject({ pose: 'block', target: 1 })
		expect(game.ninjas.value.active.map((ninja) => ninja.pose)).toEqual(['slain', 'blocked'])
	})

	it('deals with every ninja even when one long frame takes in several moves', () => {
		game.run.value.beginAmbush()
		game.ninjas.value.clear()
		game.ninjas.value.spawn([0, 1, 2].map((id) => ({ id, wave: 0, options: [id] })))
		game.ambush.value.start({
			kind: 'single',
			at: game.quiz.value.current() ?? { question: 0, part: 0 },
			query: 'Which attribute?',
			options: [0, 1, 2].map((id) => ({ answer: `${id}`, correct: id === 1, mark: marks[id]!, ninja: id, pick: 0, source: id, rank: 0 })),
			choose: 1,
			seconds: 10,
			round: 1,
			rounds: 1,
		})
		game.ambush.value.pick(marks[1]!)
		commitAmbush(game)
		const twoMovesIn = outcomeDelaySeconds + moveSeconds * 2 + 0.01
		tickRun(game, twoMovesIn, twoMovesIn)
		expect(game.ninjas.value.active.map((ninja) => ninja.pose)).toEqual(['blocked', 'slain', 'blocked'])
	})

	it('deals with the ninjas in the order they were answered, the ones left alone last', () => {
		answer(0)
		untilFirstMove()
		expect(game.shogun.value).toMatchObject({ pose: 'strike', target: 0 })
		tickRun(game, moveSeconds, moveSeconds)
		expect(game.shogun.value).toMatchObject({ pose: 'block', target: 1 })
	})

	it('lets only the ninjas answered wrong land a hit, and blocks the others', () => {
		game.run.value.beginAmbush()
		game.ninjas.value.clear()
		game.ninjas.value.spawn([0, 1, 2].map((id) => ({ id, wave: 0, options: [id] })))
		game.ambush.value.start({
			kind: 'multiple',
			at: game.quiz.value.current() ?? { question: 0, part: 0 },
			query: 'Which are safe?',
			options: [0, 1, 2].map((id) => ({ answer: `${id}`, correct: id < 2, mark: marks[id]!, ninja: id, pick: 0, source: id, rank: 0 })),
			choose: 2,
			seconds: 10,
			round: 1,
			rounds: 1,
		})
		// The second correct one is left out: it is the one that hits.
		game.ambush.value.pick(marks[0]!)
		commitAmbush(game)
		// Slain as picked, the hit from the one left out, then the block.
		expect(game.run.value.recovery).toBeCloseTo(outcomeDelaySeconds + moveSeconds * 2 + runConfig.strikeSeconds)

		const twoMovesIn = outcomeDelaySeconds + moveSeconds * 2 + 0.01
		tickRun(game, twoMovesIn, twoMovesIn)
		expect(game.ninjas.value.active.map((ninja) => ninja.pose)).toEqual(['slain', 'strike', 'blocked'])
		expect(game.shogun.value.pose).toBe('block')
		playOut()
		expect(game.ninjas.value.active.map((ninja) => [ninja.id, ninja.pose])).toEqual([[0, 'slain'], [2, 'fleeing']])
	})

	it('takes the question share off the life bar on a miss and keeps the score', () => {
		answer(1)

		expect(game.score.value).toMatchObject({ points: 0, correct: 0, answered: 1 })
		expect(game.life.value.value).toBeCloseTo(1 - missShare(game))
		untilFirstMove()
		expect(game.shogun.value.pose).toBe('hurt')
		expect(game.quiz.value.misses()).toHaveLength(1)
	})

	it('falls when the pass mark is out of reach', () => {
		// Four questions at a 70% pass mark leave a margin of 1.2 points: the second miss is too many.
		answer(1)
		answer(1)
		expect(game.life.value.empty()).toBe(true)

		// The hits play out first; then the ninjas vanish and the samurai falls.
		expect(game.run.value.phase).toBe('running')
		expect(game.run.value.recovery).toBe(outcomeDelaySeconds + moveSeconds + runConfig.hitSeconds)
		untilFirstMove()
		expect(game.shogun.value.pose).toBe('hurt')
		playOut()
		expect(game.run.value.phase).toBe('fallen')
		expect(game.shogun.value.pose).toBe('fallen')
		expect(game.ninjas.value.active).toHaveLength(0)
	})

	it('finishes the run after the last question', () => {
		fixtureQuiz.questions.forEach(() => { answer(0) })

		// The last strike plays out first; then the ninja he blocked flees and the run is done.
		expect(game.run.value.phase).toBe('running')
		expect(game.run.value.recovery).toBe(outcomeDelaySeconds + moveSeconds + runConfig.strikeSeconds)
		playOut()
		expect(game.run.value.phase).toBe('finished')
		expect(game.ninjas.value.active.find((ninja) => ninja.id === 1)?.pose).toBe('fleeing')
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

	it('opens without a time limit when there is none, as in the dojo', () => {
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
		playOut()
		expect(game.run.value.phase).toBe('finished')
		expect(game.score.value.correct).toBe(fixtureQuiz.questions.length)
	})
})

describe('tickRun', () => {
	// An ambush slows the world down, but its time limit runs on real time.
	const tickReal = (seconds: number) => { tickRun(game, seconds * game.run.value.worldScale, seconds) }

	it('lets the ninjas creep in as the ambush time runs out', () => {
		openSingle()
		tickReal(5)
		expect(game.ambush.value.secondsLeft).toBeCloseTo(7)
		expect(game.ninjas.value.active[0]?.approach).toBeCloseTo(0.3)
	})

	it('holds the time limit during the countdown after resuming', () => {
		openSingle()
		game.run.value.pause()
		game.run.value.resume()
		tickReal(runConfig.countdownSeconds)
		expect(game.run.value.phase).toBe('ambush')
		expect(game.ambush.value.secondsLeft).toBe(10)
	})

	it('ends the ambush unanswered when the time runs out, half-swiped or not', () => {
		openSingle()
		game.ambush.value.pick(marks[0]!)
		tickReal(12)

		expect(game.ambush.value.open).toBe(false)
		expect(game.quiz.value.records).toEqual([{ at: { question: 0, part: 0 }, outcome: 'unanswered', picked: [0] }])
		expect(game.life.value.value).toBeCloseTo(1 - missShare(game))
		expect(game.score.value.points).toBe(0)
	})

	it('has the first ninja in front slice the scroll when the time runs out, and all of them strike', () => {
		openSingle()
		tickReal(12)

		expect(game.ninjas.value.active.map((ninja) => [ninja.pose, ninja.slicer])).toEqual([['strike', true], ['strike', false]])
	})

	it('has no slicer on a wrong answer', () => {
		openSingle()
		answer(1)

		expect(game.ninjas.value.active.every((ninja) => ninja.slicer !== true)).toBe(true)
	})
})
