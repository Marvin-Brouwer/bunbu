import type { BunbuData, Markdown } from '@bunbu/data'
import { beforeEach, describe, expect, it } from 'vitest'
import { fixtureQuiz } from '../../_temp/quiz.mts'
import { settings } from '../../settings/state/settings.mts'
import { createRunGame, type RunGame } from '../state/game.mts'
import { highScores } from '../state/highscores.mts'
import { lastRun } from '../state/lastrun.mts'
import { shareOfOnePoint } from '../state/life.mts'
import { runConfig } from '../state/run.mts'
import { commitAmbush } from './ambush.mts'
import { ambushAt, endRun, metresPerAmbush, startRun, tickRun } from './run.mts'

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
		// Let the samurai recover.
		tickRun(game, 2, 2)
	}
}

beforeEach(() => {
	game = createRunGame()
	settings.value.reset()
	highScores.value.reset()
	lastRun.value.reset()
	startRun(game, fixtureQuiz)
})

describe('the run', () => {
	it('springs an ambush at the end of each leg of the path', () => {
		runToAmbush()
		expect(game.run.value.distance).toBeCloseTo(ambushAt(0))
		expect(game.ambush.value.open).toBe(true)
		expect(game.run.value.worldScale).toBe(runConfig.ambushWorldScale)
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
		expect(game.shogun.value.pose).toBe('hurt')

		tickRun(game, 0.5, 0.5)
		expect(game.run.value.distance).toBe(distance)
		expect(game.shogun.value.pose).toBe('hurt')

		tickRun(game, 0.6, 0.6)
		expect(game.shogun.value.pose).toBe('run')
		tickRun(game, 1, 1)
		expect(game.run.value.distance).toBeGreaterThan(distance)
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

	it('ends once', () => {
		play([true, true, true, true])
		endRun(game)
		expect(game.score.value.newBest).toBe(true)
	})
})

describe('high score', () => {
	it('is set by a passed run and shown as a new best', () => {
		play([true, true, true, true])
		const best = highScores.value.of('fixture', '1')
		expect(best).toMatchObject({ points: 400, correct: 4, answered: 4 })
		expect(best?.seconds).toBe(game.run.value.elapsed)
		expect(game.score.value.newBest).toBe(true)
	})

	it('is not set by a fallen run', () => {
		play([false, false])
		expect(game.run.value.phase).toBe('fallen')
		expect(highScores.value.of('fixture', '1')).toBeUndefined()
		expect(game.score.value.newBest).toBe(false)
	})

	it('is the one to beat in the next run, and is kept when it is beaten by none', () => {
		highScores.value.submit('fixture', '1', { points: 400, seconds: 1, correct: 4, answered: 4 })
		startRun(game, fixtureQuiz)
		expect(game.score.value.best).toMatchObject({ points: 400, seconds: 1 })

		play([true, true, true, true])
		expect(game.score.value.newBest).toBe(false)
		expect(highScores.value.of('fixture', '1')?.seconds).toBe(1)
	})

	it('does not carry over to a run of a quiz without one', () => {
		highScores.value.submit('fixture', '1', { points: 400, seconds: 1, correct: 4, answered: 4 })
		startRun(game, fixtureQuiz)
		expect(game.score.value.best).toBeDefined()

		startRun(game, { ...fixtureQuiz, version: '2' })
		expect(game.score.value.best).toBeUndefined()
	})

	it('is per quiz version', () => {
		highScores.value.submit('fixture', '1', { points: 400, seconds: 1, correct: 4, answered: 4 })
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

describe('questions of several ambushes', () => {
	const markdown = (text: string) => text as Markdown
	// One `match` question of two rows (1 point) and one `solutions` question of two entries (2 points).
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

	it('scores a match question once, when all its rows are right', () => {
		play([true])
		expect(game.score.value).toMatchObject({ points: 0, correct: 0, answered: 0 })
		play([true])
		expect(game.score.value).toMatchObject({ points: 100, correct: 1, answered: 1 })
	})

	it('takes a match question\'s share of the life bar once, however many rows are missed', () => {
		play([false, false])
		expect(game.life.value.hits).toBe(1)
		expect(game.life.value.value).toBeCloseTo(1 - shareOfOnePoint(3, 30))
		expect(game.score.value).toMatchObject({ points: 0, correct: 0, answered: 1 })
	})

	it('does not score a match question with a row missed', () => {
		play([false, true])
		expect(game.score.value).toMatchObject({ points: 0, correct: 0, answered: 1 })
	})

	it('scores every solutions entry on its own', () => {
		play([true, true, true, false])
		expect(game.run.value.phase).toBe('finished')
		expect(game.score.value).toMatchObject({ points: 200, correct: 2, answered: 3 })
		expect(game.life.value.hits).toBe(1)
	})
})

describe('frames', () => {
	it('never carries the samurai past an ambush, whatever the frame length', () => {
		tickRun(game, 2, 2)
		for (let frame = 0; frame < 300 && game.run.value.phase !== 'ambush'; frame++) tickRun(game, 0.1, 0.1)
		expect(game.run.value.distance).toBeCloseTo(ambushAt(0))
	})

	it('counts the frame that ends the run in its time', () => {
		play([true, true, true])
		runToAmbush()
		const before = game.run.value.elapsed
		// The ambush times out on this frame, which is the last of the run.
		game.ambush.value.tick(game.ambush.value.seconds)
		tickRun(game, 0.1, 0.1)
		expect(game.run.value.phase).toBe('finished')
		expect(game.run.value.elapsed).toBeCloseTo(before + 0.1)
		expect(highScores.value.of('fixture', '1')?.seconds).toBeCloseTo(before + 0.1)
	})

	it('does not take the frame that times an ambush out off the recovery', () => {
		runToAmbush()
		game.ambush.value.tick(game.ambush.value.seconds)
		tickRun(game, 0.1, 0.1)
		expect(game.run.value.recovery).toBe(runConfig.hitSeconds)
	})
})

it('puts the ambush on the leg of the path it belongs to', () => {
	expect(ambushAt(0)).toBe(metresPerAmbush)
	expect(ambushAt(2)).toBe(3 * metresPerAmbush)
})
