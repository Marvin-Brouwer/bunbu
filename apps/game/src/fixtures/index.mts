/**
 * Dev-only fixtures: a run's state for one screen, so the UI and 3D tracks can build and
 * screenshot it without playing a run.
 *
 * Open `/run/?fixture=ambush-multiple`, `/run/?fixture=fallen`, and so on. An unknown name logs
 * the list. A fixture is the starting state of every store, handed to `createRunGame`.
 */

import type { AmbushOption, AmbushState } from '../state/ambush.mts'
import { marks } from '../state/ambush.mts'
import { loaded } from '../state/quiz.mts'
import { newRun, type RunGameState } from '../state/run/game.mts'
import type { Ninja } from '../state/run/ninjas.mts'
import { runConfig } from '../state/run/run.mts'
import { pointsPerCorrect } from '../state/run/score.mts'
import { metresPerAmbush } from '../flows/run/run.mts'
import { fixtureQuiz, manyOptions } from './quiz.mts'

type Options = readonly { answer: string; correct: boolean }[]

type Fixture = Partial<RunGameState>

const quiz = loaded(fixtureQuiz)

function optionsWithMarks(options: Options, ninjaCount: number): AmbushOption[] {
	return options.map((option, index) => ({
		...option,
		mark: marks[index % marks.length]!,
		// With 6 to 8 options several of them share a ninja (gameplay.md#more-than-3-options).
		ninja: index % ninjaCount,
		pick: 0,
	}))
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

/** An open ambush on `question`, with its ninjas creeping in. */
function ambush(question: number, options: Options, choose: number, ninjaCount = Math.min(options.length, 5)): RunGameState {
	const asked = fixtureQuiz.questions[question]!
	const withMarks = optionsWithMarks(options, ninjaCount)
	const state = midRun(question)
	const opened: AmbushState = {
		open: true,
		kind: asked.type === 'match' || asked.type === 'solutions' ? 'single' : asked.type,
		at: { question, part: 0 },
		query: asked.query,
		options: withMarks,
		choose,
		seconds: 12,
		secondsLeft: 7.5,
	}
	const ninjas: Ninja[] = Array.from({ length: ninjaCount }, (_, id) => ({
		id,
		wave: id < 3 ? 0 : 1,
		options: withMarks.flatMap((option, index) => (option.ninja === id ? [index] : [])),
		approach: 0.4,
		pose: 'approach',
		sequence: 0,
	}))
	return {
		...state,
		run: { ...state.run, phase: 'ambush', worldScale: runConfig.ambushWorldScale },
		ambush: opened,
		ninjas: { active: ninjas },
	}
}

function optionsOf(question: number): Options {
	const asked = fixtureQuiz.questions[question]!
	return 'options' in asked ? asked.options : []
}

const single = () => ambush(1, optionsOf(1), 1)

/** Every fixture, by the name that goes in `?fixture=`. */
export const fixtures: Readonly<Record<string, () => Fixture>> = {
	running: () => midRun(2),
	'ambush-yes-no': () => ambush(0, [{ answer: 'Yes', correct: true }, { answer: 'No', correct: false }], 1, 1),
	'ambush-single': single,
	'ambush-multiple': () => ambush(2, optionsOf(2), 2),
	'ambush-order': () => ambush(3, optionsOf(3), 3),
	'ambush-many': () => ambush(2, manyOptions, 3, 5),
	'outcome-correct': () => {
		const state = single()
		return {
			...state,
			ambush: { ...state.ambush, open: false },
			score: { ...state.score, points: state.score.points + pointsPerCorrect, correct: state.score.correct + 1 },
			shogun: { pose: 'strike', target: 0, sequence: 2 },
			ninjas: { active: state.ninjas.active.map((ninja) => ({ ...ninja, pose: ninja.id === 0 ? 'slain' : 'blocked', sequence: 1 })) },
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
		const state = ambush(2, optionsOf(2), 2)
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
