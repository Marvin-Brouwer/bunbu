/**
 * The state of one run of the main game. The run route creates it when it mounts and drops it
 * when it unmounts, so nothing carries over between runs or into the dojo.
 *
 * Every store can start from a given state, which is how fixtures and tests set up a screen
 * without playing a run.
 */

import { createAmbush, noAmbush, type Ambush, type AmbushState } from '../ambush.mts'
import { createQuiz, noQuiz, type Quiz, type QuizState } from '../quiz.mts'
import { createLife, fullLife, type Life, type LifeState } from './life.mts'
import { createNinjas, noNinjas, type Ninjas, type NinjasState } from './ninjas.mts'
import { createRun, notRunning, type Run, type RunState } from './run.mts'
import { createScore, noScore, type Score, type ScoreState } from './score.mts'
import { createShogun, standing, type Shogun, type ShogunState } from './shogun.mts'

export type RunGame = {
	readonly run: Run
	readonly quiz: Quiz
	readonly ambush: Ambush
	readonly score: Score
	readonly life: Life
	readonly shogun: Shogun
	readonly ninjas: Ninjas
}

/** The state of every store in a run, for fixtures and tests. */
export type RunGameState = {
	readonly run: RunState
	readonly quiz: QuizState
	readonly ambush: AmbushState
	readonly score: ScoreState
	readonly life: LifeState
	readonly shogun: ShogunState
	readonly ninjas: NinjasState
}

export const newRun: RunGameState = {
	run: notRunning,
	quiz: noQuiz,
	ambush: noAmbush,
	score: noScore,
	life: fullLife,
	shogun: standing,
	ninjas: noNinjas,
}

export function createRunGame(initial: Partial<RunGameState> = {}): RunGame {
	const state = { ...newRun, ...initial }
	return {
		run: createRun(state.run),
		quiz: createQuiz(state.quiz),
		ambush: createAmbush(state.ambush),
		score: createScore(state.score),
		life: createLife(state.life),
		shogun: createShogun(state.shogun),
		ninjas: createNinjas(state.ninjas),
	}
}
