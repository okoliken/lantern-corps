<script lang="ts">
	// Main menu. This page is server-rendered like a normal website;
	// only the game routes turn SSR off.
	import { dev } from '$app/environment';
	import MenuPoster from '$lib/components/MenuPoster.svelte';
	import FullscreenButton from '$lib/touch/FullscreenButton.svelte';
</script>

<main>
	<MenuPoster />
	<div class="corner"><FullscreenButton /></div>
	<div class="title">
		<h1>Lantern Corps</h1>
		<p class="oath">In brightest day, in blackest night…</p>
		<p class="what">
			A ring picks someone who can overcome fear, and hands them a sector and everyone in it. This is the job that
			comes after that.
		</p>

		<nav>
			<a class="btn primary" href="/missions">Missions</a>
			<a class="btn" href="/training">Training</a>
			{#if dev}
				<a class="btn lab" href="/lab">Lab (dev only)</a>
			{/if}
		</nav>
	</div>
</main>

<style>
	main {
		position: relative;
		min-height: 100vh;
		overflow: hidden;
		display: grid;
		align-content: center;
		justify-content: center;
		text-align: center;
		padding: 1rem;
		box-sizing: border-box;
	}
	.corner {
		position: absolute;
		top: max(12px, env(safe-area-inset-top));
		right: max(12px, env(safe-area-inset-right));
		z-index: 2;
	}
	/* Under the emblem, in the dark half of the poster */
	.title {
		position: relative;
		display: grid;
		gap: 0.45rem;
		justify-items: center;
		width: min(30rem, 100%);
		margin-top: 30vh;
	}
	h1 {
		font-size: clamp(1.9rem, 5.4vw, 3.2rem);
		margin: 0;
		color: var(--green);
		text-shadow: 0 0 22px var(--green);
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}
	.oath {
		margin: 0;
		font-size: 0.95rem;
		opacity: 0.72;
		font-style: italic;
		letter-spacing: 0.04em;
	}
	.what {
		margin: 0.4rem 0 1.5rem;
		max-width: 27rem;
		font-size: 0.88rem;
		line-height: 1.55;
		opacity: 0.6;
	}
	nav {
		display: flex;
		gap: 0.8rem;
		justify-content: center;
		flex-wrap: wrap;
	}
	.btn {
		padding: 0.6rem 1.8rem;
		border: 2px solid var(--suit-lit);
		border-radius: 6px;
		text-decoration: none;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-size: 0.85rem;
		background: rgba(2, 8, 6, 0.55);
	}
	.btn:hover {
		background: var(--suit-lit);
		color: var(--text);
	}
	.btn.primary {
		background: var(--suit);
		color: var(--text);
		box-shadow: 0 0 18px color-mix(in srgb, var(--green) 35%, transparent);
	}
	.btn.lab {
		border-style: dashed;
		border-color: var(--suit-lit);
	}
</style>
