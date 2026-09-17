<script lang="ts">
	// Fight enemies with your Lantern. Spawn them around you, freeze their
	// brains, turn on god mode, and see what state each one is in.
	import { onMount, untrack } from 'svelte';
	import GameCanvas from '$lib/components/GameCanvas.svelte';
	import { ENEMIES, isEnemy, type EnemyKind } from '$lib/engine/enemies/enemies';
	import type { EnvironmentKind } from '$lib/engine/environment';
	import { Game } from '$lib/engine/game';
	import { LANTERNS, type LanternId } from '$lib/engine/lanterns';
	import { settings } from '$lib/settings.svelte';

	/** Enemies built so far. The rest arrive in the next stages. */
	const READY: EnemyKind[] = ['rageGrunt'];

	let lantern = $state<LanternId>('hal');
	let environment = $state<EnvironmentKind>('planet');
	let godMode = $state(false);
	let freeze = $state(false);
	let infinite = $state(false);
	let debug = $state(true);

	const game = $derived(
		new Game({
			players: [{ lantern, keys: 'solo' }],
			environment,
			settings: untrack(() => settings.snapshot())
		})
	);

	$effect(() => {
		game.godMode = godMode;
		game.freezeEnemies = freeze;
		game.infiniteWillpower = infinite;
		game.debug = debug;
	});

	/** Spawn around the player, a few hundred px away, in a spread. */
	function spawn(kind: EnemyKind, count = 1) {
		const p = game.players[0];
		for (let i = 0; i < count; i++) {
			const angle = -Math.PI / 2 + (i - (count - 1) / 2) * 0.5 + (Math.random() - 0.5) * 0.3;
			game.spawnEnemy(kind, p.x + Math.cos(angle) * 360, p.y + Math.sin(angle) * 220 - 40);
		}
	}

	function clearEnemies() {
		const all = game.dummies;
		for (let i = all.length - 1; i >= 0; i--) if (isEnemy(all[i])) all.splice(i, 1);
	}

	let readout = $state('');
	onMount(() => {
		const id = setInterval(() => {
			const p = game.players[0];
			const enemies = game.dummies.filter(isEnemy);
			const states = enemies.map((e) => e.brain.state).join(', ');
			readout = `${p.def.name}: health ${Math.ceil(p.health)}/${p.maxHealth}${p.downed ? ' (DOWN)' : ''} · willpower ${Math.floor(p.willpower)} · enemies ${enemies.length}${states ? ` [${states}]` : ''}`;
		}, 150);
		return () => clearInterval(id);
	});
</script>

<div class="page">
	<div class="controls">
		<span class="group">
			{#each ['hal', 'john'] as const as id (id)}
				<button class:on={lantern === id} onclick={() => (lantern = id)}>{LANTERNS[id].name}</button>
			{/each}
		</span>
		<span class="group">
			{#each ['planet', 'space'] as const as env (env)}
				<button class:on={environment === env} onclick={() => (environment = env)}>{env}</button>
			{/each}
		</span>
		<label><input type="checkbox" bind:checked={godMode} /> God mode</label>
		<label><input type="checkbox" bind:checked={freeze} /> Freeze enemies</label>
		<label><input type="checkbox" bind:checked={infinite} /> Infinite willpower</label>
		<label><input type="checkbox" bind:checked={debug} /> Show AI states</label>
	</div>
	<div class="controls">
		{#each Object.values(ENEMIES) as def (def.kind)}
			{@const ready = READY.includes(def.kind)}
			<span class="spawn" title={def.description}>
				<button disabled={!ready} onclick={() => spawn(def.kind)}>+ {def.name}</button>
				<button disabled={!ready} onclick={() => spawn(def.kind, 3)}>×3</button>
				{#if !ready}<small>coming next</small>{/if}
			</span>
		{/each}
		<button onclick={clearEnemies}>Clear enemies</button>
	</div>
	<div class="controls readout">{readout}</div>
	<div class="stage">
		{#key game}
			<GameCanvas {game} showStats />
		{/key}
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
	.readout {
		padding-bottom: 0.5rem;
		font-family: ui-monospace, monospace;
		opacity: 0.8;
	}
	.group,
	.spawn {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}
	.spawn small {
		opacity: 0.5;
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
	button:disabled {
		opacity: 0.35;
		cursor: default;
	}
	button.on {
		background: var(--green);
		color: var(--bg);
		border-color: var(--green);
	}
	.stage {
		flex: 1;
		min-height: 0;
	}
</style>
