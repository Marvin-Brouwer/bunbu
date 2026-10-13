/**
 * **Share** on a passed quiz, to dare a friend to beat the score: a picture of the top of the
 * results with the quiz's title ({@link scorePictureOf}), straight to the phone's share sheet.
 * Where the share sheet can't take a picture, the picture downloads instead.
 */

import { component } from '@rooted/components'
import { download } from '../../_shared/quiz/quiz-file.mts'
import { scorePictureOf, type ScorePicture } from './score-picture.mts'
import styles from './overlays.css'

export type ShareScoreButtonOptions = {
	/** Names the picture's file. */
	readonly quizId: string
	readonly picture: ScorePicture
}

/** Hands the picture to the share sheet, or downloads it where the share sheet can't take it. */
const share = async (picture: File, title: string): Promise<void> => {
	const shared = {
		files: [picture],
		title,
	}
	if (!('canShare' in navigator) || !navigator.canShare(shared)) {
		download(picture)
		return
	}
	try {
		await navigator.share(shared)
	} catch (error) {
		// Closing the share sheet isn't a failure.
		if (error instanceof DOMException && error.name === 'AbortError') return
		download(picture)
	}
}

export const ShareScoreButton = component<ShareScoreButtonOptions>({
	name: 'share-score-button',
	styles,
	onMount({ append, element, options }) {
		const button = element('button', {
			type: 'button',
			classes: styles.shareButton,
			textContent: 'Share',
			aria: {
				label: 'Share your score',
			},
			on: {
				async click() {
					button.disabled = true
					try {
						const picture = await scorePictureOf(options.picture, `${options.quizId}-score.png`, button)
						await share(picture, options.picture.quizTitle)
					} catch (error) {
						// The reason is for whoever fixes it, not for the player.
						console.error('[bunbu] the score could not be shared:', error)
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
