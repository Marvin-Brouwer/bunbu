/** Small helpers for the arrays the rules juggle: option indices and ninja ids. */

/** Every number once, from low to high. */
export function sortDistinct(numbers: readonly number[]): number[] {
	return [...new Set(numbers)].toSorted((first, second) => first - second)
}
