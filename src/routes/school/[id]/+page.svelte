<script lang="ts">
	// One lesson at Survival School. The rules are in engine/missions/school.ts.
	import { onMount, untrack } from 'svelte';
	import GameCanvas from '$lib/components/GameCanvas.svelte';
	import PauseMenu from '$lib/components/PauseMenu.svelte';
	import { Game } from '$lib/engine/game';
	import { School, TEACHERS, type SchoolState } from '$lib/engine/missions/school';
	import { buildTrainingMap } from '$lib/engine/missions/training';
	import { profiles } from '$lib/profiles.svelte';
	import { records } from '$lib/records.svelte';
	import { settings } from '$lib/settings.svelte';

	let { data } = $props();

	let round = $state(0);
	const setup = $derived.by(() => {
		void round; // Another go builds a fresh yard
		const map = buildTrainingMap();
		const game = new Game({
			players: [{ lantern: data.lantern, keys: 'solo' }],
			map,
			settings: untrack(() => settings.snapshot()),
			profiles: untrack(() => profiles.snapshot())
		});
		const school = new School(data.lesson, map);
		game.director = school;
		return { game, school };
	});

	let paused = $state(false);
	function setPaused(value: boolean) {
		paused = value;
		setup.game.paused = value;
		setup.game.buttons.clear();
	}

	let status = $state({ state: 'intro' as SchoolState, score: 0, clock: 0, objective: '', passed: false });
	const over = $derived(status.state === 'over');
	let beat = $state(false);
	let kept = false;
	const key = $derived(`school:${data.lesson.id}`);

	function onKeydown(e: KeyboardEvent) {
		if (e.code !== 'Escape' || over) return;
		e.preventDefault();
		setPaused(!paused);
	}

	onMount(() => {
		const id = setInterval(() => {
			const s = setup.school;
			status = { state: s.state, score: s.score, clock: s.clock, objective: s.objective, passed: s.passed };
			if (s.state === 'over' && !kept) {
				kept = true;
				beat = records.submit(key, s.score);
			}
		}, 100);
		return () => clearInterval(id);
	});

	function again() {
		round++;
		kept = false;
		beat = false;
		paused = false;
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="screen">
	{#key setup}
		<GameCanvas game={setup.game} />
	{/key}

	<button class="pause" onclick={() => setPaused(true)} aria-label="Pause">❚❚ <kbd>Esc</kbd></button>

	{#if !over}
		<section class="hud">
			<div class="row">
				<span class="name">{data.lesson.name}</span>
				<span class="clock" class:low={status.clock < 10}>{Math.ceil(status.clock)}s</span>
			</div>
			<p class="objective">{status.objective}</p>
			{#if status.state === 'intro'}
				<p class="tip"><b>{TEACHERS[data.lesson.teacher].name}:</b> {data.lesson.brief}</p>
			{/if}
			<p class="best">Pass at {data.lesson.pass} · best {records.best(key)} {data.lesson.unit}</p>
		</section>
	{:else}
		<div class="end" role="dialog" aria-label="Result" class:passed={status.passed}>
			<h2>{status.passed ? 'Passed' : 'Not yet'}</h2>
			<p class="figure">{status.score} <small>{data.lesson.unit}</small></p>
			<p class="line">
				{#if status.passed && beat}
					Better than you have ever done it, and past the mark. {TEACHERS[data.lesson.teacher].name} has nothing to add.
				{:else if status.passed}
					Past the mark. Best so far is {records.best(key)}.
				{:else}
					{data.lesson.pass} is the mark. You got {status.score}. Again.
				{/if}
			</p>
			<div class="actions">
				<button class="primary" onclick={again}>Again</button>
				<a href="/school">Survival School</a>
				<a href="/">Main menu</a>
			</div>
		</div>
	{/if}

	{#if paused && !over}
		<PauseMenu
			game={setup.game}
			onResume={() => setPaused(false)}
			where={`${TEACHERS[data.lesson.teacher].name} · ${data.lesson.name}`}
			links={[
				{ href: '/school', label: '← Survival School' },
				{ href: '/', label: 'Main menu' }
			]}
		/>
	{/if}
</div>

<style>
	.screen {
		position: fixed;
		inset: 0;
		background: #05070a;
	}
	.pause {
		position: absolute;
		top: max(10px, env(safe-area-inset-top));
		left: max(10px, env(safe-area-inset-left));
		z-index: 4;
		font: inherit;
		font-size: 0.78rem;
		color: var(--text);
		background: rgba(4, 14, 10, 0.75);
		border: 1px solid var(--suit-lit);
		border-radius: 6px;
		padding: 0.3rem 0.6rem;
		cursor: pointer;
	}
	.hud {
		position: absolute;
		top: max(10px, env(safe-area-inset-top));
		right: max(10px, env(safe-area-inset-right));
		z-index: 3;
		width: min(22rem, 62vw);
		padding: 0.7rem 0.9rem;
		border: 1px solid color-mix(in srgb, var(--suit-lit) 60%, transparent);
		border-radius: 6px;
		background: rgba(4, 14, 10, 0.78);
	}
	.row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}
	.name {
		font-family: var(--font-display);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--green);
		font-size: 0.85rem;
	}
	.clock {
		font-family: var(--font-display);
		font-size: 1.1rem;
		font-variant-numeric: tabular-nums;
	}
	.clock.low {
		color: #ffb45c;
	}
	.objective {
		margin: 0.3rem 0 0;
		font-size: 0.88rem;
	}
	.tip,
	.best {
		margin: 0.35rem 0 0;
		font-size: 0.74rem;
		opacity: 0.68;
	}
	.tip b {
		color: var(--green);
	}
	.end {
		position: absolute;
		inset: 0;
		z-index: 5;
		display: grid;
		align-content: center;
		justify-items: center;
		gap: 0.3rem;
		text-align: center;
		background: rgba(2, 6, 4, 0.88);
	}
	.end h2 {
		margin: 0;
		font-size: 2rem;
		color: #c96f5a;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}
	.end.passed h2 {
		color: var(--green);
	}
	.figure {
		margin: 0;
		font-family: var(--font-display);
		font-size: 3.2rem;
		line-height: 1;
	}
	.figure small {
		font-size: 0.9rem;
		opacity: 0.6;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.line {
		margin: 0.4rem 0 1.2rem;
		opacity: 0.75;
		max-width: 28rem;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		justify-content: center;
	}
	.actions button {
		font: inherit;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text);
		background: var(--suit);
		border: 1px solid var(--suit-lit);
		border-radius: 6px;
		padding: 0.55rem 1.6rem;
		cursor: pointer;
	}
	.actions button:hover {
		border-color: var(--green);
	}
	.actions a {
		color: color-mix(in srgb, var(--text) 80%, transparent);
		text-decoration: none;
		font-size: 0.85rem;
	}
	.actions a:hover {
		color: var(--green);
	}
	@media (max-height: 560px) {
		.hud {
			width: min(17rem, 54vw);
			padding: 0.5rem 0.6rem;
		}
		.objective {
			font-size: 0.78rem;
		}
		.end h2 {
			font-size: 1.5rem;
		}
		.figure {
			font-size: 2.3rem;
		}
	}
</style>
