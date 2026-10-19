/**
 * Films the video guide on How to play (`e2e/how-to-play-video.spec.mts`) in Playwright's Docker
 * image, the one the weekly workflow checks it in: the game's text is in the device's own fonts, so
 * only a video filmed with that image's fonts and browser matches. Needs Docker; run it from
 * anywhere with `pnpm --filter @bunbu/game how-to-play-video`, then commit `public/guide/how-to-play.*`
 * and the stills. Optional: the workflow opens a pull request with them once a week otherwise.
 *
 * The repository is mounted as it is, with the image's own `node_modules` over the host's, which
 * may be built for another system; the pnpm store is kept in a volume between runs.
 */

import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const repository = fileURLToPath(new URL('../../../', import.meta.url))
const { version } = createRequire(import.meta.url)('@playwright/test/package.json') as { version: string }
const image = `mcr.microsoft.com/playwright:v${version}-noble`
const nodeModules = ['node_modules', 'apps/game/node_modules', 'packages/data/node_modules', 'assets/node_modules']

const film = [
	'corepack enable',
	'pnpm install --frozen-lockfile --store-dir /pnpm-store',
	'cd apps/game',
	'UPDATE_HOW_TO_PLAY_VIDEO=1 pnpm exec playwright test --project "how to play video" --no-deps',
].join(' && ')

const docker = spawn('docker', [
	'run', '--rm', '--ipc=host',
	'--volume', `${repository}:/work`,
	// Empty, rather than copies of the host's.
	...nodeModules.flatMap((folder) => ['--mount', `type=volume,destination=/work/${folder},volume-nocopy`]),
	'--volume', 'bunbu-pnpm-store:/pnpm-store',
	'--workdir', '/work',
	image, 'bash', '-c', film,
], { stdio: 'inherit' })
docker.on('close', (code) => { process.exitCode = code ?? 1 })
