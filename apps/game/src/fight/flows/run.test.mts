import type { BunbuData, Markdown } from '@bunbu/data'
import { beforeEach, describe, expect, it } from 'vitest'
import { selection, stages } from '../../_shared/state/selection.mts'
import { fixtureQuiz } from '../../_temp/quiz.mts'
import { seeded } from '../../_temp/random.mts'
import { settings } from '../../settings/state/settings.mts'
import { quizDifficulties } from '../state/difficulty.mts'
import { createRunGame, type RunGame } from '../state/game.mts'
import { highScores } from '../state/highscores.mts'
import { lastRun } from '../state/lastrun.mts'
import { shareOfOnePoint } from '../state/life.mts'
import { runConfig } from '../state/run.mts'
import { stageResults } from '../state/stage-results.mts'
import { nextScrollSeconds } from '../../_shared/state/ambush.mts'
import { commitAmbush, outcomeDelaySeconds } from './ambush.mts'
import { loaded, questionsAnswered } from '../../_shared/state/quiz.mts'
import { notRunning } from '../state/run.mts'
import { missShare } from './ambush.mts'
import { ambushAt, endRun, metresPerAmbush, startRun, testOf, tickRun } from './run.mts'

let game: RunGame

/** Runs until the next ambush springs. */
function runToAmbush() {
	for (let step = 0; step < 1000 && game.run.value.phase !== 'ambush'; step++) tickRun(game, 0.5, 0.5)
}

/** Answers the open ambush: the right marks (in the right order for `order`), or a wrong one. */
function answer(correct: boolean) {
	const { ambush } = game
	const { kind, options } = ambush.value
	const picks = correct
		? options.filter((option) => option.correct).toSorted((a, b) => a.rank - b.rank)
		: kind === 'order' ? options.toSorted((a, b) => b.rank - a.rank) : options.filter((option) => !option.correct).slice(0, 1)
	for (const option of picks) ambush.value.pick(option.mark)
	commitAmbush(game)
}

/** Runs and answers every ambush. `rights` says for each one whether it is answered correctly. */
function play(rights: readonly boolean[]) {
	for (const right of rights) {
		runToAmbush()
		answer(right)
		// Let the samurai recover, or the next scroll open.
		const wait = Math.max(2, game.run.value.recovery + 0.1)
		tickRun(game, wait, wait)
	}
}

beforeEach(() => {
	game = createRunGame()
	settings.value.reset()
	quizDifficulties.value.reset()
	highScores.value.reset()
	lastRun.value.reset()
	stageResults.value.reset()
	selection.value.reset()
	startRun(game, fixtureQuiz)
})

describe('the run', () => {
	it('springs an ambush at the end of each leg of the path', () => {
		runToAmbush()
		expect(game.run.value.distance).toBeCloseTo(ambushAt(0))
		expect(game.ambush.value.open).toBe(true)
		expect(game.run.value.phase).toBe('ambush')
	})

	it('does not spring one during the intro', () => {
		tickRun(game, 0.1, 0.1)
		expect(game.run.value.phase).toBe('intro')
		expect(game.ambush.value.open).toBe(false)
	})

	it('holds the samurai after a hit for about a second, then lets him run again', () => {
		runToAmbush()
		answer(false)
		const { distance } = game.run.value
		tickRun(game, outcomeDelaySeconds, outcomeDelaySeconds)
		expect(game.shogun.value.pose).toBe('hurt')

		tickRun(game, 0.5, 0.5)
		expect(game.run.value.distance).toBe(distance)
		expect(game.shogun.value.pose).toBe('hurt')

		tickRun(game, 0.6, 0.6)
		expect(game.shogun.value.pose).toBe('run')
		tickRun(game, 1, 1)
		expect(game.run.value.distance).toBeGreaterThan(distance)
	})

	it('cannot be paused before it has started', () => {
		game.run.value.reset()
		game.run.value.pause()
		expect(game.run.value.phase).toBe('idle')
	})

	it('keeps the hold after an ambush through a pause and its countdown', () => {
		runToAmbush()
		answer(false)
		const hold = game.run.value.recovery
		tickRun(game, 0.5, 0.5)
		game.run.value.pause()
		game.run.value.resume()
		tickRun(game, runConfig.countdownSeconds, runConfig.countdownSeconds)
		expect(game.run.value.recovery).toBeCloseTo(hold - 0.5)
		expect(game.shogun.value.pose).toBe('hurt')

		tickRun(game, hold, hold)
		expect(game.shogun.value.pose).toBe('run')
	})

	it('finishes after the last answer, with the time of the whole run', () => {
		play([true, true, true, true])
		expect(game.run.value.phase).toBe('finished')
		expect(game.score.value).toMatchObject({ points: 400, correct: 4, answered: 4 })
		expect(game.run.value.elapsed).toBeGreaterThan(0)
	})

	it('lets the samurai fall when the pass mark is out of reach', () => {
		// 4 points with a 70% pass mark leave a margin of 1.2 points: the second miss empties the bar.
		play([false, false])
		expect(game.run.value.phase).toBe('fallen')
		expect(game.shogun.value.pose).toBe('fallen')
	})

	it('ends once, and keeps its result once', () => {
		play([true, true, true])
		runToAmbush()
		answer(true)
		const hold = game.run.value.recovery
		const best = highScores.value.of('fixture', '1')

		// Another commit after the last answer is refused, and changes nothing that was kept.
		commitAmbush(game)
		tickRun(game, hold, hold)
		endRun(game)
		expect(game.run.value.phase).toBe('finished')
		expect(highScores.value.of('fixture', '1')).toEqual(best)
		expect(game.score.value.newBest).toBe(true)
	})
})

