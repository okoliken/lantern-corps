<script lang="ts">
	// Plays a story scene full screen: the scene draws the world on a canvas,
	// this shows who's talking. Click, Space or Enter to go on; Esc skips.
	import { onMount } from 'svelte';
	import { fitCanvas } from '$lib/engine/canvas';
	import type { DialogueScene } from '$lib/engine/scenes/scene';
	import { SPEAKERS, type Speaker } from '$lib/story/scenes';

	interface Props {
		scene: DialogueScene;
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
			// Clamp the step so a background tab doesn't jump the scene ahead, and
			// never go backwards: a frame's timestamp can sit a hair before the
			// performance.now() we started from, and a negative clock made the
			// scenes draw negative radii.
			scene.update(Math.max(0, Math.min(0.05, (now - last) / 1000)));
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
		padding: 22px 22px 16px;
		box-sizing: border-box;
		background: var(--toon-cream);
		border: 3px solid var(--ink);
		border-radius: 18px;
		box-shadow: 5px 6px 0 var(--ink);
	}
	/* The speaker's name on a tag over the bubble's edge, in their own colour */
	.name {
		position: absolute;
		top: -16px;
		left: 16px;
		padding: 1px 12px;
		border: 3px solid var(--ink);
		border-radius: 10px;
		background: var(--ink);
		font-family: var(--font-comic);
		font-size: 20px;
		letter-spacing: 0.06em;
		rotate: -2deg;
	}
	p {
		margin: 6px 0 0;
		font-size: 18px;
		font-weight: 600;
		line-height: 1.45;
		color: #22302a;
	}
	.next {
		position: absolute;
		right: 14px;
		bottom: 8px;
		color: var(--ink);
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
		padding: 4px 12px;
		font: inherit;
		font-size: 13px;
		font-weight: 800;
		color: var(--ink);
		background: var(--toon-cream);
		border: 3px solid var(--ink);
		border-radius: 10px;
		box-shadow: 2px 3px 0 var(--ink);
		cursor: pointer;
	}
	kbd {
		font-size: 11px;
		opacity: 0.7;
	}
</style>
