/**
 * Dev-only fixtures: a run's state for one screen, so the UI and 3D tracks can build and
 * screenshot it without playing a run.
 *
 * Open `/fight/?fixture=ambush-multiple`, `/fight/?fixture=fallen`, and so on. An unknown name logs
 * the list. A fixture is the starting state of every store, handed to `createRunGame`.
 *
 * Temporary: these go once the run can be played to every screen for real.
 */

import type { BunbuData, Markdown } from '@bunbu/data'
import { openingOf } from '../../_shared/state/ambush-opening.mts'
import { loaded } from '../../_shared/state/quiz.mts'
import { newRun, type RunGameState } from '../state/game.mts'
import { spawnsOf, type Ninja } from '../state/ninjas.mts'
import { runConfig } from '../state/run.mts'
import { pointsPerCorrect } from '../state/score.mts'
import { metresPerAmbush } from '../flows/run.mts'
import { fixtureQuiz, manyOptions } from '../../_temp/quiz.mts'
import { seeded } from '../../_temp/random.mts'

type Fixture = Partial<RunGameState>

const quiz = loaded(fixtureQuiz)

/** A query long enough to scroll, with every kind of Markdown a quiz may use. */
const longQuery = `A screen reader announces this image only as *"image"*, and the chart is
[described on the page](https://example.com/chart) anyway:

\`\`\`html
<figure>
  <img src="chart.png">
  <figcaption>Visitors per month</figcaption>
</figure>
\`\`\`

| Attribute | Read aloud |
| --------- | ---------- |
| \`alt\`     | yes        |
| \`title\`   | sometimes  |

![A bar chart, three bars rising](data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="48"><rect x="4" y="28" width="28" height="18" fill="#b3391f"/><rect x="46" y="16" width="28" height="30" fill="#b3391f"/><rect x="88" y="4" width="28" height="42" fill="#b3391f"/></svg>')})

Which attribute should be added so it is described properly?` as Markdown

/** The fixture quiz with seven options on the `multiple` question, for bundling. */
const manyQuiz: BunbuData = {
	...fixtureQuiz,
	questions: fixtureQuiz.questions
		.map((question) => (question.type === 'multiple'
			? { ...question, options: manyOptions }
			: question)
		),
}

/** The fixture quiz with a long `single` query: a paragraph, a code block, a table and an image, so the scroll has to scroll. */
const longQuiz: BunbuData = {
	...fixtureQuiz,
	questions: fixtureQuiz.questions
		.map((question, index) => (index === 1
			? { ...question, query: longQuery }
			: question)
		),
}

/** Picks the options at `places` in the opening's order, as the swipes would. */
function picking(state: RunGameState, places: readonly number[]): RunGameState {
	const options = state.ambush.options
		.map((option, place) => ({ ...option, pick: places.indexOf(place) + 1 }))
	return { ...state, ambush: { ...state.ambush, options } }
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
			newBest: false,
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
		ambush: { ...opening, open: true, openingLeft: 0, secondsLeft: opening.seconds * 0.6 },
		ninjas: { active: ninjas },
	}
}

const single = () => ambush(1)

/** Every fixture, by the name that goes in `?fixture=`. */
export const fixtures: Readonly<Record<string, () => Fixture>> = {
	running: () => midRun(2),
	// Running round the first street corner, for the camera and the houses at the turn.
	'running-corner': () => {
		const state = midRun(0)
		return { ...state, run: { ...state.run, distance: 78 } }
	},
	'ambush-yes-no': () => ambush(0),
	'ambush-single': single,
	'ambush-multiple': () => ambush(2),
	'ambush-order': () => ambush(3),
	'ambush-many': () => ambush(2, manyQuiz),
	'ambush-marked': () => picking(ambush(2), [0]),
	'ambush-order-picked': () => picking(ambush(3), [2, 0]),
	'ambush-long': () => ambush(1, longQuiz),
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
	// A wrong answer swiped early, with the ninjas still far off: they lunge in to land the hit.
	'outcome-wrong-early': () => {
		const state = single()
		return {
			...state,
			ambush: { ...state.ambush, open: false },
			life: { value: 0.66, lastLoss: 1 / 6, hits: 2 },
			shogun: { pose: 'hurt', target: 0, sequence: 4 },
			ninjas: { active: state.ninjas.active.map((ninja) => ({ ...ninja, pose: 'strike', approach: 0.15, sequence: 1 })) },
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
