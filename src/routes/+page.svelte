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

		<nav>
			<a class="btn primary" href="/missions">Missions</a>
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
		align-content: end;
		justify-content: center;
		text-align: center;
		padding: 1rem 1rem 5vh;
		box-sizing: border-box;
	}
	.corner {
		position: absolute;
		top: max(12px, env(safe-area-inset-top));
		right: max(12px, env(safe-area-inset-right));
		z-index: 2;
	}
	/* Over the poster, in the dark at the bottom */
	.title {
		position: relative;
		display: grid;
		gap: 0.3rem;
	}
	h1 {
		font-size: clamp(1.4rem, 3.2vw, 2.1rem);
		margin: 0;
		color: var(--green);
		text-shadow: 0 0 14px var(--green);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.oath {
		margin: 0 0 1.2rem;
		font-size: 0.9rem;
		opacity: 0.7;
		font-style: italic;
	}
	nav {
		display: flex;
		gap: 1rem;
		justify-content: center;
		flex-wrap: wrap;
	}
	.btn {
		padding: 0.6rem 1.6rem;
		border: 2px solid var(--suit-lit);
		border-radius: 6px;
		text-decoration: none;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.1em;
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
