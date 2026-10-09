/**
 * The samurai's armour (ō-yoroi), made from simple shapes and hung on the model's bones so it moves
 * with every clip: a kabuto helmet with gilt horns and a flared neck guard, a lacquered breastplate
 * laced in gold, shoulder plates and a skirt of hip plates. His sword is the model's own long
 * blade, near a metre already.
 *
 * The pieces are laid out in metres around Quaternius's "Matt" in his rest pose, the samurai's
 * model; `attach` keeps each where it was put while it joins its bone.
 */

import {
	BufferGeometry,
	CylinderGeometry,
	Group,
	Matrix4,
	Mesh,
	MeshStandardMaterial,
	SphereGeometry,
	BoxGeometry,
	Vector3,
	type Material,
	type Object3D,
} from 'three'

const lacquer = 0x8e1c16
const black = 0x1b1a1f
const gilt = 0xd6a53a
const lacing = 0xc9a24a

/** Where the model's bones are in the rest pose, in metres, facing `+z`: what the armour is fitted to. */
const fit = {
	head: { y: 1.62, z: -0.07, radius: 0.37 },
	chest: { y: 0.87, z: -0.17, radius: 0.3 },
	waist: { y: 0.6, z: -0.19, radius: 0.32 },
	shoulder: { x: 0.42, y: 1.02, z: -0.2 },
}

type Point = readonly [x: number, y: number, z: number]

/** The joints of the left arm and leg in the rest pose; the right ones mirror them in `x`. */
const joints = {
	shoulder: [0.273, 1.064, -0.212],
	elbow: [0.481, 0.83, -0.274],
	hand: [0.536, 0.609, 0.106],
	hip: [0.167, 0.574, -0.198],
	knee: [0.188, 0.303, 0.006],
	ankle: [0.213, 0.1, -0.202],
} as const satisfies Record<string, Point>

const mirrored = ([x, y, z]: Point, side: number): Point => [x * side, y, z]

export type Armour = {
	/** The helmet: it comes off when the samurai falls. */
	readonly helmet: Group
	/** The bone the helmet sits on, and where on it, to put it back. */
	readonly headBone: Object3D
	readonly helmetAt: Matrix4
	readonly materials: readonly MeshStandardMaterial[]
	/** The materials on the body, not the helmet: what turns grey when he falls. */
	readonly body: readonly MeshStandardMaterial[]
	dispose: () => void
}

/** A piece of armour at `x, y, z`, casting a shadow. */
function part(geometry: BufferGeometry, material: Material, x: number, y: number, z: number): Mesh {
	const mesh = new Mesh(geometry, material)
	mesh.position.set(x, y, z)
	mesh.castShadow = true
	return mesh
}

