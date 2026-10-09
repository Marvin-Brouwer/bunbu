/**
 * Building blocks for the town: shapes the stage stamps out many times, each as one
 * `InstancedMesh` so a whole street is a handful of draw calls.
 */

import {
	BufferGeometry,
	CanvasTexture,
	Color,
	Float32BufferAttribute,
	InstancedMesh,
	Matrix4,
	Quaternion,
	RepeatWrapping,
	SRGBColorSpace,
	Vector3,
	type Material,
} from 'three'

/**
 * Which stretch of the path the copies being added belong to. Each stretch becomes its own
 * `InstancedMesh`, so the camera and the shadow only draw the stretches they can see.
 */
export type Cursor = { chunk: number }

/** Metres of path per stretch. */
export const chunkLength = 60

/** The stretch `distance` metres along the path falls in. */
export const chunkOf = (distance: number): number => Math.floor(distance / chunkLength)

/** A shape stamped out many times: add each copy, then build one `InstancedMesh` per stretch. */
export class Batch {
	private readonly chunks = new Map<number, { readonly matrices: Matrix4[]; readonly colours: Color[] }>()

	constructor(
		private readonly geometry: BufferGeometry,
		private readonly material: Material,
		private readonly cursor: Cursor,
		private readonly shadows: { cast?: boolean; receive?: boolean } = {},
	) {}

	add(matrix: Matrix4, colour?: number | Color): void {
		let chunk = this.chunks.get(this.cursor.chunk)
		if (chunk === undefined) {
			chunk = { matrices: [], colours: [] }
			this.chunks.set(this.cursor.chunk, chunk)
		}
		chunk.matrices.push(matrix)
		chunk.colours.push(colour instanceof Color ? colour : new Color(colour ?? 0xffffff))
	}

	get count(): number {
		let count = 0
		for (const chunk of this.chunks.values()) count += chunk.matrices.length
		return count
	}

	build(): InstancedMesh[] {
		return [...this.chunks.values()].map(({ matrices, colours }) => {
			const mesh = new InstancedMesh(this.geometry, this.material, matrices.length)
			matrices.forEach((matrix, index) => {
				mesh.setMatrixAt(index, matrix)
				mesh.setColorAt(index, colours[index] ?? new Color(0xffffff))
			})
			mesh.instanceMatrix.needsUpdate = true
			if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true
			mesh.castShadow = this.shadows.cast ?? false
			mesh.receiveShadow = this.shadows.receive ?? false
			// Bounds around this stretch's copies, so it is culled when out of view.
			mesh.computeBoundingSphere()
			return mesh
		})
	}
}

const up = new Vector3(0, 1, 0)

/** A matrix that places a shape at `x, y, z`, turned `yaw` about `y`, scaled `sx, sy, sz`. */
export function placed(x: number, y: number, z: number, yaw = 0, sx = 1, sy = sx, sz = sx): Matrix4 {
	return new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromAxisAngle(up, yaw), new Vector3(sx, sy, sz))
}

/** `parent * child`: a part placed within something already placed. */
export const within = (parent: Matrix4, child: Matrix4): Matrix4 => new Matrix4().multiplyMatrices(parent, child)

/**
 * A gable roof one unit wide, deep and high: the ridge runs along `x` at the top, the eaves at
 * `z = ±0.5` at the bottom.
 */
export function gableGeometry(): BufferGeometry {
	const geometry = new BufferGeometry()
	const l = -0.5
	const r = 0.5
	// Two slopes and two gable ends, each face with its own vertices for flat shading.
	const positions = [
		// Front slope.
		l, 0, 0.5, r, 0, 0.5, r, 1, 0, l, 0, 0.5, r, 1, 0, l, 1, 0,
		// Back slope.
		r, 0, -0.5, l, 0, -0.5, l, 1, 0, r, 0, -0.5, l, 1, 0, r, 1, 0,
		// Gable ends.
		l, 0, -0.5, l, 0, 0.5, l, 1, 0,
		r, 0, 0.5, r, 0, -0.5, r, 1, 0,
	]
	geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
	geometry.computeVertexNormals()
	return geometry
}

/** A small repeating texture drawn on a canvas: wooden slats, roof tiles. */
function pattern(size: number, draw: (context: CanvasRenderingContext2D, size: number) => void): CanvasTexture {
	const canvas = document.createElement('canvas')
	canvas.width = size
	canvas.height = size
	const context = canvas.getContext('2d')
	if (context !== null) draw(context, size)
	const texture = new CanvasTexture(canvas)
	texture.wrapS = RepeatWrapping
	texture.wrapT = RepeatWrapping
	texture.colorSpace = SRGBColorSpace
	return texture
}

/** Vertical wooden slats, the lattice (koshi) on the front of a town house. Tinted per house. */
export function slatsTexture(): CanvasTexture {
	return pattern(64, (context, size) => {
		context.fillStyle = '#5a5a5a'
		context.fillRect(0, 0, size, size)
		context.fillStyle = '#ffffff'
		for (let x = 2; x < size; x += 8) context.fillRect(x, 0, 4, size)
		context.fillStyle = '#d0d0d0'
		context.fillRect(0, size * 0.48, size, 3)
	})
}

/** A soft round glow, for the light around lanterns. */
export function glowTexture(): CanvasTexture {
	return pattern(64, (context, size) => {
		const glow = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
		glow.addColorStop(0, 'rgba(255,255,255,1)')
		glow.addColorStop(0.3, 'rgba(255,255,255,0.45)')
		glow.addColorStop(1, 'rgba(255,255,255,0)')
		context.fillStyle = glow
		context.fillRect(0, 0, size, size)
	})
}

/** A repeatable number in `[0, 1)` for `index`, so the town comes out the same every run. */
export function scatter(index: number): number {
	const value = Math.sin(index * 12.9898 + 78.233) * 43_758.5453
	return value - Math.floor(value)
}
