import { useState } from 'react'
import type { MetaFunction } from 'react-router'
import { useDryFireTrackerContext } from '../context.client'
import type { DrillConfig } from '../data.client'

export const meta: MetaFunction = () => [
	{ title: 'Settings - Dry-Fire Trainer' },
]

type DrillFormData = Omit<DrillConfig, 'id'>

export default function DryFireTrainerSettings() {
	const { data, helpers } = useDryFireTrackerContext()
	const [editingDrill, setEditingDrill] = useState<DrillConfig | null>(null)
	const [isAddingDrill, setIsAddingDrill] = useState(false)
	const [formData, setFormData] = useState<DrillFormData>({
		name: '',
		parTime: 2.0,
		reps: 20,
	})
	const [error, setError] = useState<string | null>(null)
	const [importExportError, setImportExportError] = useState<string | null>(
		null,
	)

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

		try {
			if (editingDrill) {
				helpers.updateDrill(editingDrill.id, formData)
			} else {
				helpers.addDrill(formData)
			}
			handleCancel()
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to save drill')
		}
	}

	const handleDelete = (drill: DrillConfig) => {
		if (!helpers.canDeleteDrill(drill.id)) {
			setError('Cannot delete drill with existing sessions')
			return
		}
		if (confirm(`Delete "${drill.name}"?`)) {
			try {
				helpers.deleteDrill(drill.id)
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to delete drill')
			}
		}
	}

	const handleExport = () => {
		try {
			const serialized = helpers.exportSerializedData()
			const blob = new Blob([serialized], { type: 'application/json' })
			const url = URL.createObjectURL(blob)
			const a = document.createElement('a')
			a.href = url
			a.download = `dry-fire-trainer-${new Date().toISOString().split('T')[0]}.json`
			document.body.appendChild(a)
			a.click()
			document.body.removeChild(a)
			URL.revokeObjectURL(url)
			setImportExportError(null)
		} catch (err) {
			setImportExportError(
				err instanceof Error ? err.message : 'Failed to export data',
			)
		}
	}

	const handleImport = () => {
		const input = document.createElement('input')
		input.type = 'file'
		input.accept = 'application/json'
		input.onchange = (e) => {
			const file = (e.target as HTMLInputElement).files?.[0]
			if (!file) return

			const reader = new FileReader()
			reader.onload = (event) => {
				try {
					const content = event.target?.result as string
					if (
						confirm(
							'Importing will overwrite all existing drills and sessions. Continue?',
						)
					) {
						helpers.importSerializedData(content)
						setImportExportError(null)
					}
				} catch (err) {
					setImportExportError(
						err instanceof Error ? err.message : 'Failed to import data',
					)
				}
			}
			reader.readAsText(file)
		}
		input.click()
	}

	return (
		<div className="space-y-8">
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
										!helpers.canDeleteDrill(drill.id) ||
										isAddingDrill ||
										editingDrill !== null
									}
									title={
										!helpers.canDeleteDrill(drill.id)
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

			<section className="space-y-4">
				<header>
					<h2 className="text-xl font-semibold">Data Management</h2>
					<p className="text-app-muted mt-1 text-sm">
						Import or export your drills and sessions
					</p>
				</header>

				{importExportError && (
					<div className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
						{importExportError}
					</div>
				)}

				<div className="flex gap-3">
					<button
						type="button"
						onClick={handleExport}
						className="border-app-border hover:bg-app-surface/50 flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition"
					>
						Export Data
					</button>
					<button
						type="button"
						onClick={handleImport}
						className="border-app-border hover:bg-app-surface/50 flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition"
					>
						Import Data
					</button>
				</div>
			</section>
		</div>
	)
}
