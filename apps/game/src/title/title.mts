/**
 * 1 Title / menu ([screens.md](../../../../docs/design/screens.md#1-title--menu)), the router's
 * home at `/`.
 */

import { href } from '@rooted/router'
import { DojoRoute } from '../dojo/_routes.mts'
import { FightRoute } from '../fight/_routes.mts'
import { SettingsRoute } from '../settings/_routes.mts'
import { placeholder } from '../_shared/placeholder.mts'

export const Title = placeholder('title', {
	title: '文武 · Bunbu',
	note: 'Shogun Scholar',
	links: [
		{ label: 'Fight', href: href.for(FightRoute) },
		{ label: 'Dojo', href: href.for(DojoRoute) },
		{ label: 'Settings', href: href.for(SettingsRoute) },
	],
})

export const NotFound = placeholder('not-found', {
	title: 'Lost the path',
	note: 'There is nothing at this address.',
	links: [{ label: 'Back to the title', href: '/' }],
})
