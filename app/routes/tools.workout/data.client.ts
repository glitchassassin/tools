import { format as formatDate, isValid, parse } from 'date-fns'
import { useEffect, useMemo } from 'react'
import { z } from 'zod'
import { declareModel } from '~/hooks/declareModel'
import { useLocalData } from '~/hooks/useLocalData.client'

const WorkoutExerciseConfigSchema = z.object({
	id: z.string(),
	name: z.string(),
	setCount: z.number().int().min(1).max(10),
})

const WorkoutTemplateSchema = z.object({
	id: z.string(),
	name: z.string(),
	exercises: z.array(WorkoutExerciseConfigSchema).min(1),
})

const WorkoutExerciseSetSchema = z.object({
	reps: z.number().int().min(0).max(1000),
})

const WorkoutExerciseEntrySchema = z.object({
	id: z.string(),
	weight: z.number().min(0).max(1500).nullable(),
	sets: z.array(WorkoutExerciseSetSchema),
})

const WorkoutEntrySchema = z.object({
	date: z.string(),
	templateId: z.string(),
	exercises: z.array(WorkoutExerciseEntrySchema),
	bonusReps: z.number().int().min(0).max(500).nullable(),
})

const WorkoutConfigSchema = z.object({
	templates: z.array(WorkoutTemplateSchema).min(1),
	bonusLabel: z.string(),
	plates: z.array(z.number().positive().max(200)).min(1),
})

const WorkoutEntriesSchema = z.record(z.string(), WorkoutEntrySchema)

const WorkoutTrackerSchema = z.object({
	config: WorkoutConfigSchema,
	workouts: WorkoutEntriesSchema,
})

export type WorkoutTrackerData = z.infer<typeof WorkoutTrackerSchema>
export type WorkoutTemplate = z.infer<typeof WorkoutTemplateSchema>
export type WorkoutExerciseConfig = z.infer<typeof WorkoutExerciseConfigSchema>
export type WorkoutEntry = z.infer<typeof WorkoutEntrySchema>
export type WorkoutExerciseEntry = z.infer<typeof WorkoutExerciseEntrySchema>
export type WorkoutTrackerSerializedData = {
	config: string
	workouts: string
}

const DEFAULT_CONFIG: WorkoutTrackerData['config'] = {
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
}

const DEFAULT_WORKOUTS: WorkoutTrackerData['workouts'] = {}

const DEFAULT_DATA: WorkoutTrackerData = {
	config: DEFAULT_CONFIG,
	workouts: DEFAULT_WORKOUTS,
}

const WorkoutConfigModel = declareModel({
	model: WorkoutConfigSchema,
	defaultValue: DEFAULT_CONFIG,
})

const WorkoutEntriesModel = declareModel({
	model: WorkoutEntriesSchema,
	defaultValue: DEFAULT_WORKOUTS,
})

const WorkoutTrackerModel = declareModel({
	model: WorkoutTrackerSchema,
	defaultValue: DEFAULT_DATA,
})

const WORKOUT_CONFIG_STORAGE_KEY = 'workout-tracker-config'
const WORKOUT_ENTRIES_STORAGE_KEY = 'workout-tracker-workouts'
const WORKOUT_LEGACY_STORAGE_KEY = 'workout-tracker'

type WorkoutTrackerHelpers = {
	getWorkout: (date: string) => WorkoutEntry | null
	ensureWorkout: (date: string) => WorkoutEntry
	setWorkout: (date: string, workout: WorkoutEntry) => void
	upsertWorkout: (
		date: string,
		builder: (draft: WorkoutEntry) => WorkoutEntry,
	) => void
	deleteWorkout: (date: string) => void
	updateConfig: (config: WorkoutTrackerData['config']) => void
	exportSerializedData: () => WorkoutTrackerSerializedData
	importSerializedData: (data: WorkoutTrackerSerializedData) => void
}

type SetWorkoutEntries = (
	value:
		| WorkoutTrackerData['workouts']
		| ((prev: WorkoutTrackerData['workouts']) => WorkoutTrackerData['workouts']),
) => void

