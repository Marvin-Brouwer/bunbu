/**
 * The game's stores are plain [`@rooted/store`](https://github.com/Marvin-Brouwer/rooted/blob/main/docs/guide/state.md)
 * stores with their actions on their state, so `game.life.value.hit(share)` is how a flow changes
 * one. Nothing outside a store's own module calls `update`.
 *
 * See [state.md](../../../../../docs/architecture/state.md).
 */

import type { StateObject, Store } from '@rooted/store'

/**
 * The store's frozen snapshot, typed as the state it holds.
 *
 * `ReadonlyState` turns a branded string such as `@bunbu/data`'s `Markdown` into an object type
 * and makes the quiz's arrays readonly, so a quiz read from a store would no longer be a
 * `BunbuData`. The state types here are readonly already, and the snapshot is frozen at runtime.
 *
 * TODO: a workaround for `@rooted/store`. Remove this and read `store.value` directly once
 * `ReadonlyState` leaves branded strings alone.
 */
export function snapshot<TState extends StateObject>(store: Store<TState>): TState {
	return store.value as unknown as TState
}

/**
 * Says that an action was called from a phase that does not allow it. Logs in dev builds and
 * does nothing in production, so a refused transition never breaks a run.
 */
export function refuse(action: string, reason: string): void {
	if (import.meta.env.DEV) console.warn(`[bunbu] ${action} refused: ${reason}`)
}
