/**
 * Records the video guide on How to play (`public/guide/how-to-play.webm`, with a still of it as
 * its poster): a run on the fixture quiz from the title to the results, every kind of question
 * answered by swiping as a player would, with captions saying what happens. The running between
 * the ambushes is left out.
 *
 * Start the dev server (`pnpm dev`), then: `pnpm --filter @bunbu/game how-to-play-video`. Record it
 * again when the game looks different. It needs:
 * - a GPU for a smooth picture: it asks Chromium for Metal (a Mac); elsewhere set `BUNBU_GL` to the
 *   ANGLE back end to use (`vulkan`, `d3d11`, …);
 * - Playwright's ffmpeg, which comes with its browsers (`playwright install chromium`), to encode it.
 */

// It plays the game as a player would, one step after another, so every await waits on the step before.
/* oxlint-disable no-await-in-loop */

import { chromium, type CDPSession, type Page } from '@playwright/test'
import { spawn } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'

const base = process.env.BUNBU_URL ?? 'http://localhost:5173/bunbu/'
const size = { width: 390, height: 844 }
const out = new URL('../public/guide/', import.meta.url)
/** Frames per second of the video, and its bit rate: small enough for a page. */
const fps = 25
const bitRate = '450k'

/** The right answers of the fixture quiz (`src/_temp/quiz.mts`), by the text of their options, in order. */
const right = [['yes'], ['alt'], ['GET', 'HEAD'], ['User-agent stylesheet', 'Author stylesheet', 'Inline style attribute']]

/** Where each mark points on the screen. */
const directions: Readonly<Record<string, readonly [number, number]>> = {
	up: [0, -1],
	'up-right': [0.7, -0.7],
	right: [1, 0],
	'down-right': [0.7, 0.7],
	down: [0, 1],
	'down-left': [-0.7, 0.7],
	left: [-1, 0],
	'up-left': [-0.7, -0.7],
}

const pause = (page: Page, seconds: number) => page.waitForTimeout(seconds * 1000)

/** Whether two answers are the same, whatever their case. */
const same = (one: string, other: string) => one.toLowerCase() === other.toLowerCase()

/** Shows `text` as a caption over the foot of the screen, or none. */
async function caption(page: Page, text: string | undefined): Promise<void> {
	await page.evaluate((line) => {
		let shown = document.getElementById('guide-caption')
		if (shown === null) {
			shown = document.createElement('div')
			shown.id = 'guide-caption'
			shown.style.cssText = [
				'position: fixed', 'left: 12px', 'right: 12px', 'bottom: 18px', 'z-index: 1000',
				'padding: 10px 14px', 'border-radius: 3px', 'background: rgb(31 28 24 / 88%)', 'color: #f2ead8',
				'font: 600 15px/1.35 system-ui, sans-serif', 'text-align: center', 'transition: opacity 0.3s',
				'pointer-events: none',
			].join(';')
			document.body.append(shown)
		}
		shown.textContent = line ?? ''
		shown.style.opacity = line === undefined ? '0' : '1'
	}, text)
}

/** A swipe on the answer paper toward `mark`, the way a thumb would. */
async function swipe(page: Page, mark: string): Promise<void> {
	// On the paper under the answers, where a thumb has room to swipe every way.
	const answers = await page.locator('[aria-label^="swipe "]').last().boundingBox()
	const [x, y] = directions[mark] ?? [0, -1]
	const from = { x: size.width / 2, y: Math.min(size.height - 260, (answers?.y ?? 300) + 150) }
	await page.mouse.move(from.x, from.y)
	await page.mouse.down()
	await page.mouse.move(from.x + x * 120, from.y + y * 120, { steps: 12 })
	await page.mouse.up()
}

