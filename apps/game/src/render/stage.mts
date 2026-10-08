/**
 * What the one canvas shows. The shell owns the canvas and the renderer for the whole app
 * ([decision](../../../../docs/architecture/rendering.md#decision)); a route puts its world on it
 * with `show()` while it is mounted, and takes it off again when it unmounts.
 */

import type { PerspectiveCamera, Scene } from 'three'
import type { Viewport } from './viewport.mts'

/** A world on the canvas: a scene, and a function that makes it match the state every frame. */
export type View = {
	readonly scene: Scene
	/** Reads the stores and updates the scene. Never changes state. */
	draw: (dt: number) => void
	dispose?: () => void
}

/** Builds a view for the shared camera. */
export type ViewFactory = (camera: PerspectiveCamera) => View

let viewport: Viewport | undefined
let factory: ViewFactory | undefined
let view: View | undefined

function build(): void {
	view?.dispose?.()
	view = viewport !== undefined && factory !== undefined ? factory(viewport.camera) : undefined
}

/** Shows a world on the canvas until `signal` aborts, usually the route component's own signal. */
export function show(create: ViewFactory, signal: AbortSignal): void {
	factory = create
	build()
	signal.addEventListener('abort', () => {
		if (factory !== create) return
		factory = undefined
		build()
	}, { once: true })
}

/** Called by the shell once the canvas exists. A view shown before that is built now. */
export function attachViewport(attached: Viewport, signal: AbortSignal): void {
	viewport = attached
	build()
	signal.addEventListener('abort', () => {
		view?.dispose?.()
		view = undefined
		viewport = undefined
	}, { once: true })
}

/** Draws one frame of whatever is on the canvas, or clears it when nothing is. */
export function drawFrame(dt: number): void {
	if (viewport === undefined) return
	if (view === undefined) {
		viewport.renderer.clear()
		return
	}
	view.draw(dt)
	viewport.renderer.render(view.scene, viewport.camera)
}
