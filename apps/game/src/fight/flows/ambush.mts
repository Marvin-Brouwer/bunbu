/**
 * Answering a question, which touches the ambush, the score or the life bar, the samurai and the
 * ninjas at once ([flows](../../../../../docs/architecture/state.md#flows-changes-that-span-stores)).
 *
 * Opening, timing and committing an ambush are the ambush rules; what happens to the run around
 * it (the pause after a hit, resuming) belongs to the run flows.
 */

import { openingOf } from '../../_shared/state/ambush-opening.mts'
import { approachOf } from '../../_shared/state/ambush-time.mts'
import type { Random } from '../../_shared/state/random.mts'
import { refuse, snapshot } from '../../_shared/state/store.mts'
import type { QuizActions, QuizState } from '../../_shared/state/quiz.mts'
import type { RunGame } from '../state/game.mts'
import { shareOfOnePoint } from '../state/life.mts'
import { spawnsOf } from '../state/ninjas.mts'
import { endRun } from './run.mts'

/** What one miss costs the life bar, for the quiz that is loaded. */
export function missShare(game: RunGame): number {
	const { quiz, refs } = game.quiz.value
	if (quiz === undefined) return 1
	return shareOfOnePoint(refs.length, quiz.passingScore)
}

/**
 * Springs the ambush for the question that is up next: the world slows down, the ninjas spawn
 * and the scroll opens. `timeScale` comes from the settings, `undefined` for no time limit.
 */
export function openAmbush(game: RunGame, timeScale: number | undefined, random: Random = Math.random): void {
	const at = game.quiz.value.current()
	if (at === undefined) {
		refuse('openAmbush', 'every question has been answered')
		return
	}
	game.run.value.beginAmbush()
	if (game.run.value.phase !== 'ambush') return

	const { quiz, refs } = snapshot<QuizState & QuizActions>(game.quiz)
	if (quiz === undefined) return
	const opening = openingOf(quiz, refs, at, { timeScale, random })
	game.ninjas.value.clear()
	game.ninjas.value.spawn(spawnsOf(opening.options))
	game.ambush.value.start(opening)
}

/**
 * Counts the ambush down and lets the ninjas creep in, so they are the timer. When the time runs
 * out the ambush ends unanswered, whatever was half-swiped.
 *
 * `realDt` is real time, not the slowed-down world time: the slow motion is only visual, and the
 * time limit is the player's reading time.
 */
export function tickAmbush(game: RunGame, realDt: number): void {
	const { ambush } = game
	if (!ambush.value.open) return
	ambush.value.tick(realDt)
	game.ninjas.value.advance(approachOf(ambush.value.seconds, ambush.value.secondsLeft))
	if (ambush.value.unanswered()) commitAmbush(game)
}

/** Commits the open ambush and spreads the result over the run's stores. */
export function commitAmbush(game: RunGame): void {
	const result = game.ambush.value.commit()
	if (result === undefined) return

	game.quiz.value.record({ at: result.at, outcome: result.outcome, picked: result.picked })

	if (result.outcome === 'correct') {
		game.score.value.addCorrect()
		for (const ninja of result.slain) game.ninjas.value.slay(ninja)
		for (const ninja of result.blocked) game.ninjas.value.block(ninja)
		const [first] = result.slain
		if (first === undefined) game.shogun.value.block(result.blocked[0] ?? 0)
		else game.shogun.value.strike(first)
	} else {
		game.score.value.addMiss()
		game.life.value.hit(missShare(game))
		game.shogun.value.hurt()
		for (const ninja of game.ninjas.value.active) game.ninjas.value.strike(ninja.id)
	}

	const { answered, refs } = game.quiz.value
	if (game.life.value.empty() || answered >= refs.length) {
		endRun(game)
		return
	}
	// The samurai keeps the pose he struck, blocked or was hit in: the run track adds the pause
	// before the run resumes (about 1 s after a hit) and puts him back to running.
	game.run.value.endAmbush()
}
