import { component } from '@rooted/components'
import { href } from '@rooted/router'
import { Placeholder } from '../_shared/placeholder.mts'

export const Settings = component({
	name: 'settings',
	onMount({ append, create }) {
		append(
			create(Placeholder, {
				title: 'Settings',
				note: 'Difficulty, haptics and volume go here.',
				links: [{ label: 'Back', href: href.path('/') }],
			})
		)
	},
})
