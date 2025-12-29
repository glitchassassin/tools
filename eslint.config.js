import { config as defaultConfig } from '@epic-web/config/eslint'
import unusedImports from 'eslint-plugin-unused-imports'

/** @type {import("eslint").Linter.Config[]} */
export default [
	...defaultConfig,
	{
		plugins: {
			'unused-imports': unusedImports,
		},
		rules: {
			// Enforce separate type imports consistently
			'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
			'import/no-duplicates': ['error', { 'prefer-inline': false }],
			
			// Unused imports
			'no-unused-vars': 'off', // Disable eslint rule
			'@typescript-eslint/no-unused-vars': 'off', // Disable ts rule if present
			'unused-imports/no-unused-imports': 'error',
			'unused-imports/no-unused-vars': [
				'warn',
				{
					vars: 'all',
					varsIgnorePattern: '^_',
					args: 'after-used',
					argsIgnorePattern: '^_',
				},
			],
		},
	},
	{
		ignores: [
			'.react-router/**',
			'.wrangler/**',
			'playwright-report/**',
			'test-results/**',
			'worker-configuration.d.ts',
			'node_modules/**',
		],
	},
]
