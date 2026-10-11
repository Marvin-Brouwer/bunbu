/**
 * The run's effects: the slash trail when the samurai cuts, and the ink splash when a ninja is
 * slain. Both are timed from the store's poses, like the figures, and hold nothing the game needs.
 *
 * The slash trail is drawn in the second pass, over the world whatever its depth
 * ([layering](../../../../../docs/architecture/rendering.md#layering-inside-the-canvas)): a brush
 * stroke across the screen, not a thing among the houses. The ink is in the world, so a house or a
 * tree in front of a ninja hides his splash too.
 */

import {
	BufferGeometry,
	CanvasTexture,
	Color,
	Float32BufferAttribute,
	Group,
	Mesh,
	MeshBasicMaterial,
	PlaneGeometry,
	ShaderMaterial,
	SRGBColorSpace,
	Sprite,
	SpriteMaterial,
	type Camera,
	type Scene,
} from 'three'

/** `0` to `1` over `seconds`, from `0` before and held at `1` after. */
const progress = (time: number, seconds: number) => Math.min(1, Math.max(0, time / seconds))
const easeOut = (amount: number) => 1 - (1 - amount) ** 2

/** A number from `0` to `1` for `seed`, the same every time. */
function scatter(seed: number): number {
	const x = Math.sin(seed * 12.9898) * 43758.5453
	return x - Math.floor(x)
}

/** Seconds into a strike: when the blade starts across, how long the stroke takes, when it has gone. */
export const slashTiming = {
	from: 0.06,
	sweep: 0.12,
	fadeFrom: 0.2,
	fade: 0.3,
} as const

export type Slash = {
	/** How much of the stroke is drawn, `0` to `1`. */
	readonly sweep: number
	/** `1` fully there, `0` gone. */
	readonly opacity: number
}

/** The slash trail `time` seconds into a strike, or `undefined` before it starts and once it is gone. */
export function slashOf(time: number): Slash | undefined {
	const end = slashTiming.fadeFrom + slashTiming.fade
	if (time < slashTiming.from || time >= end) return undefined
	return {
		sweep: easeOut(progress(time - slashTiming.from, slashTiming.sweep)),
		opacity: 1 - progress(time - slashTiming.fadeFrom, slashTiming.fade),
	}
}

/** Seconds and sizes of the ink splash: the burst, the drops it throws and the stain it leaves. */
export const inkTiming = {
	burst: 0.12,
	burstFadeFrom: 0.25,
	burstFade: 0.5,
	/** The stain stays while the slain ninja lies there, and fades with him. */
	stainFadeFrom: 1.1,
	stainFade: 0.5,
	drops: 7,
} as const

const gravity = 9.8
/** Metres above the ground the ink bursts from: the ninja's chest. */
const chest = 1.1

export type Splash = {
	readonly burst: { readonly size: number; readonly opacity: number }
	readonly stain: { readonly size: number; readonly opacity: number }
	/** Each drop's place around the ninja, in metres, and its size. */
	readonly drops: readonly { readonly x: number; readonly y: number; readonly z: number; readonly size: number; readonly opacity: number }[]
}

/**
 * The ink splash `time` seconds after the ninja `id` was slain: a burst at his chest, drops thrown
 * out that fall to the ground, and a stain that spreads under him. A function of time alone.
 */
export function splashOf(id: number, time: number): Splash {
	const t = Math.max(0, time)
	const burstOpacity = 0.92 * (1 - progress(t - inkTiming.burstFadeFrom, inkTiming.burstFade))
	const drops = Array.from({ length: inkTiming.drops }, (_, index) => {
		const seed = id * 31 + index * 5
		const angle = scatter(seed) * Math.PI * 2
		const speed = 1.4 + scatter(seed + 1) * 1.6
		const up = 1 + scatter(seed + 2) * 1.8
		// Up and out, then down; it stops where it lands.
		const landed = (up + Math.sqrt(up * up + 2 * gravity * chest)) / gravity
		const flight = Math.min(t, landed)
		return {
			x: Math.cos(angle) * speed * flight,
			y: Math.max(0.03, chest + up * flight - (gravity * flight * flight) / 2),
			z: Math.sin(angle) * speed * flight,
			size: 0.12 + scatter(seed + 3) * 0.14,
			opacity: t < landed ? 0.95 : 0.8 * (1 - progress(t - inkTiming.stainFadeFrom, inkTiming.stainFade)),
		}
	})
	return {
		burst: { size: 0.4 + 1.4 * easeOut(progress(t, inkTiming.burst)), opacity: burstOpacity },
		stain: {
			size: 1.6 * easeOut(progress(t - 0.1, 0.3)),
			opacity: 0.75 * (1 - progress(t - inkTiming.stainFadeFrom, inkTiming.stainFade)),
		},
		drops,
	}
}

