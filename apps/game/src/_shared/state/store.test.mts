import { describe, expect, it, vi } from 'vitest'
import { createStore } from './store.mts'

type Counter = { readonly value: number }

describe('createStore', () => {
	it('starts with the initial state', () => {
		expect(createStore<Counter>({ value: 1 }).get()).toEqual({ value: 1 })
	})

	it('replaces the state and reports the previous one', () => {
		const store = createStore<Counter>({ value: 1 })
		const listener = vi.fn()
		store.subscribe(listener, new AbortController().signal)

		store.set({ value: 2 })

		expect(store.get()).toEqual({ value: 2 })
		expect(listener).toHaveBeenCalledWith({ value: 2 }, { value: 1 })
	})

	it('ignores a set to the same object', () => {
		const state: Counter = { value: 1 }
		const store = createStore(state)
		const listener = vi.fn()
		store.subscribe(listener, new AbortController().signal)

		store.set(state)

		expect(listener).not.toHaveBeenCalled()
	})

	it('notifies every listener', () => {
		const store = createStore<Counter>({ value: 0 })
		const first = vi.fn()
		const second = vi.fn()
		store.subscribe(first, new AbortController().signal)
		store.subscribe(second, new AbortController().signal)

		store.set({ value: 1 })

		expect(first).toHaveBeenCalledTimes(1)
		expect(second).toHaveBeenCalledTimes(1)
	})

	it('removes a listener when its signal aborts', () => {
		const store = createStore<Counter>({ value: 0 })
		const controller = new AbortController()
		const listener = vi.fn()
		store.subscribe(listener, controller.signal)

		controller.abort()
		store.set({ value: 1 })

		expect(listener).not.toHaveBeenCalled()
	})

	it('ignores a listener whose signal has already aborted', () => {
		const store = createStore<Counter>({ value: 0 })
		const listener = vi.fn()
		store.subscribe(listener, AbortSignal.abort())

		store.set({ value: 1 })

		expect(listener).not.toHaveBeenCalled()
	})

	it('keeps notifying when a listener unsubscribes during a change', () => {
		const store = createStore<Counter>({ value: 0 })
		const controller = new AbortController()
		const second = vi.fn()
		store.subscribe(() => { controller.abort() }, new AbortController().signal)
		store.subscribe(second, controller.signal)

		store.set({ value: 1 })

		expect(second).toHaveBeenCalledTimes(1)
	})
})
