/**
 * The ninjas of the current ambush. They creep in as the time runs out, so they are the timer
 * ([time limit](../../../../../docs/design/gameplay.md#time-limit)): up to 5 of them, 3 in front
 * and 2 behind, each carrying one or more options.
 */

import { createStore, type Store } from '@rooted/store'
import { frontRow } from '../../_shared/state/ambush-opening.mts'
import type { NinjaVerdict, Verdict } from '../../_shared/state/ambush.mts'
import { sortDistinct } from '../../_shared/state/arrays.mts'
import { shuffle, type Random } from '../../_shared/state/random.mts'
import { refuse } from '../../_shared/state/store.mts'

export type NinjaPose = 'approach' | 'strike' | 'slain' | 'blocked' | 'fleeing'

export type Ninja = {
	readonly id: number
	/** `0` for the three in front, `1` for the two behind, which are drawn faded. */
	readonly wave: number
	/** Indices into the ambush's options; more than one when 6 to 8 options are bundled. */
	readonly options: readonly number[]
	/** `0` far away, `1` within reach of the samurai. */
	readonly approach: number
	readonly pose: NinjaPose
	/** Counts up on every pose change, so the renderer can start an effect without an event bus. */
	readonly sequence: number
	/**
	 * When the time runs out: `true` for the one who slices through the scroll and lands the hit,
	 * `false` for the others, who flee.
	 */
	readonly slicer?: boolean
	/**
	 * Its turn to wind up as the time runs out, 0, 1, 2 …: the first one to wind up is the one who
	 * slices through the scroll.
	 */
	readonly chargeAs: number
	/**
	 * How the answers so far handled it, over every round of the question: a miss in any round
	 * stays a miss, and one rightly picked round makes it a slash.
	 */
	readonly verdict?: Verdict
	/** When one of its options was first picked in this attack, 1, 2, 3 …, for playing the outcome in that order. */
	readonly answeredAs?: number
}

/** What a ninja spawns with. */
export type NinjaSpawn = Pick<Ninja, 'id' | 'wave' | 'options' | 'chargeAs'>

/**
 * The ninjas carrying an ambush's options, one per distinct `ninja`: the first 3 in front, the
 * rest behind. They wind up in a random order, or in the order of their ids without a `random`.
 */
export function spawnsOf(options: readonly { readonly ninja: number }[], random?: Random): NinjaSpawn[] {
	const ids = sortDistinct(options.map((option) => option.ninja))
	const turns = random === undefined ? ids.map((_, turn) => turn) : shuffle(ids.map((_, turn) => turn), random)
	return ids.map((id, index) => ({
		id,
		wave: id < frontRow ? 0 : 1,
		options: options.flatMap((option, at) => (option.ninja === id ? [at] : [])),
		chargeAs: turns[index] ?? index,
	}))
}

/** The ninjas in the order they wind up when the time runs out; the first slices through the scroll. */
export function chargeOrder(active: readonly Ninja[]): Ninja[] {
	return active.toSorted((first, second) => first.chargeAs - second.chargeAs || first.id - second.id)
}

export type NinjasState = {
	readonly active: readonly Ninja[]
	/** How many ninjas have been picked in this attack, to number the next one. */
	readonly picks: number
}

/** Which verdict wins when a ninja is judged again in a later round. */
const weight: Readonly<Record<Verdict, number>> = { block: 0, slash: 1, miss: 2 }

/**
 * The order the outcome plays in: the ninjas as they were answered, then the ones never picked,
 * front row first.
 */
export function outcomeOrder(active: readonly Ninja[]): Ninja[] {
	return active.toSorted((first, second) =>
		(first.answeredAs ?? Infinity) - (second.answeredAs ?? Infinity) || first.id - second.id)
}

