<script lang="ts">
	// A mission: the briefing, the fight, and the result. Every mission reports
	// the same things (objective, meters, radio chatter, results; see
	// $lib/engine/missions/mission.ts), so this one page runs them all.
	import { onMount, untrack } from 'svelte';
	import ControlsCard from '$lib/components/ControlsCard.svelte';
	import GameCanvas from '$lib/components/GameCanvas.svelte';
	import PauseMenu from '$lib/components/PauseMenu.svelte';
	import StoryScene from '$lib/components/StoryScene.svelte';
	import { LANTERNS, type LanternId } from '$lib/engine/lanterns';
	import type { CommsLine, MissionMeter, MissionState, MissionStat } from '$lib/engine/missions/mission';
	import type { DialogueScene } from '$lib/engine/scenes/scene';
	import { buildMission } from '$lib/missions';
	import { placeOf } from '$lib/story/missions';
	import { profiles } from '$lib/profiles.svelte';
	import { settings } from '$lib/settings.svelte';

	let { data } = $props();
	const mission = $derived(data.mission);
	const place = $derived(placeOf(mission.id));

	let round = $state(0);
	/** Who you've picked, in a mission that lets you choose (the boss fights with both Lanterns). */
	let picked = $state<LanternId | null>(null);
	const playAs = $derived(picked && mission.choose?.includes(picked) ? picked : mission.lantern);

	const setup = $derived.by(() => {
		void round; // Retry builds a fresh mission
		return buildMission(mission.id, {
			as: playAs,
			settings: untrack(() => settings.snapshot()),
			profiles: untrack(() => profiles.snapshot()),
			onProgress: (id, profile) => profiles.update(id, profile),
			// Dev only: ?zoom=2 brings the camera closer (for recording footage)
			zoom: import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('zoom')) || undefined : undefined
		});
	});
	const startLives = $derived(setup.director.lives);

	/** Briefing first; then the controls card if it's the first time; then play. */
	let briefing = $state(true);
	let showControls = $state(false);
	let paused = $state(false);

	function setPaused(value: boolean) {
		paused = value;
		setup.game.paused = value;
		setup.game.buttons.clear();
	}

	/** A story scene before the fight (John's first transformation), if the mission has one. */
	let intro = $state<DialogueScene | null>(null);

	$effect(() => {
		// The game waits behind the briefing, the opening scene and the controls card
		setPaused(briefing || !!intro || showControls);
	});

	function launch() {
		briefing = false;
		intro = setup.intro?.() ?? null;
		if (!intro) showControls = !settings.current.seenControls;
	}

	function introDone() {
		intro = null;
		showControls = !settings.current.seenControls;
	}

	/** After a win: the story scene plays (if the mission has one), then the results. */
	let outro = $state<DialogueScene | null>(null);
	let outroDone = $state(false);
	const OUTRO_DELAY = 2.5;

	function retry() {
		round++;
		outro = null;
		outroDone = false;
		briefing = false;
		paused = false;
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.code !== 'Escape' || briefing || intro || showControls || status.state === 'won' || status.state === 'lost') return;
		e.preventDefault();
		setPaused(!paused);
	}

	// Poll the mission for the overlay (the engine doesn't know about Svelte)
	let status = $state({
		state: 'intro' as MissionState,
		timer: 3,
		lives: 3,
		objective: '',
		meters: [] as MissionMeter[],
		tally: '',
		warning: null as string | null,
		line: null as CommsLine | null,
		stars: 0,
		starHint: '',
		resultText: '',
		stats: [] as MissionStat[]
	});
	onMount(() => {
		const id = setInterval(() => {
			const { game, director: d, outro: makeOutro } = setup;
			status = {
				state: d.state,
				timer: Math.ceil(d.timer),
				lives: d.lives,
				objective: d.objective,
				meters: d.meters(),
				tally: d.tally?.() ?? '',
				warning: d.warning(game),
				line: d.line,
				stars: d.stars,
				starHint: d.starHint,
				resultText: d.resultText,
				stats: d.stats()
			};
			if (d.state === 'won' && d.timer >= OUTRO_DELAY && !outroDone && !outro) {
				if (makeOutro) {
					outro = makeOutro();
					game.paused = true;
				} else outroDone = true;
			}
		}, 100);
		return () => clearInterval(id);
	});
</script>

<svelte:window onkeydown={onKeydown} />

