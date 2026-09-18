<script lang="ts">
	// Red Lantern Ambush: you against five Red Lanterns.
	//
	// /skirmish                    -> pick your Lantern and where to fight
	// /skirmish?as=hal&env=planet  -> the fight (Coast City); env=space for the asteroid field
	//
	// Three lives. Beat all five to win.
	import { onMount, untrack } from 'svelte';
	import { page } from '$app/state';
	import ControlsCard from '$lib/components/ControlsCard.svelte';
	import GameCanvas from '$lib/components/GameCanvas.svelte';
	import LanternPortrait from '$lib/components/LanternPortrait.svelte';
	import PauseMenu from '$lib/components/PauseMenu.svelte';
	import { isEnvironmentKind } from '$lib/engine/environment';
	import { Game } from '$lib/engine/game';
	import { LANTERNS, isLanternId } from '$lib/engine/lanterns';
	import { Skirmish, type SkirmishState } from '$lib/engine/skirmish';
	import { profiles } from '$lib/profiles.svelte';
	import { settings } from '$lib/settings.svelte';

	const as = $derived(page.url.searchParams.get('as'));
	const lantern = $derived(isLanternId(as) ? as : null);
	const envParam = $derived(page.url.searchParams.get('env'));
	const environment = $derived(isEnvironmentKind(envParam) ? envParam : 'planet');

	let round = $state(0);

	const setup = $derived.by(() => {
		void round; // "Play again" builds a fresh fight
		if (!lantern) return null;
		const game = new Game({
			players: [{ lantern, keys: 'solo' }],
			environment,
			settings: untrack(() => settings.snapshot()),
			profiles: untrack(() => profiles.snapshot()),
			onProgress: (id, profile) => profiles.update(id, profile)
		});
		game.dummies.length = 0; // no training dummies in a real fight
		const skirmish = new Skirmish();
		game.director = skirmish;
		return { game, skirmish };
	});

	let paused = $state(false);
	let showIntro = $state(!settings.current.seenControls);

	function setPaused(value: boolean) {
		paused = value;
		if (setup) {
			setup.game.paused = value;
			setup.game.buttons.clear();
		}
	}

	$effect(() => {
		if (setup) setPaused(showIntro);
	});

	function onKeydown(e: KeyboardEvent) {
		if (e.code !== 'Escape' || !setup || showIntro || status.state === 'won' || status.state === 'lost') return;
		e.preventDefault();
		setPaused(!paused);
	}

	function playAgain() {
		round++;
		paused = false;
	}

	// Poll the fight for the overlay (the engine doesn't know about Svelte)
	let status = $state<{ state: SkirmishState; timer: number; left: number; total: number; lives: number; time: number }>({
		state: 'intro',
		timer: 3,
		left: 5,
		total: 5,
		lives: 3,
		time: 0
	});
	onMount(() => {
		const id = setInterval(() => {
			if (!setup) return;
			const s = setup.skirmish;
			status = { state: s.state, timer: Math.ceil(s.timer), left: s.left, total: s.total, lives: s.lives, time: s.elapsed };
		}, 120);
		return () => clearInterval(id);
	});

	const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
</script>

<svelte:window onkeydown={onKeydown} />

