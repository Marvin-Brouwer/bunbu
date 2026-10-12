/**
 * What every stage's world is laid out with: the sky, strips along the path, keeping things off the
 * path and off each other, and models stamped out along it. Castle town is built with these, and so
 * are the other stages ([stages](./stages.mts)).
 */

import {
	BackSide,
	Box3,
	BufferGeometry,
	Color,
	Float32BufferAttribute,
	InstancedMesh,
	Matrix4,
	Mesh,
	MeshStandardMaterial,
	ShaderMaterial,
	SphereGeometry,
	Vector3,
	type Camera,
	type DirectionalLight,
	type Fog,
	type HemisphereLight,
	type Material,
	type Object3D,
	type Scene,
	type Texture,
} from 'three'
import { beside, type Path, type PathPoint } from './path.mts'

/** Where the fog has hidden everything; the camera need not see farther. */
export const fogFar = 150
/** The sky dome's radius: inside the camera's far plane, past the fog. */
export const skyRadius = 190

/** What a stage's world does every frame, and how it goes. */
export type StageView = {
	/** Keeps what follows the samurai around him: the ground under him, the light that casts shadows. */
	follow: (x: number, z: number) => void
	/** Once the camera has moved this frame, with the samurai at `x, z`: for what depends on the view. */
	frame?: (camera: Camera, x: number, z: number) => void
	/** Moves the light on toward the time of day after `marksPassed` quarter marks ({@link Daylight}). */
	passTime: (marksPassed: number, delta: number) => void
	dispose: () => void
}

/** What a stage made on the GPU, so it can be freed when the world goes. */
export type Owned = { geometries: BufferGeometry[]; materials: Material[]; textures: Texture[] }

/** The sky dome; its `top` and `horizon` colours can change while it is up. */
export type Sky = Mesh<SphereGeometry, ShaderMaterial>

/** A sky dome `radius` metres round, from `horizon` at the bottom to `top` overhead. */
export function sky(owned: Owned, top: number, horizon: number, radius = skyRadius): Sky {
	const geometry = new SphereGeometry(radius, 24, 12)
	const material = new ShaderMaterial({
		side: BackSide,
		depthWrite: false,
		fog: false,
		uniforms: {
			top: { value: new Color(top) },
			horizon: { value: new Color(horizon) },
		},
		vertexShader: 'varying vec3 vPosition; void main() { vPosition = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
		// The colours are linear, like every other colour in the scene; the include converts them for the screen.
		fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vPosition; void main() { float h = clamp(normalize(vPosition).y * 2.2, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, h), 1.0);\n#include <colorspace_fragment>\n}',
	})
	owned.geometries.push(geometry)
	owned.materials.push(material)
	const mesh = new Mesh(geometry, material)
	mesh.renderOrder = -10
	return mesh
}

/** How a stage is lit at one time of day. */
export type Light = {
	readonly skyTop: number
	readonly skyHorizon: number
	/** The fog, and the background behind it. */
	readonly fog: number
	/** The light from all round: from the sky above, from the ground below. */
	readonly ambient: { readonly sky: number; readonly ground: number; readonly intensity: number }
	/** The light that casts the shadows. */
	readonly sun: { readonly colour: number; readonly intensity: number }
	/** How brightly lanterns and lit windows glow, `0` to `1`; for stages that have them. */
	readonly lamps: number
}

/** A stage's light at the start of the run and after each of the three quarter marks. */
export type Daylight = readonly [Light, Light, Light, Light]

/** Seconds the light takes to move on to the next time of day. */
export const dayFade = 6

/**
 * Where a fade from `shown` toward `target` is after `delta` seconds, in steps of the
 * {@link Daylight}: one step per {@link dayFade} seconds.
 */
export function fadeToward(shown: number, target: number, delta: number): number {
	const step = delta / dayFade
	return target > shown ? Math.min(target, shown + step) : Math.max(target, shown - step)
}

/** `amount` of the way from `before` to `after`. */
const mix = (before: number, after: number, amount: number) => before + (after - before) * amount

/** What a stage lights itself with, for {@link passTime} to change. */
export type Lit = {
	readonly scene: Scene
	readonly fog: Fog
	readonly backdrop: Sky
	readonly ambient: HemisphereLight
	readonly sun: DirectionalLight
	/** Brightens the stage's lanterns and windows, `0` to `1`. */
	readonly lamps?: (strength: number) => void
}

