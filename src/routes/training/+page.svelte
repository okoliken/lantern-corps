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

	/** Split "Press {fly} to take off" into text and keys. */
	function parts(how: string): { key: boolean; text: string }[] {
		const smartOff = status.step === 'construct' && !settings.current.smartRing;
		const source = smartOff ? '{construct} uses the selected construct (scroll or 1–0 to pick one). Make 3.' : how;
		return source.split(/\{(\w+)\}/).map((piece, i) => ({ key: i % 2 === 1, text: i % 2 === 1 ? label(piece) : piece }));
	}

	function label(name: string): string {
		if (name === 'signatureName') return SIGNATURES[data.lantern].name;
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
		<div class="end">
			<h2>Training complete</h2>
			<p class="line">"{text.kilowog}"</p>
			<p>You know it all now: move, fly, shoot, make constructs, shield, recharge, and your signature.</p>
			<div class="actions">
				<a class="primary" href="/mission/safe-passage">Mission 1: Safe Passage</a>
				<a href="/spar?as={data.lantern}">Spar with Kilowog & Sinestro</a>
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
	.screen {
		position: fixed;
		inset: 0;
	}
	.pause {
		position: absolute;
		top: 8px;
		left: 10px;
		font: inherit;
		font-size: 0.85rem;
		color: var(--green);
		background: rgba(3, 6, 10, 0.6);
		border: 1px solid var(--suit-lit);
		border-radius: 6px;
		padding: 0.25rem 0.6rem;
		cursor: pointer;
		opacity: 0.85;
	}
	.pause kbd {
		font-size: 0.7rem;
		opacity: 0.7;
	}
	.coach {
		position: absolute;
		top: 12px;
		left: 50%;
		translate: -50% 0;
		width: min(40rem, calc(100% - 180px));
		box-sizing: border-box;
		padding: 0.8rem 1.1rem 0.9rem;
		border-radius: 12px;
		background: rgba(3, 10, 6, 0.88);
		border: 1px solid var(--suit-lit);
		box-shadow: 0 0 24px color-mix(in srgb, var(--green) 12%, transparent);
		pointer-events: none;
		transition: border-color 0.2s;
	}
	.coach.cheer {
		border-color: var(--suit-lit);
	}
	.who {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}
	.name {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 0.75rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #e0b4b8;
	}
	.progress {
		display: flex;
		gap: 5px;
	}
	.dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		border: 1px solid var(--suit-lit);
	}
	.dot.now {
		border-color: var(--suit-lit);
		box-shadow: 0 0 6px var(--green);
	}
	.dot.done {
		background: var(--suit);
		border-color: var(--suit-lit);
	}
	.line {
		margin: 0.35rem 0 0.5rem;
		font-style: italic;
		opacity: 0.85;
		line-height: 1.4;
	}
	.how {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 700;
		color: #e6fbec;
		line-height: 1.6;
	}
	.how kbd {
		display: inline-block;
		margin: 0 0.15rem;
		padding: 0 0.45rem;
		font: inherit;
		font-size: 0.95rem;
		color: var(--text);
		background: var(--suit);
		border-radius: 5px;
		box-shadow: 0 0 10px color-mix(in srgb, var(--green) 40%, transparent);
	}
	.count {
		margin-left: 0.6rem;
		color: var(--green);
		font-variant-numeric: tabular-nums;
	}
	.nice {
		color: var(--green);
		text-shadow: 0 0 12px var(--green);
	}
	.tip {
		margin: 0.35rem 0 0;
		font-size: 0.8rem;
		opacity: 0.65;
	}
	.skip {
		position: absolute;
		top: 12px;
		right: 12px;
		font-size: 0.85rem;
		text-decoration: none;
		opacity: 0.75;
	}
	.end {
		position: absolute;
		top: 50%;
		left: 50%;
		translate: -50% -50%;
		width: min(32rem, 92vw);
		box-sizing: border-box;
		padding: 1.5rem 1.75rem;
		border-radius: 12px;
		text-align: center;
		background: rgba(3, 10, 6, 0.92);
		border: 2px solid var(--suit-lit);
		box-shadow: 0 0 40px color-mix(in srgb, var(--green) 20%, transparent);
	}
	.end h2 {
		margin: 0 0 0.5rem;
		font-size: 1.6rem;
		text-transform: uppercase;
		color: var(--green);
		text-shadow: 0 0 16px var(--green);
	}
	.end p {
		line-height: 1.5;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: 0.75rem 1.25rem;
		margin-top: 1.25rem;
	}
	.actions a,
	.actions button {
		font: inherit;
		font-size: 0.9rem;
		text-decoration: none;
	}
	.actions button {
		color: var(--green);
		background: none;
		border: 1px solid var(--suit-lit);
		border-radius: 6px;
		padding: 0.45rem 1rem;
		cursor: pointer;
	}
	.primary {
		font-weight: 800;
		padding: 0.55rem 1.5rem;
		border-radius: 6px;
		background: var(--suit);
		color: var(--text);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
</style>
