/**
 * The smallest store that the architecture asks for: immutable state, listeners that are
 * removed with an `AbortSignal`, and no dependency on three.js or the DOM.
 *
 * See [state.md](../../../../../docs/architecture/state.md).
 */

export type Listener<TState> = (state: TState, previous: TState) => void

/** What a store module hands out: reading and subscribing, never writing. */
export type Readable<TState extends object> = {
	/** The current state. Never mutate it: actions replace the whole object. */
	get: () => Readonly<TState>
	/** Calls `listener` on every change, until `signal` aborts. */
	subscribe: (listener: Listener<Readonly<TState>>, signal: AbortSignal) => void
}

/** A store with its writer. Only the store's own module, tests and fixtures use `set`. */
export type Store<TState extends object> = Readable<TState> & {
	set: (next: TState) => void
}

export function createStore<TState extends object>(initial: TState): Store<TState> {
	let state = initial
	const listeners = new Set<Listener<Readonly<TState>>>()

	return {
		get: () => state,
		set(next: TState) {
			if (next === state) return
			const previous = state
			state = next
			for (const listener of [...listeners]) listener(state, previous)
		},
		subscribe(listener, signal) {
			if (signal.aborted) return
			listeners.add(listener)
			signal.addEventListener('abort', () => listeners.delete(listener), { once: true })
		},
	}
}

/**
 * Says that an action was called from a phase that does not allow it. Logs in dev builds and
 * does nothing in production, so a refused transition never breaks a run.
 */
export function refuse(action: string, reason: string): void {
	if (import.meta.env.DEV) console.warn(`[bunbu] ${action} refused: ${reason}`)
}
