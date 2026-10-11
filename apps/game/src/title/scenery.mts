/**
 * What stands around the samurai on the title screen: a stone path through the torii up to a great
 * temple hall, a pagoda beside it, stone lanterns along the way, and behind it all layers of
 * mountains under a snow-capped peak, with a low sun and drifting clouds.
 *
 * All of it is built in code from simple shapes, like castle town's houses: no free CC0 pack of
 * Japanese temples turned up ([assets](../../../../docs/design/assets.md)).
 */

import {
	AdditiveBlending,
	BoxGeometry,
	CanvasTexture,
	CircleGeometry,
	ConeGeometry,
	CylinderGeometry,
	Group,
	InstancedMesh,
	Matrix4,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	Quaternion,
	SphereGeometry,
	SRGBColorSpace,
	Sprite,
	SpriteMaterial,
	Vector3,
	type BufferGeometry,
	type Material,
	type Object3D,
} from 'three'

export const sceneryPalette = {
	stone: 0x8d877b,
	stoneDark: 0x6e685e,
	path: 0xa49d90,
	lacquer: 0xa8261c,
	plaster: 0xeae2cf,
	timber: 0x4d3a2c,
	roof: 0x2f333b,
	gold: 0xc9a24a,
	paper: 0xffd9a0,
	lantern: 0xff5a2a,
	snow: 0xf4f0f4,
	sun: 0xff8a50,
	cloud: 0xf2b8a0,
	/** Mountains from near to far, fading into the haze. */
	mountains: [0x3f3448, 0x5a465a, 0x7a5a68, 0x9a6e72],
}

/** What the scenery made on the GPU, freed when the title goes. */
export type Owned = { geometries: BufferGeometry[]; materials: Material[]; textures: CanvasTexture[] }

export type Scenery = {
	readonly group: Group
	/** Swaps the buildings made here for the temple kit's (`temple-kit.glb`), once it has loaded. */
	useKit: (kit: Object3D) => void
	dispose: () => void
	/** Moves what moves on its own: the clouds drifting, the lanterns flickering. */
	draw: (time: number) => void
}

const up = new Vector3(0, 1, 0)

/**
 * `piece` from a loaded model, once at each of `matrices`: one `InstancedMesh` per mesh in it. The
 * geometry and materials stay the shared model's, so there is nothing of its own to free.
 */
function instancesOf(piece: Object3D, matrices: readonly Matrix4[]): InstancedMesh[] {
	piece.updateWorldMatrix(false, true)
	const base = piece.matrixWorld.clone().invert()
	const meshes: InstancedMesh[] = []
	piece.traverse((object) => {
		if (!(object instanceof Mesh)) return
		// The mesh where it sits in the piece, whatever the piece's own place in the file.
		const local = base.clone().multiply(object.matrixWorld)
		const mesh = new InstancedMesh(object.geometry as BufferGeometry, object.material as Material, matrices.length)
		matrices.forEach((matrix, index) => { mesh.setMatrixAt(index, matrix.clone().multiply(local)) })
		mesh.instanceMatrix.needsUpdate = true
		mesh.castShadow = true
		mesh.receiveShadow = true
		mesh.computeBoundingSphere()
		meshes.push(mesh)
	})
	return meshes
}

/** A number from `0` to `1` for `seed`, the same every time. */
function scatter(seed: number): number {
	const x = Math.sin(seed * 12.9898) * 43758.5453
	return x - Math.floor(x)
}

/** A soft round glow, for the light around a lantern and the sun's halo. */
function glowTexture(): CanvasTexture {
	const size = 64
	const canvas = document.createElement('canvas')
	canvas.width = size
	canvas.height = size
	const context = canvas.getContext('2d')
	if (context !== null) {
		const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
		gradient.addColorStop(0, 'rgba(255,255,255,1)')
		gradient.addColorStop(0.35, 'rgba(255,255,255,0.35)')
		gradient.addColorStop(1, 'rgba(255,255,255,0)')
		context.fillStyle = gradient
		context.fillRect(0, 0, size, size)
	}
	const texture = new CanvasTexture(canvas)
	texture.colorSpace = SRGBColorSpace
	return texture
}

