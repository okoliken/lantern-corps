<script lang="ts">
	// The mission menu: one act at a time, its missions as a list. The story
	// plays in order (engine/campaign.ts), so a mission opens once the one before
	// it is finished; the next one to play is lit up.
	import { onMount } from 'svelte';
	import { ACTS, missionById } from '$lib/story/missions';
	import { LANTERNS } from '$lib/engine/lanterns';
	import { campaign } from '$lib/campaign.svelte';
	import MenuShell from '$lib/components/menu/MenuShell.svelte';
	import MenuIcon from '$lib/components/menu/MenuIcon.svelte';

	/** ?unlockall opens every mission (for trying a new one without playing through). */
	let unlocked = $state(false);
	onMount(() => {
		if (new URLSearchParams(location.search).has('unlockall')) {
			campaign.unlockAll();
			unlocked = true;
		}
	});

	const titleOf = (id: string | null) => (id ? (missionById(id)?.title ?? id) : '');

	type Act = (typeof ACTS)[number];
	const builtOf = (act: Act) => act.lineup.filter((entry): entry is string => typeof entry === 'string');
	const doneIn = (act: Act) => builtOf(act).filter((id) => campaign.stars(id) > 0).length;

	/** The act you are in: the first with a mission still to finish. */
	function currentAct(): number {
		for (const act of ACTS) {
			if (builtOf(act).some((id) => campaign.stars(id) === 0)) return act.number;
		}
		return ACTS[ACTS.length - 1]?.number ?? 1;
	}

	let shownAct = $state<number | null>(null);
	const actNumber = $derived(shownAct ?? currentAct());
	const act = $derived(ACTS.find((a) => a.number === actNumber) ?? ACTS[0]);
	const nextId = $derived(builtOf(act).find((id) => campaign.stars(id) === 0 && campaign.isOpen(id)) ?? null);

	// the mission on show: the next one to play, or the last finished one; clicking a card picks another
	let picked = $state<string | null>(null);
	const entries = $derived(act.lineup.map((entry, i) => ({ i, id: typeof entry === 'string' ? entry : null, soon: typeof entry === 'string' ? null : entry })));
	const shownId = $derived(picked && builtOf(act).includes(picked) ? picked : nextId ?? builtOf(act).filter((id) => campaign.isOpen(id)).pop() ?? builtOf(act)[0] ?? null);
	const shown = $derived(shownId ? missionById(shownId) : undefined);
	const shownIdx = $derived(act.lineup.findIndex((e) => e === shownId));
	const open = $derived(shown ? campaign.isOpen(shown.id) : false);
	const stars = $derived(shown ? campaign.stars(shown.id) : 0);
	/** A colour per mission (a planet's hue, a nebula's tint), stable from its id. */
	const hue = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
	function step(d: number) {
		const list = builtOf(act); const k = list.indexOf(shownId ?? '');
		const n = list[Math.max(0, Math.min(list.length - 1, k + d))]; if (n) picked = n;
	}
	function onKey(e: KeyboardEvent) {
		if (e.key === 'ArrowRight') step(1);
		if (e.key === 'ArrowLeft') step(-1);
		if (e.key === 'Enter' && shown && open) location.href = `/mission/${shown.id}`;
	}
</script>

<svelte:head>
	<title>Missions · Lantern Corps</title>
</svelte:head>
<svelte:window onkeydown={onKey} />

