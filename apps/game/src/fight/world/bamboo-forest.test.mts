import { BoxGeometry, InstancedMesh, MeshBasicMaterial } from 'three'
import { describe, expect, it } from 'vitest'
import { clumpReach, shove, type Thicket } from './bamboo-forest.mts'
import { coverReach } from './cover.mts'
import { placed } from './kit.mts'

describe('the bamboo by a cover', () => {
	/** A clump at `x, z` by a path heading along `-z`, drawn by one mesh. */
	const thicketAt = (x: number, z: number): Thicket => {
		const mesh = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 1)
		mesh.setMatrixAt(0, placed(x, 0, z))
		return { clumps: [{ matrix: placed(x, 0, z), chunk: 0, heading: 0 }], meshes: [{ mesh, laid: Float32Array.from(mesh.instanceMatrix.array) }] }
	}
	const standsAt = (thicket: Thicket) => {
		const copies = thicket.meshes[0]!.mesh.instanceMatrix.array
		return { x: copies[12]!, z: copies[14]! }
	}

	it('is shoved clear of two covers close together, whichever comes first', () => {
		// Two covers 3.8 m apart along the path, the clump between them.
		const covers = [{ x: 3, z: -150 }, { x: 3, z: -153.8 }]
		for (const order of [covers, covers.toReversed()]) {
			const thicket = thicketAt(3, -151.9)
			shove(thicket, order)
			const at = standsAt(thicket)
			// Within the rounding of the copies, which are 32-bit.
			for (const cover of covers) expect(Math.hypot(at.x - cover.x, at.z - cover.z)).toBeGreaterThanOrEqual(coverReach + clumpReach - 1e-4)
		}
	})

	it('stays where it grew when no cover is near, and goes back there once the cover is gone', () => {
		const thicket = thicketAt(3, -100)
		shove(thicket, [{ x: 3, z: -100.5 }])
		expect(standsAt(thicket).z).not.toBeCloseTo(-100)
		shove(thicket, [])
		expect(standsAt(thicket)).toEqual({ x: 3, z: -100 })
	})
})
