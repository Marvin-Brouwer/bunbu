import { rootedManifest } from '@rooted/application'
import { githubPagesAdapter } from '@rooted-adapters/github-pages'
import { generateRouteManifest } from '@rooted/router/manifest'

import packageJson from './package.json' with { type: 'json' }

export default rootedManifest({
	webManifest: {
		id: 'bunbu-game',
		url: packageJson.homepage,
		name: 'Bunbu',
		short_name: 'Bunbu',
		theme_color: '#ffffff',
		background_color: '#ffffff',
		display: 'standalone',
	},
	plugins: [
		// Collects every `_routes.mts` under src/ into `_routes.g.mts`, so each screen registers its own routes.
		generateRouteManifest({
			glob: './src/**/_routes.mts',
			routeManifestPath: './src/_routes.g.mts',
		}),
		// Finds the static routes through the manifest and writes an index.html for each.
		githubPagesAdapter(),
	],
})
