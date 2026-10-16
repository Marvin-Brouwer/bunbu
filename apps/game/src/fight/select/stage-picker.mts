/**
 * 2 · Stage: the five stages, one to choose ([2 Fight setup](../../../../../docs/design/screens.md#2-fight-setup)),
 * as a carousel of cards with a picture of each stage, and how far the player got on it with the
 * chosen quiz. A stage that is still locked on the chosen quiz
 * ([stages](../../../../../docs/design/gameplay.md#stages)) has a lock over its number and its
 * picture in ink-wash grey, and says which stage unlocks it. The stages without a world yet are
 * shown but can't be chosen.
 *
 * The pictures are in `public/stages/`, taken, and checked in CI, by `e2e/stage-pictures.spec.mts`.
 *
 * A stage cleared as Shogun on the chosen quiz has a Shogun seal on its picture, so the player sees
 * which are still to clear for endless.
 *
 * After the stages, endless ([endless](../../../../../docs/design/gameplay.md#endless)): locked
 * until every stage has been cleared on Shogun with the chosen quiz.
 */

import { component } from '@rooted/components'
import { ChoiceStamp } from '../../_shared/menu/choice-stamp.mts'
import { formatWhole } from '../../_shared/numbers.mts'
import { builtStages, selection, stageNames, stages, type Stage } from '../../_shared/state/selection.mts'
import { highScores } from '../state/highscores.mts'
import { stageBefore, stageResults } from '../state/stage-results.mts'
import styles from './select.css'

/** Whether the stage is open on the chosen quiz. */
function unlocked(stage: Stage): boolean {
	const { quiz } = selection.value
	return quiz === undefined || stageResults.value.unlocked(quiz.id, quiz.version, stage)
}

/**
 * `Best 860 m`, or `Best 1,440 m · cleared`; `Not run yet` before the stage was run on this quiz.
 * `Clear Rice fields as Samurai to unlock` while it is locked: Apprentice unlocks no stages.
 */
function resultOf(stage: Stage): string | undefined {
	const before = stageBefore(stage)
	if (!unlocked(stage) && before !== undefined) return `Clear ${stageNames[before]} as Samurai to unlock`
	const { quiz } = selection.value
	const result = quiz === undefined ? undefined : stageResults.value.of(quiz.id, quiz.version, stage)
	if (result === undefined) return quiz === undefined ? undefined : 'Not run yet'
	const best = `Best ${formatWhole(result.distance)} m`
	return result.cleared ? `${best} · cleared` : best
}

/** Whether the stage has been cleared as Shogun on the chosen quiz. */
function clearedAsShogun(stage: Stage): boolean {
	const { quiz } = selection.value
	return quiz !== undefined && stageResults.value.of(quiz.id, quiz.version, stage)?.shogun === true
}

/** Whether endless is open on the chosen quiz. */
function endlessUnlocked(): boolean {
	const { quiz } = selection.value
	return quiz !== undefined && stageResults.value.endlessUnlocked(quiz.id, quiz.version)
}

/** `Best 1,200`: endless's high score on the chosen quiz, or how to open it while it is locked. */
function endlessResultOf(): string | undefined {
	if (!endlessUnlocked()) return 'Clear every stage as Shogun to unlock'
	const { quiz } = selection.value
	const best = quiz === undefined ? undefined : highScores.value.of(quiz.id, quiz.version, true)
	return best === undefined ? undefined : `Best ${formatWhole(best.points)}`
}

/**
 * A stage chosen on another quiz may still be locked on this one: the furthest open one instead.
 * Endless too: then the stage that was chosen before it, or the furthest open one.
 */
export function keepChosenUnlocked(): void {
	if (selection.value.endless && !endlessUnlocked()) selection.value.chooseStage(selection.value.stage)
	if (!unlocked(selection.value.stage)) selection.value.chooseStage(stages.findLast(unlocked) ?? stages[0])
}

/** Scrolls the card of `input` to the middle of the carousel, its neighbours peeking in either side. */
function centre(input: Element, behavior: ScrollBehavior = 'smooth'): void {
	input.closest('label')?.scrollIntoView({ behavior, block: 'nearest', inline: 'center' })
}

/** How far the middle of `card` is from `middle`, across the screen. */
function offMiddle(card: Element, middle: number): number {
	const box = card.getBoundingClientRect()
	return Math.abs(box.left + box.width / 2 - middle)
}

/**
 * Lets a mouse drag the carousel sideways, as a finger swipes it; when it lets go the nearest card
 * comes to the middle. A drag ends on a card, which it doesn't choose.
 */
