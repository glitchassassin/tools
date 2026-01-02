import { format as formatDate, isValid, parse } from 'date-fns'
import type { WorkoutEntry, WorkoutExerciseEntry, WorkoutTemplate } from './data.server'

export function slugify(text: string) {
	return text
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, '')
		.replace(/[\s_-]+/g, '-')
		.replace(/^-+|-+$/g, '')
}

export function getMaxWeightByExercise(data: { workouts: Record<string, WorkoutEntry> }) {
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
	config: { bonusLabel: string },
) {
	const templateExercises = new Map(
		template.exercises.map((exercise) => [exercise.id, exercise]),
	)

	const lines: string[] = []
	for (const exercise of workout.exercises) {
		const templateExercise = templateExercises.get(exercise.id)
		const label = templateExercise?.name ?? exercise.name ?? exercise.id
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

export function createWorkoutEntry(
	data: { config: { templates: WorkoutTemplate[] }, workouts: Record<string, WorkoutEntry> },
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
			name: exercise.name,
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
	data: { config: { templates: WorkoutTemplate[] }, workouts: Record<string, WorkoutEntry> },
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

	const previousWorkout = data.workouts[previous]!
	const previousIndex = templates.findIndex(
		(template) => template.id === previousWorkout.templateId,
	)

	if (previousIndex < 0) {
		return templates[0]!
	}

	const nextIndex = (previousIndex + 1) % templates.length
	return templates[nextIndex]!
}

export function hasWorkoutData(workout: WorkoutEntry): boolean {
	// Check if any exercise has weight set
	const hasWeight = workout.exercises.some(
		(exercise) => exercise.weight != null,
	)

	// Check if any set has reps > 0
	const hasReps = workout.exercises.some((exercise) =>
		exercise.sets.some((set: { reps: number }) => set.reps > 0),
	)

	// Check if bonus reps are set
	const hasBonusReps = workout.bonusReps != null && workout.bonusReps > 0

	return hasWeight || hasReps || hasBonusReps
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
            // Update name to match template if present (renaming existing ID case)
            // But here ID is same.
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
            // If existing didn't have a name, adpot it from template
            if (!existing.name) {
                changed = true
            }
		}

		exercises.push({
			id: exerciseId,
            name: templateExercise.name,
			weight: existing?.weight ?? null,
			sets,
		})
	}

    // Preserve orphaned exercises that have data
    for (const exercise of workout.exercises) {
        if (!templateExercises.has(exercise.id)) {
            const hasData = exercise.weight != null || exercise.sets.some(s => s.reps > 0);
            if (hasData) {
                exercises.push(exercise);
                // If we are keeping an orphan, we are technically "changing" the aligned structure 
                // relative to the strict template, but for the purpose of "changed" flag,
                // if the output list is different from input list, it's changed.
                // We'll let the length check handle that or explicit checks.
            }
        }
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
	config: { templates: WorkoutTemplate[] },
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
