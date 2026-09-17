<script lang="ts">
	// A short gameplay trailer that plays itself, for recording: a title card,
	// Hal alone against five Red Lanterns in Coast City, then Hal and John
	// together in deep space, then an end card. Framed 16:9.
	//
	// Keys: Space/click starts · R replays · U toggles the HUD.
	import { onMount, untrack } from 'svelte';
	import GameCanvas from '$lib/components/GameCanvas.svelte';
	import { Game } from '$lib/engine/game';
	import { SceneDirector, TRAILER } from '$lib/engine/scenes';

	/** Seconds the game's title shows at the very start. */
	const TITLE_TIME = 2.4;
	/** Seconds of fade to black at the end of each scene. */
	const FADE = 0.6;

	let started = $state(false);
	let index = $state(0);
	let finished = $state(false);
	let hud = $state(true);
	let take = $state(0);

	const scene = $derived.by(() => {
		void take; // replay builds everything fresh
		const spec = TRAILER[index];
		const director = new SceneDirector(spec);
		const game = new Game({
			players: spec.lanterns.map((lantern, i) => ({ lantern, keys: i === 0 ? 'solo' : 'p2', ai: true })),
			environment: spec.environment
		});
		game.dummies.length = 0;
		game.showcase = true;
		game.frameEnemies = true;
		game.nameTags = false;
		game.director = director;
		game.paused = untrack(() => !started);
		return { spec, director, game };
	});

	// Dev only: lets the current scene be inspected (and fast-forwarded) from the console
	$effect(() => {
		if (import.meta.env.DEV) (window as unknown as { trailer: unknown }).trailer = scene;
	});

	$effect(() => {
		scene.game.hud = hud;
		scene.game.paused = !started;
	});

	// What's on screen over the game
	let card = $state<'title' | 'scene' | 'none'>('title');
	let fading = $state(false);

	onMount(() => {
		const id = setInterval(() => {
			const { director } = scene;
			if (!started) return;
			if (director.done) {
				if (index < TRAILER.length - 1) index++;
				else finished = true;
				return;
			}
			const intro = director.phase === 'intro';
			card = intro && index === 0 && director.elapsed < TITLE_TIME ? 'title' : intro ? 'scene' : 'none';
			fading = director.phase === 'outro' && director.timer < FADE && index < TRAILER.length - 1;
		}, 50);

		const onKey = (e: KeyboardEvent) => {
			if (e.code === 'Space' && !started) start();
			if (e.code === 'KeyR') replay();
			if (e.code === 'KeyU') hud = !hud;
		};
		window.addEventListener('keydown', onKey);
		return () => {
			clearInterval(id);
			window.removeEventListener('keydown', onKey);
		};
	});

	function start() {
		started = true;
	}

	function replay() {
		finished = false;
		fading = false;
		card = 'title';
		index = 0;
		take++;
		started = true;
	}
</script>

<div class="screen">
	<div class="frame">
		{#key scene}
			<div class="scene-in">
				<GameCanvas game={scene.game} />
			</div>
		{/key}

		{#if card === 'title' && started}
			<div class="title-card">
				<h1>Lantern Corps</h1>
				<p>Red Frontier · gameplay preview</p>
			</div>
		{:else if card === 'scene' && started}
			{#key index}
				<div class="scene-card">
					<small>{scene.spec.environment === 'space' ? 'Deep space' : 'On the ground'}</small>
					<h2>{scene.spec.title}</h2>
					<p>{scene.spec.subtitle}</p>
				</div>
			{/key}
		{/if}

		<div class="fade" class:on={fading}></div>

		{#if finished}
			<div class="end-card">
				<h1>Lantern Corps</h1>
				<p>A Green Lantern fan game · in development</p>
				<small>R to replay</small>
			</div>
		{/if}

		{#if !started}
			<button class="start" onclick={start}>
				<span>▶ Play trailer</span>
				<small>Space to start · R replay · U toggle HUD</small>
			</button>
		{/if}
	</div>
</div>

<style>
	.screen {
		position: fixed;
		inset: 0;
		background: #000;
		display: grid;
		place-items: center;
	}
	/* 16:9, as big as the window allows */
	.frame {
		position: relative;
		width: min(100vw, calc(100vh * 16 / 9));
		aspect-ratio: 16 / 9;
		overflow: hidden;
		cursor: none;
	}
	.scene-in {
		position: absolute;
		inset: 0;
		animation: fade-in 0.8s ease-out;
	}
	.fade {
		position: absolute;
		inset: 0;
		background: #000;
		opacity: 0;
		transition: opacity 0.6s ease-in;
		pointer-events: none;
	}
	.fade.on {
		opacity: 1;
	}

	.title-card,
	.end-card {
		position: absolute;
		inset: 0;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 0.4rem;
		background: radial-gradient(ellipse at center, rgba(0, 20, 8, 0.55), rgba(0, 0, 0, 0.8));
		animation: fade-in 0.6s ease-out;
		pointer-events: none;
	}
	h1 {
		margin: 0;
		font-size: clamp(2.5rem, 7vw, 6rem);
		font-weight: 900;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #eafff0;
		text-shadow:
			0 0 18px #3dff6e,
			0 0 42px rgba(61, 255, 110, 0.6);
		animation: title-in 1.2s ease-out;
	}
	.title-card p,
	.end-card p {
		margin: 0;
		font-size: clamp(0.9rem, 1.8vw, 1.4rem);
		letter-spacing: 0.3em;
		text-transform: uppercase;
		color: #ff6a6a;
		text-shadow: 0 0 12px rgba(255, 42, 42, 0.8);
	}
	.end-card small {
		margin-top: 1.5rem;
		color: rgba(234, 255, 240, 0.35);
		letter-spacing: 0.2em;
	}

	/* Lower-third location card */
	.scene-card {
		position: absolute;
		left: 5%;
		bottom: 22%;
		padding: 0.6rem 1.4rem 0.7rem 1.1rem;
		border-left: 4px solid #3dff6e;
		background: linear-gradient(90deg, rgba(0, 0, 0, 0.75), rgba(0, 0, 0, 0));
		animation: slide-in 0.7s ease-out;
		pointer-events: none;
	}
	.scene-card small {
		color: #3dff6e;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		font-size: clamp(0.6rem, 1vw, 0.85rem);
	}
	.scene-card h2 {
		margin: 0.1rem 0;
		font-size: clamp(1.6rem, 4vw, 3.2rem);
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #eafff0;
	}
	.scene-card p {
		margin: 0;
		color: #ffb0b0;
		font-size: clamp(0.8rem, 1.5vw, 1.2rem);
	}

	.start {
		position: absolute;
		inset: 0;
		display: grid;
		place-content: center;
		gap: 0.6rem;
		background: rgba(0, 0, 0, 0.6);
		border: 0;
		color: #eafff0;
		font: inherit;
		cursor: pointer;
	}
	.start span {
		font-size: 2rem;
		font-weight: 800;
		text-shadow: 0 0 16px #3dff6e;
	}
	.start small {
		opacity: 0.6;
	}

	@keyframes fade-in {
		from {
			opacity: 0;
		}
	}
	@keyframes title-in {
		from {
			opacity: 0;
			letter-spacing: 0.5em;
		}
	}
	@keyframes slide-in {
		from {
			opacity: 0;
			transform: translateX(-30px);
		}
	}
</style>
