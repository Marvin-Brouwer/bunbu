/**
 * The samurai and the ninjas on the real models: Quaternius's "Matt" in armour for the samurai and
 * his animated ninja for the ninjas (both CC0), cloned per figure. Both come from one pack, so they
 * share one rig, one set of clips and one style ([one art style](../../../../../docs/design/assets.md#rules)).
 *
 * The clips are never left to run on their own clock: each frame the pose and the time since it
 * began, both from the store, say exactly where in its clip the figure is ({@link clipTimeOf}).
 */

import {
	AnimationMixer,
	Color,
	Group,
	Mesh,
	MeshStandardMaterial,
	Quaternion,
	SkinnedMesh,
	Vector3,
	type AnimationAction,
	type Material,
	type Object3D,
} from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { createFigure, type FigureParts } from './figure.mts'
import { dress, type Armour } from './armour.mts'
import { clipPlays, clipTimeOf, helmetFlight, rigOf, type FigurePose } from './poses.mts'

/** A figure in the world, on the real model or on the placeholder until the model has loaded. */
export type Body = {
	readonly root: Group
	/** Shows `pose`, `time` seconds after it began; `faded` below 1 for the back row. */
	show: (pose: FigurePose, time: number, cycle: number, faded?: number) => void
	/** Blends every colour toward ink-wash grey, `0` none, `1` fully grey. */
	grey: (amount: number) => void
	dispose: () => void
}

/** How a side looks on its model. */
export type Look = {
	/** Colours by the model's material names. */
	readonly colours?: Readonly<Record<string, number>>
	/** Dressed in the samurai's armour ({@link dress}), with the helmet that comes off when he falls. */
	readonly armour?: boolean
	/** The model's own names for clips, where they differ from {@link clipPlays}. */
	readonly clips?: Readonly<Record<string, string>>
}

/** The samurai: Quaternius's "Matt" in armour, cutting with `Slash`. */
export const samuraiLook: Look = { armour: true, clips: { Weapon: 'Slash' } }
/** The ninjas: Quaternius's ninja in black with a red sash. */
export const ninjaLook: Look = { colours: { Ninja_Main: 0x15161c, Ninja_Secondary: 0x3a3f4a, Belt: 0x8e1f1a } }

/** Seconds into the fallen pose when the helmet comes off. */
const helmetOff = 0.05

/** Metres from the ground to the top of the head. */
const height = 1.8
/** Seconds to blend from one clip into the next. */
const blendSeconds = 0.12

const inkWash = new Color(0x8a8a86)

/** The placeholder as a {@link Body}, for before the model has loaded. */
export function placeholderBody(parts: FigureParts, colours: Parameters<typeof createFigure>[1]): Body {
	const figure = createFigure(parts, colours)
	return {
		root: figure.root,
		show(pose, time, cycle, faded) {
			figure.pose(rigOf(pose, time, cycle), faded)
		},
		grey: (amount) => { figure.grey(amount) },
		dispose: () => { figure.dispose() },
	}
}

function recolour(material: Material, look: Look): void {
	if (!(material instanceof MeshStandardMaterial)) return
	const colour = look.colours?.[material.name]
	if (colour !== undefined) material.color.setHex(colour)
}

