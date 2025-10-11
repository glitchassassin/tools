import { useCallback, useState } from 'react'
import type { ZodTypeAny } from 'zod'
import type { DeclaredModel, SchemaOutput } from './declareModel'

export function useLocalData<Schema extends ZodTypeAny>(
	key: string,
	model: DeclaredModel<Schema>,
) {
	const [data, setData] = useState<SchemaOutput<Schema>>(() => {
		const serialized = window.localStorage.getItem(key)
		if (!serialized) return model.defaultValue
		const parsed = model.parse(serialized)
		return parsed
	})

	const setLocalData = useCallback(
		(
			value:
				| SchemaOutput<Schema>
				| ((prev: SchemaOutput<Schema>) => SchemaOutput<Schema>),
		) => {
			setData((prev) => {
				const next =
					typeof value === 'function'
						? (value as (current: SchemaOutput<Schema>) => SchemaOutput<Schema>)(prev)
						: value
				window.localStorage.setItem(key, model.stringify(next))
				return next
			})
		},
		[key, model],
	)

	return [data, setLocalData] as const
}
