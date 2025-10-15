import { format as formatDate, isValid } from 'date-fns'
import { useMemo } from 'react'
import { z } from 'zod'
import { declareModel } from '~/hooks/declareModel'
import { useLocalData } from '~/hooks/useLocalData.client'

const DrillConfigSchema = z.object({
	id: z.string(),
	name: z.string(),
	parTime: z.number().positive().max(60),
	reps: z.number().int().min(1).max(100),
})

const ShotSchema = z.object({
	time: z.number().min(0).nullable(),
	hit: z.boolean().nullable(),
	ignored: z.boolean(),
})

const SessionSchema = z.object({
	id: z.string(),
	date: z.string(),
	drillId: z.string(),
	drillName: z.string(),
	parTime: z.number(),
	shots: z.array(ShotSchema),
	completed: z.boolean(),
})

const DryFireDataSchema = z.object({
	drills: z.array(DrillConfigSchema).min(1),
	sessions: z.array(SessionSchema),
	chaosMode: z.boolean().default(false),
})

export type DrillConfig = z.infer<typeof DrillConfigSchema>
export type Shot = z.infer<typeof ShotSchema>
export type Session = z.infer<typeof SessionSchema>
export type DryFireData = z.infer<typeof DryFireDataSchema>
export type DryFireSerializedData = string

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

const DEFAULT_DATA: DryFireData = {
	drills: DEFAULT_DRILLS,
	sessions: [],
	chaosMode: false,
}

const DryFireDataModel = declareModel({
	model: DryFireDataSchema,
	defaultValue: DEFAULT_DATA,
})

const DRY_FIRE_STORAGE_KEY = 'dry-fire-trainer'

type DryFireTrackerHelpers = {
	getDrill: (id: string) => DrillConfig | null
	addDrill: (drill: Omit<DrillConfig, 'id'>) => DrillConfig
	updateDrill: (id: string, drill: Partial<Omit<DrillConfig, 'id'>>) => void
	deleteDrill: (id: string) => void
	canDeleteDrill: (id: string) => boolean
	createSession: (drillId: string) => Session
	getSession: (id: string) => Session | null
	updateSession: (id: string, updates: Partial<Session>) => void
	deleteSession: (id: string) => void
	completeSession: (id: string) => void
	exportSerializedData: () => DryFireSerializedData
	importSerializedData: (data: DryFireSerializedData) => void
	setChaosMode: (enabled: boolean) => void
}

export function useDryFireTracker() {
	const [data, setData] = useLocalData(DRY_FIRE_STORAGE_KEY, DryFireDataModel)

	const helpers = useMemo<DryFireTrackerHelpers>(
		() => ({
			getDrill(id: string) {
				return data.drills.find((drill) => drill.id === id) ?? null
			},
			addDrill(drill: Omit<DrillConfig, 'id'>) {
				const id = `drill-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
				const newDrill: DrillConfig = {
					id,
					...drill,
				}
				setData((prev) => ({
					...prev,
					drills: [...prev.drills, newDrill],
				}))
				return newDrill
			},
			updateDrill(id: string, updates: Partial<Omit<DrillConfig, 'id'>>) {
				setData((prev) => ({
					...prev,
					drills: prev.drills.map((drill) =>
						drill.id === id ? { ...drill, ...updates } : drill,
					),
				}))
			},
			deleteDrill(id: string) {
				const hasSessions = data.sessions.some(
					(session) => session.drillId === id,
				)
				if (hasSessions) {
					throw new Error('Cannot delete drill with existing sessions')
				}
				setData((prev) => ({
					...prev,
					drills: prev.drills.filter((drill) => drill.id !== id),
				}))
			},
			canDeleteDrill(id: string) {
				return !data.sessions.some((session) => session.drillId === id)
			},
			createSession(drillId: string) {
				const drill = data.drills.find((d) => d.id === drillId)
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
						time: null,
						hit: null,
						ignored: false,
					})),
					completed: false,
				}
				setData((prev) => ({
					...prev,
					sessions: [...prev.sessions, session],
				}))
				return session
			},
			getSession(id: string) {
				return data.sessions.find((session) => session.id === id) ?? null
			},
			updateSession(id: string, updates: Partial<Session>) {
				setData((prev) => ({
					...prev,
					sessions: prev.sessions.map((session) =>
						session.id === id ? { ...session, ...updates } : session,
					),
				}))
			},
			deleteSession(id: string) {
				setData((prev) => ({
					...prev,
					sessions: prev.sessions.filter((session) => session.id !== id),
				}))
			},
			completeSession(id: string) {
				setData((prev) => ({
					...prev,
					sessions: prev.sessions.map((session) =>
						session.id === id ? { ...session, completed: true } : session,
					),
				}))
			},
			exportSerializedData() {
				const ensureSerializedValue = () => {
					const existing = window.localStorage.getItem(DRY_FIRE_STORAGE_KEY)
					if (existing != null) {
						return existing
					}
					const computed = DryFireDataModel.stringify(data)
					window.localStorage.setItem(DRY_FIRE_STORAGE_KEY, computed)
					return computed
				}
				return ensureSerializedValue()
			},
			importSerializedData(serialized: string) {
				const nextData = DryFireDataModel.parse(serialized)
				setData(nextData)
			},
			setChaosMode(enabled: boolean) {
				setData((prev) => ({
					...prev,
					chaosMode: enabled,
				}))
			},
		}),
		[data, setData],
	)

	return [data, helpers] as const
}

export function formatSessionDate(dateString: string) {
	try {
		const date = new Date(dateString)
		if (!isValid(date)) return dateString
		return formatDate(date, 'M/d/yyyy h:mm a')
	} catch {
		return dateString
	}
}

export function calculateSessionStats(session: Session) {
	const validShots = session.shots.filter((shot) => !shot.ignored)
	const hitShots = validShots.filter((shot) => shot.hit === true)
	const missedShots = validShots.filter((shot) => shot.hit === false)
	const shotsWithTime = hitShots.filter((shot) => shot.time !== null)

	const averageTime =
		shotsWithTime.length > 0
			? shotsWithTime.reduce((sum, shot) => sum + (shot.time ?? 0), 0) /
				shotsWithTime.length
			: null

	return {
		total: validShots.length,
		hit: hitShots.length,
		missed: missedShots.length,
		hitRate: validShots.length > 0 ? hitShots.length / validShots.length : 0,
		averageTime,
	}
}

export { DryFireDataModel }
