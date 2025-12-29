import { Link, NavLink, Outlet } from 'react-router'
import type { MetaFunction } from 'react-router'
import type { Route } from './+types/_layout'
import { getDryFireData } from './data.server'
import { getDb } from '~/db/client.server'

export const meta: MetaFunction = () => [
	{ title: 'Dry-Fire Trainer' },
	{
		name: 'description',
		content: 'Practice dry-fire drills with timed shot detection.',
	},
]

export const loader = async ({ context }: Route.LoaderArgs) => {
	const db = getDb(context.cloudflare.env);
	const data = await getDryFireData(db);
	return { data };
}

const NAV_ITEMS = [
	{ to: '/dry-fire-trainer', label: 'Drill' },
	{ to: '/dry-fire-trainer/history', label: 'History' },
	{ to: '/dry-fire-trainer/settings', label: 'Settings' },
]

export default function DryFireTrainerLayout({ loaderData: { data } }: Route.ComponentProps) {

	return (
		<main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
			<header className="space-y-2">
				<Link
					to="/"
					className="text-app-muted hover:text-primary text-sm tracking-[0.3em] uppercase transition"
				>
					« Back to Tools
				</Link>
				<h1 className="text-3xl font-semibold">Dry-Fire Trainer</h1>
			</header>

			<nav aria-label="Dry-fire trainer navigation" className="flex gap-2">
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
				<Outlet context={data} />
			</section>
		</main>
	)
}
