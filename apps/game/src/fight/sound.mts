/**
 * The run's sounds ([sound](../_shared/sound/sound.mts)): the samurai's steps, the ninjas rushing in
 * and the scroll unrolling as an ambush springs, his sword cutting the air, the ninjas cut down,
 * blades meeting on a block, and the thud of a hit.
 *
 * Like the renderer, it only listens to the run's stores and never changes them
 * ([rendering is read-only](../../../../docs/architecture/rendering.md#rendering-is-read-only)), and
 * it times each sound to what is drawn: a block rings when the blades meet, a hit when it lands.
 */

import { play } from '../_shared/sound/sound.mts'
import type { RunGame } from './state/game.mts'
import { bladeLandsAfter, clashSeconds } from './world/ninjas.mts'
import { stepLength } from './world/world.mts'

/** Calls `then` after `seconds`, unless the run has gone by then. */
function later(seconds: number, signal: AbortSignal, then: () => void): void {
	const timer = setTimeout(then, seconds * 1000)
	signal.addEventListener('abort', () => { clearTimeout(timer) }, { once: true })
}

/** Plays the sounds of `game` until `signal` aborts, usually the run screen's own. */
export function playRunSounds(game: RunGame, signal: AbortSignal): void {
	// A step each time a foot comes down, softer in the ambush's slow motion.
	let steps = Math.floor(game.run.value.distance / stepLength)
	let open = game.ambush.value.open
	game.run.on('change', signal, ({ detail }) => {
		const { distance, worldScale, phase } = detail.state
		const step = Math.floor(distance / stepLength)
		if (step !== steps && (phase === 'running' || phase === 'ambush')) play('step', 0.4 + 0.6 * worldScale)
		steps = step
	})

	// The ninjas rush in as the scroll unrolls.
	game.ambush.on('change', signal, ({ detail }) => {
		if (detail.state.open && !open) {
			play('rush')
			play('unroll')
		}
		open = detail.state.open
	})

	// The samurai cuts the air, and takes his hit when the blade lands.
	let sequence = game.shogun.value.sequence
	game.shogun.on('change', signal, ({ detail }) => {
		const { pose, sequence: next } = detail.state
		if (next === sequence) return
		sequence = next
		if (pose === 'strike' || pose === 'block') play('swing')
		if (pose === 'hurt' || pose === 'fallen') {
			const slicer = game.ninjas.value.active.some((ninja) => ninja.slicer === true)
			later(bladeLandsAfter(slicer), signal, () => { play('hit') })
		}
	})

	// A ninja cut down, or its blade met by his.
	const seen = new Map<number, number>()
	game.ninjas.on('change', signal, ({ detail }) => {
		for (const ninja of detail.state.active) {
			if (seen.get(ninja.id) === ninja.sequence) continue
			seen.set(ninja.id, ninja.sequence)
			if (ninja.pose === 'slain') play('cut')
			if (ninja.pose === 'blocked') later(clashSeconds, signal, () => { play('clash') })
			if (ninja.pose === 'strike' && ninja.slicer === undefined) play('swing', 0.6)
		}
		for (const id of seen.keys()) if (!detail.state.active.some((ninja) => ninja.id === id)) seen.delete(id)
	})
}
