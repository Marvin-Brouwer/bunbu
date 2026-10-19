/**
 * The run the video guide on How to play shows (#138): the fixture quiz from the title to the
 * results, every kind of question answered by swiping as a player would, with captions saying what
 * happens. `how-to-play-video.mts` films it; `e2e/how-to-play.spec.mts` plays it again and checks
 * its stills, so CI fails when the game no longer looks like the video.
 *
 * It plays as players see the app ([test hooks](../src/_shared/test-hooks.mts): no dev tools), and
 * with `Math.random` seeded, so the questions come in the same order every time.
 */

// It plays the game as a player would, one step after another, so every await waits on the step before.
/* oxlint-disable no-await-in-loop */

import type { Page } from '@playwright/test'

export const guideSize = { width: 390, height: 844 }

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
	const from = { x: guideSize.width / 2, y: Math.min(guideSize.height - 260, (answers?.y ?? 300) + 150) }
	await page.mouse.move(from.x, from.y)
	await page.mouse.down()
	await page.mouse.move(from.x + x * 120, from.y + y * 120, { steps: 12 })
	await page.mouse.up()
}

/** Answers the open ambush right, and says how. Quickly: a yes or no gives the least time. */
async function answer(page: Page, still: (name: string) => Promise<void>, name: string): Promise<void> {
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
	await still(name)
	for (const mark of marks) {
		await swipe(page, mark)
		await pause(page, 0.6)
	}
}

/** What the story is told to: the film rolls between `start` and `stop`, and `still` takes a still named `name`. */
export type GuideCamera = {
	readonly start: () => Promise<void>
	readonly stop: () => Promise<void>
	readonly still: (name: string) => Promise<void>
}

/**
 * Readies `page` before it loads anything: the app as players see it, and `Math.random` seeded.
 * Then opens `base` and chooses the fixture quiz, before the film starts. `stillsOnly` for stills
 * of the screens alone: the world left undrawn, and no time limit, which a slow machine could run
 * out of ([test hooks](../src/_shared/test-hooks.mts)).
 */
export async function setUpGuide(page: Page, base: string, stillsOnly = false): Promise<void> {
	await page.addInitScript((hooks) => {
		window.bunbuTestHooks = hooks
		let state = 11
		Math.random = () => {
			state = (state * 16_807) % 2_147_483_647
			return (state - 1) / 2_147_483_646
		}
	}, { players: true, skipWorld: stillsOnly, untimed: stillsOnly })
	await page.goto(base)
	await page.getByRole('link', { name: 'Select quiz' }).click()
	await page.getByText('Fixture quiz').click()
	await page.goBack()
	await page.getByRole('link', { name: 'Fight' }).waitFor()
	await pause(page, 1)
}

/**
 * Tells the story to `camera`, from the title, the fixture quiz chosen, to the results. `patience`
 * is how many seconds to wait for each ambush: rendered without a GPU, as in CI, the run takes many
 * times as long between them.
 */
export async function tellGuide(page: Page, camera: GuideCamera, patience = 60): Promise<void> {
	await camera.start()
	await caption(page, 'Choose a quiz, then Fight.')
	await pause(page, 1.5)
	await camera.still('01-title')
	await pause(page, 1)
	await page.getByRole('link', { name: 'Fight' }).click()
	await page.getByRole('button', { name: 'Start run' }).waitFor()
	await caption(page, 'Pick a stage, and how much time the ninjas give you.')
	await pause(page, 1.5)
	await camera.still('02-fight-setup')
	await pause(page, 1)
	await page.getByRole('button', { name: 'Start run' }).click()
	await caption(page, 'The samurai runs on his own. Every question is an ambush.')
	await pause(page, 3)
	await camera.still('03-running')
	await pause(page, 2)
	await camera.stop()
	await caption(page, undefined)

	// One ambush per question, until the results.
	for (let ambush = 0; ambush < right.length; ambush++) {
		await page.getByText('Tap or swipe up to answer').waitFor({ timeout: patience * 1000 })
		await camera.start()
		await caption(page, 'Ninjas! The world slows down, and the scroll asks the question.')
		await pause(page, 1.6)
		await camera.still(`${String(4 + ambush * 2).padStart(2, '0')}-question-${String(ambush + 1)}`)
		await caption(page, 'Tap the seal for the answers.')
		await pause(page, 0.8)
		await page.getByText('Tap or swipe up to answer').click()
		await pause(page, 0.5)
		await answer(page, camera.still, `${String(5 + ambush * 2).padStart(2, '0')}-answers-${String(ambush + 1)}`)
		await caption(page, ambush === right.length - 1 ? undefined : 'Right: the samurai cuts them down, and runs on.')
		await pause(page, 3.5)
		await camera.stop()
		await caption(page, undefined)
	}
	await page.getByText(/^(勝|散)$/).first().waitFor({ timeout: patience * 1000 })
	await camera.start()
	await caption(page, 'Your score, and every mistake to practise in the dojo.')
	await pause(page, 2)
	await camera.still('12-results')
	await pause(page, 2.5)
	await camera.stop()
}
