import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import type { MetaFunction } from 'react-router'
import {
	formatDisplayDate,
	getMaxWeightByExercise,
	getTodayKey,
} from '../utils'
import type { Route } from './+types/route'

export const meta: MetaFunction = () => [{ title: 'Workout Tracker' }]

export default function WorkoutHome({ matches }: Route.ComponentProps) {
	const navigate = useNavigate()
	const data = matches[1].loaderData.data
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

	const maxWeights = useMemo(() => getMaxWeightByExercise(data), [data])

	const handleStartWorkout = async () => {
		await navigate(`/workout/workout/${todayKey}`)
	}

	return (
		<div className="space-y-10">
			<section className="space-y-6 text-center">
				<div className="border-primary/40 bg-app-surface shadow-soft mx-auto inline-flex h-48 w-48 items-center justify-center rounded-full border-8">
					<button
						type="button"
						onClick={handleStartWorkout}
						className="bg-primary text-primary-foreground focus-visible:outline-primary/70 flex h-40 w-40 items-center justify-center rounded-full text-lg font-semibold transition hover:scale-105 focus-visible:outline focus-visible:outline-offset-4 active:scale-95"
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
					<span className="text-app-muted text-xs tracking-[0.3em] uppercase">
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
								<span className="text-primary text-lg font-semibold">
									{max != null ? `${max} lb` : '—'}
								</span>
							</li>
						)
					})}
					{templateLookup.size === 0 && (
						<li className="text-app-muted text-center text-sm">
							No exercises configured yet.
						</li>
					)}
				</ul>
			</section>
		</div>
	)
}
