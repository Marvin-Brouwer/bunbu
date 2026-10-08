/**
 * The life bar, which shows only the error margin: full is 100%, empty is the quiz's
 * `passingScore` ([life bar](../../../../docs/design/gameplay.md#life-bar)). No hearts.
 *
 * `life = (best score still possible − pass) / (1 − pass)`, so every miss takes its question's
 * whole share, however many ninjas or errors were involved.
 */

import { createStore, type Store } from './store.mts'

export type LifeState = {
	/** `1` at the start, `0` when the pass mark is out of reach. */
	readonly value: number
	/** The share the last miss took, so the HUD can flash the chunk that dropped off. */
	readonly lastLoss: number
	/** Counts up on every hit, so the renderer can see a new one without an event bus. */
	readonly hits: number
}

const initial: LifeState = { value: 1, lastLoss: 0, hits: 0 }

/** Anything this close to empty is empty: the shares are fractions and never add up exactly. */
const rounding = 1e-9

export const lifeStore: Store<LifeState> = createStore(initial)

/**
 * How much of the bar one missed point costs: the margin is `points × (1 − pass)` points wide,
 * so 20 points with a 70% pass mark leaves 6, and one miss takes a sixth.
 */
export function shareOfOnePoint(points: number, passingScore: number): number {
	const margin = points * (1 - passingScore / 100)
	return margin <= 0 ? 1 : 1 / margin
}

export const life = {
	get: lifeStore.get,
	subscribe: lifeStore.subscribe,

	hit(share: number): void {
		const state = lifeStore.get()
		const left = state.value - share
		// Shares are fractions such as 1/6, so the last miss lands a rounding error away from zero.
		lifeStore.set({ value: left < rounding ? 0 : left, lastLoss: share, hits: state.hits + 1 })
	},

	/** Whether the pass mark is out of reach, which means the samurai falls. */
	empty(): boolean {
		return lifeStore.get().value === 0
	},

	reset(): void {
		lifeStore.set(initial)
	},
}
