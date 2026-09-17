<script lang="ts">
	// Both Lanterns at once, each on its own keys. This checks that input
	// sources really are separate from players, which co-op (M7) depends on.
	import { onMount } from 'svelte';
	import GameCanvas from '$lib/components/GameCanvas.svelte';
	import type { EnvironmentKind } from '$lib/engine/environment';
	import { Game } from '$lib/engine/game';

	let environment = $state<EnvironmentKind>('space');

	// A fresh Game whenever the environment changes.
	const game = $derived(
		new Game({
			players: [
				{ lantern: 'hal', keys: 'wasd' },
				{ lantern: 'john', keys: 'arrows' }
			],
			environment,
			showSlots: true
		})
	);

	// Live readout. Polling a few times a second is plenty for a debug panel,
	// and it keeps Svelte out of the 60-tick game loop.
	let rows = $state<{ name: string; speed: number; dir: string }[]>([]);
	onMount(() => {
		const id = setInterval(() => {
			rows = game.players.map((p) => ({
				name: `P${p.slot + 1} ${p.def.name}`,
				speed: Math.round(Math.hypot(p.vx, p.vy)),
				dir: p.dir === 1 ? '→' : '←'
			}));
		}, 100);
		return () => clearInterval(id);
	});
</script>

<div class="page">
	<div class="controls">
		<span class="envs">
			{#each ['space', 'planet'] as const as env (env)}
				<button class:on={environment === env} onclick={() => (environment = env)}>{env}</button>
			{/each}
		</span>
		<span><kbd>WASD</kbd> Hal</span>
		<span><kbd>Arrows</kbd> John</span>
		{#each rows as row (row.name)}
			<span class="readout">{row.name}: {row.speed} px/s · facing {row.dir}</span>
		{/each}
	</div>
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
		gap: 0.5rem 1.25rem;
		padding: 0.75rem 1rem;
		font-size: 0.85rem;
	}
	.readout {
		font-family: ui-monospace, monospace;
		opacity: 0.75;
	}
	.envs {
		display: inline-flex;
		gap: 0.25rem;
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
