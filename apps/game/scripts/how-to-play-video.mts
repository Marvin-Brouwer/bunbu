/**
 * Records the video guide on How to play (`public/guide/how-to-play.webm`, with a still of it as
 * its poster): the run of [its story](./how-to-play-story.mts), the running between the ambushes
 * left out. Then it takes the stills `e2e/how-to-play.spec.mts` checks it by (#138).
 *
 * Start the dev server (`pnpm dev`), then: `pnpm --filter @bunbu/game how-to-play-video`. Record it
 * again when the game looks different: CI fails until it is. It needs:
 * - a GPU for a smooth picture: it asks Chromium for Metal (a Mac); elsewhere set `BUNBU_GL` to the
 *   ANGLE back end to use (`vulkan`, `d3d11`, …);
 * - Playwright's ffmpeg, which comes with its browsers (`playwright install chromium`), to encode it.
 */

import { chromium, type CDPSession, type Page } from '@playwright/test'
import { spawn } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { homedir, platform } from 'node:os'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { guideSize, setUpGuide, tellGuide } from './how-to-play-story.mts'

const base = process.env.BUNBU_URL ?? 'http://localhost:5173/bunbu/'
const size = guideSize
const out = new URL('../public/guide/', import.meta.url)
/** Frames per second of the video, and its bit rate: small enough for a page. */
const fps = 25
const bitRate = '450k'

/** A frame of the screen, as a JPEG, and when it was drawn in seconds. */
type Frame = { readonly jpeg: Buffer; readonly time: number }

/**
 * Films `page` through the browser's screencast, but only between `start()` and `stop()`: each
 * stretch is a shot of the video, and the time in between is left out.
 */
async function camera(page: Page) {
	const session: CDPSession = await page.context().newCDPSession(page)
	const shots: Frame[][] = []
	let shot: Frame[] | undefined
	session.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
		shot?.push({ jpeg: Buffer.from(data, 'base64'), time: metadata.timestamp ?? Date.now() / 1000 })
		void session.send('Page.screencastFrameAck', { sessionId })
	})
	return {
		shots,
		async start() {
			shot = []
			shots.push(shot)
			await session.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: size.width, maxHeight: size.height })
		},
		async stop() {
			await session.send('Page.stopScreencast')
			shot = undefined
		},
	}
}

/** Where Playwright keeps its browsers: `0` is its own package's folder, for a hermetic install. */
function browsersFolder(): string {
	const set = process.env.PLAYWRIGHT_BROWSERS_PATH
	if (set === '0') {
		// playwright-core comes in through @playwright/test and playwright, so it is found through them.
		const core = ['@playwright/test', 'playwright', 'playwright-core']
			.reduce((from, name) => createRequire(from).resolve(`${name}/package.json`), fileURLToPath(import.meta.url))
		return join(dirname(core), '.local-browsers')
	}
	if (set !== undefined) return set
	// Playwright's own cache, under the folders the system says caches go in.
	if (platform() === 'darwin') return join(homedir(), 'Library/Caches/ms-playwright')
	if (platform() === 'win32') return join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData/Local'), 'ms-playwright')
	return join(process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), 'ms-playwright')
}

/** Playwright's own ffmpeg, which it installs with its browsers. */
function ffmpeg(): string {
	const browsers = browsersFolder()
	const folder = readdirSync(browsers).filter((name) => name.startsWith('ffmpeg-')).toSorted().at(-1)
	if (folder === undefined) throw new Error(`no ffmpeg in ${browsers}: run \`playwright install chromium\``)
	const binary = platform() === 'darwin' ? 'ffmpeg-mac' : platform() === 'win32' ? 'ffmpeg-win64.exe' : 'ffmpeg-linux'
	return join(browsers, folder, binary)
}

/** Encodes the `shots` one after another as a VP9 WebM at `fps`, each frame held until the next. */
async function encode(shots: readonly (readonly Frame[])[], file: string): Promise<void> {
	const encoder = spawn(ffmpeg(), [
		'-loglevel', 'error', '-y',
		'-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', 'pipe:0',
		'-c:v', 'libvpx-vp9', '-b:v', bitRate, '-deadline', 'good', '-pix_fmt', 'yuv420p', file,
	], { stdio: ['pipe', 'inherit', 'inherit'] })
	const done = new Promise<void>((resolve, reject) => {
		encoder.on('error', reject)
		encoder.on('close', (code) => { if (code === 0) resolve(); else reject(new Error(`ffmpeg stopped with ${String(code)}`)) })
	})
	for (const shot of shots) {
		const [first] = shot
		const last = shot.at(-1)
		if (first === undefined || last === undefined) continue
		let next = 0
		for (let time = first.time; time <= last.time; time += 1 / fps) {
			while (next + 1 < shot.length && (shot[next + 1]?.time ?? Infinity) <= time) next++
			const frame = shot[next]
			// The frames go in one after another, each waiting for room in the pipe.
			// oxlint-disable-next-line no-await-in-loop
			if (frame !== undefined && !encoder.stdin.write(frame.jpeg)) await new Promise((resolve) => encoder.stdin.once('drain', resolve))
		}
	}
	encoder.stdin.end()
	await done
}

await mkdir(out, { recursive: true })
const browser = await chromium.launch({ args: [`--use-angle=${process.env.BUNBU_GL ?? 'metal'}`, '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: size })

await setUpGuide(page, base)
const film = await camera(page)
await tellGuide(page, {
	start: () => film.start(),
	stop: () => film.stop(),
	async still(name) {
		// The poster: the answers of the first question, before they are swiped.
		if (name === '05-answers-1') await page.screenshot({ path: fileURLToPath(new URL('how-to-play.jpg', out)), type: 'jpeg', quality: 75 })
	},
})
await browser.close()

await encode(film.shots, fileURLToPath(new URL('how-to-play.webm', out)))
const seconds = film.shots.reduce((sum, shot) => sum + ((shot.at(-1)?.time ?? 0) - (shot[0]?.time ?? 0)), 0)
console.log(`guide/how-to-play.webm (${seconds.toFixed(1)} s in ${String(film.shots.length)} shots), guide/how-to-play.jpg`)

// The stills CI checks the video by, taken the way the check takes them.
await new Promise<void>((resolve, reject) => {
	const stills = spawn('playwright', ['test', '--project', 'video guide', '--no-deps'], {
		cwd: fileURLToPath(new URL('..', import.meta.url)),
		env: { ...process.env, UPDATE_GUIDE_STILLS: '1' },
		stdio: 'inherit',
		shell: platform() === 'win32',
	})
	stills.on('error', reject)
	stills.on('close', (code) => { if (code === 0) resolve(); else reject(new Error(`the stills stopped with ${String(code)}`)) })
})
console.log('e2e/how-to-play/*.jpg')
