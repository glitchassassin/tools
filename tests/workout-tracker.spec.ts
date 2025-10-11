import { readFile } from 'node:fs/promises'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Download, Locator, Page } from '@playwright/test'

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

function serializeModelData<T>(data: T) {
	return JSON.stringify({ version: 0, data })
}

async function readDownload(download: Download) {
	const stream = await download.createReadStream()
	if (stream) {
		let result = ''
		for await (const chunk of stream) {
			result += chunk.toString()
		}
		return result
	}
	const filePath = await download.path()
	if (!filePath) {
		throw new Error('Unable to read download contents')
	}
	return readFile(filePath, 'utf-8')
}

const DEFAULT_TEST_CONFIG = {
	templates: [
		{
			id: 'workout-a',
			name: 'Workout A',
			exercises: [
				{ id: 'squat', name: 'Squat', setCount: 5 },
				{ id: 'overhead-press', name: 'Overhead Press', setCount: 5 },
				{ id: 'deadlift', name: 'Deadlift', setCount: 1 },
			],
		},
		{
			id: 'workout-b',
			name: 'Workout B',
			exercises: [
				{ id: 'squat', name: 'Squat', setCount: 5 },
				{ id: 'bench-press', name: 'Bench Press', setCount: 5 },
				{ id: 'barbell-row', name: 'Barbell Row', setCount: 5 },
			],
		},
	],
	bonusLabel: 'Pull-ups',
	plates: [45, 35, 25, 10, 5, 2.5],
} satisfies {
	templates: Array<{
		id: string
		name: string
		exercises: Array<{
			id: string
			name: string
			setCount: number
		}>
	}>
	bonusLabel: string
	plates: number[]
}

async function importWorkoutData(
	page: Page,
	config: unknown,
	workouts: unknown,
) {
	const payload = {
		config: serializeModelData(config),
		workouts: serializeModelData(workouts),
	}
	const fileBuffer = Buffer.from(JSON.stringify(payload, null, 2), 'utf-8')

	await page
		.getByLabel('Import workout data file')
		.setInputFiles({
			name: 'workout-data.json',
			mimeType: 'application/json',
			buffer: fileBuffer,
		})

	await expect(
		page.getByText('Data imported successfully.'),
	).toBeVisible()
}

