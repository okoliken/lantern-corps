<script lang="ts">
	// The main menu's backdrop, like a movie poster: Kilowog, Hal and John
	// standing together on Oa, rings raised, their light meeting in the sky.
	// Drawn with the game's own drawLantern, so it always matches the game.
	import { onMount } from 'svelte';
	import type { LanternPose } from '$lib/engine/animation';
	import { drawLantern, ringPosition } from '$lib/engine/draw/lantern';
	import { LANTERNS, type CrewId } from '$lib/engine/lanterns';
	import { green, greenCore } from '$lib/theme';

	let canvas: HTMLCanvasElement;

	const TAU = Math.PI * 2;

	/** Who stands where: across from the middle (-1..1) and how far back (smaller, darker). All face the same way. */
	const LINEUP: { id: CrewId; across: number; back: number; dir: 1 | -1 }[] = [
		{ id: 'kilowog', across: -1, back: 0.9, dir: 1 },
		{ id: 'john', across: 1, back: 0.9, dir: 1 },
		{ id: 'hal', across: 0, back: 1, dir: 1 }
	];

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

	function pose(dir: 1 | -1, id: CrewId, time: number): LanternPose {
		const def = LANTERNS[id];
		return {
			dir,
			walkPhase: 0,
			altitude: 0,
			hoverHeight: 0,
			lean: 0,
			glow: true,
			shadow: false,
			// Ring arm straight up, a little behind the head so the face shows
			firing: true,
			aimX: -dir * 0.32,
			aimY: -1,
			cast: 0,
			build: def.build,
			hunch: def.hunch
		};
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

		// ---- The platform they stand on ----
		const size = Math.min(H / 420, W / 300);
		const gap = size * 44;
		const floor = H * 0.68;
		const deck = ctx.createRadialGradient(W / 2, floor, 0, W / 2, floor, gap * 2.2);
		deck.addColorStop(0, green(0.22 * pulse));
		deck.addColorStop(0.5, green(0.06));
		deck.addColorStop(1, green(0));
		ctx.fillStyle = deck;
		ctx.beginPath();
		ctx.ellipse(W / 2, floor, gap * 2.2, gap * 0.45, 0, 0, TAU);
		ctx.fill();
		ctx.strokeStyle = green(0.35);
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.ellipse(W / 2, floor, gap * 1.8, gap * 0.34, 0, 0, TAU);
		ctx.stroke();

		// ---- The three of them, head to toe ----
		const beams: [number, number, number][] = [];
		for (const { id, across, back, dir } of LINEUP) {
			const def = LANTERNS[id];
			const scale = size * back * (id === 'kilowog' ? 0.92 : 1);
			const x = W / 2 + across * gap;
			// Standing on the platform; the ones behind a little further back
			const y = floor - (1 - back) * gap * 0.5;
			const p = pose(dir, id, t);
			ctx.save();
			if (back < 1) ctx.filter = 'brightness(0.72) saturate(0.9)';
			drawLantern(ctx, def, x, y, p, t, scale);
			ctx.restore();
			const [rx, ry] = ringPosition(x, y, p, t, scale);
			beams.push([rx, ry, back]);
		}

		// Their light, rising from each ring to meet above them
		ctx.save();
		ctx.globalCompositeOperation = 'lighter';
		for (const [rx, ry, back] of beams) {
			const beam = ctx.createLinearGradient(rx, ry, meet.x, meet.y);
			beam.addColorStop(0, greenCore(0.7 * back * pulse));
			beam.addColorStop(0.2, green(0.35 * back));
			beam.addColorStop(1, green(0.08));
			ctx.strokeStyle = beam;
			ctx.lineCap = 'round';
			for (const [width, alpha] of [
				[size * 3.2, 0.25],
				[size * 1.1, 0.8]
			]) {
				ctx.globalAlpha = alpha;
				ctx.lineWidth = width;
				ctx.beginPath();
				ctx.moveTo(rx, ry);
				ctx.lineTo(meet.x, meet.y);
				ctx.stroke();
			}
			// The ring itself, blazing
			ctx.globalAlpha = 1;
			const glow = ctx.createRadialGradient(rx, ry, 0, rx, ry, size * 7);
			glow.addColorStop(0, greenCore(0.9 * pulse));
			glow.addColorStop(0.25, green(0.45));
			glow.addColorStop(1, green(0));
			ctx.fillStyle = glow;
			ctx.beginPath();
			ctx.arc(rx, ry, size * 7, 0, TAU);
			ctx.fill();
		}
		ctx.restore();

		// Motes of light drifting up
		for (const m of MOTES) {
			const y = (((m.y - t * m.speed) % 1) + 1) % 1;
			const x = m.x * W + Math.sin(t + m.phase) * 12;
			ctx.fillStyle = green(0.25 + 0.35 * Math.sin(t * 2 + m.phase) ** 2);
			ctx.beginPath();
			ctx.arc(x, y * H, m.size, 0, TAU);
			ctx.fill();
		}

		// Into the dark at the bottom, where the title sits
		const fade = ctx.createLinearGradient(0, H * 0.74, 0, H);
		fade.addColorStop(0, 'rgba(2, 5, 8, 0)');
		fade.addColorStop(1, 'rgba(2, 5, 8, 0.9)');
		ctx.fillStyle = fade;
		ctx.fillRect(0, H * 0.74, W, H * 0.26);
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
