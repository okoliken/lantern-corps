<script lang="ts">
	// Plays a story scene full screen: the scene draws the world on a canvas,
	// this shows who's talking. Click, Space or Enter to go on; Esc skips.
	import { onMount } from 'svelte';
	import { fitCanvas } from '$lib/engine/canvas';
	import type { OaLanding } from '$lib/engine/scenes/oaLanding';
	import { SPEAKERS, type Speaker } from '$lib/story/scenes';

	interface Props {
		scene: OaLanding;
		onDone: () => void;
	}

	let { scene, onDone }: Props = $props();

	let canvas: HTMLCanvasElement;
	// Mirrors of the scene for the dialogue box (the scene doesn't know Svelte)
	let who = $state<Speaker | null>(null);
	let text = $state('');
	let complete = $state(false);

	onMount(() => {
		const { ctx, view, destroy } = fitCanvas(canvas);
		let last = performance.now();
		let frame = requestAnimationFrame(function tick(now) {
			// Clamp the step so a background tab doesn't jump the scene ahead
			scene.update(Math.min(0.05, (now - last) / 1000));
			last = now;
			scene.draw(ctx, view);
			const line = scene.current;
			who = line ? (line.who as Speaker) : null;
			text = line ? line.text.slice(0, Math.floor(scene.shown)) : '';
			complete = scene.lineComplete;
			if (scene.done) onDone();
			else frame = requestAnimationFrame(tick);
		});
		return () => {
			cancelAnimationFrame(frame);
			destroy();
		};
	});

	function onKeydown(e: KeyboardEvent) {
		if (e.code === 'Escape') {
			e.preventDefault();
			scene.skip();
		} else if (e.code === 'Space' || e.code === 'Enter') {
			e.preventDefault();
			scene.advance();
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (keys are handled on the window) -->
<div class="scene" onclick={() => scene.advance()}>
	<canvas bind:this={canvas}></canvas>
	{#if who}
		<div class="dialogue">
			<span class="name" style:color={SPEAKERS[who].color}>{SPEAKERS[who].name}</span>
			<p>{text}</p>
			{#if complete}<span class="next">▼</span>{/if}
		</div>
	{/if}
	<button
		class="skip"
		onclick={(e) => {
			e.stopPropagation();
			scene.skip();
		}}>Skip <kbd>Esc</kbd></button
	>
</div>

<style>
	.scene {
		position: absolute;
		inset: 0;
		z-index: 20;
		cursor: pointer;
		background: #000;
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
	.dialogue {
		position: absolute;
		left: 50%;
		bottom: 3vh;
		transform: translateX(-50%);
		width: min(760px, calc(100% - 32px));
		min-height: 96px;
		padding: 14px 20px 16px;
		background: rgba(3, 12, 8, 0.86);
		border: 1px solid rgba(61, 255, 110, 0.45);
		border-radius: 10px;
		box-shadow: 0 0 24px rgba(61, 255, 110, 0.15);
	}
	.name {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 13px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	p {
		margin: 6px 0 0;
		font-size: 18px;
		line-height: 1.45;
		color: #e6fbec;
	}
	.next {
		position: absolute;
		right: 14px;
		bottom: 8px;
		color: #3dff6e;
		font-size: 12px;
		animation: bob 0.9s ease-in-out infinite;
	}
	@keyframes bob {
		50% {
			transform: translateY(3px);
		}
	}
	.skip {
		position: absolute;
		top: calc(8vh + 12px);
		right: 16px;
		padding: 6px 12px;
		font: inherit;
		font-size: 13px;
		color: #cfeedd;
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid rgba(61, 255, 110, 0.35);
		border-radius: 6px;
		cursor: pointer;
	}
	kbd {
		font-size: 11px;
		opacity: 0.7;
	}
</style>
