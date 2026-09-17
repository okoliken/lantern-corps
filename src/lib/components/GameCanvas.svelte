<script lang="ts">
	// Bridges Svelte and the engine: mounts a canvas, starts the loop, and
	// cleans everything up when the page is left. The game itself lives in
	// $lib/engine and doesn't know Svelte exists.
	import { onMount } from 'svelte';
	import { fitCanvas } from '$lib/engine/canvas';
	import { startLoop, type LoopStats } from '$lib/engine/loop';
	import type { Game } from '$lib/engine/game';

	interface Props {
		game: Game;
		/** Show fps / ups counters in the corner. */
		showStats?: boolean;
	}

	let { game, showStats = false }: Props = $props();

	let canvas: HTMLCanvasElement;
	let stats = $state<LoopStats>({ fps: 0, ups: 0 });

	onMount(() => {
		const { ctx, view, destroy } = fitCanvas(canvas);
		const stop = startLoop({
			update: (dt) => game.update(dt),
			render: () => game.render(ctx, view),
			onStats: (s) => (stats = s)
		});

		// Returning a function from onMount = cleanup on unmount.
		return () => {
			stop();
			destroy();
		};
	});
</script>

<div class="wrap">
	<canvas bind:this={canvas}></canvas>
	{#if showStats}
		<div class="stats">{stats.fps} fps · {stats.ups} ups</div>
	{/if}
</div>

<style>
	.wrap {
		position: relative;
		width: 100%;
		height: 100%;
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
	.stats {
		position: absolute;
		top: 8px;
		right: 10px;
		font: 12px ui-monospace, monospace;
		color: var(--green);
		opacity: 0.8;
		pointer-events: none;
	}
</style>
