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

	let shown = $state<number | null>(null);
	const actNumber = $derived(shown ?? currentAct());
	const act = $derived(ACTS.find((a) => a.number === actNumber) ?? ACTS[0]);
	const nextId = $derived(builtOf(act).find((id) => campaign.stars(id) === 0 && campaign.isOpen(id)) ?? null);
</script>

<svelte:head>
	<title>Missions · Lantern Corps</title>
</svelte:head>

<MenuShell active="missions">
	<div class="head">
		<div>
			<h1>Missions</h1>
			<p>{act.tagline}{#if unlocked} <b class="note">Every mission is unlocked.</b>{/if}</p>
		</div>
	</div>

	<div class="seg" role="tablist" aria-label="Acts">
		{#each ACTS as a (a.number)}
			<button role="tab" aria-selected={a.number === actNumber} class:on={a.number === actNumber} onclick={() => (shown = a.number)}>
				<small>{a.number >= 4 ? 'Season 2' : `Act ${a.number}`} · {doneIn(a)}/{a.lineup.length}</small>
				{a.title}
			</button>
		{/each}
	</div>

	<div class="list">
		{#each act.lineup as entry, i (actNumber + '-' + i)}
			{@const m = typeof entry === 'string' ? missionById(entry) : undefined}
			{#if m && campaign.isOpen(m.id)}
				{@const stars = campaign.stars(m.id)}
				<a class="row" class:done={stars > 0} class:next={m.id === nextId} href="/mission/{m.id}">
					<span class="badge">{i + 1}</span>
					<span class="main">
						<small>{m.choose ? 'Hal or John' : LANTERNS[m.lantern].name} · {m.place}</small>
						<strong>{m.title}</strong>
						<span class="blurb">{m.tagline}</span>
					</span>
					<span class="aside">
						<span class="pips" aria-label="{stars} of 3 stars">
							{#each [1, 2, 3] as n (n)}<span class:on={n <= stars}><MenuIcon name="star" size={15} /></span>{/each}
						</span>
						<span class="go"><MenuIcon name="play" size={12} />{stars > 0 ? 'Replay' : 'Play'}</span>
					</span>
				</a>
			{:else if m}
				<div class="row locked" aria-disabled="true">
					<span class="badge"><MenuIcon name="lock" size={16} /></span>
					<span class="main">
						<strong>{m.title}</strong>
						<span class="blurb">Finish {titleOf(campaign.before(m.id))} to unlock.</span>
					</span>
					<span class="aside"></span>
				</div>
			{:else if typeof entry !== 'string'}
				<div class="row locked">
					<span class="badge">{i + 1}</span>
					<span class="main">
						<strong>{entry.title}</strong>
						<span class="blurb">{entry.tagline}</span>
					</span>
					<span class="aside"><span class="tag">Coming soon</span></span>
				</div>
			{/if}
		{/each}
	</div>
</MenuShell>

<style>
	.note {
		color: var(--green-ink, var(--green));
		font-weight: 600;
	}
</style>