export function createCharacter(model: GLTF, look: Look): Body {
	const scene = clone(model.scene)
	const root = new Group()
	// What the whole body does on top of its clip: knocked back, turned away to flee.
	const body = new Group()
	root.add(body)
	body.add(scene)
	// The model faces +z; the world's figures face -z.
	scene.rotation.y = Math.PI

	// Every figure gets its own materials, so one can fade or turn grey on its own.
	const materials: MeshStandardMaterial[] = []
	scene.traverse((object: Object3D) => {
		if (!(object instanceof Mesh)) return
		object.castShadow = true
		// Skinned meshes move away from their bind-pose bounds; culling them would make them blink.
		object.frustumCulled = false
		const own = (object.material as Material).clone()
		recolour(own, look)
		if (own instanceof MeshStandardMaterial) materials.push(own)
		object.material = own
	})

	// The model's parts share one skeleton; a clone gives each its own. Bind them back to one, so a
	// figure uploads its bones once a frame, and free it with the figure.
	const skinned = scene.getObjectsByProperty('isSkinnedMesh', true).filter((object): object is SkinnedMesh => object instanceof SkinnedMesh)
	const skeleton = skinned[0]?.skeleton
	const shared = skeleton !== undefined && skinned.every((mesh) => mesh.skeleton.bones.length === skeleton.bones.length
		&& mesh.skeleton.bones.every((bone, index) => bone === skeleton.bones[index]))
	if (skeleton !== undefined && shared) for (const mesh of skinned) mesh.bind(skeleton, mesh.bindMatrix)
	const skeletons = new Set(skinned.map((mesh) => mesh.skeleton))

	// Scale by the head, not the bounds: the bind pose holds the sword up.
	scene.updateMatrixWorld(true)
	const head = scene.getObjectByName('Head_end') ?? scene.getObjectByName('Head')
	const top = head === undefined ? height : head.getWorldPosition(new Vector3()).y
	scene.scale.setScalar(height / Math.max(top, 1e-3))

	const armour = look.armour === true ? dress(scene) : undefined
	// Fading takes the armour along; turning grey leaves the helmet in its colours, lying there.
	const greying = [...materials, ...(armour?.body ?? [])]
	const greys = greying.map((material) => material.color.clone())
	if (armour !== undefined) materials.push(...armour.materials)
	/** The helmet once it is off: where it came off, in the figure's own frame. */
	let off: { readonly position: Vector3; readonly quaternion: Quaternion } | undefined

	const mixer = new AnimationMixer(scene)
	const actions = new Map<string, AnimationAction>()
	for (const clip of model.animations) {
		const action = mixer.clipAction(clip)
		action.play()
		action.setEffectiveWeight(0)
		actions.set(clip.name.split('|').pop() ?? clip.name, action)
	}

	/**
	 * Knocks the helmet off and lets it fly, `since` seconds after it came off; puts it back on when
	 * `since` is `undefined` or not yet reached.
	 */
	function loseHelmet({ helmet, headBone, helmetAt }: Armour, since: number | undefined): void {
		if (since === undefined || since < 0) {
			if (off !== undefined) {
				headBone.add(helmet)
				helmetAt.decompose(helmet.position, helmet.quaternion, helmet.scale)
				off = undefined
			}
			return
		}
		if (off === undefined) {
			// From the head into the figure's own frame, where it was the moment it came off.
			root.updateMatrixWorld(true)
			root.attach(helmet)
			off = { position: helmet.position.clone(), quaternion: helmet.quaternion.clone() }
		}
		const flight = helmetFlight(since, off.position.y)
		// Behind him is +z in his own frame, and his right is +x.
		helmet.position.set(off.position.x + flight.side, flight.height, off.position.z + flight.back)
		helmet.quaternion.copy(off.quaternion).multiply(tumble.setFromAxisAngle(sideways, flight.tumble))
	}
	const tumble = new Quaternion()
	const sideways = new Vector3(1, 0, 0.3).normalize()

	let current: { readonly pose: FigurePose; readonly clip: string } | undefined
	let previous: { readonly clip: string; readonly at: number } | undefined
	let lastAt = 0
	let see = false

	return {
		root,

		show(pose, time, cycle, faded = 1) {
			const rig = rigOf(pose, time, cycle)
			body.position.z = -rig.shift
			body.rotation.y = rig.turn

			const played = clipPlays[pose].clip
			const clip = look.clips?.[played] ?? played
			if (current?.pose !== pose) {
				if (current !== undefined) previous = { clip: current.clip, at: lastAt }
				current = { pose, clip }
			}
			const action = actions.get(clip)
			const blend = previous === undefined ? 1 : Math.min(1, time / blendSeconds)
			for (const [name, each] of actions) {
				const weight = name === clip ? blend : name === previous?.clip ? 1 - blend : 0
				each.setEffectiveWeight(weight)
			}
			if (previous !== undefined && previous.clip !== clip) {
				const held = actions.get(previous.clip)
				if (held !== undefined) held.time = previous.at
			}
			if (blend >= 1) previous = undefined
			if (action !== undefined) {
				lastAt = clipTimeOf(pose, time, cycle, action.getClip().duration)
				action.time = lastAt
			}
			mixer.update(0)

			if (armour !== undefined) loseHelmet(armour, pose === 'fallen' ? time - helmetOff : undefined)

			const opacity = rig.fade * faded
			root.visible = opacity > 0
			const translucent = opacity < 1
			if (translucent !== see) {
				see = translucent
				for (const material of materials) {
					material.transparent = translucent
					material.premultipliedAlpha = translucent
					material.needsUpdate = true
				}
			}
			for (const material of materials) material.opacity = opacity
		},

		grey(amount) {
			greying.forEach((material, index) => {
				material.color.copy(greys[index] ?? inkWash).lerp(inkWash, amount)
			})
		},

		dispose() {
			armour?.dispose()
			mixer.stopAllAction()
			mixer.uncacheRoot(scene)
			for (const each of skeletons) each.dispose()
			for (const material of materials) material.dispose()
		},
	}
}
