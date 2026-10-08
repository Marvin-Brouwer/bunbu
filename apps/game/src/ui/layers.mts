/**
 * The shell every other screen lives in: the full-viewport container, the one canvas, and one
 * empty slot per layer ([layers](../../../../docs/architecture/rendering.md#layers)).
 *
 * The HUD, the scroll, the swipe zone and the overlays are each a track of their own. They mount
 * into their layer and read the stores; this module only holds the layout and starts the loop.
 */

import { component } from '@rooted/components'
import { startLoop } from '../loop.mts'
import { createViewport } from '../render/renderer.mts'
import { createWorld } from '../render/world.mts'
import styles from './layers.css'

/** The layers over the canvas, back to front. One element each, for the tracks to fill. */
export const layerNames = ['hud', 'scroll', 'swipe', 'overlays'] as const

export type LayerName = (typeof layerNames)[number]

/** Finds a layer to mount into, for example `layer('hud')`. */
export function layer(name: LayerName): HTMLElement | null {
	return document.querySelector<HTMLElement>(`[data-layer="${name}"]`)
}

export const Layers = component({
	name: 'bunbu-layers',
	styles,
	onMount({ append, element, signal }) {
		const canvas = element('canvas', { classes: styles.canvas })
		const container = append(element('div', { classes: styles.container }))
		container.append(canvas)

		for (const name of layerNames) {
			const slot = element('div', { classes: [styles.layer, styles[name]] })
			slot.dataset.layer = name
			container.append(slot)
		}

		const { renderer, camera } = createViewport(canvas, container, signal)
		const world = createWorld(camera)
		signal.addEventListener('abort', () => { world.dispose() }, { once: true })

		startLoop({
			render(dt) {
				world.update(dt)
				renderer.render(world.scene, camera)
			},
		}, signal)
	},
})
