<script lang="ts">
	// One lesson at Survival School. The rules are in engine/missions/school.ts.
	import { onMount, untrack } from 'svelte';
	import GameCanvas from '$lib/components/GameCanvas.svelte';
	import PauseMenu from '$lib/components/PauseMenu.svelte';
	import { Game } from '$lib/engine/game';
	import { School, TEACHERS, buildSchoolMap, type SchoolState } from '$lib/engine/missions/school';
		import { profiles } from '$lib/profiles.svelte';
	import { records } from '$lib/records.svelte';
	import { settings } from '$lib/settings.svelte';

	let { data } = $props();

	let round = $state(0);
	const setup = $derived.by(() => {
		void round; // Another go builds a fresh yard
		const map = buildSchoolMap(data.lesson);
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
		font-size: 0.8rem;
		font-weight: 800;
		color: #fff;
		background: var(--toon-card);
		border: 3px solid var(--ink);
		border-radius: 0.7rem;
		padding: 0.25rem 0.65rem;
		box-shadow: 2px 3px 0 var(--ink);
		cursor: pointer;
	}
	.hud {
		position: absolute;
		top: max(10px, env(safe-area-inset-top));
		right: max(10px, env(safe-area-inset-right));
		z-index: 3;
		width: min(22rem, 62vw);
		padding: 0.7rem 0.9rem;
		border: 3px solid var(--ink);
		border-radius: 0.9rem;
		background: color-mix(in srgb, var(--toon-card) 92%, transparent);
		box-shadow: 3px 4px 0 var(--ink);
		font-weight: 600;
	}
	.row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}
	.name {
		font-family: var(--font-comic);
		letter-spacing: 0.06em;
		color: var(--toon-light);
		font-size: 1.2rem;
		text-shadow: 1px 2px 0 var(--ink);
	}
	.clock {
		font-family: var(--font-comic);
		font-size: 1.5rem;
		letter-spacing: 0.04em;
		text-shadow: 1px 2px 0 var(--ink);
		font-variant-numeric: tabular-nums;
	}
	.clock.low {
		color: var(--toon-gold);
	}
	.objective {
		margin: 0.3rem 0 0;
		font-size: 0.88rem;
	}
	.tip,
	.best {
		margin: 0.35rem 0 0;
		font-size: 0.76rem;
		color: #a6d4b3;
	}
	.tip b {
		color: var(--toon-gold);
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
		background: rgba(2, 10, 6, 0.75);
	}
	.end h2 {
		margin: 0;
		font-family: var(--font-comic);
		font-weight: 400;
		font-size: 3rem;
		line-height: 1;
		letter-spacing: 0.05em;
		color: #ff8a6a;
		-webkit-text-stroke: 2px var(--ink);
		paint-order: stroke fill;
		text-shadow: 3px 4px 0 var(--ink);
		rotate: -2deg;
	}
	.end.passed h2 {
		color: var(--toon-light);
	}
	.figure {
		margin: 0.4rem 0 0;
		font-family: var(--font-comic);
		font-size: 4.2rem;
		line-height: 1;
		color: var(--toon-gold);
		-webkit-text-stroke: 2px var(--ink);
		paint-order: stroke fill;
		text-shadow: 3px 4px 0 var(--ink);
	}
	.figure small {
		font-size: 1.3rem;
		color: #fff;
		letter-spacing: 0.06em;
	}
	.line {
		margin: 0.6rem 0 1.2rem;
		max-width: 28rem;
		padding: 0.6rem 0.9rem;
		border: 3px solid var(--ink);
		border-radius: 1rem 1rem 1rem 0.3rem;
		background: var(--toon-cream);
		color: #22302a;
		font-weight: 600;
		box-shadow: 3px 4px 0 var(--ink);
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		justify-content: center;
	}
	.actions button {
		font-family: var(--font-comic);
		font-size: 1.6rem;
		letter-spacing: 0.08em;
		color: #fff;
		background: var(--toon-btn);
		border: 3px solid var(--ink);
		border-radius: 0.9rem;
		padding: 0.15rem 1.8rem;
		text-shadow: 2px 2px 0 var(--ink);
		box-shadow: 0 5px 0 var(--ink);
		cursor: pointer;
	}
	.actions button:hover {
		background: var(--toon-btn-hi);
	}
	.actions button:active {
		transform: translateY(4px);
		box-shadow: 0 1px 0 var(--ink);
	}
	.actions a {
		color: var(--toon-light);
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 800;
	}
	.actions a:hover {
		text-decoration: underline;
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
