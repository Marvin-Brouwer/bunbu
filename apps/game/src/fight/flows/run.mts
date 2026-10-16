/**
 * Starting and ending a run, and what the game loop does every frame: the changes that span the
 * run's stores ([flows](../../../../../docs/architecture/state.md#flows-changes-that-span-stores)).
 *
 * The run's rules live here: when the next ambush springs, how the samurai recovers from one, and
 * what a finished or fallen run leaves behind (the high score and the misses to practise).
 */

import type { BunbuData } from '@bunbu/data'
import { shuffle, type Random } from '../../_shared/state/random.mts'
import { selection } from '../../_shared/state/selection.mts'
import { snapshot } from '../../_shared/state/store.mts'
import { askStarts, questionsAnswered, questionsStarted, refsOfAsk, type Outcome, type QuestionRef, type QuizActions, type QuizState } from '../../_shared/state/quiz.mts'
import { quizDifficulties, timeScales, type Difficulty } from '../state/difficulty.mts'
import type { RunGame } from '../state/game.mts'
import { highScores } from '../state/highscores.mts'
import { lastRun } from '../state/lastrun.mts'
import { runConfig, stageDistanceOf } from '../state/run.mts'
import { pointOf, type HighScore } from '../state/score.mts'
import { stageAfter, stageResults } from '../state/stage-results.mts'
import { missShare, openAmbush, tickAmbush, tickOutcome } from './ambush.mts'
import { stageQuestions } from './endless.mts'

/** Metres of path per ambush, until stage length and question count are decided (docs/plan.md). */
export const metresPerAmbush = 120

/**
 * Where the samurai is when the ambush after `asked` questions springs: one leg of the path per
 * question, so the last one is at the end of the stage. The rounds of a question are one ambush.
 */
export function ambushAt(asked: number): number {
	return (asked + 1) * metresPerAmbush
}

/** How many questions have been asked to the end. */
function questionsAsked(game: RunGame): number {
	return questionsStarted(snapshot<QuizState & QuizActions>(game.quiz))
}

/** Whether `game` is a run of endless ([endless](../../../../../docs/design/gameplay.md#endless)). */
export const isEndless = (game: RunGame): boolean => game.run.value.stageLength === Infinity

/**
 * Every question once more, in a new order, for endless: never the one just asked first, so a
 * question never comes twice in a row.
 */
function nextRound(data: BunbuData, last: number | undefined, random?: Random): number[] {
	const indices = data.questions.map((_, index) => index)
	const order = random === undefined ? indices : shuffle(indices, random)
	if (order.length > 1 && order[0] === last) [order[0], order[1]] = [order[1] ?? 0, order[0] ?? 0]
	return order
}

/**
 * Keeps endless going, once an ambush has played out: once fewer questions are left than a stage
 * asks, the quiz goes round again, so the stage that is on always has all of its questions. And
 * when that ambush was the last of a stage, the life bar is full again for the next: each stage is
 * a test of its own.
 */
function keepGoing(game: RunGame, random?: Random): void {
	const state = snapshot<QuizState & QuizActions>(game.quiz)
	const { quiz, answered, order } = state
	if (quiz === undefined) return
	const questions = stageQuestions(quiz)
	if (order.length - questionsStarted(state) < questions) game.quiz.value.extend(nextRound(quiz, order.at(-1), random), random)
	// The ambush just played out was the last round of a question, and that question ended a stage.
	const done = questionsAnswered(state)
	const finished = askStarts(state).includes(answered)
	if (answered > 0 && finished && done % questions === 0) game.life.value.reset()
	}

/**
 * The questions one run asks, as indices into the quiz, in the order they are asked: a test
 * ([stages](../../../../../docs/design/gameplay.md#stages)). With `random` they are shuffled and,
 * when the quiz sets `questionsPerTest`, that many are picked from them; without it, tests and
 * get them in file order.
 */
export function testOf(data: BunbuData, random?: Random): number[] {
	const indices = data.questions.map((_, index) => index)
	const order = random === undefined ? indices : shuffle(indices, random)
	return order.slice(0, data.questionsPerTest ?? order.length)
}

/**
 * Starts a run on a new test of `data`, or on endless when that is chosen: every question, and
 * a path with no end. The game passes `Math.random` for `random`; tests and leave it out to ask
 * the questions in file order. `difficulty` defaults to the one chosen for the quiz, `best` to its
 * high score (of its endless, for endless), which the HUD shows as the one to beat.
 */
export function startRun(
	game: RunGame,
	data: BunbuData,
	random?: Random,
	difficulty: Difficulty = quizDifficulties.value.of(data.id, data.version),
	best: HighScore | undefined = highScores.value.of(data.id, data.version, selection.value.endless),
): void {
	const { endless } = selection.value
	game.quiz.value.load(data, endless ? nextRound(data, undefined, random) : testOf(data, random), random)
	game.score.value.reset(best)
	game.life.value.reset()
	game.ambush.value.close()
	game.ninjas.value.clear()
	game.shogun.value.run()
	game.run.value.start(endless ? Infinity : game.quiz.value.order.length * metresPerAmbush, difficulty)
}

/**
 * Scores an ambush that has just been recorded, by the point it counts toward
 * ([life bar](../../../../../docs/design/gameplay.md#life-bar)). A question that takes several
 * ambushes, such as the rows of a `match`, is one point: it scores once all of them are right,
 * and its first miss takes its whole share of the life bar, the misses after that nothing.
 */
