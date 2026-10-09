/**
 * What the scroll does when the ambush changes: unroll for a new one, follow the picks, roll up
 * when it is answered, or be sliced in half when the time ran out
 * ([5 Outcome](../../../../../docs/design/screens.md#5-outcome)).
 */

import { timeUp, type AmbushState } from '../state/ambush.mts'

export type ScrollChange = 'unroll' | 'update' | 'roll-up' | 'slice' | 'none'

const sameAmbush = (first: AmbushState, second: AmbushState) =>
	first.at.question === second.at.question && first.at.part === second.at.part && first.query === second.query

export function scrollChangeOf(previous: AmbushState, next: AmbushState): ScrollChange {
	if (!next.open) {
		if (!previous.open) return 'none'
		return timeUp(previous) ? 'slice' : 'roll-up'
	}
	if (!previous.open || !sameAmbush(previous, next)) return timeUp(next) ? 'slice' : 'unroll'
	return timeUp(next) ? 'slice' : 'update'
}
