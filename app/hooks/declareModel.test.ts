import { describe, expect, it, vi } from 'vitest'
import z from 'zod'
import { declareModel } from './declareModel'

describe('declareModel', () => {
	it('returns default value when parsing invalid storage', () => {
		const schema = z.object({ name: z.string() })
		const model = declareModel({
			model: schema,
			defaultValue: { name: 'default' },
		})

		expect(model.parse('not-json')).toEqual({ name: 'default' })

		const malformedVersion = JSON.stringify({ version: 20, data: {} })
		expect(model.parse(malformedVersion)).toEqual({ name: 'default' })
	})

	it('stringifies with the latest schema version information', () => {
		const baseSchema = z.object({ fullName: z.string() })
		const nextSchema = z.object({
			firstName: z.string(),
			lastName: z.string(),
		})

		const model = declareModel({
			model: baseSchema,
			defaultValue: { fullName: '' },
		}).migrate({
			model: nextSchema,
			defaultValue: { firstName: '', lastName: '' },
			migration(value) {
				const [firstName = '', lastName = ''] = value.fullName.split(' ')
				return { firstName, lastName }
			},
		})

		const serialized = model.stringify({
			firstName: 'Ada',
			lastName: 'Lovelace',
		})
		expect(JSON.parse(serialized)).toEqual({
			version: 1,
			data: {
				firstName: 'Ada',
				lastName: 'Lovelace',
			},
		})
	})

	it('applies each migration sequentially and validates at every step', () => {
		const baseSchema = z.object({ fullName: z.string() })
		const firstSchema = z.object({
			firstName: z.string(),
			lastName: z.string(),
		})
		const finalSchema = z.object({
			firstName: z.string(),
			lastName: z.string(),
			displayName: z.string(),
		})

		const splitName = vi.fn((value: z.output<typeof baseSchema>) => {
			const [firstName = '', lastName = ''] = value.fullName.split(' ')
			return { firstName, lastName }
		})
		const buildDisplayName = vi.fn((value: z.output<typeof firstSchema>) => ({
			...value,
			displayName: `${value.firstName} ${value.lastName}`.trim(),
		}))

		const model = declareModel({
			model: baseSchema,
			defaultValue: { fullName: '' },
		})
			.migrate({
				model: firstSchema,
				defaultValue: { firstName: '', lastName: '' },
				migration: splitName,
			})
			.migrate({
				model: finalSchema,
				defaultValue: { firstName: '', lastName: '', displayName: '' },
				migration: buildDisplayName,
			})

		const legacy = JSON.stringify({
			version: 0,
			data: { fullName: 'Grace Hopper' },
		})

		expect(model.parse(legacy)).toEqual({
			firstName: 'Grace',
			lastName: 'Hopper',
			displayName: 'Grace Hopper',
		})
		expect(splitName).toHaveBeenCalledTimes(1)
		expect(splitName).toHaveBeenCalledWith({ fullName: 'Grace Hopper' })
		expect(buildDisplayName).toHaveBeenCalledTimes(1)
		expect(buildDisplayName).toHaveBeenCalledWith({
			firstName: 'Grace',
			lastName: 'Hopper',
		})

		const invalidIntermediate = JSON.stringify({
			version: 1,
			data: { firstName: 'Single' },
		})
		expect(model.parse(invalidIntermediate)).toEqual({
			firstName: '',
			lastName: '',
			displayName: '',
		})
	})
})
