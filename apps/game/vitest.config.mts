import { defineConfig } from 'vitest/config'

// A config of its own, so tests don't pull in the PWA and adapter plugins from vite.config.mts.
// Stores and flows are plain TypeScript, so they need no DOM.
export default defineConfig({
	test: {
		include: ['src/**/*.test.mts', 'test/**/*.test.mts'],
	},
})
