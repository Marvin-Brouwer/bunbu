import { component } from '@rooted/components'
import { application } from '@rooted/components/application'

import { applyFixtureFromUrl } from './fixtures/index.mts'
import { Layers } from './ui/layers.mts'

export const Application = component({
	name: 'bunbu-application',
	onMount({ append, create }) {
		// A fixture sets the stores up before the screens read them (dev builds only).
		applyFixtureFromUrl(window.location.search)
		append(create(Layers))
	},
})

application(Application)