function draggable(carousel: HTMLElement): void {
	let from: { x: number; left: number; pointer: number } | undefined
	let dragged = false
	carousel.addEventListener('pointerdown', (event) => {
		if (event.pointerType !== 'mouse' || event.button !== 0) return
		from = { x: event.clientX, left: carousel.scrollLeft, pointer: event.pointerId }
		dragged = false
	})
	carousel.addEventListener('pointermove', (event) => {
		if (from?.pointer !== event.pointerId) return
		const moved = event.clientX - from.x
		if (!dragged && Math.abs(moved) < 6) return
		if (!dragged) {
			dragged = true
			carousel.setPointerCapture(from.pointer)
			carousel.dataset.dragging = 'true'
		}
		carousel.scrollLeft = from.left - moved
	})
	const letGo = () => {
		if (from === undefined) return
		from = undefined
		if (!dragged) return
		delete carousel.dataset.dragging
		// The card nearest the middle, to the middle.
		const middle = carousel.getBoundingClientRect().left + carousel.clientWidth / 2
		const cards = [...carousel.querySelectorAll('label')]
		const nearest = cards.toSorted((one, other) => offMiddle(one, middle) - offMiddle(other, middle))[0]
		nearest?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
	}
	carousel.addEventListener('pointerup', letGo)
	carousel.addEventListener('pointercancel', letGo)
	carousel.addEventListener('click', (event) => {
		if (!dragged) return
		event.preventDefault()
		event.stopPropagation()
		dragged = false
	}, { capture: true })
}

/** The chosen card of `carousel` in the middle, at once: as it was left. */
function showChosen(carousel: HTMLElement): void {
	const chosen = carousel.querySelector('input:checked')
	if (chosen !== null) requestAnimationFrame(() => { centre(chosen, 'instant') })
}

export const StagePicker = component({
	name: 'stage-picker',
	styles,
	onMount({ create, element, replace, signal }) {
		const endlessChoice = () => {
			const locked = !endlessUnlocked()
			const result = endlessResultOf()
			return element('label', {
				classes: styles.stage,
				'data-locked': String(locked),
				children: [
					element('input', {
						type: 'radio',
						name: 'stage',
						value: 'endless',
						checked: selection.value.endless,
						disabled: locked,
						on: {
							change(event) {
								selection.value.chooseEndless()
								centre(event.currentTarget)
							},
						},
					}),
					// Every stage in turn: a slanted slice of each one's picture.
					element('span', {
						classes: [
							styles.stagePicture,
							styles.endlessPicture,
						],
						aria: {
							hidden: 'true',
						},
						children: stages.map((stage) => element('img', {
							src: `${import.meta.env.BASE_URL}stages/${stage}.jpg`,
							alt: '',
							loading: 'lazy',
							decoding: 'async',
							draggable: false,
						})),
					}),
					create(ChoiceStamp),
					element('span', {
						classes: styles.stageText,
						children: [
							element('span', {
								children: [
									element('span', {
										classes: styles.stageNumber,
										children: [
											element('span', {
												classes: styles.stageDigit,
												children: [
													'∞',
													locked
														? element('span', {
															classes: styles.stageLock,
															aria: {
																hidden: 'true',
															},
														})
														: undefined,
												],
											}),
											' · ',
										],
									}),
									'Endless',
								],
							}),
							result === undefined
								? undefined
								: element('span', {
									classes: styles.stageResult,
									textContent: result,
								}),
						],
					}),
				],
			})
		}

		const show = () => replace(
			element('div', {
				classes: styles.stages,
				role: 'radiogroup',
				aria: {
					label: 'Stage',
				},
				children: [...stages.map((stage, index) => {
					const result = resultOf(stage)
					const locked = !unlocked(stage)
					return element('label', {
						classes: styles.stage,
						'data-locked': String(locked),
						children: [
							element('input', {
								type: 'radio',
								name: 'stage',
								value: stage,
								checked: !selection.value.endless && selection.value.stage === stage,
								disabled: locked || !builtStages.has(stage),
								on: {
									change(event) {
										selection.value.chooseStage(stage)
										centre(event.currentTarget)
									},
								},
							}),
							element('img', {
								classes: styles.stagePicture,
								src: `${import.meta.env.BASE_URL}stages/${stage}.jpg`,
								alt: '',
								loading: 'lazy',
								decoding: 'async',
								// Dragged, the carousel moves rather than the picture.
								draggable: false,
							}),
							create(ChoiceStamp),
							clearedAsShogun(stage)
								? element('span', {
									classes: styles.stageMedal,
									lang: 'ja',
									textContent: '将',
									role: 'img',
									title: 'Cleared as Shogun',
									aria: {
										label: 'Cleared as Shogun',
									},
								})
								: undefined,
							element('span', {
								classes: styles.stageText,
								children: [
									element('span', {
										children: [
											element('span', {
												classes: styles.stageNumber,
												children: [
													element('span', {
														classes: styles.stageDigit,
														children: [
															`${index + 1}`,
															locked
																? element('span', {
																	classes: styles.stageLock,
																	aria: {
																		hidden: 'true',
																	},
																})
																: undefined,
														],
													}),
													' · ',
												],
											}),
											stageNames[stage],
										],
									}),
									result === undefined
										? undefined
										: element('span', {
											classes: styles.stageResult,
											textContent: result,
										}),
								],
							}),
							builtStages.has(stage)
								? undefined
								: element('span', {
									classes: styles.stageSoon,
									textContent: 'soon',
								}),
						],
					})
				}), endlessChoice()],
			})
		)
		const showAll = () => {
			const carousel = show()
			draggable(carousel)
			showChosen(carousel)
		}
		showAll()

		// Unlocking or locking from the dev tools changes the stages while they show.
		stageResults.on('change', signal, () => {
			keepChosenUnlocked()
			showAll()
		})
	},
})
