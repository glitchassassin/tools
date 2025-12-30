import { useEffect } from 'react'
import type { MetaFunction } from 'react-router'
import { useFetcher, useNavigate } from 'react-router'
import { createSession } from '../data.server'
import type { Route } from './+types/route'
import { getDb } from '~/db/client.server'

export const meta: MetaFunction = () => [{ title: 'Dry Fire Trainer' }]

export const action = async ({ request, context }: Route.ActionArgs) => {
	const db = getDb(context.cloudflare.env);
	const formData = await request.formData();
	const intent = formData.get('intent');

	if (intent === 'create-session') {
		const drillId = formData.get('drillId') as string;
		const session = await createSession(db, drillId);
		return { sessionId: session.id };
	}

	return { success: false };
}

export default function DryFireTrainerHome({ matches }: Route.ComponentProps) {
	const navigate = useNavigate()
	const fetcher = useFetcher<typeof action>()
	const data = matches[1].loaderData.data

	const handleStartDrill = (drillId: string) => {
		void fetcher.submit({ intent: 'create-session', drillId }, { method: 'POST' })
	}

	// Navigate when session is created
	useEffect(() => {
		if (fetcher.state === 'idle' && fetcher.data && 'sessionId' in fetcher.data) {
			const sessionId = fetcher.data.sessionId
			void navigate(`/dry-fire-trainer/session/${sessionId}`)
		}
	}, [fetcher.state, fetcher.data, navigate])

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
