import { defineConfig } from 'vitest/config';

// Engine tests are plain TypeScript, so they don't need the SvelteKit plugin.
export default defineConfig({
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node'
	}
});