/** Sumi ink, not quite black. */
const ink = 0x15121c

/** A blot of ink drawn on a canvas: a round body with spatters around it, the same every time. */
function blotTexture(): CanvasTexture {
	const size = 128
	const canvas = document.createElement('canvas')
	canvas.width = size
	canvas.height = size
	const context = canvas.getContext('2d')
	if (context !== null) {
		context.fillStyle = '#ffffff'
		const blob = (x: number, y: number, radius: number) => {
			context.beginPath()
			context.arc(x, y, radius, 0, Math.PI * 2)
			context.fill()
		}
		blob(size / 2, size / 2, size * 0.27)
		for (let index = 0; index < 14; index++) {
			const angle = scatter(index + 100) * Math.PI * 2
			const out = size * (0.18 + scatter(index + 200) * 0.24)
			blob(size / 2 + Math.cos(angle) * out, size / 2 + Math.sin(angle) * out, size * (0.03 + scatter(index + 300) * 0.07))
		}
	}
	const texture = new CanvasTexture(canvas)
	texture.colorSpace = SRGBColorSpace
	return texture
}

/** The slash's stroke: an arc, thick in the middle and pointed at both ends, `u` along it. */
function strokeGeometry(): BufferGeometry {
	const segments = 40
	const radius = 1.5
	const thickness = 0.55
	// From over his right shoulder, down across to his left.
	const from = Math.PI * 0.2
	const to = Math.PI * 1.05
	const positions: number[] = []
	const uvs: number[] = []
	const indices: number[] = []
	for (let index = 0; index <= segments; index++) {
		const u = index / segments
		const angle = from + (to - from) * u
		const half = (thickness / 2) * Math.sin(Math.PI * u) ** 0.6
		for (const [side, v] of [[-half, 0], [half, 1]] as const) {
			positions.push(Math.cos(angle) * (radius + side), Math.sin(angle) * (radius + side), 0)
			uvs.push(u, v)
		}
		if (index > 0) {
			const at = index * 2
			indices.push(at - 2, at - 1, at, at - 1, at + 1, at)
		}
	}
	const geometry = new BufferGeometry()
	geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
	geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
	geometry.setIndex(indices)
	return geometry
}

/** Draws the stroke up to `sweep`, brightest at its head and thinning out behind it. */
function strokeMaterial(): ShaderMaterial {
	return new ShaderMaterial({
		uniforms: {
			sweep: { value: 0 },
			opacity: { value: 1 },
			colour: { value: new Color(0xfff6e8) },
		},
		vertexShader: /* glsl */ `
			varying vec2 vUv;
			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
		`,
		fragmentShader: /* glsl */ `
			uniform float sweep;
			uniform float opacity;
			uniform vec3 colour;
			varying vec2 vUv;
			void main() {
				if (vUv.x > sweep) discard;
				float tail = smoothstep(sweep - 0.75, sweep, vUv.x);
				float edge = 1.0 - pow(abs(vUv.y * 2.0 - 1.0), 3.0);
				float alpha = tail * edge * opacity;
				// Premultiplied, as the page composites the canvas.
				gl_FragColor = vec4(colour * alpha, alpha);
			}
		`,
		transparent: true,
		premultipliedAlpha: true,
		depthTest: false,
		depthWrite: false,
	})
}

/** Where a slain ninja lies, and how long ago he fell. */
export type SlainSpot = {
	readonly id: number
	readonly x: number
	readonly z: number
	readonly time: number
}

/** What the effects need to know about the samurai's cut this frame. */
export type Cut = {
	readonly x: number
	readonly z: number
	/** The way he faces, as a rotation about `y`. */
	readonly heading: number
	/** Seconds into the strike, or `undefined` when he isn't striking. */
	readonly time: number | undefined
	/** `-1` when the ninja he cuts is to his left on screen, `1` to his right, `0` ahead. */
	readonly side: number
}