export function scoreAnswer(game: RunGame, at: QuestionRef, outcome: Outcome): void {
	const state = snapshot<QuizState & QuizActions>(game.quiz)
	const { quiz, records } = state
	if (quiz === undefined) return

	// This time the question is asked: in endless it comes round again, and counts again.
	const last = records.length - 1
	const own = refsOfAsk(state, last)
	const start = askStarts(state).findLast((each) => each <= last) ?? 0
	const point = pointOf(quiz, at)
	const answered = records.slice(start).filter((record) => pointOf(quiz, record.at) === point)
	const missedBefore = answered.slice(0, -1).some((record) => record.outcome !== 'correct')
	if (missedBefore) return

	if (outcome !== 'correct') {
		game.score.value.addMiss()
		game.life.value.hit(missShare(game))
		return
	}
	const parts = own.filter((ref) => pointOf(quiz, ref) === point).length
	if (answered.length === parts) game.score.value.addCorrect()
}

/** Whether the run is over: the bar is empty, or every question has been answered. Endless only ends with a fall. */
export function runIsOver(game: RunGame): boolean {
	const { answered, refs } = game.quiz.value
	return game.life.value.empty() || (!isEndless(game) && answered >= refs.length)
}

/**
 * Keeps what the run leaves behind, the moment its last answer is in: the misses for "practise
 * mistakes" and how far it got on its stage either way, and the high score and the next stage
 * unlocked when it passed. Saved then rather than when the run
 * ends after the hold, so pausing or closing the app during the last strike or hit loses nothing.
 * The time is the run's time when it ends: now, plus the hold that is left, which a pause doesn't
 * add to. The run's own clock goes by whole frames, so it may pass that by part of the frame that
 * ends the hold.
 */
export function recordRun(game: RunGame): void {
	const { quiz } = snapshot<QuizState & QuizActions>(game.quiz)
	if (quiz === undefined) return
	const fallen = game.life.value.empty()
	lastRun.value.save(quiz.id, quiz.version, game.quiz.value.misses())
	const { points, correct, answered } = game.score.value
	const seconds = game.run.value.elapsed + game.run.value.recovery
	const { difficulty } = game.run.value
	if (isEndless(game)) {
		// Endless ends with a fall, so it counts all the same: how far it went is the score.
		const newBest = highScores.value.submit(quiz.id, quiz.version, { points, seconds, correct, answered, difficulty }, true)
		game.score.value.settle(newBest, undefined)
		return
	}
	// The stage can't change during a run: the fight setup is the only place it is chosen.
	const { stage } = selection.value
	const next = stageAfter(stage)
	const unlocks = !fallen && next !== undefined && !stageResults.value.unlocked(quiz.id, quiz.version, next)
	stageResults.value.submit(quiz.id, quiz.version, stage, { distance: stageDistanceOf(game.run.value), cleared: !fallen, ...(!fallen && difficulty === 'shogun' ? { shogun: true } : {}) })
	const newBest = !fallen && highScores.value.submit(quiz.id, quiz.version, { points, seconds, correct, answered, difficulty })
	game.score.value.settle(newBest, unlocks ? next : undefined)
}

/**
 * Ends the run once the last outcome has played out: finished when the quiz is done, fallen when
 * the bar is empty. What it leaves behind was kept by {@link recordRun} at the last answer.
 */
export function endRun(game: RunGame): void {
	const { phase } = game.run.value
	if (phase === 'finished' || phase === 'fallen') return

	if (game.life.value.empty()) {
		game.shogun.value.fall()
		game.run.value.fall()
		return
	}
	game.run.value.finish()
}

/**
 * Ticks the stores that go by time, once per frame while the run is not paused. `worldDelta` is
 * world time, slowed down during an ambush; `realDelta` is the player's time. `random` shuffles
 * the questions when endless goes round again; tests leave it out.
 */
export function tickRun(game: RunGame, worldDelta: number, realDelta: number, random?: Random): void {
	// A frame that ends the resume countdown is still part of the pause, for the ambush too.
	const counting = game.run.value.countdown > 0

	// The run first, so its clock has this frame in it when the last answer comes in.
	game.run.value.tick(cappedAtAmbush(game, worldDelta), realDelta)
	if (!counting) {
		tickAmbush(game, realDelta)
		tickOutcome(game, realDelta)
	}

	const { phase, recovery, distance, countdown } = game.run.value
	if (phase !== 'running' || recovery > 0 || countdown > 0) return

	// Once the strike or the hit has played out, the samurai is back on his feet, or the run ends after its last answer or a hit too many.
	if (game.shogun.value.pose !== 'run') {
		if (runIsOver(game)) {
			endRun(game)
			return
		}
		game.shogun.value.run()
		if (isEndless(game)) keepGoing(game, random)
	}
	if (game.quiz.value.current() !== undefined && distance >= ambushAt(questionsAsked(game)) - reached) {
		openAmbush(game, timeScales[game.run.value.difficulty])
	}
}

/** Distances this close to the ambush count as there: the path is a sum of fractions. */
const reached = 1e-9

/** The world time that gets the samurai to the next ambush at most, so a long frame never carries him past it. */
function cappedAtAmbush(game: RunGame, worldDelta: number): number {
	const { phase, recovery, distance } = game.run.value
	if (phase !== 'running' || recovery > 0 || game.quiz.value.current() === undefined) return worldDelta
	const left = Math.max(0, ambushAt(questionsAsked(game)) - distance)
	return Math.min(worldDelta, left / runConfig.pace)
}