test.beforeEach(async ({ page }) => {
	await page.goto('/tools/workout/settings')
	await importWorkoutData(page, DEFAULT_TEST_CONFIG, {})
})

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
			;(navigatorRef as { clipboard: Partial<ClipboardAPI> }).clipboard = {}
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
	test('Chart.js renders history datasets with accessible legend', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 430, height: 932 })
		await recordHistoryWorkouts(page)
		await page.goto('/tools/workout/history')

		await runAxe(page)

		const chart = page.getByRole('img', {
			name: 'Workout history line chart',
		})
		await expect(chart).toBeVisible()

		const weightLegend = page.getByRole('list', { name: 'Weight datasets' })
		await expect(weightLegend.getByText('Squat', { exact: true })).toBeVisible()
		await expect(
			weightLegend.getByText('Bench Press', { exact: true }),
		).toBeVisible()
	})

	test('Includes bonus reps dataset in the legend', async ({ page }) => {
		await page.setViewportSize({ width: 430, height: 932 })
		await recordHistoryWorkouts(page)
		await page.goto('/tools/workout/history')

		const bonusLegend = page.getByRole('list', { name: 'Bonus datasets' })
		await expect(
			bonusLegend.getByText('Pull-ups', { exact: true }),
		).toBeVisible()
		await expect(
			page.getByText(
				'Weight uses the left axis; bonus reps use the right axis.',
			),
		).toBeVisible()
	})

	test('Empty history shows helper text', async ({ page }) => {
		await page.setViewportSize({ width: 430, height: 932 })
		await page.goto('/tools/workout/history')

		await expect(
			page.getByRole('img', { name: 'Workout history line chart' }),
		).toHaveCount(0)
		await expect(page.getByText('No historical data yet.')).toBeVisible()
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

	test('Export data downloads stored strings', async ({ page }) => {
		await page.setViewportSize({ width: 430, height: 932 })

		const workoutDate = '2025-07-12'
		await page.goto(`/tools/workout/workout/${workoutDate}`)

		await runAxe(page)

		await setExerciseWeight(page, 'Squat', '205')
		await setExerciseReps(page, 'Squat', [5, 5, 5, 5, 5])

		await page.goto('/tools/workout/settings')
		await runAxe(page)

		const downloadPromise = page.waitForEvent('download')
		await page.getByRole('button', { name: 'Export data' }).click()
		const download = await downloadPromise
		await expect(download.suggestedFilename()).toMatch(
			/workout-tracker-data-.*\.json/,
		)

		const fileContents = await readDownload(download)
		const snapshot = JSON.parse(fileContents) as {
			config: string
			workouts: string
		}

		const configSnapshot = JSON.parse(snapshot.config) as {
			data: typeof DEFAULT_TEST_CONFIG
		}
		expect(configSnapshot.data).toEqual(DEFAULT_TEST_CONFIG)

		const workoutsSnapshot = JSON.parse(snapshot.workouts) as {
			data: Record<
				string,
				{
					templateId: string
					exercises: Array<{
						id: string
						weight: number | null
						sets: Array<{ reps: number }>
					}>
				}
			>
		}
		const exportedWorkout = workoutsSnapshot.data[workoutDate]
		expect(exportedWorkout).toBeDefined()
		expect(exportedWorkout?.templateId).toBe('workout-a')
		const squatEntry = exportedWorkout?.exercises.find(
			(exercise) => exercise.id === 'squat',
		)
		expect(squatEntry?.weight).toBe(205)

		await expect(
			page.getByText('Data exported. Download started.'),
		).toBeVisible()
	})

	test('Import data updates settings and workouts', async ({ page }) => {
		await page.setViewportSize({ width: 430, height: 932 })
		await page.goto('/tools/workout/settings')
		await runAxe(page)

		const importConfig = {
			templates: [
				{
					id: 'body-comp',
					name: 'Body Composition',
					exercises: [
						{ id: 'romanian-deadlift', name: 'Romanian Deadlift', setCount: 3 },
						{ id: 'incline-press', name: 'Incline Press', setCount: 4 },
					],
				},
				{
					id: 'stability-day',
					name: 'Stability Day',
					exercises: [
						{ id: 'single-leg-squat', name: 'Single-leg Squat', setCount: 3 },
					],
				},
			],
			bonusLabel: 'Farmer Carries',
			plates: [35, 25, 10, 5],
		}
		const importWorkouts = {
			'2025-06-10': {
				date: '2025-06-10',
				templateId: 'body-comp',
				exercises: [
					{
						id: 'romanian-deadlift',
						weight: 205,
						sets: [{ reps: 10 }, { reps: 10 }, { reps: 10 }],
					},
					{
						id: 'incline-press',
						weight: 155,
						sets: [{ reps: 8 }, { reps: 8 }, { reps: 8 }, { reps: 8 }],
					},
				],
				bonusReps: 6,
			},
		}
		const payload = {
			config: serializeModelData(importConfig),
			workouts: serializeModelData(importWorkouts),
		}
		const fileBuffer = Buffer.from(JSON.stringify(payload, null, 2), 'utf-8')

		await page.getByLabel('Import workout data file').setInputFiles({
			name: 'import.json',
			mimeType: 'application/json',
			buffer: fileBuffer,
		})

		await expect(page.getByText('Data imported successfully.')).toBeVisible()

		const templateNameField = page.getByLabel('Name for template 1')
		await expect(templateNameField).toHaveValue(importConfig.templates[0]!.name)

		const firstExerciseField = page.getByLabel('Exercise name').first()
		await expect(firstExerciseField).toHaveValue(
			importConfig.templates[0]!.exercises[0]!.name,
		)

		const platesField = page.getByRole('textbox', {
			name: 'Plate denominations',
		})
		await expect(platesField).toHaveValue(importConfig.plates.join(', '))

		await page.goto('/tools/workout/workout/2025-06-10')

		const romanianSection = await exerciseSection(
			page,
			importConfig.templates[0]!.exercises[0]!.name,
		)
		await expect(romanianSection.getByLabel('Weight (lb)')).toHaveValue(
			String(importWorkouts['2025-06-10']!.exercises[0]!.weight),
		)

		const repsInputs = romanianSection.getByRole('spinbutton', {
			name: /reps for set/i,
		})
		await expect(repsInputs).toHaveCount(3)
	})

	test('Import rejects malformed JSON files', async ({ page }) => {
		await page.setViewportSize({ width: 430, height: 932 })
		await page.goto('/tools/workout/settings')

		const invalidBuffer = Buffer.from('{', 'utf-8')
		await page.getByLabel('Import workout data file').setInputFiles({
			name: 'broken.json',
			mimeType: 'application/json',
			buffer: invalidBuffer,
		})

		await expect(
			page.getByText('Import failed: file does not contain valid JSON.'),
		).toBeVisible()

		const templateNameField = page.getByLabel('Name for template 1')
		await expect(templateNameField).toHaveValue('Workout A')
	})

	test('Import rejects files missing required keys', async ({ page }) => {
		await page.setViewportSize({ width: 430, height: 932 })
		await page.goto('/tools/workout/settings')

		const missingKeys = Buffer.from(
			JSON.stringify({ config: '{}' }, null, 2),
			'utf-8',
		)
		await page.getByLabel('Import workout data file').setInputFiles({
			name: 'missing-keys.json',
			mimeType: 'application/json',
			buffer: missingKeys,
		})

		await expect(
			page.getByText(
				'Import failed: file must include config and workouts strings.',
			),
		).toBeVisible()

		const templateNameField = page.getByLabel('Name for template 1')
		await expect(templateNameField).toHaveValue('Workout A')
	})
})
