import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

type ClipboardAPI = {
	writeText?: (text: string) => Promise<void>
}

type NavigatorWithClipboard = {
	clipboard?: ClipboardAPI
}

type GlobalWithClipboard = typeof globalThis & {
	__copiedText__?: string
	navigator?: NavigatorWithClipboard
}

function dateKey(date: Date) {
	const year = date.getFullYear()
	const month = `${date.getMonth() + 1}`.padStart(2, '0')
	const day = `${date.getDate()}`.padStart(2, '0')
	return `${year}-${month}-${day}`
}

function formatDateKeyDisplay(key: string) {
	const [yearStr, monthStr, dayStr] = key.split('-')
	const year = Number.parseInt(yearStr ?? '', 10)
	const month = Number.parseInt(monthStr ?? '', 10)
	const day = Number.parseInt(dayStr ?? '', 10)
	if (
		!Number.isFinite(year) ||
		!Number.isFinite(month) ||
		!Number.isFinite(day)
	) {
		return key
	}
	return `${month}/${day}/${year}`
}

async function runAxe(page: Page) {
	const results = await new AxeBuilder({ page }).analyze()
	expect(results.violations).toEqual([])
}

function escapeForRegex(text: string) {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function exerciseToggle(page: Page, exerciseName: string): Locator {
	const pattern = escapeForRegex(exerciseName)
	return page.getByRole('button', {
		name: new RegExp(`Exercise.*${pattern}`, 'i'),
	})
}

async function ensureExerciseOpen(page: Page, exerciseName: string) {
	const toggle = exerciseToggle(page, exerciseName)
	const expanded = await toggle.getAttribute('aria-expanded')
	if (expanded !== 'true') {
		await toggle.click()
	}
	return toggle
}

async function exerciseSection(page: Page, exerciseName: string) {
	await ensureExerciseOpen(page, exerciseName)
	return page.getByRole('article').filter({ hasText: exerciseName })
}

async function setExerciseWeight(
	page: Page,
	exerciseName: string,
	weight: string,
) {
	const section = await exerciseSection(page, exerciseName)
	const weightInput = section.getByLabel('Weight (lb)')
	await weightInput.fill(weight)
	await expect(weightInput).toHaveValue(weight)
}

async function setExerciseReps(
	page: Page,
	exerciseName: string,
	reps: number[],
) {
	const section = await exerciseSection(page, exerciseName)
	for (let index = 0; index < reps.length; index += 1) {
		const input = section.getByRole('spinbutton', {
			name: new RegExp(`reps for set ${index + 1}`, 'i'),
		})
		await input.fill(String(reps[index] ?? 0))
		await expect(input).toHaveValue(String(reps[index] ?? 0))
	}
}

async function setBonusReps(page: Page, value: string) {
	const bonusInput = page.getByLabel(/^Reps$/i)
	await bonusInput.fill(value)
	await expect(bonusInput).toHaveValue(value)
}

async function interceptClipboard(page: Page) {
	await page.addInitScript(() => {
		const globalRef = globalThis as GlobalWithClipboard
		globalRef.__copiedText__ = ''

		const navigatorRef = globalRef.navigator ?? ({} as NavigatorWithClipboard)
		if (!navigatorRef.clipboard) {
			;(navigatorRef as { clipboard: Partial<ClipboardAPI> }).clipboard =
				{}
		}

		const clipboardRef = navigatorRef.clipboard as ClipboardAPI
		const originalWrite =
			typeof clipboardRef.writeText === 'function'
				? clipboardRef.writeText.bind(clipboardRef)
				: null

		clipboardRef.writeText = async (text: string) => {
			globalRef.__copiedText__ = text
			if (!originalWrite) return
			try {
				await originalWrite(text)
			} catch {
				// ignore downstream clipboard errors in tests
			}
		}
	})
}

async function recordHistoryWorkouts(page: Page) {
	await page.goto('/tools/workout/workout/2025-03-01')
	await setExerciseWeight(page, 'Squat', '185')
	await setExerciseWeight(page, 'Overhead Press', '95')
	await setExerciseWeight(page, 'Deadlift', '225')
	await setBonusReps(page, '5')

	await page.goto('/tools/workout/workout/2025-03-03')
	await setExerciseWeight(page, 'Squat', '190')
	await setExerciseWeight(page, 'Bench Press', '165')
	await setExerciseWeight(page, 'Barbell Row', '155')
	await setBonusReps(page, '6')
}

test.describe('Workout Tracker – Index Route', () => {
	test('Start a fresh workout from the landing page', async ({ page }) => {
		await page.setViewportSize({ width: 430, height: 932 })
		await page.goto('/tools/workout')

		await runAxe(page)

		const button = page.getByRole('button', { name: 'Start Workout' })
		await expect(button).toBeVisible()

		const today = dateKey(new Date())
		await button.click()
		await expect(page).toHaveURL(`/tools/workout/workout/${today}`)
	})

	test('Continue an in-progress workout', async ({ page }) => {
		await page.setViewportSize({ width: 430, height: 932 })
		await page.goto('/tools/workout')
		await runAxe(page)

		const startButton = page.getByRole('button', { name: 'Start Workout' })
		await startButton.click()
		await setExerciseWeight(page, 'Squat', '205')
		await setExerciseReps(page, 'Squat', [5, 5, 5, 5, 5])

		await page.goto('/tools/workout')

		const button = page.getByRole('button', { name: 'Finish Workout' })
		await expect(button).toBeVisible()

		const squatRecord = page
			.locator('li')
			.filter({ hasText: 'Squat' })
			.filter({ hasText: '205 lb' })
		await expect(squatRecord).toBeVisible()
	})
})

test.describe('Workout Tracker – Current Workout Route', () => {
	test('Auto-create a workout for a new date', async ({ page }) => {
		await page.setViewportSize({ width: 430, height: 932 })
		const date = '2025-01-05'
		await page.goto(`/tools/workout/workout/${date}`)

		await runAxe(page)

		const exercises = page.locator('article')
		await expect(exercises.first()).toHaveAttribute('class', /shadow-soft/)
		await expect(exercises.first().locator('> button')).toHaveAttribute(
			'aria-expanded',
			'true',
		)
		await expect(exercises.nth(1).locator('> button')).toHaveAttribute(
			'aria-expanded',
			'false',
		)
	})

	test('Default weights and active exercise behavior', async ({ page }) => {
		const previousDate = '2025-01-01'
		const targetDate = '2025-01-03'

		await page.setViewportSize({ width: 430, height: 932 })
		await page.goto(`/tools/workout/workout/${previousDate}`)
		await setExerciseWeight(page, 'Squat', '150')
		await setExerciseReps(page, 'Squat', [5, 5, 5, 5, 5])

		await page.goto(`/tools/workout/workout/${targetDate}`)

		const squatWeight = page.getByLabel('Weight (lb)')
		await expect(squatWeight).toHaveValue('155')

		const squatAccordion = page.getByRole('button', {
			name: /Exercise.*Squat/i,
		})
		const benchAccordion = page.getByRole('button', {
			name: /Exercise.*Bench Press/i,
		})
		await benchAccordion.click()

		await expect(squatAccordion).toHaveAttribute('aria-expanded', 'false')
		await expect(benchAccordion).toHaveAttribute('aria-expanded', 'true')
	})

	test('Plate math helper reflects entered weight', async ({ page }) => {
		const date = '2025-02-01'

		await page.setViewportSize({ width: 430, height: 932 })
		await page.goto(`/tools/workout/workout/${date}`)
		await setExerciseWeight(page, 'Squat', '150')

		const squatSection = await exerciseSection(page, 'Squat')
		await expect(squatSection.getByText('45 + 5 + 2.5')).toBeVisible()
	})

	test('Reps spinner supports keyboard and pointer interactions', async ({
		page,
	}) => {
		const date = '2025-02-10'
		await page.setViewportSize({ width: 1280, height: 720 })
		await page.goto(`/tools/workout/workout/${date}`)
		await runAxe(page)

		const weightInput = page.getByLabel('Weight (lb)')
		await weightInput.focus()
		await page.keyboard.press('Tab')

		const firstRepsInput = page.getByRole('spinbutton', {
			name: /reps for set 1/i,
		})
		await expect(firstRepsInput).toBeFocused()
		await page.keyboard.press('Shift+Tab')
		await expect(weightInput).toBeFocused()
		await page.keyboard.press('Tab')
		await expect(firstRepsInput).toBeFocused()

		await firstRepsInput.fill('3')
		await page.keyboard.press('ArrowUp')
		await page.keyboard.press('ArrowUp')
		await expect(firstRepsInput).toHaveValue('5')

		const otherExercise = page.getByRole('button', {
			name: /Exercise.*Overhead Press/i,
		})
		await otherExercise.click()
		const squatHeader = page.getByRole('button', {
			name: /Exercise.*Squat/i,
		})
		await squatHeader.click()

		const refreshedRepsInput = page.getByRole('spinbutton', {
			name: /reps for set 1/i,
		})
		await expect(refreshedRepsInput).toHaveValue('5')

		const incrementButton = page.getByRole('button', {
			name: 'Increase reps for set 1',
		})
		const decrementButton = page.getByRole('button', {
			name: 'Decrease reps for set 1',
		})
		await expect(incrementButton).toHaveAttribute('tabindex', '-1')
		await incrementButton.click()
		await expect(refreshedRepsInput).toHaveValue('6')
		await expect(refreshedRepsInput).toBeFocused()
		await expect(decrementButton).toHaveAttribute('tabindex', '-1')
		await decrementButton.click()
		await expect(refreshedRepsInput).toHaveValue('5')
		await expect(refreshedRepsInput).toBeFocused()

		await refreshedRepsInput.fill('1')
		await page.keyboard.press('ArrowDown')
		await page.keyboard.press('ArrowDown')
		await expect(refreshedRepsInput).toHaveValue('0')
		await expect(decrementButton).toBeDisabled()
	})

	test('Copy workout summary to clipboard', async ({ page }) => {
		const date = '2025-02-15'
		await interceptClipboard(page)
		await page.setViewportSize({ width: 430, height: 932 })
		await page.goto(`/tools/workout/workout/${date}`)

		await setExerciseWeight(page, 'Squat', '150')
		await setExerciseReps(page, 'Squat', [5, 5, 5, 5, 4])
		await setBonusReps(page, '7')

		await page.getByRole('button', { name: 'Copy Workout' }).click()
		await expect(page.getByText('Copied to clipboard')).toBeVisible()

		const copied = await page.evaluate(() => {
			const globalRef = globalThis as typeof globalThis & {
				__copiedText__?: string
			}
			return globalRef.__copiedText__ ?? ''
		})
		const displayDate = formatDateKeyDisplay(date)
		expect(copied).toContain(`${displayDate} | Workout A`)
		expect(copied).toContain('Squat: 150x4x5, 150x1x4')
		expect(copied).toContain('Pull-ups: 7 reps')
	})

	test('Delete workout confirmation flow', async ({ page }) => {
		const date = '2025-02-20'
		const previousDate = '2025-02-18'
		await page.setViewportSize({ width: 430, height: 932 })
		await page.goto(`/tools/workout/workout/${previousDate}`)
		await setExerciseWeight(page, 'Squat', '150')

		await page.goto(`/tools/workout/workout/${date}`)
		await setExerciseWeight(page, 'Squat', '150')

		page.once('dialog', (dialog) => dialog.accept())
		await page.getByRole('button', { name: 'Delete Workout' }).click()
		await expect(page).toHaveURL('/tools/workout')
		await expect(
			page.getByRole('button', { name: 'Start Workout' }),
		).toBeVisible()

		await page.goto(`/tools/workout/workout/${date}`)
		const weightInput = page.getByLabel('Weight (lb)')
		await expect(weightInput).toHaveValue('155')
	})
})

test.describe('Workout Tracker – History Route', () => {
	test('Chart displays trends for each exercise and bonus reps', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 430, height: 932 })
		await recordHistoryWorkouts(page)
		await page.goto('/tools/workout/history')

		await runAxe(page)

		const svg = page.locator('svg[aria-label="Workout history line chart"]')
		await expect(svg).toBeVisible()
		await expect(svg.locator('path').first()).toBeVisible()
		await expect(svg.locator('circle')).toHaveCount(8)
	})

	test('Workout log navigation', async ({ page }) => {
		await page.setViewportSize({ width: 430, height: 932 })
		await recordHistoryWorkouts(page)
		await page.goto('/tools/workout/history')

		const logEntry = page.getByRole('link', {
			name: /3\/3\/2025/,
		})
		await expect(logEntry).toContainText('Bench Press')

		await logEntry.click()
		await expect(page).toHaveURL('/tools/workout/workout/2025-03-03')
	})
})

