/**
 * The samurai stays in frame on the title screen, between the name and the menu, on the screens
 * we play on (#68). The page says where its gap is (`--gap-top`, `--gap-height`); the camera the
 * world sets up for that gap ({@link titleShot}) must show all of him inside it.
 */

import { expect, test, type Page } from '@playwright/test'
import { PerspectiveCamera, Vector3 } from 'three'
import { samuraiHeight, titleFraming, titleShot, type Gap } from '../src/title/framing.mts'

/** Phones from small to large, a tablet, and a laptop. */
const screens = [
	{ name: 'iPhone SE (1st)', width: 320, height: 568 },
	{ name: 'small Android', width: 360, height: 640 },
	{ name: 'iPhone SE', width: 375, height: 667 },
	{ name: 'Android', width: 360, height: 780 },
	{ name: 'iPhone 14', width: 390, height: 844 },
	{ name: 'Pixel', width: 412, height: 915 },
	{ name: 'iPad', width: 768, height: 1024 },
	{ name: 'laptop', width: 1280, height: 720 },
] as const

/** The least room he gets, in CSS pixels: smaller than this and he is hard to make out. */
const leastRoom = 100

async function gapOf(page: Page): Promise<Gap> {
	await expect.poll(() => page.locator('section').first().evaluate((section) => section.style.getPropertyValue('--gap-height'))).not.toBe('')
	return page.locator('section').first().evaluate((section) => ({
		top: Number.parseFloat(section.style.getPropertyValue('--gap-top')),
		height: Number.parseFloat(section.style.getPropertyValue('--gap-height')),
	}))
}

/** Where the samurai shows on screen, as the box round him in CSS pixels. */
function samuraiOnScreen(width: number, height: number, gap: Gap, sway: number) {
	const shot = titleShot(width, height, gap, sway)
	const camera = new PerspectiveCamera(titleFraming.fov, width / height, 0.1, 700)
	camera.position.set(...shot.position)
	camera.lookAt(...shot.look)
	camera.setViewOffset(width, height, 0, shot.shift, width, height)
	camera.updateMatrixWorld()
	camera.updateProjectionMatrix()
	const corners = [-0.5, 0.5].flatMap((x) => [0, samuraiHeight].flatMap((y) => [-0.4, 0.4].map((z) => new Vector3(x, y, z))))
	const onScreen = corners.map((corner) => corner.project(camera)).map(({ x, y }) => ({ x: ((x + 1) / 2) * width, y: ((1 - y) / 2) * height }))
	return {
		left: Math.min(...onScreen.map(({ x }) => x)),
		right: Math.max(...onScreen.map(({ x }) => x)),
		top: Math.min(...onScreen.map(({ y }) => y)),
		bottom: Math.max(...onScreen.map(({ y }) => y)),
	}
}

for (const quiz of ['without a quiz', 'with a quiz chosen'] as const) {
	test.describe(`the title ${quiz}`, () => {
		for (const { name, width, height } of screens) {
			test(`keeps the samurai in frame on ${name} (${width}×${height})`, async ({ page }) => {
				await page.setViewportSize({ width, height })
				await page.goto('./')
				if (quiz === 'with a quiz chosen') {
					// The dev server lists the fixture quiz with the sample quizzes.
					await page.getByRole('link', { name: 'Select quiz' }).click()
					await page.getByText('Fixture quiz').click()
					await page.goBack()
				}
				await expect(page.getByRole('link', { name: quiz === 'with a quiz chosen' ? 'Fight' : 'Select quiz' })).toBeVisible()

				const gap = await gapOf(page)
				const wide = width / height > 1.1
				if (!wide) expect(gap.height).toBeGreaterThanOrEqual(leastRoom)
				const room = wide ? { top: 0, height } : gap
				// The camera sways from side to side; he stays in frame all the way.
				for (const sway of [-0.035, 0, 0.035]) {
					const box = samuraiOnScreen(width, height, gap, sway)
					expect(box.left).toBeGreaterThanOrEqual(0)
					expect(box.right).toBeLessThanOrEqual(width)
					expect(box.top).toBeGreaterThanOrEqual(room.top)
					expect(box.bottom).toBeLessThanOrEqual(room.top + room.height)
				}
			})
		}
	})
}
