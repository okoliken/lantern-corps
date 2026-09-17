<script lang="ts">
	// Both Lanterns at once, each on its own keys. This checks that input
	// sources really are separate from players, which co-op (M7) depends on.
	import { onMount } from 'svelte';
	import GameCanvas from '$lib/components/GameCanvas.svelte';
	import { Game } from '$lib/engine/game';

	const game = new Game({
		players: [
			{ lantern: 'hal', keys: 'wasd' },
			{ lantern: 'john', keys: 'arrows' }
		],
		showSlots: true
	});

	// Live readout. Polling a few times a second is plenty for a debug panel,
	// and it keeps Svelte out of the 60-tick game loop.
	let rows = $state<{ name: string; speed: number; facing: number }[]>([]);
	onMount(() => {
		const id = setInterval(() => {
			rows = game.players.map((p) => ({
				name: `P${p.slot + 1} ${p.def.name}`,
				speed: Math.round(Math.hypot(p.vx, p.vy)),
				facing: Math.round((p.facing * 180) / Math.PI)
			}));
		}, 100);
		return () => clearInterval(id);
	});
</script>

<div class="page">
	<div class="controls">
		<span><kbd>WASD</kbd> Hal</span>
		<span><kbd>Arrows</kbd> John</span>
		{#each rows as row (row.name)}
			<span class="readout">{row.name}: {row.speed} px/s · {row.facing}°</span>
		{/each}
	</div>
	<div class="stage">
		<GameCanvas {game} showStats />
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