export type Effects = {
	draw: (cut: Cut, slain: readonly SlainSpot[], camera: Camera) => void
	dispose: () => void
}

type Ink = {
	readonly group: Group
	readonly burst: Sprite
	readonly drops: readonly Sprite[]
	readonly stain: Mesh
}

/** The slash goes in `overlay`, the ink in `world`. */
export function createEffects(world: Scene, overlay: Scene): Effects {
	const stroke = new Mesh(strokeGeometry(), strokeMaterial())
	stroke.visible = false
	overlay.add(stroke)
	const strokeUniforms = stroke.material.uniforms as { sweep: { value: number }; opacity: { value: number } }

	const blot = blotTexture()
	const stainGeometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
	const inks = new Map<number, Ink>()

	const inkMaterial = () => new SpriteMaterial({ map: blot, color: ink, transparent: true, depthWrite: false, premultipliedAlpha: true })
	const makeInk = (): Ink => {
		const group = new Group()
		const burst = new Sprite(inkMaterial())
		burst.renderOrder = 2
		const drops = Array.from({ length: inkTiming.drops }, () => {
			const drop = new Sprite(inkMaterial())
			drop.renderOrder = 2
			return drop
		})
		const stain = new Mesh(stainGeometry, new MeshBasicMaterial({ map: blot, color: ink, transparent: true, depthWrite: false, premultipliedAlpha: true }))
		stain.position.y = 0.03
		stain.renderOrder = 1
		group.add(burst, stain, ...drops)
		world.add(group)
		return { group, burst, drops, stain }
	}
	const dropInk = (id: number, made: Ink) => {
		world.remove(made.group)
		for (const sprite of [made.burst, ...made.drops]) sprite.material.dispose()
		;(made.stain.material as MeshBasicMaterial).dispose()
		inks.delete(id)
	}

	return {
		draw(cut, slain, camera) {
			const slash = cut.time === undefined ? undefined : slashOf(cut.time)
			stroke.visible = slash !== undefined
			if (slash !== undefined) {
				strokeUniforms.sweep.value = slash.sweep
				strokeUniforms.opacity.value = slash.opacity
				// In front of him, toward the ninja he cuts, square to the camera like a brush stroke on
				// the screen; mirrored when that ninja is on his left.
				const ahead = 0.9
				const aside = cut.side * 0.6
				stroke.position.set(
					cut.x - Math.sin(cut.heading) * ahead + Math.cos(cut.heading) * aside,
					1.25,
					cut.z - Math.cos(cut.heading) * ahead - Math.sin(cut.heading) * aside,
				)
				stroke.quaternion.copy(camera.quaternion)
				stroke.scale.set(cut.side < 0 ? -1 : 1, 1, 1)
			}

			for (const spot of slain) {
				let made = inks.get(spot.id)
				if (made === undefined) {
					made = makeInk()
					inks.set(spot.id, made)
				}
				const splash = splashOf(spot.id, spot.time)
				made.group.position.set(spot.x, 0, spot.z)
				made.burst.position.set(0, chest, 0)
				made.burst.scale.setScalar(splash.burst.size)
				made.burst.material.opacity = splash.burst.opacity
				made.burst.visible = splash.burst.opacity > 0
				splash.drops.forEach((drop, index) => {
					const sprite = made.drops[index]
					if (sprite === undefined) return
					sprite.position.set(drop.x, drop.y, drop.z)
					sprite.scale.setScalar(drop.size)
					sprite.material.opacity = drop.opacity
					sprite.visible = drop.opacity > 0
				})
				made.stain.scale.set(splash.stain.size, 1, splash.stain.size)
				;(made.stain.material as MeshBasicMaterial).opacity = splash.stain.opacity
				made.stain.visible = splash.stain.opacity > 0 && splash.stain.size > 0
			}
			for (const [id, made] of inks) {
				if (!slain.some((spot) => spot.id === id)) dropInk(id, made)
			}
		},

		dispose() {
			for (const [id, made] of inks) dropInk(id, made)
			overlay.remove(stroke)
			stroke.geometry.dispose()
			stroke.material.dispose()
			stainGeometry.dispose()
			blot.dispose()
		},
	}
}