export function useWorkoutTracker() {
	const [config, setConfig] = useLocalData(
		WORKOUT_CONFIG_STORAGE_KEY,
		WorkoutConfigModel,
	)
	const [workouts, setWorkouts] = useLocalData(
		WORKOUT_ENTRIES_STORAGE_KEY,
		WorkoutEntriesModel,
	)

	useEffect(() => {
		const legacySerialized = window.localStorage.getItem(
			WORKOUT_LEGACY_STORAGE_KEY,
		)
		if (!legacySerialized) return
		const hasConfig = window.localStorage.getItem(WORKOUT_CONFIG_STORAGE_KEY)
		const hasWorkouts = window.localStorage.getItem(
			WORKOUT_ENTRIES_STORAGE_KEY,
		)
		if (hasConfig || hasWorkouts) {
			window.localStorage.removeItem(WORKOUT_LEGACY_STORAGE_KEY)
			return
		}

		const legacy = WorkoutTrackerModel.parse(legacySerialized)
		setConfig(legacy.config)
		setWorkouts(legacy.workouts)
		window.localStorage.removeItem(WORKOUT_LEGACY_STORAGE_KEY)
	}, [setConfig, setWorkouts])

	const data = useMemo<WorkoutTrackerData>(
		() => ({
			config,
			workouts,
		}),
		[config, workouts],
	)

	console.log(data)

	const helpers = useMemo<WorkoutTrackerHelpers>(
		() => ({
			getWorkout(date: string) {
				return data.workouts[date] ?? null
			},
			ensureWorkout(date: string) {
				const existing = data.workouts[date]
				if (existing) return existing
				let created: WorkoutEntry | null = null
				setWorkouts((prev) => {
					if (prev[date]) {
						created = prev[date]!
						return prev
					}
					const nextWorkout = createWorkoutEntry(
						{ config, workouts: prev },
						date,
					)
					created = nextWorkout
					return {
						...prev,
						[date]: nextWorkout,
					}
				})
				return created ?? createWorkoutEntry(data, date)
			},
			setWorkout(date: string, workout: WorkoutEntry) {
				setWorkouts((prev) => ({
					...prev,
					[date]: workout,
				}))
			},
			upsertWorkout(
				date: string,
				builder: (draft: WorkoutEntry) => WorkoutEntry,
			) {
				setWorkouts((prev) => {
					const existing =
						prev[date] ??
						createWorkoutEntry({ config, workouts: prev }, date)
					const nextWorkout = builder(existing)
					return {
						...prev,
						[date]: nextWorkout,
					}
				})
			},
			deleteWorkout(date: string) {
				setWorkouts((prev) => {
					const { [date]: _removed, ...rest } = prev
					return rest
				})
			},
			updateConfig(config: WorkoutTrackerData['config']) {
				setConfig(config)
				setWorkouts((prev) => reconcileWorkoutsWithConfig(prev, config))
			},
			exportSerializedData() {
				const ensureSerializedValue = (
					key: string,
					fallback: () => string,
				) => {
					const existing = window.localStorage.getItem(key)
					if (existing != null) {
						return existing
					}
					const computed = fallback()
					window.localStorage.setItem(key, computed)
					return computed
				}

				const configSerialized = ensureSerializedValue(
					WORKOUT_CONFIG_STORAGE_KEY,
					() => WorkoutConfigModel.stringify(config),
				)
				const workoutsSerialized = ensureSerializedValue(
					WORKOUT_ENTRIES_STORAGE_KEY,
					() => WorkoutEntriesModel.stringify(workouts),
				)

				return {
					config: configSerialized,
					workouts: workoutsSerialized,
				}
			},
			importSerializedData(serialized) {
				const nextConfig = WorkoutConfigModel.parse(serialized.config)
				const nextWorkouts = WorkoutEntriesModel.parse(serialized.workouts)
				const reconciled = reconcileWorkoutsWithConfig(
					nextWorkouts,
					nextConfig,
				)
				setConfig(nextConfig)
				setWorkouts(reconciled)
			},
		}),
		[config, data, setConfig, setWorkouts, workouts],
	)

	return [data, helpers] as const
}

