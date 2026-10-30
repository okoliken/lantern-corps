<script lang="ts">
	// A live demo of one construct: the Lantern using it on training dummies, on
	// a loop (engine/demo.ts). The bar along the bottom shows where in the loop it is.
	import { onMount } from 'svelte';
	import { fitCanvas } from '$lib/engine/canvas';
	import { startLoop } from '$lib/engine/loop';
	import { ConstructDemo, type DemoSubject } from '$lib/engine/demo';
	import type { LanternId } from '$lib/engine/lanterns';

	interface Props {
		lantern: LanternId;
		subject: DemoSubject;
	}
	let { lantern, subject }: Props = $props();

	let canvas: HTMLCanvasElement;
	let progress = $state(0);
	let demo: ConstructDemo | null = null;
	let view: { width: number; height: number } | null = null;

	// A new subject starts a new demo from the top
	$effect(() => {
		const next = new ConstructDemo(lantern, subject);
		if (view) next.view = view;
		demo = next;
	});

	onMount(() => {
		const fit = fitCanvas(canvas);
		view = fit.view;
		if (demo) demo.view = fit.view;
		const stop = startLoop({
			update: (dt) => {
				if (!demo) return;
				demo.view = fit.view;
				demo.game.setView(fit.view);
				demo.update(dt);
			},
			render: () => {
				if (!demo) return;
				demo.game.render(fit.ctx, 1);
				progress = demo.time / demo.length;
			}
		});
		return () => {
			stop();
			fit.destroy();
		};
	});
</script>

<div class="stage">
	<canvas bind:this={canvas} aria-hidden="true"></canvas>
	<span class="loop" style:width="{progress * 100}%"></span>
</div>

<style>
	.stage {
		position: relative;
		aspect-ratio: 16 / 9;
		border-radius: 1rem;
		border: 3px solid var(--ink);
		overflow: hidden;
		background: #0b1a12;
		box-shadow: 4px 5px 0 var(--ink);
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
	.loop {
		position: absolute;
		left: 0;
		bottom: 0;
		height: 4px;
		background: var(--gold, #ffd84a);
		opacity: 0.8;
	}
</style>
