/**
 * The app itself: the full-viewport container, the one canvas at the back and the routed screen on
 * top of it ([layers](../../../docs/architecture/rendering.md#layers)).
 *
 * The canvas and the game loop live here, not in a route, so the world keeps one WebGL context
 * while the player moves between screens. A route puts its world on the canvas with `show()` and
 * plugs its game mode into the loop with `play()`.
 */

import { component, environment } from '@rooted/components'
import { application } from '@rooted/components/application'
import { router } from '@rooted/router/application'

import { startLoop } from './canvas/loop.mts'
import { attachViewport } from './canvas/stage.mts'
import { appRoutes } from './_routes.g.mts'
import { persistApp } from './_shared/storage/persistence.mts'
import styles from './application.css'
import { NotFound, Title } from './title/title.mts'

// Every `_routes.mts` under src/ is collected into `_routes.g.mts` at build time, so each slice
// registers its own routes and no slice has to edit this file to add one.
const Router = router({
	home: Title,
	notFound: NotFound,
	...appRoutes,
})

export const Application = component({
	name: 'application',
	styles,
	async onMount({ append, create, element, signal }) {
		// Before the first screen, so the screens start from the saved settings and high scores.
		void persistApp(signal)

		const canvas = element('canvas', {
			classes: styles.canvas,
		})
		const container = append(
			element('div', {
				classes: styles.container,
				children: [
					canvas,
					element('div', {
						classes: styles.screen,
						children: create(Router),
					}),
				],
			})
		)

		// Pre-rendering the static pages at build time has a DOM but no WebGL: those pages get the
		// screens, and the canvas comes alive when the app loads in a browser. three.js is only
		// imported then, so the pre-render never loads it.
		if (environment.is('preRenderer')) return
		const { createViewport } = await import('./canvas/viewport.mts')
		if (signal.aborted) return
		attachViewport(createViewport(canvas, container, signal), signal)
		startLoop(signal)
	},
})

application(Application)
