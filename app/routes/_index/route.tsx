import { useEffect, useState } from 'react'
import { Link, useFetcher } from 'react-router'
import { getDb } from '~/db/client.server'
import { getWorkoutData } from '~/routes/workout/data.server'
import type { Route } from './+types/route'
import { getMeditationContent, updateMeditationContent } from './meditation.server'

export function meta({}: Route.MetaArgs) {
	return [
		{ title: 'Toolbox of Destiny' },
		{
			name: 'description',
			content: 'Building discipline, momentum, and mastery.',
		},
	]
}

export const action = async ({ request, context }: Route.ActionArgs) => {
	const db = getDb(context.cloudflare.env)
	const formData = await request.formData()
	const content = formData.get('content') as string
	await updateMeditationContent(db, content)
	return { success: true }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null

export const clientAction = async ({ serverAction }: Route.ClientActionArgs) => {
	if (debounceTimer) clearTimeout(debounceTimer)

	return new Promise((resolve) => {
		debounceTimer = setTimeout(() => {
			resolve(serverAction())
		}, 1000)
	})
}

export const loader = async ({ context }: Route.LoaderArgs) => {
	const db = getDb(context.cloudflare.env)
	const { workouts } = await getWorkoutData(db)
	const meditationContent = await getMeditationContent(db)

	let maxSquat = 0
	let maxDeadlift = 0
	let maxBench = 0

	Object.values(workouts).forEach((workout) => {
		workout.exercises.forEach((exercise) => {
			if (exercise.weight) {
				if (exercise.id === 'squat') {
					maxSquat = Math.max(maxSquat, exercise.weight)
				} else if (exercise.id === 'deadlift') {
					maxDeadlift = Math.max(maxDeadlift, exercise.weight)
				} else if (exercise.id === 'bench-press') {
					maxBench = Math.max(maxBench, exercise.weight)
				}
			}
		})
	})

	return {
		weightliftingTotal: maxSquat + maxDeadlift + maxBench,
		meditationContent,
	}
}

const TOOLS = [
	{ name: 'Workout Tracker', to: '/workout', icon: '/barbell.svg' },
	{ name: 'Dry-Fire Trainer', to: '/dry-fire-trainer', icon: '/handgun.svg' },
]

const QUOTES = [
	{
		text: 'Seest thou a man diligent in his business? he shall stand before kings; he shall not stand before mean men.',
		author: 'Proverbs 22:29',
	},
	{
		text: 'I am a companion of all them that fear thee, and of them that keep thy precepts.',
		author: 'Psalms 119:63',
	},
	{
		text: 'Honour the Lord with thy substance, and with the firstfruits of all thine increase: So shall thy barns be filled with plenty, and thy presses shall burst out with new wine.',
		author: 'Proverbs 3:9-10',
	},
	{
		text: 'Wisdom is the principal thing; therefore get wisdom: and with all thy getting get understanding.',
		author: 'Proverbs 4:7',
	},
]

export default function Home({ loaderData }: Route.ComponentProps) {
	const [quoteIndex, setQuoteIndex] = useState(0)
	const { weightliftingTotal, meditationContent } = loaderData

	useEffect(() => {
		const interval = setInterval(() => {
			setQuoteIndex((prev) => (prev + 1) % QUOTES.length)
		}, 60000)
		return () => clearInterval(interval)
	}, [])

	const quote = QUOTES[quoteIndex]

	return (
		<main className="mx-auto flex min-h-svh w-full max-w-[1400px] flex-col gap-12 px-6 pt-16 pb-16 sm:px-10 lg:pt-24">
			<header className="space-y-4 text-center text-balance sm:text-left">
				<h1 className="flex items-center justify-center gap-4 text-4xl font-bold tracking-tight text-white sm:justify-start sm:text-7xl">
					<div
						className="bg-current h-12 w-12 shrink-0 sm:h-20 sm:w-20"
						style={{
							maskImage: 'url(/fox.svg)',
							WebkitMaskImage: 'url(/fox.svg)',
							maskSize: 'contain',
							WebkitMaskSize: 'contain',
							maskRepeat: 'no-repeat',
							WebkitMaskRepeat: 'no-repeat',
						}}
					/>
					Toolbox of Destiny
				</h1>
				<p className="text-primary text-lg font-semibold sm:text-2xl">
					Building discipline, momentum, and mastery.
				</p>
			</header>

			<nav className="flex flex-wrap justify-center gap-4 sm:justify-start">
				{TOOLS.map((tool) => (
					<Link
						key={tool.to}
						to={tool.to}
						className="bg-app-surface/50 hover:bg-app-surface-strong border-primary/40 hover:border-primary/80 text-app-foreground flex items-center justify-center gap-4 rounded-2xl border px-8 py-6 text-2xl transition-all hover:-translate-y-1 hover:shadow-lg active:scale-95"
					>
						<div
							className="h-10 w-10 shrink-0 bg-current"
							style={{
								maskImage: `url(${tool.icon})`,
								WebkitMaskImage: `url(${tool.icon})`,
								maskSize: 'contain',
								WebkitMaskSize: 'contain',
								maskRepeat: 'no-repeat',
								WebkitMaskRepeat: 'no-repeat',
							}}
						/>
						{tool.name}
					</Link>
				))}
			</nav>

			<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
				{/* Projects Card */}
				<DashboardCard title="Current Projects">
					<div className="space-y-6">
						<ProjectGroup
							title="Moving Prep"
							status="Active"
							tasks={[
								{
									label:
										'Talk to Jackie about listing our house and looking for a new one',
									done: false,
								},
								{
									label: 'Find a new home for remaining animals',
									done: false,
								},
							]}
						/>
						<ProjectGroup
							title="EverySheep"
							status="Active"
							tasks={[{ label: 'Prove out Fluro sync', done: false }]}
						/>
						<ProjectGroup
							title="Make a will"
							status="Active"
							tasks={[
								{ label: 'Nail down details with Eileen', done: false },
								{ label: 'Draft documents', done: false },
								{ label: 'Get documents witnessed/notarized', done: false },
							]}
						/>
					</div>
				</DashboardCard>

				{/* Goals Card */}
				<DashboardCard title="Goals">
					<div className="space-y-5">
						<GoalItem
							title="Weightlifting (1000lb Club)"
							current={weightliftingTotal}
							total={1000}
						/>
						<GoalItem title="Shooting (Perfect Qual)" current={190} total={240} />
						<GoalItem title="Career (Projects w/ Users)" current={2} total={10} />
						<GoalItem title="Nonfiction (Cert Essays)" current={0} total={44} />
						<GoalItem title="Fiction (Short Stories)" current={0} total={10} />
					</div>
				</DashboardCard>

				<MeditationCard initialContent={meditationContent} />

				{/* Vision Card */}
				<DashboardCard title="Vision">
					<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-1">
						<DashboardCardGroup
							title="Improvement"
							items={['Writing', 'Hospitality', 'Prayer']}
						/>
						<DashboardCardGroup title="Plans" items={['Christmas', 'Family Vacation']} />
						<DashboardCardGroup
							title="Dreams"
							items={[
								'Faithful steward of wealth',
								'Pioneer of practical magic',
								'Legendary hospitality',
							]}
						/>
					</div>
				</DashboardCard>

				{/* Virtues Card */}
				<DashboardCard title="Virtues">
					<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-1">
						<DashboardCardGroup
							title="Theological"
							items={['Faith', 'Hope', 'Love']}
						/>
						<DashboardCardGroup
							title="Cardinal"
							items={['Wisdom', 'Justice', 'Courage', 'Self-Control']}
						/>
					</div>
				</DashboardCard>

				{/* Wisdom Card */}
				<DashboardCard title="Wisdom">
					<blockquote className="space-y-6">
						<p className="text-2xl leading-relaxed italic text-balance">
							"{quote.text}"
						</p>
						<cite className="text-primary not-italic block text-lg font-semibold tracking-wide">
							— {quote.author}
						</cite>
					</blockquote>
				</DashboardCard>
			</div>

			<footer className="text-app-muted mt-auto pt-12 text-center text-sm">
				<p>&copy; {new Date().getFullYear()} Jon Winsley</p>
			</footer>
		</main>
	)
}

function MeditationCard({ initialContent }: { initialContent: string }) {
	const fetcher = useFetcher()
	const [content, setContent] = useState(initialContent)
	const isPending = content !== initialContent

	return (
		<DashboardCard title="Meditation">
			<fetcher.Form method="post">
				<textarea
					name="content"
					value={content}
					onChange={(e) => {
						setContent(e.target.value)
						void fetcher.submit(e.currentTarget.form)
					}}
					placeholder="Write your thoughts here..."
					className={`bg-app-surface/50 text-app-foreground min-h-[200px] w-full resize-none rounded-xl border p-4 transition-all focus:ring-2 focus:ring-primary/50 focus:outline-none ${
						isPending ? 'animate-pending' : 'border-app-border'
					}`}
				/>
			</fetcher.Form>
		</DashboardCard>
	)
}

function DashboardCard({
	title,
	children,
	className = '',
}: {
	title: string
	children: React.ReactNode
	className?: string
}) {
	return (
		<section
			className={`border-app-border bg-app-surface/40 shadow-soft h-fit rounded-[--radius-lg] border p-6 backdrop-blur sm:p-8 ${className}`}
		>
			<h2 className="text-app-muted mb-6 text-sm font-bold tracking-widest uppercase">
				{title}
			</h2>
			<div>{children}</div>
		</section>
	)
}

function ProjectGroup({
	title,
	status,
	tasks,
}: {
	title: string
	status: string
	tasks: { label: string; done: boolean }[]
}) {
	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<h3 className="font-semibold">{title}</h3>
				<span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
					{status}
				</span>
			</div>
			<ul className="text-app-muted space-y-2 text-sm">
				{tasks.map((task, i) => (
					<li key={i} className="flex items-start gap-2">
						<div
							className={`mt-1 h-3 w-3 shrink-0 rounded-sm border border-current ${
								task.done ? 'bg-primary border-primary' : ''
							}`}
						/>
						<span>{task.label}</span>
					</li>
				))}
			</ul>
		</div>
	)
}

function GoalItem({
	title,
	current,
	total,
}: {
	title: string
	current: number
	total: number
}) {
	const percentage = Math.round((current / total) * 100)
	return (
		<div className="space-y-2">
			<div className="flex justify-between text-sm">
				<span className="font-medium">{title}</span>
				<span className="text-app-muted">
					{current} / {total}
				</span>
			</div>
			<div className="bg-app-surface h-2 w-full overflow-hidden rounded-full border border-white/5">
				<div
					className="h-full bg-primary transition-all duration-1000"
					style={{ width: `${percentage}%` }}
				/>
			</div>
		</div>
	)
}

function DashboardCardGroup({ title, items }: { title: string; items: string[] }) {
	return (
		<div className="space-y-2">
			<h3 className="text-app-muted text-xs font-bold tracking-wider uppercase">
				{title}
			</h3>
			<ul className="space-y-1 text-sm font-medium">
				{items.map((item, i) => (
					<li key={i}>{item}</li>
				))}
			</ul>
		</div>
	)
}
