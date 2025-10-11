import { useCallback, useEffect, useState } from 'react'
import z from 'zod'
import type { DeclaredModel } from './declareModel'

export function useLocalData<Schema extends z.ZodTypeAny>(
	key: string,
	model: DeclaredModel<Schema>,
) {
	const [data, setData] = useState<z.output<Schema>>(() => {
		const serialized = window.localStorage.getItem(key)
		if (!serialized) return model.defaultValue
		const parsed = model.parse(serialized)
		return parsed
	})

	const setLocalData = useCallback(
		(
			value: z.output<Schema> | ((prev: z.output<Schema>) => z.output<Schema>),
		) => {
			setData((prev) => {
				const next =
					typeof value === 'function'
						? (value as (current: z.output<Schema>) => z.output<Schema>)(prev)
						: value
				window.localStorage.setItem(key, model.stringify(next))
				return next
			})
		},
		[key, model],
	)

	return [data, setLocalData] as const
}
