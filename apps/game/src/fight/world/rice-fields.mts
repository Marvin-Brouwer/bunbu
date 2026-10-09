/**
 * The first stage, Rice fields ([2 Quiz + stage](../../../../../docs/design/screens.md#2-quiz--stage)):
 * an earth path down the middle, flooded paddies either side with rows of rice, low dikes between
 * them and cherry trees in blossom. Placeholder shapes until the stage props land (track F).
 *
 * Everything that repeats is one `InstancedMesh` per shape. The props repeat every `period` metres,
 * so the whole stage scrolls toward the camera by moving one group within one period: no props are
 * created or dropped while running, and the fog hides where the stage ends.
 */

import {
	BoxGeometry,
	Color,
	ConeGeometry,
	CylinderGeometry,
	Fog,
	Group,
	HemisphereLight,
	DirectionalLight,
	IcosahedronGeometry,
	InstancedMesh,
	Matrix4,
	Mesh,
	MeshStandardMaterial,
	PlaneGeometry,
	Quaternion,
	Vector3,
	type BufferGeometry,
	type Scene,
} from 'three'

/** Metres after which the props repeat. */
const period = 36
/** Local z range the props cover: from behind the camera to past the fog, plus one period of scroll. */
const nearest = 12
const farthest = -110 - period
const pathHalfWidth = 1.4

const palette = {
	sky: 0xf1e6cf,
	path: 0xb39a6c,
	paddy: 0x8fa77a,
	dike: 0x8a7650,
	rice: 0x9db548,
	trunk: 0x5a4334,
	blossom: 0xf2b6c6,
	hill: 0xa8b4a0,
}

/** A repeatable number in `[0, 1)` for prop `index`, so the stage looks the same every run. */
const scatter = (index: number) => {
	const value = Math.sin(index * 12.9898 + 78.233) * 43_758.5453
	return value - Math.floor(value)
}

type Placement = { x: number; z: number; scale: number; turn: number }

/** Copies `pattern` (local z within one period) over the whole covered range. */
function repeat(pattern: readonly Placement[]): Placement[] {
	const copies: Placement[] = []
	for (let offset = period; offset > farthest - period; offset -= period) {
		for (const place of pattern) {
			const z = place.z + offset
			if (z <= nearest && z >= farthest) copies.push({ ...place, z })
		}
	}
	return copies
}

function instanced(geometry: BufferGeometry, material: MeshStandardMaterial, places: readonly Placement[]): InstancedMesh {
	const mesh = new InstancedMesh(geometry, material, places.length)
	const matrix = new Matrix4()
	const rotation = new Quaternion()
	const up = new Vector3(0, 1, 0)
	places.forEach((place, index) => {
		rotation.setFromAxisAngle(up, place.turn)
		matrix.compose(new Vector3(place.x, 0, place.z), rotation, new Vector3(place.scale, place.scale, place.scale))
		mesh.setMatrixAt(index, matrix)
	})
	mesh.instanceMatrix.needsUpdate = true
	// The instances span the whole stage; the bounding sphere of one would cull them all.
	mesh.frustumCulled = false
	return mesh
}

export type StageView = {
	/** Moves the stage so the samurai stands at `distance` along it. */
	scroll: (distance: number) => void
	dispose: () => void
}

export function createRiceFields(scene: Scene): StageView {
	scene.background = new Color(palette.sky)
	scene.fog = new Fog(palette.sky, 22, 90)

	scene.add(new HemisphereLight(0xfff6e6, 0x6b7a55, 1.6))
	const sun = new DirectionalLight(0xfff1dc, 1.6)
	sun.position.set(-4, 8, 3)
	scene.add(sun)

	const geometries: BufferGeometry[] = []
	const materials: MeshStandardMaterial[] = []
	const geometry = <T extends BufferGeometry>(made: T) => {
		geometries.push(made)
		return made
	}
	const material = (color: number) => {
		const made = new MeshStandardMaterial({ color, roughness: 0.95, flatShading: true })
		materials.push(made)
		return made
	}

	// Ground that doesn't change along the path stays put; only the props scroll.
	const ground = new Group()
	const path = new Mesh(geometry(new PlaneGeometry(pathHalfWidth * 2, 200).rotateX(-Math.PI / 2)), material(palette.path))
	path.position.set(0, 0.005, -80)
	const paddies = new Mesh(geometry(new PlaneGeometry(200, 200).rotateX(-Math.PI / 2)), material(palette.paddy))
	paddies.position.set(0, -0.03, -80)
	ground.add(path, paddies)

	const hill = geometry(new ConeGeometry(1, 1, 7))
	const hillMaterial = material(palette.hill)
	for (let index = 0; index < 7; index++) {
		const mesh = new Mesh(hill, hillMaterial)
		const side = index % 2 === 0 ? -1 : 1
		mesh.scale.set(18 + scatter(index) * 14, 8 + scatter(index + 9) * 9, 12)
		mesh.position.set(side * (14 + scatter(index + 3) * 30), 0, -80 - scatter(index + 5) * 30)
		ground.add(mesh)
	}
	scene.add(ground)

	// One period of props; `repeat` lays it over the stage.
	const rice: Placement[] = []
	const dikes: Placement[] = []
	const trees: Placement[] = []
	for (let row = 0; row < 18; row++) {
		for (let column = 0; column < 6; column++) {
			for (const side of [-1, 1]) {
				const index = row * 12 + column * 2 + (side > 0 ? 1 : 0)
				rice.push({
					x: side * (pathHalfWidth + 0.9 + column * 0.9 + scatter(index) * 0.2),
					z: -row * 2 - scatter(index + 300) * 0.3,
					scale: 0.8 + scatter(index + 600) * 0.4,
					turn: scatter(index + 900) * Math.PI,
				})
			}
		}
	}
	for (const z of [-1, -1 - period / 2]) {
		for (const side of [-1, 1]) dikes.push({ x: side * (pathHalfWidth + 6), z, scale: 1, turn: 0 })
	}
	for (let index = 0; index < 5; index++) {
		const side = index % 2 === 0 ? -1 : 1
		trees.push({
			x: side * (pathHalfWidth + 7.5 + scatter(index + 40) * 6),
			z: -scatter(index + 50) * period,
			scale: 0.9 + scatter(index + 60) * 0.6,
			turn: scatter(index + 70) * Math.PI * 2,
		})
	}

	const props = new Group()
	props.add(
		instanced(geometry(new ConeGeometry(0.16, 0.5, 5).translate(0, 0.25, 0)), material(palette.rice), repeat(rice)),
		instanced(geometry(new BoxGeometry(12, 0.25, 0.5).translate(0, 0.08, 0)), material(palette.dike), repeat(dikes)),
		instanced(geometry(new CylinderGeometry(0.14, 0.2, 2, 6).translate(0, 1, 0)), material(palette.trunk), repeat(trees)),
		instanced(geometry(new IcosahedronGeometry(1.3, 0).translate(0, 2.6, 0)), material(palette.blossom), repeat(trees)),
	)
	scene.add(props)

	return {
		scroll(distance) {
			// The path comes toward the camera; the props move within one period and repeat.
			props.position.z = distance % period
		},

		dispose() {
			for (const made of geometries) made.dispose()
			for (const made of materials) made.dispose()
			for (const child of props.children) if (child instanceof InstancedMesh) child.dispose()
		},
	}
}