describe('high score', () => {
	it('is set by a passed run and shown as a new best, with the time the run ends at', () => {
		play([true, true, true])
		runToAmbush()
		answer(true)
		// The run ends when the hold after the last answer does.
		const hold = game.run.value.recovery
		const ends = game.run.value.elapsed + hold
		tickRun(game, hold, hold)
		expect(game.run.value.phase).toBe('finished')
		expect(game.run.value.elapsed).toBeCloseTo(ends)

		const best = highScores.value.of('fixture', '1')
		expect(best).toMatchObject({ points: 400, correct: 4, answered: 4 })
		expect(best?.seconds).toBeCloseTo(ends)
		expect(game.score.value.newBest).toBe(true)
	})

	it('is kept the moment the last answer is in, so a pause in the last hold loses nothing', () => {
		play([true, true, true])
		runToAmbush()
		answer(true)
		const hold = game.run.value.recovery
		const best = highScores.value.of('fixture', '1')
		expect(best).toMatchObject({ points: 400, correct: 4, answered: 4 })
		// The misses are kept too, for this quiz: none, every answer was right.
		expect(lastRun.value.quiz).toBeDefined()
		expect(lastRun.value.missesOf('fixture', '1')).toEqual([])

		// Paused in the hold, resumed, counted down: the run ends once, at the time that was kept.
		game.run.value.pause()
		tickRun(game, 5, 5)
		game.run.value.resume()
		tickRun(game, runConfig.countdownSeconds, runConfig.countdownSeconds)
		expect(game.run.value.phase).toBe('running')
		tickRun(game, hold, hold)
		expect(game.run.value.phase).toBe('finished')
		expect(game.run.value.elapsed).toBeCloseTo(best?.seconds ?? 0)
		expect(highScores.value.of('fixture', '1')).toEqual(best)
	})

	it('is not set by a fallen run', () => {
		play([false, false])
		expect(game.run.value.phase).toBe('fallen')
		expect(highScores.value.of('fixture', '1')).toBeUndefined()
		expect(game.score.value.newBest).toBe(false)
	})

	it('is the one to beat in the next run, and is kept when it is beaten by none', () => {
		highScores.value.submit('fixture', '1', { points: 400, seconds: 1, correct: 4, answered: 4, difficulty: 'samurai' })
		startRun(game, fixtureQuiz)
		expect(game.score.value.best).toMatchObject({ points: 400, seconds: 1 })

		play([true, true, true, true])
		expect(game.score.value.newBest).toBe(false)
		expect(highScores.value.of('fixture', '1')?.seconds).toBe(1)
	})

	it('does not carry over to a run of a quiz without one', () => {
		highScores.value.submit('fixture', '1', { points: 400, seconds: 1, correct: 4, answered: 4, difficulty: 'samurai' })
		startRun(game, fixtureQuiz)
		expect(game.score.value.best).toBeDefined()

		startRun(game, { ...fixtureQuiz, version: '2' })
		expect(game.score.value.best).toBeUndefined()
	})

	it('is per quiz version', () => {
		highScores.value.submit('fixture', '1', { points: 400, seconds: 1, correct: 4, answered: 4, difficulty: 'samurai' })
		expect(highScores.value.of('fixture', '2')).toBeUndefined()
		expect(highScores.value.of('other', '1')).toBeUndefined()
	})
})