/**
 * Lets the day go by over a run: after each quarter mark the stage's light fades, over
 * {@link dayFade} seconds, to the next time of day in `daylight`. Lights `lit` as the first at once.
 */
export function passTime(lit: Lit, daylight: Daylight): StageView['passTime'] {
	const { scene, fog, backdrop, ambient, sun, lamps } = lit
	const background = new Color()
	scene.background = background
	const top = backdrop.material.uniforms.top?.value as Color
	const horizon = backdrop.material.uniforms.horizon?.value as Color
	const last = daylight.length - 1
	const from = new Color()
	const to = new Color()
	const blend = (into: Color, before: number, after: number, amount: number) => into.copy(from.set(before).lerp(to.set(after), amount))

	// `shown` is how far through the day the light is, in steps of `daylight`.
	const show = (shown: number) => {
		const step = Math.min(Math.floor(shown), last - 1)
		const amount = shown - step
		const [first] = daylight
		const before = daylight[step] ?? first
		const after = daylight[step + 1] ?? before
		blend(top, before.skyTop, after.skyTop, amount)
		blend(horizon, before.skyHorizon, after.skyHorizon, amount)
		blend(fog.color, before.fog, after.fog, amount)
		background.copy(fog.color)
		blend(ambient.color, before.ambient.sky, after.ambient.sky, amount)
		blend(ambient.groundColor, before.ambient.ground, after.ambient.ground, amount)
		ambient.intensity = mix(before.ambient.intensity, after.ambient.intensity, amount)
		blend(sun.color, before.sun.colour, after.sun.colour, amount)
		sun.intensity = mix(before.sun.intensity, after.sun.intensity, amount)
		lamps?.(mix(before.lamps, after.lamps, amount))
	}

	show(0)
	// A run joined halfway (a fixture) starts at its own time of day instead of fading there.
	let shown: number | undefined
	return (marksPassed, delta) => {
		const target = Math.min(marksPassed, last)
		if (target === shown) return
		shown = shown === undefined ? target : fadeToward(shown, target, delta)
		show(shown)
	}
}

export type Strip = {
	/** Half the strip's width at a distance along the path. */
	readonly half: (distance: number) => number
	readonly colour: (distance: number) => Color
	readonly y: number
	/** Whether the strip runs at a distance; it breaks off where this says no. */
	readonly runs?: (distance: number) => boolean
}

/** A flat strip along the path: the road, the grass of the gardens. */
export function strip(path: Path, from: number, to: number, owned: Owned, { half, colour, y, runs = () => true }: Strip): Mesh {
	const positions: number[] = []
	const colours: number[] = []
	let previous: readonly [number, number, number, number] | undefined
	for (let distance = from; distance <= to; distance += 1) {
		if (!runs(distance)) {
			previous = undefined
			continue
		}
		const point = path.at(distance)
		const left = beside(point, -half(distance))
		const right = beside(point, half(distance))
		const shade = colour(distance)
		if (previous !== undefined) {
			const [leftX, leftZ, rightX, rightZ] = previous
			// Wound so the faces look up.
			positions.push(leftX, y, leftZ, rightX, y, rightZ, left.x, y, left.z, rightX, y, rightZ, right.x, y, right.z, left.x, y, left.z)
			for (let vertex = 0; vertex < 6; vertex++) colours.push(shade.r, shade.g, shade.b)
		}
		previous = [left.x, left.z, right.x, right.z]
	}
	const geometry = new BufferGeometry()
	geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
	geometry.setAttribute('color', new Float32BufferAttribute(colours, 3))
	geometry.computeVertexNormals()
	const material = new MeshStandardMaterial({ vertexColors: true, roughness: 1 })
	owned.geometries.push(geometry)
	owned.materials.push(material)
	const mesh = new Mesh(geometry, material)
	mesh.receiveShadow = true
	return mesh
}


/** Whether `x, z` is at least `clear` metres from the path, checked `window` metres either side of `near` along it. */
export type Clearance = (x: number, z: number, near: number, clear: number, window?: number) => boolean

