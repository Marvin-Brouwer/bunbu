/**
 * Red closing in from the edges of the screen when a blade lands on the samurai, fading out again:
 * once for every ninja that hits him, timed to its blade as the world shows it.
 */

import { component } from '@rooted/components'
import type { Ninjas } from '../state/ninjas.mts'
import type { Shogun } from '../state/shogun.mts'
import { bladeLandsAfter } from '../world/ninjas.mts'
import styles from './hud.css'

export type HitVignetteOptions = {
	readonly shogun: Shogun
	readonly ninjas: Ninjas
}

export const HitVignette = component<HitVignetteOptions>({
	name: 'hit-vignette',
	styles,
	onMount({ append, element, options, signal }) {
		const { shogun, ninjas } = options

		let sequence = shogun.value.sequence
		shogun.on('change', signal, ({ detail }) => {
			const { pose, sequence: next } = detail.state
			if (next === sequence) return
			sequence = next
			if (pose !== 'hurt') return
			const slicer = ninjas.value.active.some((ninja) => ninja.slicer === true)
			let vignette: HTMLElement | undefined
			const remove = () => { vignette?.remove() }
			vignette = element('div', {
				classes: styles.vignette,
				style: {
					animationDelay: `${bladeLandsAfter(slicer)}s`,
				},
				on: { animationend: remove },
			})
			append(
				vignette,
			)
		})
	},
})
