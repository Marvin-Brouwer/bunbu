/**
 * Randomness for the rules that shuffle: the question order, the options, the marks and the
 * bundling of options onto ninjas. The game passes `Math.random`; tests and fixtures pass a
 * seeded one so the same opening comes out every time.
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
