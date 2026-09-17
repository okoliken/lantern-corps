<script lang="ts">
	// /play                    -> character select
	// /play?as=hal             -> playing as Hal in space (refreshing keeps your pick)
	// /play?as=hal&env=planet  -> on a planet: walking, no glow
	//                             (until missions exist, this is how we test both)
	//
	// Keeping the choice in the URL means it's shareable, survives a
	// refresh, and the browser Back button returns to the select screen.
	import { page } from '$app/state';
	import GameCanvas from '$lib/components/GameCanvas.svelte';
	import LanternPortrait from '$lib/components/LanternPortrait.svelte';
	import { Game } from '$lib/engine/game';
	import { isEnvironmentKind } from '$lib/engine/environment';
	import { LANTERNS, isLanternId } from '$lib/engine/lanterns';

	const as = $derived(page.url.searchParams.get('as'));
	const lantern = $derived(isLanternId(as) ? as : null);
	const envParam = $derived(page.url.searchParams.get('env'));
	const environment = $derived(isEnvironmentKind(envParam) ? envParam : 'space');
	const otherEnv = $derived(environment === 'space' ? 'planet' : 'space');
</script>

{#if lantern}
	<div class="screen">
		<!-- {#key} throws away the old game and builds a fresh one if the pick changes -->
		{#key `${lantern}-${environment}`}
			<GameCanvas game={new Game({ players: [{ lantern, keys: 'both' }], environment })} />
		{/key}
		<a class="back" href="/play">← Change Lantern</a>
		<a class="env" href="/play?as={lantern}&env={otherEnv}">Test on {otherEnv} →</a>
		<div class="hint">
			Move: WASD or arrows · Fire: hold J or F{environment === 'planet' ? ' · Space: take off / land' : ''}
			· Stand by the Lantern to recharge
		</div>
	</div>
{:else}
	<main class="select">
		<h1>Choose your Lantern</h1>
		<div class="cards">
			{#each Object.values(LANTERNS) as def (def.id)}
				<a class="card" href="/play?as={def.id}">
					<LanternPortrait {def} />
					<h2>{def.name}</h2>
					<p class="title">{def.title}</p>
					<p class="blurb">{def.blurb}</p>
					<dl>
						<dt>Speed</dt>
						<dd><span style:width="{(def.maxSpeed / 340) * 100}%"></span></dd>
						<dt>Agility</dt>
						<dd><span style:width="{(def.accel / 2800) * 100}%"></span></dd>
					</dl>
				</a>
			{/each}
		</div>
		<a class="menu" href="/">← Menu</a>
	</main>
{/if}

<style>
	.screen {
		position: fixed;
		inset: 0;
	}
	.back {
		position: absolute;
		top: 10px;
		left: 12px;
		font-size: 0.9rem;
		text-decoration: none;
		opacity: 0.7;
	}
	.env {
		position: absolute;
		top: 10px;
		right: 12px;
		font-size: 0.9rem;
		text-decoration: none;
		opacity: 0.7;
	}
	/* Top centre, under the links: the bottom corners belong to the willpower HUD. */
	.hint {
		position: absolute;
		top: 36px;
		left: 50%;
		translate: -50% 0;
		width: max-content;
		max-width: calc(100% - 32px);
		text-align: center;
		font-size: 0.8rem;
		opacity: 0.5;
		pointer-events: none;
	}

	.select {
		min-height: 100%;
		box-sizing: border-box;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 1.5rem;
		padding: 2rem 1rem;
	}
	h1 {
		margin: 0;
		color: var(--green);
		text-shadow: 0 0 18px var(--green);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: clamp(1.6rem, 5vw, 2.6rem);
		text-align: center;
	}
	.cards {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 1.25rem;
	}
	.card {
		width: min(17rem, 100%);
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 1.25rem;
		border: 2px solid var(--green-dim);
		border-radius: 10px;
		text-decoration: none;
		color: var(--text);
		background: rgba(61, 255, 110, 0.03);
		transition:
			border-color 0.15s,
			box-shadow 0.15s,
			translate 0.15s;
	}
	.card:hover,
	.card:focus-visible {
		border-color: var(--green);
		box-shadow: 0 0 24px rgba(61, 255, 110, 0.25);
		translate: 0 -3px;
	}
	h2 {
		margin: 0.5rem 0 0;
		color: var(--green);
	}
	.title {
		margin: 0.1rem 0 0.6rem;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		opacity: 0.7;
	}
	.blurb {
		margin: 0 0 1rem;
		font-size: 0.9rem;
		text-align: center;
		line-height: 1.4;
	}
	dl {
		width: 100%;
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.4rem 0.75rem;
		align-items: center;
		margin: 0;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	dd {
		margin: 0;
		height: 6px;
		border-radius: 3px;
		background: rgba(61, 255, 110, 0.12);
		overflow: hidden;
	}
	dd span {
		display: block;
		height: 100%;
		background: var(--green);
	}
	.menu {
		font-size: 0.9rem;
		text-decoration: none;
		opacity: 0.7;
	}
</style>
