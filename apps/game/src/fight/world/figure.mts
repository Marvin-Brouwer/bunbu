/**
 * The placeholder figure for the samurai and the ninjas: capsules and boxes with a hip, two legs
 * and two arms, posed by a {@link Rig}. Stands in until the real models land (track F), so the
 * world never waits on art.
 *
 * The geometry is shared by every figure and uploaded once; each figure has its own materials, so
 * one ninja can fade or turn grey without the others.
 */

import {
	BoxGeometry,
	CapsuleGeometry,
	CircleGeometry,
	Color,
	Group,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	SphereGeometry,
	type Material,
} from 'three'
import type { Rig } from './poses.mts'

const hipHeight = 0.9
const legLength = 0.88
const armLength = 0.55
const swordLength = 0.95

/** The geometry every figure shares. Dispose it once, when the world goes. */
export type FigureParts = ReturnType<typeof createFigureParts>

export function createFigureParts() {
	const leg = new BoxGeometry(0.13, legLength, 0.13).translate(0, -legLength / 2, 0)
	const arm = new BoxGeometry(0.1, armLength, 0.1).translate(0, -armLength / 2, 0)
	const sword = new BoxGeometry(0.035, swordLength, 0.06).translate(0, -swordLength / 2, 0)
	return {
		torso: new CapsuleGeometry(0.22, 0.4, 4, 10).translate(0, 0.38, 0),
		head: new SphereGeometry(0.15, 12, 8).translate(0, 0.86, 0),
		band: new BoxGeometry(0.32, 0.06, 0.32).translate(0, 0.9, 0),
		leg,
		arm,
		sword,
		shadow: new CircleGeometry(0.42, 16).rotateX(-Math.PI / 2),
		dispose() {
			for (const geometry of [this.torso, this.head, this.band, leg, arm, sword, this.shadow]) geometry.dispose()
		},
	}
}

export type FigureColours = {
	readonly body: number
	readonly skin: number
	/** Headband or helmet. */
	readonly band: number
	readonly blade: number
}

export type Figure = {
	readonly root: Group
	/** Poses the figure. A `fade` below 1, times `faded` for the back row, makes it see-through. */
	pose: (rig: Rig, faded?: number) => void
	/** Blends every colour toward ink-wash grey, `0` none, `1` fully grey. */
	grey: (amount: number) => void
	dispose: () => void
}

const inkWash = new Color(0x8a8a86)

export function createFigure(parts: FigureParts, colours: FigureColours): Figure {
	const body = new MeshStandardMaterial({ color: colours.body, roughness: 0.85 })
	const skin = new MeshStandardMaterial({ color: colours.skin, roughness: 0.9 })
	const band = new MeshStandardMaterial({ color: colours.band, roughness: 0.6 })
	const blade = new MeshStandardMaterial({ color: colours.blade, roughness: 0.3, metalness: 0.6 })
	const shadow = new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false, premultipliedAlpha: true })
	const lit = [body, skin, band, blade]
	const colourOf = lit.map((material) => material.color.clone())

	const root = new Group()
	const hips = new Group()
	root.add(hips)

	const ground = new Mesh(parts.shadow, shadow)
	ground.position.y = 0.01
	ground.renderOrder = -1
	root.add(ground)

	hips.add(new Mesh(parts.torso, body), new Mesh(parts.head, skin), new Mesh(parts.band, band))

	const leftLeg = new Group()
	leftLeg.position.x = -0.11
	leftLeg.add(new Mesh(parts.leg, body))
	const rightLeg = new Group()
	rightLeg.position.x = 0.11
	rightLeg.add(new Mesh(parts.leg, body))
	hips.add(leftLeg, rightLeg)

	// The sword hand is the right one; the katana carries on from the arm, so raising the arm
	// raises the blade.
	const swordArm = new Group()
	swordArm.position.set(0.3, 0.62, 0)
	swordArm.add(new Mesh(parts.arm, skin))
	const sword = new Group()
	sword.position.y = -armLength
	sword.add(new Mesh(parts.sword, blade))
	swordArm.add(sword)
	const guardArm = new Group()
	guardArm.position.set(-0.3, 0.62, 0)
	guardArm.add(new Mesh(parts.arm, skin))
	hips.add(swordArm, guardArm)

	return {
		root,

		pose(rig, faded = 1) {
			hips.position.set(0, hipHeight + rig.rise, -rig.shift)
			hips.rotation.set(-rig.lean, rig.turn, rig.roll, 'YXZ')
			// Kneeling: the left knee forward and up, the right shin on the ground behind.
			leftLeg.rotation.x = rig.stride * (1 - rig.kneel) + rig.kneel
			rightLeg.rotation.x = -rig.stride * (1 - rig.kneel) - 0.9 * rig.kneel
			swordArm.rotation.x = rig.swordArm
			sword.rotation.z = (Math.PI / 2) * rig.cross
			guardArm.rotation.x = rig.guardArm

			const opacity = rig.fade * faded
			root.visible = opacity > 0
			const see = opacity < 1
			if (body.transparent !== see) {
				for (const material of lit) {
					material.transparent = see
					material.premultipliedAlpha = see
					material.needsUpdate = true
				}
			}
			for (const material of lit) material.opacity = opacity
			shadow.opacity = 0.22 * opacity
		},

		grey(amount) {
			lit.forEach((material, index) => {
				material.color.copy(colourOf[index] ?? inkWash).lerp(inkWash, amount)
			})
		},

		dispose() {
			for (const material of [...lit, shadow] satisfies Material[]) material.dispose()
		},
	}
}
