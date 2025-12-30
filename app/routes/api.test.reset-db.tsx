import type { Route } from './+types/api.test.reset-db'
import { getDb } from '~/db/client.server'
import {
	dryFireDrills,
	dryFireSessions,
	dryFireSettings,
	workoutEntries,
	workoutSettings,
	workoutTemplates,
} from '~/db/schema'

export async function action({ context }: Route.ActionArgs) {
	const { env } = context.cloudflare
	if (env.ENVIRONMENT !== 'development') {
		return new Response('Not allowed', { status: 403 })
	}

	const db = getDb(env)

	await db.delete(workoutEntries).run();
	await db.delete(workoutTemplates).run();
	await db.delete(workoutSettings).run();
	await db.delete(dryFireSessions).run();
	await db.delete(dryFireDrills).run();
	await db.delete(dryFireSettings).run();

	return { success: true }
}
