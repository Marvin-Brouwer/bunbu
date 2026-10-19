import { defineConfig } from '@playwright/test'

// End-to-end tests in a real browser, against the dev server: `pnpm e2e`. The first time, install
// the browser with `pnpm --filter @bunbu/game exec playwright install chromium`.
const port = 5310
const ci = process.env.CI !== undefined

export default defineConfig({
	testDir: 'e2e',
	forbidOnly: ci,
	// The stage pictures after the rest: rendering them in software takes every core there is, and
	// the screens' own tests would run out of time beside them.
	projects: [
		{ name: 'screens', testMatch: '**/*.spec.mts', testIgnore: ['**/stage-pictures.spec.mts', '**/how-to-play.spec.mts'] },
		{ name: 'stage pictures', testMatch: '**/stage-pictures.spec.mts', dependencies: ['screens'] },
		// The video guide plays a whole run in real time: after the stage pictures, on its own.
		{ name: 'video guide', testMatch: '**/how-to-play.spec.mts', dependencies: ['stage pictures'] },
	],
	reporter: ci ? 'github' : 'list',
	use: {
		baseURL: `http://localhost:${port}/bunbu/`,
	},
	webServer: {
		command: `vite --port ${port} --strictPort`,
		url: `http://localhost:${port}/bunbu/`,
		reuseExistingServer: !ci,
	},
})
