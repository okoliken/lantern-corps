<script lang="ts">
	// Sparring · One on One. Nothing is locked: pick anybody, any time.
	import MenuPoster from '$lib/components/MenuPoster.svelte';
	import Emblem from '$lib/components/Emblem.svelte';
	import { EXTRAS, OPPONENTS, TIERS, isReady, type TierId } from '$lib/engine/missions/sparring';
	import { PLAYABLE, LANTERNS } from '$lib/engine/lanterns';
	import { records } from '$lib/records.svelte';

	let as = $state<'hal' | 'john'>('hal');
	const inTier = (t: TierId) => OPPONENTS.filter((o) => o.tier === t);
	const extrasIn = (t: TierId) => EXTRAS.filter((o) => o.tier === t);
	/** Best time in seconds, or 0 if they have never been beaten. */
	const bestOf = (id: string) => records.best(`spar:${id}:${as}`);
</script>

<MenuPoster />
<div class="shade"></div>

<header class="bar">
	<a class="brand" href="/">
		<Emblem size={26} />
		<span class="name">Lantern Corps</span>
	</a>
	<nav class="tabs">
		<a href="/missions">Missions</a>
		<a href="/school">Training</a>
		<a class="on" href="/spar">Sparring</a>
		<a href="/skirmish">Skirmish</a>
		<a href="/hq">Corps HQ</a>
	</nav>
</header>

<main>
	<div class="rail">
		<h1>One on One</h1>
		<p class="lead">No missions, no stakes. Just you and the best in the universe. Nothing is locked — take anyone, in any order.</p>

		<div class="who">
			<span class="label">Fight as</span>
			{#each PLAYABLE as id (id)}
				<button class:on={as === id} onclick={() => (as = id)}>{LANTERNS[id].name}</button>
			{/each}
		</div>

		{#each TIERS as tier (tier.id)}
			<section>
				<header class="teacher">
					<h2>{tier.name}</h2>
					<p>{tier.blurb}</p>
				</header>

				{#each [...inTier(tier.id), ...extrasIn(tier.id)] as foe (foe.id)}
					{@const best = bestOf(foe.id)}
					{#if isReady(foe)}
						<a class="card" class:passed={best > 0} href="/spar/{foe.id}?as={as}">
							<span class="text">
								<strong>{foe.name}</strong>
								<small>One on one · as {LANTERNS[as].name}</small>
								<span>{foe.tests}</span>
							</span>
							<span class="score">
								{#if best > 0}
									<b>{best}s</b><i>best</i>
								{:else}
									<i>not fought</i>
								{/if}
							</span>
						</a>
					{:else}
						<div class="card locked">
							<span class="text">
								<strong>{foe.name}</strong>
								<small>One on one · being built</small>
								<span>{foe.tests}</span>
							</span>
						</div>
					{/if}
				{/each}
			</section>
		{/each}

		<div class="rule"></div>
		<nav class="plain"><a href="/">Main menu</a></nav>
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
	main {
		position: relative;
		z-index: 1;
		padding: 1.4rem clamp(1rem, 4vw, 3rem) 4rem;
	}
	.rail {
		display: grid;
		gap: 0.6rem;
		width: min(40rem, 100%);
	}
	h1 {
		margin: 0;
		font-size: 1.6rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--green);
	}
	.lead {
		margin: 0 0 0.6rem;
		font-size: 0.86rem;
		opacity: 0.6;
		max-width: 32rem;
	}
	section {
		display: grid;
		gap: 0.5rem;
		margin-top: 0.8rem;
	}
	.teacher {
		border-left: 3px solid var(--green);
		padding-left: 0.8rem;
	}
	.teacher h2 {
		margin: 0;
		font-size: 1.05rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.teacher p {
		margin: 0;
		font-size: 0.74rem;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: var(--green);
		opacity: 0.85;
	}
	.card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem 0.9rem;
		border: 1px solid color-mix(in srgb, var(--suit-lit) 40%, transparent);
		border-left: 3px solid transparent;
		border-radius: 4px;
		background: rgba(4, 14, 10, 0.75);
		text-decoration: none;
		color: var(--text);
	}
	a.card:hover {
		border-color: var(--green);
		border-left-color: var(--green);
		background: color-mix(in srgb, var(--suit) 40%, rgba(4, 14, 10, 0.75));
	}
	.card.passed {
		border-left-color: #ffd21e;
	}
	.card.locked {
		opacity: 0.42;
		border-style: dashed;
	}
	.text {
		display: grid;
		gap: 0.15rem;
	}
	.text strong {
		font-family: var(--font-display);
		letter-spacing: 0.05em;
		color: var(--green);
		text-transform: uppercase;
		font-size: 0.95rem;
	}
	.text small {
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		opacity: 0.55;
	}
	.text span {
		font-size: 0.84rem;
		opacity: 0.78;
		max-width: 28rem;
	}
	.score {
		display: grid;
		justify-items: end;
		gap: 0.1rem;
		white-space: nowrap;
		color: var(--green);
	}
	.score b {
		font-family: var(--font-display);
		font-size: 1.3rem;
	}
	.score i {
		font-style: normal;
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		opacity: 0.6;
	}
	.rule {
		height: 1px;
		margin: 1rem 0 0.2rem;
		background: linear-gradient(90deg, color-mix(in srgb, var(--suit-lit) 70%, transparent), transparent);
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
	@media (max-height: 560px) {
		.bar {
			min-height: 2.5rem;
		}
		main {
			padding: 0.7rem clamp(0.6rem, 3vw, 1.4rem) 2rem;
		}
		h1 {
			font-size: 1.15rem;
		}
		.lead {
			font-size: 0.74rem;
		}
		.card {
			padding: 0.5rem 0.6rem;
		}
		.text strong {
			font-size: 0.85rem;
		}
		.text span {
			font-size: 0.72rem;
		}
		.score b {
			font-size: 1rem;
		}
	}

	.who {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 1rem;
	}
	.who .label {
		font-size: 0.8rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		opacity: 0.6;
	}
	.who button {
		padding: 0.35rem 0.9rem;
		font: inherit;
		font-size: 0.9rem;
		color: var(--text);
		background: rgba(3, 12, 8, 0.6);
		border: 1px solid var(--suit-lit);
		border-radius: 999px;
		cursor: pointer;
	}
	.who button.on {
		color: #05130b;
		background: var(--green);
		border-color: var(--green);
		font-weight: 700;
	}
</style>
