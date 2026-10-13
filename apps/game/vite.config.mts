import { fileExtension, mimeType } from '@bunbu/data'
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
		// Opening a `.bunbu` file with the installed app (desktop Chrome and Edge) lands on the quizzes
		// screen, which loads it like a chosen file (src/quizzes/opened-quizzes.mts).
		file_handlers: [
			{
				action: 'quizzes/',
				accept: { [mimeType]: [fileExtension] },
			},
		],
		// Sharing a quiz file to the installed app (Android). A phone doesn't know what a `.bunbu` file
		// is, so it hands it over as any file; the quizzes screen turns away what isn't a quiz.
		share_target: {
			action: 'quizzes/shared',
			method: 'POST',
			enctype: 'multipart/form-data',
			params: {
				files: [
					{
						name: 'quiz',
						accept: [mimeType, fileExtension, 'application/octet-stream'],
					},
				],
			},
		},
	},
	// The shared file arrives as a POST to the action above, which a static site can't take: the
	// service worker keeps it (public/receive-shared-quizzes.js).
	workerScripts: ['receive-shared-quizzes.js'],
	// The service worker only precaches scripts, styles and pages; the bundled brush font and the 3D
	// models are kept the first time they load, so they are there offline after that.
	runtimeCaching: [
		{
			// A model keeps its name when it changes, so the kept copy is refreshed in the background.
			urlPattern: ({ url }) => url.pathname.endsWith('.glb'),
			handler: 'StaleWhileRevalidate',
			options: {
				cacheName: 'models',
			},
		},
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