/** Dresses `scene`, the samurai's model in its rest pose with its world matrices up to date. */
export function dress(scene: Object3D): Armour | undefined {
	const headBone = scene.getObjectByName('Head')
	const torso = scene.getObjectByName('Torso')
	const hips = scene.getObjectByName('Hips')
	const left = scene.getObjectByName('UpperArmL')
	const right = scene.getObjectByName('UpperArmR')
	if (headBone === undefined || torso === undefined || hips === undefined || left === undefined || right === undefined) return undefined

	const geometries: BufferGeometry[] = []
	const materials: MeshStandardMaterial[] = []
	const shape = <T extends BufferGeometry>(made: T) => {
		geometries.push(made)
		return made
	}
	const paint = (color: number, metal = 0.1, roughness = 0.45) => {
		const made = new MeshStandardMaterial({ color, metalness: metal, roughness })
		materials.push(made)
		return made
	}
	const red = paint(lacquer)
	const cloth = paint(0x1d2233, 0, 0.9)
	const dark = paint(black, 0.2, 0.35)
	const gold = paint(gilt, 0.8, 0.3)
	const cord = paint(lacing, 0.3, 0.6)

	// Kabuto: a dark lacquered bowl, a visor, a neck guard of three flared red lames open at the face,
	// and the gilt horns (kuwagata) with a crest disc between them.
	// Built round its own centre, so it tumbles about itself when it comes off.
	const helmet = new Group()
	const { head } = fit
	helmet.position.set(0, head.y, head.z)
	const h = { y: 0, z: 0, radius: head.radius }
	const bowl = part(shape(new SphereGeometry(h.radius, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)), dark, 0, h.y, h.z)
	bowl.scale.set(1, 0.8, 1.05)
	helmet.add(bowl)
	helmet.add(part(shape(new CylinderGeometry(h.radius * 1.02, h.radius * 1.04, 0.05, 16)), gold, 0, h.y + 0.01, h.z))
	const visor = part(shape(new CylinderGeometry(h.radius * 0.95, h.radius * 1.25, 0.04, 16, 1, false, -Math.PI / 3, (Math.PI * 2) / 3)), dark, 0, h.y + 0.02, h.z + 0.02)
	helmet.add(visor)
	for (let lame = 0; lame < 3; lame++) {
		const top = h.radius * (1.02 + lame * 0.12)
		const guard = part(shape(new CylinderGeometry(top, top + 0.1, 0.1, 18, 1, true, Math.PI / 3.2, Math.PI * 2 - (Math.PI * 2) / 3.2)), red, 0, h.y - 0.06 - lame * 0.09, h.z)
		guard.material = lame === 2 ? cord : red
		helmet.add(guard)
	}
	for (const side of [-1, 1]) {
		const horn = part(shape(new BoxGeometry(0.035, 0.42, 0.02)), gold, side * 0.12, h.y + 0.32, h.z + h.radius * 0.9)
		horn.rotation.z = -side * 0.42
		helmet.add(horn)
		// The turned-back flaps either side of the face (fukigaeshi).
		const flap = part(shape(new BoxGeometry(0.12, 0.14, 0.03)), red, side * (h.radius + 0.02), h.y - 0.04, h.z + h.radius * 0.55)
		flap.rotation.y = side * 0.9
		helmet.add(flap)
	}
	const crest = part(shape(new CylinderGeometry(0.07, 0.07, 0.02, 16)), gold, 0, h.y + 0.14, h.z + h.radius * 0.98)
	crest.rotation.x = Math.PI / 2
	helmet.add(crest)

	// Breastplate (dō): lacquered red with rows of gold lacing, a dark band at the top.
	const breast = new Group()
	const { chest: c } = fit
	breast.add(part(shape(new CylinderGeometry(c.radius, c.radius * 0.95, 0.46, 12)), red, 0, c.y, c.z))
	breast.add(part(shape(new CylinderGeometry(c.radius * 1.01, c.radius * 1.01, 0.08, 12)), dark, 0, c.y + 0.21, c.z))
	for (const row of [-0.14, -0.05, 0.04, 0.13]) breast.add(part(shape(new CylinderGeometry(c.radius * 1.012, c.radius * 1.012, 0.015, 12)), cord, 0, c.y + row, c.z))
	// The collar and shoulder straps (watagami) over the top of the breastplate.
	breast.add(part(shape(new CylinderGeometry(c.radius * 0.75, c.radius * 1.05, 0.12, 12)), dark, 0, c.y + 0.29, c.z))
	// Wider than deep, like the body it covers.
	breast.scale.set(1.2, 1, 1)

	// Skirt (kusazuri): plates round the waist, each with a gilt hem.
	const skirt = new Group()
	const { waist: w } = fit
	for (let plate = 0; plate < 6; plate++) {
		const angle = (plate / 6) * Math.PI * 2 + Math.PI / 6
		const at = new Group()
		at.position.set(Math.sin(angle) * w.radius, w.y - 0.1, w.z + Math.cos(angle) * w.radius)
		at.rotation.y = angle
		at.rotation.x = 0.18
		at.add(part(shape(new BoxGeometry(0.22, 0.24, 0.035)), red, 0, 0, 0))
		at.add(part(shape(new BoxGeometry(0.22, 0.03, 0.04)), gold, 0, -0.12, 0))
		skirt.add(at)
	}

	// Shoulder plates (sode): three stacked lames hanging outside each upper arm.
	const shoulders = [left, right].map((bone, index) => {
		const side = index === 0 ? 1 : -1
		const plate = new Group()
		const { shoulder: s } = fit
		plate.position.set(side * s.x, s.y, s.z)
		plate.rotation.z = side * 0.28
		for (let lame = 0; lame < 3; lame++) {
			plate.add(part(shape(new BoxGeometry(0.06, 0.11, 0.3)), lame === 2 ? gold : red, side * 0.012 * lame, -lame * 0.1, 0))
		}
		return { bone, plate }
	})

	// Sleeves and the wide trousers (hakama) in dark cloth, with gilt-edged guards on the forearms:
	// each a tapering tube from one joint to the next, joined to the bone that moves it.
	const tube = (from: Point, to: Point, top: number, bottom: number, material: Material) => {
		const start = new Vector3(...from)
		const end = new Vector3(...to)
		const mesh = new Mesh(shape(new CylinderGeometry(top, bottom, start.distanceTo(end), 10)), material)
		mesh.position.copy(start).add(end).multiplyScalar(0.5)
		mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), start.clone().sub(end).normalize())
		mesh.castShadow = true
		return mesh
	}
	const limbs: { piece: Object3D; bone: string }[] = []
	for (const [side, suffix] of [[1, 'L'], [-1, 'R']] as const) {
		const at = (point: Point) => mirrored(point, side)
		limbs.push(
			{ piece: tube(at(joints.shoulder), at(joints.elbow), 0.12, 0.11, cloth), bone: `UpperArm${suffix}` },
			{ piece: tube(at(joints.elbow), at(joints.hand), 0.1, 0.09, red), bone: `LowerArm${suffix}` },
			{ piece: tube(at(joints.hip), at(joints.knee), 0.17, 0.19, cloth), bone: `UpperLeg${suffix}` },
			{ piece: tube(at(joints.knee), at(joints.ankle), 0.19, 0.23, cloth), bone: `LowerLeg${suffix}` },
		)
	}

	// The pieces were laid out facing +z, as the model is in its file; join each to its bone where
	// it now stands in the world.
	scene.updateMatrixWorld(true)
	// The model's world matrix without its scale: the pieces are in metres already.
	const unscale = 1 / scene.scale.y
	const toWorld = scene.matrixWorld.clone().multiply(new Matrix4().makeScale(unscale, unscale, unscale))
	const place = (piece: Object3D, bone: Object3D) => {
		piece.applyMatrix4(toWorld)
		bone.attach(piece)
	}
	place(helmet, headBone)
	place(breast, torso)
	place(skirt, hips)
	for (const { bone, plate } of shoulders) place(plate, bone)
	for (const { piece, bone } of limbs) {
		const joint = scene.getObjectByName(bone)
		if (joint !== undefined) place(piece, joint)
	}

	// The helmet gets materials of its own, so it keeps its colours when the body turns grey.
	const body = [...materials]
	const helmetMaterials = new Map<Material, MeshStandardMaterial>()
	helmet.traverse((object) => {
		if (!(object instanceof Mesh) || !(object.material instanceof MeshStandardMaterial)) return
		let own = helmetMaterials.get(object.material)
		if (own === undefined) {
			own = object.material.clone()
			helmetMaterials.set(object.material, own)
			materials.push(own)
		}
		object.material = own
	})

	return {
		helmet,
		body,
		headBone,
		helmetAt: helmet.matrix.clone(),
		materials,
		// The materials are freed by the figure that wears them, with its own.
		dispose() {
			for (const geometry of geometries) geometry.dispose()
		},
	}
}
