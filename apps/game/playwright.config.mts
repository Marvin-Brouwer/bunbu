import { defineConfig } from '@playwright/test'

// End-to-end tests in a real browser, against the dev server: `pnpm e2e`. The first time, install
// the browser with `pnpm --filter @bunbu/game exec playwright install chromium`.
const port = 5310
const ci = process.env.CI !== undefined

export default defineConfig({
	testDir: 'e2e',
	forbidOnly: ci,
	// The stage pictures after the rest: rendering them in software takes every core there is, and
	// the screens' own tests would run out of time beside them. The How to play video runs on its
	// own (.github/workflows/how-to-play-video.yml).
	projects: [
		{ name: 'screens', testMatch: '**/*.spec.mts', testIgnore: ['**/stage-pictures.spec.mts', '**/how-to-play-video.spec.mts'] },
		{ name: 'stage pictures', testMatch: '**/stage-pictures.spec.mts', dependencies: ['screens'] },
		{ name: 'how to play video', testMatch: '**/how-to-play-video.spec.mts' },
	],
	reporter: ci ? 'github' : 'list',
	use: {
		baseURL: `http://localhost:${port}/bunbu/`,
	},
	webServer: {
		// The stage pictures set up their runs through window.pictureSettings (src/fight/world/picture-settings.mts).
		command: `vite --port ${port} --strictPort`,
		env: { VITE_PICTURE_SETTINGS: 'on' },
		url: `http://localhost:${port}/bunbu/`,
		reuseExistingServer: !ci,
	},
})
