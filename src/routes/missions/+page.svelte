<script lang="ts">
	// The mission list, act by act. The story plays in order: a mission opens
	// once the one before it is finished (engine/campaign.ts). Ones still to
	// come show with a teaser, so it's clear where the story is going.
	import { onMount } from 'svelte';
	import { ACTS, missionById } from '$lib/story/missions';
	import { LANTERNS } from '$lib/engine/lanterns';
	import { settings } from '$lib/settings.svelte';
	import MenuPoster from '$lib/components/MenuPoster.svelte';
	import Emblem from '$lib/components/Emblem.svelte';
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

	/** The built missions in an act, and how far through it you are. */
	const builtOf = (act: (typeof ACTS)[number]) =>
		act.lineup.filter((entry): entry is string => typeof entry === 'string');
	const doneIn = (act: (typeof ACTS)[number]) => builtOf(act).filter((id) => campaign.stars(id) > 0).length;
	const starsIn = (act: (typeof ACTS)[number]) => builtOf(act).reduce((n, id) => n + campaign.stars(id), 0);

	/** The act you are in: the first with a mission still to finish. */
	function currentAct(): number {
		for (const act of ACTS) {
			if (builtOf(act).some((id) => campaign.stars(id) === 0)) return act.number;
		}
		return ACTS[ACTS.length - 1]?.number ?? 1;
	}

	/** Which chapters are open. Only the one you are in, until you say otherwise. */
	let opened = $state<Record<number, boolean>>({});
	const isOpen = (n: number) => opened[n] ?? n === currentAct();
	const toggle = (n: number) => (opened = { ...opened, [n]: !isOpen(n) });
</script>

<MenuPoster />

<div class="shade"></div>

<header class="bar">
	<a class="brand" href="/">
		<Emblem size={26} />
		<span class="name">Lantern Corps</span>
	</a>
	<nav class="tabs">
		<a class="on" href="/missions">Missions</a>
		<a href="/training">Training</a>
		<a href="/spar">Sparring</a>
		<a href="/hq">Corps HQ</a>
	</nav>
</header>