export function createScenery(owned: Owned): Scenery {
	const group = new Group()
	const instanced: InstancedMesh[] = []
	const materials = new Map<string, Material>()
	/** One material per colour and kind, shared by every piece in it. */
	const lit = (colour: number, roughness = 0.85, flat = false) => {
		const key = `lit:${colour}:${roughness}:${flat}`
		let made = materials.get(key)
		if (made === undefined) {
			made = new MeshStandardMaterial({ color: colour, roughness, flatShading: flat })
			materials.set(key, made)
			owned.materials.push(made)
		}
		return made
	}
	const glowing = (colour: number) => {
		const key = `glow:${colour}`
		let made = materials.get(key)
		if (made === undefined) {
			made = new MeshBasicMaterial({ color: colour })
			materials.set(key, made)
			owned.materials.push(made)
		}
		return made
	}
	const shape = <T extends BufferGeometry>(geometry: T): T => {
		owned.geometries.push(geometry)
		return geometry
	}
	const cube = shape(new BoxGeometry(1, 1, 1))
	const column = shape(new CylinderGeometry(0.5, 0.5, 1, 10))
	// A square hip roof: a pyramid turned so its edges run along x and z, one unit across at the base.
	const hip = shape(new ConeGeometry(Math.SQRT1_2, 1, 4, 1, false, Math.PI / 4).translate(0, 0.5, 0))

	// Everything that stands still is gathered by shape, material and shadows, and drawn as one
	// `InstancedMesh` per batch, so the temple and its lanterns are a handful of draw calls.
	const batches = new Map<string, { geometry: BufferGeometry; material: Material; cast: boolean; receive: boolean; parent: Group; matrices: Matrix4[] }>()
	// The buildings built here stand in for the temple kit's until it has loaded.
	const placeholders = new Group()
	group.add(placeholders)
	let into = group
	const add = (geometry: BufferGeometry, material: Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, cast = true, receive = cast, turn = 0) => {
		const key = `${geometry.uuid}:${material.uuid}:${cast}:${receive}:${into.uuid}`
		let batch = batches.get(key)
		if (batch === undefined) {
			batch = { geometry, material, cast, receive, parent: into, matrices: [] }
			batches.set(key, batch)
		}
		batch.matrices.push(new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromAxisAngle(up, turn), new Vector3(sx, sy, sz)))
	}

	/** A roof with eaves that reach out past the walls: a thin wide slab, then the hip above it. */
	const roof = (x: number, y: number, z: number, width: number, depth: number, height: number) => {
		add(cube, lit(sceneryPalette.roof), x, y, z, width + 1.2, 0.35, depth + 1.2)
		add(hip, lit(sceneryPalette.roof, 0.7), x, y + 0.15, z, width, height, depth)
	}

	// The stone path from the samurai to the temple's steps.
	add(cube, lit(sceneryPalette.path, 1), 0, 0.03, -36, 2.6, 0.06, 74, false, true)
	for (let index = 0; index < 34; index++) {
		add(cube, lit(sceneryPalette.stoneDark, 1), 0, 0.065, 0.5 - index * 2.1, 2.7, 0.02, 0.08, false)
	}

	into = placeholders
	// The temple hall (hondō): a stone platform with steps, red pillars, white walls, two roofs.
	const hall = { z: -76, width: 22, depth: 13 }
	add(cube, lit(sceneryPalette.stone, 1), 0, 0.9, hall.z, hall.width + 2, 1.8, hall.depth + 2)
	for (let step = 0; step < 6; step++) {
		add(cube, lit(sceneryPalette.stone, 1), 0, 0.15 + step * 0.3, hall.z + hall.depth / 2 + 3 - step * 0.45, 6, 0.3, 0.45)
	}
	add(cube, lit(sceneryPalette.plaster, 1), 0, 4.3, hall.z - 0.6, hall.width - 2, 5, hall.depth - 3)
	// Lattice doors across the front, dark timber between the pillars.
	add(cube, lit(sceneryPalette.timber), 0, 3.4, hall.z + hall.depth / 2 - 2.05, hall.width - 3, 3.2, 0.1)
	const pillars = 8
	for (let index = 0; index < pillars; index++) {
		const x = -hall.width / 2 + 1 + (index * (hall.width - 2)) / (pillars - 1)
		add(column, lit(sceneryPalette.lacquer, 0.6), x, 4.3, hall.z + hall.depth / 2 - 1, 0.6, 5, 0.6)
		if (index < pillars - 1) {
			// Red lanterns hanging between the pillars, lit from inside.
			add(column, glowing(sceneryPalette.lantern), x + (hall.width - 2) / (pillars - 1) / 2, 5.6, hall.z + hall.depth / 2 - 1, 0.55, 0.8, 0.55, false)
		}
	}
	add(cube, lit(sceneryPalette.lacquer, 0.6), 0, 6.9, hall.z + hall.depth / 2 - 1, hall.width, 0.5, 0.5)
	roof(0, 7.2, hall.z, hall.width + 3, hall.depth + 3, 3.4)
	add(cube, lit(sceneryPalette.plaster, 1), 0, 10.6, hall.z, hall.width * 0.55, 2, hall.depth * 0.45)
	roof(0, 11.4, hall.z, hall.width * 0.62, hall.depth * 0.6, 4.2)
	// Gilt ornaments on the ridge's ends, and a plaque over the door.
	for (const side of [-1, 1]) add(cube, lit(sceneryPalette.gold, 0.4), side * 1.6, 15.5, hall.z, 0.5, 1.2, 0.3)
	add(cube, lit(sceneryPalette.gold, 0.4), 0, 6.1, hall.z + hall.depth / 2 - 0.6, 2.4, 0.8, 0.12)

	// A five-storey pagoda to one side, its spire against the sky.
	const pagoda = { x: -22, z: -92 }
	add(cube, lit(sceneryPalette.stone, 1), pagoda.x, 0.5, pagoda.z, 9, 1, 9)
	for (let storey = 0; storey < 5; storey++) {
		const size = 6.5 - storey * 0.8
		const y = 1 + storey * 3.4
		add(cube, lit(sceneryPalette.lacquer, 0.6), pagoda.x, y + 1.3, pagoda.z, size * 0.6, 2.6, size * 0.6)
		roof(pagoda.x, y + 2.6, pagoda.z, size + 1.4, size + 1.4, 0.9)
	}
	add(column, lit(sceneryPalette.gold, 0.4), pagoda.x, 22, pagoda.z, 0.25, 6, 0.25)
	for (let ring = 0; ring < 6; ring++) add(column, lit(sceneryPalette.gold, 0.4), pagoda.x, 19.8 + ring * 0.7, pagoda.z, 0.8, 0.12, 0.8)

	// Stone lanterns (tōrō) in pairs along the path, their fireboxes lit.
	const glow = glowTexture()
	owned.textures.push(glow)
	const glowMaterial = new SpriteMaterial({ map: glow, color: 0xc86a30, transparent: true, depthWrite: false, blending: AdditiveBlending })
	owned.materials.push(glowMaterial)
	const glows: Sprite[] = []
	const lanterns: Matrix4[] = []
	for (const z of [-6, -20, -36]) {
		for (const side of [-1, 1]) {
			const x = side * 2.6
			lanterns.push(new Matrix4().makeTranslation(x, 0, z))
			add(cube, lit(sceneryPalette.stone, 1, true), x, 0.15, z, 0.7, 0.3, 0.7)
			add(cube, lit(sceneryPalette.stone, 1, true), x, 0.75, z, 0.28, 0.9, 0.28)
			add(cube, glowing(sceneryPalette.paper), x, 1.4, z, 0.45, 0.4, 0.45, false)
			add(hip, lit(sceneryPalette.stone, 1, true), x, 1.6, z, 1, 0.4, 1)
			const halo = new Sprite(glowMaterial)
			halo.position.set(x, 1.4, z)
			halo.scale.setScalar(2.2)
			group.add(halo)
			glows.push(halo)
		}
	}

	into = group
	// Mountains in layers, nearer ones darker, all fading into the haze; the great peak behind the hall.
	const peak = shape(new ConeGeometry(1, 1, 7, 1).translate(0, 0.5, 0))
	for (let index = 0; index < 22; index++) {
		const layer = index % 3
		const distance = 150 + layer * 40 + scatter(index) * 15
		const angle = (scatter(index + 50) - 0.5) * Math.PI * 1.15
		const height = 12 + scatter(index + 100) * 16 + layer * 5
		const width = height * (1.4 + scatter(index + 150) * 0.8)
		add(peak, lit(sceneryPalette.mountains[layer] ?? 0x5a465a, 1, true), Math.sin(angle) * distance, -1, -Math.cos(angle) * distance, width, height, width * 0.8, false, false, scatter(index + 200) * Math.PI)
	}
	const fuji = { z: -360, height: 72, width: 150 }
	add(peak, lit(sceneryPalette.mountains[3] ?? 0x9a6e72, 1, true), 0, -2, fuji.z, fuji.width, fuji.height, fuji.width * 0.6, false)
	add(peak, lit(sceneryPalette.snow, 0.9, true), 0, fuji.height * 0.62 - 2, fuji.z + 1, fuji.width * 0.38, fuji.height * 0.38, fuji.width * 0.6 * 0.38, false)

	for (const { geometry, material, cast, receive, parent, matrices } of batches.values()) {
		const mesh = new InstancedMesh(geometry, material, matrices.length)
		matrices.forEach((matrix, index) => { mesh.setMatrixAt(index, matrix) })
		mesh.instanceMatrix.needsUpdate = true
		mesh.castShadow = cast
		mesh.receiveShadow = receive
		mesh.computeBoundingSphere()
		parent.add(mesh)
		instanced.push(mesh)
	}

	// The sun, low and red, with a halo, and long clouds drifting across it. Not in the fog.
	const sun = new Mesh(shape(new CircleGeometry(16, 40)), new MeshBasicMaterial({ color: sceneryPalette.sun, fog: false }))
	owned.materials.push(sun.material)
	sun.position.set(42, 46, -400)
	group.add(sun)
	const sunHalo = new Sprite(new SpriteMaterial({ map: glow, color: 0xff9a60, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false, opacity: 0.6 }))
	owned.materials.push(sunHalo.material)
	sunHalo.position.copy(sun.position)
	sunHalo.scale.setScalar(110)
	group.add(sunHalo)

	const cloudGeometry = shape(new SphereGeometry(1, 16, 8))
	const cloudMaterial = new MeshBasicMaterial({ color: sceneryPalette.cloud, fog: false, transparent: true, opacity: 0.75, depthWrite: false })
	owned.materials.push(cloudMaterial)
	const clouds = Array.from({ length: 6 }, (_, index) => {
		const cloud = new Mesh(cloudGeometry, cloudMaterial)
		cloud.scale.set(40 + scatter(index + 300) * 50, 2 + scatter(index + 310) * 2, 6)
		cloud.position.set(0, 30 + index * 9 + scatter(index + 320) * 4, -390 + index * 4)
		cloud.renderOrder = 1
		group.add(cloud)
		return { cloud, start: (scatter(index + 330) - 0.5) * 300, speed: 1.2 + scatter(index + 340) * 1.5 }
	})

	return {
		group,

		useKit(kit) {
			const hallModel = kit.getObjectByName('Hall')
			const pagodaModel = kit.getObjectByName('Pagoda')
			const lanternModel = kit.getObjectByName('StoneLantern')
			if (hallModel === undefined || pagodaModel === undefined || lanternModel === undefined) {
				console.warn('[bunbu] the temple kit is missing a piece; the placeholders stay')
				return
			}
			placeholders.visible = false
			const made = [
				...instancesOf(hallModel, [new Matrix4().makeTranslation(0, 0, hall.z)]),
				...instancesOf(pagodaModel, [new Matrix4().makeTranslation(pagoda.x, 0, pagoda.z)]),
				...instancesOf(lanternModel, lanterns),
			]
			group.add(...made)
			instanced.push(...made)
		},

		dispose() {
			for (const mesh of instanced) mesh.dispose()
		},

		draw(time) {
			for (const { cloud, start, speed } of clouds) {
				// Across the sky and round again, slow enough that nobody sees them wrap.
				const span = 360
				const at = start + time * speed
				cloud.position.x = at - Math.floor((at + span / 2) / span) * span
			}
			glows.forEach((halo, index) => {
				halo.scale.setScalar(1.6 + Math.sin(time * 7 + index * 1.9) * 0.1 + Math.sin(time * 13 + index) * 0.05)
			})
		},
	}
}
