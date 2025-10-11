import type { ZodTypeAny } from 'zod'

export type SchemaOutput<Schema extends ZodTypeAny> = Schema['_output']

type BaseModelConfig<Schema extends ZodTypeAny> = {
	model: Schema
	defaultValue: SchemaOutput<Schema>
}

type MigrationConfig<
	NextSchema extends ZodTypeAny,
	PrevSchema extends ZodTypeAny,
> = {
	model: NextSchema
	defaultValue: SchemaOutput<NextSchema>
	migration: (value: SchemaOutput<PrevSchema>) => SchemaOutput<NextSchema>
}

export type DeclaredModel<Schema extends ZodTypeAny> = {
	parse(serialized: string): SchemaOutput<Schema>
	stringify(value: SchemaOutput<Schema>): string
	defaultValue: SchemaOutput<Schema>
	migrate<NextSchema extends ZodTypeAny>(
		config: MigrationConfig<NextSchema, Schema>,
	): DeclaredModel<NextSchema>
}

type InternalStep = {
	schema: ZodTypeAny
	defaultValue: unknown
	migrate?: (value: unknown) => unknown
}

export function declareModel<Schema extends ZodTypeAny>(
	config: BaseModelConfig<Schema>,
): DeclaredModel<Schema> {
	const steps: InternalStep[] = [
		{
			schema: config.model,
			defaultValue: config.defaultValue,
		},
	]

	const buildModel = <CurrentSchema extends ZodTypeAny>(
		currentIndex: number,
	): DeclaredModel<CurrentSchema> => {
		const index = currentIndex

		const parseLatest = (serialized: string): SchemaOutput<CurrentSchema> => {
			try {
				const raw = JSON.parse(serialized) as unknown

				let version = 0
				let payload: unknown = raw

				if (
					raw &&
					typeof raw === 'object' &&
					'version' in raw &&
					'data' in raw
				) {
					const candidateVersion = (raw as { version: unknown }).version
					if (
						typeof candidateVersion === 'number' &&
						Number.isInteger(candidateVersion)
					) {
						version = candidateVersion
						payload = (raw as { data: unknown }).data
					}
				}

				if (version < 0 || version >= steps.length) {
					throw new Error('Unknown model version')
				}

				let currentValue = steps[version]!.schema.parse(payload)
				for (let i = version + 1; i < steps.length; i += 1) {
					const step = steps[i]!
					if (typeof step.migrate !== 'function') {
						throw new Error(`Missing migration for version ${i}`)
					}
					const migrated = step.migrate(currentValue)
					currentValue = step.schema.parse(migrated)
				}

				return currentValue as SchemaOutput<CurrentSchema>
			} catch {
				return steps[index]!.schema.parse(steps[index]!.defaultValue) as SchemaOutput<CurrentSchema>
			}
		}

		return {
			defaultValue: steps[index]!.defaultValue as SchemaOutput<CurrentSchema>,
			parse: parseLatest,
			stringify(value: SchemaOutput<CurrentSchema>) {
				const parsed = steps[index]!.schema.parse(value) as SchemaOutput<CurrentSchema>
				return JSON.stringify({
					version: index,
					data: parsed,
				})
			},
			migrate<NextSchema extends ZodTypeAny>(
				nextConfig: MigrationConfig<NextSchema, CurrentSchema>,
			): DeclaredModel<NextSchema> {
				steps.push({
					schema: nextConfig.model,
					defaultValue: nextConfig.defaultValue,
					migrate: nextConfig.migration as (value: unknown) => unknown,
				})
				return buildModel<NextSchema>(steps.length - 1)
			},
		}
	}

	return buildModel<Schema>(0)
}
