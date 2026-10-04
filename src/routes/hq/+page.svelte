<script lang="ts">
	// Corps HQ: see each Lantern's level and spend upgrade points.
	import LanternPortrait from '$lib/components/LanternPortrait.svelte';
	import MenuShell from '$lib/components/menu/MenuShell.svelte';
	import { SIGNATURES } from '$lib/engine/constructs/signature';
	import { LANTERNS, isLanternId, type LanternId } from '$lib/engine/lanterns';
	import { MAX_LEVEL, MAX_RANK, UPGRADES, XP_PER_DEFEAT, canUpgrade, statsFor, xpToNext } from '$lib/engine/progression';
	import { page } from '$app/state';
	import { profiles } from '$lib/profiles.svelte';

	const fromUrl = page.url.searchParams.get('as');
	let selected = $state<LanternId>(isLanternId(fromUrl) ? fromUrl : 'hal');

	const def = $derived(LANTERNS[selected]);
	const profile = $derived(profiles.current[selected]);
	const stats = $derived(statsFor(profile));
	const maxed = $derived(profile.level >= MAX_LEVEL);
	const spent = $derived(Object.values(profile.ranks).reduce((a, b) => a + b, 0));

	/** What each upgrade currently gives, for the card. */
	const current = (id: (typeof UPGRADES)[number]['id']) =>
		({
			willpower: `${stats.maxWillpower} max willpower`,
			recovery: `${Math.round(stats.regenMultiplier * 100)}% recovery`,
			power: `${Math.round(stats.powerMultiplier * 100)}% damage`,
			focus: `${Math.round(stats.cooldownMultiplier * 100)}% cooldowns`
		})[id];
</script>

<svelte:head>
	<title>Corps HQ · Lantern Corps</title>
</svelte:head>

