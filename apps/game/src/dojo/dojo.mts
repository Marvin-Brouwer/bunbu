import { component } from '@rooted/components'
import { href } from '@rooted/router'
import { Placeholder } from '../_shared/placeholder.mts'
import { PracticeRoute, StudyRoute } from './_routes.mts'

export const DojoMenu = component({
	name: 'dojo',
	onMount({ append, create }) {
		append(
			create(Placeholder, {
				title: '道場 · Dojo',
				note: 'The quiz picker and "only my mistakes" go here.',
				links: [
					{ label: 'Study', href: href.for(StudyRoute) },
					{ label: 'Practice', href: href.for(PracticeRoute) },
					{ label: 'Back', href: href.path('/') },
				],
			})
		)
	},
})
