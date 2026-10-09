/**
 * How to share a quiz by hand, for when the share sheet can't take the quiz file: send the file and
 * Bunbu itself, then the friend loads the file under Quizzes. Written as the way to share, not as
 * a failure, since the player doesn't care why.
 */

import { component } from '@rooted/components'
import { MenuButton } from '../_shared/menu/menu-button.mts'
import { ScrollSheet } from '../_shared/scroll/scroll-sheet.mts'
import styles from './title.css'

/** The quiz file to offer as a download, or why there is none. */
export type ShareFallbackReason =
	| { readonly file: File; readonly title: string }
	| { readonly problem: string }

export type ShareFallbackOptions = {
	readonly reason: ShareFallbackReason
	readonly close: () => void
}

const download = (file: File) => {
	const url = URL.createObjectURL(file)
	const link = document.createElement('a')
	link.href = url
	link.download = file.name
	link.click()
	// Revoked a moment later: Firefox and Safari can lose the download when it goes right away.
	setTimeout(() => {
		URL.revokeObjectURL(url)
	}, 0)
}

const appUrl = () => new URL(import.meta.env.BASE_URL, window.location.origin).href

/** Shares a link to the game, or copies it where there is no share sheet; says which it did. */
const shareApp = async (): Promise<string | undefined> => {
	const url = appUrl()
	if ('share' in navigator) {
		try {
			await navigator.share({
				title: 'Bunbu: Shogun Scholar',
				url,
			})
			return undefined
		} catch (error) {
			// Closing the share sheet isn't a failure.
			if (error instanceof DOMException && error.name === 'AbortError') return undefined
		}
	}
	try {
		await navigator.clipboard.writeText(url)
		return `Link copied: ${url}`
	} catch {
		return `Send them this link: ${url}`
	}
}

export const ShareFallback = component<ShareFallbackOptions>({
	name: 'share-fallback',
	styles,
	onMount({ append, create, element, options }) {
		const { reason } = options
		// The reason is for whoever fixes it, not for the player.
		if ('problem' in reason) console.error(`[bunbu] the quiz could not be shared: ${reason.problem}`)
		const status = element('p', {
			classes: styles.note,
			role: 'status',
		})
		const close = create(MenuButton, {
			label: 'Close',
			action: () => {
				dialog.close()
			},
		})
		const dialog = element('dialog', {
			classes: styles.shareDialog,
			aria: {
				label: 'Share',
			},
			on: {
				close: options.close,
			},
			children: create(ScrollSheet, {
				unroll: true,
				children: element('div', {
					classes: styles.shareBody,
					children: [
						element('h2', {
							classes: styles.shareTitle,
							textContent: 'Share this quiz',
						}),
						...'file' in reason
							? [
								element('p', {
									textContent: `To play ${reason.title}, a friend needs the quiz and Bunbu.`,
								}),
								element('ol', {
									classes: styles.shareSteps,
									children: [
										element('li', {
											textContent: 'Download the quiz and send it to them, in a chat or an email.',
										}),
										element('li', {
											textContent: 'Share Bunbu with them.',
										}),
										element('li', {
											textContent: 'They open Bunbu, go to Quizzes and load the file there.',
										}),
									],
								}),
							]
							: [
								element('p', {
									textContent: 'Something went wrong while packing this quiz. Try again in a moment.',
								}),
							],
						status,
					],
				}),
				footer: element('div', {
					classes: styles.shareActions,
					children: 'file' in reason
						? [
							create(MenuButton, {
								kind: 'primary',
								label: 'Download the quiz',
								note: reason.file.name,
								action: () => {
									download(reason.file)
								},
							}),
							create(MenuButton, {
								label: 'Share Bunbu',
								action: () => {
									void shareApp().then((said) => {
										status.textContent = said ?? ''
									})
								},
							}),
							close,
						]
						: close,
				}),
			}),
		})

		append(
			dialog
		)
		// Modal: the title stays behind the dimmed backdrop, and Escape closes it.
		dialog.showModal()
	},
})
