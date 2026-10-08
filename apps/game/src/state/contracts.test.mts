/**
 * The stores are plain TypeScript, so they are tested without a browser: call actions, tick the
 * clock by hand and assert on `get()`
 * ([testing](../../../../docs/architecture/state.md#testing)).
 *
 * These cover the stubs the other tracks build against, not the rules they will fill in.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { ambush, marks, type AmbushOption } from './ambush.mts'
import { life, shareOfOnePoint } from './life.mts'
import { quiz, refsOf } from './quiz.mts'
import { run, runConfig } from './run.mts'
import { beats, pointsPerCorrect, score } from './score.mts'
import { settings, timeScales } from './settings.mts'
import { fixtureQuiz } from '../fixtures/quiz.mts'

const option = (answer: string, correct: boolean, index: number): AmbushOption => ({
	answer,
	correct,
	mark: marks[index]!,
	ninja: index,
	pick: 0,
})

beforeEach(() => {
	run.reset()
	score.reset()
	life.reset()
	settings.reset()
	ambush.close()
	quiz.load(fixtureQuiz)
})

describe('run', () => {
	it('runs through intro into running', () => {
		run.start(600)
		run.tick(runConfig.introSeconds)
		expect(run.get().phase).toBe('running')
	})

	it('covers ground at a constant pace while running', () => {
		run.start(600)
		run.tick(runConfig.introSeconds)
		run.tick(1)
		expect(run.get().distance).toBeCloseTo(runConfig.pace)
	})

	it('slows the world down during an ambush and does not cover ground', () => {
		run.start(600)
		run.tick(runConfig.introSeconds)
		run.beginAmbush()
		const { distance } = run.get()
		run.tick(1)
		expect(run.get().worldScale).toBe(runConfig.ambushWorldScale)
		expect(run.get().distance).toBe(distance)
	})

	it('counts the run down from 3 when resuming, then returns to the phase it paused in', () => {
		run.start(600)
		run.tick(runConfig.introSeconds)
		run.pause()
		run.tick(5)
		expect(run.get().elapsed).toBeCloseTo(runConfig.introSeconds)

		run.resume()
		expect(run.get().countdown).toBe(runConfig.countdownSeconds)
		run.tick(runConfig.countdownSeconds)
		expect(run.get().phase).toBe('running')
	})

	it('refuses to resume a run that is not paused', () => {
		run.start(600)
		run.resume()
		expect(run.get().phase).toBe('intro')
	})
})

describe('quiz', () => {
	it('asks one ambush per question, solution and row', () => {
		const refs = refsOf(fixtureQuiz, [0, 1, 2, 3])
		expect(refs).toHaveLength(4)
	})

	it('keeps misses for the review', () => {
		quiz.record({ at: { question: 0, part: 0 }, outcome: 'correct', picked: [0] })
		quiz.record({ at: { question: 1, part: 0 }, outcome: 'unanswered', picked: [] })
		expect(quiz.get().answered).toBe(2)
		expect(quiz.misses()).toHaveLength(1)
	})
})

describe('ambush', () => {
	const open = () => {
		ambush.open({
			kind: 'multiple',
			at: { question: 2, part: 0 },
			query: 'Which HTTP methods are safe?',
			options: [
				option('GET', true, 0),
				option('HEAD', true, 1),
				option('POST', false, 2),
			],
			choose: 2,
			seconds: 10,
		})
	}

	it('numbers picks in swipe order and renumbers when one is taken back', () => {
		open()
		ambush.pick(marks[0]!)
		ambush.pick(marks[1]!)
		expect(ambush.get().options.map((item) => item.pick)).toEqual([1, 2, 0])

		ambush.pick(marks[0]!)
		expect(ambush.get().options.map((item) => item.pick)).toEqual([0, 1, 0])
	})

	it('is correct when every slash is on a correct option and every block on a wrong one', () => {
		open()
		ambush.pick(marks[0]!)
		ambush.pick(marks[1]!)
		expect(ambush.commit()?.outcome).toBe('correct')
	})

	it('is wrong when a slash lands on an incorrect option', () => {
		open()
		ambush.pick(marks[0]!)
		ambush.pick(marks[2]!)
		expect(ambush.commit()?.outcome).toBe('wrong')
	})

	it('is unanswered when the time runs out, and a half-swiped answer does not count', () => {
		open()
		ambush.pick(marks[0]!)
		ambush.tick(10)
		expect(ambush.unanswered()).toBe(true)
		expect(ambush.commit()?.outcome).toBe('unanswered')
	})

	it('has no time limit when seconds is 0', () => {
		ambush.open({
			kind: 'single',
			at: { question: 1, part: 0 },
			query: 'Which attribute?',
			options: [option('alt', true, 0)],
			choose: 1,
			seconds: 0,
		})
		ambush.tick(60)
		expect(ambush.unanswered()).toBe(false)
	})

	it('ignores a pick when no ambush is open', () => {
		ambush.pick(marks[0]!)
		expect(ambush.get().open).toBe(false)
		expect(ambush.commit()).toBeUndefined()
	})
})

describe('score', () => {
	it('scores a flat 100 per correct answer and nothing for a miss', () => {
		score.addCorrect()
		score.addMiss()
		expect(score.get()).toMatchObject({ points: pointsPerCorrect, correct: 1, answered: 2 })
	})

	it('breaks a tie on the shorter run time', () => {
		const best = { points: 2000, seconds: 245, correct: 20, answered: 20 }
		expect(beats({ ...best, seconds: 240 }, best)).toBe(true)
		expect(beats({ ...best, seconds: 250 }, best)).toBe(false)
		expect(beats({ ...best, points: 2100, seconds: 999 }, best)).toBe(true)
	})
})

describe('life', () => {
	it('spends the error margin, not the whole bar: 20 points at 70% means six misses', () => {
		const share = shareOfOnePoint(20, 70)
		expect(share).toBeCloseTo(1 / 6)

		for (let miss = 0; miss < 5; miss++) life.hit(share)
		expect(life.empty()).toBe(false)

		life.hit(share)
		expect(life.get().value).toBe(0)
		expect(life.empty()).toBe(true)
	})
})

describe('settings', () => {
	it('maps the difficulty to a timeScale, with no limit for novice', () => {
		settings.setDifficulty('novice')
		expect(settings.timeScale()).toBeUndefined()
		settings.setDifficulty('master')
		expect(settings.timeScale()).toBe(timeScales.master)
	})
})
