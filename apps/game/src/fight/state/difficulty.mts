/**
 * The difficulty: the ambush time limit, a `timeScale` from Apprentice's 120% to Shogun's 50%
 * ([time limit](../../../../../docs/design/gameplay.md#time-limit)). It is chosen on the fight setup
 * only and kept per quiz `id` + `version`, like the high score: each test has its own. App-wide, so
 * the fight setup shows it again next time. A run keeps the one it started with in its own state.
 */

import { createStore, type Store } from '@rooted/store'

/** The difficulty, as the stops on its slider from easy to hard. */
export const difficulties = ['apprentice', 'samurai', 'daimyo', 'shogun'] as const

export type Difficulty = (typeof difficulties)[number]

/** What the difficulties are called on screen. */
export const difficultyNames: Readonly<Record<Difficulty, string>> = {
	apprentice: 'Apprentice',
	samurai: 'Samurai',
	daimyo: 'Daimyo',
	shogun: 'Shogun',
}

/** Where a new player starts, and every quiz until another difficulty is chosen for it. */
export const usualDifficulty: Difficulty = 'samurai'

/** How much of a question's time an ambush gives, per difficulty. */
export const timeScales: Readonly<Record<Difficulty, number>> = {
	apprentice: 1.2,
	samurai: 1,
	daimyo: 0.8,
	shogun: 0.5,
}

export type DifficultiesState = {
	/** By {@link difficultyKey}. */
	readonly chosen: Readonly<Record<string, Difficulty>>
}

export type DifficultiesActions = {
	/** The difficulty chosen for a quiz, or {@link usualDifficulty} before one is. */
	of: (id: string, version: string) => Difficulty
	choose: (id: string, version: string, difficulty: Difficulty) => void
	/** Puts back what was saved. */
	restore: (saved: Readonly<Record<string, Difficulty>>) => void
	reset: () => void
}

/** The store, with its actions on its state. Change it through those, not `update`. */
export type Difficulties = Store<DifficultiesState & DifficultiesActions>

export const noDifficulties: DifficultiesState = { chosen: {} }

/** Like the high scores, a new version of a quiz starts at the usual difficulty. */
export function difficultyKey(id: string, version: string): string {
	return JSON.stringify([id, version])
}

export function createDifficulties(initial: DifficultiesState = noDifficulties): Difficulties {

	const store: Difficulties = createStore<DifficultiesState & DifficultiesActions>({
		...initial,

		of(id, version) {
			return store.value.chosen[difficultyKey(id, version)] ?? usualDifficulty
		},

		choose(id, version, difficulty) {
			store.update((state) => ({ chosen: { ...state.chosen, [difficultyKey(id, version)]: difficulty } }))
		},

		restore(saved) {
			store.update((state) => ({ chosen: { ...saved, ...state.chosen } }))
		},

		reset() {
			store.update(() => noDifficulties)
		},
	})
	return store
}

/** App-wide: the fight setup shows it outside a run. */
export const quizDifficulties = createDifficulties()
