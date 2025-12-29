import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// Workout Tracker
export const workoutSettings = sqliteTable('workout_settings', {
  id: integer('id').primaryKey(), // We'll always use id = 1
  bonusLabel: text('bonus_label').notNull().default('Pull-ups'),
  plates: text('plates', { mode: 'json' }).$type<number[]>().notNull().default([45, 35, 25, 10, 5, 2.5]),
});

export const workoutTemplates = sqliteTable('workout_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  exercises: text('exercises', { mode: 'json' }).$type<{ id: string; name: string; setCount: number }[]>().notNull(),
});

export const workoutEntries = sqliteTable('workout_entries', {
  date: text('date').primaryKey(),
  templateId: text('template_id').notNull(),
  exercises: text('exercises', { mode: 'json' }).$type<{ id: string; weight: number | null; sets: { reps: number }[] }[]>().notNull(),
  bonusReps: integer('bonus_reps'),
});

// Dry Fire Trainer
export const dryFireSettings = sqliteTable('dry_fire_settings', {
  id: integer('id').primaryKey(), // id = 1
  chaosMode: integer('chaos_mode', { mode: 'boolean' }).notNull().default(false),
});

export const dryFireDrills = sqliteTable('dry_fire_drills', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  parTime: real('par_time').notNull(),
  reps: integer('reps').notNull(),
});

export const dryFireSessions = sqliteTable('dry_fire_sessions', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),
  drillId: text('drill_id').notNull(),
  drillName: text('drill_name').notNull(),
  parTime: real('par_time').notNull(),
  shots: text('shots', { mode: 'json' }).$type<{ result: 'hit' | 'slow' | 'miss' | null }[]>().notNull(),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
});
