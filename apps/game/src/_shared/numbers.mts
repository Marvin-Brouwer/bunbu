/** Numbers as the player reads them: in their own notation, and run times as minutes and seconds. */

/** Whole numbers in the player's own notation: `1,420` or `1.420`. */
const wholeNumbers = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })

export function formatWhole(value: number): string {
	return wholeNumbers.format(value)
}

/** A run time as `4:05`, or `1:02:05` past the hour. Parts of a second are dropped. */
export function formatDuration(seconds: number): string {
	const whole = Math.max(0, Math.floor(seconds))
	const hours = Math.floor(whole / 3600)
	const minutes = Math.floor((whole % 3600) / 60)
	const rest = String(whole % 60).padStart(2, '0')
	return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`
}