{#if lantern && setup}
	<div class="screen">
		{#key setup}
			<GameCanvas game={setup.game} />
		{/key}

		<header class="bar">
			<button class="pause" onclick={() => setPaused(true)} aria-label="Pause">❚❚ <kbd>Esc</kbd></button>
			<div class="status">
				<span class="title">Red Lantern Ambush</span>
				<span class="left">
					{#each { length: status.total } as _, i (i)}
						<span class="pip" class:down={i >= status.left}></span>
					{/each}
					{status.left} left
				</span>
				<span class="lives" title="Lives">
					{#each { length: 3 } as _, i (i)}
						<span class:lost={i >= status.lives}>♥</span>
					{/each}
				</span>
			</div>
		</header>

		{#if status.state === 'intro' && !showIntro && !paused}
			<div class="banner">
				<small>{environment === 'planet' ? 'Coast City outskirts' : 'Sector 2814, asteroid field'}</small>
				<strong>They're coming… {status.timer}</strong>
				<span>Five Red Lanterns. Three lives. Stay moving.</span>
			</div>
		{/if}

		{#if showIntro}
			<ControlsCard onClose={() => (showIntro = false)} />
		{:else if status.state === 'won' || status.state === 'lost'}
			<div class="end" class:won={status.state === 'won'}>
				<h2>{status.state === 'won' ? 'Victory' : 'Defeated'}</h2>
				<p>
					{#if status.state === 'won'}
						All five Red Lanterns beaten in {clock(status.time)}, with {status.lives}
						{status.lives === 1 ? 'life' : 'lives'} to spare.
					{:else}
						{status.total - status.left} of {status.total} Red Lanterns beaten before the rage got you.
					{/if}
				</p>
				<div class="actions">
					<button class="primary" onclick={playAgain}>Play again</button>
					<a href="/skirmish?as={lantern === 'hal' ? 'john' : 'hal'}&env={environment}">
						Play as {LANTERNS[lantern === 'hal' ? 'john' : 'hal'].name}
					</a>
					<a href="/skirmish?as={lantern}&env={environment === 'planet' ? 'space' : 'planet'}">
						Fight in {environment === 'planet' ? 'space' : 'Coast City'}
					</a>
					<a href="/">Main menu</a>
				</div>
			</div>
		{:else if paused}
			<PauseMenu
				game={setup.game}
				onResume={() => setPaused(false)}
				links={[
					{ href: '/skirmish', label: '← Change Lantern' },
					{ href: `/hq?as=${lantern}`, label: 'Corps HQ (upgrades)' },
					{ href: '/', label: 'Main menu' }
				]}
			/>
		{/if}
	</div>
{:else}
	<main class="select">
		<h1>Red Lantern Ambush</h1>
		<p class="pitch">Five Red Lanterns. One Green Lantern. Three lives.</p>
		<div class="cards">
			{#each Object.values(LANTERNS) as def (def.id)}
				<div class="card">
					<LanternPortrait {def} />
					<h2>{def.name}</h2>
					<p class="subtitle">{def.title}</p>
					<div class="where">
						<a href="/skirmish?as={def.id}&env=planet">Coast City</a>
						<a href="/skirmish?as={def.id}&env=space">Space</a>
					</div>
				</div>
			{/each}
		</div>
		<a class="back" href="/">← Menu</a>
	</main>
{/if}

<style>
	.screen {
		position: fixed;
		inset: 0;
	}
	.bar {
		position: absolute;
		top: 8px;
		left: 10px;
		right: 10px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		pointer-events: none;
	}
	.pause {
		pointer-events: auto;
		font: inherit;
		font-size: 0.85rem;
		color: var(--green);
		background: rgba(3, 6, 10, 0.6);
		border: 1px solid var(--green-dim);
		border-radius: 6px;
		padding: 0.25rem 0.6rem;
		cursor: pointer;
		opacity: 0.85;
	}
	.pause kbd {
		font-size: 0.7rem;
		opacity: 0.7;
	}
	.status {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.3rem 0.9rem;
		border-radius: 999px;
		background: rgba(20, 4, 4, 0.72);
		border: 1px solid rgba(255, 42, 42, 0.45);
		color: #ffd6d6;
		font-size: 0.85rem;
	}
	.title {
		font-family: var(--font-display);
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: #ff5a5a;
		text-shadow: 0 0 10px rgba(255, 42, 42, 0.6);
	}
	.left {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}
	.pip {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: #ff2a2a;
		box-shadow: 0 0 6px #ff2a2a;
	}
	.pip.down {
		background: #3a1010;
		box-shadow: none;
	}
	.lives {
		color: var(--green);
		letter-spacing: 0.1em;
		text-shadow: 0 0 8px var(--green);
	}
	.lives .lost {
		color: #3a3a3a;
		text-shadow: none;
	}

	.banner {
		position: absolute;
		top: 22%;
		left: 50%;
		translate: -50% 0;
		display: grid;
		justify-items: center;
		gap: 0.3rem;
		padding: 1rem 2rem;
		border-radius: 10px;
		background: rgba(20, 4, 4, 0.75);
		border: 1px solid rgba(255, 42, 42, 0.5);
		color: #ffd6d6;
		text-align: center;
		pointer-events: none;
	}
	.banner small {
		text-transform: uppercase;
		letter-spacing: 0.15em;
		opacity: 0.7;
	}
	.banner strong {
		font-family: var(--font-display);
		font-size: 1.6rem;
		color: #ff5a5a;
		text-shadow: 0 0 14px rgba(255, 42, 42, 0.7);
	}

	.end {
		position: absolute;
		/* Below the Lantern, so the VICTORY! shout over their head stays visible */
		top: 64%;
		left: 50%;
		translate: -50% -50%;
		width: min(28rem, 90vw);
		padding: 1.5rem 1.75rem;
		border-radius: 12px;
		background: rgba(20, 4, 4, 0.9);
		border: 2px solid rgba(255, 42, 42, 0.6);
		color: #ffd6d6;
		text-align: center;
	}
	.end.won {
		background: rgba(3, 14, 8, 0.9);
		border-color: var(--green);
		color: var(--text);
	}
	.end h2 {
		margin: 0 0 0.5rem;
		font-size: 2.2rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: #ff5a5a;
		text-shadow: 0 0 18px rgba(255, 42, 42, 0.7);
	}
	.end.won h2 {
		color: var(--green);
		text-shadow: 0 0 18px var(--green);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.6rem 1rem;
		margin-top: 1.25rem;
		align-items: center;
	}
	.actions a {
		font-size: 0.9rem;
		text-decoration: none;
	}
	.primary {
		font: inherit;
		font-weight: 700;
		padding: 0.5rem 1.25rem;
		border-radius: 6px;
		border: none;
		background: var(--green);
		color: var(--bg);
		cursor: pointer;
	}

	.select {
		min-height: 100%;
		box-sizing: border-box;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 1.25rem;
		padding: 2rem 1rem;
	}
	h1 {
		margin: 0;
		color: #ff4a4a;
		text-shadow: 0 0 18px rgba(255, 42, 42, 0.7);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: clamp(1.6rem, 5vw, 2.6rem);
		text-align: center;
	}
	.pitch {
		margin: 0;
		opacity: 0.75;
	}
	.cards {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 1.25rem;
		width: min(33rem, 100%);
	}
	.card {
		width: min(15rem, 100%);
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 1.25rem;
		border: 2px solid var(--green-dim);
		border-radius: 10px;
		background: rgba(61, 255, 110, 0.03);
	}
	.card h2 {
		margin: 0.5rem 0 0;
		color: var(--green);
		/* The display face is wide: keep names on one line */
		font-size: 1.15rem;
		letter-spacing: 0.02em;
		white-space: nowrap;
	}
	.subtitle {
		margin: 0.1rem 0 0.9rem;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		opacity: 0.7;
	}
	.where {
		display: flex;
		gap: 0.5rem;
	}
	.where a {
		padding: 0.4rem 0.9rem;
		border: 1px solid var(--green);
		border-radius: 6px;
		text-decoration: none;
		font-size: 0.85rem;
	}
	.where a:hover,
	.where a:focus-visible {
		background: var(--green);
		color: var(--bg);
	}
	.back {
		font-size: 0.9rem;
		text-decoration: none;
		opacity: 0.7;
	}
</style>
