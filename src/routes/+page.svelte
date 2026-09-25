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
		<p class="oath">A ring, a sector, and everyone in it.</p>

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
		/* The column is as wide as the longest line of the title, so the block
		   inside it has to be centred too, or it sits against the left edge */
		justify-items: center;
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
		margin-top: 21vh;
	}
	h1 {
		font-size: clamp(2.2rem, 7vw, 4.2rem);
		margin: 0;
		line-height: 0.96;
		color: #05130b;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		font-weight: 800;
		font-style: italic;
		/* The animated series' lockup: dark letters cut out of a green edge */
		-webkit-text-stroke: clamp(3px, 0.5vw, 6px) var(--green);
		paint-order: stroke fill;
		text-shadow:
			0 0 14px color-mix(in srgb, var(--green) 85%, transparent),
			0 0 40px color-mix(in srgb, var(--green) 55%, transparent),
			0 5px 0 rgba(0, 0, 0, 0.55);
	}
	.oath {
		margin: 0.1rem 0 1.7rem;
		font-size: 0.95rem;
		opacity: 0.68;
		font-style: italic;
		letter-spacing: 0.04em;
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
