<script lang="ts">
	// The main menu's backdrop: Oa at night under the Corps' emblem, burning
	// in the middle of the sky. No figures. The game is about what the ring
	// asks of whoever wears it, so the ring is what you see.
	import { onMount } from 'svelte';
	import { green, greenCore } from '$lib/theme';

	let canvas: HTMLCanvasElement;

	const TAU = Math.PI * 2;

	function seeded(seed: number) {
		let s = seed;
		return () => (s = (s * 16807) % 2147483647) / 2147483647;
	}
	const rand = seeded(2814);
	/** Motes of green light drifting up. */
	const MOTES = Array.from({ length: 60 }, () => ({ x: rand(), y: rand(), speed: 0.02 + rand() * 0.05, size: 1 + rand() * 2.5, phase: rand() * TAU }));
	/** Clouds: [x, y, radius, drift speed] as fractions of the screen. */
	const CLOUDS = Array.from({ length: 14 }, () => [rand(), rand() * 0.45, 0.12 + rand() * 0.2, 0.004 + rand() * 0.008]);
	/** Oa's towers either side: [x, width, height] as fractions. */
	const TOWERS = [
		[0.02, 0.05, 0.62],
		[0.09, 0.03, 0.48],
		[0.14, 0.04, 0.4],
		[0.83, 0.04, 0.44],
		[0.89, 0.035, 0.52],
		[0.95, 0.05, 0.66]
	];

	/**
	 * The Corps' emblem: a ring of light with a bar across the top and the
	 * bottom, and a lantern's core burning through the middle of it.
	 */
	function drawEmblem(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, pulse: number) {
		ctx.save();
		ctx.lineCap = 'round';
		// The outer ring
		ctx.strokeStyle = greenCore(0.8);
		ctx.lineWidth = r * 0.14;
		ctx.shadowColor = green(0.9);
		ctx.shadowBlur = r * 0.45 * pulse;
		ctx.beginPath();
		ctx.arc(cx, cy, r, 0, TAU);
		ctx.stroke();
		// The bar above and the bar below
		const bar = r * 1.26;
		ctx.lineWidth = r * 0.26;
		for (const side of [-1, 1]) {
			ctx.beginPath();
			ctx.moveTo(cx - bar, cy + side * r * 0.66);
			ctx.lineTo(cx + bar, cy + side * r * 0.66);
			ctx.stroke();
		}
		// The core: what the ring is actually made of
		ctx.shadowBlur = r * 0.9 * pulse;
		const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.72);
		core.addColorStop(0, greenCore(0.95 * pulse));
		core.addColorStop(0.55, green(0.34));
		core.addColorStop(1, green(0));
		ctx.fillStyle = core;
		ctx.beginPath();
		ctx.arc(cx, cy, r * 0.72, 0, TAU);
		ctx.fill();
		ctx.restore();
	}

	function draw(ctx: CanvasRenderingContext2D, W: number, H: number, t: number) {
		// ---- Sky: a stormy blue-green night, lighter where the rings' light meets ----
		const sky = ctx.createLinearGradient(0, 0, 0, H);
		sky.addColorStop(0, '#0c1d26');
		sky.addColorStop(0.45, '#08141b');
		sky.addColorStop(1, '#020508');
		ctx.fillStyle = sky;
		ctx.fillRect(0, 0, W, H);
		const meet = { x: W / 2, y: H * 0.3 };
		const pulse = 0.85 + 0.15 * Math.sin(t * 1.3);
		// A soft green light above them
		const burst = ctx.createRadialGradient(meet.x, meet.y, 0, meet.x, meet.y, H * 0.45);
		burst.addColorStop(0, green(0.35 * pulse));
		burst.addColorStop(0.35, green(0.1));
		burst.addColorStop(1, green(0));
		ctx.fillStyle = burst;
		ctx.fillRect(0, 0, W, H);

		// Clouds drifting across
		for (const [cx, cy, r, speed] of CLOUDS) {
			const x = (((cx + t * speed) % 1.4) - 0.2) * W;
			const y = cy * H;
			const g = ctx.createRadialGradient(x, y, 0, x, y, r * W);
			g.addColorStop(0, 'rgba(120, 150, 165, 0.12)');
			g.addColorStop(1, 'rgba(120, 150, 165, 0)');
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.arc(x, y, r * W, 0, TAU);
			ctx.fill();
		}

		// Oa's towers, dark against the sky, a few lit windows
		for (const [tx, tw, th] of TOWERS) {
			const x = tx * W;
			const w = tw * W;
			const top = H * (1 - th);
			ctx.fillStyle = '#050c10';
			ctx.beginPath();
			ctx.moveTo(x, H);
			ctx.lineTo(x + w * 0.15, top + w * 0.6);
			ctx.lineTo(x + w * 0.5, top);
			ctx.lineTo(x + w * 0.85, top + w * 0.6);
			ctx.lineTo(x + w, H);
			ctx.closePath();
			ctx.fill();
			ctx.fillStyle = green(0.35);
			for (let i = 1; i < 5; i++) ctx.fillRect(x + w * 0.45, top + i * (H - top) * 0.12, Math.max(1.5, w * 0.08), 3);
		}

		// ---- The emblem, hanging in the middle of it ----
		const r = Math.min(W, H) * 0.115;
		const cx = W / 2;
		const cy = H * 0.3;

		// The light it throws
		ctx.save();
		ctx.globalCompositeOperation = 'lighter';
		const halo = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 3.4);
		halo.addColorStop(0, green(0.3 * pulse));
		halo.addColorStop(0.4, green(0.08));
		halo.addColorStop(1, green(0));
		ctx.fillStyle = halo;
		ctx.beginPath();
		ctx.arc(cx, cy, r * 3.4, 0, TAU);
		ctx.fill();
		ctx.restore();

		drawEmblem(ctx, cx, cy, r, pulse);

		// Motes of light drifting up
		for (const m of MOTES) {
			const y = (((m.y - t * m.speed) % 1) + 1) % 1;
			const x = m.x * W + Math.sin(t + m.phase) * 12;
			ctx.fillStyle = green(0.25 + 0.35 * Math.sin(t * 2 + m.phase) ** 2);
			ctx.beginPath();
			ctx.arc(x, y * H, m.size, 0, TAU);
			ctx.fill();
		}

		// Into the dark at the bottom, where the title and the buttons sit
		const fade = ctx.createLinearGradient(0, H * 0.52, 0, H);
		fade.addColorStop(0, 'rgba(2, 5, 8, 0)');
		fade.addColorStop(0.55, 'rgba(2, 5, 8, 0.72)');
		fade.addColorStop(1, 'rgba(2, 5, 8, 0.96)');
		ctx.fillStyle = fade;
		ctx.fillRect(0, H * 0.52, W, H * 0.48);
	}

	onMount(() => {
		const ctx = canvas.getContext('2d')!;
		let W = 0;
		let H = 0;
		const resize = () => {
			const dpr = Math.min(2, window.devicePixelRatio || 1);
			W = canvas.clientWidth;
			H = canvas.clientHeight;
			canvas.width = W * dpr;
			canvas.height = H * dpr;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		};
		resize();
		const observer = new ResizeObserver(resize);
		observer.observe(canvas);
		let raf = 0;
		const start = performance.now();
		const frame = (now: number) => {
			if (W > 0 && H > 0) draw(ctx, W, H, (now - start) / 1000);
			raf = requestAnimationFrame(frame);
		};
		raf = requestAnimationFrame(frame);
		return () => {
			cancelAnimationFrame(raf);
			observer.disconnect();
		};
	});
</script>

<canvas bind:this={canvas} aria-hidden="true"></canvas>

<style>
	canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
	}
</style>
