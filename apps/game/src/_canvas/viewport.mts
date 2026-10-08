/**
 * The one `WebGLRenderer` and the one canvas
 * ([renderer setup](../../../../docs/architecture/rendering.md#renderer-setup)).
 *
 * The pixel ratio is capped at 2, because phones report 3 or more for little visible gain, and
 * the size follows a `ResizeObserver` on the container rather than window events.
 */

import { resizeObserver } from '@rooted/observers'
import { PerspectiveCamera, WebGLRenderer } from 'three'

/** Cap on `devicePixelRatio`: above this the pixels to shade roughly double for no visible gain. */
export const maximumPixelRatio = 2

export type Viewport = {
	readonly renderer: WebGLRenderer
	readonly camera: PerspectiveCamera
}

export function createViewport(canvas: HTMLCanvasElement, container: Element, signal: AbortSignal): Viewport {
	const renderer = new WebGLRenderer({
		canvas,
		// Transparent, so a CSS backdrop can show through. Keep the clear colour fully transparent
		// black: a colour with alpha 0 fringes, because the page composites premultiplied alpha.
		alpha: true,
		antialias: true,
		powerPreference: 'high-performance',
	})
	renderer.setClearColor(0x000000, 0)
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, maximumPixelRatio))

	const camera = new PerspectiveCamera(60, 1, 0.1, 200)

	const resize = () => {
		const { clientWidth, clientHeight } = container
		if (clientWidth === 0 || clientHeight === 0) return
		renderer.setSize(clientWidth, clientHeight, false)
		camera.aspect = clientWidth / clientHeight
		camera.updateProjectionMatrix()
	}

	resizeObserver({
		targets: container,
		signal,
		on: {
			resize,
		},
	})
	resize()

	signal.addEventListener('abort', () => {
		renderer.dispose()
	}, { once: true })

	return { renderer, camera }
}
