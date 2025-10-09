import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.describe('Index Page', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/')
	})

	test('passes accessibility checks', async ({ page }) => {
		await expect(page).toHaveTitle('Toolbox of Destiny')
		const accessibilityScanResults = await new AxeBuilder({ page }).analyze()
		expect(accessibilityScanResults.violations).toEqual([])
	})
})
