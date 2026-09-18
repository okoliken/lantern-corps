<script lang="ts">
	// The mission list. For now there's one; the rest of the story arrives mission by mission.
	import { MISSIONS } from '$lib/story/missions';
	import { LANTERNS } from '$lib/engine/lanterns';
</script>

<main>
	<h1>Missions</h1>
	<ol>
		{#each MISSIONS as m (m.id)}
			<li>
				<a class="mission" href="/mission/{m.id}">
					<span class="number">{m.number}</span>
					<span class="text">
						<strong>{m.title}</strong>
						<small>{m.place} · as {LANTERNS[m.lantern].name}</small>
						<span>{m.tagline}</span>
					</span>
				</a>
			</li>
		{/each}
		<li class="locked">
			<span class="number">2</span>
			<span class="text">
				<strong>Coming soon</strong>
				<span>The story continues…</span>
			</span>
		</li>
	</ol>
	<a class="back" href="/">← Menu</a>
</main>

<style>
	main {
		min-height: 100%;
		box-sizing: border-box;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 1.5rem;
		padding: 2rem 1rem;
	}
	h1 {
		margin: 0;
		color: var(--green);
		text-shadow: 0 0 18px var(--green);
		text-transform: uppercase;
		font-size: clamp(1.6rem, 5vw, 2.6rem);
	}
	ol {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.8rem;
		width: min(34rem, 100%);
	}
	.mission,
	.locked {
		display: flex;
		gap: 1rem;
		align-items: center;
		padding: 1rem 1.25rem;
		border: 2px solid var(--green-dim);
		border-radius: 10px;
		background: rgba(61, 255, 110, 0.03);
		text-decoration: none;
		color: var(--text);
	}
	.mission:hover,
	.mission:focus-visible {
		border-color: var(--green);
		box-shadow: 0 0 24px rgba(61, 255, 110, 0.25);
	}
	.locked {
		opacity: 0.4;
		border-style: dashed;
	}
	.number {
		font-family: var(--font-display);
		font-size: 2rem;
		font-weight: 900;
		color: var(--green);
		min-width: 2rem;
		text-align: center;
	}
	.text {
		display: grid;
		gap: 0.2rem;
	}
	strong {
		font-family: var(--font-display);
		letter-spacing: 0.04em;
		color: var(--green);
	}
	small {
		opacity: 0.6;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.7rem;
	}
	.back {
		font-size: 0.9rem;
		text-decoration: none;
		opacity: 0.7;
	}
</style>
