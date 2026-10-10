import { rootedManifest } from '@rooted/application'
import { githubPagesAdapter } from '@rooted-adapters/github-pages'
import { rootedMarkdown } from '@rooted/markdown/vite'
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
	// The service worker only precaches scripts, styles and pages; the bundled brush font is kept the
	// first time it loads, so it is there offline after that.
	runtimeCaching: [
		{
			urlPattern: ({ request }) => request.destination === 'font',
			handler: 'CacheFirst',
			options: {
				cacheName: 'fonts',
			},
		},
	],
	codeSplitting: {
		groups: [
			// three.js changes far less often than the game, so it keeps its own cached chunk.
			{ name: 'vendor/three', test: /[\\/]node_modules[\\/]three[\\/]/ },
		],
	},
	plugins: [
		// The game's own pages (how to play, credits) are Markdown, rendered to HTML at build time.
		// Quiz Markdown arrives at runtime and goes through _shared/markdown/render.mts instead.
		rootedMarkdown(),
		// Collects every `_routes.mts` under src/ into `_routes.g.mts`, so each screen registers its own routes.
		generateRouteManifest({
			glob: './src/**/_routes.mts',
			routeManifestPath: './src/_routes.g.mts',
		}),
		// Finds the static routes through the manifest and writes an index.html for each.
		githubPagesAdapter(),
	],
})
