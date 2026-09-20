import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { padRelay } from './pad-relay';

export default defineConfig({
	server: {
		// The phone pad through a Cloudflare tunnel (npm run dev:pad-tunnel)
		allowedHosts: ['.trycloudflare.com']
	},
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// The game is all client-side: build it as a plain static site (Cloudflare Pages
			// serves it, and index.html answers every route: see src/routes/+layout.ts)
			adapter: adapter({ fallback: 'index.html' })
		}),
		// The phone pad (/pad) connects to games through the dev server
		padRelay()
	]
});
