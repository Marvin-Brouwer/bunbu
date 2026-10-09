/**
 * Castle town ([2 Quiz + stage](../../../../../docs/design/screens.md#2-quiz--stage)) at dusk:
 * streets of two-storey town houses with lattice fronts, tiled roofs, noren curtains and paper
 * lanterns, and between them gardens with maples, bamboo, stone lanterns, a pond under a red bridge
 * and a torii at the gate. The path turns corners and winds through the gardens ({@link Path}).
 *
 * The houses and props are made here from simple shapes; the trees, bamboo and torii are Quaternius
 * models (CC0), added once they have loaded. Everything is laid out once, when the run starts, in
 * stretches of path that are each their own `InstancedMesh`, so only what is in view is drawn.
 */

import {
	AdditiveBlending,
	BackSide,
	Box3,
	BoxGeometry,
	BufferGeometry,
	CircleGeometry,
	Color,
	CylinderGeometry,
	DirectionalLight,
	DodecahedronGeometry,
	Float32BufferAttribute,
	Fog,
	Group,
	HemisphereLight,
	InstancedMesh,
	Matrix4,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	Points,
	PointsMaterial,
	ShaderMaterial,
	SphereGeometry,
	Vector3,
	type Material,
	type Object3D,
	type Scene,
	type Texture,
} from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { Batch, chunkOf, gableGeometry, glowTexture, placed, scatter, slatsTexture, within, type Cursor } from './kit.mts'
import { beside, type Path, type PathPoint } from './path.mts'

/** Half the width of the street, and of the garden path, in metres. */
export const streetHalfWidth = 4.6
export const gardenHalfWidth = 1.8

/** Where the fog has hidden everything; the camera need not see farther. */
export const fogFar = 150
/** The sky dome's radius: inside the camera's far plane, past the fog. */
export const skyRadius = 190

const palette = {
	skyTop: 0x1d2147,
	skyHorizon: 0xe58a5c,
	fog: 0x8a6070,
	street: 0x7a6650,
	gardenPath: 0xa79e8e,
	ground: 0x5e5044,
	grass: 0x4f6b3a,
	timber: [0x5a4030, 0x6a4a32, 0x4d3a2c, 0x7a5236],
	plaster: [0xe8e0cc, 0xd9cfb6, 0xefe7d6],
	roof: 0x3a3e46,
	eave: 0x5a5f68,
	noren: [0x23345e, 0x8e2a22, 0xe9e2d0, 0x2f4a3a],
	lantern: 0xff5a2a,
	paper: 0xffd9a0,
	stone: 0x8d877b,
	water: 0x2d4a5a,
	bridge: 0xa8261c,
}

export type StageView = {
	/** Keeps what follows the samurai around him: the ground under him, the light that casts shadows. */
	follow: (x: number, z: number) => void
	dispose: () => void
}

/** The models the town uses; it is built without them first and gets them when they are in. */
export type TownModels = {
	readonly maple: GLTF
	readonly torii: GLTF
	readonly bamboo: GLTF
}

/** What this town made on the GPU, so it can be freed when the world goes. */
type Owned = { geometries: BufferGeometry[]; materials: Material[]; textures: Texture[] }

