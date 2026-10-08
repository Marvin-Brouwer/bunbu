/**
 * The app's frame, mounted once: the full-viewport container, the one canvas at the back, and the
 * routed screen on top of it ([layers](../../../../../docs/architecture/rendering.md#layers)).
 *
 * The canvas and the game loop live here, not in a route, so the world keeps one WebGL context
 * while the player moves between screens. A route puts its world on the canvas with `show()` and
 * plugs its game mode into the loop with `play()`.
 */

import { component, environment, type Component } from '@rooted/components'
import type { RouterOptions } from '@rooted/router'
import { startLoop } from '../../loop.mts'
import { attachViewport } from '../../render/stage.mts'
import { createViewport } from '../../render/viewport.mts'
import styles from './shell.css'

export type ShellOptions = {
	/** The router that renders the current screen. */
	readonly router: Component<RouterOptions>
}

export const Shell = component<ShellOptions>({
	name: 'bunbu-shell',
	styles,
	onMount({ append, create, element, options, signal }) {
		const canvas = element('canvas', { classes: styles.canvas })
		const screen = element('div', { classes: styles.screen })
		const container = append(element('div', { classes: styles.container, children: [canvas, screen] }))

		// Pre-rendering the static pages at build time has a DOM but no WebGL: those pages get the
		// screens, and the canvas comes alive when the app loads in a browser.
		if (!environment.is('preRenderer')) {
			attachViewport(createViewport(canvas, container, signal), signal)
			startLoop(signal)
		}

		screen.append(create(options.router))
	},
})
