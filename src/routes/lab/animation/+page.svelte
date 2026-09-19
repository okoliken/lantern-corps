<script lang="ts">
	// Preview every Lantern animation up close, slowed down if you like, with
	// the skeleton drawn on top. Uses the same drawing code as the game.
	import { onMount } from 'svelte';
	import type { LanternPose } from '$lib/engine/animation';
	import { HOVER_PLANET, drawLantern, drawSkeletonDebug } from '$lib/engine/draw/lantern';
	import { LANTERNS, type LanternId } from '$lib/engine/lanterns';

	const STATES = ['idle', 'walk', 'take-off', 'hover', 'fly fast', 'shoot', 'cast', 'hurt', 'downed', 'victory'] as const;
	type AnimState = (typeof STATES)[number];

	let lantern = $state<LanternId>('hal');
	let anim = $state<AnimState>('idle');
	let facing = $state<1 | -1>(1);
	let speed = $state(1);
	let aimDeg = $state(0);
	let showBones = $state(false);
	let glow = $state(true);

	let canvas: HTMLCanvasElement;

	/** Build the pose for a state at time t (looping animations use t). */
	function poseAt(t: number): LanternPose {
		const aimRad = (aimDeg * Math.PI) / 180;
		const p: LanternPose = {
			dir: facing,
			walkPhase: 0,
			altitude: 0,
			hoverHeight: HOVER_PLANET,
			lean: 0,
			glow,
			shadow: true,
			firing: false,
			aimX: Math.cos(aimRad) * facing,
			aimY: Math.sin(aimRad)
		};
		const loop = (period: number) => (t % period) / period; // 0..1 repeating
		switch (anim) {
			case 'walk':
				p.walkPhase = 0.001 + t * 9;
				break;
			case 'take-off': {
				// Up, hold, down, hold
				const k = loop(3);
				p.altitude = k < 0.35 ? k / 0.35 : k < 0.5 ? 1 : k < 0.85 ? 1 - (k - 0.5) / 0.35 : 0;
				break;
			}
			case 'hover':
				p.altitude = 1;
				break;
			case 'fly fast':
				p.altitude = 1;
				p.lean = 1;
				break;
			case 'shoot':
				p.firing = true;
				p.shotKick = 1 - loop(0.22);
				break;
			case 'cast':
				p.firing = true;
				p.cast = Math.max(0, 1 - loop(1.2) * 2);
				break;
			case 'hurt':
				p.hurt = Math.max(0, 1 - loop(1) * 2.5);
				break;
			case 'downed':
				p.downed = true;
				break;
			case 'victory':
				p.victory = Math.min(1, loop(3) * 4);
				break;
		}
		return p;
	}

	onMount(() => {
		const ctx = canvas.getContext('2d')!;
		let raf = 0;
		let last = performance.now();
		let t = 0;
		const frame = (now: number) => {
			t += ((now - last) / 1000) * speed;
			last = now;
			const dpr = window.devicePixelRatio || 1;
			const rect = canvas.getBoundingClientRect();
			canvas.width = rect.width * dpr;
			canvas.height = rect.height * dpr;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

			ctx.fillStyle = '#1d2119';
			ctx.fillRect(0, 0, rect.width, rect.height);
			// Ground line
			const groundY = rect.height * 0.8;
			ctx.fillStyle = '#2d3325';
			ctx.fillRect(0, groundY, rect.width, rect.height - groundY);

			const scale = Math.min(rect.height / 90, rect.width / 60) * 0.55;
			const pose = poseAt(t);
			drawLantern(ctx, LANTERNS[lantern], rect.width / 2, groundY, pose, t, scale);
			if (showBones) drawSkeletonDebug(ctx, pose, rect.width / 2, groundY, t, scale);
			raf = requestAnimationFrame(frame);
		};
		raf = requestAnimationFrame(frame);
		return () => cancelAnimationFrame(raf);
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
			{#each STATES as s (s)}
				<button class:on={anim === s} onclick={() => (anim = s)}>{s}</button>
			{/each}
		</span>
	</div>
	<div class="controls">
		<button onclick={() => (facing = facing === 1 ? -1 : 1)}>Facing {facing === 1 ? '→' : '←'}</button>
		<label>Speed {speed.toFixed(2)}× <input type="range" min="0.1" max="2" step="0.05" bind:value={speed} /></label>
		<label>Aim {aimDeg}° <input type="range" min="-90" max="90" step="5" bind:value={aimDeg} /></label>
		<label><input type="checkbox" bind:checked={glow} /> Glow</label>
		<label><input type="checkbox" bind:checked={showBones} /> Show skeleton</label>
	</div>
	<canvas bind:this={canvas}></canvas>
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
		gap: 0.5rem 1rem;
		padding: 0.5rem 1rem 0;
		font-size: 0.85rem;
	}
	.controls:last-of-type {
		padding-bottom: 0.5rem;
	}
	.group {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}
	label {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}
	input[type='range'] {
		width: 7rem;
	}
	button {
		font: inherit;
		font-size: 0.8rem;
		text-transform: capitalize;
		padding: 0.15rem 0.6rem;
		color: var(--text);
		background: transparent;
		border: 1px solid var(--suit-lit);
		border-radius: 4px;
		cursor: pointer;
	}
	button.on {
		background: var(--suit-lit);
		color: var(--text);
		border-color: var(--green);
	}
	canvas {
		flex: 1;
		min-height: 0;
		width: 100%;
		display: block;
	}
</style>
