<script lang="ts">
	// Main menu. This page is server-rendered like a normal website;
	// only the game routes turn SSR off.
	import { dev } from '$app/environment';
</script>

<main>
	<h1>Lantern Corps</h1>
	<p class="oath">In brightest day, in blackest night…</p>

	<nav>
		<a class="btn primary" href="/missions">Missions</a>
		{#if dev}
			<a class="btn lab" href="/lab">Lab (dev only)</a>
		{/if}
	</nav>
</main>

<style>
	main {
		min-height: 100%;
		display: grid;
		place-content: center;
		text-align: center;
		gap: 0.5rem;
		padding: 1rem;
	}
	h1 {
		font-size: clamp(2.5rem, 8vw, 5rem);
		margin: 0;
		color: var(--green);
		text-shadow: 0 0 24px var(--green);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.oath {
		margin: 0 0 2rem;
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
		padding: 0.8rem 2rem;
		border: 2px solid var(--green);
		border-radius: 6px;
		text-decoration: none;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	.btn:hover {
		background: var(--green);
		color: var(--bg);
	}
	.btn.primary {
		background: var(--green);
		color: var(--bg);
		box-shadow: 0 0 18px color-mix(in srgb, var(--green) 35%, transparent);
	}
	.btn.lab {
		border-style: dashed;
		border-color: var(--green-dim);
	}
</style>
