/**
 * The pictures of the stages on the stage select (`public/stages/<stage>.jpg`) are up to date: each
 * is taken again, the size of its card in the carousel, and compared with the one in the repository.
 * When a stage's world changes, take them again and commit them:
 * `pnpm --filter @bunbu/game stage-pictures`.
 *
 * A picture is a stage seven seconds into a run, without the samurai, the ninjas or the HUD
 * (`?scenery`, dev only). Time and chance are fixed, so a run looks the same every time:
 * Playwright's clock moves the frames on and `Math.random` is seeded. What still differs between
 * machines, as the GPU's own rounding, is under {@link tolerance}.
 */

// One stage after another on one dev server, each picture frame by frame.
/* oxlint-disable no-await-in-loop */

import { expect, test, type Page } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'

const stages = {
	'rice-fields': 'Rice fields',
	'bamboo-forest': 'Bamboo forest',
	'mountain-temple': 'Mountain temple',
	'castle-town': 'Castle town',
	'edo-castle': 'Edo castle',
} as const

/** The card's picture in the carousel (`select.css`: 13.5rem wide, 4 : 5), at twice its size for sharp phones. */
const card = { width: 216, height: 270 }
/** Seconds into the run: past the start, before the first ambush. */
const into = 7
const update = process.env.UPDATE_STAGE_PICTURES !== undefined
/** How far a picture may be from the one in the repository: the mean difference per colour, of 255. */
const tolerance = 6

const pictureOf = (stage: string) => new URL(`../public/stages/${stage}.jpg`, import.meta.url)

/** The mean difference per colour between two JPEGs of the same size, decoded by the browser. */
async function difference(page: Page, one: Buffer, other: Buffer): Promise<number> {
	return page.evaluate(async ([first, second]) => {
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
		if (a.length !== b.length || a.length === 0) return 255
		let sum = 0
		for (let index = 0; index < a.length; index++) if (index % 4 !== 3) sum += Math.abs((a[index] ?? 0) - (b[index] ?? 0))
		return sum / (a.length * 0.75)
	}, [one.toString('base64'), other.toString('base64')] as const)
}

test.describe.configure({ mode: 'serial' })
// SwiftShader, the same renderer on every machine and in CI, so the pictures come out the same.
test.use({
	viewport: card,
	deviceScaleFactor: 2,
	launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
})

for (const [stage, name] of Object.entries(stages)) {
	test(`the picture of ${name} is up to date`, async ({ page }) => {
		test.setTimeout(300_000)
		// The same chance every run, and a clock that only moves when it is told to.
		await page.addInitScript(() => {
			let state = 7
			Math.random = () => {
				state = (state * 16_807) % 2_147_483_647
				return (state - 1) / 2_147_483_646
			}
		})
		await page.clock.install({ time: 0 })

		// A quiz to fight with, every stage open: the dev server lists the fixture quiz with the samples.
		await page.goto('./')
		await page.getByRole('link', { name: 'Select quiz' }).click()
		await page.getByText('Fixture quiz').click()
		await page.goto('fight/?scenery')
		await page.getByRole('button', { name: 'Start run' }).waitFor()
		const unlock = page.getByRole('button', { name: /Unlock all stages/ })
		if (await unlock.isVisible()) await unlock.click()
		await page.getByText(name).first().click()

		// Held still while the run's models come in, then seven seconds of frames.
		await page.clock.pauseAt(1_000_000)
		await page.getByRole('button', { name: 'Start run' }).click()
		await page.waitForLoadState('networkidle')
		// A frame a tenth of a second, the longest the game loop takes in one (`canvas/loop.mts`):
		// seventy frames rather than four hundred, which software rendering would take minutes over.
		for (let frame = 0; frame < into * 10; frame++) await page.clock.fastForward(100)
		await page.addStyleTag({ content: '[data-layer] { visibility: hidden !important; }' })
		const taken = await page.locator('canvas').screenshot({ type: 'jpeg', quality: 72, scale: 'device' })

		if (update) {
			await writeFile(pictureOf(stage), taken)
			return
		}
		const kept = await readFile(pictureOf(stage))
		expect(await difference(page, taken, kept), `public/stages/${stage}.jpg is out of date: pnpm --filter @bunbu/game stage-pictures`).toBeLessThan(tolerance)
	})
}
