import { useCallback, useEffect, useState } from 'react'
import z from 'zod'

type BaseModelConfig<Schema extends z.ZodTypeAny> = {
	model: Schema
	defaultValue: z.output<Schema>
}

type MigrationConfig<
	NextSchema extends z.ZodTypeAny,
	PrevSchema extends z.ZodTypeAny,
> = {
	model: NextSchema
	defaultValue: z.output<NextSchema>
	migration: (value: z.output<PrevSchema>) => z.output<NextSchema>
}

export type DeclaredModel<Schema extends z.ZodTypeAny> = {
	parse(serialized: string): z.output<Schema>
	stringify(value: z.output<Schema>): string
	defaultValue: z.output<Schema>
	migrate<NextSchema extends z.ZodTypeAny>(
		config: MigrationConfig<NextSchema, Schema>,
	): DeclaredModel<NextSchema>
}

type InternalStep = {
	schema: z.ZodTypeAny
	defaultValue: unknown
	migrate?: (value: unknown) => unknown
}

export function declareModel<Schema extends z.ZodTypeAny>(
	config: BaseModelConfig<Schema>,
): DeclaredModel<Schema> {
	const steps: InternalStep[] = [
		{
			schema: config.model,
			defaultValue: config.defaultValue,
		},
	]

	const buildModel = <CurrentSchema extends z.ZodTypeAny>(
		currentIndex: number,
	): DeclaredModel<CurrentSchema> => {
		const index = currentIndex

		const parseLatest = (serialized: string): z.output<CurrentSchema> => {
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

				return currentValue as z.output<CurrentSchema>
			} catch (error) {
				return steps[index]!.schema.parse(
					steps[index]!.defaultValue,
				) as z.output<CurrentSchema>
			}
		}

		return {
			defaultValue: steps[index]!.defaultValue as z.output<CurrentSchema>,
			parse: parseLatest,
			stringify(value: z.output<CurrentSchema>) {
				const parsed = steps[index]!.schema.parse(
					value,
				) as z.output<CurrentSchema>
				return JSON.stringify({
					version: index,
					data: parsed,
				})
			},
			migrate<NextSchema extends z.ZodTypeAny>(
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
