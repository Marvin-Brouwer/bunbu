/**
 * Dev-only fixtures: put the stores into a named state without playing a run, so the UI and 3D
 * tracks can build and screenshot a screen on its own.
 *
 * Open `?fixture=ambush-multiple`, `?fixture=fallen`, and so on. `?fixture=list` logs the names.
 * Fixtures write to the stores directly, which is why they are the one place outside tests that
 * may import a `…Store`.
 */

import { ambushStore, marks, type AmbushOption } from '../state/ambush.mts'
import { lifeStore } from '../state/life.mts'
import { ninjasStore } from '../state/ninjas.mts'
import { quiz, quizStore } from '../state/quiz.mts'
import { runStore } from '../state/run.mts'
import { scoreStore } from '../state/score.mts'
import { screenStore } from '../state/screen.mts'
import { shogunStore } from '../state/shogun.mts'
import { metresPerAmbush } from '../flows/run.mts'
import { pointsPerCorrect } from '../state/score.mts'
import { fixtureQuiz, manyOptions } from './quiz.mts'

type Options = readonly { answer: string; correct: boolean }[]

function optionsWithMarks(options: Options, ninjaCount: number): AmbushOption[] {
	return options.map((option, index) => ({
		...option,
		mark: marks[index % marks.length]!,
		// With 6 to 8 options several of them share a ninja (gameplay.md#more-than-3-options).
		ninja: index % ninjaCount,
		pick: 0,
	}))
}

function midRun(answered: number): void {
	quizStore.set({ ...quiz.get(), answered })
	scoreStore.set({
		points: answered * pointsPerCorrect,
		correct: answered,
		answered,
		best: { points: 2210, seconds: 245, correct: 17, answered: 20 },
	})
	runStore.set({
		phase: 'running',
		elapsed: 94,
		distance: answered * metresPerAmbush,
		stageLength: quiz.get().refs.length * metresPerAmbush,
		worldScale: 1,
		countdown: 0,
		resumeTo: 'running',
	})
	shogunStore.set({ pose: 'run', target: undefined, sequence: 1 })
	screenStore.set({ current: 'run', previous: 'select' })
}

function openAmbush(question: number, options: Options, choose: number, ninjaCount = Math.min(options.length, 5)): void {
	midRun(question)
	const asked = fixtureQuiz.questions[question]!
	runStore.set({ ...runStore.get(), phase: 'ambush', worldScale: 0.15 })
	ambushStore.set({
		open: true,
		kind: asked.type === 'match' || asked.type === 'solutions' ? 'single' : asked.type,
		at: { question, part: 0 },
		query: asked.query,
		options: optionsWithMarks(options, ninjaCount),
		choose,
		seconds: 12,
		secondsLeft: 7.5,
	})
	ninjasStore.set({
		active: Array.from({ length: ninjaCount }, (_, id) => ({
			id,
			wave: id < 3 ? 0 : 1,
			options: optionsWithMarks(options, ninjaCount).flatMap((option, index) => (option.ninja === id ? [index] : [])),
			approach: 0.4,
			pose: 'approach' as const,
			sequence: 0,
		})),
	})
}

const optionsOf = (question: number): Options => {
	const asked = fixtureQuiz.questions[question]!
	return 'options' in asked ? asked.options : []
}

/** Every fixture, by the name that goes in `?fixture=`. */
export const fixtures: Readonly<Record<string, () => void>> = {
	title: () => {
		screenStore.set({ current: 'title', previous: undefined })
	},
	select: () => {
		screenStore.set({ current: 'select', previous: 'title' })
	},
	running: () => { midRun(2) },
	'ambush-yes-no': () => {
		openAmbush(0, [{ answer: 'Yes', correct: true }, { answer: 'No', correct: false }], 1, 1)
	},
	'ambush-single': () => { openAmbush(1, optionsOf(1), 1) },
	'ambush-multiple': () => { openAmbush(2, optionsOf(2), 2) },
	'ambush-order': () => { openAmbush(3, optionsOf(3), 3) },
	'ambush-many': () => { openAmbush(2, manyOptions, 3, 5) },
	'outcome-correct': () => {
		openAmbush(1, optionsOf(1), 1)
		ambushStore.set({ ...ambushStore.get(), open: false })
		scoreStore.set({ ...scoreStore.get(), points: scoreStore.get().points + pointsPerCorrect, correct: 2 })
		ninjasStore.set({ active: ninjasStore.get().active.map((ninja) => ({ ...ninja, pose: 'slain', sequence: 1 })) })
	},
	'outcome-wrong': () => {
		openAmbush(1, optionsOf(1), 1)
		ambushStore.set({ ...ambushStore.get(), open: false })
		lifeStore.set({ value: 0.66, lastLoss: 1 / 6, hits: 2 })
		shogunStore.set({ pose: 'hurt', target: 0, sequence: 4 })
		ninjasStore.set({ active: ninjasStore.get().active.map((ninja) => ({ ...ninja, pose: 'strike', approach: 1, sequence: 1 })) })
	},
	'outcome-unanswered': () => {
		openAmbush(2, optionsOf(2), 2)
		ambushStore.set({ ...ambushStore.get(), secondsLeft: 0 })
		ninjasStore.set({ active: ninjasStore.get().active.map((ninja) => ({ ...ninja, approach: 1 })) })
	},
	paused: () => {
		midRun(2)
		runStore.set({ ...runStore.get(), phase: 'paused', resumeTo: 'running' })
	},
	finished: () => {
		midRun(4)
		runStore.set({ ...runStore.get(), phase: 'finished', distance: runStore.get().stageLength })
		screenStore.set({ current: 'results', previous: 'run' })
	},
	fallen: () => {
		midRun(3)
		lifeStore.set({ value: 0, lastLoss: 1 / 6, hits: 6 })
		scoreStore.set({ ...scoreStore.get(), correct: 1, answered: 3, points: pointsPerCorrect })
		runStore.set({ ...runStore.get(), phase: 'fallen' })
		shogunStore.set({ pose: 'fallen', target: undefined, sequence: 9 })
		screenStore.set({ current: 'fallen', previous: 'run' })
	},
	dojo: () => {
		screenStore.set({ current: 'dojo', previous: 'title' })
	},
}

/**
 * Applies the fixture named in the URL, in dev builds only. Called once at start-up, before the
 * screens mount, so they read a state that is already set up.
 */
export function applyFixtureFromUrl(search: string): string | undefined {
	if (!import.meta.env.DEV) return undefined

	const name = new URLSearchParams(search).get('fixture')
	if (name === null) return undefined

	quiz.load(fixtureQuiz)
	const fixture = fixtures[name]
	if (fixture === undefined) {
		console.warn(`[bunbu] unknown fixture "${name}". Try one of: ${Object.keys(fixtures).join(', ')}`)
		return undefined
	}
	fixture()
	return name
}
