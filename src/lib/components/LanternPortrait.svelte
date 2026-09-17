<script lang="ts">
	// A small animated preview of a Lantern for menus. It reuses the engine's
	// drawLantern, so the menu always matches what you see in game.
	import { onMount } from 'svelte';
	import { HOVER_SPACE, drawLantern } from '$lib/engine/draw/lantern';
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
			// Hovering in space with the glow on, facing right.
			const scale = size / 90;
			const pose = { dir: 1, walkPhase: 0, altitude: 1, hoverHeight: HOVER_SPACE, lean: 0, glow: true, shadow: false, firing: false, aimX: 1, aimY: 0 } as const;
			drawLantern(ctx, def, size / 2, size * 0.88, pose, t, scale);
			raf = requestAnimationFrame(frame);
		};
		raf = requestAnimationFrame(frame);
		return () => cancelAnimationFrame(raf);
	});
</script>

<canvas bind:this={canvas} style:width="{size}px" style:height="{size}px"></canvas>
