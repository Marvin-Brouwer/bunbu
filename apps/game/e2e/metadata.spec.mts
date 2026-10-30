import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const metadataQuiz = readFileSync(new URL('../../../docs/testdata/custom-metadata.yaml', import.meta.url), 'utf8')

for (const kind of ['v1 without metadata', 'v2 without metadata', 'v2 with custom metadata'] as const) {
	test(`imports, stores and studies ${kind}`, async ({ page }) => {
		const errors: string[] = []
		page.on('pageerror', (error) => errors.push(error.message))
		const plain = [
			`# yaml-language-server: $schema=https://marvin-brouwer.github.io/bunbu/schema/${kind.startsWith('v1') ? 'v1' : 'v2'}.json`,
			'id: plain-import',
			'title: Plain imported quiz',
			"version: '1'",
			'language: en',
			'passingScore: 70',
			'questions:',
			'  - type: yes-no',
			'    query: Is a container image used to create a container?',
			"    answer: 'yes'",
		].join('\n')
		const custom = kind === 'v2 with custom metadata'
		const title = custom ? 'Optional application metadata' : 'Plain imported quiz'
		await page.goto('quizzes/')
		await page.locator('input[type="file"]').setInputFiles({
			name: 'imported.yaml',
			mimeType: 'application/yaml',
			buffer: Buffer.from(custom ? metadataQuiz : plain),
		})
		await page.getByRole('button', { name: 'I agree' }).click()
		await page.getByRole('radio', { name: new RegExp(title) }).check()
		await page.reload()
		await expect(page.getByRole('radio', { name: new RegExp(title) })).toBeChecked()
		await page.getByRole('link', { name: 'Back', exact: true }).click()
		await page.getByRole('link', { name: 'Dojo', exact: true }).click()
		await page.getByRole('link', { name: /^Study/ }).click()
		await expect(page.getByRole('button', { name: 'Skip', exact: true })).toBeVisible({ timeout: 15_000 })
		await expect(page.getByText(/Is a container image used to create a container|Which Azure service is a container image registry/)).toBeVisible()
		await expect(page.getByText('examPrep', { exact: true })).toHaveCount(0)
		expect(errors).toEqual([])
	})
}
