import { cloudflare } from '@cloudflare/vite-plugin'
import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import type { PluginOption } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig(({ mode }) => {
	const isVitest = mode === 'test' || process.env.VITEST !== undefined

	const plugins: PluginOption[] = [
		tailwindcss(),
		reactRouter(),
		tsconfigPaths(),
	]

	if (!isVitest) {
		plugins.unshift(cloudflare({ viteEnvironment: { name: 'ssr' } }))
	}

	return {
		plugins,
		test: {
			include: ['app/**/*.test.ts?(x)'],
		},
	}
})
