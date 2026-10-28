<script lang="ts">
	// A banner along the bottom of the menus on a phone, until the game is
	// installed: "Add Lantern Corps to your home screen". On Android one tap
	// opens the phone's own install box. iPhones let no website add itself, so
	// there the tap shows the way (an arrow at the Share button, then the steps).
	// "Later" hides it for this visit only; it is back next time.
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import Emblem from '$lib/components/Emblem.svelte';
	import { install } from './install.svelte';
	import InstallSheet from './InstallSheet.svelte';

	/** The menus: the fights have their own screen to look after. */
	const MENUS = ['/', '/missions', '/school'];

	let mounted = $state(false);
	let later = $state(false);
	let showSheet = $state(false);
	onMount(() => {
		try {
			later = sessionStorage.getItem('install-later') === '1';
		} catch {}
		mounted = true;
	});

	const shown = $derived(mounted && !later && install.worthIt && MENUS.includes(page.url.pathname));
	// Pages leave room for it at the bottom
	$effect(() => {
		document.documentElement.classList.toggle('install-banner', shown);
	});

	async function add() {
		if (install.canPrompt) await install.prompt();
		else showSheet = true;
	}
	function hide() {
		later = true;
		try {
			sessionStorage.setItem('install-later', '1');
		} catch {}
	}
</script>

{#if shown}
	<div class="banner" role="region" aria-label="Add to home screen">
		<button class="main" onclick={add}>
			<span class="icon" aria-hidden="true"><Emblem size={30} glow={false} /></span>
			<span class="words">
				<strong>Add to home screen</strong>
				<small>Play it like an app: fullscreen, no address bar.</small>
			</span>
			<span class="go">{install.canPrompt ? 'Install' : 'Add'}</span>
		</button>
		<button class="later" onclick={hide} aria-label="Not now">✕</button>
	</div>
{/if}
{#if showSheet}<InstallSheet onClose={() => (showSheet = false)} />{/if}

<style>
	.banner {
		position: fixed;
		z-index: 800;
		left: max(0.75rem, env(safe-area-inset-left));
		right: max(0.75rem, env(safe-area-inset-right));
		bottom: max(0.75rem, env(safe-area-inset-bottom));
		display: flex;
		align-items: stretch;
		max-width: 30rem;
		margin: 0 auto;
		border: 3px solid var(--ink);
		border-radius: 1.1rem;
		background: var(--toon-gold);
		box-shadow: 4px 5px 0 var(--ink);
		animation: rise 0.45s cubic-bezier(0.2, 1.4, 0.4, 1) 0.6s both;
	}
	.main {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.7rem;
		min-width: 0;
		padding: 0.55rem 0.5rem 0.55rem 0.7rem;
		border: 0;
		background: none;
		color: var(--ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.icon {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 2.6rem;
		height: 2.6rem;
		box-sizing: border-box;
		border: 3px solid var(--ink);
		border-radius: 0.8rem;
		background: #0c3a24;
	}
	.words {
		display: grid;
		flex: 1;
		min-width: 0;
	}
	.words strong {
		font-family: var(--font-comic);
		font-weight: 400;
		font-size: 1.35rem;
		letter-spacing: 0.04em;
		line-height: 1.1;
	}
	.words small {
		font-size: 0.78rem;
		font-weight: 700;
	}
	.go {
		flex-shrink: 0;
		padding: 0.1rem 0.8rem;
		border: 3px solid var(--ink);
		border-radius: 0.7rem;
		background: var(--toon-btn);
		color: #fff;
		font-family: var(--font-comic);
		font-size: 1.25rem;
		letter-spacing: 0.05em;
		text-shadow: 1px 2px 0 var(--ink);
		box-shadow: 0 3px 0 var(--ink);
		animation: nudge 1.6s ease-in-out infinite;
	}
	.main:active .go {
		transform: translateY(3px);
		box-shadow: 0 0 0 var(--ink);
	}
	.later {
		width: 2.4rem;
		border: 0;
		border-left: 3px solid var(--ink);
		background: none;
		color: var(--ink);
		font: 800 1rem var(--font-ui);
		cursor: pointer;
	}
	@keyframes rise {
		from {
			transform: translateY(140%);
		}
	}
	@keyframes nudge {
		50% {
			transform: translateY(-3px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.banner,
		.go {
			animation: none;
		}
	}
	/* A phone on its side: short, so the line under the title goes */
	@media (max-height: 520px) {
		.words small {
			display: none;
		}
		.main {
			padding-block: 0.35rem;
		}
	}
</style>