test.describe('Workout Tracker – Settings Route', () => {
	test('Customize workout templates and bonus reps label', async ({ page }) => {
		await page.setViewportSize({ width: 430, height: 932 })
		await page.goto('/tools/workout/settings')

		await runAxe(page)

		const squatInput = page.getByLabel('Exercise name').first()
		await squatInput.fill('Front Squat')
		await expect(squatInput).toHaveValue('Front Squat')
		await squatInput.press('Tab')

		const setInput = page.getByLabel('Sets').first()
		await setInput.fill('3')
		await expect(setInput).toHaveValue('3')
		await setInput.press('Tab')

		const bonusInput = page.getByLabel('Description (leave blank to hide)')
		await bonusInput.fill('Chin-ups')
		await expect(bonusInput).toHaveValue('Chin-ups')
		await bonusInput.press('Tab')

		await page.getByRole('button', { name: 'Save settings' }).click()
		await expect(
			page.getByText('Settings saved. Existing workouts updated to match.'),
		).toBeVisible()

		const date = '2025-04-01'
		await page.goto(`/tools/workout/workout/${date}`)
		await expect(page.getByText('Front Squat')).toBeVisible()

		const repInputs = page
			.locator('article')
			.first()
			.getByRole('spinbutton', { name: /reps for set/i })
		await expect(repInputs).toHaveCount(3)
		await expect(page.getByText('Chin-ups')).toBeVisible()
	})
	test('Adjust available plate denominations', async ({ page }) => {
		await page.setViewportSize({ width: 430, height: 932 })
		await page.goto('/tools/workout/workout/2025-04-10')
		await setExerciseWeight(page, 'Squat', '107.5')

		await page.goto('/tools/workout/settings')

		const platesField = page.getByRole('textbox', {
			name: 'Plate denominations',
		})
		await expect(platesField).toHaveValue(/45/)
		await expect(
			page.getByText('Settings saved. Existing workouts updated to match.'),
		).not.toBeVisible()

		await platesField.fill('45, 25, 10, 5, 1.25')
		await page.getByRole('button', { name: 'Save settings' }).click()
		await expect(
			page.getByText('Settings saved. Existing workouts updated to match.'),
		).toBeVisible()

		await page.goto('/tools/workout/workout/2025-04-10')
		const squatWeight = page.getByLabel('Weight (lb)')
		await expect(squatWeight).toHaveValue('107.5')
		await expect(
			page.getByRole('article').filter({ hasText: 'Squat' }),
		).toContainText('25 + 5 + 1.25')

		await page.reload()
		await expect(
			page.getByRole('article').filter({ hasText: 'Squat' }),
		).toContainText('25 + 5 + 1.25')
	})
})
