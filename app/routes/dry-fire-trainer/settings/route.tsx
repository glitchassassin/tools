import { useEffect, useState } from 'react'
import type { MetaFunction } from 'react-router'
import { useFetcher } from 'react-router'
import type { DrillConfig } from '../data.server'
import { deleteDrill, updateDryFireSettings, upsertDrill } from '../data.server'
import type { Route } from './+types/route'
import { getDb } from '~/db/client.server'

export const meta: MetaFunction = () => [
	{ title: 'Settings - Dry-Fire Trainer' },
]

export const action = async ({ request, context }: Route.ActionArgs) => {
	const db = getDb(context.cloudflare.env);
	const formData = await request.formData();
	const intent = formData.get('intent');

	if (intent === 'update-settings') {
		const chaosMode = formData.get('chaosMode') === 'true';
		await updateDryFireSettings(db, chaosMode);
		return { success: true };
	}

	if (intent === 'upsert-drill') {
		const drill = JSON.parse(formData.get('drill') as string) as DrillConfig;
		await upsertDrill(db, drill);
		return { success: true };
	}

	if (intent === 'delete-drill') {
		const id = formData.get('id') as string;
		await deleteDrill(db, id);
		return { success: true };
	}

	return { success: false };
}

type DrillFormData = Omit<DrillConfig, 'id'>

