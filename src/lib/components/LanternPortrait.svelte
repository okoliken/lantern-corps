<script lang="ts">
	// A small animated preview of a Lantern for menus. It reuses the engine's
	// drawLantern, so the menu always matches what you see in game.
	import { onMount } from 'svelte';
	import { drawLantern } from '$lib/engine/draw/lantern';
	import type { LanternDef } from '$lib/engine/lanterns';

	interface Props {
		def: LanternDef;
		size?: number;
	}

	let { def, size = 150 }: Props = $props();
	let canvas: HTMLCanvasElement;

	onMount(() => {
		const ctx = canvas.getContext('2d')!;
		const dpr = window.devicePixelRatio || 1;
		canvas.width = size * dpr;
		canvas.height = size * dpr;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		let raf = 0;
		const start = performance.now();
		const frame = (now: number) => {
			const t = (now - start) / 1000;
			ctx.clearRect(0, 0, size, size);
			// Standing idle, facing right. Feet sit low so the figure is centred.
			const scale = size / 90;
			drawLantern(ctx, def, size / 2, size * 0.82, { dir: 1, walkPhase: 0 }, t, scale);
			raf = requestAnimationFrame(frame);
		};
		raf = requestAnimationFrame(frame);
		return () => cancelAnimationFrame(raf);
	});
</script>

<canvas bind:this={canvas} style:width="{size}px" style:height="{size}px"></canvas>
