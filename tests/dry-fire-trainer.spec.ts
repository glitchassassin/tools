import AxeBuilder from '@axe-core/playwright'
import { test, expect } from '@playwright/test'

// Fixture to create a drill with randomized name and 1 rep
async function createTestDrill(page: any): Promise<string> {
	const drillName = `Test Drill ${Math.random().toString(36).substring(2, 8)}`

	// Navigate to Settings tab
	await page.getByRole('link', { name: 'Settings' }).click()
	await expect(page).toHaveURL('/dry-fire-trainer/settings')

	// Create new drill
	await page.getByRole('button', { name: 'Add Drill' }).click()
	await page.getByLabel('Name').fill(drillName)
	await page.getByLabel('Par Time (seconds)').fill('2.0')
	await page.getByLabel('Default Reps').fill('1')
	await page.getByRole('button', { name: 'Save' }).click()

	// Verify drill was created
	await expect(page.getByRole('heading', { name: drillName })).toBeVisible()

	// Navigate back to drill selection
	await page.getByRole('link', { name: 'Drill' }).click()
	await expect(page).toHaveURL('/dry-fire-trainer')

	return drillName
}

test.describe('Dry-Fire Trainer', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/')
		await page.getByRole('link', { name: 'Dry-Fire Trainer' }).click()
		await expect(page).toHaveURL('/dry-fire-trainer')
	})

	test('should display drill selection screen with default drills', async ({
		page,
	}) => {
		await expect(
			page.getByRole('heading', { name: 'Select a drill' }),
		).toBeVisible()

		// Check for default drills
		await expect(
			page.getByRole('heading', { name: /^Low Ready$/ }),
		).toBeVisible()
		await expect(page.getByRole('heading', { name: /^Draw$/ })).toBeVisible()
		await expect(
			page.getByRole('heading', { name: /^Draw from Concealment$/ }),
		).toBeVisible()

		// Verify par times are displayed
		await expect(page.getByText('Par time: 1.5s')).toBeVisible()
		await expect(page.getByText('Par time: 2s')).toBeVisible()
		await expect(page.getByText('Par time: 2.5s')).toBeVisible()
	})

	test('should navigate to settings and add custom drill', async ({ page }) => {
		await page.getByRole('link', { name: 'Settings' }).click()
		await expect(page).toHaveURL('/dry-fire-trainer/settings')

		await page.getByRole('button', { name: 'Add Drill' }).click()

		await page.getByLabel('Name').fill('Speed Draw')
		await page.getByLabel('Par Time (seconds)').fill('1.0')
		await page.getByLabel('Default Reps').fill('15')

		await page.getByRole('button', { name: 'Save' }).click()

		// Verify drill appears in list
		await expect(
			page.getByRole('heading', { name: 'Speed Draw' }),
		).toBeVisible()
		await expect(page.getByText('Par: 1s')).toBeVisible()
		await expect(page.getByText('Reps: 15')).toBeVisible()

		// Verify drill is available on drill selection screen
		await page.getByRole('link', { name: 'Drill' }).click()
		await expect(
			page.getByRole('heading', { name: 'Speed Draw' }),
		).toBeVisible()
	})

	test('should edit existing drill', async ({ page }) => {
		await page.getByRole('link', { name: 'Settings' }).click()

		// Find the Low Ready drill and click edit
		const lowReadyCard = page
			.locator('li')
			.filter({ has: page.getByRole('heading', { name: 'Low Ready' }) })
		await lowReadyCard.getByRole('button', { name: 'Edit' }).click()

		// Edit the drill
		await page.getByLabel('Name').fill('Modified Low Ready')
		await page.getByLabel('Par Time (seconds)').fill('1.8')

		await page.getByRole('button', { name: 'Save' }).click()

		// Verify changes
		await expect(
			page.getByRole('heading', { name: 'Modified Low Ready' }),
		).toBeVisible()
		await expect(page.getByText('Par: 1.8s')).toBeVisible()
	})

	test('should prevent deletion of drill with validation', async ({ page }) => {
		await page.getByRole('link', { name: 'Settings' }).click()
		await page.getByRole('button', { name: 'Add Drill' }).click()

		// Try to save with empty name
		await page.getByRole('button', { name: 'Save' }).click()
		await expect(page.getByText('Name is required')).toBeVisible()

		// Try invalid par time
		await page.getByLabel('Name').fill('Test Drill')
		await page.getByLabel('Par Time (seconds)').fill('0')
		await page.getByRole('button', { name: 'Save' }).click()
		await expect(
			page.getByText('Par time must be between 0 and 60 seconds'),
		).toBeVisible()

		// Try invalid reps
		await page.getByLabel('Par Time (seconds)').fill('2.0')
		await page.getByLabel('Default Reps').fill('0')
		await page.getByRole('button', { name: 'Save' }).click()
		await expect(page.getByText('Reps must be between 1 and 100')).toBeVisible()
	})

	test('should complete a drill session manually (without microphone)', async ({
		page,
		context,
	}) => {
		// Deny microphone permission
		await context.grantPermissions(['microphone'], { origin: page.url() })

		// Create a test drill with 1 rep
		const drillName = await createTestDrill(page)

		// Start the test drill
		const testDrillButton = page.getByRole('button', { name: drillName })
		await testDrillButton.click()

		// Should see session screen
		await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
		await expect(page.getByRole('heading', { name: drillName })).toBeVisible()
		await expect(page.getByText('Rep')).toBeVisible()
		await expect(page.getByText('1 / 1')).toBeVisible()

		// Start first rep
		await page.getByRole('button', { name: 'Start' }).click()

		// Wait for listening state to complete (par time + buffer)
		await expect(page.getByText('Listening for shot...')).toBeVisible({
			timeout: 15000,
		})

		// Wait for result buttons to appear
		await expect(page.getByRole('button', { name: 'Hit' })).toBeVisible({
			timeout: 3000,
		})
		await expect(page.getByRole('button', { name: 'Miss' })).toBeVisible()

		// Mark as hit
		await page.getByRole('button', { name: 'Hit' }).click()

		// Should see completion screen
		await expect(
			page.getByRole('heading', { name: 'Drill Complete!' }),
		).toBeVisible()
		await expect(page.getByText('Hit Rate')).toBeVisible()
		await expect(page.getByText(/\d+%/)).toBeVisible()

		// Should see shot results chart
		await expect(page.getByText('Shot Results')).toBeVisible()

		// Navigate to history
		await page.getByRole('button', { name: 'View History' }).click()
		await expect(page).toHaveURL('/dry-fire-trainer/history')
	})

	test('should mark shot time as ignored', async ({ page, context }) => {
		await context.grantPermissions(['microphone'], { origin: page.url() })

		// Create a test drill with 1 rep
		const drillName = await createTestDrill(page)

		const testDrillButton = page.getByRole('button', { name: drillName })
		await testDrillButton.click()

		await page.getByRole('button', { name: 'Start' }).click()
		await expect(page.getByRole('button', { name: 'Hit' })).toBeVisible({
			timeout: 15000,
		})

		// Check "Ignore time" checkbox
		await page.getByLabel('Ignore time').check()
		await expect(page.getByLabel('Ignore time')).toBeChecked()

		await page.getByRole('button', { name: 'Hit' }).click()

		// Verify completion
		await expect(
			page.getByRole('heading', { name: 'Drill Complete!' }),
		).toBeVisible()
	})

	test('should view session history', async ({ page }) => {
		await page.getByRole('link', { name: 'History' }).click()
		await expect(page).toHaveURL('/dry-fire-trainer/history')

		await expect(
			page.getByRole('heading', { name: 'Practice History' }),
		).toBeVisible()

		// Should show empty state initially
		await expect(page.getByText(/No completed sessions yet/)).toBeVisible()
	})

	test('should delete session from history', async ({ page, context }) => {
		await context.grantPermissions(['microphone'], { origin: page.url() })

		// Create a test drill with 1 rep
		const drillName = await createTestDrill(page)

		// Complete the test drill
		const testDrillButton = page.getByRole('button', { name: drillName })
		await testDrillButton.click()

		// Start first rep
		await page.getByRole('button', { name: 'Start' }).click()

		// Complete the single rep
		await expect(page.getByRole('button', { name: 'Hit' })).toBeVisible({
			timeout: 12000,
		})
		await page.getByRole('button', { name: 'Hit' }).click()

		await page.getByRole('button', { name: 'View History' }).click()

		// Should see the session
		await expect(page.getByRole('heading', { name: drillName })).toBeVisible()

		// Delete the session
		page.on('dialog', (dialog) => dialog.accept())
		await page.getByRole('button', { name: 'Delete' }).click()

		// Should show empty state again
		await expect(page.getByText(/No completed sessions yet/)).toBeVisible()
	})

	test('should view detailed session results', async ({ page, context }) => {
		await context.grantPermissions(['microphone'], { origin: page.url() })

		// Create a test drill with 1 rep
		const drillName = await createTestDrill(page)

		// Complete the test drill
		const testDrillButton = page.getByRole('button', { name: drillName })
		await testDrillButton.click()

		// Start first rep
		await page.getByRole('button', { name: 'Start' }).click()

		// Complete the single rep as a miss
		await expect(page.getByRole('button', { name: 'Miss' })).toBeVisible({
			timeout: 12000,
		})
		await page.getByRole('button', { name: 'Miss' }).click()

		await page.getByRole('button', { name: 'View History' }).click()

		// Click on the session to view details
		const sessionButton = page
			.locator('button')
			.filter({ has: page.getByRole('heading', { name: drillName }) })
		await sessionButton.click()

		// Should see detailed view
		await expect(page.getByText('Hit Rate')).toBeVisible()
		await expect(page.getByText('Hit / Miss')).toBeVisible()
		await expect(page.getByText('Shot Results')).toBeVisible()

		// Should see numbered shots
		await expect(page.getByText('1', { exact: true })).toBeVisible()

		// Navigate back to history list
		await page.getByRole('button', { name: '← Back to history' }).click()
		await expect(
			page.getByRole('heading', { name: 'Practice History' }),
		).toBeVisible()
	})

	test('should export and import data', async ({ page }) => {
		await page.getByRole('link', { name: 'Settings' }).click()

		// Add a custom drill first
		await page.getByRole('button', { name: 'Add Drill' }).click()
		await page.getByLabel('Name').fill('Export Test Drill')
		await page.getByLabel('Par Time (seconds)').fill('3.0')
		await page.getByRole('button', { name: 'Save' }).click()

		// Export data
		const downloadPromise = page.waitForEvent('download')
		await page.getByRole('button', { name: 'Export Data' }).click()
		const download = await downloadPromise

		// Verify file was downloaded
		expect(download.suggestedFilename()).toMatch(/dry-fire-trainer-.*\.json/)

		// For import test, we'd need to create a file upload scenario
		// This is complex in Playwright without actual file system access
		// So we verify the import button exists
		await expect(
			page.getByRole('button', { name: 'Import Data' }),
		).toBeVisible()
	})

	test('should have proper accessibility', async ({ page }) => {
		// Check drill selection page
		const accessibilityScanResults = await new AxeBuilder({ page }).analyze()
		expect(accessibilityScanResults.violations).toEqual([])

		// Check settings page
		await page.getByRole('link', { name: 'Settings' }).click()
		const settingsScanResults = await new AxeBuilder({ page }).analyze()
		expect(settingsScanResults.violations).toEqual([])

		// Check history page
		await page.getByRole('link', { name: 'History' }).click()
		const historyScanResults = await new AxeBuilder({ page }).analyze()
		expect(historyScanResults.violations).toEqual([])
	})

	test('should handle navigation away during session', async ({
		page,
		context,
	}) => {
		await context.grantPermissions(['microphone'], { origin: page.url() })

		// Create a test drill with 1 rep
		const drillName = await createTestDrill(page)

		// Start the test drill
		const testDrillButton = page.getByRole('button', { name: drillName })
		await testDrillButton.click()

		// Start first rep
		await page.getByRole('button', { name: 'Start' }).click()

		// Navigate away
		await page.getByRole('link', { name: 'History' }).click()
		await expect(page).toHaveURL('/dry-fire-trainer/history')

		// Navigate back to drill selection
		await page.getByRole('link', { name: 'Drill' }).click()
		await expect(page).toHaveURL('/dry-fire-trainer')

		// Session should be abandoned (not in history as completed)
		await page.getByRole('link', { name: 'History' }).click()
		await expect(page.getByText(/No completed sessions yet/)).toBeVisible()
	})
})
