import { defineConfig } from '@playwright/test'

// End-to-end tests in a real browser, against the dev server: `pnpm e2e`. The first time, install
// the browser with `pnpm --filter @bunbu/game exec playwright install chromium`.
const port = 5310
const ci = process.env.CI !== undefined

export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.spec.mts',
	forbidOnly: ci,
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
