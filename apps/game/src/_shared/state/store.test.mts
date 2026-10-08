import { describe, expect, it, vi } from 'vitest'
import { createLife } from '../../fight/state/life.mts'

describe('a store module', () => {
	it('hands out a frozen snapshot', () => {
		const life = createLife()
		expect(Object.isFrozen(life.value)).toBe(true)
	})

	it('tells listeners about a change until their signal aborts', () => {
		const life = createLife()
		const controller = new AbortController()
		const listener = vi.fn()
		life.on('change', controller.signal, listener)

		life.value.hit(0.25)
		controller.abort()
		life.value.hit(0.25)

		expect(listener).toHaveBeenCalledOnce()
		expect(life.value.value).toBe(0.5)
	})
})