/** Samples the path every metre, to keep houses, trees and landmarks off it. */
export function clearanceOf(path: Path, from: number, to: number): Clearance {
	const points: PathPoint[] = []
	for (let distance = from; distance <= to; distance += 1) points.push(path.at(distance))
	return (x, z, near, clear, window = 40) => {
		const first = Math.max(0, Math.floor(near - from - window))
		const last = Math.min(points.length - 1, Math.ceil(near - from + window))
		for (let index = first; index <= last; index++) {
			const point = points[index]
			if (point !== undefined && Math.hypot(point.x - x, point.z - z) < clear) return false
		}
		return true
	}
}

/** Ground already taken, by a house, a pond or a tree, as circles. */
export type Taken = { x: number; z: number; radius: number }[]

export const isFree = (taken: Taken, x: number, z: number, radius: number) =>
	taken.every((spot) => Math.hypot(spot.x - x, spot.z - z) >= spot.radius + radius)

/** The rotation about `y` that turns a thing's front (`+z`) toward the path from `side`. */
export const facingPath = (point: PathPoint, side: number) => Math.atan2(-side * Math.cos(point.heading), side * Math.sin(point.heading))

/** A model placed once it is in, and the stretch of path it belongs to. */
export type Planting = { readonly matrix: Matrix4; readonly chunk: number }

/**
 * Copies `template` once per planting, one `InstancedMesh` per mesh in it and per stretch of path.
 * The template's materials are cloned for the town, so foliage can be made a cut-out without
 * touching the shared model.
 */
export function stamp(template: Object3D, plantings: readonly Planting[], height: number, shadows: boolean, owned: Owned): InstancedMesh[] {
	if (plantings.length === 0) return []
	template.updateMatrixWorld(true)
	// Scale the model to `height` metres, centred and standing on the ground, wherever it sat in its file.
	const bounds = new Box3().setFromObject(template)
	const centre = bounds.getCenter(new Vector3())
	const scale = height / Math.max(bounds.max.y - bounds.min.y, 1e-3)
	const fit = new Matrix4().makeScale(scale, scale, scale).multiply(new Matrix4().makeTranslation(-centre.x, -bounds.min.y, -centre.z))

	const chunks = new Map<number, Matrix4[]>()
	for (const { matrix, chunk } of plantings) {
		const matrices = chunks.get(chunk)
		if (matrices === undefined) chunks.set(chunk, [matrix])
		else matrices.push(matrix)
	}

	const meshes: InstancedMesh[] = []
	template.traverse((object) => {
		if (!(object instanceof Mesh)) return
		const local = new Matrix4().multiplyMatrices(fit, object.matrixWorld)
		const own = (object.material as Material).clone()
		// Blended leaves sort wrongly between copies in one mesh; a cut-out draws right in any order
		// ([premultiplied alpha](../../../../../docs/architecture/rendering.md#premultiplied-alpha-caveat)).
		if (own.transparent) {
			own.transparent = false
			own.alphaTest = 0.5
			own.depthWrite = true
		}
		owned.materials.push(own)
		for (const matrices of chunks.values()) {
			const mesh = new InstancedMesh(object.geometry as BufferGeometry, own, matrices.length)
			matrices.forEach((matrix, index) => { mesh.setMatrixAt(index, new Matrix4().multiplyMatrices(matrix, local)) })
			mesh.instanceMatrix.needsUpdate = true
			mesh.castShadow = shadows
			mesh.computeBoundingSphere()
			meshes.push(mesh)
		}
	})
	return meshes
}

/**
 * Cuts away whatever of `material` is nearer the camera than `cut.value`, in view depth: what the camera
 * passes through or under (a tunnel of torii, a gatehouse) would otherwise fill the screen. Its shadow stays.
 */
export function cutAway(material: Material, cut: { value: number }): void {
	material.onBeforeCompile = (shader) => {
		shader.uniforms.cutDepth = cut
		shader.vertexShader = `varying float vViewDepth;\n${shader.vertexShader}`.replace(
			'#include <project_vertex>',
			'#include <project_vertex>\n\tvViewDepth = -mvPosition.z;',
		)
		shader.fragmentShader = `uniform float cutDepth;\nvarying float vViewDepth;\n${shader.fragmentShader}`.replace(
			'void main() {',
			'void main() {\n\tif (vViewDepth < cutDepth) discard;',
		)
	}
	material.customProgramCacheKey = () => 'cut-away'
	material.needsUpdate = true
}
