<script lang="ts">
	// Play fullscreen. Where the browser can (laptops, Android) it's one tap.
	// iPhones don't let any website go fullscreen, in Safari or Chrome: there
	// it's done by adding the game to the Home Screen and opening it from
	// there, so the button shows how. Hidden when already playing from the
	// Home Screen.
	import { onMount } from 'svelte';
	import InstallSheet from './InstallSheet.svelte';

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
	let help = $state(false);

	onMount(() => {
		can = !!document.fullscreenEnabled;
		installed = window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
		iphone = /iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1 && !can);
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

{#if help}<InstallSheet onClose={() => (help = false)} />{/if}

<style>
	.fs {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.35rem 0.75rem;
		font: inherit;
		font-size: 0.8rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		color: #fff;
		background: var(--toon-card);
		border: 3px solid var(--ink);
		border-radius: 0.7rem;
		box-shadow: 2px 3px 0 var(--ink);
		cursor: pointer;
	}
	.fs.compact {
		padding: 0.35rem 0.45rem;
	}
	.fs:hover,
	.fs:focus-visible {
		background: #19603f;
		outline: none;
	}
	.fs:active {
		transform: translate(2px, 2px);
		box-shadow: 0 0 0 var(--ink);
	}
	svg path {
		fill: none;
		stroke: currentColor;
		stroke-width: 2.4;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
