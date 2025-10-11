import { useMemo } from 'react'
import { Link } from 'react-router'
import type { MetaFunction } from 'react-router'
import { useWorkoutTrackerContext } from './tools.workout/context.client'
import {
	formatDisplayDate,
	parseDateKey,
	toDateKey,
	summarizeSets,
} from './tools.workout/data.client'

export const meta: MetaFunction = () => [{ title: 'Workout History' }]

type ChartPoint = { x: number; y: number; label: string }
type Dataset = {
	id: string
	label: string
	color: string
	points: ChartPoint[]
}

const palette = [
	'#ffb900',
	'#80cbc4',
	'#64b5f6',
	'#ce93d8',
	'#f48fb1',
	'#ffd54f',
]

export default function WorkoutHistoryRoute() {
	const { data } = useWorkoutTrackerContext()

	const workouts = useMemo(
		() =>
			Object.values(data.workouts).sort((a, b) =>
				a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
			),
		[data.workouts],
	)

	const exerciseNames = useMemo(() => {
		const map = new Map<string, string>()
		for (const template of data.config.templates) {
			for (const exercise of template.exercises) {
				if (!map.has(exercise.id)) {
					map.set(exercise.id, exercise.name)
				}
			}
		}
		return map
	}, [data.config.templates])

	const templateNames = useMemo(
		() =>
			new Map(
				data.config.templates.map((template) => [template.id, template.name]),
			),
		[data.config.templates],
	)

	const datasets: Dataset[] = useMemo(() => {
		const exerciseDatasets: Dataset[] = Array.from(
			exerciseNames.entries(),
			([id, label], index) => ({
				id,
				label,
				color: palette[index % palette.length]!,
				points: [],
			}),
		)

		const datasetMap = new Map(
			exerciseDatasets.map((dataset) => [dataset.id, dataset]),
		)

		workouts.forEach((workout) => {
			const workoutTimestamp = parseDateKey(workout.date).getTime()
			if (!Number.isFinite(workoutTimestamp)) return
			for (const exercise of workout.exercises) {
				if (exercise.weight == null) continue
				const dataset = datasetMap.get(exercise.id)
				if (!dataset) continue
				dataset.points.push({
					x: workoutTimestamp,
					y: exercise.weight,
					label: `${formatDisplayDate(workout.date)} • ${exercise.weight} lb`,
				})
			}
		})

		if (data.config.bonusLabel) {
			const bonusDataset: Dataset = {
				id: 'bonus',
				label: data.config.bonusLabel,
				color: '#ff8a65',
				points: workouts
					.filter((workout) => workout.bonusReps != null)
					.map((workout) => ({
						x: parseDateKey(workout.date).getTime(),
						y: workout.bonusReps ?? 0,
						label: `${formatDisplayDate(workout.date)} • ${
							workout.bonusReps ?? 0
						} reps`,
					})),
			}
			exerciseDatasets.push(bonusDataset)
		}

		return exerciseDatasets
	}, [exerciseNames, workouts, data.config.bonusLabel])

	const chart = useMemo(() => {
		const allPoints = datasets.flatMap((dataset) => dataset.points)
		if (allPoints.length === 0) {
			return null
		}
		const minX = Math.min(...allPoints.map((point) => point.x))
		const maxX = Math.max(...allPoints.map((point) => point.x))
		const maxY = Math.max(...allPoints.map((point) => point.y), 0)

		const width = 640
		const height = 320
		const paddingX = 48
		const paddingY = 32
		const xRange = maxX - minX || 1
		const yRange = maxY || 1

		const scaleX = (value: number) =>
			paddingX + ((value - minX) / xRange) * (width - paddingX * 2)
		const scaleY = (value: number) =>
			height - paddingY - (value / yRange) * (height - paddingY * 2)

		const xTicks = Array.from(
			new Set(
				datasets.flatMap((dataset) => dataset.points.map((point) => point.x)),
			),
		).sort((a, b) => a - b)

		return {
			width,
			height,
			paddingX,
			paddingY,
			scaleX,
			scaleY,
			xTicks,
			maxY,
		}
	}, [datasets])

	const renderPath = (dataset: Dataset) => {
		if (!chart || dataset.points.length === 0) return null
		const sortedPoints = [...dataset.points].sort((a, b) => a.x - b.x)
		const points = sortedPoints
			.map((point, index) => {
				const x = chart.scaleX(point.x)
				const y = chart.scaleY(point.y)
				return `${index === 0 ? 'M' : 'L'}${x} ${y}`
			})
			.join(' ')
		return (
			<path
				key={dataset.id}
				d={points}
				fill="none"
				stroke={dataset.color}
				strokeWidth={3}
			/>
		)
	}

	return (
		<section className="space-y-10">
			<header className="space-y-2">
				<h2 className="text-2xl font-semibold">Progress chart</h2>
				<p className="text-app-muted text-sm">
					Track weight progress per exercise and bonus reps.
				</p>
			</header>

			<div className="border-app-border bg-app-surface/80 rounded-3xl border p-4">
				{chart ? (
					<div className="flex flex-col gap-4">
						<svg
							viewBox={`0 0 ${chart.width} ${chart.height}`}
							role="img"
							aria-label="Workout history line chart"
							className="h-72 w-full"
						>
							<g stroke="rgba(255,255,255,0.1)">
								<line
									x1={chart.paddingX}
									y1={chart.height - chart.paddingY}
									x2={chart.width - chart.paddingX / 2}
									y2={chart.height - chart.paddingY}
								/>
								<line
									x1={chart.paddingX}
									y1={chart.paddingY / 2}
									x2={chart.paddingX}
									y2={chart.height - chart.paddingY}
								/>
							</g>
							{chart.xTicks.map((tick) => {
								const x = chart.scaleX(tick)
								const tickKey = toDateKey(new Date(tick))
								return (
									<g key={tick}>
										<line
											x1={x}
											x2={x}
											y1={chart.paddingY}
											y2={chart.height - chart.paddingY}
											stroke="rgba(255,255,255,0.07)"
										/>
										<text
											x={x}
											y={chart.height - chart.paddingY / 2}
											fill="rgba(255,255,255,0.6)"
											fontSize={12}
											textAnchor="middle"
										>
											{formatDisplayDate(tickKey)}
										</text>
									</g>
								)
							})}
							{datasets.map(
								(dataset) =>
									dataset.points.length > 0 && (
										<g key={dataset.id}>
											{renderPath(dataset)}
											{dataset.points.map((point, index) => (
												<circle
													key={`${dataset.id}-${index}`}
													cx={chart.scaleX(point.x)}
													cy={chart.scaleY(point.y)}
													r={5}
													fill={dataset.color}
												>
													<title>{point.label}</title>
												</circle>
											))}
										</g>
									),
							)}
							<text
								x={chart.paddingX / 2}
								y={chart.paddingY}
								fill="rgba(255,255,255,0.6)"
								fontSize={12}
								textAnchor="middle"
								transform={`rotate(-90 ${chart.paddingX / 2} ${chart.paddingY})`}
							>
								Lbs / Bonus reps
							</text>
						</svg>

						<div className="flex flex-wrap gap-4">
							{datasets
								.filter((dataset) => dataset.points.length > 0)
								.map((dataset) => (
									<div
										key={dataset.id}
										className="text-app-muted flex items-center gap-2 text-sm"
									>
										<span
											className="inline-block h-2.5 w-6 rounded-full"
											style={{ backgroundColor: dataset.color }}
											aria-hidden
										/>
										{dataset.label}
									</div>
								))}
						</div>
					</div>
				) : (
					<p className="text-app-muted text-sm">No historical data yet.</p>
				)}
			</div>

			<section className="space-y-4">
				<h3 className="text-xl font-semibold">Workout log</h3>
				{workouts.length === 0 ? (
					<p className="text-app-muted text-sm">
						Complete a workout to see it here.
					</p>
				) : (
					<ul className="space-y-3">
						{workouts.map((workout) => (
							<li key={workout.date}>
								<Link
									to={`/tools/workout/workout/${workout.date}`}
									className="border-app-border bg-app-surface/90 hover:border-primary focus-visible:outline-primary block rounded-3xl border p-4 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
								>
									<div className="flex flex-wrap items-center justify-between gap-2">
										<p className="text-app-muted text-sm">
											{formatDisplayDate(workout.date)}
										</p>
										<p className="text-primary text-sm font-semibold">
											{templateNames.get(workout.templateId) ?? 'Workout'}
										</p>
									</div>
									<ul className="text-app-muted mt-3 space-y-2 text-sm">
										{workout.exercises.map((exercise) => {
											const label =
												exerciseNames.get(exercise.id) ?? exercise.id
											if (exercise.weight == null) return null
											const groups = summarizeSets(exercise)
											const groupSummary = groups
												.map(
													(group) =>
														`${exercise.weight}x${group.count}x${group.reps}`,
												)
												.join(', ')
											return (
												<li key={exercise.id}>
													<span className="text-app-foreground font-medium">
														{label}:{' '}
													</span>
													{groupSummary}
												</li>
											)
										})}
										{data.config.bonusLabel && workout.bonusReps != null && (
											<li>
												<span className="text-app-foreground font-medium">
													{data.config.bonusLabel}:{' '}
												</span>
												{workout.bonusReps} reps
											</li>
										)}
									</ul>
								</Link>
							</li>
						))}
					</ul>
				)}
			</section>
		</section>
	)
}
