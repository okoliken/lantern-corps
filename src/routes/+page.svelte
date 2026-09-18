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
		<a class="btn" href="/play">Free play</a>
		<a class="btn ambush" href="/skirmish">Red Lantern Ambush</a>
		<a class="btn" href="/hq">Corps HQ</a>
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
		box-shadow: 0 0 18px rgba(61, 255, 110, 0.35);
	}
	.btn.ambush {
		border-color: #ff3a3a;
		color: #ff6a6a;
		box-shadow: 0 0 14px rgba(255, 42, 42, 0.25);
	}
	.btn.ambush:hover {
		background: #ff3a3a;
		color: var(--bg);
	}
	.btn.lab {
		border-style: dashed;
		border-color: var(--green-dim);
	}
</style>