export default function DryFireTrainerSettings({ matches }: Route.ComponentProps) {
	const data = matches[1].loaderData.data
	const fetcher = useFetcher<typeof action>()
	const [editingDrill, setEditingDrill] = useState<DrillConfig | null>(null)
	const [isAddingDrill, setIsAddingDrill] = useState(false)
	const [formData, setFormData] = useState<DrillFormData>({
		name: '',
		parTime: 2.0,
		reps: 20,
	})
	const [error, setError] = useState<string | null>(null)


	const handleStartAdd = () => {
		setIsAddingDrill(true)
		setEditingDrill(null)
		setFormData({ name: '', parTime: 2.0, reps: 20 })
		setError(null)
	}

	const handleStartEdit = (drill: DrillConfig) => {
		setEditingDrill(drill)
		setIsAddingDrill(false)
		setFormData({ name: drill.name, parTime: drill.parTime, reps: drill.reps })
		setError(null)
	}

	const handleCancel = () => {
		setIsAddingDrill(false)
		setEditingDrill(null)
		setFormData({ name: '', parTime: 2.0, reps: 20 })
		setError(null)
	}

	useEffect(() => {
		if (fetcher.state === 'idle' && fetcher.data && 'success' in fetcher.data && fetcher.data.success) {
			handleCancel()
		}
	}, [fetcher.state, fetcher.data])

	const handleSave = () => {
		if (!formData.name.trim()) {
			setError('Name is required')
			return
		}
		if (formData.parTime <= 0 || formData.parTime > 60) {
			setError('Par time must be between 0 and 60 seconds')
			return
		}
		if (formData.reps < 1 || formData.reps > 100) {
			setError('Reps must be between 1 and 100')
			return
		}

		const drill: DrillConfig = {
			id: editingDrill?.id ?? `drill-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			...formData,
		}

		void fetcher.submit(
			{ intent: 'upsert-drill', drill: JSON.stringify(drill) },
			{ method: 'POST' },
		)
	}

	const handleDelete = (drill: DrillConfig) => {
		const hasSessions = data.sessions.some(s => s.drillId === drill.id)
		if (hasSessions) {
			setError('Cannot delete drill with existing sessions')
			return
		}
		if (confirm(`Delete "${drill.name}"?`)) {
			void fetcher.submit(
				{ intent: 'delete-drill', id: drill.id },
				{ method: 'POST' },
			)
		}
	}



	return (
		<div className="space-y-8">
			<section className="space-y-4">
				<header>
					<h2 className="text-xl font-semibold">Training Settings</h2>
					<p className="text-app-muted mt-1 text-sm">
						Configure your training experience
					</p>
				</header>

				<div className="border-app-border bg-app-surface/80 space-y-4 rounded-2xl border p-6">
					<div className="flex items-center justify-between">
						<div>
							<h3 className="font-semibold">Chaos Mode</h3>
							<p className="text-app-muted mt-1 text-sm">
								Random gunshot sounds play during training to simulate
								real-world conditions
							</p>
						</div>
						<button
							type="button"
							onClick={() => void fetcher.submit({ intent: 'update-settings', chaosMode: String(!data.chaosMode) }, { method: 'POST' })}
							className={`focus:ring-primary relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none ${
								data.chaosMode ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'
							}`}
							role="switch"
							aria-checked={data.chaosMode}
							aria-label={`Chaos Mode ${data.chaosMode ? 'enabled' : 'disabled'}`}
						>
							<span
								className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
									data.chaosMode ? 'translate-x-6' : 'translate-x-1'
								}`}
							/>
						</button>
					</div>
				</div>
			</section>

			<section className="space-y-4">
				<header className="flex items-baseline justify-between">
					<div>
						<h2 className="text-xl font-semibold">Drills</h2>
						<p className="text-app-muted mt-1 text-sm">
							Manage your custom drills
						</p>
					</div>
					{!isAddingDrill && !editingDrill && (
						<button
							type="button"
							onClick={handleStartAdd}
							className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-4 py-2 text-sm font-medium transition"
						>
							Add Drill
						</button>
					)}
				</header>

				{error && (
					<div className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
						{error}
					</div>
				)}

				{(isAddingDrill || editingDrill) && (
					<div className="border-app-border bg-app-surface/80 space-y-4 rounded-2xl border p-6">
						<h3 className="font-semibold">
							{editingDrill ? 'Edit Drill' : 'Add New Drill'}
						</h3>
						<div className="space-y-4">
							<div>
								<label
									htmlFor="drill-name"
									className="mb-1.5 block text-sm font-medium"
								>
									Name
								</label>
								<input
									id="drill-name"
									type="text"
									value={formData.name}
									onChange={(e) =>
										setFormData({ ...formData, name: e.target.value })
									}
									className="border-app-border bg-app-surface focus:border-primary focus:outline-primary/20 w-full rounded-lg border px-3 py-2 text-sm focus:outline-4"
									placeholder="e.g., Speed Draw"
								/>
							</div>
							<div>
								<label
									htmlFor="drill-par-time"
									className="mb-1.5 block text-sm font-medium"
								>
									Par Time (seconds)
								</label>
								<input
									id="drill-par-time"
									type="number"
									step="0.1"
									min="0.1"
									max="60"
									value={formData.parTime}
									onChange={(e) =>
										setFormData({
											...formData,
											parTime: parseFloat(e.target.value) || 0,
										})
									}
									className="border-app-border bg-app-surface focus:border-primary focus:outline-primary/20 w-full rounded-lg border px-3 py-2 text-sm focus:outline-4"
								/>
							</div>
							<div>
								<label
									htmlFor="drill-reps"
									className="mb-1.5 block text-sm font-medium"
								>
									Default Reps
								</label>
								<input
									id="drill-reps"
									type="number"
									min="1"
									max="100"
									value={formData.reps}
									onChange={(e) =>
										setFormData({
											...formData,
											reps: parseInt(e.target.value, 10) || 0,
										})
									}
									className="border-app-border bg-app-surface focus:border-primary focus:outline-primary/20 w-full rounded-lg border px-3 py-2 text-sm focus:outline-4"
								/>
							</div>
						</div>
						<div className="flex justify-end gap-2">
							<button
								type="button"
								onClick={handleCancel}
								className="border-app-border hover:bg-app-surface/50 rounded-lg border px-4 py-2 text-sm font-medium transition"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={handleSave}
								className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium transition"
							>
								Save
							</button>
						</div>
					</div>
				)}

				<ul className="space-y-3">
					{data.drills.map((drill) => (
						<li
							key={drill.id}
							className="border-app-border bg-app-surface/80 flex items-center justify-between rounded-2xl border p-4"
						>
							<div>
								<h3 className="font-semibold">{drill.name}</h3>
								<div className="text-app-muted mt-1 flex gap-4 text-sm">
									<span>
										Par:{' '}
										<span className="text-primary font-medium">
											{drill.parTime}s
										</span>
									</span>
									<span>
										Reps: <span className="font-medium">{drill.reps}</span>
									</span>
								</div>
							</div>
							<div className="flex gap-2">
								<button
									type="button"
									onClick={() => handleStartEdit(drill)}
									className="hover:bg-app-border/50 rounded-lg px-3 py-1.5 text-sm font-medium transition"
									disabled={isAddingDrill || editingDrill !== null}
								>
									Edit
								</button>
								<button
									type="button"
									onClick={() => handleDelete(drill)}
									className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
									disabled={
										data.sessions.some(s => s.drillId === drill.id) ||
										isAddingDrill ||
										editingDrill !== null
									}
									title={
										data.sessions.some(s => s.drillId === drill.id)
											? 'Cannot delete drill with existing sessions'
											: 'Delete drill'
									}
								>
									Delete
								</button>
							</div>
						</li>
					))}
				</ul>
			</section>

		</div>
	)
}
