/**
 * A repeatable random for tests and fixtures, so the same shuffle comes out every time. The game
 * itself uses `Math.random`.
 */

import type { Random } from '../_shared/state/random.mts'

/** A repeatable {@link Random} (mulberry32). */
export function seeded(seed: number): Random {
	let state = seed >>> 0
	return () => {
		state = (state + 0x6D2B79F5) >>> 0
		let mixed = state
		mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
		mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
		return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296
	}
}
