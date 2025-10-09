import { useId } from 'react'
import { Link } from 'react-router'

type ToolCardProps = {
	name: string
	summary: string
	to: string
}

export function ToolCard({ name, summary, to }: ToolCardProps) {
	const titleId = useId()
	const summaryId = useId()
	const dataTestId = `tool-card-${to
		.replace(/^\//, '')
		.replace(/[^a-z0-9]+/gi, '-')
		.replace(/^-|-$/g, '') || 'root'}`

	return (
		<li>
			<Link
				aria-describedby={summaryId}
				aria-labelledby={titleId}
				className="group border-app-border bg-app-surface-strong shadow-soft hover:border-primary/60 focus-visible:ring-primary flex h-full flex-col gap-4 rounded-2xl border p-6 transition outline-none hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:outline-none"
				data-testid={dataTestId}
				to={to}
			>
				<div className="flex items-start justify-between gap-3">
					<h3 id={titleId} className="text-xl leading-snug font-semibold">
						{name}
					</h3>
				</div>
				<p
					id={summaryId}
					className="text-app-muted flex-1 text-sm leading-relaxed"
				>
					{summary}
				</p>
				<div className="text-app-muted flex items-center justify-between text-sm">
					<span className="text-primary font-medium">Launch tool</span>
					<span className="transition duration-200 group-hover:translate-x-1">
						→
					</span>
				</div>
			</Link>
		</li>
	)
}
