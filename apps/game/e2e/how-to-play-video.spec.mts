/**
 * The video guide on How to play (`public/guide/how-to-play.webm`, with a still of it as its
 * poster, `how-to-play.jpg`) is up to date: the run is played again and a frame a second compared
 * with the stills kept of it (`how-to-play-video/`). The game's text is in the device's own fonts,
 * so it is filmed and checked in Playwright's Docker image only: every week by
 * `.github/workflows/how-to-play-video.yml`, which films it again and opens a pull request when the
 * game looks different, or by hand with `pnpm --filter @bunbu/game how-to-play-video`
 * (`scripts/how-to-play-video.mts`), which takes the stills again too. Plain `pnpm e2e` skips it.
 *
 * The video is a run on the fixture quiz from the title to the results, every kind of question
 * answered by swiping as a player would, with captions saying what happens. The running between
 * the ambushes is left out. As with the stage pictures (`stage-pictures.spec.mts`), time and chance
 * are fixed: Playwright's clock moves on one frame of the video at a time, the page's animations
 * with it, and `Math.random` is seeded, so a run films the same on the same machine but for
 * {@link tolerance}. Encoding it takes Playwright's ffmpeg, which comes with its browsers
 * (`playwright install chromium`).
 */

// It plays the game as a player would, one step after another, so every await waits on the step before.
/* oxlint-disable no-await-in-loop */

import { expect, test, type Page } from '@playwright/test'
import { spawn } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir, platform } from 'node:os'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const size = { width: 390, height: 844 }
/** Frames per second of the video, and its bit rate: small enough for a page. */
const fps = 25
const bitRate = '450k'
const update = process.env.UPDATE_HOW_TO_PLAY_VIDEO !== undefined
const check = process.env.CHECK_HOW_TO_PLAY_VIDEO !== undefined
/**
 * How far a frame may be from its still in the repository: the share of its
 * pixels that may be off by more than {@link changed} in a colour. Encoding blurs a frame
 * everywhere a little, which a mean over the frame would let a changed line of text hide in.
 */
const tolerance = 0.001
/** How far, of 255, a pixel's colour may be off before it counts as changed. */
const changed = 96
/**
 * Every how many frames one is kept as a still, to compare with: one a second. Only those are drawn
 * when comparing, as drawing a frame in software is most of the time it takes.
 */
const stillEvery = fps

const videoFile = new URL('../public/guide/how-to-play.webm', import.meta.url)
const posterFile = new URL('../public/guide/how-to-play.jpg', import.meta.url)
/** The stills of the video, by frame: what the check compares with. */
const stillsFolder = new URL('how-to-play-video/', import.meta.url)
const stillName = (index: number) => `frame-${String(index).padStart(4, '0')}.jpg`

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

/** Whether two answers are the same, whatever their case. */
const same = (one: string, other: string) => one.toLowerCase() === other.toLowerCase()

/**
 * Films `page` one frame at a time: each frame moves the page's clock on by a frame of the video,
 * and the animations of its styles with it, but only between `start()` and `stop()`. Each stretch
 * is a shot of the video, and the time in between is left out. The frames `pictured` says are
 * drawn and taken, by their number in the video; the rest only run (see {@link drawOnlyWhenAsked}).
 */
