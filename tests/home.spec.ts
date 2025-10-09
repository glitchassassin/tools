import AxeBuilder from '@axe-core/playwright'
import { test, expect } from '@playwright/test'

test.describe('Home Page', () => {
	test('should render the home page correctly', async ({ page }) => {
		// Navigate to the home page
		await page.goto('/')

		// Check that the page title is correct
		await expect(page).toHaveTitle('New React Router App')

		// Check that a React Router logo is present (select the first one)
		await expect(page.getByAltText('React Router').first()).toBeVisible()

		// Check that the main navigation section is present
		await expect(page.getByText("What's next?")).toBeVisible()

		// Check that the React Router Docs link is present
		await expect(
			page.getByRole('link', { name: 'React Router Docs' }),
		).toBeVisible()

		// Check that the Discord link is present
		await expect(page.getByRole('link', { name: 'Join Discord' })).toBeVisible()

		// Verify that the page has loaded completely by checking the main content area
		await expect(page.locator('main')).toBeVisible()

		// Run accessibility scan on the entire page
		const accessibilityScanResults = await new AxeBuilder({ page }).analyze()
		expect(accessibilityScanResults.violations).toEqual([])
	})

	test('should have working external links', async ({ page }) => {
		await page.goto('/')

		// Test React Router Docs link
		const docsLink = page.getByRole('link', { name: 'React Router Docs' })
		await expect(docsLink).toHaveAttribute(
			'href',
			'https://reactrouter.com/docs',
		)
		await expect(docsLink).toHaveAttribute('target', '_blank')

		// Test Discord link
		const discordLink = page.getByRole('link', { name: 'Join Discord' })
		await expect(discordLink).toHaveAttribute('href', 'https://rmx.as/discord')
		await expect(discordLink).toHaveAttribute('target', '_blank')
	})
})