<div class="screen">
	{#key setup}
		<GameCanvas game={setup.game} />
	{/key}

	{#if !briefing && !intro}
		<header class="bar">
			<button class="pause" onclick={() => setPaused(true)} aria-label="Pause">❚❚ <kbd>Esc</kbd></button>
			<div class="panel">
				<div class="row">
					<span class="title">{place.act.number}-{place.number}. {mission.title}</span>
					<span class="lives" title="Lives">
						{#each { length: startLives } as _, i (i)}
							<span class:lost={i >= status.lives}>♥</span>
						{/each}
					</span>
				</div>
				<p class="objective">{status.objective}</p>
				{#each status.meters as m (m.label)}
					<div class="meter">
						<span class="label">{m.label}</span>
						<span class="track">
							<span class="fill" class:hull={!m.marker} class:progress={!!m.marker} class:low={m.low} style:width="{m.value * 100}%"></span>
							{#if m.marker}<span class="ship" style:left="{m.value * 100}%">{m.marker}</span>{/if}
						</span>
						<span class="value">{m.text}</span>
					</div>
				{/each}
				{#if status.tally}
					<div class="row small"><span>{status.tally}</span></div>
				{/if}
			</div>
		</header>

		{#if status.line && !paused && status.state !== 'lost'}
			<div class="comms" aria-live="polite">
				<span class="who">{status.line.who}</span>
				<span>{status.line.text}</span>
			</div>
		{/if}

		{#if status.state === 'intro' && !showControls && !paused}
			<div class="banner">
				<small>{mission.place}</small>
				<strong>Starting in {status.timer}…</strong>
				<span>{status.objective}</span>
			</div>
		{/if}
		{#if status.warning && !paused}
			<div class="warning">{status.warning}</div>
		{/if}
	{/if}

	{#if briefing}
		<div class="briefing" role="dialog" aria-label="Mission briefing">
			<small class="place">Act {place.act.number} · {place.act.title} · {mission.place}</small>
			<h1>Mission {place.number}: {mission.title}</h1>
			{#if mission.choose}
				<div class="choose" role="radiogroup" aria-label="Choose your Lantern">
					{#each mission.choose as id (id)}
						<button role="radio" aria-checked={playAs === id} class:chosen={playAs === id} onclick={() => (picked = id)}>
							<strong>{LANTERNS[id].name}</strong>
							<small>{LANTERNS[id].title}</small>
						</button>
					{/each}
				</div>
				<p class="as">
					Playing as <strong>{LANTERNS[playAs].name}</strong>. {LANTERNS[mission.choose.find((id) => id !== playAs) ?? playAs].name} fights beside you.
				</p>
			{:else}
				<p class="as">Playing as <strong>{LANTERNS[mission.lantern].name}</strong></p>
			{/if}
			{#each mission.briefing as paragraph, i (i)}
				<p>{paragraph}</p>
			{/each}
			<h2>Objectives</h2>
			<ul>
				{#each mission.objectives as objective, i (i)}
					<li>{objective}</li>
				{/each}
			</ul>
			{#if !settings.current.trained}
				<p class="train">
					New to the ring? <a href="/training">Train with Kilowog first</a> (about 3 minutes): moving, flying, constructs,
					shields, all of it.
				</p>
			{/if}
			<div class="actions">
				<button class="primary" onclick={launch}>Launch</button>
				<a href="/missions">← Missions</a>
			</div>
		</div>
	{:else if intro}
		<StoryScene scene={intro} onDone={introDone} />
	{:else if showControls}
		<ControlsCard onClose={() => (showControls = false)} />
	{:else if outro && !outroDone}
		<StoryScene scene={outro} onDone={() => (outroDone = true)} />
	{:else if (status.state === 'won' && outroDone) || status.state === 'lost'}
		<div class="end" class:won={status.state === 'won'}>
			<h2>{status.state === 'won' ? 'Mission complete' : 'Mission failed'}</h2>
			{#if status.state === 'won'}
				<div class="stars" aria-label="{status.stars} of 3 stars">
					{#each { length: 3 } as _, i (i)}
						<span class:on={i < status.stars}>★</span>
					{/each}
				</div>
			{/if}
			<p>{status.resultText}</p>
			<dl>
				{#each status.stats as stat (stat.label)}
					<dt>{stat.label}</dt>
					<dd>{stat.value}</dd>
				{/each}
			</dl>
			{#if status.state === 'won'}
				<p class="hint">{status.starHint}</p>
			{/if}
			<div class="actions">
				<button class="primary" onclick={retry}>{status.state === 'won' ? 'Play again' : 'Retry'}</button>
				<a href="/missions">Missions</a>
				<a href="/">Main menu</a>
			</div>
		</div>
	{:else if paused}
		<PauseMenu
			game={setup.game}
			onResume={() => setPaused(false)}
			links={[
				{ href: '/missions', label: '← Missions' },
				{ href: `/hq?as=${playAs}`, label: 'Corps HQ (upgrades)' },
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
	.bar {
		position: absolute;
		top: 8px;
		left: 10px;
		right: 10px;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		pointer-events: none;
	}
	.pause {
		pointer-events: auto;
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
	.panel {
		width: min(20rem, 60vw);
		display: grid;
		gap: 0.35rem;
		padding: 0.6rem 0.8rem;
		border-radius: 10px;
		background: rgba(3, 10, 6, 0.75);
		border: 1px solid var(--suit-lit);
		font-size: 0.8rem;
	}
	.row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.objective {
		margin: 0;
		font-size: 0.8rem;
		font-weight: 700;
		color: #e6fbec;
	}
	.comms {
		position: absolute;
		top: 10px;
		left: 50%;
		translate: -50% 0;
		width: min(30rem, calc(100% - 26rem));
		min-width: 14rem;
		display: grid;
		gap: 0.15rem;
		padding: 0.55rem 0.85rem;
		border-radius: 10px;
		background: rgba(3, 10, 6, 0.85);
		border: 1px solid var(--suit-lit);
		font-size: 0.9rem;
		line-height: 1.35;
		pointer-events: none;
	}
	.comms .who {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 0.7rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--green);
	}
	.row.small {
		opacity: 0.85;
	}
	.title {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 0.75rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--green);
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
	.meter {
		display: grid;
		grid-template-columns: 2.5rem 1fr 2.5rem;
		align-items: center;
		gap: 0.5rem;
	}
	.label {
		opacity: 0.7;
		text-transform: uppercase;
		font-size: 0.65rem;
		letter-spacing: 0.1em;
	}
	.value {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.track {
		position: relative;
		height: 8px;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.08);
	}
	.fill {
		display: block;
		height: 100%;
		border-radius: 4px;
		transition: width 0.15s;
	}
	.fill.hull {
		background: var(--suit);
		box-shadow: 0 0 8px var(--green);
	}
	.fill.hull.low {
		background: #ff5a3a;
		box-shadow: 0 0 8px #ff5a3a;
	}
	.fill.progress {
		background: color-mix(in srgb, var(--suit) 100%, transparent);
	}
	.ship {
		position: absolute;
		top: 50%;
		translate: -50% -50%;
		font-size: 0.75rem;
		color: #eafff0;
		text-shadow: 0 0 6px var(--green);
	}

	.banner,
	.warning {
		position: absolute;
		left: 50%;
		translate: -50% 0;
		text-align: center;
		pointer-events: none;
		border-radius: 10px;
	}
	.banner {
		top: 24%;
		display: grid;
		gap: 0.3rem;
		padding: 1rem 2rem;
		background: rgba(3, 10, 6, 0.8);
		border: 1px solid var(--suit-lit);
	}
	.banner small {
		text-transform: uppercase;
		letter-spacing: 0.15em;
		opacity: 0.7;
	}
	.banner strong {
		font-family: var(--font-display);
		font-size: 1.6rem;
		color: var(--green);
		text-shadow: 0 0 14px var(--green);
	}
	.warning {
		top: 30%;
		padding: 0.5rem 1.25rem;
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 0.9rem;
		letter-spacing: 0.06em;
		color: #ffd27a;
		background: rgba(40, 20, 0, 0.75);
		border: 1px solid rgba(255, 190, 80, 0.6);
		animation: blink 0.8s ease-in-out infinite alternate;
	}
	@keyframes blink {
		from {
			opacity: 1;
		}
		to {
			opacity: 0.55;
		}
	}

	.briefing,
	.end {
		position: absolute;
		top: 50%;
		left: 50%;
		translate: -50% -50%;
		width: min(34rem, 92vw);
		max-height: 90vh;
		overflow: auto;
		box-sizing: border-box;
		padding: 1.5rem 1.75rem;
		border-radius: 12px;
		background: rgba(3, 10, 6, 0.92);
		border: 2px solid var(--suit-lit);
		box-shadow: 0 0 40px color-mix(in srgb, var(--green) 20%, transparent);
	}
	.briefing h1 {
		margin: 0.2rem 0 0.4rem;
		font-size: 1.4rem;
		color: var(--green);
		text-shadow: 0 0 14px var(--green);
	}
	.briefing h2 {
		margin: 1.2rem 0 0.4rem;
		font-size: 0.85rem;
		text-transform: uppercase;
		color: var(--green);
	}
	.place {
		text-transform: uppercase;
		letter-spacing: 0.15em;
		opacity: 0.65;
		font-size: 0.7rem;
	}
	.briefing p {
		line-height: 1.5;
		margin: 0.5rem 0;
	}
	.as {
		opacity: 0.75;
		font-size: 0.85rem;
	}
	.choose {
		display: flex;
		gap: 0.6rem;
		margin: 0.2rem 0;
	}
	.choose button {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.6rem 0.8rem;
		text-align: left;
		color: inherit;
		font: inherit;
		background: rgba(0, 0, 0, 0.35);
		border: 1px solid var(--suit-lit);
		border-radius: 8px;
		cursor: pointer;
		opacity: 0.7;
	}
	.choose button.chosen {
		background: var(--suit);
		opacity: 1;
	}
	.choose small {
		opacity: 0.75;
	}
	ul {
		margin: 0;
		padding-left: 1.2rem;
		line-height: 1.6;
	}
	.train {
		margin-top: 1rem;
		padding: 0.6rem 0.8rem;
		border-radius: 8px;
		border: 1px dashed var(--suit-lit);
		font-size: 0.9rem;
	}
	.train a {
		color: var(--green);
		font-weight: 700;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem 1.25rem;
		margin-top: 1.25rem;
	}
	.actions a {
		font-size: 0.9rem;
		text-decoration: none;
	}
	.primary {
		font: inherit;
		font-weight: 800;
		padding: 0.55rem 1.5rem;
		border-radius: 6px;
		border: none;
		background: var(--suit);
		color: var(--text);
		cursor: pointer;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.end {
		top: 60%;
		text-align: center;
		border-color: #ff5a3a;
		box-shadow: 0 0 40px rgba(255, 90, 58, 0.2);
	}
	.end.won {
		border-color: var(--suit-lit);
	}
	.end h2 {
		margin: 0 0 0.5rem;
		font-size: 1.6rem;
		text-transform: uppercase;
		color: #ff7a5a;
	}
	.end.won h2 {
		color: var(--green);
		text-shadow: 0 0 16px var(--green);
	}
	.stars {
		font-size: 2.2rem;
		letter-spacing: 0.2em;
		color: #2a3a30;
	}
	.stars .on {
		color: #ffe066;
		text-shadow: 0 0 12px rgba(255, 224, 102, 0.7);
	}
	dl {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.3rem 1rem;
		width: min(16rem, 100%);
		margin: 0.8rem auto 0;
		text-align: left;
	}
	dt {
		opacity: 0.7;
	}
	dd {
		margin: 0;
		font-weight: 700;
		text-align: right;
	}
	.hint {
		font-size: 0.75rem;
		opacity: 0.6;
	}
	.end .actions {
		justify-content: center;
	}

	/* A phone on its side: the HUD and the thumbs take the corners, so the radio goes bottom middle */
	@media (max-height: 520px) and (orientation: landscape) {
		.pause kbd {
			display: none;
		}
		.panel {
			width: min(17rem, 38vw);
			padding: 0.45rem 0.65rem;
			gap: 0.25rem;
		}
		.comms {
			top: auto;
			bottom: calc(max(env(safe-area-inset-bottom), 8px) + 2.6rem);
			width: min(28rem, 44vw);
			min-width: 0;
			padding: 0.4rem 0.65rem;
			font-size: 0.85rem;
			line-height: 1.25;
			background: rgba(3, 10, 6, 0.78);
		}
		.warning {
			top: 40%;
		}
		.banner {
			top: 30%;
			padding: 0.7rem 1.4rem;
		}
		.briefing,
		.end {
			max-height: 94vh;
			width: min(40rem, 94vw);
			padding: 1rem 1.25rem;
		}
	}
</style>
