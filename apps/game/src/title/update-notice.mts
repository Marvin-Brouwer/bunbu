/**
 * "A new version is ready" on the title screen, with the button that reloads onto it
 * ([`@rooted/pwa`](https://github.com/Marvin-Brouwer/rooted/blob/main/docs/guide/pwa.md)). Only the
 * title has it, so an update is never taken in the middle of a run. It shows nothing until the
 * service worker has a new version waiting.
 */

import { component } from '@rooted/components'
import { ApplyUpdateButton, UpdateNotification } from '@rooted/pwa/components'
import styles from './title.css'

export const UpdateNotice = component({
	name: 'update-notice',
	styles,
	onMount({ append, create, element }) {
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
						create(ApplyUpdateButton, {
							label: 'Update',
							classes: styles.apply,
						}),
					],
				}),
			})
		)
	},
})
