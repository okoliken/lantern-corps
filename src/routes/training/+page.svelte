<script lang="ts">
	// Kilowog's training on Oa: one thing at a time, before the first mission.
	// The steps' rules are in $lib/engine/missions/training.ts, the words in
	// $lib/story/training.ts.
	import { onMount, untrack } from 'svelte';
	import GameCanvas from '$lib/components/GameCanvas.svelte';
	import PauseMenu from '$lib/components/PauseMenu.svelte';
	import { SIGNATURES } from '$lib/engine/constructs/signature';
	import { Game } from '$lib/engine/game';
	import { buttonLabel, type Action } from '$lib/engine/input';
	import { wantsTouchControls } from '$lib/touch/phone';
	import { TRAINING_STEPS, Training, buildTrainingMap, type TrainingStep } from '$lib/engine/missions/training';
	import { settings } from '$lib/settings.svelte';
	import { TRAINING_TEXT } from '$lib/story/training';

	let { data } = $props();

	let round = $state(0);
	const setup = $derived.by(() => {
		void round; // Train again builds a fresh session
		const map = buildTrainingMap();
		const game = new Game({
			players: [{ lantern: data.lantern, keys: 'solo' }],
			map,
			settings: untrack(() => settings.snapshot())
		});
		const training = new Training(map);
		game.director = training;
		return { game, training };
	});

	let paused = $state(false);
	function setPaused(value: boolean) {
		paused = value;
		setup.game.paused = value;
		setup.game.buttons.clear();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.code !== 'Escape' || status.step === 'done') return;
		e.preventDefault();
		setPaused(!paused);
	}

	// Poll the training for the panel (the engine doesn't know about Svelte)
	let status = $state({ step: 'welcome' as TrainingStep, count: 0, need: 1, cheer: false });
	onMount(() => {
		const id = setInterval(() => {
			const t = setup.training;
			status = { step: t.step, count: t.count, need: t.need, cheer: t.cheer > 0 };
			if (t.finished && !settings.current.trained) {
				settings.set('trained', true);
				// Everything on the controls card was just taught
				settings.set('seenControls', true);
			}
		}, 100);
		return () => clearInterval(id);
	});

	const text = $derived(TRAINING_TEXT[status.step]);
	/** The steps shown in the progress row (not the welcome or the ending). */
	const shownSteps = TRAINING_STEPS.filter((s) => s !== 'welcome' && s !== 'done');
	const stepNumber = $derived(shownSteps.indexOf(status.step as (typeof shownSteps)[number]));

	/** On a phone: the on-screen buttons' names instead of keys. */
	const touch = wantsTouchControls(settings.current.touchControls);
	const TOUCH_LABELS: Record<string, string> = { move: 'left thumb', fly: '△ Fly', shot: '□ Shot', construct: '✕ Construct', shield: '○ Shield', signature: '★', target: '◎' };

	/** Split "Press {fly} to take off" into text and keys. */
	function parts(how: string): { key: boolean; text: string }[] {
		const smartOff = status.step === 'construct' && !settings.current.smartRing;
		const source = smartOff ? '{construct} uses the selected construct (scroll or 1–0 to pick one). Make 3.' : touch ? (text.touchHow ?? how) : how;
		return source.split(/\{(\w+)\}/).map((piece, i) => ({ key: i % 2 === 1, text: i % 2 === 1 ? label(piece) : piece }));
	}

	function label(name: string): string {
		if (name === 'signatureName') return SIGNATURES[data.lantern].name;
		if (touch) return TOUCH_LABELS[name] ?? name;
		const bindings = settings.current.bindings.solo;
		if (name === 'move') return (['up', 'left', 'down', 'right'] as Action[]).map((a) => buttonLabel(bindings[a][0] ?? '?')).join(' ');
		return buttonLabel(bindings[name as Action]?.[0] ?? '?');
	}

	function trainAgain() {
		round++;
		paused = false;
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="screen">
	{#key setup}
		<GameCanvas game={setup.game} />
	{/key}

	<button class="pause" onclick={() => setPaused(true)} aria-label="Pause">❚❚ <kbd>Esc</kbd></button>

	{#if status.step !== 'done'}
		<section class="coach" class:cheer={status.cheer} aria-live="polite">
			<div class="who">
				<span class="name">Kilowog</span>
				{#if stepNumber >= 0}
					<span class="progress">
						{#each shownSteps as s, i (s)}
							<span class="dot" class:done={i < stepNumber || (i === stepNumber && status.cheer)} class:now={i === stepNumber} title={TRAINING_TEXT[s].title}></span>
						{/each}
					</span>
				{/if}
			</div>
			<p class="line">"{text.kilowog}"</p>
			<p class="how">
				{#if status.cheer}
					<strong class="nice">✓ Nice!</strong>
				{:else}
					{#each parts(text.how) as part, i (i)}
						{#if part.key}<kbd>{part.text}</kbd>{:else}{part.text}{/if}
					{/each}
					{#if status.need > 1}<span class="count">{status.count} / {status.need}</span>{/if}
				{/if}
			</p>
			{#if text.tip && !status.cheer}<p class="tip">{text.tip}</p>{/if}
		</section>
		<a class="skip" href="/missions">Skip training</a>
	{/if}

	{#if status.step === 'done'}
		<div class="end" role="dialog" aria-label="Training complete">
			<h2>Training complete</h2>
			<p class="line">"{text.kilowog}"</p>
			<p>You know it all now: move, fly, shoot, make constructs, shield, recharge, and your signature.</p>
			<div class="actions">
				<a class="primary" href="/mission/safe-passage">Mission 1: Safe Passage</a>
				<button onclick={trainAgain}>Train again</button>
				<a href="/">Main menu</a>
			</div>
		</div>
	{:else if paused}
		<PauseMenu
			game={setup.game}
			onResume={() => setPaused(false)}
			links={[
				{ href: '/missions', label: 'Skip training' },
				{ href: '/', label: 'Main menu' }
			]}
		/>
	{/if}
</div>

<style>
	/* The cartoon look the menus use: flat cards, ink outlines, hard shadows, comic lettering */
	.screen {
		position: fixed;
		inset: 0;
	}
	.pause {
		position: absolute;
		top: 8px;
		left: max(10px, env(safe-area-inset-left));
		font: inherit;
		font-weight: 800;
		font-size: 0.85rem;
		color: #fff;
		background: var(--toon-card);
		border: 3px solid var(--ink);
		border-radius: 0.7rem;
		padding: 0.25rem 0.65rem;
		box-shadow: 2px 3px 0 var(--ink);
		cursor: pointer;
	}
	.pause kbd {
		font-size: 0.7rem;
		opacity: 0.75;
	}
	/* Kilowog talks in a speech bubble */
	.coach {
		position: absolute;
		top: 12px;
		left: 50%;
		translate: -50% 0;
		width: min(40rem, calc(100% - 180px));
		box-sizing: border-box;
		padding: 0.8rem 1.1rem 0.9rem;
		border-radius: 1.1rem 1.1rem 1.1rem 0.3rem;
		background: var(--toon-cream);
		color: #22302a;
		border: 3px solid var(--ink);
		box-shadow: 4px 5px 0 var(--ink);
		pointer-events: none;
		transition: background 0.2s;
	}
	.coach.cheer {
		background: #e3ffd9;
	}
	.who {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}
	.name {
		font-family: var(--font-comic);
		font-size: 1.3rem;
		letter-spacing: 0.06em;
		color: #b5434e;
	}
	.progress {
		display: flex;
		gap: 5px;
	}
	.dot {
		width: 11px;
		height: 11px;
		box-sizing: border-box;
		border-radius: 50%;
		border: 2px solid var(--ink);
		background: #fff;
	}
	.dot.now {
		background: var(--toon-gold);
	}
	.dot.done {
		background: var(--toon-btn);
	}
	.line {
		margin: 0.2rem 0 0.5rem;
		font-style: italic;
		font-weight: 600;
		line-height: 1.4;
	}
	.how {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 800;
		color: var(--ink);
		line-height: 1.6;
	}
	.how kbd {
		display: inline-block;
		margin: 0 0.15rem;
		padding: 0 0.45rem;
		font: inherit;
		font-size: 0.95rem;
		color: var(--ink);
		background: #fff;
		border: 2px solid var(--ink);
		border-radius: 0.45rem;
		box-shadow: 0 2px 0 var(--ink);
	}
	.count {
		margin-left: 0.6rem;
		color: #0b6b25;
		font-variant-numeric: tabular-nums;
	}
	.nice {
		font-family: var(--font-comic);
		font-weight: 400;
		font-size: 1.4rem;
		letter-spacing: 0.05em;
		color: #0b8a2e;
	}
	.tip {
		margin: 0.35rem 0 0;
		font-size: 0.82rem;
		font-weight: 600;
		color: #4c5f50;
	}
	.skip {
		position: absolute;
		top: 12px;
		right: 12px;
		padding: 0.2rem 0.7rem;
		border: 3px solid var(--ink);
		border-radius: 0.7rem;
		background: var(--toon-card);
		box-shadow: 2px 3px 0 var(--ink);
		color: #fff;
		font-size: 0.85rem;
		font-weight: 800;
		text-decoration: none;
	}
	.end {
		position: absolute;
		top: 50%;
		left: 50%;
		translate: -50% -50%;
		width: min(32rem, 92vw);
		box-sizing: border-box;
		padding: 1.5rem 1.75rem;
		border-radius: 1.3rem;
		text-align: center;
		background: var(--toon-card);
		border: 3px solid var(--ink);
		box-shadow: 6px 7px 0 var(--ink);
	}
	.end h2 {
		margin: 0 0 0.5rem;
		font-family: var(--font-comic);
		font-weight: 400;
		font-size: 2.8rem;
		line-height: 1;
		letter-spacing: 0.05em;
		color: var(--toon-light);
		-webkit-text-stroke: 2px var(--ink);
		paint-order: stroke fill;
		text-shadow: 3px 4px 0 var(--ink);
		rotate: -2deg;
	}
	.end p {
		line-height: 1.5;
		font-weight: 600;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: 0.9rem 1.25rem;
		margin-top: 1.25rem;
	}
	.actions a,
	.actions button {
		font: inherit;
		font-size: 0.9rem;
		font-weight: 800;
		text-decoration: none;
		color: var(--toon-light);
	}
	.actions button {
		color: #fff;
		background: var(--toon-well);
		border: 3px solid var(--ink);
		border-radius: 0.8rem;
		padding: 0.45rem 1rem;
		box-shadow: 0 4px 0 var(--ink);
		cursor: pointer;
	}
	.actions .primary {
		font-family: var(--font-comic);
		font-weight: 400;
		font-size: 1.4rem;
		letter-spacing: 0.06em;
		padding: 0.2rem 1.4rem;
		border: 3px solid var(--ink);
		border-radius: 0.9rem;
		background: var(--toon-btn);
		color: #fff;
		text-shadow: 2px 2px 0 var(--ink);
		box-shadow: 0 5px 0 var(--ink);
	}
	.actions .primary:hover {
		background: var(--toon-btn-hi);
	}

	/* A phone on its side: your bars take the top left, so Kilowog goes top right */
	@media (max-height: 520px) and (orientation: landscape) {
		.pause kbd {
			display: none;
		}
		.coach {
			top: 2.4rem;
			left: auto;
			right: max(10px, env(safe-area-inset-right));
			translate: none;
			width: min(24rem, 46vw);
			padding: 0.5rem 0.75rem 0.6rem;
		}
		/* What to do stays; Kilowog's own words don't fit above the buttons */
		.line {
			display: none;
		}
	}
</style>
