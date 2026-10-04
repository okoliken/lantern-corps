<script lang="ts">
	// The mission menu: a deck of mission cards, one act at a time. Pick the act
	// on the chunky tabs across the top; the cards below swipe sideways on a phone
	// and spread out on a desktop. The story plays in order (engine/campaign.ts),
	// so a mission opens once the one before it is finished. Missions still to
	// come show as locked cards with a teaser.
	import { onMount } from 'svelte';
	import { ACTS, missionById } from '$lib/story/missions';
	import { LANTERNS } from '$lib/engine/lanterns';
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

	let shown = $state<number | null>(null);
	const actNumber = $derived(shown ?? currentAct());
	const act = $derived(ACTS.find((a) => a.number === actNumber) ?? ACTS[0]);

	/** The next mission to play in the shown act, so its card can stand out. */
	const nextId = $derived(builtOf(act).find((id) => campaign.stars(id) === 0 && campaign.isOpen(id)) ?? null);

	/** The deck scrolls sideways; when the act changes, start from the mission you're on. */
	let deck = $state<HTMLElement | null>(null);
	$effect(() => {
		void actNumber;
		const el = deck;
		if (!el) return;
		const target = el.querySelector<HTMLElement>('.card.next') ?? el.querySelector<HTMLElement>('.card');
		target?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'instant' });
	});
</script>

<MenuPoster />
<div class="shade"></div>