<main>
	<div class="rail">
		{#if unlocked}<p class="note">Every mission is unlocked.</p>{/if}

		{#each ACTS as act (act.number)}
			{@const built = builtOf(act)}
			{@const done = doneIn(act)}
			{@const current = act.number === currentAct()}
			<section class:shut={!isOpen(act.number)} class:current>
				<button class="act" onclick={() => toggle(act.number)} aria-expanded={isOpen(act.number)}>
					<span class="chapter">
						<small>Act {act.number}{#if act.number >= 4} · Season two{/if}</small>
						<h2>{act.title}</h2>
						{#if act.tagline}<p>{act.tagline}</p>{/if}
					</span>
					<span class="progress">
						<span class="count">{done} / {act.lineup.length}</span>
						{#if starsIn(act) > 0}<span class="won">{starsIn(act)}★</span>{/if}
						<span class="chevron" class:down={isOpen(act.number)}>›</span>
					</span>
				</button>

				{#if act.lineup.length > 0 && isOpen(act.number)}
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
											<span class="stars" aria-label="{stars} of 3 stars"
												>{#each [1, 2, 3] as n (n)}<span class:on={n <= stars}>★</span>{/each}</span
											>
										{/if}
									</a>
								{:else if m}
									<div class="mission locked" aria-disabled="true">
										<span class="number">🔒</span>
										<span class="text">
											<strong>{m.title}</strong>
											<small>Finish {titleOf(campaign.before(m.id))} to unlock</small>
										</span>
									</div>
								{:else if typeof entry !== 'string'}
									<div class="mission locked">
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
				{/if}
			</section>
		{/each}

		<div class="rule"></div>
		<nav class="plain">
			<a href="/">Main menu</a>
		</nav>
	</div>
</main>

<style>
	:global(body) {
		overflow-y: auto;
	}
	.shade {
		position: fixed;
		inset: 0;
		background: linear-gradient(90deg, rgba(2, 8, 6, 0.94) 0%, rgba(2, 8, 6, 0.86) 42%, rgba(2, 8, 6, 0.35) 100%);
		z-index: 0;
	}
	/* ---- the bar across the top ---- */
	.bar {
		position: relative;
		z-index: 2;
		display: flex;
		align-items: stretch;
		gap: clamp(1rem, 4vw, 2.5rem);
		min-height: 3.4rem;
		padding: 0 clamp(0.8rem, 4vw, 3rem);
		background: linear-gradient(rgba(2, 8, 6, 0.94), rgba(2, 8, 6, 0.6));
		border-bottom: 1px solid color-mix(in srgb, var(--suit-lit) 55%, transparent);
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		text-decoration: none;
		color: var(--text);
		flex-shrink: 0;
	}
	.name {
		font-family: var(--font-display);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		font-size: 0.82rem;
	}
	.tabs {
		display: flex;
		align-items: stretch;
		gap: clamp(0.9rem, 3vw, 1.6rem);
		overflow-x: auto;
		scrollbar-width: none;
		margin-bottom: -1px;
	}
	.tabs::-webkit-scrollbar {
		display: none;
	}
	.tabs a {
		display: flex;
		align-items: center;
		white-space: nowrap;
		text-decoration: none;
		color: color-mix(in srgb, var(--text) 62%, transparent);
		text-transform: uppercase;
		letter-spacing: 0.12em;
		font-size: 0.76rem;
		font-weight: 600;
		border-bottom: 3px solid transparent;
	}
	.tabs a:hover {
		color: var(--text);
	}
	.tabs a.on {
		color: var(--green);
		border-bottom-color: var(--green);
	}
	/* ---- the rail of chapters ---- */
	main {
		position: relative;
		z-index: 1;
		padding: 1.6rem clamp(1rem, 4vw, 3rem) 4rem;
	}
	.rail {
		display: grid;
		gap: 0.7rem;
		width: min(38rem, 100%);
	}
	.note {
		margin: 0;
		font-size: 0.8rem;
		color: var(--green);
	}
	section {
		display: grid;
		gap: 0.5rem;
		background: rgba(4, 14, 10, 0.72);
		border: 1px solid color-mix(in srgb, var(--suit-lit) 40%, transparent);
		border-left: 3px solid transparent;
		border-radius: 4px;
		padding: 0.2rem 0.2rem 0.4rem;
	}
	section.shut {
		gap: 0;
		padding-bottom: 0.2rem;
	}
	section.current {
		border-left-color: var(--green);
		background: rgba(6, 22, 15, 0.82);
	}
	.act {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		width: 100%;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		padding: 0.7rem 0.9rem;
		cursor: pointer;
	}
	.act:hover {
		background: color-mix(in srgb, var(--suit) 25%, transparent);
	}
	.chapter {
		display: grid;
		gap: 0.15rem;
	}
	.chapter small {
		color: var(--green);
		text-transform: uppercase;
		letter-spacing: 0.16em;
		font-size: 0.66rem;
		opacity: 0.9;
	}
	.chapter h2 {
		margin: 0;
		font-size: 1.15rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.chapter p {
		margin: 0;
		font-size: 0.82rem;
		opacity: 0.62;
		max-width: 26rem;
	}
	.progress {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		color: var(--green);
		font-size: 0.85rem;
		white-space: nowrap;
	}
	.progress .won {
		color: #ffd21e;
	}
	.chevron {
		display: inline-block;
		font-size: 1.4rem;
		line-height: 1;
		transition: transform 0.15s ease;
	}
	.chevron.down {
		transform: rotate(90deg);
	}
	ol {
		list-style: none;
		margin: 0;
		padding: 0 0.4rem;
		display: grid;
		gap: 0.35rem;
	}
	.mission {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		padding: 0.7rem 0.8rem;
		border: 1px solid color-mix(in srgb, var(--suit-lit) 35%, transparent);
		border-radius: 3px;
		background: rgba(3, 10, 8, 0.75);
		text-decoration: none;
		color: var(--text);
	}
	a.mission:hover {
		border-color: var(--green);
		background: color-mix(in srgb, var(--suit) 45%, rgba(3, 10, 8, 0.75));
	}
	.mission.locked {
		opacity: 0.45;
		border-style: dashed;
	}
	.number {
		font-family: var(--font-display);
		font-size: 1.1rem;
		color: var(--green);
		width: 1.6rem;
		text-align: center;
		flex-shrink: 0;
	}
	.text {
		display: grid;
		gap: 0.15rem;
		flex: 1;
	}
	.text strong {
		font-family: var(--font-display);
		letter-spacing: 0.04em;
		color: var(--green);
	}
	.text small {
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		opacity: 0.55;
	}
	.text span {
		font-size: 0.85rem;
		opacity: 0.8;
	}
	.stars {
		color: #4b5b52;
		letter-spacing: 0.1em;
	}
	.stars .on {
		color: #ffd21e;
	}
	.rule {
		height: 1px;
		margin: 1rem 0 0.2rem;
		background: linear-gradient(90deg, color-mix(in srgb, var(--suit-lit) 70%, transparent), transparent);
	}
	.plain {
		display: flex;
		gap: 1.4rem;
	}
	.plain a {
		color: color-mix(in srgb, var(--text) 75%, transparent);
		text-decoration: none;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		font-size: 0.78rem;
		font-weight: 600;
	}
	.plain a:hover {
		color: var(--green);
	}
	/* A phone held sideways: wide but very short. Everything tightens up. */
	@media (max-height: 560px) {
		.bar {
			min-height: 2.5rem;
			gap: 1.1rem;
		}
		.name {
			font-size: 0.7rem;
			letter-spacing: 0.1em;
		}
		.tabs a {
			font-size: 0.66rem;
			letter-spacing: 0.08em;
		}
		main {
			padding: 0.6rem clamp(0.6rem, 3vw, 1.4rem) 1.6rem;
		}
		.rail {
			width: min(30rem, 100%);
			gap: 0.4rem;
		}
		.act {
			padding: 0.45rem 0.6rem;
		}
		.chapter small {
			font-size: 0.58rem;
		}
		.chapter h2 {
			font-size: 0.9rem;
		}
		.chapter p {
			font-size: 0.7rem;
			max-width: 22rem;
		}
		.progress {
			font-size: 0.72rem;
		}
		.chevron {
			font-size: 1.1rem;
		}
		.mission {
			padding: 0.45rem 0.55rem;
			gap: 0.5rem;
		}
		.number {
			font-size: 0.9rem;
			width: 1.2rem;
		}
		.text strong {
			font-size: 0.85rem;
		}
		.text small {
			font-size: 0.58rem;
		}
		.text span {
			font-size: 0.72rem;
		}
		.rule {
			margin-top: 0.6rem;
		}
		.plain a {
			font-size: 0.7rem;
		}
	}
	@media (max-width: 720px) {
		.shade {
			background: linear-gradient(rgba(2, 8, 6, 0.9), rgba(2, 8, 6, 0.95));
		}
		.name {
			display: none;
		}
		main {
			padding: 1rem 0.8rem 3rem;
		}
		.rail {
			width: 100%;
			gap: 0.55rem;
		}
		.act {
			padding: 0.65rem 0.7rem;
		}
		.chapter h2 {
			font-size: 1rem;
		}
		.chapter p {
			font-size: 0.76rem;
		}
		.progress {
			font-size: 0.78rem;
			gap: 0.4rem;
		}
		ol {
			padding: 0 0.3rem;
		}
		.mission {
			gap: 0.6rem;
			padding: 0.6rem;
		}
		.text span {
			font-size: 0.8rem;
		}
		.text small {
			font-size: 0.62rem;
		}
	}
</style>