describe('the last run', () => {
	it('keeps its misses for practising them, finished or fallen', () => {
		play([false, true, false])
		expect(lastRun.value.missesOf('fixture', '1')).toHaveLength(2)
		expect(lastRun.value.missesOf('fixture', '1')[0]).toMatchObject({ at: { question: 0, part: 0 }, outcome: 'wrong' })
		expect(lastRun.value.missesOf('other', '1')).toEqual([])
	})

	it('is replaced by the next run', () => {
		play([false, false])
		startRun(game, fixtureQuiz)
		play([true, true, true, true])
		expect(lastRun.value.missesOf('fixture', '1')).toEqual([])
	})
})

describe('stage results', () => {
	it('marks the stage cleared by a finished run, at its full length', () => {
		play([true, true, true, true])

		expect(stageResults.value.of('fixture', '1', 'rice-fields')).toEqual({ distance: 4 * metresPerAmbush, cleared: true })
	})

	it('keeps how far a fallen run got', () => {
		play([false, false])

		expect(stageResults.value.of('fixture', '1', 'rice-fields')).toEqual({ distance: ambushAt(1), cleared: false })
	})

	it('keeps the best of the runs on a stage', () => {
		play([true, true, true, true])
		startRun(game, fixtureQuiz)

		play([false, false])

		expect(stageResults.value.of('fixture', '1', 'rice-fields')).toMatchObject({ cleared: true })
	})

	it('is per stage', () => {
		selection.value.chooseStage('castle-town')

		play([false, false])

		expect(stageResults.value.of('fixture', '1', 'castle-town')).toMatchObject({ cleared: false })
		expect(stageResults.value.of('fixture', '1', 'rice-fields')).toBeUndefined()
	})
})

describe('unlocking stages', () => {
	it('opens only the first stage on a new quiz', () => {
		expect(stages.filter((stage) => stageResults.value.unlocked('fixture', '1', stage))).toEqual(['rice-fields'])
	})

	it('unlocks the next stage when a run passes', () => {
		play([true, true, true, true])

		expect(stageResults.value.unlocked('fixture', '1', 'bamboo-forest')).toBe(true)
		expect(stageResults.value.unlocked('fixture', '1', 'mountain-temple')).toBe(false)
		expect(game.score.value.unlocked).toBe('bamboo-forest')
	})

	it('unlocks nothing when the samurai falls', () => {
		play([false, false])

		expect(stageResults.value.unlocked('fixture', '1', 'bamboo-forest')).toBe(false)
		expect(game.score.value.unlocked).toBeUndefined()
	})

	it('tells only the run that unlocked it', () => {
		play([true, true, true, true])
		startRun(game, fixtureQuiz)

		play([true, true, true, true])

		expect(game.score.value.unlocked).toBeUndefined()
	})

	it('is per quiz version', () => {
		play([true, true, true, true])

		expect(stageResults.value.unlocked('fixture', '2', 'bamboo-forest')).toBe(false)
	})

	it('has nothing to unlock after the last stage', () => {
		selection.value.chooseStage('edo-castle')

		play([true, true, true, true])

		expect(game.score.value.unlocked).toBeUndefined()
	})
})

describe('the difficulty', () => {
	it('is the one chosen for the quiz, kept for the whole run', () => {
		const timed = { ...fixtureQuiz, timePerQuestion: '1m' }
		quizDifficulties.value.choose('fixture', '1', 'shogun')
		startRun(game, timed)
		quizDifficulties.value.choose('fixture', '1', 'apprentice')

		runToAmbush()

		expect(game.run.value.difficulty).toBe('shogun')
		expect(game.ambush.value.seconds).toBe(30)
	})
})

