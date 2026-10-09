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

/** A clip of the real models (track F's, Quaternius's for now) and how a pose plays it. */
export type ClipPlay = {
	readonly clip: string
	/** Loops go by the running cycle or the clock; the rest play once, fitted to the pose, and hold. */
	readonly loop: 'cycle' | 'clock' | false
	/** How far into the clip a one-off pose ends, `1` the whole clip. */
	readonly until?: number
}

/** The clip each pose plays on the real models. */
export const clipPlays: Readonly<Record<FigurePose, ClipPlay>> = {
	idle: { clip: 'Idle', loop: 'clock' },
	run: { clip: 'Run', loop: 'cycle' },
	approach: { clip: 'Run', loop: 'cycle' },
	strike: { clip: 'Weapon', loop: false },
	block: { clip: 'Duck', loop: false, until: 0.4 },
	hurt: { clip: 'HitReact', loop: false },
	fallen: { clip: 'Death', loop: false },
	slain: { clip: 'Death', loop: false },
	blocked: { clip: 'HitReact', loop: false },
	fleeing: { clip: 'Run', loop: 'cycle' },
}

/** Seconds a one-off pose takes to play its clip: its own duration, or the strike's for the rest. */
const playSeconds = (pose: FigurePose): number => {
	if (pose in poseSeconds) return poseSeconds[pose as keyof typeof poseSeconds]
	return poseSeconds.strike
}

/**
 * Where in its clip `pose` is, `time` seconds after the pose began: the store's timing, never the
 * clip's. A clip of `duration` seconds is stretched or squeezed to fit the pose and then holds its
 * last frame; a loop follows the running `cycle` (radians) or the clock.
 */
export function clipTimeOf(pose: FigurePose, time: number, cycle: number, duration: number): number {
	const play = clipPlays[pose]
	if (play.loop === 'cycle') {
		const turns = cycle / (Math.PI * 2)
		return (turns - Math.floor(turns)) * duration
	}
	if (play.loop === 'clock') return time % duration
	// Just short of the end, so a clip that is not set to clamp still shows its last frame.
	const end = duration * (play.until ?? 1) - 1e-4
	return Math.min(1, Math.max(0, time / playSeconds(pose))) * end
}

/** Metres a helmet rests above the ground, on its side. */
export const helmetRest = 0.22

/** Seconds a knocked-off helmet takes to come to rest. */
export const helmetSeconds = 1.6

const gravity = 9.8

export type HelmetFlight = {
	/** Metres behind where it came off. */
	readonly back: number
	/** Metres to his right of where it came off: thrown clear of the body, which falls back. */
	readonly side: number
	/** Metres above the ground. */
	readonly height: number
	/** Radians it has tumbled. */
	readonly tumble: number
}

/**
 * Where a helmet knocked off from `from` metres up is, `time` seconds later: thrown back and up, it
 * lands, bounces once and rolls to a stop. A function of time alone, so it plays the same at any
 * frame rate and holds still once it rests.
 */
export function helmetFlight(time: number, from: number): HelmetFlight {
	const t = Math.max(0, time)
	const up = 2.4
	// When it first lands: from + up t - g t² / 2 = rest.
	const drop = Math.max(0, from - helmetRest)
	const landed = (up + Math.sqrt(up * up + 2 * gravity * drop)) / gravity
	const bounce = 0.3 * (gravity * landed - up)
	const bounced = (2 * bounce) / gravity
	let height = helmetRest
	if (t < landed) height = from + up * t - (gravity * t * t) / 2
	else if (t < landed + bounced) height = helmetRest + bounce * (t - landed) - (gravity * (t - landed) ** 2) / 2
	// Back and tumble slow down to a stop, as it rolls.
	const rolled = Math.min(t, helmetSeconds)
	const slowing = rolled - (rolled * rolled) / (2 * helmetSeconds)
	return { back: 1.1 * slowing, side: 1.5 * slowing, height, tumble: 5 * slowing }
}

/** The finishing blow when the samurai falls: a ninja runs in and stabs him ([8 Fallen](../../../../../docs/design/screens.md#8-fallen)). */
export const finishing = {
	/** Metres in front of the samurai the ninja comes from, and where it stops to strike. */
	from: 5,
	reach: 1,
	/** Seconds it runs in before it strikes. */
	run: 0.35,
}

export type Finishing = {
	readonly samurai: { readonly pose: Pose; readonly time: number }
	readonly ninja: { readonly pose: NinjaPose; readonly time: number; readonly distance: number }
}

/**
 * Who does what `time` seconds into the samurai's fall: the ninja runs in and strikes, and the
 * samurai, hurt, goes down only as the blade lands. Timed from the store's fallen pose, so it plays
 * the same every time and holds at its end.
 */
export function finishingOf(time: number): Finishing {
	const lands = finishing.run + poseSeconds.strike * 0.6
	const ninja = time < finishing.run
		? { pose: 'approach' as const, time, distance: mix(finishing.from, finishing.reach, easeOut(progress(time, finishing.run))) }
		: { pose: 'strike' as const, time: time - finishing.run, distance: finishing.reach }
	const samurai = time < lands ? { pose: 'hurt' as const, time } : { pose: 'fallen' as const, time: time - lands }
	return { samurai, ninja }
}