<MenuShell active="hq">
	<div class="head">
		<div>
			<h1>Corps HQ</h1>
			<p>Each Lantern levels up in every mode. Spend the points on what suits how you fight.</p>
		</div>
		<a href="/play?as={selected}" class="go">Free play as {def.name.split(' ')[0]}</a>
	</div>

	<div class="seg" role="tablist" aria-label="Choose Lantern">
		{#each ['hal', 'john'] as const as id (id)}
			<button role="tab" aria-selected={selected === id} class:on={selected === id} onclick={() => (selected = id)}>
				<small>Level {profiles.current[id].level}</small>
				{LANTERNS[id].name}
			</button>
		{/each}
	</div>

	<section class="panel summary">
		<div class="portrait">
			{#key selected}
				<LanternPortrait {def} size={120} />
			{/key}
		</div>
		<div class="info">
			<h2>{def.name}</h2>
			<p class="title">{def.title} · Level {profile.level}{maxed ? ' (max)' : ''}</p>
			{#if !maxed}
				<div class="xp" role="progressbar" aria-valuenow={profile.xp} aria-valuemax={xpToNext(profile.level)}>
					<span style:width="{(profile.xp / xpToNext(profile.level)) * 100}%"></span>
				</div>
				<p class="hint">
					{profile.xp} / {xpToNext(profile.level)} XP to level {profile.level + 1} · +{XP_PER_DEFEAT} XP per enemy defeated
				</p>
			{/if}
			<p class="signature"><strong>{SIGNATURES[selected].name}:</strong> {SIGNATURES[selected].description}</p>
		</div>
		<div class="points" class:has={profile.points > 0}>
			<span class="big">{profile.points}</span>
			<span>point{profile.points === 1 ? '' : 's'} to spend</span>
		</div>
	</section>

	<section class="group">
		<header class="group-head">
			<h2>Upgrades</h2>
			<p>Refunding is free, so try different builds.</p>
		</header>
		<div class="upgrades">
			{#each UPGRADES as u (u.id)}
				{@const rank = profile.ranks[u.id]}
				<article class="panel">
					<h3>{u.name}</h3>
					<p class="desc">{u.description}</p>
					<div class="ranks" aria-label="Rank {rank} of {MAX_RANK}">
						{#each Array.from({ length: MAX_RANK }, (_, i) => i) as i (i)}
							<span class:filled={i < rank}></span>
						{/each}
					</div>
					<p class="now">Now: {current(u.id)}</p>
					<button class="go" disabled={!canUpgrade(profile, u.id)} onclick={() => profiles.upgrade(selected, u.id)}>
						{rank >= MAX_RANK ? 'Maxed' : `Upgrade · ${u.perRank}`}
					</button>
				</article>
			{/each}
		</div>
		<button class="refund" disabled={spent === 0} onclick={() => profiles.refund(selected)}>Refund all points</button>
	</section>
</MenuShell>

<style>
	.summary {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.8rem 1.4rem;
	}
	.portrait {
		width: 120px;
		height: 120px;
		border-radius: 0.8rem;
		background: radial-gradient(circle, rgba(61, 255, 110, 0.12), transparent 70%);
	}
	.info {
		flex: 1;
		min-width: 13rem;
	}
	h2 {
		margin: 0;
		color: #fff;
		font-size: 1.15rem;
		letter-spacing: 0.03em;
		white-space: nowrap;
	}
	.title {
		margin: 0.15rem 0 0.6rem;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--muted);
	}
	.xp {
		height: 8px;
		border-radius: 4px;
		background: rgba(0, 0, 0, 0.45);
		overflow: hidden;
	}
	.xp span {
		display: block;
		height: 100%;
		background: var(--green);
		box-shadow: 0 0 8px var(--green);
	}
	.hint {
		margin: 0.35rem 0 0;
		font-size: 0.8rem;
		color: var(--muted);
	}
	.signature {
		margin: 0.7rem 0 0;
		font-size: 0.86rem;
		line-height: 1.4;
		color: #c3dfca;
	}
	.signature strong {
		color: #fff;
	}
	.points {
		display: grid;
		justify-items: center;
		padding: 0.6rem 1rem;
		border-radius: 0.8rem;
		border: 1px solid var(--line);
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--muted);
	}
	.points.has {
		color: var(--green);
		border-color: var(--green);
		box-shadow: 0 0 20px rgba(61, 255, 110, 0.2);
	}
	.big {
		font-size: 2.2rem;
		font-weight: 800;
		line-height: 1.1;
		color: #fff;
	}
	.upgrades {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
		gap: 0.6rem;
	}
	article {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}
	h3 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 0.95rem;
		font-weight: 600;
		color: #fff;
	}
	.desc,
	.now {
		margin: 0;
		font-size: 0.84rem;
		line-height: 1.35;
		color: #c3dfca;
	}
	.now {
		color: var(--muted);
	}
	.ranks {
		display: flex;
		gap: 0.3rem;
	}
	.ranks span {
		flex: 1;
		height: 0.4rem;
		border-radius: 3px;
		background: rgba(0, 0, 0, 0.45);
	}
	.ranks span.filled {
		background: var(--green);
		box-shadow: 0 0 6px var(--green);
	}
	.upgrades article .go {
		margin-top: auto;
		width: 100%;
		white-space: normal;
		font-family: var(--font-ui);
		font-size: 0.82rem;
		letter-spacing: 0.02em;
		text-transform: none;
		padding: 0.4rem 0.6rem;
	}
	.go:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.refund {
		margin-top: 1rem;
		font: inherit;
		font-size: 0.85rem;
		color: var(--muted);
		background: transparent;
		border: 1px solid var(--line);
		border-radius: 0.7rem;
		padding: 0.55rem 1rem;
		cursor: pointer;
	}
	.refund:hover:not(:disabled) {
		color: #fff;
		border-color: var(--line-hi);
	}
	.refund:disabled {
		opacity: 0.4;
		cursor: default;
	}
	@media (max-height: 520px) and (orientation: landscape) {
		.portrait {
			display: none;
		}
	}
	@media (orientation: portrait) and (max-width: 700px) {
		.portrait {
			width: 84px;
			height: 84px;
			overflow: hidden;
		}
		.portrait :global(canvas) {
			width: 84px !important;
			height: 84px !important;
		}
		.upgrades {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
