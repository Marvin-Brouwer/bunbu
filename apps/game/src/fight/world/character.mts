/**
 * The samurai and the ninjas on the real model: Quaternius's animated ninja (CC0), cloned per
 * figure and coloured per side, so both sides share one rig, one set of clips and one style
 * ([one art style](../../../../../docs/design/assets.md#rules)).
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
	SkinnedMesh,
	Vector3,
	type AnimationAction,
	type Material,
	type Object3D,
} from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { createFigure, type FigureParts } from './figure.mts'
import { clipPlays, clipTimeOf, rigOf, type FigurePose } from './poses.mts'

/** A figure in the world, on the real model or on the placeholder until the model has loaded. */
export type Body = {
	readonly root: Group
	/** Shows `pose`, `time` seconds after it began; `faded` below 1 for the back row. */
	show: (pose: FigurePose, time: number, cycle: number, faded?: number) => void
	/** Blends every colour toward ink-wash grey, `0` none, `1` fully grey. */
	grey: (amount: number) => void
	dispose: () => void
}

/** The colours a side wears, by the model's material names. */
export type Look = {
	readonly main: number
	readonly secondary: number
	readonly belt: number
}

export const samuraiLook: Look = { main: 0x7d1d18, secondary: 0xd9b25c, belt: 0x1d1a17 }
export const ninjaLook: Look = { main: 0x15161c, secondary: 0x3a3f4a, belt: 0x8e1f1a }

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
	const colour = { Ninja_Main: look.main, Ninja_Secondary: look.secondary, Belt: look.belt }[material.name]
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
	const colours = materials.map((material) => material.color.clone())

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

	const mixer = new AnimationMixer(scene)
	const actions = new Map<string, AnimationAction>()
	for (const clip of model.animations) {
		const action = mixer.clipAction(clip)
		action.play()
		action.setEffectiveWeight(0)
		actions.set(clip.name.split('|').pop() ?? clip.name, action)
	}

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

			const { clip } = clipPlays[pose]
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
			materials.forEach((material, index) => {
				material.color.copy(colours[index] ?? inkWash).lerp(inkWash, amount)
			})
		},

		dispose() {
			mixer.stopAllAction()
			mixer.uncacheRoot(scene)
			for (const each of skeletons) each.dispose()
			for (const material of materials) material.dispose()
		},
	}
}