function sky(owned: Owned): Mesh {
	const geometry = new SphereGeometry(skyRadius, 24, 12)
	const material = new ShaderMaterial({
		side: BackSide,
		depthWrite: false,
		fog: false,
		uniforms: {
			top: { value: new Color(palette.skyTop) },
			horizon: { value: new Color(palette.skyHorizon) },
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

type Strip = {
	/** Half the strip's width at a distance along the path. */
	readonly half: (distance: number) => number
	readonly colour: (distance: number) => Color
	readonly y: number
	/** Whether the strip runs at a distance; it breaks off where this says no. */
	readonly runs?: (distance: number) => boolean
}

/** A flat strip along the path: the road, the grass of the gardens. */
function strip(path: Path, from: number, to: number, owned: Owned, { half, colour, y, runs = () => true }: Strip): Mesh {
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
type Clearance = (x: number, z: number, near: number, clear: number, window?: number) => boolean

/** Samples the path every metre, to keep houses, trees and landmarks off it. */
function clearanceOf(path: Path, from: number, to: number): Clearance {
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
type Taken = { x: number; z: number; radius: number }[]

const isFree = (taken: Taken, x: number, z: number, radius: number) =>
	taken.every((spot) => Math.hypot(spot.x - x, spot.z - z) >= spot.radius + radius)

/** The rotation about `y` that turns a thing's front (`+z`) toward the path from `side`. */
const facingPath = (point: PathPoint, side: number) => Math.atan2(-side * Math.cos(point.heading), side * Math.sin(point.heading))

type Town = {
	readonly walls: Batch
	readonly lattice: Batch
	readonly plaster: Batch
	readonly windows: Batch
	readonly roofs: Batch
	readonly eaves: Batch
	readonly ridges: Batch
	readonly noren: Batch
	readonly lanterns: Batch
	readonly stone: Batch
	readonly lanternLight: Batch
	readonly barrels: Batch
	readonly water: Batch
	readonly bridge: Batch
	readonly rocks: Batch
	readonly glows: number[]
}

/** The point a matrix places its origin at, for the glow of a lantern. */
const origin = (matrix: Matrix4) => new Vector3().setFromMatrixPosition(matrix).toArray()

/** A town house (machiya) `width` wide, its front on the street. */
function house(town: Town, frame: Matrix4, width: number, index: number): void {
	const depth = 7
	const two = scatter(index + 11) > 0.3
	const timber = palette.timber[Math.floor(scatter(index + 12) * palette.timber.length)] ?? palette.timber[0]
	const plaster = palette.plaster[Math.floor(scatter(index + 13) * palette.plaster.length)] ?? palette.plaster[0]
	const front = depth / 2

	town.walls.add(within(frame, placed(0, 1.5, 0, 0, width, 3, depth)), timber)
	town.lattice.add(within(frame, placed(0, 1.35, front + 0.04, 0, width - 0.5, 2.2, 0.08)), timber)
	// The pent roof over the ground floor, sloping down toward the street.
	const eave = within(frame, placed(0, 3.15, front + 0.4))
	eave.multiply(new Matrix4().makeRotationX(0.5)).multiply(placed(0, 0, 0, 0, width - 0.1, 0.1, 1))
	town.eaves.add(eave, palette.eave)

	const door = (scatter(index + 14) - 0.5) * (width - 2)
	town.noren.add(within(frame, placed(door, 2.15, front + 0.16, 0, 1.3, 0.75, 0.04)), palette.noren[Math.floor(scatter(index + 15) * palette.noren.length)] ?? palette.noren[0])

	let top = 3
	let roofDepth = depth + 1
	if (two) {
		const upperDepth = depth - 1.6
		town.plaster.add(within(frame, placed(0, 3 + 1.1, -0.8, 0, width - 0.2, 2.2, upperDepth)), plaster)
		town.windows.add(within(frame, placed(0, 4.1, upperDepth / 2 - 0.8 + 0.04, 0, Math.min(2.4, width - 1.2), 0.6, 0.06)), timber)
		top = 5.2
		roofDepth = upperDepth + 1.2
	}
	town.roofs.add(within(frame, placed(0, top, two ? -0.8 : 0, 0, width + 0.5, 1.5, roofDepth)), palette.roof)
	town.ridges.add(within(frame, placed(0, top + 1.5, two ? -0.8 : 0, 0, width + 0.5, 0.18, 0.3)), 0x2a2d33)

	if (scatter(index + 16) > 0.45) {
		const side = scatter(index + 17) > 0.5 ? 1 : -1
		const at = within(frame, placed(side * (width / 2 - 0.7), 2.45, front + 1))
		town.lanterns.add(within(at, placed(0, 0, 0, 0, 0.42, 0.55, 0.42)), palette.lantern)
		town.glows.push(...origin(at))
	}
	if (scatter(index + 18) > 0.75) {
		const along = (scatter(index + 19) - 0.5) * width
		town.barrels.add(within(frame, placed(along, 0.45, front + 0.9, 0, 0.9)), 0x6a4a30)
	}
}

/** A stone lantern (tōrō): base, post, the lit firebox, roof and knob. */
function stoneLantern(town: Town, frame: Matrix4): void {
	town.stone.add(within(frame, placed(0, 0.15, 0, 0, 0.7, 0.3, 0.7)), palette.stone)
	town.stone.add(within(frame, placed(0, 0.75, 0, 0, 0.28, 0.9, 0.28)), palette.stone)
	town.lanternLight.add(within(frame, placed(0, 1.4, 0, 0, 0.45, 0.4, 0.45)), palette.paper)
	town.stone.add(within(frame, placed(0, 1.72, 0, Math.PI / 4, 0.95, 0.22, 0.95)), palette.stone)
	town.stone.add(within(frame, placed(0, 1.95, 0, 0, 0.2, 0.25, 0.2)), palette.stone)
	town.glows.push(...origin(within(frame, placed(0, 1.4, 0))))
}

/** A five-storey pagoda on the skyline. */
function pagoda(town: Town, frame: Matrix4): void {
	for (let storey = 0; storey < 5; storey++) {
		const size = 7 - storey * 0.9
		const y = storey * 3.2
		town.walls.add(within(frame, placed(0, y + 1.3, 0, 0, size * 0.62, 2.6, size * 0.62)), palette.bridge)
		town.roofs.add(within(frame, placed(0, y + 2.4, 0, 0, size + 1.6, 1.1, size + 1.6)), palette.roof)
		town.roofs.add(within(frame, placed(0, y + 2.4, 0, Math.PI / 2, size + 1.6, 1.1, size + 1.6)), palette.roof)
	}
	town.ridges.add(within(frame, placed(0, 18, 0, 0, 0.25, 4, 0.25)), 0xb8913a)
}

/** A castle keep (tenshu) far off: a stone base and white storeys under dark roofs. */
function castle(town: Town, frame: Matrix4): void {
	town.stone.add(within(frame, placed(0, 3, 0, 0, 26, 6, 20)), 0x6e685e)
	for (let storey = 0; storey < 4; storey++) {
		const width = 18 - storey * 3.5
		const depth = 14 - storey * 2.8
		const y = 6 + storey * 4.2
		town.plaster.add(within(frame, placed(0, y + 1.8, 0, 0, width, 3.6, depth)), 0xeae4d4)
		town.roofs.add(within(frame, placed(0, y + 3.4, 0, 0, width + 3, 2.2, depth + 3)), palette.roof)
	}
}

/** A model placed once it is in, and the stretch of path it belongs to. */
type Planting = { readonly matrix: Matrix4; readonly chunk: number }

/** The models placed once they are in: maples, bamboo, the torii. */
type Pending = {
	readonly maples: Planting[]
	readonly bamboo: Planting[]
	readonly torii: Planting[]
}

/** Stretches of their own for landmarks far off the path, so each is culled on its own. */
const landmarkChunks = 100_000

/** The stretches of path that run through a garden, from where they start to where they end. */
function gardensOf(path: Path, from: number, to: number): { start: number; end: number }[] {
	const gardens: { start: number; end: number }[] = []
	for (let distance = from; distance < to; distance += 1) {
		if (path.at(distance).zone !== 'garden') continue
		const last = gardens.at(-1)
		if (last?.end === distance - 1) last.end = distance
		else gardens.push({ start: distance, end: distance })
	}
	return gardens
}

function lay(path: Path, from: number, to: number): { town: Town; pending: Pending; owned: Owned; group: Group } {
	const owned: Owned = { geometries: [], materials: [], textures: [] }
	const geometry = <T extends BufferGeometry>(made: T) => {
		owned.geometries.push(made)
		return made
	}
	const material = <T extends Material>(made: T) => {
		owned.materials.push(made)
		return made
	}
	const slats = slatsTexture()
	owned.textures.push(slats)
	slats.repeat.set(3, 1)

	const cursor: Cursor = { chunk: 0 }
	const box = geometry(new BoxGeometry(1, 1, 1))
	const lit = (roughness = 0.85) => material(new MeshStandardMaterial({ roughness, flatShading: true }))
	const town: Town = {
		walls: new Batch(box, lit(), cursor, { cast: true, receive: true }),
		// Shops open at dusk: warm light from inside shows through the lattice.
		lattice: new Batch(box, material(new MeshStandardMaterial({ map: slats, roughness: 0.9, emissive: 0xffa050, emissiveMap: slats, emissiveIntensity: 0.35 })), cursor),
		plaster: new Batch(box, lit(0.95), cursor, { cast: true, receive: true }),
		windows: new Batch(box, material(new MeshStandardMaterial({ map: slats, roughness: 0.9 })), cursor),
		roofs: new Batch(geometry(gableGeometry()), lit(0.7), cursor, { cast: true }),
		eaves: new Batch(box, lit(0.7), cursor),
		ridges: new Batch(box, lit(0.7), cursor),
		noren: new Batch(box, lit(1), cursor),
		lanterns: new Batch(geometry(new CylinderGeometry(0.5, 0.5, 1, 10)), material(new MeshBasicMaterial()), cursor),
		stone: new Batch(box, lit(1), cursor, { cast: true }),
		lanternLight: new Batch(box, material(new MeshBasicMaterial()), cursor),
		barrels: new Batch(geometry(new CylinderGeometry(0.45, 0.4, 1, 10)), lit(0.9), cursor, { cast: true }),
		water: new Batch(geometry(new CircleGeometry(1, 28).rotateX(-Math.PI / 2)), material(new MeshStandardMaterial({ roughness: 0.15, metalness: 0.4 })), cursor),
		bridge: new Batch(box, lit(0.6), cursor, { cast: true }),
		rocks: new Batch(geometry(new DodecahedronGeometry(1, 0)), lit(1), cursor, { cast: true }),
		glows: [],
	}
	const pending: Pending = { maples: [], bamboo: [], torii: [] }
	const clear = clearanceOf(path, from - 50, to + 50)
	const taken: Taken = []
	const plant = (into: Planting[], matrix: Matrix4) => { into.push({ matrix, chunk: cursor.chunk }) }

	// Houses along both sides of every street, each in its own slot of the street, as long as it
	// stays off the path at the corners.
	let index = 0
	for (const side of [-1, 1]) {
		let distance = from
		while (distance < to) {
			const width = 4.5 + scatter(index * 3 + side) * 3
			index++
			const middle = distance + width / 2
			const street = path.at(distance).zone === 'street' && path.at(distance + width).zone === 'street'
			if (!street || scatter(index + 500) < 0.08) {
				// A garden, or an alley between houses.
				distance += street ? 2.5 : 4
				continue
			}
			cursor.chunk = chunkOf(middle)
			const point = path.at(middle)
			// The front a little back from the street's edge; only the eaves reach out over it.
			const centre = beside(point, side * (streetHalfWidth + 4.1), 0)
			const frame = placed(centre.x, 0, centre.z, facingPath(point, side))
			const corners = [[-width / 2, -3.5], [width / 2, -3.5], [-width / 2, 3.5], [width / 2, 3.5], [0, 0]] as const
			const free = corners.every(([x, z]) => {
				const corner = new Vector3(x, 0, z).applyMatrix4(frame)
				return clear(corner.x, corner.z, middle, streetHalfWidth + 0.4)
			})
			if (free) {
				house(town, frame, width - 0.15, index)
				taken.push({ x: centre.x, z: centre.z, radius: Math.hypot(width, 7) / 2 })
			}
			distance += width
		}
	}

	// The gardens, first what is fixed in them: the torii at the gate, landmarks on the skyline, and
	// halfway in a stream under a red bridge with a pond either side.
	const gardens = gardensOf(path, from, to)
	for (const [which, garden] of gardens.entries()) {
		const gate = path.at(garden.start + 4)
		cursor.chunk = chunkOf(garden.start + 4)
		plant(pending.torii, placed(gate.x, 0, gate.z, gate.heading))

		const skyline = beside(gate, (scatter(which) > 0.5 ? 1 : -1) * 38, 40)
		if (clear(skyline.x, skyline.z, garden.start + 44, 12, 400) && isFree(taken, skyline.x, skyline.z, 6)) {
			cursor.chunk = landmarkChunks + which * 2
			pagoda(town, placed(skyline.x, 0, skyline.z, scatter(which + 1) * Math.PI))
			taken.push({ x: skyline.x, z: skyline.z, radius: 6 })
		}
		const keep = beside(gate, (scatter(which + 2) > 0.5 ? 1 : -1) * 70, 160)
		if (clear(keep.x, keep.z, garden.start + 164, 30, 400) && isFree(taken, keep.x, keep.z, 18)) {
			cursor.chunk = landmarkChunks + which * 2 + 1
			castle(town, placed(keep.x, 0, keep.z, gate.heading))
			taken.push({ x: keep.x, z: keep.z, radius: 18 })
		}

		const middle = Math.min(garden.start + 37, garden.end - 10)
		if (middle <= garden.start + 10) continue
		const crossing = path.at(middle)
		cursor.chunk = chunkOf(middle)
		for (const side of [-1, 1]) {
			const pond = beside(crossing, side * 9, 0)
			town.water.add(placed(pond.x, 0.03, pond.z, 0, 6.5), palette.water)
			taken.push({ x: pond.x, z: pond.z, radius: 7.2 })
			for (let stone = 0; stone < 8; stone++) {
				const angle = (stone / 8) * Math.PI * 2
				town.rocks.add(placed(pond.x + Math.cos(angle) * 6.7, 0.25, pond.z + Math.sin(angle) * 6.7, angle, 0.6, 0.45, 0.6), 0x6f6a60)
			}
		}
		const deck = placed(crossing.x, 0, crossing.z, crossing.heading)
		town.water.add(within(deck, placed(0, 0.025, 0, 0, 3.4, 1, 3.4)), palette.water)
		town.bridge.add(within(deck, placed(0, 0.12, 0, 0, gardenHalfWidth * 2 + 0.4, 0.16, 6.5)), 0x6b4a32)
		for (const side of [-1, 1]) {
			town.bridge.add(within(deck, placed(side * (gardenHalfWidth + 0.15), 0.95, 0, 0, 0.14, 0.12, 6.5)), palette.bridge)
			for (const post of [-3, -1, 1, 3]) town.bridge.add(within(deck, placed(side * (gardenHalfWidth + 0.15), 0.55, post, 0, 0.16, 0.85, 0.16)), palette.bridge)
		}
	}

	// Then what grows around them: maples, bamboo, rocks, and stone lanterns along the path, all
	// clear of the path, the houses and the ponds.
	for (const garden of gardens) {
		for (let distance = Math.ceil(garden.start / 3) * 3; distance <= garden.end; distance += 3) {
			const point = path.at(distance)
			cursor.chunk = chunkOf(distance)
			const step = Math.round(distance)
			for (const side of [-1, 1]) {
				const seed = step * 7 + side
				if (step % 9 === 0 && scatter(seed) > 0.25) {
					const at = beside(point, side * (gardenHalfWidth + 3 + scatter(seed + 1) * 6), 0)
					if (clear(at.x, at.z, distance, gardenHalfWidth + 2.5) && isFree(taken, at.x, at.z, 2.5)) {
						plant(pending.maples, placed(at.x, 0, at.z, scatter(seed + 2) * 6.28, 0.9 + scatter(seed + 3) * 0.4))
						taken.push({ x: at.x, z: at.z, radius: 1.5 })
					}
				}
				if (step % 3 === 0 && scatter(seed + 4) > 0.35) {
					const at = beside(point, side * (gardenHalfWidth + 9 + scatter(seed + 5) * 4), 0)
					if (clear(at.x, at.z, distance, gardenHalfWidth + 5) && isFree(taken, at.x, at.z, 1.2)) {
						plant(pending.bamboo, placed(at.x, 0, at.z, scatter(seed + 6) * 6.28, 0.9 + scatter(seed + 7) * 0.5))
					}
				}
				if (step % 15 === 0 && (step / 15 + (side > 0 ? 1 : 0)) % 2 === 0) {
					const at = beside(point, side * (gardenHalfWidth + 0.9), 0)
					if (isFree(taken, at.x, at.z, 0.5)) stoneLantern(town, placed(at.x, 0, at.z, point.heading))
				}
				if (scatter(seed + 8) > 0.8) {
					const at = beside(point, side * (gardenHalfWidth + 1.5 + scatter(seed + 9) * 8), 0)
					const size = 0.3 + scatter(seed + 10) * 0.6
					if (clear(at.x, at.z, distance, gardenHalfWidth + 0.8) && isFree(taken, at.x, at.z, size)) {
						town.rocks.add(placed(at.x, size * 0.3, at.z, scatter(seed + 11) * 6, size, size * 0.7, size), 0x7d786d)
					}
				}
			}
		}
	}

	const group = new Group()
	for (const batch of Object.values(town)) {
		if (batch instanceof Batch && batch.count > 0) group.add(...batch.build())
	}
	return { town, pending, owned, group }
}

/**
 * Copies `template` once per planting, one `InstancedMesh` per mesh in it and per stretch of path.
 * The template's materials are cloned for the town, so foliage can be made a cut-out without
 * touching the shared model.
 */
function stamp(template: Object3D, plantings: readonly Planting[], height: number, shadows: boolean, owned: Owned): InstancedMesh[] {
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

export function createCastleTown(scene: Scene, path: Path, from: number, to: number, models: Promise<TownModels>): StageView {
	scene.background = new Color(palette.fog)
	scene.fog = new Fog(palette.fog, 30, fogFar)

	const owned: Owned = { geometries: [], materials: [], textures: [] }
	const backdrop = sky(owned)
	scene.add(backdrop)

	scene.add(new HemisphereLight(0xb0b4e0, 0x5a4236, 2.4))
	const sun = new DirectionalLight(0xffb27a, 2.4)
	sun.castShadow = true
	sun.shadow.mapSize.set(1024, 1024)
	sun.shadow.camera.left = -18
	sun.shadow.camera.right = 18
	sun.shadow.camera.top = 18
	sun.shadow.camera.bottom = -18
	sun.shadow.camera.near = 1
	sun.shadow.camera.far = 80
	sun.shadow.bias = -0.0008
	scene.add(sun, sun.target)
	const sunFrom = { x: -22, y: 30, z: 14 }

	const groundGeometry = new CircleGeometry(skyRadius, 32).rotateX(-Math.PI / 2)
	const groundMaterial = new MeshStandardMaterial({ color: palette.ground, roughness: 1 })
	owned.geometries.push(groundGeometry)
	owned.materials.push(groundMaterial)
	const ground = new Mesh(groundGeometry, groundMaterial)
	ground.receiveShadow = true
	scene.add(ground)

	// The road: wide in town, narrow in the gardens, eased between them over a few metres.
	const gardenness = (distance: number) => [-4, -2, 0, 2, 4].filter((offset) => path.at(distance + offset).zone === 'garden').length / 5
	const street = new Color(palette.street)
	const gardenPath = new Color(palette.gardenPath)
	scene.add(strip(path, from, to, owned, {
		half: (distance) => streetHalfWidth + (gardenHalfWidth - streetHalfWidth) * gardenness(distance),
		colour: (distance) => street.clone().lerp(gardenPath, gardenness(distance)),
		y: 0.02,
	}))
	// The gardens' grass, a wide strip under them that breaks off where the streets begin.
	const grass = new Color(palette.grass)
	scene.add(strip(path, from, to, owned, {
		half: () => 18,
		colour: () => grass,
		y: 0.008,
		runs: (distance) => path.at(distance).zone === 'garden',
	}))

	const laid = lay(path, from, to)
	owned.geometries.push(...laid.owned.geometries)
	owned.materials.push(...laid.owned.materials)
	owned.textures.push(...laid.owned.textures)
	scene.add(laid.group)

	// Soft light around every lantern, drawn as one cloud of glowing points.
	const glowGeometry = new BufferGeometry()
	glowGeometry.setAttribute('position', new Float32BufferAttribute(laid.town.glows, 3))
	const glow = glowTexture()
	const glowMaterial = new PointsMaterial({ map: glow, size: 2.6, color: 0xffa060, transparent: true, depthWrite: false, blending: AdditiveBlending, sizeAttenuation: true })
	owned.geometries.push(glowGeometry)
	owned.materials.push(glowMaterial)
	owned.textures.push(glow)
	scene.add(new Points(glowGeometry, glowMaterial))

	// The models come in later; until then the town stands without its trees. Their geometry and
	// textures belong to the shared, cached model; only the clones made here are freed with the town.
	const modelled = new Group()
	scene.add(modelled)
	let disposed = false
	void models.then((loaded) => {
		if (disposed) return
		// The maple file holds five trees side by side; each is a variant.
		const named = /^MapleTree_\d+$/
		const meshes = loaded.maple.scene.getObjectsByProperty('type', 'Mesh')
		const trees = [...new Set(meshes.map((mesh) => (named.test(mesh.parent?.name ?? '') ? mesh.parent : mesh)))]
			.filter((tree): tree is Object3D => tree !== null && named.test(tree.name))
		const variants = trees.length > 0 ? trees : [loaded.maple.scene]
		variants.forEach((variant, which) => {
			const mine = laid.pending.maples.filter((_, index) => index % variants.length === which)
			modelled.add(...stamp(variant, mine, 7, true, owned))
		})
		modelled.add(...stamp(loaded.bamboo.scene, laid.pending.bamboo, 7, false, owned))
		modelled.add(...stamp(loaded.torii.scene, laid.pending.torii, 6.2, true, owned))
	}).catch((error: unknown) => {
		console.warn('[bunbu] the town models did not load; the town stands without trees', error)
	})

	return {
		follow(x, z) {
			ground.position.set(x, 0, z)
			backdrop.position.set(x, 0, z)
			sun.position.set(x + sunFrom.x, sunFrom.y, z + sunFrom.z)
			sun.target.position.set(x, 0, z)
		},

		dispose() {
			disposed = true
			for (const made of owned.geometries) made.dispose()
			for (const made of owned.materials) made.dispose()
			for (const made of owned.textures) made.dispose()
			for (const child of [...laid.group.children, ...modelled.children]) if (child instanceof InstancedMesh) child.dispose()
			sun.dispose()
		},
	}
}
