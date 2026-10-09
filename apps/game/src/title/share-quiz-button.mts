/**
 * Shares the chosen quiz as a `.bunbu` file
 * ([sharing](../../../../docs/design/data-format.md#sharing)): through the phone's share sheet
 * where it takes the file, and as a download everywhere else.
 */

import { compress, fileExtension, mimeType, type BunbuData } from '@bunbu/data'
import { component } from '@rooted/components'
import styles from './title.css'

export type ShareQuizButtonOptions = {
	readonly quiz: BunbuData
}

const download = (file: File) => {
	const url = URL.createObjectURL(file)
	const link = document.createElement('a')
	link.href = url
	link.download = file.name
	link.click()
	URL.revokeObjectURL(url)
}

const share = async (quiz: BunbuData) => {
	// A copy on its own ArrayBuffer, which is what a File takes.
	const bytes = new Uint8Array(await compress(quiz))
	const file = new File([bytes], `${quiz.id}${fileExtension}`, {
		type: mimeType,
	})
	const shared = {
		files: [file],
		title: quiz.title,
	}
	// Not every browser can share files, and not every share sheet takes a type it doesn't know.
	if (!('canShare' in navigator) || !navigator.canShare(shared)) {
		download(file)
		return
	}
	try {
		await navigator.share(shared)
	} catch (error) {
		// Closing the share sheet isn't a failure.
		if (error instanceof DOMException && error.name === 'AbortError') return
		download(file)
	}
}

export const ShareQuizButton = component<ShareQuizButtonOptions>({
	name: 'share-quiz-button',
	styles,
	onMount({ append, element, options }) {
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
					try {
						await share(options.quiz)
					} finally {
						button.disabled = false
					}
				},
			},
		})

		append(
			button
		)
	},
})
