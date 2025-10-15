import type { Route } from './+types/route'
import { ToolCard } from '~/components/tool-card'

export function meta({}: Route.MetaArgs) {
	return [
		{ title: 'Toolbox of Destiny' },
		{
			name: 'description',
			content: 'Bespoke self-improvement tools.',
		},
	]
}

export default function Home() {
	return (
		<main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-14 px-6 pt-24 pb-16 sm:px-10">
			<header className="space-y-6 text-center text-balance sm:text-left">
				<p className="text-primary text-sm font-semibold tracking-[0.35em] uppercase">
					Toolbox of Destiny
				</p>
				<h1 className="text-4xl leading-tight font-semibold sm:text-5xl">
					Building discipline, momentum, and mastery
				</h1>
			</header>

			<section
				aria-labelledby="toolbox-heading"
				className="border-app-border bg-app-surface/70 shadow-soft space-y-6 rounded-[--radius-lg] border p-6 backdrop-blur sm:p-8"
				data-testid="toolbox-section"
			>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
					<div className="space-y-2">
						<h2
							id="toolbox-heading"
							className="text-app-foreground text-xl font-semibold sm:text-2xl"
						>
							Your current arsenal
						</h2>
					</div>
				</div>

				<ul className="grid gap-5 sm:grid-cols-2" data-testid="tool-card-list">
					<ToolCard
						name="Workout Tracker"
						summary="Get strong with a simple 5x5 lifting program."
						to="/workout"
					/>
					<ToolCard
						name="Dry-Fire Trainer"
						summary="Slow is smooth, smooth is fast. Practice dry-fire reps under time pressure."
						to="/dry-fire-trainer"
					/>
				</ul>
			</section>
		</main>
	)
}