<div class="screen">
	<header class="top">
		<a class="home" href="/" aria-label="Main menu">
			<span aria-hidden="true">‹</span>
			<Emblem size={28} />
		</a>
		<h1>Missions</h1>
		<span class="total" title="Stars earned">{ACTS.reduce((n, a) => n + starsIn(a), 0)}<i>★</i></span>
	</header>

	<nav class="acts" aria-label="Acts">
		{#each ACTS as a (a.number)}
			{@const done = doneIn(a)}
			<button class="act" class:on={a.number === actNumber} class:complete={done === a.lineup.length && done > 0} onclick={() => (shown = a.number)}>
				<small>{a.number >= 4 ? 'Season 2' : `Act ${a.number}`}</small>
				<strong>{a.title}</strong>
				<em>{done}/{a.lineup.length}</em>
			</button>
		{/each}
	</nav>

	<p class="tagline">{act.tagline}{#if unlocked} <b>· every mission is unlocked</b>{/if}</p>

	<div class="deck" bind:this={deck}>
		{#each act.lineup as entry, i (actNumber + '-' + i)}
			{@const m = typeof entry === 'string' ? missionById(entry) : undefined}
			{#if m && campaign.isOpen(m.id)}
				{@const stars = campaign.stars(m.id)}
				<a class="card" class:done={stars > 0} class:next={m.id === nextId} href="/mission/{m.id}">
					<span class="num">{i + 1}</span>
					<span class="who">{m.choose ? 'Hal or John' : LANTERNS[m.lantern].name}</span>
					<strong class="title">{m.title}</strong>
					<span class="place">{m.place}</span>
					<span class="blurb">{m.tagline}</span>
					<span class="stars" aria-label="{stars} of 3 stars">{#each [1, 2, 3] as n (n)}<i class:on={n <= stars}>★</i>{/each}</span>
					<span class="go">{stars > 0 ? 'Play again' : m.id === nextId ? 'Play' : 'Play'}</span>
				</a>
			{:else if m}
				<div class="card locked" aria-disabled="true">
					<span class="num">🔒</span>
					<strong class="title">{m.title}</strong>
					<span class="blurb">Finish <b>{titleOf(campaign.before(m.id))}</b> to unlock.</span>
				</div>
			{:else if typeof entry !== 'string'}
				<div class="card locked soon">
					<span class="num">{i + 1}</span>
					<strong class="title">{entry.title}</strong>
					<span class="place">Coming soon</span>
					<span class="blurb">{entry.tagline}</span>
				</div>
			{/if}
		{/each}
	</div>

	<nav class="more">
		<a href="/school">Training</a>
		<a href="/spar">Sparring</a>
		<a href="/skirmish">Skirmish</a>
		<a href="/hq">Corps HQ</a>
	</nav>
</div>

<style>
	:global(body) {
		overflow: hidden;
	}
	.shade {
		position: fixed;
		inset: 0;
		background: radial-gradient(ellipse at 50% 30%, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.72) 75%);
		pointer-events: none;
	}
	.screen {
		position: relative;
		height: 100dvh;
		display: grid;
		grid-template-rows: auto auto auto minmax(0, 1fr) auto;
		align-content: start;
		gap: 0.6rem;
		padding: max(0.6rem, env(safe-area-inset-top)) max(0.9rem, env(safe-area-inset-right)) max(0.6rem, env(safe-area-inset-bottom)) max(0.9rem, env(safe-area-inset-left));
		box-sizing: border-box;
	}

	/* --- the top bar: back, title, stars --- */
	.top {
		display: flex;
		align-items: center;
		gap: 0.8rem;
	}
	.home {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		min-width: 3rem;
		min-height: 3rem;
		padding: 0 0.6rem 0 0.4rem;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.45);
		border: 2px solid rgba(61, 255, 110, 0.35);
		color: var(--green);
		text-decoration: none;
		font-size: 1.6rem;
		line-height: 1;
	}
	.home:active {
		transform: scale(0.95);
	}
	h1 {
		margin: 0;
		font-size: 1.5rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #fff;
		text-shadow: 0 0 18px rgba(61, 255, 110, 0.55);
		flex: 1;
	}
	.total {
		font-family: var(--font-display);
		font-size: 1.1rem;
		color: #ffd84a;
		background: rgba(0, 0, 0, 0.45);
		border: 2px solid rgba(255, 216, 74, 0.35);
		border-radius: 999px;
		padding: 0.35rem 0.8rem;
	}
	.total i {
		font-style: normal;
		margin-left: 0.2rem;
	}

	/* --- act tabs: one row, chunky, scroll sideways if they must --- */
	.acts {
		display: flex;
		gap: 0.5rem;
		overflow-x: auto;
		scrollbar-width: none;
		padding-bottom: 2px;
	}
	.acts::-webkit-scrollbar {
		display: none;
	}
	.act {
		flex: 1 0 auto;
		min-width: 9rem;
		min-height: 3.4rem;
		display: grid;
		grid-template-columns: 1fr auto;
		grid-template-rows: auto auto;
		align-items: center;
		column-gap: 0.6rem;
		text-align: left;
		padding: 0.45rem 0.8rem;
		border-radius: 1rem;
		border: 2px solid rgba(61, 255, 110, 0.25);
		background: rgba(4, 20, 12, 0.7);
		color: #bfe9c9;
		font-family: var(--font-ui);
		cursor: pointer;
		transition: transform 0.12s, border-color 0.12s, background 0.12s;
	}
	.act small {
		grid-column: 1;
		font-size: 0.62rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--green);
	}
	.act strong {
		grid-column: 1;
		font-family: var(--font-display);
		font-size: 0.82rem;
		letter-spacing: 0.04em;
		white-space: nowrap;
	}
	.act em {
		grid-column: 2;
		grid-row: 1 / 3;
		font-style: normal;
		font-weight: 800;
		font-size: 0.85rem;
		padding: 0.25rem 0.5rem;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.4);
	}
	.act.on {
		background: var(--suit);
		border-color: var(--green);
		color: #fff;
		box-shadow: 0 0 0 3px rgba(61, 255, 110, 0.18), 0 8px 24px rgba(0, 0, 0, 0.45);
		transform: translateY(-2px);
	}
	.act.on small {
		color: #d8ffe3;
	}
	.act.complete em {
		color: #ffd84a;
	}
	.tagline {
		margin: 0;
		font-size: 0.9rem;
		color: #a9d9b6;
	}
	.tagline b {
		color: var(--green);
		font-weight: 600;
	}

	/* --- the deck of mission cards --- */
	.deck {
		display: flex;
		gap: 0.9rem;
		overflow-x: auto;
		overflow-y: hidden;
		scroll-snap-type: x mandatory;
		padding: 0.6rem 0.2rem 0.9rem;
		scrollbar-width: none;
		align-items: stretch;
	}
	.deck::-webkit-scrollbar {
		display: none;
	}
	.card {
		scroll-snap-align: center;
		flex: 0 0 min(78vw, 15.5rem);
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding: 0.9rem 1rem 1rem;
		border-radius: 1.4rem;
		border: 3px solid rgba(61, 255, 110, 0.35);
		background: linear-gradient(170deg, rgba(10, 48, 28, 0.92), rgba(3, 14, 9, 0.95));
		color: #e4fbea;
		text-decoration: none;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08);
		position: relative;
		transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
	}
	a.card:hover,
	a.card:focus-visible {
		transform: translateY(-4px) rotate(-0.6deg);
		border-color: var(--green);
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55), 0 0 0 4px rgba(61, 255, 110, 0.18);
		outline: none;
	}
	.card.next {
		border-color: var(--green);
		box-shadow: 0 0 0 4px rgba(61, 255, 110, 0.22), 0 0 40px rgba(61, 255, 110, 0.25), 0 12px 30px rgba(0, 0, 0, 0.5);
		transform: rotate(-1deg);
	}
	.num {
		position: absolute;
		top: -0.9rem;
		left: 0.9rem;
		min-width: 2.2rem;
		height: 2.2rem;
		padding: 0 0.5rem;
		display: grid;
		place-items: center;
		border-radius: 999px;
		background: var(--green);
		color: #04140a;
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1rem;
		box-shadow: 0 4px 0 rgba(0, 0, 0, 0.45);
	}
	.card.done .num {
		background: #ffd84a;
	}
	.card.locked .num {
		background: #2b3a31;
		color: #9fb3a6;
	}
	.who {
		margin-top: 0.7rem;
		font-size: 0.66rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--green);
	}
	.title {
		font-family: var(--font-display);
		font-size: 1.12rem;
		line-height: 1.15;
		letter-spacing: 0.03em;
		color: #fff;
	}
	.place {
		font-size: 0.74rem;
		color: #9fd3ad;
	}
	.blurb {
		font-size: 0.86rem;
		line-height: 1.35;
		color: #c7eacf;
		flex: 1;
	}
	.blurb b {
		color: #fff;
		font-weight: 600;
	}
	.stars {
		font-size: 1.35rem;
		letter-spacing: 0.1em;
		color: #3b5546;
		line-height: 1;
	}
	.stars .on {
		color: #ffd84a;
		text-shadow: 0 0 12px rgba(255, 216, 74, 0.55);
	}
	.stars i {
		font-style: normal;
	}
	.go {
		margin-top: 0.3rem;
		display: block;
		text-align: center;
		min-height: 2.8rem;
		line-height: 2.8rem;
		border-radius: 999px;
		background: var(--green);
		color: #04140a;
		font-family: var(--font-display);
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		font-size: 0.9rem;
		box-shadow: 0 4px 0 #0b7a35;
	}
	a.card:active .go {
		transform: translateY(2px);
		box-shadow: 0 2px 0 #0b7a35;
	}
	.card.done .go {
		background: transparent;
		color: var(--green);
		border: 2px solid var(--green);
		box-shadow: none;
		line-height: calc(2.8rem - 4px);
	}
	.card.locked {
		border-style: dashed;
		border-color: rgba(159, 179, 166, 0.35);
		background: rgba(6, 12, 9, 0.75);
		color: #9fb3a6;
		opacity: 0.85;
	}
	.card.locked .title {
		color: #cfd9d3;
		margin-top: 0.7rem;
	}
	.card.locked .blurb {
		color: #9fb3a6;
	}

	/* --- the other modes, as pills along the bottom --- */
	.more {
		align-self: end;
		display: flex;
		gap: 0.5rem;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.more::-webkit-scrollbar {
		display: none;
	}
	.more a {
		flex: 1 0 auto;
		min-height: 2.6rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0 1rem;
		border-radius: 999px;
		border: 2px solid rgba(61, 255, 110, 0.3);
		background: rgba(0, 0, 0, 0.45);
		color: #cdeed6;
		text-decoration: none;
		font-size: 0.8rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		font-weight: 700;
	}
	.more a:hover {
		border-color: var(--green);
		color: #fff;
	}

	/* --- a desktop or tablet: the deck spreads out, cards don't need to snap --- */
	@media (min-width: 900px) and (min-height: 600px) {
		.screen {
			max-width: 1180px;
			margin: 0 auto;
			gap: 1rem;
			padding-top: 1.4rem;
		}
		h1 {
			font-size: 2rem;
		}
		.act {
			min-height: 4rem;
		}
		.act strong {
			font-size: 0.95rem;
		}
		.deck {
			flex-wrap: wrap;
			justify-content: center;
			overflow: visible;
			scroll-snap-type: none;
			align-content: flex-start;
			overflow-y: auto;
		}
		.card {
			flex: 0 0 15.5rem;
			min-height: 14rem;
		}
		.card.locked {
			min-height: 0;
			align-self: flex-start;
		}
	}
	/* --- a phone held upright: everything stacks, cards go full width, scroll down --- */
	@media (orientation: portrait) and (max-width: 600px) {
		:global(body) {
			overflow-y: auto;
		}
		.screen {
			height: auto;
			min-height: 100dvh;
			grid-template-rows: auto auto auto auto auto;
		}
		.acts {
			flex-wrap: nowrap;
		}
		.act {
			min-width: 11rem;
		}
		.deck {
			flex-direction: column;
			overflow: visible;
			scroll-snap-type: none;
			padding: 0.9rem 0.2rem 0.4rem;
		}
		.card {
			flex-basis: auto;
			width: auto;
		}
		.card.next {
			transform: none;
		}
		.more {
			flex-wrap: wrap;
		}
		.more a {
			flex: 1 1 45%;
		}
	}
	/* --- a phone held sideways: tight rows so the cards get the height --- */
	@media (max-height: 520px) {
		.screen {
			gap: 0.35rem;
			padding-top: max(0.35rem, env(safe-area-inset-top));
		}
		.home {
			min-height: 2.4rem;
			min-width: 2.6rem;
		}
		h1 {
			font-size: 1.15rem;
		}
		.act {
			min-height: 2.6rem;
			min-width: 8rem;
			padding: 0.25rem 0.7rem;
		}
		.act strong {
			font-size: 0.74rem;
		}
		.tagline {
			display: none;
		}
		.deck {
			padding: 0.7rem 0.2rem 0.3rem;
			gap: 0.7rem;
		}
		.card {
			flex-basis: min(60vw, 14rem);
			padding: 0.6rem 0.8rem 0.7rem;
			gap: 0.15rem;
		}
		.blurb {
			display: -webkit-box;
			-webkit-line-clamp: 2;
			line-clamp: 2;
			-webkit-box-orient: vertical;
			overflow: hidden;
			font-size: 0.78rem;
		}
		.stars {
			font-size: 1.1rem;
		}
		.go {
			min-height: 2.3rem;
			line-height: 2.3rem;
			font-size: 0.8rem;
		}
		.card.done .go {
			line-height: calc(2.3rem - 4px);
		}
		.more a {
			min-height: 2.1rem;
			font-size: 0.7rem;
		}
	}
</style>
