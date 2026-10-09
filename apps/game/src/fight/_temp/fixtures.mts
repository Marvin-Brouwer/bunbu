/**
 * Dev-only fixtures: a run's state for one screen, so the UI and 3D tracks can build and
 * screenshot it without playing a run.
 *
 * Open `/fight/?fixture=ambush-multiple`, `/fight/?fixture=fallen`, and so on. An unknown name logs
 * the list. A fixture is the starting state of every store, handed to `createRunGame`.
 *
 * Temporary: these go once the run can be played to every screen for real.
 */

import type { BunbuData } from '@bunbu/data'
import { openingOf } from '../../_shared/state/ambush-opening.mts'
import { loaded } from '../../_shared/state/quiz.mts'
import { seeded } from '../../_shared/state/random.mts'
import { newRun, type RunGameState } from '../state/game.mts'
import { spawnsOf, type Ninja } from '../state/ninjas.mts'
import { runConfig } from '../state/run.mts'
import { pointsPerCorrect } from '../state/score.mts'
import { metresPerAmbush } from '../flows/run.mts'
import { fixtureQuiz, manyOptions } from '../../_temp/quiz.mts'

type Fixture = Partial<RunGameState>

const quiz = loaded(fixtureQuiz)

/** The fixture quiz with seven options on the `multiple` question, for bundling. */
const manyQuiz: BunbuData = {
	...fixtureQuiz,
	questions: fixtureQuiz.questions.map((question) => (question.type === 'multiple' ? { ...question, options: manyOptions } : question)),
}

/** Running, with `answered` questions behind the samurai, all of them right. */
function midRun(answered: number): RunGameState {
	return {
		...newRun,
		quiz: { ...quiz, answered },
		score: {
			points: answered * pointsPerCorrect,
			correct: answered,
			answered,
			best: { points: 2210, seconds: 245, correct: 17, answered: 20 },
		},
		run: {
			...newRun.run,
			phase: 'running',
			elapsed: 94,
			distance: answered * metresPerAmbush,
			stageLength: quiz.refs.length * metresPerAmbush,
		},
		shogun: { pose: 'run', target: undefined, sequence: 1 },
	}
}

/** An open ambush on `question`, opened by the real rules (with a fixed shuffle), its ninjas creeping in. */
function ambush(question: number, data = fixtureQuiz): RunGameState {
	const at = { question, part: 0 }
	const opening = openingOf(data, quiz.refs, at, { timeScale: 1, random: seeded(question) })
	const state = midRun(question)
	const ninjas: Ninja[] = spawnsOf(opening.options).map((ninja) => ({
		...ninja,
		approach: 0.4,
		pose: 'approach',
		sequence: 0,
	}))
	return {
		...state,
		run: { ...state.run, phase: 'ambush', worldScale: runConfig.ambushWorldScale },
		ambush: { ...opening, open: true, secondsLeft: opening.seconds * 0.6 },
		ninjas: { active: ninjas },
	}
}

const single = () => ambush(1)

/** Every fixture, by the name that goes in `?fixture=`. */
export const fixtures: Readonly<Record<string, () => Fixture>> = {
	running: () => midRun(2),
	'ambush-yes-no': () => ambush(0),
	'ambush-single': single,
	'ambush-multiple': () => ambush(2),
	'ambush-order': () => ambush(3),
	'ambush-many': () => ambush(2, manyQuiz),
	'outcome-correct': () => {
		const state = single()
		const slain = state.ambush.options.find((option) => option.correct)?.ninja ?? 0
		return {
			...state,
			ambush: { ...state.ambush, open: false },
			score: { ...state.score, points: state.score.points + pointsPerCorrect, correct: state.score.correct + 1 },
			shogun: { pose: 'strike', target: slain, sequence: 2 },
			ninjas: { active: state.ninjas.active.map((ninja) => ({ ...ninja, pose: ninja.id === slain ? 'slain' : 'blocked', sequence: 1 })) },
		}
	},
	'outcome-wrong': () => {
		const state = single()
		return {
			...state,
			ambush: { ...state.ambush, open: false },
			life: { value: 0.66, lastLoss: 1 / 6, hits: 2 },
			shogun: { pose: 'hurt', target: 0, sequence: 4 },
			ninjas: { active: state.ninjas.active.map((ninja) => ({ ...ninja, pose: 'strike', approach: 1, sequence: 1 })) },
		}
	},
	'outcome-unanswered': () => {
		const state = ambush(2)
		return {
			...state,
			ambush: { ...state.ambush, secondsLeft: 0 },
			ninjas: { active: state.ninjas.active.map((ninja) => ({ ...ninja, approach: 1 })) },
		}
	},
	paused: () => {
		const state = midRun(2)
		return { ...state, run: { ...state.run, phase: 'paused', resumeTo: 'running' } }
	},
	finished: () => {
		const state = midRun(quiz.refs.length)
		return { ...state, run: { ...state.run, phase: 'finished', distance: state.run.stageLength } }
	},
	fallen: () => {
		const state = midRun(3)
		return {
			...state,
			life: { value: 0, lastLoss: 1 / 6, hits: 6 },
			score: { ...state.score, correct: 1, answered: 3, points: pointsPerCorrect },
			run: { ...state.run, phase: 'fallen' },
			shogun: { pose: 'fallen', target: undefined, sequence: 9 },
		}
	},
}

/** The fixture named in `?fixture=`, in dev builds only. */
export function fixtureFromUrl(search: string): Fixture | undefined {
	if (!import.meta.env.DEV) return undefined

	const name = new URLSearchParams(search).get('fixture')
	if (name === null) return undefined

	const fixture = fixtures[name]
	if (fixture === undefined) {
		console.warn(`[bunbu] unknown fixture "${name}". Try one of: ${Object.keys(fixtures).join(', ')}`)
		return undefined
	}
	return fixture()
}
