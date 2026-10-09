/**
 * The scroll that opens when Share can't hand the quiz to the share sheet: download the `.bunbu`
 * file to send on by hand, share the app itself, or close. When no file could be made it says why.
 */

import { component } from '@rooted/components'
import { MenuButton } from '../_shared/menu/menu-button.mts'
import { ScrollSheet } from '../_shared/scroll/scroll-sheet.mts'
import styles from './title.css'

/** The file to offer as a download, or why there is none. */
export type ShareFallbackReason =
	| { readonly file: File }
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
	URL.revokeObjectURL(url)
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
							textContent: 'Share',
						}),
						'file' in reason
							? element('p', {
								textContent: `This device can't hand a quiz file to another app. Download ${reason.file.name} and send it on yourself, or share Bunbu so they can play it too.`,
							})
							: element('p', {
								textContent: `The quiz could not be made into a file: ${reason.problem}`,
							}),
						status,
					],
				}),
				footer: element('div', {
					classes: styles.shareActions,
					children: 'file' in reason
						? [
							create(MenuButton, {
								kind: 'primary',
								label: 'Download the .bunbu file',
								note: reason.file.name,
								action: () => {
									download(reason.file)
								},
							}),
							create(MenuButton, {
								label: 'Share this app',
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
