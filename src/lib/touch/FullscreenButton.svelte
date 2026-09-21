<script lang="ts">
	// Play fullscreen. Where the browser can (laptops, Android) it's one tap.
	// iPhones don't let any website go fullscreen, in Safari or Chrome: there
	// it's done by adding the game to the Home Screen and opening it from
	// there, so the button shows how. Hidden when already playing from the
	// Home Screen.
	import { onMount } from 'svelte';

	interface Props {
		/** Smaller, for the pause menu's header. */
		compact?: boolean;
	}
	let { compact = false }: Props = $props();

	let can = $state(false);
	let full = $state(false);
	/** Opened from the Home Screen already: fullscreen as it is. */
	let installed = $state(false);
	let iphone = $state(false);
	let chrome = $state(false);
	let help = $state(false);

	onMount(() => {
		can = !!document.fullscreenEnabled;
		installed = window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
		iphone = /iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1 && !can);
		chrome = /CriOS/.test(navigator.userAgent);
		const change = () => (full = !!document.fullscreenElement);
		change();
		document.addEventListener('fullscreenchange', change);
		return () => document.removeEventListener('fullscreenchange', change);
	});

	async function toggle() {
		if (!can) {
			help = true;
			return;
		}
		try {
			if (document.fullscreenElement) await document.exitFullscreen();
			else {
				await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
				// A phone plays sideways
				await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape').catch(() => {});
			}
		} catch {
			help = true;
		}
	}
</script>

{#if !installed && (can || iphone)}
	<button class="fs" class:compact onclick={toggle} aria-label={full ? 'Leave fullscreen' : 'Play fullscreen'}>
		<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
			{#if full}
				<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
			{:else}
				<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
			{/if}
		</svg>
		{#if !compact}<span>{full ? 'Exit fullscreen' : 'Fullscreen'}</span>{/if}
	</button>
{/if}

{#if help}
	<div class="sheet" role="dialog" aria-modal="true" aria-label="Play fullscreen on iPhone">
		<div class="card">
			<h2>Fullscreen on iPhone</h2>
			<p>iPhones don't let websites go fullscreen, but you can put Lantern Corps on your Home Screen, and from there it plays fullscreen with no browser bars, like an app.</p>
			<ol>
				{#if chrome}
					<li>Tap <b>Share</b> <span class="icon">⍐</span> in the address bar.</li>
				{:else}
					<li>Tap <b>Share</b> <span class="icon">⍐</span> at the bottom of Safari.</li>
				{/if}
				<li>Scroll down and tap <b>Add to Home Screen</b>.</li>
				<li>Open <b>Lantern Corps</b> from your Home Screen.</li>
			</ol>
			<p class="small">The Home Screen version keeps its own save: iPhones keep it apart from the browser's, so missions finished in the browser start locked there.</p>
			<button onclick={() => (help = false)}>Got it</button>
		</div>
	</div>
{/if}

<style>
	.fs {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.8rem;
		font: inherit;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--green);
		background: rgba(3, 6, 10, 0.6);
		border: 1px solid var(--suit-lit);
		border-radius: 6px;
		cursor: pointer;
	}
	.fs.compact {
		padding: 0.35rem 0.5rem;
	}
	.fs:hover,
	.fs:focus-visible {
		border-color: var(--green);
	}
	svg path {
		fill: none;
		stroke: currentColor;
		stroke-width: 2.2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.sheet {
		position: fixed;
		inset: 0;
		z-index: 900;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: rgba(3, 6, 10, 0.8);
	}
	.card {
		width: min(28rem, 100%);
		max-height: 100%;
		overflow: auto;
		box-sizing: border-box;
		padding: 1.2rem 1.4rem;
		text-align: left;
		border: 2px solid var(--suit-lit);
		border-radius: 12px;
		background: #06100b;
	}
	h2 {
		margin: 0 0 0.5rem;
		font-size: 1.1rem;
		color: var(--green);
	}
	p {
		margin: 0 0 0.6rem;
		line-height: 1.4;
	}
	ol {
		margin: 0 0 0.6rem;
		padding-left: 1.3rem;
		display: grid;
		gap: 0.35rem;
	}
	.icon {
		display: inline-block;
		padding: 0 0.25rem;
		border: 1px solid var(--suit-lit);
		border-radius: 4px;
		color: var(--green);
	}
	.small {
		font-size: 0.8rem;
		opacity: 0.7;
	}
	.card button {
		width: 100%;
		padding: 0.6rem;
		font: inherit;
		font-weight: 800;
		color: var(--text);
		background: var(--suit);
		border: 1px solid var(--suit-lit);
		border-radius: 8px;
	}
</style>
