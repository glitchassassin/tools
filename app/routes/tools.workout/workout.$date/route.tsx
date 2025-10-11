import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import type { MetaFunction } from 'react-router'
import { useWorkoutTrackerContext } from '../context.client'
import {
	alignWorkoutWithTemplate,
	calculatePlateBreakdown,
	formatDisplayDate,
	formatWorkoutSummary,
	getTodayKey,
} from '../data.client'

export const meta: MetaFunction = ({ params }) => {
	const date = (params?.date as string | undefined) ?? getTodayKey()
	return [
		{ title: `Workout • ${date}` },
		{
			name: 'description',
			content: `Track workout for ${date}`,
		},
	]
}

export default function WorkoutDetailRoute() {
	const params = useParams<{ date?: string }>()
	const navigate = useNavigate()
	const date = params.date ?? getTodayKey()
	const { data, helpers } = useWorkoutTrackerContext()
	const workout = data.workouts[date] ?? null

	useEffect(() => {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
			navigate('/tools/workout')
		}
	}, [date, navigate])

	useEffect(() => {
		if (!date) return
		if (workout) return
		helpers.ensureWorkout(date)
	}, [date, helpers, workout])

	const activeTemplate = useMemo(() => {
		const template = data.config.templates.find(
			(item) => item.id === workout?.templateId,
		)
		return template ?? data.config.templates[0] ?? null
	}, [data.config.templates, workout?.templateId])

	const [activeExerciseId, setActiveExerciseId] = useState<string | null>(
		() => workout?.exercises[0]?.id ?? null,
	)

	useEffect(() => {
		if (!workout) return
		const firstId = workout.exercises[0]?.id ?? null
		if (
			!activeExerciseId ||
			!workout.exercises.some((exercise) => exercise.id === activeExerciseId)
		) {
			setActiveExerciseId(firstId)
		}
	}, [workout, activeExerciseId])

	useEffect(() => {
		if (!workout || !activeTemplate) return
		const aligned = alignWorkoutWithTemplate(workout, activeTemplate)
		if (aligned !== workout) {
			helpers.setWorkout(date, aligned)
		}
	}, [activeTemplate, helpers, workout, date])

	if (!workout || !activeTemplate) {
		return (
			<section className="space-y-6">
				<header>
					<p className="text-app-muted text-sm">Loading workout…</p>
				</header>
			</section>
		)
	}

	const handleWeightChange = (exerciseId: string, value: string) => {
		const parsed = value === '' ? null : Number.parseFloat(value)
		if (Number.isNaN(parsed) && value !== '') return
		helpers.upsertWorkout(date, (draft) => ({
			...draft,
			exercises: draft.exercises.map((exercise) =>
				exercise.id === exerciseId
					? {
							...exercise,
							weight: parsed,
						}
					: exercise,
			),
		}))
	}

	const handleRepChange = (
		exerciseId: string,
		setIndex: number,
		repValue: number,
	) => {
		const nextReps = Math.max(0, repValue)
		helpers.upsertWorkout(date, (draft) => ({
			...draft,
			exercises: draft.exercises.map((exercise) =>
				exercise.id === exerciseId
					? {
							...exercise,
							sets: exercise.sets.map((set, index) =>
								index === setIndex
									? {
											...set,
											reps: nextReps,
										}
									: set,
							),
						}
					: exercise,
			),
		}))
	}

	const handleBonusChange = (value: string) => {
		const parsed = value === '' ? null : Number.parseInt(value, 10)
		if (Number.isNaN(parsed) && value !== '') return
		helpers.upsertWorkout(date, (draft) => ({
			...draft,
			bonusReps: parsed,
		}))
	}

	const summary = formatWorkoutSummary(workout, activeTemplate, data.config)
	const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')

	const handleCopy = async () => {
		const header = `${formatDisplayDate(date)} | ${activeTemplate.name}`
		const text = [header, summary].filter(Boolean).join('\n')
		try {
			await navigator.clipboard.writeText(text)
			setCopyState('copied')
			setTimeout(() => setCopyState('idle'), 2500)
		} catch (error) {
			console.error('Failed to copy workout', error)
		}
	}

	const handleDelete = () => {
		const confirmed = window.confirm('Are you sure?')
		if (!confirmed) return
		helpers.deleteWorkout(date)
		navigate('/tools/workout')
	}

	return (
		<section className="space-y-8">
			<header className="space-y-2">
				<Link
					to="/tools/workout"
					className="text-app-muted hover:text-primary text-sm underline-offset-4 hover:underline"
				>
					← Back to index
				</Link>
				<div>
					<p className="text-app-muted text-sm">{activeTemplate.name}</p>
					<h2 className="text-2xl font-semibold">{formatDisplayDate(date)}</h2>
				</div>
			</header>

			<div className="space-y-4">
				{workout.exercises.map((exercise) => {
					const templateExercise = activeTemplate.exercises.find(
						(item) => item.id === exercise.id,
					)
					const isActive = exercise.id === activeExerciseId
					const breakdown =
						exercise.weight != null
							? calculatePlateBreakdown(exercise.weight, data.config.plates)
							: { perSide: [], exact: true }
					return (
						<article
							key={exercise.id}
							className={[
								'border-app-border bg-app-surface/90 rounded-3xl border transition',
								isActive ? 'shadow-soft border-primary/60' : '',
							].join(' ')}
						>
							<button
								type="button"
								className="focus-visible:outline-primary w-full rounded-t-3xl px-5 py-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
								onClick={() => setActiveExerciseId(exercise.id)}
								aria-expanded={isActive}
							>
								<div className="flex items-center justify-between gap-4">
									<div>
										<p className="text-app-muted text-sm tracking-[0.2em] uppercase">
											Exercise
										</p>
										<h3 className="text-lg font-semibold">
											{templateExercise?.name ?? exercise.id}
										</h3>
									</div>
									<div className="text-right">
										<p className="text-app-muted text-xs tracking-[0.3em] uppercase">
											Weight
										</p>
										<p className="text-primary text-lg font-semibold">
											{exercise.weight != null ? `${exercise.weight} lb` : '—'}
										</p>
									</div>
								</div>
								{!isActive && (
									<div className="text-app-muted mt-3 flex flex-wrap justify-between gap-3 text-sm">
										<span>
											Sets:{' '}
											{(() => {
												const reps = exercise.sets.map((set) => set.reps)
												const hasReps = reps.some((value) => value > 0)
												return hasReps ? reps.join(', ') : '—'
											})()}
										</span>
									</div>
								)}
							</button>

							{isActive && (
								<div className="border-app-border space-y-6 border-t px-5 py-5">
									<div>
										<label className="text-app-muted block text-xs tracking-[0.3em] uppercase">
											Weight (lb)
											<input
												type="number"
												min={0}
												step={5}
												value={exercise.weight ?? ''}
												onChange={(event) =>
													handleWeightChange(exercise.id, event.target.value)
												}
												className="border-app-border bg-app-surface text-app-foreground focus:border-primary mt-2 w-full rounded-xl border px-4 py-3 text-base font-semibold focus:outline-none"
											/>
										</label>
										{exercise.weight != null && (
											<div className="text-app-muted mt-3 text-sm">
												<p className="text-app-foreground font-medium">
													Plates per side
												</p>
												{breakdown.perSide.length > 0 ? (
													<p>
														{breakdown.perSide.join(' + ')}{' '}
														{breakdown.exact ? '' : '(approx)'}
													</p>
												) : (
													<p>Bar only</p>
												)}
											</div>
										)}
									</div>

									<div>
										<p className="text-app-muted text-xs tracking-[0.3em] uppercase">
											Reps per set
										</p>
										<div className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-5">
											{exercise.sets.map((set, index) => (
												<div
													key={index}
													className="border-app-border bg-app-surface/70 flex flex-col items-center rounded-2xl border px-3 py-3"
												>
													<button
														type="button"
														className="border-primary text-primary hover:bg-primary/10 focus-visible:outline-primary h-10 w-10 rounded-full border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
														onClick={() =>
															handleRepChange(exercise.id, index, set.reps + 1)
														}
														aria-label={`Increase reps for set ${index + 1}`}
													>
														+
													</button>
													<input
														type="number"
														min={0}
														value={set.reps}
														onChange={(event) =>
															handleRepChange(
																exercise.id,
																index,
																Number.parseInt(event.target.value, 10) || 0,
															)
														}
														className="border-app-border bg-app-surface focus:border-primary my-2 w-14 rounded-lg border text-center text-lg font-semibold focus:outline-none"
													/>
													<button
														type="button"
														className="border-primary text-primary hover:bg-primary/10 focus-visible:outline-primary disabled:border-app-border disabled:text-app-muted h-10 w-10 rounded-full border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
														onClick={() =>
															handleRepChange(exercise.id, index, set.reps - 1)
														}
														aria-label={`Decrease reps for set ${index + 1}`}
														disabled={set.reps <= 0}
													>
														−
													</button>
												</div>
											))}
										</div>
									</div>
								</div>
							)}
						</article>
					)
				})}
			</div>

			{data.config.bonusLabel && (
				<section className="border-app-border bg-app-surface/90 rounded-3xl border p-5">
					<h3 className="text-app-muted text-sm tracking-[0.3em] uppercase">
						{data.config.bonusLabel}
					</h3>
					<label className="text-app-muted mt-2 block text-sm">
						Reps
						<input
							type="number"
							min={0}
							value={workout.bonusReps ?? ''}
							onChange={(event) => handleBonusChange(event.target.value)}
							className="border-app-border bg-app-surface text-app-foreground focus:border-primary mt-2 w-full rounded-xl border px-4 py-3 text-base font-semibold focus:outline-none"
						/>
					</label>
				</section>
			)}

			<section className="space-y-3">
				<button
					type="button"
					onClick={handleCopy}
					className="bg-primary text-primary-foreground focus-visible:outline-primary/70 w-full rounded-full px-4 py-3 text-base font-semibold transition hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 active:scale-[0.99]"
				>
					Copy Workout
				</button>
				{copyState === 'copied' && (
					<p role="status" className="text-app-muted text-center text-sm">
						Copied to clipboard
					</p>
				)}
				<button
					type="button"
					onClick={handleDelete}
					className="w-full rounded-full border border-red-500 px-4 py-3 text-base font-semibold text-red-400 transition hover:bg-red-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-500"
				>
					Delete Workout
				</button>
			</section>
		</section>
	)
}
