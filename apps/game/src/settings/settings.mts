import { component } from '@rooted/components'
import { back, Placeholder } from '../_shared/placeholder.mts'

export const Settings = component({
	name: 'settings',
	onMount({ append, create }) {
		append(
			create(Placeholder, {
				title: 'Settings',
				note: 'Difficulty, haptics and volume go here.',
				links: [back],
			})
		)
	},
})
