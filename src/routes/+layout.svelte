<script lang="ts">
	import favicon from '$lib/assets/favicon.png';
	// Self-hosted fonts (work offline): Orbitron for display, Exo 2 for everything else
	import '@fontsource-variable/orbitron/wght.css';
	import '@fontsource-variable/exo-2/wght.css';
	import '@fontsource-variable/exo-2/wght-italic.css';
	// Comic lettering for the menus' titles and buttons
	import '@fontsource/bangers/latin-400.css';

	import RotatePrompt from '$lib/touch/RotatePrompt.svelte';
	import InstallBanner from '$lib/touch/InstallBanner.svelte';
	import { SUIT_GREEN, SUIT_GREEN_DARK, SUIT_GREEN_LIT, THEME_GREEN } from '$lib/theme';

	import { onNavigate } from '$app/navigation';
	import { still } from '$lib/components/menu/motion';

	let { children } = $props();

	// Moving between pages crossfades (and the menu switch's highlight slides across) where the browser can
	onNavigate((navigation) => {
		if (!document.startViewTransition || still()) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
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
<!-- On a phone, until the game is installed: add it to the home screen -->
<InstallBanner />

<style>
	:global(:root) {
		--bg: #03060a;
		--text: #d8f5e0;
		--font-display: 'Orbitron Variable', 'Exo 2 Variable', system-ui, sans-serif;
		--font-ui: 'Exo 2 Variable', system-ui, sans-serif;
		--font-comic: 'Bangers', 'Exo 2 Variable', system-ui, sans-serif;
		/* Room at the bottom of the menus while the add-to-home-screen banner shows */
		--install-space: 0px;
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
	:global(html.install-banner) {
		--install-space: 5.5rem;
	}
	:global(a) {
		color: var(--green);
	}

	/* ===== Motion: short and springy ===== */
	:global(:root) {
		--ease-spring: cubic-bezier(0.34, 1.45, 0.64, 1);
		--ease-out: cubic-bezier(0.22, 1, 0.36, 1);
	}
	/* A row of tabs with one highlight that slides between them (slidingPill.ts) */
	:global(.pill-host) {
		position: relative;
		isolation: isolate;
	}
	:global(.pill-host > .pill) {
		position: absolute;
		left: 0;
		top: 0;
		z-index: -1;
		pointer-events: none;
		transition:
			transform 0.4s var(--ease-spring),
			width 0.4s var(--ease-spring),
			height 0.3s var(--ease-out),
			opacity 0.2s;
	}
	/* Picking a card: a quick squash and spring back */
	@keyframes -global-pick {
		0% {
			transform: scale(1);
		}
		35% {
			transform: scale(0.95);
		}
		70% {
			transform: scale(1.025);
		}
		100% {
			transform: scale(1);
		}
	}
	/* Panels popping onto the screen (scale, so it doesn't fight a centring translate) */
	@keyframes -global-pop-in {
		from {
			opacity: 0;
			scale: 0.9;
		}
		65% {
			opacity: 1;
			scale: 1.02;
		}
		to {
			scale: 1;
		}
	}
	@keyframes -global-rise-in {
		from {
			opacity: 0;
			translate: 0 14px;
		}
	}
	@keyframes -global-fade-in {
		from {
			opacity: 0;
		}
	}
	/* Pages: the new one rises in from a little below */
	@keyframes -global-page-in {
		from {
			opacity: 0;
			transform: translateY(14px);
		}
	}
	/* What stays (the field, the header) just carries on; only the page and the switch's highlight move */
	:global(::view-transition-old(root)) {
		display: none;
	}
	:global(::view-transition-new(root)) {
		animation: none;
	}
	:global(::view-transition-old(page)) {
		display: none;
	}
	:global(::view-transition-new(page)) {
		animation: 0.34s var(--ease-out) both page-in;
	}
	/* The page's box doesn't stretch between sizes: the new one just rises in where it belongs */
	:global(::view-transition-group(page)) {
		animation: none;
	}

	:global(::view-transition-group(menu-pill)) {
		animation-duration: 0.4s;
		animation-timing-function: var(--ease-spring);
	}
	@media (prefers-reduced-motion: reduce) {
		:global(*),
		:global(*::before),
		:global(*::after) {
			animation-duration: 0.01ms !important;
			animation-iteration-count: 1 !important;
			transition-duration: 0.01ms !important;
		}
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
