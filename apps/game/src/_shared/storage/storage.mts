/**
 * What goes into local storage, through [`@rooted/storage`](https://github.com/Marvin-Brouwer/rooted/blob/main/docs/guide/storage.md):
 * typed, JSON round-tripped and a no-op when there is no browser, as when the pages are
 * pre-rendered.
 *
 * Every value is wrapped in an envelope with the version of its shape. A value of another
 * version is ignored and the store keeps its defaults, so a future change of shape never
 * misreads old data. Local storage can be edited from DevTools, so what comes back is `unknown`
 * until the parsers in `persistence.mts` have checked it.
 */

import { localStorage } from '@rooted/storage/web'

/** The version of the stored shapes. Raise it when one changes, and migrate in `read` if it is worth keeping. */
export const storedVersion = 1

export type StoredKey = 'settings' | 'high-scores' | 'last-run' | 'library'

const keyOf = (key: StoredKey) => `bunbu:${key}`

/** The saved value, or `undefined` when there is none, it is of another version or storage fails. */
export function read(key: StoredKey): unknown {
	try {
		const envelope = localStorage.get(keyOf(key))
		if (typeof envelope !== 'object' || envelope === null) return undefined
		const { version, data } = envelope as { version?: unknown, data?: unknown }
		return version === storedVersion ? data : undefined
	} catch {
		return undefined
	}
}

/** Saves a value. A full or blocked storage drops the write: the game plays on without saving. */
export function write(key: StoredKey, data: unknown): void {
	try {
		localStorage.set(keyOf(key), { version: storedVersion, data })
	} catch (error) {
		console.warn(`[bunbu] could not save ${key}`, error)
	}
}
