/**
 * "A new version is ready" on the title screen, with the button that reloads onto it
 * ([`@rooted/pwa`](https://github.com/Marvin-Brouwer/rooted/blob/main/docs/guide/pwa.md)). Only the
 * title has it, so an update is never taken in the middle of a run. It shows nothing until the
 * service worker has a new version waiting.
 *
 * Taking the update can take a moment, as the new version has to take over before the page
 * reloads, so the button says so and can't be pressed again meanwhile.
 */

import { component } from '@rooted/components'
import { applyUpdate } from '@rooted/pwa'
import { UpdateNotification } from '@rooted/pwa/components'
import styles from './title.css'

export const UpdateNotice = component({
	name: 'update-notice',
	styles,
	onMount({ append, create, element }) {
		const button = element('button', {
			type: 'button',
			classes: styles.panelButton,
			textContent: 'Update',
			on: {
				click() {
					button.disabled = true
					button.textContent = 'Updating…'
					void applyUpdate().then((updating) => {
						// Nothing was waiting after all: the button is back as it was.
						if (updating) return
						button.disabled = false
						button.textContent = 'Update'
					})
				},
			},
		})
		append(
			create(UpdateNotification, {
				children: element('div', {
					classes: [
						styles.panel,
						styles.update,
					],
					role: 'status',
					children: [
						element('span', {
							textContent: 'A new version of Bunbu is ready.',
						}),
						button,
					],
				}),
			})
		)
	},
})
