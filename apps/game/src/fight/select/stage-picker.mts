/**
 * 2 · Stage: the five stages, one to choose ([2 Fight setup](../../../../../docs/design/screens.md#2-fight-setup)),
 * as a carousel of cards with a picture of each stage, and how far the player got on it with the
 * chosen quiz. A stage that is still locked on the chosen quiz
 * ([stages](../../../../../docs/design/gameplay.md#stages)) has a lock over its number and its
 * picture in ink-wash grey, and says which stage unlocks it. The stages without a world yet are
 * shown but can't be chosen.
 *
 * The pictures are in `public/stages/`, taken by `scripts/stage-pictures.mts`.
 */

import { component } from '@rooted/components'
import { ChoiceStamp } from '../../_shared/menu/choice-stamp.mts'
import { formatWhole } from '../../_shared/numbers.mts'
import { builtStages, selection, stageNames, stages, type Stage } from '../../_shared/state/selection.mts'
import { stageBefore, stageResults } from '../state/stage-results.mts'
import styles from './select.css'

/** Whether the stage is open on the chosen quiz. */
function unlocked(stage: Stage): boolean {
	const { quiz } = selection.value
	return quiz === undefined || stageResults.value.unlocked(quiz.id, quiz.version, stage)
}

/**
 * `Best 860 m`, or `Best 1,440 m · cleared`; nothing before the stage was run on this quiz.
 * `Clear Rice fields to unlock` while it is locked.
 */
function resultOf(stage: Stage): string | undefined {
	const before = stageBefore(stage)
	if (!unlocked(stage) && before !== undefined) return `Clear ${stageNames[before]} to unlock`
	const { quiz } = selection.value
	const result = quiz === undefined ? undefined : stageResults.value.of(quiz.id, quiz.version, stage)
	if (result === undefined) return undefined
	const best = `Best ${formatWhole(result.distance)} m`
	return result.cleared ? `${best} · cleared` : best
}

/** A stage chosen on another quiz may still be locked on this one: the furthest open one instead. */
export function keepChosenUnlocked(): void {
	if (!unlocked(selection.value.stage)) selection.value.chooseStage(stages.findLast(unlocked) ?? stages[0])
}

/** Scrolls the card of `input` to the middle of the carousel, its neighbours peeking in either side. */
function centre(input: Element, behavior: ScrollBehavior = 'smooth'): void {
	input.closest('label')?.scrollIntoView({ behavior, block: 'nearest', inline: 'center' })
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
		const show = () => replace(
			element('div', {
				classes: styles.stages,
				role: 'radiogroup',
				aria: {
					label: 'Stage',
				},
				children: stages.map((stage, index) => {
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
								checked: selection.value.stage === stage,
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
				}),
			})
		)
		showChosen(show())

		// Unlocking or locking from the dev tools changes the stages while they show.
		stageResults.on('change', signal, () => {
			keepChosenUnlocked()
			showChosen(show())
		})
	},
})