export function createWorkoutEntry(
	data: WorkoutTrackerData,
	date: string,
): WorkoutEntry {
	const template = resolveTemplateForDate(data, date)
	const previousDates = Object.keys(data.workouts)
		.filter((candidate) => candidate < date)
		.sort((a, b) => (a > b ? -1 : a < b ? 1 : 0))

	const findPreviousWeight = (exerciseId: string) => {
		for (const previousDate of previousDates) {
			const workout = data.workouts[previousDate]
			const exercise = workout?.exercises.find(
				(entry) => entry.id === exerciseId && entry.weight != null,
			)
			if (exercise && exercise.weight != null) {
				return exercise.weight
			}
		}
		return null
	}

	return {
		date,
		templateId: template.id,
		exercises: template.exercises.map((exercise) => ({
			id: exercise.id,
			weight: (() => {
				const previousWeight = findPreviousWeight(exercise.id)
				return previousWeight != null ? previousWeight + 5 : null
			})(),
			sets: Array.from({ length: exercise.setCount }, () => ({ reps: 0 })),
		})),
		bonusReps: null,
	}
}

export function resolveTemplateForDate(
	data: WorkoutTrackerData,
	date: string,
): WorkoutTemplate {
	const { templates } = data.config
	if (templates.length === 0) {
		throw new Error('No workout templates configured')
	}

	const orderedDates = Object.keys(data.workouts)
		.filter((candidate) => candidate < date)
		.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
	const previous = orderedDates.at(-1)

	if (!previous) {
		return templates[0]!
	}

	const previousWorkout = data.workouts[previous]
	const previousIndex = templates.findIndex(
		(template) => template.id === previousWorkout.templateId,
	)

	if (previousIndex < 0) {
		return templates[0]!
	}

	const nextIndex = (previousIndex + 1) % templates.length
	return templates[nextIndex]!
}

export function ensureWorkoutExists(
	data: WorkoutTrackerData,
	date: string,
	setWorkouts: SetWorkoutEntries,
): WorkoutEntry {
	const existing = data.workouts[date]
	if (existing) {
		return existing
	}

	let created: WorkoutEntry | null = null
	setWorkouts((prev) => {
		const current = prev[date]
		if (current) {
			created = current
			return prev
		}

		const nextWorkout = createWorkoutEntry(
			{ config: data.config, workouts: prev },
			date,
		)
		created = nextWorkout
		return {
			...prev,
			[date]: nextWorkout,
		}
	})
	return created ?? createWorkoutEntry(data, date)
}

export function summarizeSets(exercise: WorkoutExerciseEntry) {
	const groups: Array<{ reps: number; count: number }> = []

	for (const set of exercise.sets) {
		const last = groups.at(-1)
		if (last && last.reps === set.reps) {
			last.count += 1
		} else {
			groups.push({ reps: set.reps, count: 1 })
		}
	}

	return groups
}

export function formatWorkoutSummary(
	workout: WorkoutEntry,
	template: WorkoutTemplate,
	config: WorkoutTrackerData['config'],
) {
	const templateExercises = new Map(
		template.exercises.map((exercise) => [exercise.id, exercise]),
	)

	const lines: string[] = []
	for (const exercise of workout.exercises) {
		const templateExercise = templateExercises.get(exercise.id)
		const label = templateExercise?.name ?? exercise.id
		if (exercise.weight == null) continue

		const groups = summarizeSets(exercise)
		const setsSummary = groups
			.map((group) => `${exercise.weight}x${group.count}x${group.reps}`)
			.join(', ')
		lines.push(`${label}: ${setsSummary}`)
	}

	if (config.bonusLabel && workout.bonusReps != null) {
		lines.push(`${config.bonusLabel}: ${workout.bonusReps} reps`)
	}

	return lines.join('\n')
}

export function calculatePlateBreakdown(totalWeight: number, plates: number[]) {
	if (totalWeight <= 45) {
		return { perSide: [] as number[], exact: totalWeight === 45 }
	}

	const perSide = (totalWeight - 45) / 2
	if (perSide <= 0) {
		return { perSide: [] as number[], exact: totalWeight === 45 }
	}

	let remaining = perSide
	const result: number[] = []
	const sortedPlates = [...plates].sort((a, b) => b - a)

	for (const plate of sortedPlates) {
		const count = Math.floor((remaining + 1e-6) / plate)
		if (count > 0) {
			for (let i = 0; i < count; i += 1) {
				result.push(plate)
			}
			remaining = Math.max(0, remaining - plate * count)
		}
	}

	return {
		perSide: result,
		exact: remaining <= 1e-3,
	}
}

