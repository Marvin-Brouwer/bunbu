/**
 * Tiny parsers for what comes out of local storage, which anyone can edit from DevTools and which
 * may be from an older build. A parser takes `unknown` and returns the value, or `undefined` when
 * it is not what it should be. They compose, so a stored shape is described once, in one place.
 */

export type Parser<T> = (data: unknown) => T | undefined

type Json = Readonly<Record<string, unknown>>

const isObject = (data: unknown): data is Json => typeof data === 'object' && data !== null && !Array.isArray(data)

export const flag: Parser<boolean> = (data) => typeof data === 'boolean' ? data : undefined
export const text: Parser<string> = (data) => typeof data === 'string' ? data : undefined
export const seconds: Parser<number> = (data) => typeof data === 'number' && Number.isFinite(data) && data >= 0 ? data : undefined
export const count: Parser<number> = (data) => Number.isInteger(data) ? seconds(data) : undefined
/** A number from `0` to `1`. */
export const fraction: Parser<number> = (data) => typeof data === 'number' && data >= 0 && data <= 1 ? data : undefined

/** `parse`, but only for values that also pass `valid`: for rules that span fields. */
export function where<T>(parse: Parser<T>, valid: (value: T) => boolean): Parser<T> {
	return (data) => {
		const value = parse(data)
		return value !== undefined && valid(value) ? value : undefined
	}
}

/** One of `values`. */
export function oneOf<const T extends string>(...values: readonly T[]): Parser<T> {
	return (data) => values.find((value) => value === data)
}

/** An object with every one of these fields. Any field that is missing or invalid fails the lot. */
export function object<T extends Json>(shape: { readonly [K in keyof T]: Parser<T[K]> }): Parser<T> {
	return (data) => {
		if (!isObject(data)) return undefined
		const parsed: Record<string, unknown> = {}
		for (const [key, parse] of Object.entries<Parser<unknown>>(shape)) {
			const value = parse(data[key])
			if (value === undefined) return undefined
			parsed[key] = value
		}
		return parsed as T
	}
}

/** An object with the fields that are valid. The others are left out, so the caller's defaults stay. */
export function partial<T extends Json>(shape: { readonly [K in keyof T]: Parser<T[K]> }): (data: unknown) => Partial<T> {
	return (data) => {
		const parsed: Record<string, unknown> = {}
		if (isObject(data)) {
			for (const [key, parse] of Object.entries<Parser<unknown>>(shape)) {
				const value = parse(data[key])
				if (value !== undefined) parsed[key] = value
			}
		}
		return parsed as Partial<T>
	}
}

/** A list in which every item must be valid. */
export function arrayOf<T>(parse: Parser<T>): Parser<T[]> {
	return (data) => {
		if (!Array.isArray(data)) return undefined
		const items = (data as unknown[]).map(parse)
		return items.every((item) => item !== undefined) ? items : undefined
	}
}

/** A list that keeps the items that are valid. */
export function listOf<T>(parse: Parser<T>): Parser<T[]> {
	return (data) => Array.isArray(data) ? (data as unknown[]).map(parse).filter((item) => item !== undefined) : undefined
}

/** An object of any keys whose values are valid, keeping those that are. */
export function recordOf<T>(parse: Parser<T>): (data: unknown) => Record<string, T> {
	return (data) => {
		const parsed: Record<string, T> = {}
		if (!isObject(data)) return parsed
		for (const [key, value] of Object.entries(data)) {
			const item = parse(value)
			if (item !== undefined) parsed[key] = item
		}
		return parsed
	}
}
