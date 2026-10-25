/**
 * The districts of a stage (#72): each quarter of a stage is a part of its own, so passing a
 * quarter mark changes the scenery too, not only the light. Castle town goes from its gate gardens
 * through the shop street and past the pond and the red bridge to the castle approach.
 *
 * A district is the stage's backdrop and what stands by the way ([backdrop](./backdrop.mts)); the
 * stage's own blocks stay the same throughout, but for Edo castle's walls, which change with the
 * district at the gatehouse that starts a round ([Edo castle](./edo-castle.mts)). One district fades into the next over a stretch of
 * path rather than at the mark. A short test doesn't get all four: each district has at least
 * {@link districtConfig}`.minQuestions` questions, so ten questions make two districts, the first
 * and the last. Plain numbers, so it can be tested.
 */

import { metresPerAmbush } from '../flows/run.mts'

/** Defaults to tune in playtests. */
export const districtConfig = {
	/** The fewest questions a district is run through. */
	minQuestions: 5,
	/** Metres over which one district fades into the next, around where they meet. */
	blend: 90,
}

/** How many designs a stage has for its districts, one per quarter of a long test. */
export const districtDesigns = 4

/**
 * Which of a stage's district designs a test of `questions` runs through, in order: as many as fit
 * {@link districtConfig}`.minQuestions` each, up to all four, spread from the first to the last.
 */
export function districtsOf(questions: number): number[] {
	const count = Math.max(1, Math.min(districtDesigns, Math.floor(questions / districtConfig.minQuestions)))
	if (count === 1) return [0]
	return Array.from({ length: count }, (_, index) => Math.round((index * (districtDesigns - 1)) / (count - 1)))
}

/** Where along the stage the samurai is, as districts: the one he is leaving, the one he comes to, and how far it has faded in. */
export type DistrictMix = {
	readonly from: number
	readonly to: number
	/** `0` all `from`, `1` all `to`. */
	readonly mix: number
}

/**
 * The district design `distance` metres along a stage of `stageLength` metres, faded into the next
 * over {@link districtConfig}`.blend` metres round where they meet.
 */
export function districtAt(distance: number, stageLength: number): DistrictMix {
	const questions = Number.isFinite(stageLength) ? Math.round(stageLength / metresPerAmbush) : 0
	const designs = districtsOf(questions)
	const first = designs[0] ?? 0
	if (designs.length === 1 || !(stageLength > 0)) return { from: first, to: first, mix: 0 }
	const part = stageLength / designs.length
	// Where he is in districts, and the meeting of two districts nearest him.
	const along = distance / part
	const meeting = Math.min(designs.length - 1, Math.max(1, Math.round(along)))
	const width = districtConfig.blend / part
	const into = (along - meeting + width / 2) / width
	const before = designs[meeting - 1] ?? first
	const after = designs[meeting] ?? before
	if (into <= 0) return { from: before, to: before, mix: 0 }
	if (into >= 1) return { from: after, to: after, mix: 0 }
	return { from: before, to: after, mix: into }
}
