/**
 * **Share** on a passed quiz, to dare a friend to beat the score: a picture of the top of the
 * results with the quiz's title ({@link scorePictureOf}) and a line daring them to beat it, with the
 * link to Bunbu, straight to the phone's share sheet.
 * Where the share sheet can't take a picture, the picture downloads instead.
 */

import { component } from '@rooted/components'
import { appLink } from '../../_shared/app-link.mts'
import { download } from '../../_shared/quiz/quiz-file.mts'
import { scorePictureOf, type ScorePicture } from './score-picture.mts'
import styles from './overlays.css'

export type ShareScoreButtonOptions = {
	/** Names the picture's file. */
	readonly quizId: string
	readonly picture: ScorePicture
}

/** The words that go with the picture, for the apps that show text beside it. */
const messageOf = (picture: ScorePicture): string =>
	`I scored ${picture.points} on ${picture.quizTitle} in Bunbu: Shogun Scholar. Can you beat it?\n${appLink()}`

/** Hands the picture to the share sheet, or downloads it where the share sheet can't take it. */
const share = async (picture: File, score: ScorePicture): Promise<void> => {
	const shared = {
		files: [picture],
		title: score.quizTitle,
		text: messageOf(score),
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
			children: [
				element('span', {
					classes: styles.shareIcon,
				}),
				'Share',
			],
			aria: {
				label: 'Share your score',
			},
			on: {
				async click() {
					button.disabled = true
					try {
						const picture = await scorePictureOf(options.picture, `${options.quizId}-score.png`, button)
						await share(picture, options.picture)
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
