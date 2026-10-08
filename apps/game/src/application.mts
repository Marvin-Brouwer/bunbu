import { component } from '@rooted/components'
import { application } from '@rooted/components/application'
import { router } from '@rooted/router/application'

import { appRoutes } from './_routes.g.mts'
import { Shell } from './ui/shell/shell.mts'
import { NotFound, Title } from './ui/title/title.mts'

// Every `_routes.mts` under src/ is collected into `_routes.g.mts` at build time, so each screen
// registers its own routes and no track has to edit this file to add one.
const Router = router({
	home: Title,
	notFound: NotFound,
	...appRoutes,
})

export const Application = component({
	name: 'bunbu-application',
	onMount({ append, create }) {
		append(
			create(Shell, {
				router: Router
			})
		)
	},
})

application(Application)
