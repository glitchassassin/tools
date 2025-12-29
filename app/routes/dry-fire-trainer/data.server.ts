import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from '~/db/client.server'
import { dryFireSettings, dryFireDrills, dryFireSessions } from '~/db/schema'

export const DrillConfigSchema = z.object({
	id: z.string(),
	name: z.string(),
	parTime: z.number().positive().max(60),
	reps: z.number().int().min(1).max(100),
})

export const ShotSchema = z.object({
	result: z.enum(['hit', 'slow', 'miss']).nullable(),
})

export const SessionSchema = z.object({
	id: z.string(),
	date: z.string(),
	drillId: z.string(),
	drillName: z.string(),
	parTime: z.number(),
	shots: z.array(ShotSchema),
	completed: z.boolean(),
})

export const DryFireDataSchema = z.object({
	drills: z.array(DrillConfigSchema),
	sessions: z.array(SessionSchema),
	chaosMode: z.boolean(),
})

export type DrillConfig = z.infer<typeof DrillConfigSchema>
export type Shot = z.infer<typeof ShotSchema>
export type Session = z.infer<typeof SessionSchema>
export type DryFireData = z.infer<typeof DryFireDataSchema>

const DEFAULT_DRILLS: DrillConfig[] = [
	{
		id: 'low-ready',
		name: 'Low Ready',
		parTime: 1.5,
		reps: 20,
	},
	{
		id: 'draw',
		name: 'Draw',
		parTime: 2.0,
		reps: 20,
	},
	{
		id: 'draw-from-concealment',
		name: 'Draw from Concealment',
		parTime: 2.5,
		reps: 20,
	},
]

export async function getDryFireData(db: Db): Promise<DryFireData> {
	let settings = await db.select().from(dryFireSettings).where(eq(dryFireSettings.id, 1)).get()
	if (!settings) {
		settings = await db.insert(dryFireSettings).values({ id: 1, chaosMode: false }).returning().get()
	}

	let drills = await db.select().from(dryFireDrills).all()
	if (drills.length === 0) {
		for (const drill of DEFAULT_DRILLS) {
			await db.insert(dryFireDrills).values(drill).run()
		}
		drills = await db.select().from(dryFireDrills).all()
	}

	const sessions = await db.select().from(dryFireSessions).all()

	return {
		drills: drills.map((d: any) => ({
			id: d.id,
			name: d.name,
			parTime: d.parTime,
			reps: d.reps,
		})),
		sessions: sessions.map((s: any) => ({
			id: s.id,
			date: s.date,
			drillId: s.drillId,
			drillName: s.drillName,
			parTime: s.parTime,
			shots: s.shots as Shot[],
			completed: s.completed,
		})),
		chaosMode: settings!.chaosMode,
	}
}

export async function upsertDrill(db: Db, drill: DrillConfig) {
	await db.insert(dryFireDrills).values(drill).onConflictDoUpdate({
		target: dryFireDrills.id,
		set: {
			name: drill.name,
			parTime: drill.parTime,
			reps: drill.reps,
		},
	}).run()
}

export async function deleteDrill(db: Db, id: string) {
	await db.delete(dryFireDrills).where(eq(dryFireDrills.id, id)).run()
}

export async function upsertSession(db: Db, session: Session) {
	await db.insert(dryFireSessions).values({
		id: session.id,
		date: session.date,
		drillId: session.drillId,
		drillName: session.drillName,
		parTime: session.parTime,
		shots: session.shots,
		completed: session.completed,
	}).onConflictDoUpdate({
		target: dryFireSessions.id,
		set: {
			date: session.date,
			drillId: session.drillId,
			drillName: session.drillName,
			parTime: session.parTime,
			shots: session.shots,
			completed: session.completed,
		},
	}).run()
}

export async function deleteSession(db: Db, id: string) {
	await db.delete(dryFireSessions).where(eq(dryFireSessions.id, id)).run()
}

export async function updateDryFireSettings(db: Db, chaosMode: boolean) {
	await db.update(dryFireSettings).set({ chaosMode }).where(eq(dryFireSettings.id, 1)).run()
}

export async function createSession(db: Db, drillId: string): Promise<Session> {
	const drill = await db.select().from(dryFireDrills).where(eq(dryFireDrills.id, drillId)).get()
	if (!drill) {
		throw new Error('Drill not found')
	}
	const id = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
	const session: Session = {
		id,
		date: new Date().toISOString(),
		drillId: drill.id,
		drillName: drill.name,
		parTime: drill.parTime,
		shots: Array.from({ length: drill.reps }, () => ({
			result: null,
		})),
		completed: false,
	}
	await upsertSession(db, session)
	return session
}
