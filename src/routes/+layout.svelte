<script lang="ts">
	import favicon from '$lib/assets/favicon.png';
	// Self-hosted fonts (work offline): Orbitron for display, Exo 2 for everything else
	import '@fontsource-variable/orbitron/wght.css';
	import '@fontsource-variable/exo-2/wght.css';
	import '@fontsource-variable/exo-2/wght-italic.css';
	// Comic lettering for the menus' titles and buttons
	import '@fontsource/bangers/latin-400.css';

	import RotatePrompt from '$lib/touch/RotatePrompt.svelte';
	import { SUIT_GREEN, SUIT_GREEN_DARK, SUIT_GREEN_LIT, THEME_GREEN } from '$lib/theme';

	let { children } = $props();
	// The UI's greens, from the same file the game draws with: the suit greens for buttons, panels
	// and borders; the bright green for glows and highlights
	const themeVars = `:root { --green: ${THEME_GREEN}; --suit: ${SUIT_GREEN}; --suit-lit: ${SUIT_GREEN_LIT}; --suit-dark: ${SUIT_GREEN_DARK}; }`;
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Lantern Corps</title>
	{@html `<style>${themeVars}</style>`}
</svelte:head>

{@render children()}

<!-- A phone held upright is asked to turn sideways, on every page -->
<RotatePrompt />

<style>
	:global(:root) {
		--bg: #03060a;
		--text: #d8f5e0;
		--font-display: 'Orbitron Variable', 'Exo 2 Variable', system-ui, sans-serif;
		--font-ui: 'Exo 2 Variable', system-ui, sans-serif;
		--font-comic: 'Bangers', 'Exo 2 Variable', system-ui, sans-serif;
		/* The menus' cartoon look: dark ink outlines and hard printed shadows */
		--ink: #04120a;
		--toon-card: #145236; /* a card */
		--toon-well: #0d3b26; /* something set into a card */
		--toon-btn: #19a83d; /* buttons */
		--toon-btn-hi: #22c24a;
		--toon-gold: #ffd84a; /* picked, stars */
		--toon-cream: #fff8d6; /* paper: speech, notes */
		--toon-red: #e8452c; /* failure, danger */
		--toon-light: #7dff9e; /* green lettering */
	}
	:global(html, body) {
		margin: 0;
		/* iPhones blow text up in landscape unless told not to: sizes stay as written */
		-webkit-text-size-adjust: 100%;
		text-size-adjust: 100%;
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
	/* A phone: everything in rem shrinks with it (menus, briefings, panels) */
	@media (max-height: 520px) and (orientation: landscape) {
		:global(html) {
			font-size: 13px;
		}
	}
	@media (max-width: 520px) and (orientation: portrait) {
		:global(html) {
			font-size: 14px;
		}
	}
</style>
