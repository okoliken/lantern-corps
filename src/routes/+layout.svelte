<script lang="ts">
	import favicon from '$lib/assets/favicon.png';
	// Self-hosted fonts (work offline): Orbitron for display, Exo 2 for everything else
	import '@fontsource-variable/orbitron/wght.css';
	import '@fontsource-variable/exo-2/wght.css';
	import '@fontsource-variable/exo-2/wght-italic.css';

	import { GREEN_DIM, THEME_GREEN } from '$lib/theme';

	let { children } = $props();
	// The theme green (and its dim shade) for the whole UI, from the same file the game draws with
	const themeVars = `:root { --green: ${THEME_GREEN}; --green-dim: ${GREEN_DIM}; }`;
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Lantern Corps</title>
	{@html `<style>${themeVars}</style>`}
</svelte:head>

{@render children()}

<style>
	:global(:root) {
		--bg: #03060a;
		--text: #d8f5e0;
		--font-display: 'Orbitron Variable', 'Exo 2 Variable', system-ui, sans-serif;
		--font-ui: 'Exo 2 Variable', system-ui, sans-serif;
	}
	:global(html, body) {
		margin: 0;
		height: 100%;
		background: var(--bg);
		color: var(--text);
		font-family: var(--font-ui);
	}
	/* Titles and big headings in the display face */
	:global(h1, h2) {
		font-family: var(--font-display);
		letter-spacing: 0.06em;
	}
	:global(a) {
		color: var(--green);
	}
</style>