/** Answers the open ambush right, and says how. Quickly: a yes or no gives the least time. */
async function answer(page: Page): Promise<void> {
	const options = await page.locator('[aria-label^="swipe "]').evaluateAll((marks) => marks.map((mark) => ({
		mark: (mark.getAttribute('aria-label') ?? '').replace('swipe ', '').replaceAll(' ', '-'),
		text: (mark.parentElement?.textContent ?? '').slice(1).trim(),
	})))
	const picks = right.find((answers) => answers.some((text) => options.some((option) => same(option.text, text)))) ?? []
	const marks = picks.flatMap((text) => options.filter((option) => same(option.text, text)).map((option) => option.mark))
	if (picks.includes('yes')) await caption(page, 'Yes or no: swipe up for yes, down for no.')
	else if (marks.length === 1) await caption(page, 'Swipe toward the arrow of your answer: the first cut strikes.')
	else if (picks[0] === 'User-agent stylesheet') await caption(page, 'An order: swipe them one by one, in the right order.')
	else await caption(page, 'Several answers: swipe each one, then lift and wait a moment.')
	await pause(page, 1.4)
	for (const mark of marks) {
		await swipe(page, mark)
		await pause(page, 0.6)
	}
}

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

/** Playwright's own ffmpeg, which it installs with its browsers. */
function ffmpeg(): string {
	const browsers = process.env.PLAYWRIGHT_BROWSERS_PATH
		?? (platform() === 'darwin' ? join(homedir(), 'Library/Caches/ms-playwright') : platform() === 'win32' ? join(homedir(), 'AppData/Local/ms-playwright') : join(homedir(), '.cache/ms-playwright'))
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
			if (frame !== undefined && !encoder.stdin.write(frame.jpeg)) await new Promise((resolve) => encoder.stdin.once('drain', resolve))
		}
	}
	encoder.stdin.end()
	await done
}

await mkdir(out, { recursive: true })
const browser = await chromium.launch({ args: [`--use-angle=${process.env.BUNBU_GL ?? 'metal'}`, '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: size })

// The fixture quiz chosen, before the filming starts.
await page.goto(base)
await page.getByRole('link', { name: 'Select quiz' }).click()
await page.getByText('Fixture quiz').click()
await page.goBack()
await page.getByRole('link', { name: 'Fight' }).waitFor()
await pause(page, 1)

const film = await camera(page)
await film.start()
await caption(page, 'Choose a quiz, then Fight.')
await pause(page, 2.5)
await page.getByRole('link', { name: 'Fight' }).click()
await page.getByRole('button', { name: 'Start run' }).waitFor()
await caption(page, 'Pick a stage, and how much time the ninjas give you.')
await pause(page, 2.5)
await page.getByRole('button', { name: 'Start run' }).click()
await caption(page, 'The samurai runs on his own. Every question is an ambush.')
await pause(page, 5)
await film.stop()
await caption(page, undefined)

// One ambush per question, until the results.
for (let ambush = 0; ambush < right.length; ambush++) {
	await page.getByText('Tap or swipe up to answer').waitFor({ timeout: 60_000 })
	await film.start()
	await caption(page, 'Ninjas! The world slows down, and the scroll asks the question.')
	await pause(page, 1.6)
	await caption(page, 'Tap the seal for the answers.')
	await pause(page, 0.8)
	await page.getByText('Tap or swipe up to answer').click()
	await pause(page, 0.5)
	await answer(page)
	if (ambush === 0) await page.screenshot({ path: new URL('how-to-play.jpg', out).pathname, type: 'jpeg', quality: 75 })
	await caption(page, ambush === right.length - 1 ? undefined : 'Right: the samurai cuts them down, and runs on.')
	await pause(page, 3.5)
	await film.stop()
	await caption(page, undefined)
}
await page.getByText(/^(勝|散)$/).first().waitFor({ timeout: 30_000 })
await film.start()
await caption(page, 'Your score, and every mistake to practise in the dojo.')
await pause(page, 4.5)
await film.stop()
await browser.close()

await encode(film.shots, new URL('how-to-play.webm', out).pathname)
const seconds = film.shots.reduce((sum, shot) => sum + ((shot.at(-1)?.time ?? 0) - (shot[0]?.time ?? 0)), 0)
console.log(`guide/how-to-play.webm (${seconds.toFixed(1)} s in ${String(film.shots.length)} shots), guide/how-to-play.jpg`)
