/**
 * **Share** on a passed quiz, to dare a friend to beat the score: the score as a message with a
 * link to Bunbu, and the quiz file with it, so the friend can play the same quiz. Through the
 * phone's share sheet where it takes the file; where it doesn't, a scroll offers the message to
 * copy and the quiz to download.
 */

import type { BunbuData } from '@bunbu/data'
import { component } from '@rooted/components'
import { appLink } from '../../_shared/app-link.mts'
import { MenuButton } from '../../_shared/menu/menu-button.mts'
import { formatWhole } from '../../_shared/numbers.mts'
import { download, quizFileOf } from '../../_shared/quiz/quiz-file.mts'
import { ScrollDialog } from '../../_shared/scroll/scroll-dialog.mts'
import styles from './overlays.css'

export type ShareScoreButtonOptions = {
	readonly quiz: BunbuData
	readonly points: number
	readonly correct: number
	readonly total: number
	/** The names of the stage and the difficulty the run was played at. */
	readonly stage: string
	readonly difficulty: string
}

/** The message that goes with the quiz, in the player's own words. */
const messageOf = (options: ShareScoreButtonOptions): string =>
	`I passed ${options.quiz.title} with ${formatWhole(options.points)} points `
	+ `(${options.correct} / ${options.total} correct) on ${options.stage} as ${options.difficulty}. `
	+ `Can you beat that? Play it in Bunbu: Shogun Scholar: ${appLink()}`

/** Hands the score and the quiz to the share sheet; returns the quiz file when it can't. */
const share = async (quiz: BunbuData, message: string): Promise<File | undefined> => {
	const file = await quizFileOf(quiz)
	const shared = {
		files: [file],
		title: quiz.title,
		text: message,
	}
	// Not every browser can share files, and not every share sheet takes a type it doesn't know.
	if (!('canShare' in navigator) || !navigator.canShare(shared)) return file
	try {
		await navigator.share(shared)
		return undefined
	} catch (error) {
		// Closing the share sheet isn't a failure.
		if (error instanceof DOMException && error.name === 'AbortError') return undefined
		return file
	}
}

/** Copies the message, and says whether it did. */
const copy = async (message: string): Promise<string> => {
	try {
		await navigator.clipboard.writeText(message)
		return 'Message copied.'
	} catch {
		return 'Select the message above and copy it.'
	}
}

export const ShareScoreButton = component<ShareScoreButtonOptions>({
	name: 'share-score-button',
	styles,
	onMount({ append, create, element, options }) {
		const message = messageOf(options)

		/** How to share by hand: the message to copy, and the quiz, when there is a file to give. */
		const byHand = (file: File | undefined) => {
			const status = element('p', {
				role: 'status',
			})
			const scroll: Element = create(ScrollDialog, {
				title: 'Share your score',
				closed: () => {
					scroll.remove()
				},
				children: file === undefined
					? element('p', {
						textContent: 'Something went wrong while packing this quiz. Try again in a moment.',
					})
					: [
						element('p', {
							textContent: 'Send a friend this message and the quiz, in a chat or an email. They load the quiz under Quizzes and try to beat you.',
						}),
						element('blockquote', {
							classes: styles.shareMessage,
							textContent: message,
						}),
						status,
					],
				footer: (close) => [
					...file === undefined
						? []
						: [
							create(MenuButton, {
								kind: 'primary',
								label: 'Copy the message',
								action: () => {
									void copy(message).then((said) => {
										status.textContent = said
									})
								},
							}),
							create(MenuButton, {
								label: 'Download the quiz',
								note: file.name,
								action: () => {
									download(file)
								},
							}),
						],
					create(MenuButton, {
						label: 'Close',
						action: close,
					}),
				],
			})
			append(
				scroll
			)
		}

		const button = element('button', {
			type: 'button',
			classes: styles.shareButton,
			textContent: 'Share',
			aria: {
				label: 'Share your score',
			},
			on: {
				async click() {
					// Compressing a large quiz takes a moment; one share per press.
					button.disabled = true
					const file = await share(options.quiz, message).catch((error: unknown) => {
						// The reason is for whoever fixes it, not for the player.
						console.error('[bunbu] the score could not be shared:', error)
						return 'failed' as const
					})
					button.disabled = false
					if (file === undefined) return
					byHand(file === 'failed' ? undefined : file)
				},
			},
		})

		append(
			button
		)
	},
})