export function getMaxWeightByExercise(data: WorkoutTrackerData) {
	const result = new Map<string, number>()
	for (const workout of Object.values(data.workouts)) {
		for (const exercise of workout.exercises) {
			if (exercise.weight == null) continue
			const current = result.get(exercise.id) ?? 0
			if (exercise.weight > current) {
				result.set(exercise.id, exercise.weight)
			}
		}
	}
	return result
}

export function formatDisplayDate(date: string) {
	const parsed = parse(date, 'yyyy-MM-dd', new Date())
	if (!isValid(parsed) || formatDate(parsed, 'yyyy-MM-dd') !== date) {
		return date
	}
	return formatDate(parsed, 'M/d/yyyy')
}

export function toDateKey(date: Date) {
	return formatDate(date, 'yyyy-MM-dd')
}

export function parseDateKey(value: string) {
	const parsed = parse(value, 'yyyy-MM-dd', new Date())
	if (!isValid(parsed) || formatDate(parsed, 'yyyy-MM-dd') !== value) {
		return new Date(NaN)
	}
	return parsed
}

export function getTodayKey() {
	return toDateKey(new Date())
}

export function alignWorkoutWithTemplate(
	workout: WorkoutEntry,
	template: WorkoutTemplate,
): WorkoutEntry {
	const templateExercises = new Map(
		template.exercises.map((exercise) => [exercise.id, exercise]),
	)

	const exercises: WorkoutExerciseEntry[] = []
	let changed = workout.templateId !== template.id

	const workoutExercisesMap = new Map(
		workout.exercises.map((exercise) => [exercise.id, exercise]),
	)

	for (const [exerciseId, templateExercise] of templateExercises) {
		const existing = workoutExercisesMap.get(exerciseId)
		const sets = Array.from(
			{ length: templateExercise.setCount },
			(_, index) => ({
				reps: existing?.sets[index]?.reps ?? 0,
			}),
		)

		if (!existing) {
			changed = true
		} else {
			if (existing.sets.length !== sets.length) {
				changed = true
			} else {
				for (let i = 0; i < sets.length; i += 1) {
					if (existing.sets[i]?.reps !== sets[i]!.reps) {
						changed = true
						break
					}
				}
			}
		}

		exercises.push({
			id: exerciseId,
			weight: existing?.weight ?? null,
			sets,
		})
	}

	if (workout.exercises.length !== exercises.length) {
		changed = true
	}

	if (!changed && exercises.length === workout.exercises.length) {
		let allMatch = true
		for (const exercise of exercises) {
			const existing = workoutExercisesMap.get(exercise.id)
			if (!existing) {
				allMatch = false
				break
			}
			if (existing.weight !== exercise.weight) {
				allMatch = false
				break
			}
			if (existing.sets.length !== exercise.sets.length) {
				allMatch = false
				break
			}
			for (let i = 0; i < exercise.sets.length; i += 1) {
				if (existing.sets[i]?.reps !== exercise.sets[i]!.reps) {
					allMatch = false
					break
				}
			}
			if (!allMatch) break
		}
		if (allMatch && workout.templateId === template.id) {
			return workout
		}
	}

	return {
		...workout,
		templateId: template.id,
		exercises,
	}
}

export function reconcileWorkoutsWithConfig(
	workouts: Record<string, WorkoutEntry>,
	config: WorkoutTrackerData['config'],
) {
	const templates = new Map(
		config.templates.map((template) => [template.id, template]),
	)
	const updatedEntries: Record<string, WorkoutEntry> = {}

	for (const [date, workout] of Object.entries(workouts)) {
		const template = templates.get(workout.templateId) ?? config.templates[0]
		if (!template) continue
		updatedEntries[date] = alignWorkoutWithTemplate(workout, template)
	}

	return updatedEntries
}

export { WorkoutConfigModel, WorkoutEntriesModel, WorkoutTrackerModel }
