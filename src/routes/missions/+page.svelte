<script lang="ts">
	// The mission menu: one act at a time, its missions as a list in one card. The story
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
	const open = $derived(shown ? campaign.isOpen(shown.id) : false);
	/** A colour per mission (a planet's hue, a nebula's tint), stable from its id. */
	const hue = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
	function step(d: number) {
		const list = builtOf(act); const k = list.indexOf(shownId ?? '');
		const n = list[Math.max(0, Math.min(list.length - 1, k + d))]; if (n) picked = n;
	}
	function onKey(e: KeyboardEvent) {
		if (e.key === 'ArrowRight' || e.key === 'ArrowDown') step(1);
		if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') step(-1);
		if (e.key === 'Enter' && shown && open) location.href = `/mission/${shown.id}`;
	}
</script>

<svelte:head>
	<title>Missions · Lantern Corps</title>
</svelte:head>
<svelte:window onkeydown={onKey} />

<MenuShell active="missions">
	<section class="deck">
		<div class="acts" role="tablist" aria-label="Acts">
			{#each ACTS as a (a.number)}
				<button role="tab" aria-selected={a.number === actNumber} class:on={a.number === actNumber} onclick={() => { picked = null; shownAct = a.number; }}>
					<small>{a.number >= 4 ? 'Season 2' : `Act ${a.number}`} · {doneIn(a)}/{a.lineup.length}</small>
					<span>{a.title}</span>
				</button>
			{/each}
		</div>

		{#if unlocked}<p class="note">Every mission is unlocked.</p>{/if}

		<ol class="missions" aria-label="Missions in {act.title}">
			{#each entries as e (actNumber + '-' + e.i)}
				{@const m = e.id ? missionById(e.id) : undefined}
				{#if m}
					{@const st = campaign.stars(m.id)}
					{@const isOpen = campaign.isOpen(m.id)}
					{@const sel = m.id === shownId}
					<li class="mission" class:sel class:done={st > 0} class:locked={!isOpen} class:next={m.id === nextId} style:--h={hue(m.id)}>
						<button class="pick" aria-expanded={sel} onclick={() => (picked = m.id)}>
							<span class="orb" class:planet={m.environment === 'planet'}>{#if isOpen}{e.i + 1}{:else}<MenuIcon name="lock" size={13} />{/if}</span>
							<span class="words">
								<strong>{m.title}</strong>
								<small>{m.choose ? 'Hal or John' : LANTERNS[m.lantern].name} · {m.place}</small>
							</span>
							<span class="pips" aria-label="{st} of 3 stars">{#each [1, 2, 3] as n (n)}<span class:on={n <= st}><MenuIcon name="star" size={14} /></span>{/each}</span>
						</button>
						{#if sel}
							<div class="open">
								<p>{m.tagline}</p>
								{#if isOpen}
									<a class="play" href="/mission/{m.id}"><MenuIcon name="play" size={16} /> {st > 0 ? 'Replay' : 'Play'}</a>
								{:else}
									<span class="locked-note"><MenuIcon name="lock" size={14} /> Finish {titleOf(campaign.before(m.id))} to unlock</span>
								{/if}
							</div>
						{/if}
					</li>
				{:else if e.soon}
					<li class="mission soon">
						<div class="pick">
							<span class="orb">{e.i + 1}</span>
							<span class="words"><strong>{e.soon.title}</strong><small>Coming soon</small></span>
						</div>
					</li>
				{/if}
			{/each}
		</ol>
	</section>
</MenuShell>

<style>
	.deck {
		padding: 1rem;
		border-radius: 1.3rem;
		border: 3px solid var(--ink);
		background: var(--panel);
		box-shadow: 6px 7px 0 var(--ink);
	}
	/* ---- acts ---- */
	.acts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr));
		gap: 0.5rem;
	}
	.acts button {
		display: grid;
		gap: 0.15rem;
		padding: 0.6rem 0.75rem;
		border-radius: 0.9rem;
		border: 3px solid var(--ink);
		background: var(--well);
		color: var(--muted);
		font: inherit;
		font-weight: 700;
		text-align: left;
		cursor: pointer;
		box-shadow: 3px 4px 0 var(--ink);
		transition: transform 0.1s, box-shadow 0.1s;
	}
	.acts button:hover {
		transform: translate(-1px, -2px);
		box-shadow: 4px 6px 0 var(--ink);
	}
	.acts button:active {
		transform: translate(2px, 3px);
		box-shadow: 1px 1px 0 var(--ink);
	}
	.acts small {
		font-size: 0.62rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.acts span {
		font-family: var(--font-comic);
		font-size: 1.15rem;
		letter-spacing: 0.04em;
		color: #fff;
		line-height: 1;
	}
	/* The act on show: comic yellow */
	.acts button.on {
		background: var(--gold);
		color: #4a4413;
	}
	.acts button.on span {
		color: var(--ink);
	}
	.note {
		margin: 0.8rem 0 0;
		color: var(--green-ink);
		font-weight: 600;
		font-size: 0.85rem;
	}
	/* ---- the missions ---- */
	.missions {
		list-style: none;
		margin: 1rem 0 0;
		padding: 0;
		display: grid;
		gap: 0.5rem;
	}
	.mission {
		border-radius: 1rem;
		border: 3px solid var(--ink);
		background: var(--well);
		box-shadow: 3px 4px 0 var(--ink);
		transition: transform 0.1s, box-shadow 0.1s, background 0.1s;
	}
	.mission:not(.soon):not(.sel):hover {
		transform: translate(-1px, -2px);
		box-shadow: 4px 6px 0 var(--ink);
	}
	.pick {
		display: grid;
		grid-template-columns: 2.6rem minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.8rem;
		width: 100%;
		padding: 0.6rem 0.75rem;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.orb {
		display: grid;
		place-items: center;
		width: 2.6rem;
		height: 2.6rem;
		border-radius: 50%;
		border: 3px solid var(--ink);
		box-sizing: border-box;
		background: radial-gradient(circle at 35% 30%, hsl(var(--h, 140) 70% 70%) 0 18%, hsl(var(--h, 140) 60% 48%) 19%);
		color: #fff;
		font-family: var(--font-comic);
		font-size: 1.3rem;
		-webkit-text-stroke: 1.5px var(--ink);
		paint-order: stroke fill;
	}
	/* A planet mission: its orb sits low, like a horizon */
	.orb.planet {
		background: radial-gradient(140% 90% at 50% 125%, hsl(var(--h) 60% 50%) 58%, #fff8d6 59%);
	}
	.words {
		display: grid;
		gap: 0.1rem;
		min-width: 0;
	}
	.words strong {
		font-family: var(--font-comic);
		font-size: 1.35rem;
		font-weight: 400;
		letter-spacing: 0.04em;
		color: #fff;
		text-shadow: 2px 2px 0 var(--ink);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.words small {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.pips {
		display: flex;
		color: #04120a66;
	}
	.pips .on {
		color: var(--gold);
	}
	/* the next one to play */
	.mission.next .orb {
		box-shadow: 0 0 0 3px var(--gold);
	}
	/* the one on show: open, with its story line and Play */
	.mission.sel {
		background: var(--panel-hi);
		box-shadow: 5px 6px 0 var(--ink);
	}
	.open {
		padding: 0 0.9rem 0.9rem calc(0.75rem + 2.6rem + 0.8rem);
		display: grid;
		gap: 0.8rem;
		justify-items: start;
	}
	.open p {
		margin: 0;
		padding: 0.55rem 0.8rem;
		border: 2px solid var(--ink);
		border-radius: 0.8rem 0.8rem 0.8rem 0.2rem;
		background: #fff8d6;
		color: #2a3a2e;
		font-size: 0.92rem;
		font-weight: 600;
		line-height: 1.45;
	}
	.play {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 2rem;
		border-radius: 0.9rem;
		border: 3px solid var(--ink);
		background: var(--green-hi);
		color: #fff;
		font-family: var(--font-comic);
		font-size: 1.6rem;
		letter-spacing: 0.08em;
		text-decoration: none;
		-webkit-text-stroke: 1.5px var(--ink);
		paint-order: stroke fill;
		text-shadow: 2px 2px 0 var(--ink);
		box-shadow: 0 5px 0 var(--ink);
		transition: transform 0.08s, box-shadow 0.08s, background 0.12s;
	}
	.play:hover {
		background: #22c24a;
		transform: translateY(-2px);
		box-shadow: 0 7px 0 var(--ink);
	}
	.play:active {
		transform: translateY(4px);
		box-shadow: 0 1px 0 var(--ink);
	}
	.locked-note {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.55rem 1rem;
		border-radius: 0.8rem;
		border: 2px dashed var(--ink);
		background: #04120a33;
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--muted);
	}
	.mission.locked .orb {
		background: #0a2f1e;
		border-style: dashed;
		color: #6f9a7e;
	}
	.mission.locked .words strong {
		color: #a9bfb0;
	}
	.mission.soon {
		opacity: 0.45;
	}
	.mission.soon .pick {
		cursor: default;
	}
	@media (max-width: 520px) {
		.acts {
			grid-template-columns: 1fr 1fr;
		}
		.open {
			padding-left: 0.9rem;
		}
	}
	@media (max-height: 520px) and (orientation: landscape) {
		.deck {
			padding: 0.7rem;
		}
		.acts small {
			display: none;
		}
		.pick {
			padding: 0.4rem 0.6rem;
		}
	}
</style>
