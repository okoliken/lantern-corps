<script lang="ts">
	// Corps HQ: see each Lantern's level and spend upgrade points.
	import LanternPortrait from '$lib/components/LanternPortrait.svelte';
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

<main>
	<header>
		<a href="/" class="back">← Menu</a>
		<h1>Corps HQ</h1>
		<a href="/play?as={selected}" class="play">Play as {def.name.split(' ')[0]} →</a>
	</header>

	<nav class="tabs" aria-label="Choose Lantern">
		{#each ['hal', 'john'] as const as id (id)}
			<button class:on={selected === id} onclick={() => (selected = id)}>
				{LANTERNS[id].name}
				<span class="lv">Lv {profiles.current[id].level}</span>
			</button>
		{/each}
	</nav>

	<section class="summary">
		{#key selected}
			<LanternPortrait {def} size={150} />
		{/key}
		<div class="info">
			<h2>{def.name}</h2>
			<p class="title">{def.title}</p>
			<p class="level">Level {profile.level}{maxed ? ' (max)' : ''}</p>
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
			<span>upgrade point{profile.points === 1 ? '' : 's'}</span>
		</div>
	</section>

	<section class="upgrades">
		{#each UPGRADES as u (u.id)}
			{@const rank = profile.ranks[u.id]}
			<article>
				<h3>{u.name}</h3>
				<p class="desc">{u.description}</p>
				<div class="pips" aria-label="Rank {rank} of {MAX_RANK}">
					{#each Array.from({ length: MAX_RANK }, (_, i) => i) as i (i)}
						<span class:filled={i < rank}></span>
					{/each}
				</div>
				<p class="now">Now: {current(u.id)}</p>
				<button disabled={!canUpgrade(profile, u.id)} onclick={() => profiles.upgrade(selected, u.id)}>
					{rank >= MAX_RANK ? 'Maxed' : `Upgrade · ${u.perRank}`}
				</button>
			</article>
		{/each}
	</section>

	<footer>
		<button class="refund" disabled={spent === 0} onclick={() => profiles.refund(selected)}>
			Refund all points
		</button>
		<p>Refunding is free, so try different builds.</p>
	</footer>
</main>

<style>
	main {
		max-width: 56rem;
		margin: 0 auto;
		padding: 1.25rem 1rem 3rem;
		box-sizing: border-box;
	}
	header {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 1rem;
	}
	header a {
		text-decoration: none;
		font-size: 0.9rem;
	}
	.play {
		justify-self: end;
	}
	h1 {
		margin: 0;
		color: var(--green);
		text-shadow: 0 0 18px var(--green);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-size: clamp(1.5rem, 5vw, 2.4rem);
	}
	.tabs {
		display: flex;
		justify-content: center;
		gap: 0.5rem;
		margin: 1.25rem 0;
	}
	button {
		font: inherit;
		color: var(--text);
		background: transparent;
		border: 1px solid var(--green-dim);
		border-radius: 8px;
		padding: 0.45rem 0.9rem;
		cursor: pointer;
	}
	button:hover:not(:disabled),
	button:focus-visible {
		border-color: var(--green);
	}
	button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.tabs button.on {
		background: rgba(61, 255, 110, 0.15);
		border-color: var(--green);
	}
	.lv {
		margin-left: 0.4rem;
		font-size: 0.75rem;
		opacity: 0.7;
	}
	.summary {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1rem 1.5rem;
		padding: 1rem 1.25rem;
		border: 2px solid var(--green-dim);
		border-radius: 12px;
		background: rgba(61, 255, 110, 0.03);
	}
	.info {
		flex: 1;
		min-width: 14rem;
	}
	h2 {
		margin: 0;
		color: var(--green);
		/* The display face is wide: keep names on one line */
		font-size: 1.15rem;
		letter-spacing: 0.02em;
		white-space: nowrap;
	}
	.title {
		margin: 0.1rem 0 0.5rem;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		opacity: 0.7;
	}
	.level {
		margin: 0 0 0.35rem;
		font-weight: 700;
	}
	.xp {
		height: 8px;
		border-radius: 4px;
		background: rgba(61, 255, 110, 0.12);
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
		opacity: 0.7;
	}
	.signature {
		margin: 0.75rem 0 0;
		font-size: 0.85rem;
		opacity: 0.85;
	}
	.points {
		display: grid;
		justify-items: center;
		padding: 0.5rem 1rem;
		border-radius: 10px;
		font-size: 0.8rem;
		opacity: 0.6;
	}
	.points.has {
		opacity: 1;
		color: var(--green);
		box-shadow: 0 0 20px rgba(61, 255, 110, 0.25);
		border: 1px solid var(--green);
	}
	.big {
		font-size: 2.2rem;
		font-weight: 800;
		line-height: 1;
	}
	.upgrades {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		gap: 1rem;
		margin-top: 1.25rem;
	}
	article {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 1rem;
		border: 1px solid var(--green-dim);
		border-radius: 10px;
	}
	h3 {
		margin: 0;
		color: var(--green);
	}
	.desc,
	.now {
		margin: 0;
		font-size: 0.85rem;
	}
	.now {
		opacity: 0.7;
	}
	.pips {
		display: flex;
		gap: 0.3rem;
	}
	.pips span {
		width: 1.2rem;
		height: 0.45rem;
		border-radius: 3px;
		background: rgba(61, 255, 110, 0.15);
	}
	.pips span.filled {
		background: var(--green);
		box-shadow: 0 0 6px var(--green);
	}
	article button {
		margin-top: auto;
		font-size: 0.8rem;
	}
	footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1rem;
		margin-top: 1.5rem;
		font-size: 0.85rem;
	}
	footer p {
		margin: 0;
		opacity: 0.6;
	}
</style>
