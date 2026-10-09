/**
 * The placeholder figures' animation: what a samurai or a ninja looks like in a pose, some time
 * after the pose began. Plain numbers, no three.js, so the timing can be tested.
 *
 * The store decides when a pose starts and how long it lasts; a one-off pose plays once and then
 * holds its last frame until the store moves on, so the renderer never decides that a clip is
 * done ([what the renderer may keep](../../../../../docs/architecture/state.md#what-the-renderer-may-keep)).
 * When the real models land (track F), the same poses pick a clip and fit it to these durations.
 */

import type { NinjaPose } from '../state/ninjas.mts'
import type { Pose } from '../state/shogun.mts'

/** Every pose a figure in the run can be in: the samurai's and the ninjas'. */
export type FigurePose = Pose | NinjaPose

/** The joints of a placeholder figure. Angles in radians, distances in metres. */
export type Rig = {
	/** Hips up (or down, kneeling) from standing. */
	readonly rise: number
	/** Body pitch, forward is positive. */
	readonly lean: number
	/** Body tilt to the side, for falling over. */
	readonly roll: number
	/** Leg swing: the left leg forward, the right one back. */
	readonly stride: number
	/** `0` standing, `1` down on one knee. */
	readonly kneel: number
	/** Sword arm pitch: `0` hanging, `π / 2` straight ahead, `π` overhead. */
	readonly swordArm: number
	/** `0` the sword along the arm, `1` held crosswise to block. */
	readonly cross: number
	/** The other arm's pitch. */
	readonly guardArm: number
	/** Moved forward from where it stands; negative is knocked back. */
	readonly shift: number
	/** Turned away from what it faces, `π` is its back turned. */
	readonly turn: number
	/** `0` the sword in hand, `1` let go and lying on the ground beside the figure. */
	readonly drop: number
	/** `1` fully there, `0` gone. */
	readonly fade: number
}

export const standingRig: Rig = {
	rise: 0,
	lean: 0,
	roll: 0,
	stride: 0,
	kneel: 0,
	swordArm: 0.3,
	cross: 0,
	guardArm: 0.2,
	shift: 0,
	turn: 0,
	drop: 0,
	fade: 1,
}

/** Seconds each one-off pose takes before it holds its last frame. */
export const poseSeconds = {
	strike: 0.3,
	block: 0.15,
	hurt: 0.25,
	fallen: 0.7,
	slain: 0.5,
	blocked: 0.25,
	/** How long a fleeing ninja stays in sight. */
	fleeing: 1.2,
	/** How long a slain ninja lies there before it fades. */
	slainFade: 0.6,
} as const

/** `0` to `1` over `seconds`, held at `1` after. */
const progress = (time: number, seconds: number) => Math.min(1, Math.max(0, time / seconds))

/** Eases out, so a move starts fast and settles. */
const easeOut = (amount: number) => 1 - (1 - amount) ** 2

const mix = (from: number, to: number, amount: number) => from + (to - from) * amount

/** Running: legs and arm swing with `cycle`, which goes by distance so slow motion slows them too. */
function running(cycle: number, crouch: number): Rig {
	const swing = Math.sin(cycle)
	return {
		...standingRig,
		rise: Math.abs(swing) * 0.06 - crouch * 0.12,
		lean: 0.2 + crouch * 0.25,
		stride: swing * 0.7,
		swordArm: 0.45 - swing * 0.25,
		guardArm: 0.45 + swing * 0.35,
	}
}

/** A downward cut: the sword goes up overhead, then comes down in front. */
function cut(time: number): Rig {
	const windUp = 0.4
	const raised = progress(time, poseSeconds.strike * windUp)
	const down = easeOut(progress(time - poseSeconds.strike * windUp, poseSeconds.strike * (1 - windUp)))
	return {
		...standingRig,
		lean: mix(-0.05, 0.35, down),
		stride: 0.4,
		swordArm: mix(mix(0.4, 3, raised), 0.5, down),
		guardArm: 0.6,
	}
}

/** Each pose's rig at `time` seconds in, with the running `cycle` for the poses that run. */
const rigs: Readonly<Record<FigurePose, (time: number, cycle: number) => Rig>> = {
	idle: (time) => ({ ...standingRig, rise: Math.sin(time * 2) * 0.01 }),
	run: (_time, cycle) => running(cycle, 0),
	// Ninjas creep in low.
	approach: (_time, cycle) => running(cycle, 1),
	strike: (time) => cut(time),
	block: (time) => {
		const up = easeOut(progress(time, poseSeconds.block))
		return { ...standingRig, lean: -0.1 * up, stride: 0.3 * up, swordArm: mix(0.3, 1.4, up), cross: up, guardArm: mix(0.2, 1.2, up) }
	},
	hurt: (time) => {
		const hit = progress(time, poseSeconds.hurt)
		// Knocked back hard, then half recovered.
		const recoil = hit < 0.4 ? easeOut(hit / 0.4) : mix(1, 0.5, (hit - 0.4) / 0.6)
		return { ...standingRig, lean: -0.45 * recoil, rise: -0.08 * recoil, stride: -0.3 * recoil, swordArm: mix(0.3, 1.1, recoil), guardArm: recoil }
	},
	fallen: (time) => {
		const down = easeOut(progress(time, poseSeconds.fallen))
		// On one knee, head bowed, the katana dropped
		// ([8 Fallen](../../../../../docs/design/screens.md#8-fallen)): it leaves his hand on the way down.
		const drop = easeOut(progress(time - poseSeconds.fallen * 0.3, poseSeconds.fallen * 0.7))
		return { ...standingRig, rise: -0.35 * down, lean: 0.35 * down, kneel: down, swordArm: mix(0.3, 0, down), guardArm: mix(0.2, 0.9, down), drop }
	},
	slain: (time) => {
		const down = easeOut(progress(time, poseSeconds.slain))
		const fade = 1 - progress(time - poseSeconds.slain - poseSeconds.slainFade, 0.4)
		return { ...standingRig, roll: (Math.PI / 2) * down, rise: -0.75 * down, lean: 0.2 * down, swordArm: 0, fade }
	},
	blocked: (time) => {
		const back = easeOut(progress(time, poseSeconds.blocked))
		return { ...standingRig, lean: -0.4 * back, shift: -0.7 * back, swordArm: mix(1.4, 0.2, back), guardArm: 1.2 * back }
	},
	fleeing: (time, cycle) => {
		// Turn on the spot, then run off and vanish.
		const turned = easeOut(progress(time, 0.2))
		const away = Math.max(0, time - 0.2)
		return {
			...running(cycle, 0.5),
			shift: -0.7 - away * 7,
			turn: Math.PI * turned,
			fade: 1 - progress(time - poseSeconds.fleeing + 0.3, 0.3),
		}
	},
}

/**
 * The rig of `pose` at `time` seconds after the pose began. `cycle` is the running cycle in
 * radians, for the poses that run.
 */
export function rigOf(pose: FigurePose, time: number, cycle = 0): Rig {
	return rigs[pose](time, cycle)
}
