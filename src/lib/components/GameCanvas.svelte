<script lang="ts">
	// Bridges Svelte and the engine: mounts a canvas, starts the loop, and
	// cleans everything up when the page is left. The game itself lives in
	// $lib/engine and doesn't know Svelte exists.
	import { onMount } from 'svelte';
	import { fitCanvas } from '$lib/engine/canvas';
	import { preloadFonts } from '$lib/engine/draw/fonts';
	import { startLoop, type LoopStats } from '$lib/engine/loop';
	import type { Game } from '$lib/engine/game';
	import { Autopilot } from '$lib/engine/autopilot';
	import { BindingInput } from '$lib/engine/input';
	import { PadInput } from '$lib/engine/pad';
	import { padLink } from '$lib/pad/link';

	interface Props {
		game: Game;
		/** Show fps / ups counters in the corner. */
		showStats?: boolean;
	}

	let { game, showStats = false }: Props = $props();

	let canvas: HTMLCanvasElement;
	let stats = $state<LoopStats>({ fps: 0, ups: 0 });

	onMount(() => {
		void preloadFonts();
		const { ctx, view, destroy } = fitCanvas(canvas);
		game.setView(view);
		const detachButtons = game.buttons.attach(window, canvas);
		const detachPointer = game.pointer.attach(canvas);
		// The phone pad drives the first Lantern, alongside the keyboard
		const first = game.players[0];
		if (first && first.input instanceof BindingInput) first.input = new PadInput(first.input, padLink().state, () => game.players[0]);
		const stop = startLoop({
			update: (dt) => game.update(dt),
			render: (alpha) => game.render(ctx, alpha),
			onStats: (s) => {
				stats = s;
				// The pad shows this: a tab the browser has slowed down feels like lag
				padLink().fps = s.fps;
			}
		});
		// Dev only: poke the game from the browser console, and fast-forward it
		// (background and automated tabs barely run animation frames)
		if (import.meta.env.DEV) {
			(window as unknown as { lc: unknown }).lc = {
				game,
				step(seconds: number) {
					for (let i = 0; i < Math.round(seconds * 60); i++) game.update(1 / 60);
					game.render(ctx, 1);
				},
				// Let the computer play the first Lantern (for recording footage)
				autopilot() {
					const me = game.players[0];
					me.input = new Autopilot(game, me);
				}
			};
		}

		// Returning a function from onMount = cleanup on unmount.
		return () => {
			stop();
			detachButtons();
			detachPointer();
			destroy();
		};
	});
</script>

<div class="wrap">
	<!-- The game draws its own crosshair when someone aims with the mouse -->
	<canvas bind:this={canvas} class:no-cursor={game.usesMouse}></canvas>
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
	canvas.no-cursor {
		cursor: none;
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
