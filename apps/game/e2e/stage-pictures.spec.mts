/**
 * The pictures of the stages on the stage select (`public/stages/<stage>.jpg`) are up to date: each
 * is taken again, the size of its card in the carousel, and compared with the one in the repository.
 * When a stage's world changes, take them again and commit them:
 * `pnpm --filter @bunbu/game stage-pictures`.
 *
 * A picture is a stage seven seconds into a run, without the samurai, the ninjas or the HUD
 * (`scenery`, src/fight/world/picture-settings.mts). Time and chance are fixed, so a run looks the
 * same every time: Playwright's clock moves the frames on, `Math.random` is seeded, and the stage is
 * laid out from a seed of its own (`seed`), whatever else drew on `Math.random` first. What still differs between
 * machines, as the GPU's own rounding, is under {@link tolerance}.
 */

// One stage after another on one dev server, each picture frame by frame.
/* oxlint-disable no-await-in-loop */

import { expect, test } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { difference } from './difference.mts'

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
			// The stage alone, laid out the same every run (src/fight/world/picture-settings.mts).
			Object.defineProperty(window, 'pictureSettings', { value: () => ({ scenery: true, seed: 7 }) })
		})
		await page.clock.install({ time: 0 })

		// A quiz to fight with, every stage open: the dev server lists the fixture quiz with the samples.
		await page.goto('./')
		await page.getByRole('link', { name: 'Select quiz' }).click()
		await page.getByText('Fixture quiz').click()
		await page.goto('fight/')
		await page.getByRole('button', { name: 'Start run' }).waitFor()
		const unlock = page.getByRole('button', { name: /Unlock all stages/ })
		if (await unlock.isVisible()) await unlock.click()
		await page.getByText(name).first().click()

		// Held still while the run's models come in, then seven seconds of frames.
		await page.clock.pauseAt(1_000_000)
		await page.getByRole('button', { name: 'Start run' }).click()
		await page.waitForLoadState('networkidle')
		// Real time, the clock still held, for the models to be read and put in their place: a slow
		// machine takes a while over the stage kit, and the picture is of the stage as it is then.
		await page.waitForTimeout(5000)
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
