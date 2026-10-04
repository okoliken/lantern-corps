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
	import { PadInput, PadState } from '$lib/engine/pad';
	import { padLink } from '$lib/pad/link';
	import { settings } from '$lib/settings.svelte';
	import TouchControls from '$lib/touch/TouchControls.svelte';
	import { wantsTouchControls } from '$lib/touch/phone';
	import { synth } from '$lib/sound.svelte';
	import { SoundDirector } from '$lib/engine/audio/soundDirector';
	import { BOSS_KINDS, Music, type Mood } from '$lib/engine/audio/music';
	import { isEnemy } from '$lib/engine/enemies/enemies';
	import { isStanding } from '$lib/engine/dummy';
	import { fighting } from '$lib/touch/fighting.svelte';

	interface Props {
		game: Game;
		/** Show fps / ups counters in the corner. */
		showStats?: boolean;
	}

	let { game, showStats = false }: Props = $props();

	let canvas = $state<HTMLCanvasElement>() as unknown as HTMLCanvasElement;
	let stats = $state<LoopStats>({ fps: 0, ups: 0 });
	/** Playing on this screen with the on-screen controls (a phone), and their state. */
	let touch = $state(false);
	const touchState = new PadState();

	// The volumes follow the settings (the pause menu changes them live)
	$effect(() => {
		synth.setVolumes(settings.current.sound, settings.current.music);
	});

	/** Boss music with a boss up, battle music with anyone to fight, the chords alone between fights, nothing while paused. */
	function moodOf(g: Game): Mood {
		if (g.paused) return 'quiet';
		let fighting = false;
		for (const d of g.dummies) {
			if (!isEnemy(d) || !isStanding(d)) continue;
			if (BOSS_KINDS.has(d.kind)) return 'boss';
			fighting = true;
		}
		return fighting ? 'battle' : 'calm';
	}

	onMount(() => {
		fighting.count++;
		const unfight = () => { fighting.count = Math.max(0, fighting.count - 1); };
		void preloadFonts();
		const sounds = new SoundDirector((name, volume) => synth.play(name, volume));
		const music = new Music(synth);
		const { ctx, view, destroy } = fitCanvas(canvas);
		game.setView(view);
		const detachButtons = game.buttons.attach(window, canvas);
		const detachPointer = game.pointer.attach(canvas);
		// On a phone: the on-screen controls drive the first Lantern. Otherwise the
		// phone pad does (paired from the pause menu), alongside the keyboard
		touch = wantsTouchControls(settings.current.touchControls);
		game.touch = touch;
		const first = game.players[0];
		if (first && first.input instanceof BindingInput) first.input = new PadInput(first.input, touch ? touchState : padLink().state, () => game.players[0]);
		const stop = startLoop({
			update: (dt) => game.update(dt),
			render: (alpha) => {
				game.render(ctx, alpha);
				sounds.observe(game);
				music.setMood(moodOf(game));
				music.tick();
			},
			onStats: (s) => {
				stats = s;
				// The pad shows this: a tab the browser has slowed down feels like lag
				if (!touch) padLink().fps = s.fps;
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
			unfight();
			music.setMood('quiet');
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
	{#if touch}
		<TouchControls {game} state={touchState} {canvas} />
	{/if}
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
