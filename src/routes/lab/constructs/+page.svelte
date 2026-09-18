<script lang="ts">
	// Try every construct on the training dummies. Switch Lantern and
	// environment, and turn on infinite willpower to test freely.
	import { onMount, untrack } from 'svelte';
	import GameCanvas from '$lib/components/GameCanvas.svelte';
	import { CONSTRUCTS, LOADOUTS, constructLabel } from '$lib/engine/constructs/defs';
	import type { EnvironmentKind } from '$lib/engine/environment';
	import { Game } from '$lib/engine/game';
	import { LANTERNS, type LanternId } from '$lib/engine/lanterns';
	import { settings } from '$lib/settings.svelte';

	let lantern = $state<LanternId>('hal');
	let environment = $state<EnvironmentKind>('planet');
	let infinite = $state(true);
	let debug = $state(false);
	let surge = $state(true);

	const game = $derived(new Game({ players: [{ lantern, keys: 'solo' }], environment, settings: untrack(() => settings.snapshot()) }));

	$effect(() => {
		game.infiniteWillpower = infinite;
		game.infiniteSurge = surge;
		game.debug = debug;
	});

	// Live readout of the construct in hand
	let readout = $state('');
	onMount(() => {
		const id = setInterval(() => {
			const p = game.players[0];
			const def = p.loadout[p.selected];
			const cw = game.constructs;
			readout =
				`${constructLabel(def, environment === 'space').name} (${def.behavior}) · willpower ${Math.floor(p.willpower)}` +
				` · projectiles ${cw.projectiles.length} · traps ${cw.traps.length}` +
				` · walls ${game.map.obstacles.filter((o) => o.kind === 'wall').length}`;
		}, 100);
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
		<label><input type="checkbox" bind:checked={infinite} /> Infinite willpower</label>
		<label><input type="checkbox" bind:checked={surge} /> Signature always ready</label>
		<label><input type="checkbox" bind:checked={debug} /> Collision boxes</label>
	</div>
	<div class="controls keys">
		<span
			>Mouse aim · <kbd>Left click</kbd> ring shot · <kbd>Right click</kbd> construct · <kbd>Scroll</kbd>/<kbd>1</kbd>–<kbd>0</kbd> pick ·
			<kbd>Shift</kbd> shield · <kbd>R</kbd> signature · <kbd>Tab</kbd> lock</span
		>
		<span class="loadout">
			{#each LOADOUTS[lantern] as id, i (id)}
				<span><kbd>{(i + 1) % 10}</kbd> {constructLabel(CONSTRUCTS[id], environment === 'space').name}</span>
			{/each}
		</span>
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
		gap: 0.5rem 1.25rem;
		padding: 0.5rem 1rem 0;
		font-size: 0.85rem;
	}
	.readout {
		padding-bottom: 0.5rem;
		font-family: ui-monospace, monospace;
		opacity: 0.75;
	}
	.group,
	.loadout {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0.25rem 0.75rem;
	}
	.group {
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
	kbd {
		padding: 0.05rem 0.35rem;
		border: 1px solid var(--green-dim);
		border-radius: 4px;
		font-size: 0.75rem;
	}
	.stage {
		flex: 1;
		min-height: 0;
	}
</style>
