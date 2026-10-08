import { rootedManifest } from '@rooted/application'
import { githubPagesAdapter } from '@rooted-adapters/github-pages'

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
		// No router yet, so tell the adapter about the root page manually
		githubPagesAdapter({ routes: ['/'] }),
	],
})
