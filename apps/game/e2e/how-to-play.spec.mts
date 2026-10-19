/**
 * The video guide on How to play (`public/guide/how-to-play.webm`) is up to date (#138): the run it
 * shows ([its story](../scripts/how-to-play-story.mts)) is played again, and a still at each step is
 * compared with the one kept from when the video was recorded (`e2e/how-to-play/`). When the game
 * looks different, record the video again, which takes the stills too:
 * `pnpm --filter @bunbu/game how-to-play-video`.
 *
 * The stills are of the screens, not the world: the 3D canvas is hidden, and so is what moves with
 * the clock (the stage's progress, the duel strip, and the run's time on the results is covered), so
 * a still comes out the same on any machine.
 */

import { expect, test, type Page } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { guideSize, setUpGuide, tellGuide } from '../scripts/how-to-play-story.mts'
import { difference, pictureTolerance } from './pictures.mts'

/** Taking the stills for a newly recorded video, rather than checking them. */
const update = process.env.UPDATE_GUIDE_STILLS !== undefined

const stillOf = (name: string) => new URL(`how-to-play/${name}.jpg`, import.meta.url)

/** A still of the screen as it is: the world left out, and what moves with the clock covered. */
async function stillNow(page: Page): Promise<Buffer> {
	// The world, and what moves with the clock over it, left out: what is under them is still checked.
	await page.addStyleTag({
		content: [
			'canvas, [r-component="duel-strip"] > *, [r-component="stage-progress"] > * { visibility: hidden !important; }',
			'#guide-caption { transition: none !important; }',
		].join('\n'),
	})
	return page.screenshot({
		type: 'jpeg',
		quality: 80,
		animations: 'disabled',
		// The run's time on the results. A component's own element has no box (`display: contents`): what is in it is covered.
		mask: [page.locator('[r-component="stat-tile"] > *').filter({ hasText: 'breaks a tie' })],
	})
}

test.use({ viewport: guideSize })

test('the video guide is up to date', async ({ page }) => {
	// A whole run in real time, rendered without a GPU: minutes.
	test.setTimeout(20 * 60_000)
	// The world isn't in the stills: it is left undrawn, and keeps up with the clock.
	await setUpGuide(page, './', true)
	const differences: string[] = []
	await tellGuide(page, {
		// No film: only the stills.
		start: () => Promise.resolve(),
		stop: () => Promise.resolve(),
		async still(name) {
			const taken = await stillNow(page)
			if (update) {
				await writeFile(stillOf(name), taken)
				return
			}
			const kept = await readFile(stillOf(name)).catch(() => undefined)
			const off = kept === undefined ? 255 : await difference(page, taken, kept)
			if (off < pictureTolerance) return
			differences.push(`${name} (${off.toFixed(1)})`)
			// To see what differs: the still as it is now, next to the one kept.
			await test.info().attach(`${name}.jpg`, { body: taken, contentType: 'image/jpeg' })
		},
	}, 240)
	expect(differences, `public/guide/how-to-play.webm is out of date, its stills differ: record it again, pnpm --filter @bunbu/game how-to-play-video`).toEqual([])
})
