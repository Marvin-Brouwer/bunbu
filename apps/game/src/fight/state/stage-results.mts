/**
 * How far the player got on each stage, per quiz `id` + `version`: the best distance and whether
 * it was cleared, which the stage cards show
 * ([2 Fight setup](../../../../../docs/design/screens.md#2-fight-setup)). App-wide, like the high
 * scores. The length of a stage depends on the quiz, so a result only means something for the
 * quiz it was run on.
 *
 * Clearing a stage, passing a test on it, unlocks the next one, but not as Apprentice, and as
 * Samurai only with half the life bar left or more
 * ([stages](../../../../../docs/design/gameplay.md#stages)). Clearing every stage on Shogun
 * unlocks endless ([endless](../../../../../docs/design/gameplay.md#endless)).
 */

import { createStore, type Store } from '@rooted/store'
import { stages, type Stage } from '../../_shared/state/selection.mts'
import type { Difficulty } from './difficulty.mts'

export type StageResult = {
	/** The furthest the samurai got, in metres. */
	readonly distance: number
	/** Whether a run on it ever finished, rather than fell. */
	readonly cleared: boolean
	/** Whether a run on it ever finished on Shogun, the hardest difficulty. */
	readonly shogun?: boolean
	/**
	 * Whether a run on it ever finished in a way that unlocks the next stage ({@link opensNextStage}).
	 * Left out by results kept before that rule, which unlocked it by finishing.
	 */
	readonly opens?: boolean
}

/** How much of the life bar a Samurai run must finish with to unlock the next stage. */
export const samuraiOpensWith = 0.5

/**
 * Whether finishing a stage on `difficulty`, with `life` of the life bar left (`0` to `1`), unlocks
 * the next one: never as Apprentice, as Samurai with at least {@link samuraiOpensWith} of it left,
 * and always on the harder ones.
 */
export function opensNextStage(difficulty: Difficulty, life: number): boolean {
	if (difficulty === 'apprentice') return false
	// The life bar's shares are fractions such as 1/6, so a bar at exactly half lands a rounding error either side.
	return difficulty !== 'samurai' || life >= samuraiOpensWith - 1e-9
}

/** Whether `result` unlocks the next stage. */
const opens = (result: StageResult | undefined): boolean => result?.opens ?? result?.cleared === true

export type StageResultsState = {
	/** By {@link stageResultKey}. */
	readonly results: Readonly<Record<string, StageResult>>
}

export type StageResultsActions = {
	/** The best result on a stage, or `undefined` while it hasn't been run on this quiz. */
	of: (id: string, version: string, stage: Stage) => StageResult | undefined
	/** Whether the stage can be played on this quiz: the first always, the others once the one before {@link opensNextStage opened it}. */
	unlocked: (id: string, version: string, stage: Stage) => boolean
	/** Whether endless can be played on this quiz: once every stage has been cleared on Shogun. */
	endlessUnlocked: (id: string, version: string) => boolean
	/** Keeps `result` when it is better than the one kept, and a clear on Shogun or one that unlocks the next stage either way. */
	submit: (id: string, version: string, stage: Stage, result: StageResult) => void
	/** Drops every result of a quiz, which locks its stages again. */
	forget: (id: string, version: string) => void
	/** Puts back what was saved. Anything already recorded this session is kept when it is better. */
	restore: (saved: Readonly<Record<string, StageResult>>) => void
	reset: () => void
}

/** The store, with its actions on its state. Change it through those, not `update`. */
export type StageResults = Store<StageResultsState & StageResultsActions>

export const noStageResults: StageResultsState = { results: {} }

/** The stage to clear to unlock `stage`, or `undefined` for the first. */
export function stageBefore(stage: Stage): Stage | undefined {
	return stages[stages.indexOf(stage) - 1]
}

/** The stage that clearing `stage` unlocks, or `undefined` for the last. */
export function stageAfter(stage: Stage): Stage | undefined {
	return stages[stages.indexOf(stage) + 1]
}

/** Like the high scores, a new version of a quiz starts with a clean slate. */
export function stageResultKey(id: string, version: string, stage: Stage): string {
	return JSON.stringify([id, version, stage])
}

/** Whether `result` is better than `kept`: cleared beats not cleared, then the longer distance. */
export function betterResult(result: StageResult, kept: StageResult | undefined): boolean {
	if (kept === undefined) return true
	if (result.cleared !== kept.cleared) return result.cleared
	return result.distance > kept.distance
}

export function createStageResults(initial: StageResultsState = noStageResults): StageResults {

	const store: StageResults = createStore<StageResultsState & StageResultsActions>({
		...initial,

		of(id, version, stage) {
			return store.value.results[stageResultKey(id, version, stage)]
		},

		unlocked(id, version, stage) {
			const before = stageBefore(stage)
			return before === undefined || opens(store.value.of(id, version, before))
		},

		endlessUnlocked(id, version) {
			return stages.every((stage) => store.value.of(id, version, stage)?.shogun === true)
		},

		submit(id, version, stage, result) {
			const key = stageResultKey(id, version, stage)
			const kept = store.value.results[key]
			const shogun = result.shogun === true || kept?.shogun === true
			const opened = opens(result) || opens(kept)
			const best = betterResult(result, kept) ? result : kept ?? result
			const merged: StageResult = { ...best, opens: opened, ...(shogun ? { shogun } : {}) }
			if (kept !== undefined && merged.distance === kept.distance && merged.cleared === kept.cleared && merged.shogun === kept.shogun && merged.opens === kept.opens) return
			store.update((state) => ({ results: { ...state.results, [key]: merged } }))
		},

		forget(id, version) {
			const kept = Object.entries(store.value.results).filter(([key]) => !stages.some((stage) => key === stageResultKey(id, version, stage)))
			store.update(() => ({ results: Object.fromEntries(kept) }))
		},

		restore(saved) {
			store.update((state) => {
				const results: Record<string, StageResult> = { ...saved }
				for (const [key, result] of Object.entries(state.results)) {
					if (betterResult(result, results[key])) results[key] = result
				}
				return { results }
			})
		},

		reset() {
			store.update(() => noStageResults)
		},
	})
	return store
}

/** App-wide: the stage cards show it outside a run. */
export const stageResults = createStageResults()
