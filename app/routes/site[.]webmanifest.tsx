interface WebManifestIcon {
	src: string
	sizes: string
	type: string
}

interface WebManifest {
	name: string
	short_name: string
	description: string
	start_url: string
	display: string
	background_color: string
	theme_color: string
	icons: WebManifestIcon[]
}

export async function loader() {
	const manifest: WebManifest = {
		name: 'Toolbox of Destiny',
		short_name: 'ToD',
		description: 'Building discipline, momentum, and mastery',
		start_url: '/',
		display: 'standalone',
		background_color: '#18181b',
		theme_color: '#f59e0b',
		icons: [
			{
				src: '/assets/web-app-manifest-192x192.png',
				sizes: '192x192',
				type: 'image/png',
			},
			{
				src: '/assets/web-app-manifest-512x512.png',
				sizes: '512x512',
				type: 'image/png',
			},
		],
	}

	return new Response(JSON.stringify(manifest, null, 2), {
		headers: {
			'Content-Type': 'application/manifest+json',
			'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
		},
	})
}
