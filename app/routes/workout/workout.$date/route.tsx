import { useEffect, useMemo, useState } from 'react'
import type { MetaFunction } from 'react-router'
import { useFetcher, useNavigate } from 'react-router'
import type { WorkoutEntry } from '../data.server'
import { deleteWorkout, getWorkoutData, upsertWorkout } from '../data.server'
import {
    alignWorkoutWithTemplate,
    calculatePlateBreakdown,
    createWorkoutEntry,
    formatDisplayDate,
    formatWorkoutSummary,
    getTodayKey,
} from '../utils'
import type { Route } from './+types/route'
import { RepsSpinner } from '~/components/reps-spinner'
import { getDb } from '~/db/client.server'

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

export const loader = async ({ params, context }: Route.LoaderArgs) => {
	const date = params.date;
	if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		throw new Response('Invalid date', { status: 400 });
	}

	const db = getDb(context.cloudflare.env);
	const data = await getWorkoutData(db);
	const workout = data.workouts[date] ?? createWorkoutEntry(data, date);

	return { workout };
}

export const action = async ({ request, params, context }: Route.ActionArgs) => {
	const date = params.date!;
	const db = getDb(context.cloudflare.env);
	const formData = await request.formData();
	const intent = formData.get('intent');

	if (intent === 'upsert-workout') {
		const payload = JSON.parse(formData.get('workout') as string) as WorkoutEntry;
		await upsertWorkout(db, payload);
		return { success: true };
	}

	if (intent === 'delete-workout') {
		await deleteWorkout(db, date);
		return { success: true };
	}

	return { success: false };
}

export default function WorkoutDetailRoute({ loaderData: { workout: loaderWorkout }, params, matches }: Route.ComponentProps) {
	const navigate = useNavigate()
	const fetcher = useFetcher<typeof action>()
	const date = params.date ?? getTodayKey()
	const data = matches[1].loaderData.data

	// Use local state for immediate feedback, sync to server
	const [workout, setWorkout] = useState<WorkoutEntry>(loaderWorkout)

	useEffect(() => {
		setWorkout(loaderWorkout)
	}, [loaderWorkout])

	useEffect(() => {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
			void navigate('/workout')
		}
	}, [date, navigate])

	const activeTemplate = useMemo(() => {
		const template = data.config.templates.find(
			(item) => item.id === workout.templateId,
		)
		return template ?? data.config.templates[0] ?? null
	}, [data.config.templates, workout.templateId])

	const [activeExerciseId, setActiveExerciseId] = useState<string | null>(
		() => workout.exercises[0]?.id ?? null,
	)
	const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')
	const [deleteConfirm, setDeleteConfirm] = useState(false)

	useEffect(() => {
		const firstId = workout.exercises[0]?.id ?? null
		if (
			!activeExerciseId ||
			!workout.exercises.some((exercise) => exercise.id === activeExerciseId)
		) {
			setActiveExerciseId(firstId)
		}
	}, [workout, activeExerciseId])

	useEffect(() => {
		if (!activeTemplate) return
		const aligned = alignWorkoutWithTemplate(workout, activeTemplate)
		if (aligned !== workout) {
			setWorkout(aligned)
			void fetcher.submit(
				{ intent: 'upsert-workout', workout: JSON.stringify(aligned) },
				{ method: 'POST' },
			)
		}
	}, [activeTemplate, workout, date, fetcher])

	useEffect(() => {
		if (!deleteConfirm) return
		const timeoutId = setTimeout(() => setDeleteConfirm(false), 3000)
		return () => clearTimeout(timeoutId)
	}, [deleteConfirm])

	if (!activeTemplate) {
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
		const nextWorkout = {
			...workout,
			exercises: workout.exercises.map((exercise) =>
				exercise.id === exerciseId
					? {
							...exercise,
							weight: parsed,
						}
					: exercise,
			),
		}
		setWorkout(nextWorkout)
		void fetcher.submit(
			{ intent: 'upsert-workout', workout: JSON.stringify(nextWorkout) },
			{ method: 'POST' },
		)
	}

	const handleRepChange = (
		exerciseId: string,
		setIndex: number,
		repValue: number,
	) => {
		const nextReps = Math.max(0, repValue)
		const nextWorkout = {
			...workout,
			exercises: workout.exercises.map((exercise) =>
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
		}
		setWorkout(nextWorkout)
		void fetcher.submit(
			{ intent: 'upsert-workout', workout: JSON.stringify(nextWorkout) },
			{ method: 'POST' },
		)
	}

	const handleBonusChange = (value: string) => {
		const parsed = value === '' ? null : Number.parseInt(value, 10)
		if (Number.isNaN(parsed) && value !== '') return
		const nextWorkout = {
			...workout,
			bonusReps: parsed,
		}
		setWorkout(nextWorkout)
		void fetcher.submit(
			{ intent: 'upsert-workout', workout: JSON.stringify(nextWorkout) },
			{ method: 'POST' },
		)
	}

	const summary = formatWorkoutSummary(workout, activeTemplate, data.config)

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

	const handleDelete = async () => {
		if (!deleteConfirm) {
			setDeleteConfirm(true)
			return
		}
		void fetcher.submit({ intent: 'delete-workout' }, { method: 'POST' })
		await navigate('/workout')
	}

	return (
		<section className="space-y-8">
			<header className="space-y-1">
				<p className="text-app-muted text-sm">{activeTemplate.name}</p>
				<h2 className="text-2xl font-semibold">{formatDisplayDate(date)}</h2>
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
								className="focus-visible:outline-primary w-full rounded-t-3xl px-5 py-4 text-left focus-visible:outline focus-visible:outline-offset-4"
								onClick={() => setActiveExerciseId(exercise.id)}
								aria-expanded={isActive}
							>
								<div className="flex items-center justify-between gap-4">
									<div>
										<p className="text-app-muted text-sm tracking-[0.2em] uppercase">
											Exercise
										</p>
										<h3 className="text-lg font-semibold">
											{templateExercise?.name ?? exercise.name ?? exercise.id}
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
										<div className="mt-4 grid grid-cols-5 gap-4">
											{exercise.sets.map((set, index) => (
												<RepsSpinner
													key={index}
													value={set.reps}
													min={0}
													label={`reps for set ${index + 1}`}
													onChange={(nextValue) =>
														handleRepChange(exercise.id, index, nextValue)
													}
												/>
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
					className="bg-primary text-primary-foreground focus-visible:outline-primary/70 w-full rounded-full px-4 py-3 text-base font-semibold transition hover:scale-[1.01] focus-visible:outline focus-visible:outline-offset-4 active:scale-[0.99]"
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
					className="w-full rounded-full border border-red-500 px-4 py-3 text-base font-semibold text-red-400 transition hover:bg-red-500/10 focus-visible:outline focus-visible:outline-offset-4 focus-visible:outline-red-500"
				>
					{deleteConfirm ? 'Are you sure?' : 'Delete Workout'}
				</button>
			</section>
		</section>
	)
}
