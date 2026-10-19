import type { Page } from '@playwright/test'

/** The mean difference per colour between two JPEGs of the same size, of 255, decoded by the browser. */
export async function difference(page: Page, one: Buffer, other: Buffer): Promise<number> {
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
