<script lang="ts">
	// On a phone held upright, during a fight: a screen asking you to turn it
	// sideways. Only the fights need landscape; the menus work either way. The game is built for
	// landscape (the touch controls, the HUD, the briefings), so it's better to
	// ask straight away than let someone get as far as a fight first.
	//
	// Where the browser allows it (Android, fullscreen), the button turns the
	// screen for you.
	import { onMount } from 'svelte';
	import { settings } from '$lib/settings.svelte';
	import { goFullscreen, wantsTouchControls } from './phone';
	import { fighting } from './fighting.svelte';

	let upright = $state(false);
	/** This browser can go fullscreen and lock the screen sideways (not iPhones). */
	let canLock = $state(false);

	onMount(() => {
		const portrait = window.matchMedia('(orientation: portrait)');
		const check = () => (upright = portrait.matches && wantsTouchControls(settings.current.touchControls));
		check();
		portrait.addEventListener('change', check);
		window.addEventListener('resize', check);
		canLock = !!document.fullscreenEnabled && typeof (screen.orientation as ScreenOrientation & { lock?: unknown })?.lock === 'function';
		return () => {
			portrait.removeEventListener('change', check);
			window.removeEventListener('resize', check);
		};
	});
</script>

{#if upright && fighting.count > 0}
	<div class="rotate" role="alertdialog" aria-modal="true" aria-label="Turn your phone sideways">
		<div class="phone" aria-hidden="true"><span></span></div>
		<h2>Turn your phone sideways</h2>
		<p>Lantern Corps plays in landscape: your left thumb moves, your right thumb fights.</p>
		{#if canLock}
			<button onclick={() => void goFullscreen()}>Turn it for me</button>
		{:else}
			<p class="tip">Rotation locked? Swipe down from the top right corner and tap the lock to unlock it.</p>
		{/if}
	</div>
{/if}

<style>
	.rotate {
		position: fixed;
		inset: 0;
		z-index: 1000;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 1rem;
		padding: 2rem;
		text-align: center;
		background: radial-gradient(circle at 50% 40%, rgba(15, 79, 52, 0.35), transparent 60%), #03060a;
		touch-action: none;
	}
	h2 {
		margin: 0.5rem 0 0;
		font-size: 1.3rem;
		color: var(--green);
		text-shadow: 0 0 14px color-mix(in srgb, var(--green) 60%, transparent);
	}
	p {
		margin: 0;
		max-width: 18rem;
		opacity: 0.85;
		line-height: 1.4;
	}
	.tip {
		font-size: 0.8rem;
		opacity: 0.6;
	}
	button {
		margin-top: 0.5rem;
		padding: 0.7rem 1.4rem;
		font: inherit;
		font-weight: 800;
		color: var(--text);
		background: var(--suit);
		border: 1px solid var(--suit-lit);
		border-radius: 8px;
	}
	.phone {
		position: relative;
		width: 52px;
		height: 90px;
		border: 3px solid var(--green);
		border-radius: 10px;
		box-shadow: 0 0 18px color-mix(in srgb, var(--green) 45%, transparent);
		animation: turn 2.2s ease-in-out infinite;
	}
	/* The screen, and the Corps' emblem on it */
	.phone span {
		position: absolute;
		inset: 8px 5px;
		border-radius: 4px;
		background: rgba(61, 255, 110, 0.12);
	}
	@keyframes turn {
		0%,
		25% {
			transform: rotate(0deg);
		}
		55%,
		100% {
			transform: rotate(-90deg);
		}
	}
</style>
