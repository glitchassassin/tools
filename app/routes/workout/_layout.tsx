import { Link, NavLink, Outlet } from 'react-router'
import type { MetaFunction } from 'react-router'
import { ClientOnly } from 'remix-utils/client-only'
import { WorkoutTrackerProvider } from './context.client'

export const meta: MetaFunction = () => [
	{ title: 'Workout Tracker' },
	{
		name: 'description',
		content: 'Track 5x5 workouts, progress, and history.',
	},
]

const NAV_ITEMS = [
	{ to: '/workout', label: 'Workout' },
	{ to: '/workout/history', label: 'History' },
	{ to: '/workout/settings', label: 'Settings' },
]

export default function WorkoutLayout() {
	return (
		<main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
			<header className="space-y-2">
				<Link
					to="/"
					className="text-app-muted hover:text-primary text-sm tracking-[0.3em] uppercase transition"
				>
					« Back to Tools
				</Link>
				<h1 className="text-3xl font-semibold">Workout Tracker</h1>
			</header>

			<nav aria-label="Workout navigation" className="flex gap-2">
				{NAV_ITEMS.map((item) => (
					<NavLink
						key={item.to}
						to={item.to}
						className={({ isActive }) =>
							[
								'flex-1 rounded-full border px-3 py-2 text-center text-sm font-medium transition',
								isActive
									? 'border-primary bg-primary text-primary-foreground'
									: 'border-app-border bg-app-surface text-app-foreground hover:border-primary/40 hover:text-primary',
							].join(' ')
						}
						end
					>
						{item.label}
					</NavLink>
				))}
			</nav>

			<section className="flex-1">
				<ClientOnly>
					{() => (
						<WorkoutTrackerProvider>
							<Outlet />
						</WorkoutTrackerProvider>
					)}
				</ClientOnly>
			</section>
		</main>
	)
}
