import { eq } from 'drizzle-orm';
import { type Db } from '~/db/client.server';
import { workoutSettings, workoutTemplates, workoutEntries } from '~/db/schema';
import { z } from 'zod';

export const WorkoutExerciseConfigSchema = z.object({
	id: z.string(),
	name: z.string(),
	setCount: z.number().int().min(1).max(10),
})

export const WorkoutTemplateSchema = z.object({
	id: z.string(),
	name: z.string(),
	exercises: z.array(WorkoutExerciseConfigSchema).min(1),
})

export const WorkoutExerciseSetSchema = z.object({
	reps: z.number().int().min(0).max(1000),
})

export const WorkoutExerciseEntrySchema = z.object({
	id: z.string(),
	weight: z.number().min(0).max(1500).nullable(),
	sets: z.array(WorkoutExerciseSetSchema),
})

export type WorkoutExerciseConfig = z.infer<typeof WorkoutExerciseConfigSchema>
export type WorkoutExerciseSet = z.infer<typeof WorkoutExerciseSetSchema>
export type WorkoutExerciseEntry = z.infer<typeof WorkoutExerciseEntrySchema>

export const WorkoutEntrySchema = z.object({
	date: z.string(),
	templateId: z.string(),
	exercises: z.array(WorkoutExerciseEntrySchema),
	bonusReps: z.number().int().min(0).max(500).nullable(),
})

export type WorkoutTemplate = z.infer<typeof WorkoutTemplateSchema>;
export type WorkoutEntry = z.infer<typeof WorkoutEntrySchema>;

export type WorkoutTrackerData = {
	config: {
		templates: WorkoutTemplate[]
		bonusLabel: string
		plates: number[]
	}
	workouts: Record<string, WorkoutEntry>
}

const DEFAULT_TEMPLATES: WorkoutTemplate[] = [
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
];

export async function getWorkoutData(db: Db) {
	let settings = await db.query.workoutSettings.findFirst({
		where: eq(workoutSettings.id, 1),
	});

	if (!settings) {
		[settings] = await db.insert(workoutSettings).values({
			id: 1,
			bonusLabel: 'Pull-ups',
			plates: [45, 35, 25, 10, 5, 2.5],
		}).returning();
	}

	let templates = await db.query.workoutTemplates.findMany();
	if (templates.length === 0) {
		await db.insert(workoutTemplates).values(DEFAULT_TEMPLATES);
		templates = await db.query.workoutTemplates.findMany();
	}

	const workouts = await db.query.workoutEntries.findMany();
    const workoutMap: Record<string, WorkoutEntry> = {};
    workouts.forEach(w => {
        workoutMap[w.date] = w as WorkoutEntry;
    });

	return {
		config: {
			templates,
			bonusLabel: settings.bonusLabel,
			plates: settings.plates,
		},
		workouts: workoutMap,
	};
}

export async function upsertWorkout(db: Db, entry: WorkoutEntry) {
    return db.insert(workoutEntries).values(entry).onConflictDoUpdate({
        target: workoutEntries.date,
        set: {
            templateId: entry.templateId,
            exercises: entry.exercises,
            bonusReps: entry.bonusReps,
        }
    }).returning();
}

export async function deleteWorkout(db: Db, date: string) {
    return db.delete(workoutEntries).where(eq(workoutEntries.date, date));
}

export async function updateWorkoutSettings(db: Db, settings: { bonusLabel?: string, plates?: number[] }) {
    return db.update(workoutSettings).set(settings).where(eq(workoutSettings.id, 1)).returning();
}

export async function upsertWorkoutTemplate(db: Db, template: WorkoutTemplate) {
    return db.insert(workoutTemplates).values(template).onConflictDoUpdate({
        target: workoutTemplates.id,
        set: {
            name: template.name,
            exercises: template.exercises,
        }
    }).returning();
}