function camera(page: Page, pictured: (index: number) => boolean) {
	const frames = new Map<number, Buffer>()
	let count = 0
	let filming = false

	/**
	 * Moves the page on by `milliseconds`: its clock, and the animations of its styles, which the
	 * clock doesn't move. The world is drawn when `drawing`.
	 */
	const tick = async (milliseconds: number, drawing: boolean) => {
		await page.evaluate(([step, draw]) => {
			document.documentElement.dataset.drawing = draw ? 'on' : 'off'
			for (const animation of document.getAnimations()) {
				// A new one is held at its start, one held already moves on by a step and is
				// finished at its end, so its events still come.
				if (animation.playState === 'running') {
					animation.pause()
					animation.currentTime = 0
					continue
				}
				if (animation.playState !== 'paused') continue
				const end = Number(animation.effect?.getComputedTiming().endTime ?? Infinity)
				const next = Number(animation.currentTime ?? 0) + step
				if (next >= end) animation.finish()
				else animation.currentTime = next
			}
		}, [milliseconds, drawing] as const)
		await page.clock.fastForward(milliseconds)
	}

	/** The next frame of the video, drawn and taken when `pictured` or `drawn`. */
	const film = async (drawn: boolean) => {
		const taken = pictured(count) || drawn
		await tick(1000 / fps, taken)
		const frame = taken ? await page.screenshot({ type: 'jpeg', quality: 90 }) : undefined
		if (frame !== undefined && pictured(count)) frames.set(count, frame)
		count++
		return frame
	}

	return {
		frames,
		/** The next frame: filmed while filming, else a tenth of a second on, the longest a frame of the game loop takes. */
		async frame() {
			if (filming) await film(false)
			else await tick(100, false)
		},
		/** The next frame, always drawn, as a picture of its own. */
		async still() {
			await film(true)
			return page.screenshot({ type: 'jpeg', quality: 75 })
		},
		/** Frames for `seconds`. */
		async hold(seconds: number) {
			const steps = Math.round(seconds * (filming ? fps : 10))
			for (let index = 0; index < steps; index++) await this.frame()
		},
		/** Frames until `ready` says so. */
		async until(ready: () => Promise<boolean>) {
			for (let index = 0; index < 1000 && !await ready(); index++) await this.frame()
		},
		start() {
			filming = true
		},
		stop() {
			filming = false
		},
	}
}

type Camera = ReturnType<typeof camera>

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

/** A swipe on the answer paper toward `mark`, the way a thumb would, a frame for each stretch of it. */
async function swipe(page: Page, film: Camera, mark: string): Promise<void> {
	// On the paper under the answers, where a thumb has room to swipe every way.
	const answers = await page.locator('[aria-label^="swipe "]').last().boundingBox()
	const [x, y] = directions[mark] ?? [0, -1]
	const from = { x: size.width / 2, y: Math.min(size.height - 260, (answers?.y ?? 300) + 150) }
	await page.mouse.move(from.x, from.y)
	await page.mouse.down()
	const stretches = 6
	for (let stretch = 1; stretch <= stretches; stretch++) {
		await page.mouse.move(from.x + x * 120 * stretch / stretches, from.y + y * 120 * stretch / stretches, { steps: 2 })
		await film.frame()
	}
	await page.mouse.up()
}

