import { href } from '@rooted/router'
import { placeholder } from '../placeholder.mts'
import { PracticeRoute, StudyRoute } from './_routes.mts'

export const DojoMenu = placeholder('bunbu-dojo', {
	title: '道場 · Dojo',
	note: 'The quiz picker and "only my mistakes" go here.',
	links: [
		{ label: 'Study', href: href.for(StudyRoute) },
		{ label: 'Practice', href: href.for(PracticeRoute) },
		{ label: 'Back', href: '/' },
	],
})
