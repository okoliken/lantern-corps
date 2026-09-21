<script lang="ts">
	// Sparring with Kilowog and Sinestro on Oa's training grounds. The rules
	// are in $lib/engine/missions/sparring.ts.
	import { onMount, untrack } from 'svelte';
	import GameCanvas from '$lib/components/GameCanvas.svelte';
	import PauseMenu from '$lib/components/PauseMenu.svelte';
	import { Game } from '$lib/engine/game';
	import { LANTERNS } from '$lib/engine/lanterns';
	import { Sparring, type SparState } from '$lib/engine/missions/sparring';
	import { buildTrainingMap } from '$lib/engine/missions/training';
	import { profiles } from '$lib/profiles.svelte';
	import { settings } from '$lib/settings.svelte';

	let { data } = $props();

	let round = $state(0);
	const setup = $derived.by(() => {
		void round; // Rematch builds a fresh fight
		const map = buildTrainingMap();
		const game = new Game({
			players: [{ lantern: data.lantern, keys: 'solo' }],
			map,
			settings: untrack(() => settings.snapshot()),
			profiles: untrack(() => profiles.snapshot())
		});
		const sparring = new Sparring(map);
		game.director = sparring;
		return { game, sparring };
	});

	let paused = $state(false);
	function setPaused(value: boolean) {
		paused = value;
		setup.game.paused = value;
		setup.game.buttons.clear();
	}

	let status = $state({ state: 'intro' as SparState, kilowog: 1, sinestro: 1, elapsed: 0 });
	const over = $derived(status.state === 'won' || status.state === 'lost');

	function onKeydown(e: KeyboardEvent) {
		if (e.code !== 'Escape' || over) return;
		e.preventDefault();
		setPaused(!paused);
	}

	onMount(() => {
		const id = setInterval(() => {
			const s = setup.sparring;
			status = { state: s.state, kilowog: s.health('kilowog'), sinestro: s.health('sinestro'), elapsed: Math.round(s.elapsed) };
		}, 100);
		return () => clearInterval(id);
	});

	function rematch() {
		round++;
		paused = false;
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="screen">
	{#key setup}
		<GameCanvas game={setup.game} />
	{/key}

	<button class="pause" onclick={() => setPaused(true)} aria-label="Pause">❚❚ <kbd>Esc</kbd></button>

	{#if !over}
		<section class="boss">
			<div class="row">
				<span class="name">Kilowog</span>
				<span class="sub">Sparring · first one down loses</span>
			</div>
			<span class="track"><span class="fill" style:width="{status.kilowog * 100}%"></span></span>
			<div class="row">
				<span class="name sinestro">Sinestro</span>
			</div>
			<span class="track"><span class="fill" style:width="{status.sinestro * 100}%"></span></span>
			{#if status.state === 'intro'}
				<p class="tip">Two on one. Anything goes: ring shots, constructs, shields, your signature. Watch for the hammer overhead and keep moving.</p>
			{/if}
		</section>
	{:else}
		<div class="end" role="dialog" aria-label="Result" class:won={status.state === 'won'}>
			<h2>{status.state === 'won' ? 'You beat them both!' : 'Down you go'}</h2>
			<p class="line">
				{status.state === 'won'
					? `"You pass, poozer." Sinestro just nods. From him, that's a lot.`
					: `"Get up, poozer! A Red Lantern won't wait for you to catch your breath."`}
			</p>
			{#if status.state === 'won'}<p>Took {status.elapsed} seconds as {LANTERNS[data.lantern].name}.</p>{/if}
			<div class="actions">
				<button class="primary" onclick={rematch}>{status.state === 'won' ? 'Again' : 'Rematch'}</button>
				<a href="/missions">Missions</a>
				<a href="/">Main menu</a>
			</div>
		</div>
	{/if}

	{#if paused && !over}
		<PauseMenu
			game={setup.game}
			onResume={() => setPaused(false)}
			links={[
				{ href: '/missions', label: '← Missions' },
				{ href: '/', label: 'Main menu' }
			]}
		/>
	{/if}
</div>

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
		color: var(--green);
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
	.boss {
		position: absolute;
		top: 12px;
		left: 50%;
		translate: -50% 0;
		width: min(30rem, calc(100% - 180px));
		display: grid;
		gap: 0.35rem;
		padding: 0.6rem 0.9rem;
		border-radius: 10px;
		background: rgba(3, 10, 6, 0.8);
		border: 1px solid var(--suit-lit);
		pointer-events: none;
	}
	.row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 1rem;
	}
	.name {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 0.85rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #e0b4b8;
	}
	.name.sinestro {
		color: #e07aa8;
	}
	.sub {
		font-size: 0.75rem;
		opacity: 0.7;
	}
	.track {
		height: 10px;
		border-radius: 5px;
		background: rgba(255, 255, 255, 0.08);
		overflow: hidden;
	}
	.fill {
		display: block;
		height: 100%;
		background: var(--suit);
		box-shadow: 0 0 10px var(--green);
		transition: width 0.15s;
	}
	.tip {
		margin: 0.2rem 0 0;
		font-size: 0.8rem;
		opacity: 0.75;
	}
	.end {
		position: absolute;
		top: 55%;
		left: 50%;
		translate: -50% -50%;
		width: min(30rem, 92vw);
		box-sizing: border-box;
		padding: 1.5rem 1.75rem;
		border-radius: 12px;
		text-align: center;
		background: rgba(3, 10, 6, 0.92);
		border: 2px solid #e0b4b8;
		box-shadow: 0 0 40px rgba(224, 180, 184, 0.15);
	}
	.end.won {
		border-color: var(--suit-lit);
		box-shadow: 0 0 40px color-mix(in srgb, var(--green) 20%, transparent);
	}
	.end h2 {
		margin: 0 0 0.5rem;
		font-size: 1.5rem;
		text-transform: uppercase;
		color: #e0b4b8;
	}
	.end.won h2 {
		color: var(--green);
		text-shadow: 0 0 16px var(--green);
	}
	.line {
		font-style: italic;
		opacity: 0.85;
		line-height: 1.45;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: 0.75rem 1.25rem;
		margin-top: 1.25rem;
	}
	.actions a {
		font-size: 0.9rem;
		text-decoration: none;
	}
	.primary {
		font: inherit;
		font-weight: 800;
		padding: 0.55rem 1.5rem;
		border-radius: 6px;
		border: none;
		background: var(--suit);
		color: var(--text);
		cursor: pointer;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	/* A phone on its side: your bars take the top left, so the fight's go top right */
	@media (max-height: 520px) and (orientation: landscape) {
		.pause kbd {
			display: none;
		}
		.boss {
			left: auto;
			right: max(10px, env(safe-area-inset-right));
			translate: none;
			width: min(20rem, 40vw);
			padding: 0.45rem 0.65rem;
		}
		.tip {
			display: none;
		}
	}
</style>
