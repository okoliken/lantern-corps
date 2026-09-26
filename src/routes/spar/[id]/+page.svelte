<script lang="ts">
	// One sparring match, on Oa's training grounds. The rules are in
	// $lib/engine/missions/sparring.ts.
	import { onMount, untrack } from 'svelte';
	import GameCanvas from '$lib/components/GameCanvas.svelte';
	import PauseMenu from '$lib/components/PauseMenu.svelte';
	import { Game } from '$lib/engine/game';
	import { LANTERNS } from '$lib/engine/lanterns';
	import { Sparring, type SparState } from '$lib/engine/missions/sparring';
	import { buildSparringMap } from '$lib/engine/missions/sparring';
	import { profiles } from '$lib/profiles.svelte';
	import { records } from '$lib/records.svelte';
	import { settings } from '$lib/settings.svelte';

	let { data } = $props();

	// Hal vs. John: you fight whichever of the two you are not playing
	const kind = $derived(data.opponent.id === 'mirror' ? (data.lantern === 'hal' ? 'sparJohn' : 'sparHal') : data.opponent.kind!);
	const foeName = $derived(data.opponent.id === 'mirror' ? LANTERNS[data.lantern === 'hal' ? 'john' : 'hal'].name : data.opponent.name);

	let round = $state(0);
	const setup = $derived.by(() => {
		void round; // Rematch builds a fresh fight
		const map = buildSparringMap();
		const game = new Game({
			players: [{ lantern: data.lantern, keys: 'solo' }],
			map,
			settings: untrack(() => settings.snapshot()),
			profiles: untrack(() => profiles.snapshot())
		});
		const sparring = new Sparring(data.opponent, map, untrack(() => kind));
		game.director = sparring;
		return { game, sparring };
	});

	let paused = $state(false);
	function setPaused(value: boolean) {
		paused = value;
		setup.game.paused = value;
		setup.game.buttons.clear();
	}

	let status = $state({ state: 'intro' as SparState, health: 1, elapsed: 0 });
	const over = $derived(status.state === 'won' || status.state === 'lost');
	let beat = $state(false);
	let kept = false;
	const key = $derived(`spar:${data.opponent.id}:${data.lantern}`);

	function onKeydown(e: KeyboardEvent) {
		if (e.code !== 'Escape' || over) return;
		e.preventDefault();
		setPaused(!paused);
	}

	onMount(() => {
		const id = setInterval(() => {
			const s = setup.sparring;
			status = { state: s.state, health: s.health, elapsed: Math.round(s.elapsed) };
			if (s.state === 'won' && !kept) {
				kept = true;
				// A faster win is a better one, so the record is the lowest time
				const best = records.best(key);
				const time = Math.max(1, Math.round(s.elapsed));
				if (best === 0 || time < best) {
					records.submit(key, time, { lower: true });
					beat = true;
				}
			}
		}, 100);
		return () => clearInterval(id);
	});

	function rematch() {
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
		<section class="boss">
			<div class="row">
				<span class="name">{foeName}</span>
				<span class="sub">One on one · first down loses</span>
			</div>
			<span class="track"><span class="fill" style:width="{status.health * 100}%"></span></span>
			{#if status.state === 'intro'}
				<p class="tip">{data.opponent.tests}</p>
			{/if}
		</section>
	{:else}
		<div class="end" role="dialog" aria-label="Result" class:won={status.state === 'won'}>
			<h2>{status.state === 'won' ? `${foeName} yields` : 'Down you go'}</h2>
			<p class="line">{status.state === 'won' ? data.opponent.tests : data.opponent.over}</p>
			{#if status.state === 'won'}
				<p>{status.elapsed} seconds as {LANTERNS[data.lantern].name}.{#if beat}<b> New best.</b>{/if}</p>
			{/if}
			<div class="actions">
				<button class="primary" onclick={rematch}>{status.state === 'won' ? 'Again' : 'Rematch'}</button>
				<a href="/spar">Sparring</a>
				<a href="/">Main menu</a>
			</div>
		</div>
	{/if}

	{#if paused && !over}
		<PauseMenu
			game={setup.game}
			where="Sparring · {foeName}"
			onResume={() => setPaused(false)}
			links={[
				{ href: '/spar', label: '← Sparring' },
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
		top: 12px;
		left: 12px;
		z-index: 6;
		padding: 6px 12px;
		font: inherit;
		font-size: 13px;
		color: var(--text);
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid var(--suit-lit);
		border-radius: 6px;
		cursor: pointer;
	}
	kbd {
		font-size: 11px;
		opacity: 0.7;
	}
	.boss {
		position: absolute;
		top: 12px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 5;
		width: min(560px, calc(100% - 140px));
		padding: 10px 14px 12px;
		background: rgba(3, 12, 8, 0.82);
		border: 1px solid var(--suit-lit);
		border-radius: 10px;
	}
	.row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}
	.name {
		font-family: var(--font-display);
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #e6fbec;
	}
	.sub {
		font-size: 0.75rem;
		opacity: 0.65;
	}
	.track {
		display: block;
		height: 8px;
		margin-top: 6px;
		background: rgba(255, 255, 255, 0.12);
		border-radius: 999px;
		overflow: hidden;
	}
	.fill {
		display: block;
		height: 100%;
		background: var(--green);
		transition: width 0.2s linear;
	}
	.tip {
		margin: 8px 0 0;
		font-size: 0.85rem;
		line-height: 1.45;
		opacity: 0.8;
	}
	.end {
		position: absolute;
		inset: 0;
		z-index: 7;
		display: grid;
		align-content: center;
		justify-items: center;
		gap: 0.6rem;
		padding: 2rem;
		text-align: center;
		background: rgba(2, 8, 6, 0.88);
	}
	h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(1.6rem, 5vw, 2.6rem);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #ff8a7a;
	}
	.end.won h2 {
		color: var(--green);
	}
	.line {
		max-width: 44ch;
		margin: 0;
		line-height: 1.5;
		opacity: 0.85;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		justify-content: center;
		margin-top: 0.6rem;
	}
	.actions a,
	.actions button {
		padding: 0.55rem 1.2rem;
		font: inherit;
		color: var(--text);
		text-decoration: none;
		background: rgba(3, 12, 8, 0.6);
		border: 1px solid var(--suit-lit);
		border-radius: 8px;
		cursor: pointer;
	}
	.actions .primary {
		color: #05130b;
		font-weight: 700;
		background: var(--green);
		border-color: var(--green);
	}
</style>
