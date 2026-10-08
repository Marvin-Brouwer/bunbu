import { href } from '@rooted/router'
import { RunRoute } from '../run/_routes.mts'
import { placeholder } from '../placeholder.mts'

export const Select = placeholder('bunbu-select', {
	title: 'Choose your path',
	note: 'Quiz cards, Load .yaml, the five stages and Novice / Adept / Master go here.',
	links: [
		{ label: 'Start run', href: href.for(RunRoute) },
		{ label: 'Back', href: '/' },
	],
})
