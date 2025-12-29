import type { Session } from './data.server'

export function ShotResultsChart({ session }: { session: Session }) {
	return (
		<div className="grid grid-cols-10 gap-2">
			{session.shots.map((shot, index) => {
				const colorClass =
					shot.result === 'hit'
						? 'bg-green-500'
						: shot.result === 'slow'
							? 'bg-yellow-500'
							: shot.result === 'miss'
								? 'bg-red-500'
								: 'bg-app-muted/30'

				return (
					<div
						key={index}
						className={`${colorClass} flex h-12 w-12 items-center justify-center rounded-md transition-all`}
						title={`Rep ${index + 1}: ${shot.result ?? 'Not completed'}`}
					>
						<span className="text-xs font-semibold text-white opacity-70">
							{index + 1}
						</span>
					</div>
				)
			})}
		</div>
	)
}