/** Answers the open ambush right, and says how. Quickly: a yes or no gives the least time. */
async function answer(page: Page, film: Camera): Promise<void> {
	const options = await page.locator('[aria-label^="swipe "]').evaluateAll((marks) => marks.map((mark) => ({
		mark: (mark.getAttribute('aria-label') ?? '').replace('swipe ', '').replaceAll(' ', '-'),
		text: (mark.parentElement?.textContent ?? '').slice(1).trim(),
	})))
	const picks = right.find((answers) => answers.some((text) => options.some((option) => same(option.text, text)))) ?? []
	const marks = picks.flatMap((text) => options.filter((option) => same(option.text, text)).map((option) => option.mark))
	if (picks.includes('yes')) await caption(page, 'Yes or no: swipe up for yes, down for no.')
	else if (marks.length === 1) await caption(page, 'Swipe toward the arrow of your answer: the first cut strikes.')
	else if (picks[0] === 'User-agent stylesheet') await caption(page, 'An order: swipe them one by one, in the right order.')
	else await caption(page, 'Several answers: swipe each one the scroll asks for.')
	await film.hold(1.4)
	for (const mark of marks) {
		await swipe(page, film, mark)
		await film.hold(0.6)
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

/** Encodes the `frames` as a VP9 WebM at `fps`. */
async function encode(frames: Iterable<Buffer>, file: URL): Promise<void> {
	const encoder = spawn(ffmpeg(), [
		'-loglevel', 'error', '-y',
		'-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', 'pipe:0',
		'-c:v', 'libvpx-vp9', '-b:v', bitRate, '-deadline', 'good', '-pix_fmt', 'yuv420p', fileURLToPath(file),
	], { stdio: ['pipe', 'inherit', 'inherit'] })
	const done = new Promise<void>((resolve, reject) => {
		encoder.on('error', reject)
		encoder.on('close', (code) => { if (code === 0) resolve(); else reject(new Error(`ffmpeg stopped with ${String(code)}`)) })
	})
	for (const frame of frames) {
		if (!encoder.stdin.write(frame)) await new Promise((resolve) => encoder.stdin.once('drain', resolve))
	}
	encoder.stdin.end()
	await done
}

/** The share of pixels, from 0 to 1, that differ by more than {@link changed} in a colour between two JPEGs of the same size, decoded by the browser. */
async function changedShare(page: Page, one: Buffer, other: Buffer): Promise<number> {
	return page.evaluate(async ([first, second, most]) => {
		// In the page, where it runs: a function from outside the callback isn't sent along.
		// oxlint-disable-next-line unicorn/consistent-function-scoping
		const pixels = async (data: string) => {
			const image = new Image()
			image.src = `data:image/jpeg;base64,${data}`
			await image.decode()
			const canvas = new OffscreenCanvas(image.width, image.height)
			const context = canvas.getContext('2d')
			context?.drawImage(image, 0, 0)
			return context?.getImageData(0, 0, image.width, image.height).data ?? new Uint8ClampedArray()
		}
		const [a, b] = await Promise.all([pixels(first), pixels(second)])
		if (a.length !== b.length || a.length === 0) return 1
		let count = 0
		for (let index = 0; index < a.length; index += 4) {
			const red = Math.abs((a[index] ?? 0) - (b[index] ?? 0))
			const green = Math.abs((a[index + 1] ?? 0) - (b[index + 1] ?? 0))
			const blue = Math.abs((a[index + 2] ?? 0) - (b[index + 2] ?? 0))
			if (Math.max(red, green, blue) > most) count++
		}
		return count / (a.length / 4)
	}, [one.toString('base64'), other.toString('base64'), changed] as const)
}

/**
 * Has the page draw its WebGL only while `data-drawing` on its root isn't `off`. Everything else
 * runs as before, so the frames that are drawn come out the same as when every frame is.
 */
function drawOnlyWhenAsked() {
	const prototype = WebGL2RenderingContext.prototype as unknown as Record<string, ((...parameters: unknown[]) => unknown) | undefined>
	for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements']) {
		const draw = prototype[name]
		if (draw === undefined) continue
		prototype[name] = function drawWhenAsked(this: unknown, ...parameters: unknown[]) {
			if (document.documentElement.dataset.drawing === 'off') return undefined
			return draw.apply(this, parameters)
		}
	}
}

// SwiftShader, the same renderer on every machine and in CI, so the frames come out the same. Its
// WebGL back end draws a frame in a fraction of the time the Vulkan one takes.
test.use({
	viewport: size,
	launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'] },
})

test('the video on How to play is up to date', async ({ page }) => {
	test.skip(!update && !check, 'filmed and checked on its own, in Playwright\'s Docker image (.github/workflows/how-to-play-video.yml)')
	test.setTimeout(1_800_000)
	// The same chance every run, and a clock that only moves when it is told to.
	await page.addInitScript(() => {
		let state = 7
		Math.random = () => {
			state = (state * 16_807) % 2_147_483_647
			return (state - 1) / 2_147_483_646
		}
	})
	await page.addInitScript(drawOnlyWhenAsked)
	await page.clock.install({ time: 0 })

	// The fixture quiz chosen, before the filming starts.
	await page.goto('./')
	await page.getByRole('link', { name: 'Select quiz' }).click()
	await page.getByText('Fixture quiz').click()
	// A run started once, unfilmed: a fresh dev server finds the run's last dependencies there and
	// reloads the page once it has bundled them.
	await page.goto('fight/')
	await page.getByRole('button', { name: 'Start run' }).click()
	await page.waitForLoadState('networkidle')
	await page.waitForTimeout(5000)

	// The title from its start, on a clock that only moves when told to. Each of its first frames
	// waits in real time for what it began to load, so the models are in at the same frame every run.
	await page.clock.pauseAt(1_000_000)
	await page.goto('./')
	const film = camera(page, (index) => update || index % stillEvery === 0)
	for (let frame = 0; frame < 10; frame++) {
		await page.waitForLoadState('networkidle')
		await page.waitForTimeout(500)
		await film.frame()
	}
	await page.getByRole('link', { name: 'Fight' }).waitFor()
	let poster: Buffer | undefined
	await film.hold(1)
	film.start()
	await caption(page, 'Choose a quiz, then Fight.')
	await film.hold(2.5)
	await page.getByRole('link', { name: 'Fight' }).click()
	await page.getByRole('button', { name: 'Start run' }).waitFor()
	// A player never sees the dev tools of the dev server this is filmed on.
	await page.getByRole('button', { name: /Unlock all stages/ }).evaluate((button) => {
		const tools = button.closest('div')
		if (tools !== null) tools.style.display = 'none'
	})
	await caption(page, 'Pick a stage, and how much time the ninjas give you.')
	await film.hold(2.5)
	await page.getByRole('button', { name: 'Start run' }).click()
	// Real time, the clock still held, for the stage's models to be read and put in their place.
	await page.waitForLoadState('networkidle')
	await page.waitForTimeout(5000)
	await caption(page, 'The samurai runs on his own. Every question is an ambush.')
	await film.hold(5)
	film.stop()
	await caption(page, undefined)

	// One ambush per question, until the results.
	const seal = page.getByText('Tap or swipe up to answer')
	for (let ambush = 0; ambush < right.length; ambush++) {
		await film.until(() => seal.isVisible())
		film.start()
		await caption(page, 'Ninjas! The world slows down, and the scroll asks the question.')
		await film.hold(1.6)
		await caption(page, 'Tap the seal for the answers.')
		await film.hold(0.8)
		await seal.click()
		await film.hold(0.5)
		await answer(page, film)
		if (ambush === 0) poster = await film.still()
		await caption(page, ambush === right.length - 1 ? undefined : 'Right: the samurai cuts them down, and runs on.')
		await film.hold(3.5)
		film.stop()
		await caption(page, undefined)
	}
	const results = page.getByText(/^(勝|散)$/).first()
	await film.until(() => results.isVisible())
	film.start()
	await caption(page, 'Your score, and every mistake to practise in the dojo.')
	await film.hold(4.5)
	film.stop()

	if (poster === undefined) throw new Error('no ambush was filmed')
	const stills = [...film.frames].filter(([index]) => index % stillEvery === 0)
	if (update) {
		await encode(film.frames.values(), videoFile)
		await writeFile(posterFile, poster)
		await rm(stillsFolder, { recursive: true, force: true })
		await mkdir(stillsFolder)
		for (const [index, frame] of stills) await writeFile(new URL(stillName(index), stillsFolder), frame)
		return
	}
	const outOfDate = 'public/guide/how-to-play.webm is out of date: pnpm --filter @bunbu/game how-to-play-video'
	// As many as there were: a longer or shorter run is out of date too.
	expect((await readdir(stillsFolder)).toSorted(), outOfDate).toEqual(stills.map(([index]) => stillName(index)))
	for (const [index, frame] of stills) {
		const kept = await readFile(new URL(stillName(index), stillsFolder))
		expect(await changedShare(page, frame, kept), `${outOfDate} (${stillName(index)})`).toBeLessThan(tolerance)
	}
	expect(await changedShare(page, poster, await readFile(posterFile)), outOfDate).toBeLessThan(tolerance)
})
