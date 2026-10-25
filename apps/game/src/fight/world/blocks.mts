/**
 * A stage's scenery as building blocks stitched together, so a run can go on for as long as its quiz
 * needs. A block is one round of the stage's path ([path](./path.mts)) with everything along it. Each
 * stage lays out a few of them when the run starts, each its own variant, and moves them along ahead
 * of the samurai, picking which comes next.
 *
 * Every round starts where the last one ended, facing the same way, so a block laid on any round
 * fits on any other once moved: on by whole rounds, never turned. A block keeps what it holds inside
 * its own stretch of the path, so it fits against whatever block comes before or after it.
 */

import { Group, InstancedMesh, Vector3 } from 'three'
import { scatter } from './kit.mts'
import type { Path } from './path.mts'
import { moved, type Solid } from './solids.mts'

/** How many blocks a stage lays out. One more than are shown at once, so which comes next is a choice. */
export const blockVariants = 5

/** Which blocks are shown round the samurai: the one he is in, one behind him and two ahead. */
export const shownBehind = 1
export const shownAhead = 2

/** How many blocks are shown at once; no block can be in two places, so they are all different ones. */
const shown = shownBehind + 1 + shownAhead

/** The first slot a block is ever shown in: the one behind the start. */
const firstSlot = -shownBehind

/**
 * Which of `variants` blocks stands in each slot, a round of the path per slot: the same every run,
 * and never one that is shown already. From the second time round each slot picks at random from the
 * blocks that are not.
 */
export function blockOrder(variants = blockVariants): (slot: number) => number {
	if (variants <= shown) throw new RangeError(`a stage needs more than ${shown} blocks, to choose the next one`)
	// The first few in a shuffled order, then each one picked from those not shown.
	const order = Array.from({ length: variants }, (_, variant) => variant)
		.map((variant) => ({ variant, key: scatter(variant * 31 + 7) }))
		.toSorted((one, other) => one.key - other.key)
		.map(({ variant }) => variant)
		.slice(0, shown - 1)
	// Grows by one slot per round the samurai runs, a few a kilometre.
	return (slot) => {
		const index = Math.max(0, slot - firstSlot)
		while (order.length <= index) {
			const recent = new Set(order.slice(-(shown - 1)))
			const free = Array.from({ length: variants }, (_, variant) => variant).filter((variant) => !recent.has(variant))
			const next = free[Math.floor(scatter(order.length * 17 + 3) * free.length)] ?? free[0] ?? 0
			order.push(next)
		}
		return order[index] ?? 0
	}
}

/** The slots shown when the samurai is in `slot`. */
export function shownAround(slot: number): number[] {
	const slots: number[] = []
	for (let each = Math.max(firstSlot, slot - shownBehind); each <= slot + shownAhead; each++) slots.push(each)
	return slots
}

/** One block as a stage laid it out: its scenery, and what it places once the models are in. */
export type Laid<Pending> = {
	readonly group: Group
	readonly pending: Pending
}

/**
 * Lays out a block for the stretch of path from `from` to `to`. It uses `seed` for what it picks at
 * random, so each block comes out different, and keeps everything it places between `from` and `to`.
 */
export type Lay<Pending> = (from: number, to: number, seed: number) => Laid<Pending>

export type Blocks<Pending> = {
	/** Every block, for the scene. Only the ones round the samurai are shown. */
	readonly group: Group
	readonly laid: readonly Laid<Pending>[]
	/** Shows the blocks round the samurai `distance` metres along the path, each in its place. */
	follow: (distance: number) => void
	/** Frees the copies the blocks made; the geometries and materials are the stage's own to free. */
	dispose: () => void
}

/**
 * Lays out `variants` blocks of `path` with `lay`, a round each, all hidden until `follow` shows them.
 * `onShown` hears of each block put in a new place: the distance along the path its round starts at
 * there, and how far it was moved from where it was laid.
 */
export function layBlocks<Pending>(path: Path, lay: Lay<Pending>, variants = blockVariants, onShown?: (block: Laid<Pending>, from: number, offset: Vector3) => void): Blocks<Pending> {
	const order = blockOrder(variants)
	const length = path.round
	// How far each round moves the next one on: from the start of the path to the end of its first round.
	const start = path.at(0)
	const end = path.at(length)
	const across = new Vector3(end.x - start.x, 0, end.z - start.z)

	const group = new Group()
	// Each laid on a round of its own, so what each picks by its place on the path is different too,
	// and with a seed of its own, a prime apart, for what each picks by count.
	const laid = Array.from({ length: variants }, (_, variant) => lay(variant * length, (variant + 1) * length, (variant + 1) * 10_007))
	for (const block of laid) {
		block.group.visible = false
		group.add(block.group)
	}

	let at: number | undefined
	// The round each block was last shown on.
	const shownOn: (number | undefined)[] = []
	return {
		group,
		laid,

		follow(distance) {
			const slot = Math.floor(distance / length)
			if (slot === at) return
			at = slot
			for (const block of laid) block.group.visible = false
			for (const each of shownAround(slot)) {
				const variant = order(each)
				const block = laid[variant]
				if (block === undefined) continue
				// Laid on round `variant`, shown on round `each`.
				block.group.position.copy(across).multiplyScalar(each - variant)
				block.group.visible = true
				if (shownOn[variant] !== each) onShown?.(block, each * length, block.group.position)
				shownOn[variant] = each
			}
		},

		dispose() {
			group.traverse((object) => {
				if (object instanceof InstancedMesh) object.dispose()
			})
		},
	}
}

/** What `solidsOf` says is solid in the blocks shown round the samurai, where they are shown ([solids](./solids.mts)). */
export function solidsShown<Pending>(blocks: Blocks<Pending>, solidsOf: (pending: Pending) => readonly Solid[]): Solid[] {
	return blocks.laid.filter((block) => block.group.visible).flatMap((block) => solidsOf(block.pending).map((solid) => moved(solid, block.group.position)))
}
