/**
 * When a swipe answer is complete ([ambush](../../../../../docs/design/gameplay.md#ambush)), as
 * plain functions so they can be tested without the swipe zone.
 */

import type { AmbushState } from '../state/ambush.mts'

const pickCount = (state: AmbushState) => state.options.filter((option) => option.pick > 0).length

/**
 * Whether the answer is complete: an `order` needs its items put in their places, a `multiple` as
 * many picks as it asks for, the rest one pick. An `order` asks for its correct items only
 * (`choose`): its distractors are to be left out, so it doesn't wait for them.
 */
export function answered(state: AmbushState): boolean {
	if (state.kind === 'order') return pickCount(state) >= (state.choose > 0 ? state.choose : state.options.length)
	if (state.kind === 'multiple' && state.choose > 0) return pickCount(state) >= state.choose
	return pickCount(state) > 0
}

/** Whether the answer strikes as soon as it is complete, rather than after the commit pause. */
export function strikesWhenAnswered(state: AmbushState): boolean {
	return state.kind === 'order' || (state.kind === 'multiple' && state.choose > 0)
}
