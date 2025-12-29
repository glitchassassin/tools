import { format as formatDate, isValid } from 'date-fns'
import type { Session } from './data.server'

export function formatSessionDate(dateString: string) {
	try {
		const date = new Date(dateString)
		if (!isValid(date)) return dateString
		return formatDate(date, 'M/d/yyyy h:mm a')
	} catch {
		return dateString
	}
}

export function calculateSessionStats(session: Session) {
	const completedShots = session.shots.filter((shot) => shot.result !== null)
	const hitShots = completedShots.filter((shot) => shot.result === 'hit')
	const slowShots = completedShots.filter((shot) => shot.result === 'slow')
	const missedShots = completedShots.filter((shot) => shot.result === 'miss')

	return {
		total: completedShots.length,
		hit: hitShots.length,
		slow: slowShots.length,
		missed: missedShots.length,
		hitRate:
			completedShots.length > 0 ? hitShots.length / completedShots.length : 0,
	}
}
