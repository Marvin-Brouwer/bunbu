/**
 * The cut through a picked answer in the answer drawer
 * ([4 Ambush](../../../../../docs/design/screens.md#4-ambush)).
 */

import type { Mark } from '../state/ambush.mts'

/**
 * How far each end of the cut is from the middle of the line, in percent: it leans with the swipe,
 * flat for ← →, rising for ↗ ↙, falling for ↖ ↘, a little off level for ↑ ↓.
 */
const leans: Readonly<Record<Mark, number>> = {
	left: 0,
	right: 0,
	'up-right': 14,
	'down-left': 14,
	'up-left': -14,
	'down-right': -14,
	up: 6,
	down: 6,
}

/** Where the cut crosses the line, in percent from the top, at its left and right end. */
export function cutOf(mark: Mark): { readonly left: number, readonly right: number } {
	return { left: 50 + leans[mark], right: 50 - leans[mark] }
}
