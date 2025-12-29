import { useEffect, useMemo, useState, useId, useRef } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useNavigate, useOutletContext, useFetcher } from 'react-router'
import type { MetaFunction } from 'react-router'
import type { Route } from './+types/route'
import { getDb } from '~/db/client.server'
import { updateWorkoutSettings, upsertWorkoutTemplate } from '../data.server'
import type {
	WorkoutExerciseConfig,
	WorkoutTrackerData,
	WorkoutTemplate,
} from '../data.server'

export const meta: MetaFunction = () => [{ title: 'Workout Settings' }]

export const action = async ({ request, context }: Route.ActionArgs) => {
	const db = getDb(context.cloudflare.env);
	const formData = await request.formData();
	const intent = formData.get('intent');

	if (intent === 'update-settings') {
		const bonusLabel = formData.get('bonusLabel') as string;
		const plates = JSON.parse(formData.get('plates') as string) as number[];
		const templates = JSON.parse(formData.get('templates') as string) as WorkoutTemplate[];

		await updateWorkoutSettings(db, { bonusLabel, plates });
		for (const template of templates) {
			await upsertWorkoutTemplate(db, template);
		}
		return { success: true };
	}

	return { success: false };
}

type DraftConfig = WorkoutTrackerData['config']

export default function WorkoutSettingsRoute({ matches }: Route.ComponentProps) {
	const data = matches[1].loaderData.data
	const fetcher = useFetcher()
	const [draftConfig, setDraftConfig] = useState<DraftConfig>(data.config)
	const [platesInput, setPlatesInput] = useState(data.config.plates.join(', '))
	const [status, setStatus] = useState<'idle' | 'saved'>('idle')
	const [dataMessage, setDataMessage] = useState<{
		type: 'success' | 'error'
		text: string
	} | null>(null)
	const platesFieldLabelId = useId()
	const platesFieldDescriptionId = useId()
	const fileInputRef = useRef<HTMLInputElement | null>(null)

	useEffect(() => {
		setDraftConfig(data.config)
		setPlatesInput(data.config.plates.join(', '))
	}, [data.config])

	const handleTemplateExerciseChange = (
		templateIndex: number,
		exerciseIndex: number,
		field: keyof WorkoutExerciseConfig,
		value: string,
	) => {
		setDraftConfig((prev) => {
			const templates = prev.templates.map((template, index) => {
				if (index !== templateIndex) return template
				const exercises = template.exercises.map((exercise, idx) => {
					if (idx !== exerciseIndex) return exercise
					if (field === 'setCount') {
						const numeric = Number.parseInt(value, 10)
						return {
							...exercise,
							setCount: Number.isFinite(numeric) ? Math.max(1, numeric) : 1,
						}
					}
					return {
						...exercise,
						name: value,
					}
				})
				return {
					...template,
					exercises,
				}
			})
			return {
				...prev,
				templates,
			}
		})
	}

	const handleTemplateNameChange = (templateIndex: number, value: string) => {
		setDraftConfig((prev) => {
			const templates = prev.templates.map((template, index) =>
				index === templateIndex
					? {
							...template,
							name: value,
						}
					: template,
			)
			return {
				...prev,
				templates,
			}
		})
	}

	const handleBonusLabelChange = (value: string) => {
		setDraftConfig((prev) => ({
			...prev,
			bonusLabel: value,
		}))
	}

	const handleExportData = () => {
		setDataMessage({ type: 'error', text: 'Export currently disabled' })
	}

	const handleImportData = async (event: ChangeEvent<HTMLInputElement>) => {
		setDataMessage({ type: 'error', text: 'Import currently disabled' })
	}

	const handleImportButtonClick = () => {
		fileInputRef.current?.click()
	}

	const parsedPlates = useMemo(() => {
		return platesInput
			.split(',')
			.map((token) => Number.parseFloat(token.trim()))
			.filter((value) => Number.isFinite(value) && value > 0)
			.sort((a, b) => b - a)
	}, [platesInput])

	const handleSubmit = (event: FormEvent) => {
		event.preventDefault()
		const sanitizedTemplates = draftConfig.templates.map((template) => ({
			...template,
			name: template.name.trim() || template.name,
			exercises: template.exercises.map((exercise) => ({
				...exercise,
				name: exercise.name.trim() || exercise.name,
				setCount: Math.max(1, Math.round(exercise.setCount)),
			})),
		}))

		const nextPlates = parsedPlates.length > 0 ? parsedPlates : draftConfig.plates;
		const bonusLabel = draftConfig.bonusLabel.trim();

		fetcher.submit(
			{
				intent: 'update-settings',
				bonusLabel,
				plates: JSON.stringify(nextPlates),
				templates: JSON.stringify(sanitizedTemplates),
			},
			{ method: 'POST' },
		)
		setStatus('saved')
		setTimeout(() => setStatus('idle'), 2500)
	}

	return (
		<section className="space-y-8">
			<header className="space-y-2">
				<h2 className="text-2xl font-semibold">Workout templates</h2>
				<p className="text-app-muted text-sm">
					Update exercise names, set counts, bonus reps label, and plate
					denominations.
				</p>
			</header>

			<section className="border-app-border bg-app-surface/80 space-y-3 rounded-3xl border p-5">
				<h3 className="text-lg font-semibold">Import or export data</h3>
				<p className="text-app-muted text-sm">
					Download a backup of your workouts or restore data from a previous
					export.
				</p>
				<div className="flex flex-col gap-3 sm:flex-row">
					<button
						type="button"
						onClick={handleExportData}
						className="bg-app-surface border-app-border text-primary hover:text-primary focus-visible:outline-primary/70 flex-1 rounded-full border px-4 py-2 text-sm font-semibold transition hover:scale-[1.01] focus-visible:outline focus-visible:outline-offset-4 active:scale-[0.99]"
					>
						Export data
					</button>
					<button
						type="button"
						onClick={handleImportButtonClick}
						className="bg-app-surface border-app-border text-primary hover:text-primary focus-visible:outline-primary/70 flex-1 rounded-full border px-4 py-2 text-sm font-semibold transition hover:scale-[1.01] focus-visible:outline focus-visible:outline-offset-4 active:scale-[0.99]"
					>
						Import data
					</button>
					<input
						ref={fileInputRef}
						type="file"
						accept="application/json"
						onChange={handleImportData}
						className="sr-only"
						aria-label="Import workout data file"
					/>
				</div>
				{dataMessage && (
					<p
						role={dataMessage.type === 'error' ? 'alert' : 'status'}
						className={`text-sm ${dataMessage.type === 'error' ? 'text-red-500' : 'text-app-muted'}`}
					>
						{dataMessage.text}
					</p>
				)}
			</section>

			<form onSubmit={handleSubmit} className="space-y-6">
				{draftConfig.templates.map((template, templateIndex) => (
					<fieldset
						key={template.id}
						className="border-app-border bg-app-surface/80 space-y-4 rounded-3xl border p-5"
					>
						<legend className="px-2 text-lg font-semibold">
							<input
								type="text"
								value={template.name}
								onChange={(event) =>
									handleTemplateNameChange(templateIndex, event.target.value)
								}
								className="border-app-border bg-app-surface focus:border-primary w-full rounded-xl border px-3 py-2 text-base font-semibold focus:outline-none"
								aria-label={`Name for template ${templateIndex + 1}`}
							/>
						</legend>
						<div className="space-y-3">
							{template.exercises.map((exercise, exerciseIndex) => (
								<div
									key={exercise.id}
									className="grid grid-cols-[1fr_auto] gap-3 sm:grid-cols-[2fr_auto]"
								>
									<label className="text-app-muted flex flex-col text-sm">
										<span>Exercise name</span>
										<input
											type="text"
											value={exercise.name}
											onChange={(event) =>
												handleTemplateExerciseChange(
													templateIndex,
													exerciseIndex,
													'name',
													event.target.value,
												)
											}
											className="border-app-border bg-app-surface focus:border-primary mt-1 w-full rounded-xl border px-3 py-2 text-base focus:outline-none"
										/>
									</label>
									<label className="text-app-muted flex flex-col text-sm">
										<span>Sets</span>
										<input
											type="number"
											min={1}
											value={exercise.setCount}
											onChange={(event) =>
												handleTemplateExerciseChange(
													templateIndex,
													exerciseIndex,
													'setCount',
													event.target.value,
												)
											}
											className="border-app-border bg-app-surface focus:border-primary mt-1 w-24 rounded-xl border px-3 py-2 text-base focus:outline-none"
										/>
									</label>
								</div>
							))}
						</div>
					</fieldset>
				))}

				<section className="border-app-border bg-app-surface/80 rounded-3xl border p-5">
					<h3 className="text-lg font-semibold">Bonus reps</h3>
					<label className="text-app-muted mt-3 block text-sm">
						Description (leave blank to hide)
						<input
							type="text"
							value={draftConfig.bonusLabel}
							onChange={(event) => handleBonusLabelChange(event.target.value)}
							className="border-app-border bg-app-surface focus:border-primary mt-2 w-full rounded-xl border px-3 py-2 text-base focus:outline-none"
						/>
					</label>
				</section>

				<section className="border-app-border bg-app-surface/80 rounded-3xl border p-5">
					<h3 id={platesFieldLabelId} className="text-lg font-semibold">
						Plate denominations
					</h3>
					<p id={platesFieldDescriptionId} className="text-app-muted text-sm">
						Enter a comma-separated list of per-side plate weights in pounds.
					</p>
					<input
						type="text"
						value={platesInput}
						onChange={(event) => setPlatesInput(event.target.value)}
						aria-labelledby={platesFieldLabelId}
						aria-describedby={platesFieldDescriptionId}
						className="border-app-border bg-app-surface focus:border-primary mt-3 w-full rounded-xl border px-3 py-2 text-base focus:outline-none"
					/>
					<div className="text-app-muted mt-2 text-sm">
						Parsed plates:{' '}
						{parsedPlates.length > 0 ? parsedPlates.join(', ') : '—'}
					</div>
				</section>

				<div className="space-y-2">
					<button
						type="submit"
						className="bg-primary text-primary-foreground focus-visible:outline-primary/70 w-full rounded-full px-4 py-3 text-base font-semibold transition hover:scale-[1.01] focus-visible:outline focus-visible:outline-offset-4 active:scale-[0.99]"
					>
						Save settings
					</button>
					{status === 'saved' && (
						<p role="status" className="text-app-muted text-center text-sm">
							Settings saved. Existing workouts updated to match.
						</p>
					)}
				</div>
			</form>
		</section>
	)
}
