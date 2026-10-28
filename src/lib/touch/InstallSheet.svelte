<script lang="ts">
	// How to play Lantern Corps as an app: one Install button where the browser
	// offers it (Android Chrome), the Share steps on an iPhone, and the browser
	// menu everywhere else.
	import { install } from './install.svelte';

	interface Props {
		onClose: () => void;
	}
	let { onClose }: Props = $props();

	let busy = $state(false);
	/** Where the Share button is: the bottom of Safari held upright, otherwise the top right. */
	const shareAtBottom = install.iosBrowser === 'safari' && typeof matchMedia !== 'undefined' && matchMedia('(orientation: portrait)').matches;
	async function go() {
		busy = true;
		const yes = await install.prompt();
		busy = false;
		if (yes) onClose();
	}
</script>

<div class="sheet" role="dialog" aria-modal="true" aria-label="Play it as an app">
	{#if !install.canPrompt && install.platform === 'iphone'}
		<!-- An arrow at the browser's own Share button: the one thing a website can't press for you -->
		<div class="pointer" class:bottom={shareAtBottom} aria-hidden="true">
			<span class="label">Share is here</span>
			<span class="arrow">{shareAtBottom ? '⬇' : '⬆'}</span>
		</div>
	{/if}
	<div class="card">
		<h2>Play it like an app</h2>
		<p class="lead">On your home screen, Lantern Corps opens fullscreen: no address bar, no browser buttons, the whole screen for the fight.</p>

		{#if install.canPrompt}
			<button class="big" onclick={go} disabled={busy}>Install Lantern Corps</button>
		{:else if install.platform === 'iphone'}
			<ol>
				{#if install.iosBrowser === 'chrome'}
					<li>Tap <b>Share</b> <span class="key">⍐</span> at the right of the address bar.</li>
				{:else if install.iosBrowser === 'safari'}
					<li>Tap <b>Share</b> <span class="key">⍐</span> at the bottom of Safari (tap <b>···</b> first if you don't see it).</li>
				{:else}
					<li>Open your browser's <b>Share</b> menu <span class="key">⍐</span>.</li>
				{/if}
				<li>Scroll down and tap <b>Add to Home Screen</b>.</li>
				<li>Open <b>Lantern Corps</b> from your home screen.</li>
			</ol>
			<p class="small">The home screen app keeps its own save: iPhones keep it apart from the browser's.</p>
		{:else}
			<ol>
				<li>Open your browser's menu <span class="key">⋮</span>.</li>
				<li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li>
				<li>Open <b>Lantern Corps</b> from your home screen. It turns sideways by itself.</li>
			</ol>
		{/if}

		<button class="close" onclick={onClose}>{install.canPrompt ? 'Not now' : 'Got it'}</button>
	</div>
</div>

<style>
	.sheet {
		position: fixed;
		inset: 0;
		z-index: 1100;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: rgba(2, 10, 6, 0.7);
	}
	.pointer {
		position: fixed;
		z-index: 2;
		top: max(0.4rem, env(safe-area-inset-top));
		right: 0.8rem;
		display: grid;
		justify-items: center;
		gap: 0.2rem;
		pointer-events: none;
		animation: point 0.9s ease-in-out infinite;
	}
	.pointer.bottom {
		top: auto;
		right: auto;
		left: 50%;
		bottom: max(0.4rem, env(safe-area-inset-bottom));
		translate: -50% 0;
	}
	.pointer.bottom .arrow {
		order: 2;
	}
	.label {
		padding: 0.1rem 0.6rem;
		border: 3px solid var(--ink);
		border-radius: 0.6rem;
		background: var(--toon-gold);
		color: var(--ink);
		font-family: var(--font-comic);
		font-size: 1.2rem;
		letter-spacing: 0.04em;
		box-shadow: 2px 3px 0 var(--ink);
	}
	.arrow {
		order: -1;
		font-size: 2.6rem;
		line-height: 1;
		color: var(--toon-gold);
		-webkit-text-stroke: 2px var(--ink);
		text-shadow: 2px 3px 0 var(--ink);
	}
	@keyframes point {
		50% {
			transform: translateY(-8px);
		}
	}
	.pointer.bottom {
		animation-name: point-down;
	}
	@keyframes point-down {
		50% {
			transform: translateY(8px);
		}
	}
	.card {
		width: min(28rem, 100%);
		max-height: 100%;
		overflow: auto;
		box-sizing: border-box;
		padding: 1.2rem 1.4rem;
		text-align: left;
		border: 3px solid var(--ink);
		border-radius: 1.3rem;
		background: var(--toon-cream);
		color: #22302a;
		box-shadow: 6px 7px 0 var(--ink);
	}
	h2 {
		margin: 0 0 0.4rem;
		font-family: var(--font-comic);
		font-weight: 400;
		font-size: 2rem;
		letter-spacing: 0.05em;
		color: var(--ink);
	}
	.lead {
		margin: 0 0 0.9rem;
		font-weight: 600;
		line-height: 1.45;
	}
	ol {
		margin: 0 0 0.8rem;
		padding-left: 1.3rem;
		display: grid;
		gap: 0.45rem;
		font-weight: 600;
		line-height: 1.45;
	}
	.key {
		display: inline-block;
		min-width: 1.2em;
		padding: 0 0.3rem;
		border: 2px solid var(--ink);
		border-radius: 0.4rem;
		background: #fff;
		box-shadow: 0 2px 0 var(--ink);
		text-align: center;
		font-weight: 800;
	}
	.small {
		margin: 0 0 0.9rem;
		font-size: 0.8rem;
		font-weight: 600;
		color: #4c5f50;
	}
	button {
		width: 100%;
		font: inherit;
		cursor: pointer;
		border: 3px solid var(--ink);
		border-radius: 0.9rem;
	}
	.big {
		margin-bottom: 0.7rem;
		padding: 0.2rem;
		font-family: var(--font-comic);
		font-size: 1.7rem;
		letter-spacing: 0.06em;
		color: #fff;
		background: var(--toon-btn);
		text-shadow: 2px 2px 0 var(--ink);
		box-shadow: 0 5px 0 var(--ink);
	}
	.big:active {
		transform: translateY(4px);
		box-shadow: 0 1px 0 var(--ink);
	}
	.close {
		padding: 0.45rem;
		font-weight: 800;
		color: var(--ink);
		background: #fff;
		box-shadow: 0 3px 0 var(--ink);
	}
</style>
