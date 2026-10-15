/**
 * Takes the pictures of the stages for the stage select (`public/stages/<stage>.jpg`): each stage a
 * few seconds into a run, without the samurai, the ninjas or the HUD.
 *
 * Start the dev server (`pnpm dev`), then: `pnpm --filter @bunbu/game stage-pictures`. Take them
 * again when a stage's world changes.
 */

import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const base = process.env.BUNBU_URL ?? 'http://localhost:5173/bunbu/'
const stages = ['rice-fields', 'bamboo-forest', 'mountain-temple', 'castle-town', 'edo-castle'] as const
const names: Readonly<Record<(typeof stages)[number], string>> = {
	'rice-fields': 'Rice fields',
	'bamboo-forest': 'Bamboo forest',
	'mountain-temple': 'Mountain temple',
	'castle-town': 'Castle town',
	'edo-castle': 'Edo castle',
}
/** Seconds into the run: past the start, before the first ambush. */
const into = 7
const out = new URL('../public/stages/', import.meta.url)

await mkdir(out, { recursive: true })
// WebGL without a GPU, so it runs on any machine.
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
// A card of the stage select, at twice its size for sharp phones.
const page = await browser.newPage({ viewport: { width: 300, height: 400 }, deviceScaleFactor: 2 })

// A quiz to fight with: the dev server lists the fixture quiz with the sample quizzes.
await page.goto(base)
await page.getByRole('link', { name: 'Select quiz' }).click()
await page.getByText('Fixture quiz').click()
await page.goto(`${base}fight/?scenery`)
// Every stage open on it (the dev tools on the fight setup).
await page.getByRole('button', { name: 'Start run' }).waitFor()
const unlock = page.getByRole('button', { name: /Unlock all stages/ })
if (await unlock.isVisible()) await unlock.click()

// One page, so one stage after another: a run each, in turn.
// oxlint-disable no-await-in-loop
for (const stage of stages) {
	await page.getByText(names[stage]).first().click()
	await page.getByRole('button', { name: 'Start run' }).click()
	await page.waitForTimeout(into * 1000)
	// The world only: the HUD and the overlays off.
	await page.addStyleTag({ content: '[data-layer] { visibility: hidden !important; }' })
	await page.locator('canvas').screenshot({ path: new URL(`${stage}.jpg`, out).pathname, type: 'jpeg', quality: 72 })
	console.log(`stages/${stage}.jpg`)
	await page.goto(`${base}fight/?scenery`)
}
// oxlint-enable no-await-in-loop

await browser.close()
