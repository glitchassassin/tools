import { eq } from 'drizzle-orm'
import type { Db } from '~/db/client.server'
import { meditation } from '~/db/schema'

export async function getMeditationContent(db: Db) {
	let record = await db.query.meditation.findFirst({
		where: eq(meditation.id, 1),
	})

	if (!record) {
		await db
			.insert(meditation)
			.values({
				id: 1,
				content: '',
			})
			.onConflictDoNothing({ target: meditation.id })
			.run()

		record = await db.query.meditation.findFirst({
			where: eq(meditation.id, 1),
		})
	}

	return record?.content ?? ''
}

export async function updateMeditationContent(db: Db, content: string) {
	await db
		.insert(meditation)
		.values({
			id: 1,
			content,
		})
		.onConflictDoUpdate({
			target: meditation.id,
			set: { content },
		})
		.run()
}
