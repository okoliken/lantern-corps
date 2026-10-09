<script lang="ts">
	// /play                    -> character select
	// /play?as=hal             -> playing as Hal in space (refreshing keeps your pick)
	// /play?as=hal&env=planet  -> on a planet: walking, no glow
	//                             (until missions exist, this is how we test both)
	//
	// Keeping the choice in the URL means it's shareable, survives a
	// refresh, and the browser Back button returns to the select screen.
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import ControlsCard from '$lib/components/ControlsCard.svelte';
	import GameCanvas from '$lib/components/GameCanvas.svelte';
	import PauseMenu from '$lib/components/PauseMenu.svelte';
	import LanternPortrait from '$lib/components/LanternPortrait.svelte';
	import { Game } from '$lib/engine/game';
	import { isEnvironmentKind } from '$lib/engine/environment';
	import { LANTERNS, PLAYABLE, isLanternId } from '$lib/engine/lanterns';
	import { settings } from '$lib/settings.svelte';
	import { profiles } from '$lib/profiles.svelte';

	const as = $derived(page.url.searchParams.get('as'));
	const lantern = $derived(isLanternId(as) ? as : null);
	const envParam = $derived(page.url.searchParams.get('env'));
	const environment = $derived(isEnvironmentKind(envParam) ? envParam : 'space');
	const otherEnv = $derived(environment === 'space' ? 'planet' : 'space');

	// A fresh game whenever the Lantern or environment changes. It gets a copy
	// of the settings, read with untrack() so changing a setting does NOT
	// restart the game; the pause menu pushes changes in with applySettings().
	const game = $derived(
		lantern
			? new Game({
					players: [{ lantern, keys: 'solo' }],
					environment,
					settings: untrack(() => settings.snapshot()),
					profiles: untrack(() => profiles.snapshot()),
					// Save XP and level-ups as they happen
					onProgress: (id, profile) => profiles.update(id, profile)
				})
			: null
	);

	let paused = $state(false);
	let showIntro = $state(!settings.current.seenControls);

	/** Pause or resume. Buttons are cleared so nothing held carries across. */
	function setPaused(value: boolean) {
		paused = value;
		if (game) {
			game.paused = value;
			game.buttons.clear();
		}
	}

	$effect(() => {
		// The intro card pauses the game until dismissed
		if (game) setPaused(showIntro);
	});

	function onKeydown(e: KeyboardEvent) {
		if (e.code !== 'Escape' || !game || showIntro) return;
		e.preventDefault();
		setPaused(!paused);
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if lantern && game}
	<div class="screen">
		<!-- {#key} throws away the old canvas and starts the new game if the pick changes -->
		{#key game}
			<GameCanvas {game} />
		{/key}
		<button class="pause" onclick={() => setPaused(true)} aria-label="Pause">❚❚ <kbd>Esc</kbd></button>
		<a class="env" href="/play?as={lantern}&env={otherEnv}">Test on {otherEnv} →</a>

		{#if showIntro}
			<ControlsCard onClose={() => (showIntro = false)} />
		{:else if paused}
			<PauseMenu
				{game}
				onResume={() => setPaused(false)}
				links={[
					{ href: '/play', label: '← Change Lantern' },
					{ href: `/hq?as=${lantern}`, label: 'Corps HQ (upgrades)' },
					{ href: '/', label: 'Main menu' }
				]}
			/>
		{/if}
	</div>
{:else}
	<main class="select">
		<h1>Choose your Lantern</h1>
		<div class="cards">
			{#each PLAYABLE as id (id)}
				{@const def = LANTERNS[id]}
				<a class="card" href="/play?as={id}">
					<LanternPortrait {def} />
					<h2>{def.name} <span class="card-lv">Lv {profiles.current[id].level}</span></h2>
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
		<nav class="below">
			<a class="menu" href="/">← Menu</a>
			<a class="menu" href="/hq">Corps HQ (upgrades) →</a>
		</nav>
	</main>
{/if}

<style>
	.screen {
		position: fixed;
		inset: 0;
	}
	.pause {
		position: absolute;
		top: 8px;
		left: max(10px, env(safe-area-inset-left));
		font: inherit;
		font-size: 0.85rem;
		color: var(--green-ink, var(--green));
		background: rgba(3, 6, 10, 0.6);
		border: 1px solid var(--suit-lit);
		border-radius: 6px;
		padding: 0.25rem 0.6rem;
		cursor: pointer;
		opacity: 0.85;
	}
	.pause kbd {
		font-size: 0.7rem;
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
		color: var(--green-ink, var(--green));
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
		border: 2px solid var(--suit-lit);
		border-radius: 10px;
		text-decoration: none;
		color: var(--text);
		background: color-mix(in srgb, var(--suit) 20%, transparent);
		transition:
			border-color 0.15s,
			box-shadow 0.15s,
			translate 0.15s;
	}
	.card:hover,
	.card:focus-visible {
		border-color: var(--green);
		box-shadow: 0 0 24px color-mix(in srgb, var(--green) 25%, transparent);
		translate: 0 -3px;
	}
	h2 {
		margin: 0.5rem 0 0;
		color: var(--green-ink, var(--green));
		/* The display face is wide: keep names on one line */
		font-size: 1.15rem;
		letter-spacing: 0.02em;
		white-space: nowrap;
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
		background: color-mix(in srgb, var(--suit) 60%, transparent);
		overflow: hidden;
	}
	dd span {
		display: block;
		height: 100%;
		background: var(--suit);
	}
	.card-lv {
		font-size: 0.8rem;
		opacity: 0.7;
		font-weight: 600;
	}
	.below {
		display: flex;
		gap: 1.5rem;
	}
	.menu {
		font-size: 0.9rem;
		text-decoration: none;
		opacity: 0.7;
	}

	/* A phone on its side: smaller portraits, so both Lanterns fit on one screen */
	@media (max-height: 520px) and (orientation: landscape) {
		.card :global(canvas) {
			width: min(34vh, 9rem) !important;
			height: min(34vh, 9rem) !important;
		}
		.card {
			padding: 0.6rem;
		}
		.pause kbd {
			display: none;
		}
	}
</style>
