/**
 * The run's sounds ([sound](../_shared/sound/sound.mts)): the samurai's steps, the ninjas rushing in
 * as an ambush springs and the scroll unrolling once they are in, his sword cutting the air, the ninjas cut down,
 * blades meeting on a block, and the thud of a hit. A short buzz goes with each scroll unrolling.
 *
 * Like the renderer, it only listens to the run's stores and never changes them
 * ([rendering is read-only](../../../../docs/architecture/rendering.md#rendering-is-read-only)), and
 * it times each sound to what is drawn: a block rings when the blades meet, a hit when it lands.
 */

import { maximumDelta } from '../canvas/loop.mts'
import { buzz, buzzes } from '../_shared/haptics.mts'
import { play } from '../_shared/sound/sound.mts'
import { finishingLands } from '../_shared/world/poses.mts'
import type { RunGame } from './state/game.mts'
import { bladeLandsAfter, clashSeconds, strikeDelaySeconds } from './world/ninjas.mts'
import { stepLength } from './world/world.mts'

/** Plays the sounds of `game` until `signal` aborts, usually the run screen's own. */
export function playRunSounds(game: RunGame, signal: AbortSignal): void {
	// Sounds still to come, as the blade on its way, timed by the run's own clock: it stands still
	// while paused and counting down, as the world does, so a sound waits with what it goes with.
	let pending: { left: number; play: () => void }[] = []
	let clock = game.run.value.elapsed
	const later = (seconds: number, then: () => void) => { pending.push({ left: seconds, play: then }) }
	game.run.on('change', signal, ({ detail }) => {
		const passed = detail.state.elapsed - clock
		clock = detail.state.elapsed
		if (passed <= 0 || pending.length === 0) return
		const due = pending.filter((sound) => sound.left - passed <= 0)
		pending = pending.filter((sound) => sound.left - passed > 0).map((sound) => ({ ...sound, left: sound.left - passed }))
		for (const sound of due) sound.play()
	})

	// A step each time a foot comes down, softer in the ambush's slow motion: by the metres his legs
	// have run, as the world draws them ([world](./world/world.mts)), his run in to the start included.
	let steps = Math.floor(game.run.value.stepped / stepLength)
	let open = game.ambush.value.open
	game.run.on('change', signal, ({ detail }) => {
		const { worldScale, phase } = detail.state
		const step = Math.floor(detail.state.stepped / stepLength)
		if (step !== steps && (phase === 'intro' || phase === 'running' || phase === 'ambush')) play('step', 0.4 + 0.6 * worldScale)
		steps = step
	})

	// The ninjas rush in as the ambush springs, and the scroll unrolls once they are in; the next
	// round of the same attack unrolls its scroll at once.
	let unrolled = true
	game.ambush.on('change', signal, ({ detail }) => {
		const { state } = detail
		if (state.open && !open) {
			if (state.round <= 1) play('rush')
			unrolled = false
		}
		if (state.open && !unrolled && (state.round > 1 || state.openingLeft === 0)) {
			buzz(buzzes.scroll)
			play('unroll')
			unrolled = true
		}
		open = state.open
	})

	// The samurai cuts the air, and takes his hit when the blade lands.
	let sequence = game.shogun.value.sequence
	game.shogun.on('change', signal, ({ detail }) => {
		const { pose, sequence: next } = detail.state
		if (next === sequence) return
		sequence = next
		if (pose === 'strike' || pose === 'block') play('swing')
		if (pose === 'hurt') {
			const slicer = game.ninjas.value.active.some((ninja) => ninja.slicer === true)
			later(bladeLandsAfter(slicer), () => { play('hit') })
		}
		// Fallen, a ninja of its own runs in and finishes him off. The run's clock has stopped with
		// the run, so this one goes by the frames the world draws the finishing blow with, which stop
		// while the page is hidden, as the blow does.
		if (pose === 'fallen') {
			let left = finishingLands
			let last = performance.now()
			let frame = requestAnimationFrame(function wait(now) {
				left -= Math.min(maximumDelta, (now - last) / 1000)
				last = now
				if (left <= 0) play('hit')
				else frame = requestAnimationFrame(wait)
			})
			signal.addEventListener('abort', () => { cancelAnimationFrame(frame) }, { once: true })
		}
	})

	// A ninja cut down, or its blade met by his.
	const seen = new Map<number, number>()
	game.ninjas.on('change', signal, ({ detail }) => {
		for (const ninja of detail.state.active) {
			if (seen.get(ninja.id) === ninja.sequence) continue
			seen.set(ninja.id, ninja.sequence)
			if (ninja.pose === 'slain') play('cut')
			if (ninja.pose === 'blocked') later(clashSeconds, () => { play('clash') })
			// Striking: at once in an outcome; when the time ran out, the slicer only once the halves of
			// the scroll have fallen, and the others flee without a cut.
			if (ninja.pose === 'strike' && ninja.slicer === undefined) play('swing', 0.6)
			// The slicer cuts right through the scroll at once, then charges in once its halves have fallen.
			if (ninja.pose === 'strike' && ninja.slicer === true) {
				play('slice')
				later(strikeDelaySeconds, () => { play('swing', 0.6) })
			}
		}
		for (const id of seen.keys()) if (!detail.state.active.some((ninja) => ninja.id === id)) seen.delete(id)
	})
}
