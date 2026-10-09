/** Whole numbers in the player's own notation: `1,420` or `1.420`. */
const wholeNumbers = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })

export function formatWhole(value: number): string {
	return wholeNumbers.format(value)
}
