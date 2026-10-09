/**
 * Randomness for the rules that shuffle: the question order, the options, the marks and the
 * bundling of options onto ninjas. The game passes `Math.random`; tests and fixtures pass
 * {@link seeded} so the same opening comes out every time.
 */

/** A number in `[0, 1)`, like `Math.random`. */
export type Random = () => number

/** A shuffled copy (Fisher-Yates). */
export function shuffle<T>(items: readonly T[], random: Random): T[] {
	const shuffled = [...items]
	for (let index = shuffled.length - 1; index > 0; index--) {
		const other = Math.floor(random() * (index + 1))
		;[shuffled[index], shuffled[other]] = [shuffled[other]!, shuffled[index]!]
	}
	return shuffled
}

/** A repeatable {@link Random} (mulberry32), for tests and fixtures. */
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
