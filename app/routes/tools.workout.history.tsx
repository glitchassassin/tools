import {
	Chart as ChartJS,
	CategoryScale,
	Legend,
	LineElement,
	PointElement,
	TimeScale,
	LinearScale,
	Tooltip,
} from 'chart.js'
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js'
import 'chartjs-adapter-date-fns'
import { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import { Link } from 'react-router'
import type { MetaFunction } from 'react-router'
import { useWorkoutTrackerContext } from './tools.workout/context.client'
import {
	formatDisplayDate,
	parseDateKey,
	toDateKey,
	summarizeSets,
} from './tools.workout/data.client'

ChartJS.register(
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	TimeScale,
	Tooltip,
	Legend,
)

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

	const activeDatasets = useMemo(
		() => datasets.filter((dataset) => dataset.points.length > 0),
		[datasets],
	)

	const chartData = useMemo<ChartData<'line'> | null>(() => {
		const entries = activeDatasets.map((dataset) => ({
			label: dataset.label,
			borderColor: dataset.color,
			backgroundColor: dataset.color,
			data: [...dataset.points]
				.sort((a, b) => a.x - b.x)
				.map((point) => ({ x: point.x, y: point.y, label: point.label })),
			tension: 0.3,
			pointRadius: 4,
			pointHoverRadius: 6,
			pointBorderWidth: 2,
			pointHoverBorderWidth: 2,
			borderWidth: 2,
			hitRadius: 12,
			pointBackgroundColor: dataset.color,
			yAxisID: dataset.id === 'bonus' ? 'bonus' : 'weight',
		}))
		if (entries.length === 0) return null
		return { datasets: entries }
	}, [activeDatasets])

	const weightLegendDatasets = useMemo(
		() => activeDatasets.filter((dataset) => dataset.id !== 'bonus'),
		[activeDatasets],
	)
	const bonusLegendDataset = useMemo(
		() => activeDatasets.find((dataset) => dataset.id === 'bonus') ?? null,
		[activeDatasets],
	)

	const chartOptions = useMemo<ChartOptions<'line'>>(
		() => ({
			responsive: true,
			maintainAspectRatio: false,
			interaction: { mode: 'nearest', intersect: false },
			plugins: {
				legend: { display: false },
				tooltip: {
					displayColors: false,
					backgroundColor: 'rgba(17, 24, 39, 0.9)',
					titleColor: '#f9fafb',
					bodyColor: '#f9fafb',
					callbacks: {
						label: (context: TooltipItem<'line'>) => {
							const raw = context.raw as ChartPoint | undefined
							if (raw?.label) return raw.label
							const parsedX = context.parsed.x
							const dateLabel = Number.isFinite(parsedX)
								? formatDisplayDate(toDateKey(new Date(parsedX)))
								: context.label ?? ''
							return `${dateLabel} • ${context.formattedValue}`
						},
					},
				},
			},
			scales: {
				x: {
					type: 'time',
					time: { tooltipFormat: 'PP' },
					grid: { color: 'rgba(255,255,255,0.07)' },
					ticks: {
						color: 'rgba(255,255,255,0.6)',
						maxRotation: 0,
					},
				},
				weight: {
					beginAtZero: true,
					grid: { color: 'rgba(255,255,255,0.07)' },
					ticks: { color: 'rgba(255,255,255,0.6)' },
					title: {
						display: true,
						text: 'Weight (lb)',
						color: 'rgba(255,255,255,0.6)',
						padding: { bottom: 8 },
					},
					position: 'left',
				},
				bonus: {
					beginAtZero: true,
					grid: {
						color: 'rgba(255,255,255,0.07)',
						drawOnChartArea: false,
					},
					ticks: {
						color: 'rgba(255,255,255,0.6)',
						stepSize: 1,
						precision: 0,
						callback: (value) =>
							typeof value === 'number' ? `${Math.round(value)}` : value,
					},
					title: {
						display: true,
						text: 'Bonus reps',
						color: 'rgba(255,255,255,0.6)',
						padding: { bottom: 8 },
					},
					position: 'right',
				},
			},
		}),
		[],
	)

	return (
		<section className="space-y-10">
			<header className="space-y-2">
				<h2 className="text-2xl font-semibold">Progress chart</h2>
				<p className="text-app-muted text-sm">
					Track weight progress per exercise and bonus reps.
				</p>
			</header>

			<div className="border-app-border bg-app-surface/80 rounded-3xl border p-4">
				{chartData ? (
					<div className="flex flex-col gap-4">
						<div className="h-72 w-full">
							<Line
								data={chartData}
								options={chartOptions}
								aria-label="Workout history line chart"
								role="img"
							/>
						</div>

						<div className="flex flex-wrap gap-4">
							<div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
								<ul
									aria-label="Weight datasets"
									className="flex flex-wrap gap-4"
								>
									{weightLegendDatasets.map((dataset) => (
										<li
											key={dataset.id}
											className="text-app-muted flex items-center gap-2 text-sm"
										>
											<span
												className="inline-block h-2.5 w-6 rounded-full"
												style={{ backgroundColor: dataset.color }}
												aria-hidden
											/>
											{dataset.label}
										</li>
									))}
								</ul>
								{bonusLegendDataset ? (
									<ul
										aria-label="Bonus datasets"
										className="flex items-center gap-4"
									>
										<li className="text-app-muted flex items-center gap-2 text-sm">
											<span
												className="inline-block h-2.5 w-6 rounded-full"
												style={{ backgroundColor: bonusLegendDataset.color }}
												aria-hidden
											/>
											{bonusLegendDataset.label}
										</li>
									</ul>
								) : null}
							</div>
						</div>
						<p className="text-app-muted text-xs">
							Weight uses the left axis; bonus reps use the right axis.
						</p>
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
