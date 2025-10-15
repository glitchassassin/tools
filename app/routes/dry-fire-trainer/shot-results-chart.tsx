import type { Session } from './data.client'

export function ShotResultsChart({ session }: { session: Session }) {
	const maxTime = session.parTime * 1.5
	const parTimePosition = (session.parTime / maxTime) * 100

	return (
		<div className="space-y-2">
			{session.shots.map((shot, index) => {
				const barWidth =
					shot.time !== null && !shot.ignored
						? Math.min((shot.time / maxTime) * 100, 100)
						: 100
				const isHit = shot.hit === true
				const isMiss = shot.hit === false
				const isIgnored = shot.ignored || shot.time === null
				const isOverPar = shot.time !== null && shot.time > session.parTime

				return (
					<div key={index} className="flex items-center gap-3">
						<span className="text-app-muted w-8 text-right text-xs">
							{index + 1}
						</span>
						<div className="bg-app-border/30 relative h-6 flex-1 overflow-hidden rounded-md">
							{/* Par time line */}
							<div
								className="absolute top-0 bottom-0 z-10 w-0.5 bg-blue-400"
								style={{ left: `${parTimePosition}%` }}
							/>
							<div
								className={[
									'h-full rounded-md transition-all',
									isMiss && !isIgnored && 'bg-red-500',
									isMiss && isIgnored && 'bg-red-500/50',
									isHit && isOverPar && !isIgnored && 'bg-yellow-500',
									isHit && isOverPar && isIgnored && 'bg-yellow-500/50',
									isHit && !isOverPar && !isIgnored && 'bg-green-500',
									isHit && !isOverPar && isIgnored && 'bg-green-500/50',
									shot.hit === null && 'bg-app-muted/30',
								]
									.filter(Boolean)
									.join(' ')}
								style={{ width: `${barWidth}%` }}
							/>
						</div>
						<span className="text-app-muted w-16 text-right text-xs">
							{shot.time !== null && !shot.ignored
								? `${shot.time.toFixed(2)}s`
								: '—'}
						</span>
					</div>
				)
			})}
		</div>
	)
}
