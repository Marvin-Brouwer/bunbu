/**
 * Cherry petals drifting down through the world: on the title screen, along the run and when the
 * samurai falls ([screens](../../../../../docs/design/screens.md)).
 *
 * One `InstancedMesh`, so a few hundred petals are one draw call. The petals fill a box around a
 * centre that follows the camera; a petal that leaves the box on one side comes back on the other,
 * so the air is never empty however far the samurai runs. Where a petal is depends on the time
 * alone ({@link petalAt}), so it plays the same at any frame rate.
 */

import {
	CircleGeometry,
	Color,
	DoubleSide,
	InstancedMesh,
	Matrix4,
	MeshStandardMaterial,
	Quaternion,
	Vector3,
} from 'three'

/** Metres of air the petals fill, around the centre. */
export type PetalBox = {
	readonly width: number
	readonly height: number
	readonly depth: number
}

/** One petal: where it started, how it falls, sways and spins. Plain numbers, so it can be tested. */
export type Petal = {
	readonly x: number
	readonly y: number
	readonly z: number
	/** Metres per second downward. */
	readonly fall: number
	/** Metres per second along `x` and `z`: the breeze. */
	readonly driftX: number
	readonly driftZ: number
	/** Metres either side it sways, and how fast, in radians per second. */
	readonly sway: number
	readonly swayRate: number
	readonly phase: number
	/** Radians per second it turns over, about its own axis. */
	readonly spin: number
	readonly axis: readonly [x: number, y: number, z: number]
}

/** `value` moved by whole `size`s until it is within `size / 2` of `centre`. */
export function wrapInto(value: number, centre: number, size: number): number {
	const offset = value - centre + size / 2
	return centre - size / 2 + (offset - Math.floor(offset / size) * size)
}

/** A number from `0` to `1` for `seed`, the same every time. */
function scatter(seed: number): number {
	const x = Math.sin(seed * 12.9898) * 43758.5453
	return x - Math.floor(x)
}

/** `count` petals spread through `box` around the origin, the same every time. */
export function scatterPetals(count: number, box: PetalBox): Petal[] {
	return Array.from({ length: count }, (_, index) => {
		const seed = index * 7 + 1
		const axis: [number, number, number] = [scatter(seed + 6) - 0.5, scatter(seed + 7) - 0.5, scatter(seed + 8) - 0.5]
		const length = Math.hypot(...axis) || 1
		return {
			x: (scatter(seed) - 0.5) * box.width,
			y: scatter(seed + 1) * box.height,
			z: (scatter(seed + 2) - 0.5) * box.depth,
			fall: 0.45 + scatter(seed + 3) * 0.5,
			driftX: 0.35 + scatter(seed + 4) * 0.3,
			driftZ: (scatter(seed + 5) - 0.5) * 0.3,
			sway: 0.2 + scatter(seed + 9) * 0.3,
			swayRate: 1 + scatter(seed + 10) * 1.5,
			phase: scatter(seed + 11) * Math.PI * 2,
			spin: 1.5 + scatter(seed + 12) * 3,
			axis: [axis[0] / length, axis[1] / length, axis[2] / length],
		}
	})
}

/** Where `petal` is `time` seconds in, kept within `box` around `centre`. Its turn is `spin * time`. */
export function petalAt(petal: Petal, time: number, box: PetalBox, centre: { readonly x: number; readonly y: number; readonly z: number }) {
	const sway = Math.sin(time * petal.swayRate + petal.phase) * petal.sway
	return {
		x: wrapInto(petal.x + petal.driftX * time + sway, centre.x, box.width),
		y: wrapInto(petal.y - petal.fall * time, centre.y + box.height / 2, box.height),
		z: wrapInto(petal.z + petal.driftZ * time + sway * 0.5, centre.z, box.depth),
		turn: petal.spin * time + petal.phase,
	}
}

export type Petals = {
	readonly mesh: InstancedMesh
	/** Moves the petals on by `delta` seconds, around `centre` on the ground. */
	draw: (delta: number, centre: { readonly x: number; readonly z: number }) => void
	dispose: () => void
}

/** Pinks from nearly white to deep, for the petals to vary between. */
const pinks = [0xffe4ec, 0xf9c4d4, 0xf2a7bd, 0xe88aa6]

export function createPetals(count: number, box: PetalBox): Petals {
	// A petal is a small oval, longer than it is wide.
	const geometry = new CircleGeometry(0.045, 6).scale(1.5, 1, 1)
	const material = new MeshStandardMaterial({
		color: 0xffffff,
		side: DoubleSide,
		roughness: 0.8,
		// A little light of its own, so the petals still read pink at dusk.
		emissive: 0x4a2030,
	})
	const mesh = new InstancedMesh(geometry, material, count)
	// They fill the air around the centre, wherever it is: never outside the view for long.
	mesh.frustumCulled = false
	const colour = new Color()
	for (let index = 0; index < count; index++) mesh.setColorAt(index, colour.setHex(pinks[index % pinks.length] ?? 0xffffff))

	const petals = scatterPetals(count, box)
	const matrix = new Matrix4()
	const position = new Vector3()
	const turn = new Quaternion()
	const axis = new Vector3()
	const one = new Vector3(1, 1, 1)
	let time = 0

	return {
		mesh,

		draw(delta, centre) {
			time += delta
			petals.forEach((petal, index) => {
				const at = petalAt(petal, time, box, { x: centre.x, y: 0, z: centre.z })
				position.set(at.x, at.y, at.z)
				turn.setFromAxisAngle(axis.set(...petal.axis), at.turn)
				mesh.setMatrixAt(index, matrix.compose(position, turn, one))
			})
			mesh.instanceMatrix.needsUpdate = true
		},

		dispose() {
			geometry.dispose()
			material.dispose()
			mesh.dispose()
		},
	}
}