describe('a test', () => {
	const many: BunbuData = { ...fixtureQuiz, questions: Array.from({ length: 10 }, () => fixtureQuiz.questions[0]!) }

	it('asks every question in file order without a random', () => {
		expect(testOf(many)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
	})

	it('asks every question, shuffled, with a random', () => {
		const order = testOf(many, seeded(3))

		expect(order).not.toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
		expect(order.toSorted((first, second) => first - second)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
	})

	it('asks a different order on another run', () => {
		const random = seeded(3)

		expect(testOf(many, random)).not.toEqual(testOf(many, random))
	})

	it('picks questionsPerTest of them at random', () => {
		const order = testOf({ ...many, questionsPerTest: 4 }, seeded(3))

		expect(order).toHaveLength(4)
		expect(new Set(order).size).toBe(4)
	})

	it('asks them all when the quiz has fewer than questionsPerTest', () => {
		expect(testOf({ ...many, questionsPerTest: 40 }, seeded(3))).toHaveLength(10)
	})

	it('makes the stage as long as the questions it asks', () => {
		startRun(game, { ...many, questionsPerTest: 4 }, seeded(3))

		expect(game.quiz.value.order).toHaveLength(4)
		expect(game.run.value.stageLength).toBe(4 * metresPerAmbush)
	})
})

describe('questions of several ambushes', () => {
	const markdown = (text: string) => text as Markdown
	// One `match` question of two rows and one `solutions` question of two entries: 2 points each.
	const quiz: BunbuData = {
		...fixtureQuiz,
		passingScore: 30,
		questions: [
			{
				type: 'match',
				query: markdown('Match the status codes.'),
				rows: [
					{ text: markdown('`200`'), answer: markdown('Success') },
					{ text: markdown('`404`'), answer: markdown('Not found') },
				],
			},
			{
				type: 'solutions',
				query: markdown('Does it meet the goal?'),
				scenario: markdown('A page must load fast.'),
				options: [
					{ answer: markdown('Cache it'), correct: true },
					{ answer: markdown('Add a spinner'), correct: false },
				],
			},
		],
	}

	beforeEach(() => {
		startRun(game, quiz)
	})

	it('scores every row of a match question on its own', () => {
		play([true])
		expect(game.score.value).toMatchObject({ points: 100, correct: 1, answered: 1 })
		play([true])
		expect(game.score.value).toMatchObject({ points: 200, correct: 2, answered: 2 })
	})

	it('takes a share of the life bar for every row missed', () => {
		play([false, false])
		expect(game.life.value.hits).toBe(2)
		expect(game.life.value.value).toBeCloseTo(1 - 2 * shareOfOnePoint(4, 30))
		expect(game.score.value).toMatchObject({ points: 0, correct: 0, answered: 2 })
	})

	it('still scores the rows answered right next to one missed', () => {
		play([false, true])
		expect(game.score.value).toMatchObject({ points: 100, correct: 1, answered: 2 })
	})

	it('asks the rounds of a question one after another, in the same attack', () => {
		runToAmbush()
		const ninjas = game.ninjas.value.active.map((ninja) => ninja.id)
		game.ambush.value.tick(game.ambush.value.openingLeft + 1)
		const { seconds, secondsLeft } = game.ambush.value
		answer(true)

		expect(game.run.value.phase).toBe('ambush')
		expect(game.ambush.value).toMatchObject({ open: true, round: 2, rounds: 2, openingLeft: nextScrollSeconds, seconds, secondsLeft })
		expect(game.ninjas.value.active.map((ninja) => ninja.id)).toEqual(ninjas)
		expect(game.ninjas.value.active.every((ninja) => ninja.pose === 'approach')).toBe(true)
		// The time waits for the next scroll to open.
		tickRun(game, 0.1, nextScrollSeconds)
		expect(game.ambush.value.secondsLeft).toBe(secondsLeft)
	})

	it('costs the life bar on a wrong round at once, and the next scroll still comes', () => {
		runToAmbush()
		answer(false)
		expect(game.life.value.hits).toBe(1)
		expect(game.ambush.value).toMatchObject({ open: true, round: 2 })
	})

	it('plays out what every round did to the ninjas once the last one is answered', () => {
		const row = (text: string, meaning: string) => ({ text: markdown(text), answer: markdown(meaning) })
		// With the solutions after it, so one miss doesn't empty the bar.
		const withDistractor: BunbuData = {
			...quiz,
			questions: [{
				type: 'match',
				query: markdown('Match the status codes.'),
				rows: [row('`200`', 'Success'), row('`404`', 'Not found')],
				distractors: [markdown('Teapot')],
			}, quiz.questions[1]!],
		}
		const verdicts = () => game.ninjas.value.active.map((ninja) => ninja.verdict ?? 'none').toSorted((first, second) => first.localeCompare(second))

		// Both rows right: the two answers are slashed, the distractor blocked.
		startRun(game, withDistractor)
		runToAmbush()
		answer(true)
		tickRun(game, 0.1, nextScrollSeconds)
		answer(true)
		expect(verdicts()).toEqual(['block', 'slash', 'slash'])
		tickRun(game, game.run.value.recovery - 0.01, game.run.value.recovery - 0.01)
		expect(game.ninjas.value.active.map((ninja) => ninja.pose).toSorted((first, second) => first.localeCompare(second))).toEqual(['blocked', 'slain', 'slain'])

		// The first row answered with the distractor: it and the answer it should have been stay
		// misses; the second row's answer is still slashed.
		startRun(game, withDistractor)
		runToAmbush()
		const first = game.ambush.value.query
		const teapot = game.ambush.value.options.find((option) => option.answer === 'Teapot')
		game.ambush.value.pick(teapot!.mark)
		commitAmbush(game)
		tickRun(game, 0.1, nextScrollSeconds)
		const right = first.includes('200') ? 'Not found' : 'Success'
		expect(verdicts()).toEqual(['block', 'miss', 'miss'])
		const rightNinja = game.ambush.value.options.find((option) => option.answer === right)?.ninja
		answer(true)
		expect(game.ninjas.value.active.find((ninja) => ninja.id === rightNinja)?.verdict).toBe('slash')
		tickRun(game, game.run.value.recovery - 0.01, game.run.value.recovery - 0.01)
		expect(game.ninjas.value.active.filter((ninja) => ninja.pose === 'strike')).toHaveLength(2)
		expect(game.ninjas.value.active.filter((ninja) => ninja.pose === 'slain')).toHaveLength(1)
	})

	it('leaves every round still to come unanswered when the time runs out', () => {
		runToAmbush()
		game.ambush.value.tick(game.ambush.value.seconds + game.ambush.value.openingLeft)
		tickRun(game, 0.1, 0.1)

		expect(game.quiz.value.records.map((record) => record.outcome)).toEqual(['unanswered', 'unanswered'])
		expect(game.life.value.hits).toBe(2)
		expect(game.run.value.phase).toBe('running')
	})

	it('springs the next question on the next leg of the path', () => {
		play([true, true])
		runToAmbush()
		expect(game.ambush.value.at.question).toBe(1)
		expect(game.run.value.distance).toBeCloseTo(ambushAt(1))
		expect(game.run.value.stageLength).toBe(2 * metresPerAmbush)
	})

	it('scores every solutions entry on its own', () => {
		play([true, true, true, false])
		expect(game.run.value.phase).toBe('finished')
		expect(game.score.value).toMatchObject({ points: 300, correct: 3, answered: 4 })
		expect(game.life.value.hits).toBe(1)
	})
})

describe('frames', () => {
	it('never carries the samurai past an ambush, whatever the frame length', () => {
		tickRun(game, 2, 2)
		for (let frame = 0; frame < 300 && game.run.value.phase !== 'ambush'; frame++) tickRun(game, 0.1, 0.1)
		expect(game.run.value.distance).toBeCloseTo(ambushAt(0))
	})

	it('counts the frame that ends the last ambush, and the hold after it, in the run\'s time', () => {
		play([true, true, true])
		runToAmbush()
		const before = game.run.value.elapsed
		// The ambush times out on this frame, which is the last answer of the run.
		game.ambush.value.tick(game.ambush.value.seconds + game.ambush.value.openingLeft)
		tickRun(game, 0.1, 0.1)
		expect(game.run.value.phase).toBe('running')
		// The hit plays out, then the run is finished: 3 of 4 still passes.
		tickRun(game, runConfig.slicedSeconds, runConfig.slicedSeconds)
		expect(game.run.value.phase).toBe('finished')
		const seconds = before + 0.1 + runConfig.slicedSeconds
		expect(game.run.value.elapsed).toBeCloseTo(seconds)
		expect(highScores.value.of('fixture', '1')?.seconds).toBeCloseTo(seconds)
	})

	it('does not take the frame that times an ambush out off the recovery', () => {
		runToAmbush()
		game.ambush.value.tick(game.ambush.value.seconds + game.ambush.value.openingLeft)
		tickRun(game, 0.1, 0.1)
		expect(game.run.value.recovery).toBe(runConfig.slicedSeconds)
	})
})

it('puts the ambush on the leg of the path it belongs to', () => {
	expect(ambushAt(0)).toBe(metresPerAmbush)
	expect(ambushAt(2)).toBe(3 * metresPerAmbush)
})

describe('endless', () => {
	beforeEach(() => {
		selection.value.chooseEndless()
		startRun(game, fixtureQuiz)
	})

	it('goes on past every question, round again', () => {
		play([true, true, true, true, true, true, true, true, true])
		expect(game.run.value.phase).not.toBe('finished')
		expect(questionsAnswered(game.quiz.value)).toBe(9)
		expect(game.score.value.points).toBe(900)
	})

	it('fills the life bar again when a stage is done: each stage is a test of its own', () => {
		play([false, true, true])
		expect(game.life.value.value).toBeLessThan(1)
		play([true])
		expect(game.life.value.value).toBe(1)
		play([false, true, true, true])
		expect(game.run.value.phase).not.toBe('fallen')
	})

	it('ends only with a fall, which sets its own high score and no stage result', () => {
		play([true, false, false])
		expect(game.run.value.phase).toBe('fallen')
		expect(highScores.value.of('fixture', '1', true)).toMatchObject({ points: 100, correct: 1, answered: 3 })
		expect(highScores.value.of('fixture', '1')).toBeUndefined()
		expect(stageResults.value.of('fixture', '1', 'rice-fields')).toBeUndefined()
	})

	it('starts with the best of endless to beat', () => {
		highScores.value.submit('fixture', '1', { points: 300, seconds: 1, correct: 3, answered: 4, difficulty: 'samurai' }, true)
		startRun(game, fixtureQuiz)
		expect(game.score.value.best).toMatchObject({ points: 300 })
	})
})

describe('unlocking endless', () => {
	const clearAll = (difficulty: 'samurai' | 'shogun') => {
		for (const stage of stages) {
			selection.value.chooseStage(stage)
			startRun(game, fixtureQuiz, undefined, difficulty)
			play([true, true, true, true])
		}
	}

	it('opens once every stage has been cleared on Shogun', () => {
		clearAll('samurai')
		expect(stageResults.value.endlessUnlocked('fixture', '1')).toBe(false)
		clearAll('shogun')
		expect(stageResults.value.endlessUnlocked('fixture', '1')).toBe(true)
	})

	it('keeps a clear on Shogun when a better run on an easier difficulty comes after', () => {
		startRun(game, fixtureQuiz, undefined, 'shogun')
		play([true, true, true, false])
		startRun(game, fixtureQuiz, undefined, 'samurai')
		play([true, true, true, true])
		expect(stageResults.value.of('fixture', '1', 'rice-fields')).toMatchObject({ cleared: true, shogun: true })
	})
})

describe('endless, asking the same question again', () => {
	const yesNo = (query: string) => ({ type: 'yes-no' as const, query: query as Markdown, answer: 'yes' as const })

	it('goes on with a quiz of one question, each time an ambush of its own farther along', () => {
		selection.value.chooseEndless()
		startRun(game, { ...fixtureQuiz, questions: [yesNo('Only?')] })
		play([true, true, true])
		expect(questionsAnswered(game.quiz.value)).toBe(3)
		runToAmbush()
		expect(game.run.value.distance).toBeCloseTo(ambushAt(3))
	})

	it('counts a question in a stage twice as two points, so one miss is not the end', () => {
		const five = { ...fixtureQuiz, questionsPerTest: 4, questions: [0, 1, 2, 3, 4].map((each) => yesNo(`${each}?`)) }
		// A stage across a new round of the quiz: question 4 at its end, then again at the start.
		game = createRunGame({ quiz: loaded(five, [4, 0, 4, 1]), run: { ...notRunning, phase: 'running', stageLength: Infinity } })
		expect(missShare(game)).toBeCloseTo(shareOfOnePoint(4, 70))
	})

	it('asks the rounds of a question once each time, not every time it was ever asked', () => {
		const solutions = {
			type: 'solutions' as const,
			query: 'Which?' as Markdown,
			scenario: 'A goal.' as Markdown,
			options: [0, 1, 2].map((each) => ({ answer: `${each}` as Markdown, correct: each === 0 })),
		}
		selection.value.chooseEndless()
		startRun(game, { ...fixtureQuiz, questions: [solutions, yesNo('And?')] })
		play([true, true, true, true])
		runToAmbush()
		expect(game.ambush.value.rounds).toBe(3)
	})
})
