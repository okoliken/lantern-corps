<script lang="ts">
	// The mission list, act by act. The story plays in order: a mission opens
	// once the one before it is finished (engine/campaign.ts). Ones still to
	// come show with a teaser, so it's clear where the story is going.
	import { onMount } from 'svelte';
	import { ACTS, missionById } from '$lib/story/missions';
	import { LANTERNS } from '$lib/engine/lanterns';
	import { settings } from '$lib/settings.svelte';
	import { campaign } from '$lib/campaign.svelte';

	/** ?unlockall opens every mission (for trying a new one without playing through). */
	let unlocked = $state(false);
	onMount(() => {
		if (new URLSearchParams(location.search).has('unlockall')) {
			campaign.unlockAll();
			unlocked = true;
		}
	});

	const titleOf = (id: string | null) => (id ? (missionById(id)?.title ?? id) : '');
</script>

<main>
	<h1>Missions</h1>
	{#if unlocked}<p class="note">Every mission is unlocked.</p>{/if}

	<section>
		<header class="act">
			<small>On Oa</small>
			<h2>Corps training</h2>
		</header>
		<ol>
			<li>
				<a class="mission" href="/training">
					<span class="number">{settings.current.trained ? '✓' : '★'}</span>
					<span class="text">
						<strong>Training</strong>
						<small>Oa · with Kilowog · about 3 minutes</small>
						<span>New to the ring? Learn everything a Lantern can do, one thing at a time.</span>
					</span>
				</a>
			</li>
			<li>
				<a class="mission" href="/spar">
					<span class="number">⚔</span>
					<span class="text">
						<strong>Spar with Kilowog & Sinestro</strong>
						<small>Oa · two on one</small>
						<span>Think you learned something? Prove it against the Corps' drill sergeant and its greatest Lantern.</span>
					</span>
				</a>
			</li>
		</ol>
	</section>

	{#each ACTS as act (act.number)}
		<section class:later={act.lineup.length === 0}>
			<header class="act">
				<small>Act {act.number}</small>
				<h2>{act.title}</h2>
				{#if act.tagline}<p>{act.tagline}</p>{/if}
			</header>
			{#if act.lineup.length > 0}
				<ol>
					{#each act.lineup as entry, i (i)}
						{@const m = typeof entry === 'string' ? missionById(entry) : undefined}
						<li>
							{#if m && campaign.isOpen(m.id)}
								{@const stars = campaign.stars(m.id)}
								<a class="mission" class:done={stars > 0} href="/mission/{m.id}">
									<span class="number">{stars > 0 ? '✓' : i + 1}</span>
									<span class="text">
										<strong>{m.title}</strong>
										<small>{m.place} · as {m.choose ? 'Hal or John' : LANTERNS[m.lantern].name}</small>
										<span>{m.tagline}</span>
									</span>
									{#if stars > 0}
										<span class="stars" aria-label="{stars} of 3 stars">{#each [1, 2, 3] as n (n)}<span class:on={n <= stars}>★</span>{/each}</span>
									{/if}
								</a>
							{:else if m}
								<div class="locked" aria-disabled="true">
									<span class="number">🔒</span>
									<span class="text">
										<strong>{m.title}</strong>
										<small>Finish {titleOf(campaign.before(m.id))} to unlock</small>
									</span>
								</div>
							{:else if typeof entry !== 'string'}
								<div class="locked">
									<span class="number">{i + 1}</span>
									<span class="text">
										<strong>{entry.title}</strong>
										<small>Coming soon</small>
										<span>{entry.tagline}</span>
									</span>
								</div>
							{/if}
						</li>
					{/each}
				</ol>
			{:else}
				<div class="locked"><span class="text"><small>Coming later</small></span></div>
			{/if}
		</section>
	{/each}

	<a class="back" href="/">← Menu</a>
</main>

<style>
	main {
		min-height: 100%;
		box-sizing: border-box;
		display: grid;
		justify-content: center;
		align-content: start;
		justify-items: center;
		gap: 2rem;
		padding: 2.5rem 1rem;
	}
	section {
		display: grid;
		gap: 0.8rem;
		width: min(34rem, 100%);
	}
	section.later {
		opacity: 0.55;
	}
	.act {
		display: grid;
		gap: 0.15rem;
		border-left: 3px solid var(--suit-lit);
		padding-left: 0.8rem;
	}
	.act small {
		color: var(--green);
		opacity: 0.8;
	}
	.act h2 {
		margin: 0;
		font-family: var(--font-display);
		letter-spacing: 0.05em;
		text-transform: uppercase;
		font-size: 1.25rem;
	}
	.act p {
		margin: 0;
		opacity: 0.75;
		font-size: 0.9rem;
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
		width: 100%;
	}
	.mission,
	.locked {
		display: flex;
		gap: 1rem;
		align-items: center;
		padding: 1rem 1.25rem;
		border: 2px solid var(--suit-lit);
		border-radius: 10px;
		background: color-mix(in srgb, var(--suit) 20%, transparent);
		text-decoration: none;
		color: var(--text);
	}
	.mission:hover,
	.mission:focus-visible {
		border-color: var(--green);
		box-shadow: 0 0 24px color-mix(in srgb, var(--green) 25%, transparent);
	}
	.locked {
		opacity: 0.4;
		border-style: dashed;
	}
	.mission.done {
		border-color: color-mix(in srgb, var(--suit-lit) 70%, transparent);
	}
	.stars {
		margin-left: auto;
		display: flex;
		gap: 0.1rem;
		font-size: 1rem;
		color: #2a3a30;
		white-space: nowrap;
	}
	.stars .on {
		color: #ffe066;
		text-shadow: 0 0 10px rgba(255, 224, 102, 0.6);
	}
	.note {
		margin: -1rem 0 0;
		font-size: 0.85rem;
		color: var(--green);
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
