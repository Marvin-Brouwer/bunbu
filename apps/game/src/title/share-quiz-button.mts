/**
 * Shares the chosen quiz as a `.bunbu` file
 * ([sharing](../../../../docs/design/data-format.md#sharing)): through the phone's share sheet
 * where it takes the file. Where it doesn't, a {@link ShareFallback} scroll offers the download.
 */

import { compress, fileExtension, mimeType, type BunbuData } from '@bunbu/data'
import { component } from '@rooted/components'
import { snapshot } from '../_shared/state/store.mts'
import { library, type LibraryActions, type LibraryState } from '../_shared/storage/library.mts'
import { ShareFallback, type ShareFallbackReason } from './share-fallback.mts'
import styles from './title.css'

export type ShareQuizButtonOptions = {
	readonly quiz: BunbuData
}

/** Hands the quiz to the share sheet, or says what to offer instead. */
const share = async (quiz: BunbuData): Promise<ShareFallbackReason | undefined> => {
	// The file the library keeps, or packed now for a quiz it doesn't have, such as the dev fixture.
	// A copy on its own ArrayBuffer, which is what a File takes.
	const kept = snapshot<LibraryState & LibraryActions>(library).entries.find((entry) => entry.quiz.id === quiz.id && entry.quiz.version === quiz.version)
	const bytes = new Uint8Array(kept?.file.value ?? await compress(quiz))
	const file = new File([bytes], `${quiz.id}${fileExtension}`, {
		type: mimeType,
	})
	const shared = {
		files: [file],
		title: quiz.title,
	}
	const byHand = {
		file,
		title: quiz.title,
	}
	// Not every browser can share files, and not every share sheet takes a type it doesn't know.
	if (!('canShare' in navigator) || !navigator.canShare(shared)) return byHand
	try {
		await navigator.share(shared)
		return undefined
	} catch (error) {
		// Closing the share sheet isn't a failure.
		if (error instanceof DOMException && error.name === 'AbortError') return undefined
		return byHand
	}
}

const problemOf = (error: unknown): ShareFallbackReason => ({
	problem: error instanceof Error ? error.message : String(error),
})

export const ShareQuizButton = component<ShareQuizButtonOptions>({
	name: 'share-quiz-button',
	styles,
	onMount({ append, create, element, options }) {
		const button = element('button', {
			type: 'button',
			classes: styles.panelButton,
			textContent: 'Share',
			aria: {
				label: `Share ${options.quiz.title}`,
			},
			on: {
				async click() {
					// Compressing a large quiz takes a moment; one file per press.
					button.disabled = true
					const reason = await share(options.quiz).catch(problemOf)
					button.disabled = false
					if (reason === undefined) return
					const scroll: Element = create(ShareFallback, {
						reason,
						close: () => {
							scroll.remove()
						},
					})
					append(
						scroll
					)
				},
			},
		})

		append(
			button
		)
	},
})