<MenuShell active="missions">
	<div class="select" style:--h={shown ? hue(shown.id) : 140}>
		<!-- the backdrop: where the mission happens -->
		<div class="sky" class:planet={shown?.environment === 'planet'} aria-hidden="true">
			<div class="nebula"></div>
			<div class="body"></div>
		</div>

		<nav class="acts" aria-label="Acts">
			{#each ACTS as a (a.number)}
				<button class:on={a.number === actNumber} onclick={() => { picked = null; shownAct = a.number; }}>
					<small>{a.number >= 4 ? 'Season 2' : `Act ${a.number}`} · {doneIn(a)}/{a.lineup.length}</small>
					<span>{a.title}</span>
				</button>
			{/each}
		</nav>

		{#if shown}
			<section class="hero">
				<p class="where">Mission {shownIdx + 1} · {shown.choose ? 'Hal or John' : LANTERNS[shown.lantern].name} · {shown.place}</p>
				<h1>{shown.title}</h1>
				<p class="tag">{shown.tagline}</p>
				<div class="cta">
					{#if open}
						<a class="play" href="/mission/{shown.id}"><MenuIcon name="play" size={16} /> {stars > 0 ? 'Replay' : 'Play'}</a>
						<span class="stars" aria-label="{stars} of 3 stars">{#each [1, 2, 3] as n (n)}<span class:on={n <= stars}><MenuIcon name="star" size={20} /></span>{/each}</span>
					{:else}
						<span class="locked"><MenuIcon name="lock" size={16} /> Finish {titleOf(campaign.before(shown.id))} to unlock</span>
					{/if}
				</div>
				{#if unlocked}<p class="note">Every mission is unlocked.</p>{/if}
			</section>
		{/if}

		<!-- the missions of this act, along the bottom -->
		<div class="strip" role="listbox" aria-label="Missions in {act.title}">
			{#each entries as e (actNumber + '-' + e.i)}
				{@const m = e.id ? missionById(e.id) : undefined}
				{#if m}
					{@const st = campaign.stars(m.id)}
					<button
						class="card"
						class:sel={m.id === shownId}
						class:done={st > 0}
						class:locked={!campaign.isOpen(m.id)}
						class:next={m.id === nextId}
						class:planet={m.environment === 'planet'}
						style:--h={hue(m.id)}
						role="option"
						aria-selected={m.id === shownId}
						onclick={() => (picked = m.id)}
					>
						<span class="thumb"><span class="orb"></span></span>
						<span class="num">{campaign.isOpen(m.id) ? e.i + 1 : ''}{#if !campaign.isOpen(m.id)}<MenuIcon name="lock" size={12} />{/if}</span>
						<span class="name">{m.title}</span>
						<span class="pips">{#each [1, 2, 3] as n (n)}<i class:on={n <= st}></i>{/each}</span>
					</button>
				{:else if e.soon}
					<div class="card soon"><span class="thumb"></span><span class="num">{e.i + 1}</span><span class="name">{e.soon.title}</span><span class="pips">Soon</span></div>
				{/if}
			{/each}
		</div>
	</div>
</MenuShell>

<style>
	.select {
		--accent: var(--green);
		position: relative;
		height: calc(100dvh - 7.5rem);
		min-height: 24rem;
		display: grid;
		grid-template-rows: auto 1fr auto;
		gap: 1rem;
		isolation: isolate;
	}
	/* ---- backdrop ---- */
	.sky {
		position: fixed;
		inset: 0;
		z-index: -1;
		overflow: hidden;
		background: radial-gradient(120% 90% at 70% 30%, hsl(var(--h) 45% 12%), #020504 70%);
		transition: background 0.5s;
	}
	.sky::before {
		content: '';
		position: absolute;
		inset: 0;
		background-image: radial-gradient(1px 1px at 12% 22%, #fff9, transparent), radial-gradient(1px 1px at 32% 68%, #fff7, transparent), radial-gradient(1.5px 1.5px at 58% 14%, #fffb, transparent), radial-gradient(1px 1px at 76% 46%, #fff6, transparent), radial-gradient(1px 1px at 88% 78%, #fff8, transparent), radial-gradient(1.5px 1.5px at 44% 88%, #fff9, transparent), radial-gradient(1px 1px at 6% 56%, #fff7, transparent), radial-gradient(1px 1px at 66% 62%, #fff5, transparent);
		background-size: 340px 340px;
		opacity: 0.8;
	}
	.nebula {
		position: absolute;
		width: 70vmax;
		height: 70vmax;
		right: -15vmax;
		top: -20vmax;
		border-radius: 50%;
		background: radial-gradient(circle, hsl(var(--h) 70% 40% / 0.35), transparent 65%);
		filter: blur(10px);
		transition: background 0.5s;
	}
	.body {
		position: absolute;
		width: 34vmax;
		height: 34vmax;
		right: 6vw;
		top: 12vh;
		border-radius: 50%;
		background: radial-gradient(circle at 35% 35%, hsl(var(--h) 55% 55%), hsl(var(--h) 60% 22%) 55%, #030605 100%);
		box-shadow: 0 0 120px hsl(var(--h) 70% 40% / 0.35), inset -40px -30px 80px #000c;
		opacity: 0.55;
		transition: all 0.5s;
	}
	.sky.planet .body {
		width: 140vmax;
		height: 140vmax;
		right: -20vmax;
		top: 58vh;
		opacity: 0.9;
	}
	/* ---- acts ---- */
	.acts {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}
	.acts button {
		display: grid;
		text-align: left;
		gap: 0.1rem;
		padding: 0.5rem 0.9rem;
		border-radius: 999px;
		border: 1px solid #ffffff1f;
		background: #00000055;
		color: var(--text);
		cursor: pointer;
	}
	.acts button small {
		font-size: 0.62rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		opacity: 0.6;
	}
	.acts button span {
		font-weight: 700;
		font-size: 0.85rem;
	}
	.acts button.on {
		background: var(--green);
		border-color: var(--green);
	}
	.acts button.on small {
		opacity: 0.85;
	}
	/* ---- the mission on show ---- */
	.hero {
		align-self: center;
		max-width: 38rem;
		display: grid;
		gap: 0.6rem;
	}
	.where {
		margin: 0;
		font-size: 0.72rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--green-ink, var(--green));
	}
	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(2.2rem, 6vw, 4.6rem);
		line-height: 0.95;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		text-shadow: 0 4px 30px #000;
	}
	.tag {
		margin: 0;
		font-size: 1.05rem;
		line-height: 1.5;
		opacity: 0.85;
		max-width: 32rem;
	}
	.cta {
		display: flex;
		align-items: center;
		gap: 1.1rem;
		margin-top: 0.6rem;
	}
	.play {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.85rem 2.2rem;
		border-radius: 999px;
		background: var(--green);
		color: #fff;
		font-weight: 800;
		font-size: 1rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		text-decoration: none;
		box-shadow: 0 6px 0 #004a13, 0 10px 30px #00711d66;
	}
	.play:active {
		transform: translateY(3px);
		box-shadow: 0 3px 0 #004a13;
	}
	.stars {
		display: flex;
		gap: 0.2rem;
		color: #ffffff2a;
	}
	.stars .on {
		color: #ffd54f;
	}
	.locked {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.7rem 1.2rem;
		border-radius: 999px;
		border: 1px dashed #ffffff33;
		opacity: 0.8;
	}
	.note {
		margin: 0;
		color: var(--green-ink, var(--green));
		font-weight: 600;
		font-size: 0.85rem;
	}
	/* ---- the strip ---- */
	.strip {
		display: flex;
		gap: 0.7rem;
		overflow-x: auto;
		padding: 0.4rem 0.2rem 0.8rem;
		scroll-snap-type: x mandatory;
	}
	.card {
		position: relative;
		flex: 0 0 auto;
		width: 9.5rem;
		scroll-snap-align: start;
		display: grid;
		gap: 0.25rem;
		padding: 0 0 0.6rem;
		border-radius: 14px;
		border: 1px solid #ffffff1c;
		background: #050b08cc;
		color: var(--text);
		text-align: left;
		overflow: hidden;
		cursor: pointer;
		transition: transform 0.15s, border-color 0.15s;
	}
	.card:hover {
		transform: translateY(-3px);
	}
	.card.sel {
		border-color: var(--green);
		box-shadow: 0 0 0 2px var(--green), 0 10px 30px #00711d55;
		transform: translateY(-4px);
	}
	.thumb {
		height: 4.6rem;
		position: relative;
		background: radial-gradient(120% 120% at 70% 20%, hsl(var(--h) 50% 18%), #020504);
		overflow: hidden;
	}
	.orb {
		position: absolute;
		width: 3rem;
		height: 3rem;
		right: 0.8rem;
		top: 0.7rem;
		border-radius: 50%;
		background: radial-gradient(circle at 35% 35%, hsl(var(--h) 55% 58%), hsl(var(--h) 60% 22%) 60%, #030605);
	}
	.card.planet .orb {
		width: 14rem;
		height: 14rem;
		right: -3rem;
		top: 2.6rem;
	}
	.num {
		position: absolute;
		top: 0.45rem;
		left: 0.5rem;
		display: inline-grid;
		place-items: center;
		min-width: 1.6rem;
		height: 1.6rem;
		border-radius: 8px;
		font-weight: 800;
		font-size: 0.85rem;
		background: #000a;
		border: 1px solid #ffffff22;
	}
	.card.next .num {
		background: var(--green);
		border-color: var(--green);
		color: #fff;
	}
	.name {
		padding: 0 0.65rem;
		font-weight: 700;
		font-size: 0.86rem;
		line-height: 1.2;
	}
	.pips {
		padding: 0 0.65rem;
		display: flex;
		gap: 0.25rem;
		font-size: 0.65rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		opacity: 0.7;
	}
	.pips i {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: #ffffff22;
	}
	.pips i.on {
		background: #ffd54f;
	}
	.card.locked,
	.card.soon {
		opacity: 0.5;
	}
	.card.soon {
		cursor: default;
	}
	/* phone upright: room for the tab bar at the bottom */
	@media (max-width: 600px) {
		.select {
			height: auto;
			min-height: calc(100dvh - 9rem);
		}
		.card {
			width: 7.4rem;
		}
		.thumb {
			height: 3.4rem;
		}
	}
	/* phone sideways: the hero shrinks, the strip stays */
	@media (max-height: 520px) {
		.select {
			height: calc(100dvh - 4.5rem);
			min-height: 0;
			gap: 0.5rem;
		}
		h1 {
			font-size: clamp(1.6rem, 6vh + 1rem, 2.6rem);
		}
		.tag {
			font-size: 0.85rem;
		}
		.play {
			padding: 0.6rem 1.5rem;
			font-size: 0.85rem;
		}
		.acts button {
			padding: 0.3rem 0.7rem;
		}
		.acts button small {
			display: none;
		}
		.thumb {
			height: 2.8rem;
		}
		.card {
			width: 7.6rem;
		}
	}
</style>
