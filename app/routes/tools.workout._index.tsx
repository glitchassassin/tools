import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import type { MetaFunction } from 'react-router'
import { useWorkoutTrackerContext } from './tools.workout/context'
import {
	formatDisplayDate,
	getMaxWeightByExercise,
	getTodayKey,
} from './tools.workout/data'

export const meta: MetaFunction = () => [
	{ title: 'Workout Tracker' },
]

export default function WorkoutHome() {
	const navigate = useNavigate()
	const { data, helpers } = useWorkoutTrackerContext()
	const todayKey = getTodayKey()
	const todaysWorkout = data.workouts[todayKey] ?? null
	const templateLookup = useMemo(() => {
		const map = new Map<string, { name: string }>()
		for (const template of data.config.templates) {
			for (const exercise of template.exercises) {
				if (!map.has(exercise.id)) {
					map.set(exercise.id, { name: exercise.name })
				}
			}
		}
		return map
	}, [data.config.templates])

	const maxWeights = useMemo(
		() => getMaxWeightByExercise(data),
		[data],
	)

	const handleStartWorkout = async () => {
		const ensuredWorkout = await helpers.ensureWorkout(todayKey)
		await navigate(`/tools/workout/workout/${ensuredWorkout.date}`)
	}

	return (
		<div className="space-y-10">
			<section className="text-center space-y-6">
				<div className="mx-auto inline-flex h-48 w-48 items-center justify-center rounded-full border-8 border-primary/40 bg-app-surface shadow-soft">
					<button
						type="button"
						onClick={handleStartWorkout}
						className="flex h-40 w-40 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary/70 active:scale-95"
					>
						{todaysWorkout ? 'Finish Workout' : 'Start Workout'}
					</button>
				</div>
				<div>
					<p className="text-app-muted text-sm">
						{todaysWorkout
							? `Continue ${formatDisplayDate(todayKey)}`
							: `Next session: ${formatDisplayDate(todayKey)}`}
					</p>
				</div>
			</section>

			<section
				aria-labelledby="max-weight-heading"
				className="border-app-border bg-app-surface/80 space-y-4 rounded-3xl border p-6"
			>
				<header className="flex items-baseline justify-between">
					<h2 id="max-weight-heading" className="text-xl font-semibold">
						Max weights
					</h2>
					<span className="text-xs uppercase tracking-[0.3em] text-app-muted">
						Personal records
					</span>
				</header>
				<ul className="grid gap-3 sm:grid-cols-2">
					{Array.from(templateLookup.entries()).map(([id, { name }]) => {
						const max = maxWeights.get(id)
						return (
							<li
								key={id}
								className="border-app-border bg-app-surface/90 flex items-center justify-between rounded-2xl border px-4 py-3"
							>
								<span className="text-sm font-medium">{name}</span>
								<span className="text-lg font-semibold text-primary">
									{max != null ? `${max} lb` : '—'}
								</span>
							</li>
						)
					})}
					{templateLookup.size === 0 && (
						<li className="text-center text-sm text-app-muted">
							No exercises configured yet.
						</li>
					)}
				</ul>
			</section>
		</div>
	)
}
