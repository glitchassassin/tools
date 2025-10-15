import { useNavigate } from 'react-router'
import type { MetaFunction } from 'react-router'
import { useDryFireTrackerContext } from '../context.client'

export const meta: MetaFunction = () => [{ title: 'Dry-Fire Trainer' }]

export default function DryFireTrainerHome() {
	const navigate = useNavigate()
	const { data, helpers } = useDryFireTrackerContext()

	const handleStartDrill = (drillId: string) => {
		const session = helpers.createSession(drillId)
		void navigate(`/dry-fire-trainer/session/${session.id}`)
	}

	return (
		<div className="space-y-6">
			<section className="space-y-4">
				<header>
					<h2 className="text-xl font-semibold">Select a drill</h2>
					<p className="text-app-muted mt-1 text-sm">
						Choose a drill to start your practice session
					</p>
				</header>

				<ul className="grid gap-4 sm:grid-cols-2">
					{data.drills.map((drill) => (
						<li key={drill.id}>
							<button
								type="button"
								onClick={() => handleStartDrill(drill.id)}
								className="border-app-border bg-app-surface hover:border-primary/40 hover:bg-app-surface/90 focus-visible:outline-primary/70 w-full rounded-2xl border p-6 text-left transition focus-visible:outline focus-visible:outline-offset-2"
							>
								<h3 className="text-lg font-semibold">{drill.name}</h3>
								<div className="text-app-muted mt-2 space-y-1 text-sm">
									<p>
										Par time:{' '}
										<span className="text-primary font-medium">
											{drill.parTime}s
										</span>
									</p>
									<p>
										Reps: <span className="font-medium">{drill.reps}</span>
									</p>
								</div>
							</button>
						</li>
					))}
				</ul>

				{data.drills.length === 0 && (
					<div className="border-app-border bg-app-surface/80 rounded-2xl border p-8 text-center">
						<p className="text-app-muted text-sm">
							No drills configured. Go to Settings to create your first drill.
						</p>
					</div>
				)}
			</section>
		</div>
	)
}
