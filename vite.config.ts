import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	// Dev only: requests to /jf-proxy/* are forwarded to your Jellyfin server,
	// so the dev server never needs CORS changes on the Jellyfin side.
	const target = env.VITE_JELLYFIN_URL;

	return {
		plugins: [
			tailwindcss(),
			sveltekit({
				compilerOptions: {
					runes: ({ filename }) =>
						filename.split(/[/\\]/).includes('node_modules') ? undefined : true
				},
				// Static SPA. The hash router means the build works from any
				// path: Jellyfin's /web/, a custom base URL, or a plain file server.
				adapter: adapter({ fallback: 'index.html', strict: false }),
				router: { type: 'hash' },
				paths: { relative: true },
				output: { bundleStrategy: 'split' }
			})
		],
		server: target
			? {
					proxy: {
						'/jf-proxy': {
							target,
							changeOrigin: true,
							ws: true,
							rewrite: (p) => p.replace(/^\/jf-proxy/, '')
						}
					}
				}
			: undefined,
		test: {
			environment: 'jsdom',
			include: ['src/**/*.test.ts'],
			setupFiles: ['src/test-setup.ts']
		},
		resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined
	};
});
