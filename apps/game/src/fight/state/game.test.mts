/**
 * The stores are plain TypeScript, so they are tested without a browser: call actions, tick the
 * clock by hand and assert on `value`
 * ([testing](../../../../../docs/architecture/state.md#testing)).
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { createLife, shareOfOnePoint, type Life } from './life.mts'
import { createRunGame } from './game.mts'
import { createRun, marksPassed, ranInAmbushOf, runConfig, runInLeft, slowMotionOf, stageDistanceOf, type Run } from './run.mts'
import { beats, createScore, pointsPerCorrect, type HighScore, type Score } from './score.mts'

// Every test gets its own stores: a game mode creates them per run, so tests do the same.
let run: Run
let score: Score
let life: Life

beforeEach(() => {
	run = createRun()
	score = createScore()
	life = createLife()
})

describe('run', () => {
	it('runs through intro into running', () => {
		run.value.start(600)
		run.value.tick(runConfig.introSeconds, runConfig.introSeconds)
		expect(run.value.phase).toBe('running')
	})

	it('waits for the start behind the camera, then runs in to the start in the intro', () => {
		run.value.tick(5, 5)
		expect(run.value.elapsed).toBe(0)
		const runIn = runInLeft(run.value)
		expect(runIn).toBeCloseTo(runConfig.pace * runConfig.introSeconds)

		run.value.start(600)
		run.value.tick(runConfig.introSeconds / 2, runConfig.introSeconds / 2)
		expect(runInLeft(run.value)).toBeCloseTo(runIn / 2)
		run.value.pause()
		expect(runInLeft(run.value)).toBeCloseTo(runIn / 2)
		run.value.resume()
		run.value.tick(runConfig.countdownSeconds, runConfig.countdownSeconds)
		run.value.tick(runConfig.introSeconds / 2, runConfig.introSeconds / 2)
		expect(run.value.phase).toBe('running')
		expect(runInLeft(run.value)).toBe(0)
	})

	it('covers ground at a constant pace while running', () => {
		run.value.start(600)
		run.value.tick(runConfig.introSeconds, runConfig.introSeconds)
		run.value.tick(1, 1)
		expect(run.value.distance).toBeCloseTo(runConfig.pace)
	})

	it('slows the world down more and more during an ambush, and runs on in slow motion', () => {
		run.value.start(600)
		run.value.tick(runConfig.introSeconds, runConfig.introSeconds)
		run.value.beginAmbush()
		const { distance } = run.value
		run.value.tick(0.1, 1)
		expect(run.value.worldScale).toBeCloseTo(slowMotionOf(1))
		expect(run.value.distance).toBeCloseTo(distance + runConfig.pace * 0.1)
		run.value.tick(0.01, 1)
		expect(run.value.worldScale).toBeLessThan(slowMotionOf(1))
	})

	it('keeps the world running on at his slowed pace in an ambush, legs and ground in step', () => {
		run.value.start(600)
		run.value.tick(runConfig.introSeconds, runConfig.introSeconds)
		run.value.beginAmbush()
		const { distance, stepped } = run.value
		for (let frame = 0; frame < 600; frame++) run.value.tick(run.value.worldScale / 60, 1 / 60)
		expect(run.value.distance - distance).toBeCloseTo(run.value.stepped - stepped)
		expect(run.value.distance - distance).toBeCloseTo(ranInAmbushOf(10), 0)
	})

	it('slows down hard at first, then ever less, never to a stop', () => {
		expect(slowMotionOf(0)).toBe(1)
		expect(slowMotionOf(runConfig.slowMotion.halfSpeedAfter)).toBeCloseTo(0.5)
		expect(slowMotionOf(1) - slowMotionOf(2)).toBeGreaterThan(slowMotionOf(2) - slowMotionOf(3))
		expect(slowMotionOf(600)).toBe(runConfig.slowMotion.slowest)
	})

	it('runs on past the end of the stage only in an ambush, and counts the stage up to its end', () => {
		run.value.start(10)
		run.value.tick(runConfig.introSeconds, runConfig.introSeconds)
		run.value.tick(5, 5)
		expect(run.value.distance).toBe(10)
		run.value.beginAmbush()
		run.value.tick(0.5, 1)
		expect(run.value.distance).toBeGreaterThan(10)
		expect(stageDistanceOf(run.value)).toBe(10)
	})

	it('counts the run down from 3 when resuming, then returns to the phase it paused in', () => {
		run.value.start(600)
		run.value.tick(runConfig.introSeconds, runConfig.introSeconds)
		run.value.pause()
		run.value.tick(5, 5)
		expect(run.value.elapsed).toBeCloseTo(runConfig.introSeconds)

		run.value.resume()
		expect(run.value.countdown).toBe(runConfig.countdownSeconds)
		run.value.tick(runConfig.countdownSeconds, runConfig.countdownSeconds)
		expect(run.value.phase).toBe('running')
	})

	it('counts the run time and the countdown in real time, also in an ambush\'s slow motion', () => {
		run.value.start(600)
		run.value.tick(runConfig.introSeconds, runConfig.introSeconds)
		run.value.beginAmbush()
		run.value.pause()
		run.value.resume()
		run.value.tick(runConfig.countdownSeconds * run.value.worldScale, runConfig.countdownSeconds)
		expect(run.value.phase).toBe('ambush')
		expect(run.value.countdown).toBe(0)

		run.value.tick(run.value.worldScale, 1)
		expect(run.value.elapsed).toBeCloseTo(runConfig.introSeconds + 1)
	})

	it('refuses to resume a run that is not paused', () => {
		run.value.start(600)
		run.value.resume()
		expect(run.value.phase).toBe('intro')
	})
})

describe('score', () => {
	it('scores a flat 100 per correct answer and nothing for a miss', () => {
		score.value.addCorrect()
		score.value.addMiss()
		expect(score.value).toMatchObject({ points: pointsPerCorrect, correct: 1, answered: 2 })
	})

	it('breaks a tie on the shorter run time', () => {
		const best: HighScore = { points: 2000, seconds: 245, correct: 20, answered: 20, difficulty: 'samurai' }
		expect(beats({ ...best, seconds: 240 }, best)).toBe(true)
		expect(beats({ ...best, seconds: 250 }, best)).toBe(false)
		expect(beats({ ...best, points: 2100, seconds: 999 }, best)).toBe(true)
	})
})

describe('life', () => {
	it('spends the error margin, not the whole bar: 20 points at 70% means six misses', () => {
		const share = shareOfOnePoint(20, 70)
		expect(share).toBeCloseTo(1 / 6)

		for (let miss = 0; miss < 5; miss++) life.value.hit(share)
		expect(life.value.empty()).toBe(false)

		life.value.hit(share)
		expect(life.value.value).toBe(0)
		expect(life.value.empty()).toBe(true)
	})
})

describe('run game', () => {
	it('gives every run its own state', () => {
		const first = createRunGame()
		const second = createRunGame()
		first.score.value.addCorrect()
		first.life.value.hit(0.5)

		expect(second.score.value.points).toBe(0)
		expect(second.life.value.value).toBe(1)
	})

	it('starts a run from a given state, for fixtures and tests', () => {
		const game = createRunGame({ life: { value: 0.25, lastLoss: 0.25, hits: 3 } })
		expect(game.life.value.value).toBe(0.25)
		expect(game.score.value.points).toBe(0)
	})
})

describe('quarter marks', () => {
	it('counts the marks behind the samurai, each one at a quarter of the stage', () => {
		expect(marksPassed({ distance: 0, stageLength: 1200 })).toBe(0)
		expect(marksPassed({ distance: 299, stageLength: 1200 })).toBe(0)
		expect(marksPassed({ distance: 300, stageLength: 1200 })).toBe(1)
		expect(marksPassed({ distance: 900, stageLength: 1200 })).toBe(3)
		expect(marksPassed({ distance: 1200, stageLength: 1200 })).toBe(3)
	})

	it('passes none before the stage has a length', () => {
		expect(marksPassed({ distance: 0, stageLength: 0 })).toBe(0)
	})
})
