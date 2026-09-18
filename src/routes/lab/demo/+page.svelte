<script lang="ts">
	// The co-op lab: Hal and John together against waves of Red Lanterns and
	// Manhunters. Play one with an AI partner, or both on one keyboard.
	import { onMount, untrack } from 'svelte';
	import GameCanvas from '$lib/components/GameCanvas.svelte';
	import type { EnvironmentKind } from '$lib/engine/environment';
	import { Game } from '$lib/engine/game';
	import { LANTERNS, type LanternId } from '$lib/engine/lanterns';
	import { COOP_WAVES, Waves, memberName } from '$lib/engine/waves';
	import { settings } from '$lib/settings.svelte';

	type Mode = 'partner' | 'couch';
	let mode = $state<Mode>('partner');
	let you = $state<LanternId>('hal');
	let environment = $state<EnvironmentKind>('space');
	let godMode = $state(false);
	let debug = $state(false);
	let round = $state(0);

	const partner = $derived<LanternId>(you === 'hal' ? 'john' : 'hal');

	const setup = $derived.by(() => {
		void round; // Restart makes a fresh game
		// Tougher than normal, so each fight lasts long enough to see every red construct
		const waves = new Waves(COOP_WAVES);
		waves.toughness = 3;
		const game = new Game({
			players: [
				{ lantern: you, keys: mode === 'couch' ? 'p1' : 'solo' },
				{ lantern: partner, keys: 'p2', ai: mode === 'partner' }
			],
			environment,
			showSlots: true,
			settings: untrack(() => settings.snapshot())
		});
		game.director = waves;
		game.dummies.length = 0; // no training dummies in a real fight
		game.nameTags = false;
		return { game, waves };
	});

	$effect(() => {
		setup.game.godMode = godMode;
		setup.game.debug = debug;
	});

	// Poll the fight for the overlay (the engine doesn't know about Svelte)
	let status = $state({ wave: 1, state: 'countdown', timer: 3, left: 0, pack: '' });
	onMount(() => {
		const id = setInterval(() => {
			const { game, waves } = setup;
			status = {
				wave: waves.wave,
				state: waves.state,
				timer: Math.ceil(waves.timer),
				left: game.enemies.length,
				pack: waves.pack.map(memberName).join(', ')
			};
		}, 150);
		return () => clearInterval(id);
	});
</script>

<div class="page">
	<div class="controls">
		<span class="group">
			<button class:on={mode === 'partner'} onclick={() => (mode = 'partner')}>Play + AI partner</button>
			<button class:on={mode === 'couch'} onclick={() => (mode = 'couch')}>2 players</button>
		</span>
		{#if mode === 'partner'}
			<span class="group">
				You:
				{#each ['hal', 'john'] as const as id (id)}
					<button class:on={you === id} onclick={() => (you = id)}>{LANTERNS[id].name}</button>
				{/each}
			</span>
		{/if}
		<span class="group">
			{#each ['space', 'planet'] as const as env (env)}
				<button class:on={environment === env} onclick={() => (environment = env)}>{env}</button>
			{/each}
		</span>
		<label><input type="checkbox" bind:checked={godMode} /> God mode</label>
		<label><input type="checkbox" bind:checked={debug} /> Show AI thinking</label>
		<button onclick={() => round++}>Restart</button>
	</div>
	<div class="controls help">
		{#if mode === 'partner'}
			Move WASD · aim with the mouse · click to shoot · 1–0 use a construct · Shift shield · R signature{environment === 'planet' ? ' · Space take off' : ''}
		{:else}
			P1: WASD + mouse, F shot, G construct, Shift shield, R signature · P2: arrows, . shot, / construct, Right Shift shield, P signature
		{/if}
	</div>
	<div class="stage">
		{#key setup}
			<GameCanvas game={setup.game} showStats />
		{/key}
		<div class="overlay">
			{#if status.state === 'countdown'}
				<div class="banner">
					<small>{status.wave === 1 ? 'Enemies incoming' : `Wave ${status.wave - 1} cleared`}</small>
					<strong>Wave {status.wave} in {status.timer}</strong>
					<small>{status.pack}</small>
				</div>
			{:else}
				<div class="count">Wave {status.wave} · {status.left} {status.left === 1 ? 'enemy' : 'enemies'} left</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.page {
		height: 100%;
		display: flex;
		flex-direction: column;
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1rem;
		padding: 0.5rem 1rem 0;
		font-size: 0.85rem;
	}
	.help {
		padding-bottom: 0.5rem;
		opacity: 0.7;
		font-size: 0.8rem;
	}
	.group {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}
	label {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}
	button {
		font: inherit;
		font-size: 0.8rem;
		text-transform: capitalize;
		padding: 0.15rem 0.6rem;
		color: var(--text);
		background: transparent;
		border: 1px solid var(--green-dim);
		border-radius: 4px;
		cursor: pointer;
	}
	button.on {
		background: var(--green);
		color: var(--bg);
		border-color: var(--green);
	}
	.stage {
		position: relative;
		flex: 1;
		min-height: 0;
	}
	.overlay {
		position: absolute;
		top: 1rem;
		left: 0;
		right: 0;
		display: flex;
		justify-content: center;
		pointer-events: none;
	}
	.count {
		font-size: 0.9rem;
		font-weight: 600;
		color: #ffd0d0;
		background: rgba(20, 0, 0, 0.55);
		border: 1px solid rgba(255, 42, 42, 0.5);
		padding: 0.3rem 0.8rem;
		border-radius: 4px;
	}
	.banner {
		display: grid;
		justify-items: center;
		gap: 0.2rem;
		margin-top: 3rem;
		padding: 0.8rem 1.6rem;
		background: rgba(20, 0, 0, 0.6);
		border: 1px solid rgba(255, 42, 42, 0.6);
		border-radius: 6px;
		color: #ffd0d0;
		text-shadow: 0 0 12px rgba(255, 42, 42, 0.8);
	}
	.banner strong {
		font-size: 1.6rem;
		color: #ff5a5a;
	}
	.banner small {
		opacity: 0.85;
	}
</style>
