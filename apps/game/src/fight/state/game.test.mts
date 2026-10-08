/**
 * The stores are plain TypeScript, so they are tested without a browser: call actions, tick the
 * clock by hand and assert on `value`
 * ([testing](../../../../../docs/architecture/state.md#testing)).
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { createLife, shareOfOnePoint, type Life } from './life.mts'
import { createRunGame } from './game.mts'
import { createRun, runConfig, type Run } from './run.mts'
import { beats, createScore, pointsPerCorrect, type Score } from './score.mts'

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
		run.value.tick(runConfig.introSeconds)
		expect(run.value.phase).toBe('running')
	})

	it('covers ground at a constant pace while running', () => {
		run.value.start(600)
		run.value.tick(runConfig.introSeconds)
		run.value.tick(1)
		expect(run.value.distance).toBeCloseTo(runConfig.pace)
	})

	it('slows the world down during an ambush and does not cover ground', () => {
		run.value.start(600)
		run.value.tick(runConfig.introSeconds)
		run.value.beginAmbush()
		const { distance } = run.value
		run.value.tick(1)
		expect(run.value.worldScale).toBe(runConfig.ambushWorldScale)
		expect(run.value.distance).toBe(distance)
	})

	it('counts the run down from 3 when resuming, then returns to the phase it paused in', () => {
		run.value.start(600)
		run.value.tick(runConfig.introSeconds)
		run.value.pause()
		run.value.tick(5)
		expect(run.value.elapsed).toBeCloseTo(runConfig.introSeconds)

		run.value.resume()
		expect(run.value.countdown).toBe(runConfig.countdownSeconds)
		run.value.tick(runConfig.countdownSeconds)
		expect(run.value.phase).toBe('running')
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
