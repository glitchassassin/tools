import { useState } from 'react'
import type { MetaFunction } from 'react-router'
import { useDryFireTrackerContext } from '../context.client'
import { calculateSessionStats, formatSessionDate } from '../data.client'
import type { Session } from '../data.client'
import { ShotResultsChart } from '../shot-results-chart'

export const meta: MetaFunction = () => [
	{ title: 'History - Dry-Fire Trainer' },
]

export default function DryFireTrainerHistory() {
	const { data, helpers } = useDryFireTrackerContext()
	const [selectedSession, setSelectedSession] = useState<Session | null>(null)

	const completedSessions = data.sessions
		.filter((session) => session.completed)
		.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))

	const handleDelete = (session: Session) => {
		if (confirm(`Delete session from ${formatSessionDate(session.date)}?`)) {
			helpers.deleteSession(session.id)
			if (selectedSession?.id === session.id) {
				setSelectedSession(null)
			}
		}
	}

	if (selectedSession) {
		const stats = calculateSessionStats(selectedSession)

		return (
			<div className="space-y-6">
				<button
					type="button"
					onClick={() => setSelectedSession(null)}
					className="text-app-muted hover:text-app-foreground text-sm transition"
				>
					← Back to history
				</button>

				<section className="space-y-4">
					<header>
						<h2 className="text-xl font-semibold">
							{selectedSession.drillName}
						</h2>
						<p className="text-app-muted mt-1 text-sm">
							{formatSessionDate(selectedSession.date)}
						</p>
					</header>

					<div className="border-app-border bg-app-surface/80 grid gap-4 rounded-2xl border p-6 sm:grid-cols-4">
						<div>
							<p className="text-app-muted text-xs tracking-wider uppercase">
								Hit Rate
							</p>
							<p className="text-primary mt-1 text-2xl font-semibold">
								{stats.total > 0 ? `${Math.round(stats.hitRate * 100)}%` : '—'}
							</p>
						</div>
						<div>
							<p className="text-app-muted text-xs tracking-wider uppercase">
								Hits
							</p>
							<p className="mt-1 text-2xl font-semibold text-green-500">
								{stats.hit}
							</p>
						</div>
						<div>
							<p className="text-app-muted text-xs tracking-wider uppercase">
								Slow
							</p>
							<p className="mt-1 text-2xl font-semibold text-yellow-500">
								{stats.slow}
							</p>
						</div>
						<div>
							<p className="text-app-muted text-xs tracking-wider uppercase">
								Misses
							</p>
							<p className="mt-1 text-2xl font-semibold text-red-500">
								{stats.missed}
							</p>
						</div>
					</div>

					<div className="border-app-border bg-app-surface/80 space-y-4 rounded-2xl border p-6">
						<h3 className="text-sm font-semibold tracking-wider uppercase">
							Shot Results
						</h3>
						<ShotResultsChart session={selectedSession} />
					</div>
				</section>
			</div>
		)
	}

	return (
		<div className="space-y-6">
			<section className="space-y-4">
				<header>
					<h2 className="text-xl font-semibold">Practice History</h2>
					<p className="text-app-muted mt-1 text-sm">
						Review your past training sessions
					</p>
				</header>

				{completedSessions.length === 0 ? (
					<div className="border-app-border bg-app-surface/80 rounded-2xl border p-8 text-center">
						<p className="text-app-muted text-sm">
							No completed sessions yet. Start your first drill to build your
							practice history.
						</p>
					</div>
				) : (
					<ul className="space-y-3">
						{completedSessions.map((session) => {
							const stats = calculateSessionStats(session)
							return (
								<li
									key={session.id}
									className="border-app-border bg-app-surface/80 flex items-center justify-between rounded-2xl border p-4"
								>
									<button
										type="button"
										onClick={() => setSelectedSession(session)}
										className="flex-1 text-left transition hover:opacity-80"
									>
										<h3 className="font-semibold">{session.drillName}</h3>
										<div className="text-app-muted mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
											<span>{formatSessionDate(session.date)}</span>
											<span>
												Hit rate:{' '}
												<span className="text-primary font-medium">
													{stats.total > 0
														? `${Math.round(stats.hitRate * 100)}%`
														: '—'}
												</span>
											</span>
											<span>
												<span className="font-medium text-green-500">
													{stats.hit}
												</span>
												{' / '}
												<span className="font-medium text-yellow-500">
													{stats.slow}
												</span>
												{' / '}
												<span className="font-medium text-red-500">
													{stats.missed}
												</span>
											</span>
										</div>
									</button>
									<button
										type="button"
										onClick={() => handleDelete(session)}
										className="ml-4 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
									>
										Delete
									</button>
								</li>
							)
						})}
					</ul>
				)}
			</section>
		</div>
	)
}
