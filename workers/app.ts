import { createRequestHandler } from 'react-router'

declare module 'react-router' {
	export interface AppLoadContext {
		cloudflare: {
			env: Env
			ctx: ExecutionContext
		}
	}
}

const requestHandler = createRequestHandler(
	() => import('virtual:react-router/server-build'),
	import.meta.env.MODE,
)

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url)
		const isLocalhost =
			url.hostname === 'localhost' || url.hostname === '127.0.0.1'

		// Force HTTPS - redirect HTTP to HTTPS (except for localhost)
		if (url.protocol === 'http:' && !isLocalhost) {
			url.protocol = 'https:'
			return Response.redirect(url.toString(), 301)
		}

		const response = await requestHandler(request, {
			cloudflare: { env, ctx },
		})

		// Add HSTS header for HTTPS-only enforcement (except for localhost)
		const headers = new Headers(response.headers)
		if (!isLocalhost) {
			headers.set(
				'Strict-Transport-Security',
				'max-age=31536000; includeSubDomains; preload',
			)
		}

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		})
	},
} satisfies ExportedHandler<Env>
