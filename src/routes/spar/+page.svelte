<script lang="ts">
	// Sparring · One on One. Nothing is locked: pick anybody, any time.
	import MenuShell from '$lib/components/menu/MenuShell.svelte';
	import MenuIcon from '$lib/components/menu/MenuIcon.svelte';
	import { EXTRAS, OPPONENTS, TIERS, isReady, type TierId } from '$lib/engine/missions/sparring';
	import { PLAYABLE, LANTERNS } from '$lib/engine/lanterns';
	import { records } from '$lib/records.svelte';

	let as = $state<'hal' | 'john'>('hal');
	const inTier = (t: TierId) => OPPONENTS.filter((o) => o.tier === t);
	const extrasIn = (t: TierId) => EXTRAS.filter((o) => o.tier === t);
	/** Best time in seconds, or 0 if they have never been beaten. */
	const bestOf = (id: string) => records.best(`spar:${id}:${as}`);
	const initials = (name: string) =>
		name
			.split(/[\s'-]+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0])
			.join('')
			.toUpperCase();
</script>

<svelte:head>
	<title>Sparring · Lantern Corps</title>
</svelte:head>

<MenuShell active="spar">
	<div class="head">
		<div>
			<h1>One on One</h1>
			<p>No missions, no stakes. Just you and the best in the universe. Nothing is locked — take anyone, in any order.</p>
		</div>
	</div>

	<div class="seg" role="tablist" aria-label="Fight as">
		{#each PLAYABLE as id (id)}
			<button role="tab" aria-selected={as === id} class:on={as === id} onclick={() => (as = id)}>
				<small>Fight as</small>
				{LANTERNS[id].name}
			</button>
		{/each}
	</div>

	{#each TIERS as tier (tier.id)}
		<section class="group">
			<header class="group-head">
				<h2>{tier.name}</h2>
				<p>{tier.blurb}</p>
			</header>
			<div class="list">
				{#each [...inTier(tier.id), ...extrasIn(tier.id)] as foe (foe.id)}
					{@const best = bestOf(foe.id)}
					{#if isReady(foe)}
						<a class="row" class:done={best > 0} href="/spar/{foe.id}?as={as}">
							<span class="badge">{initials(foe.name)}</span>
							<span class="main">
								<strong>{foe.name}</strong>
								<span class="blurb">{foe.tests}</span>
							</span>
							<span class="aside">
								<span class="score">{#if best > 0}<b>{best}s</b>best{:else}Not fought{/if}</span>
								<span class="go"><MenuIcon name="play" size={12} />Fight</span>
							</span>
						</a>
					{:else}
						<div class="row locked">
							<span class="badge"><MenuIcon name="lock" size={16} /></span>
							<span class="main">
								<strong>{foe.name}</strong>
								<span class="blurb">{foe.tests}</span>
							</span>
							<span class="aside"><span class="tag">Being built</span></span>
						</div>
					{/if}
				{/each}
			</div>
		</section>
	{/each}
</MenuShell>