export type NinjasActions = {
	spawn: (wave: readonly NinjaSpawn[]) => void
	/**
	 * The next round of the same attack: the ninjas carry the next scroll's options and keep coming
	 * from where they are. A ninja the round has no options for leaves, one it needs more joins.
	 */
	regroup: (wave: readonly NinjaSpawn[]) => void
	/** Moves every approaching ninja to `approach`, which the ambush derives from the time left. */
	advance: (approach: number) => void
	/** Takes in how a round's answer handled each ninja ([outcome](../../../../../docs/design/gameplay.md#outcome)). */
	judge: (verdicts: readonly NinjaVerdict[]) => void
	strike: (id: number) => void
	/**
	 * The time ran out: the first ninja in front slices through the scroll and lands the hit, and
	 * the others flee ([unanswered](../../../../../docs/design/gameplay.md#outcome)).
	 */
	strikeUnanswered: () => void
	slay: (id: number) => void
	block: (id: number) => void
	clear: () => void
}

/** The store, with its actions on its state. Change it through those, not `update`. */
export type Ninjas = Store<NinjasState & NinjasActions>

export const noNinjas: NinjasState = { active: [], picks: 0 }

export function createNinjas(initial: NinjasState = noNinjas): Ninjas {

	const pose = (id: number, next: NinjaPose) => {
		const { active } = store.value
		if (!active.some((ninja) => ninja.id === id)) {
			refuse('ninjas', `no ninja ${id}`)
			return
		}
		store.update(() => ({
			active: active.map((ninja) => (ninja.id === id ? { ...ninja, pose: next, sequence: ninja.sequence + 1 } : ninja)),
		}))
	}

	const store: Ninjas = createStore<NinjasState & NinjasActions>({
		...initial,

		spawn(wave) {
			const spawned = wave.map((ninja) => ({ ...ninja, approach: 0, pose: 'approach' as const, sequence: 0 }))
			store.update(() => ({ active: [...store.value.active, ...spawned] }))
		},

		regroup(wave) {
			const { active } = store.value
			store.update(() => ({
				active: wave.map((next) => {
					const staying = active.find((ninja) => ninja.id === next.id)
					return staying === undefined
						? { ...next, approach: 0, pose: 'approach' as const, sequence: 0 }
						: { ...staying, options: next.options }
				}),
			}))
		},

		advance(approach) {
			const next = Math.min(1, Math.max(0, approach))
			store.update(() => ({
				active: store.value.active.map((ninja) => {
					if (ninja.pose !== 'approach') return ninja
					// The rear wave enters just after the front wave, making the source of
					// the ambush readable instead of making every ninja move as one block.
					const delayed = ninja.wave > 0 ? Math.max(0, next - 0.12) : next
					return { ...ninja, approach: delayed }
				}),
			}))
		},

		judge(verdicts) {
			const { active, picks } = store.value
			// Numbered in the order they were picked, and only the first time.
			const newlyPicked = verdicts
				.filter((each) => each.picked > 0 && active.find((ninja) => ninja.id === each.ninja)?.answeredAs === undefined)
				.toSorted((first, second) => first.picked - second.picked)
				.map((each) => each.ninja)
			store.update(() => ({
				picks: picks + newlyPicked.length,
				active: active.map((ninja) => {
					const judged = verdicts.find((each) => each.ninja === ninja.id)
					if (judged === undefined) return ninja
					const verdict = ninja.verdict === undefined || weight[judged.verdict] > weight[ninja.verdict] ? judged.verdict : ninja.verdict
					const order = newlyPicked.indexOf(ninja.id)
					return { ...ninja, verdict, answeredAs: order < 0 ? ninja.answeredAs : picks + order + 1 }
				}),
			}))
		},

		strike: (id) => { pose(id, 'strike') },
		strikeUnanswered() {
			const { active } = store.value
			const slicer = chargeOrder(active)[0]?.id
			store.update(() => ({
				active: active.map((ninja) => ({ ...ninja, pose: 'strike', sequence: ninja.sequence + 1, slicer: ninja.id === slicer })),
			}))
		},
		slay: (id) => { pose(id, 'slain') },
		block: (id) => { pose(id, 'blocked') },
		clear: () => { store.update(() => noNinjas) },
	})
	return store
}
