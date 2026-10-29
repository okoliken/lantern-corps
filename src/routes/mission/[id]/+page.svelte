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
	import { actInSeason, actLabel, missionById, placeOf } from '$lib/story/missions';
	import { campaign } from '$lib/campaign.svelte';
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
	/** The story is played in order: a mission before its turn shows as locked, not the briefing. */
	const open = $derived(campaign.isOpen(mission.id));
	const needed = $derived(missionById(campaign.before(mission.id) ?? '') ?? null);
	const nextMission = $derived(missionById(campaign.next(mission.id) ?? '') ?? null);
	/** This win has been saved (so it's saved once). */
	let recorded = false;

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
			// Won: finished, which opens the next mission
			if (d.state === 'won' && !recorded) {
				recorded = true;
				campaign.complete(mission.id, d.stars);
			} else if (d.state !== 'won') recorded = false;
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
					<span class="title">{place.act.season > 1 ? `S${place.act.season} ` : ''}{actInSeason(place.act)}-{place.number}. {mission.title}</span>
					<span class="lives" title="Lives">
						{#each { length: startLives } as _, i (i)}
							<span class:lost={i >= status.lives}>♥</span>
						{/each}
					</span>
				</div>
				<p class="objective">{status.objective}</p>
				{#if status.meters.length}
					<div class="meters">
						{#each status.meters as m, i (m.label + i)}
							<div class="meter">
								<span class="label">{m.label}</span>
								<span class="track">
									<span class="fill" class:hull={!m.marker} class:progress={!!m.marker} class:low={m.low} style:width="{m.value * 100}%"></span>
									{#if m.marker}<span class="ship" style:left="{m.value * 100}%">{m.marker}</span>{/if}
								</span>
								<span class="value">{m.text}</span>
							</div>
						{/each}
					</div>
				{/if}
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

	{#if !open}
		<div class="briefing" role="dialog" aria-label="Mission locked">
			<small class="place">{actLabel(place.act)} · {place.act.title}</small>
			<h1>🔒 {mission.title}</h1>
			<p>This mission opens when you finish <strong>{needed?.title ?? 'the one before it'}</strong>.</p>
			<div class="actions">
				{#if needed}<a class="primary link" href="/mission/{needed.id}">Play {needed.title}</a>{/if}
				<a href="/missions">← Missions</a>
			</div>
		</div>
	{:else if briefing}
		<div class="briefing" role="dialog" aria-label="Mission briefing">
			<small class="place">{actLabel(place.act)} · {place.act.title} · {mission.place}</small>
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
		<div class="end" role="dialog" aria-label="Mission result" class:won={status.state === 'won'}>
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
				{#if status.state === 'won' && nextMission}
					<a class="primary link" href="/mission/{nextMission.id}" data-sveltekit-reload>Next: {nextMission.title} →</a>
					<button onclick={retry}>Play again</button>
				{:else}
					<button class="primary" onclick={retry}>{status.state === 'won' ? 'Play again' : 'Retry'}</button>
				{/if}
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
				{ href: '/', label: 'Main menu' }
			]}
			where={setup.director.objective}
		/>
	{/if}
</div>

<style>
	/* The cartoon look the menus use: flat cards, ink outlines, hard shadows, comic lettering */
	.screen {
		position: fixed;
		inset: 0;
	}
	.bar {
		position: absolute;
		top: 8px;
		left: max(10px, env(safe-area-inset-left));
		right: max(10px, env(safe-area-inset-right));
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		pointer-events: none;
	}
	.pause {
		pointer-events: auto;
		font: inherit;
		font-weight: 800;
		font-size: 0.85rem;
		color: #fff;
		background: var(--toon-card);
		border: 3px solid var(--ink);
		border-radius: 0.7rem;
		padding: 0.25rem 0.65rem;
		cursor: pointer;
		box-shadow: 2px 3px 0 var(--ink);
	}
	.pause:active {
		transform: translate(2px, 2px);
		box-shadow: 0 0 0 var(--ink);
	}
	.pause kbd {
		font-size: 0.7rem;
		opacity: 0.75;
	}
	.panel {
		margin-left: auto; /* stays top right even when the pause button is hidden (touch controls bring their own) */
		width: min(20rem, 60vw);
		display: grid;
		gap: 0.35rem;
		padding: 0.6rem 0.8rem;
		border-radius: 0.9rem;
		background: color-mix(in srgb, var(--toon-card) 92%, transparent);
		border: 3px solid var(--ink);
		box-shadow: 3px 4px 0 var(--ink);
		font-size: 0.8rem;
		font-weight: 600;
	}
	.row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.objective {
		margin: 0;
		font-size: 0.82rem;
		font-weight: 800;
		color: #fff;
	}
	/* The radio: a speech bubble */
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
		border-radius: 1rem 1rem 1rem 0.25rem;
		background: var(--toon-cream);
		color: #22302a;
		border: 3px solid var(--ink);
		box-shadow: 3px 4px 0 var(--ink);
		font-size: 0.9rem;
		font-weight: 600;
		line-height: 1.35;
		pointer-events: none;
	}
	.comms .who {
		font-family: var(--font-comic);
		font-size: 1.05rem;
		letter-spacing: 0.05em;
		color: #0b6b25;
	}
	.row.small {
		opacity: 0.9;
	}
	.title {
		font-family: var(--font-comic);
		font-size: 1.05rem;
		letter-spacing: 0.05em;
		color: var(--toon-light);
		text-shadow: 1px 2px 0 var(--ink);
	}
	.lives {
		color: var(--toon-gold);
		letter-spacing: 0.1em;
		text-shadow: 1px 2px 0 var(--ink);
	}
	.lives .lost {
		color: #0a2a1a;
		text-shadow: none;
	}
	/* One grid for every meter: the label column fits the longest name and the bars line up */
	.meters {
		display: grid;
		grid-template-columns: max-content 1fr max-content;
		align-items: center;
		gap: inherit;
		column-gap: 0.5rem;
	}
	.meter {
		display: contents;
	}
	.label {
		white-space: nowrap;
		opacity: 0.8;
		text-transform: uppercase;
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: 0.1em;
	}
	.value {
		white-space: nowrap;
		text-align: right;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}
	.track {
		position: relative;
		height: 12px;
		border-radius: 99px;
		border: 2px solid var(--ink);
		background: var(--toon-well);
		overflow: hidden;
	}
	.fill {
		display: block;
		height: 100%;
		transition: width 0.15s;
	}
	.fill.hull {
		background: var(--toon-light);
	}
	.fill.hull.low {
		background: var(--toon-red);
	}
	.fill.progress {
		background: var(--toon-gold);
	}
	.ship {
		position: absolute;
		top: 50%;
		translate: -50% -50%;
		font-size: 0.75rem;
		color: #fff;
		text-shadow: 1px 1px 0 var(--ink);
	}

	.banner,
	.warning {
		position: absolute;
		left: 50%;
		translate: -50% 0;
		text-align: center;
		pointer-events: none;
		border: 3px solid var(--ink);
		border-radius: 1rem;
		box-shadow: 4px 5px 0 var(--ink);
	}
	.banner {
		top: 24%;
		display: grid;
		gap: 0.2rem;
		padding: 0.8rem 2rem;
		background: var(--toon-card);
		rotate: -2deg;
	}
	.banner small {
		text-transform: uppercase;
		letter-spacing: 0.15em;
		font-weight: 800;
		opacity: 0.85;
	}
	.banner strong {
		font-family: var(--font-comic);
		font-weight: 400;
		font-size: 2.4rem;
		letter-spacing: 0.05em;
		color: var(--toon-light);
		-webkit-text-stroke: 2px var(--ink);
		paint-order: stroke fill;
		text-shadow: 3px 3px 0 var(--ink);
	}
	.warning {
		top: 30%;
		padding: 0.3rem 1.25rem;
		font-family: var(--font-comic);
		font-size: 1.5rem;
		letter-spacing: 0.06em;
		color: var(--ink);
		background: var(--toon-gold);
		animation: blink 0.8s ease-in-out infinite alternate;
	}
	@keyframes blink {
		from {
			scale: 1;
		}
		to {
			scale: 1.06;
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
		max-height: 90dvh;
		overflow: auto;
		overscroll-behavior: contain;
		touch-action: pan-y;
		box-sizing: border-box;
		padding: 1.5rem 1.75rem;
		border-radius: 1.3rem;
		background: var(--toon-card);
		border: 3px solid var(--ink);
		box-shadow: 6px 7px 0 var(--ink);
	}
	.briefing h1 {
		margin: 0.3rem 0 0.4rem;
		font-family: var(--font-comic);
		font-weight: 400;
		font-size: 2.3rem;
		line-height: 1;
		letter-spacing: 0.04em;
		color: var(--toon-light);
		-webkit-text-stroke: 2px var(--ink);
		paint-order: stroke fill;
		text-shadow: 3px 3px 0 var(--ink);
	}
	.briefing h2 {
		margin: 1.2rem 0 0.4rem;
		font-family: var(--font-comic);
		font-weight: 400;
		font-size: 1.4rem;
		letter-spacing: 0.05em;
		color: #fff;
		text-shadow: 2px 2px 0 var(--ink);
	}
	.place {
		display: inline-block;
		padding: 0.15rem 0.6rem;
		border: 2px solid var(--ink);
		border-radius: 99px;
		background: var(--toon-gold);
		color: var(--ink);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-weight: 800;
		font-size: 0.65rem;
	}
	.briefing p {
		line-height: 1.55;
		margin: 0.5rem 0;
		font-weight: 500;
		color: #e6fbec;
	}
	.as {
		font-size: 0.88rem;
	}
	.briefing .as {
		color: #a6d4b3;
	}
	.choose {
		display: flex;
		gap: 0.7rem;
		margin: 0.4rem 0;
	}
	.choose button {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		padding: 0.6rem 0.8rem;
		text-align: left;
		color: #a6d4b3;
		font: inherit;
		font-weight: 600;
		background: var(--toon-well);
		border: 3px solid var(--ink);
		border-radius: 0.9rem;
		box-shadow: 3px 4px 0 var(--ink);
		cursor: pointer;
	}
	.choose button strong {
		font-family: var(--font-comic);
		font-weight: 400;
		font-size: 1.3rem;
		letter-spacing: 0.05em;
		color: #fff;
	}
	.choose button.chosen {
		background: var(--toon-gold);
		color: #4a4413;
	}
	.choose button.chosen strong {
		color: var(--ink);
	}
	ul {
		margin: 0;
		padding-left: 1.2rem;
		line-height: 1.6;
		font-weight: 600;
	}
	.briefing li::marker {
		color: var(--toon-gold);
	}
	.train {
		margin-top: 1rem;
		padding: 0.6rem 0.8rem;
		border-radius: 0.9rem 0.9rem 0.9rem 0.25rem;
		border: 2px solid var(--ink);
		background: var(--toon-cream);
		font-size: 0.9rem;
	}
	.briefing .train {
		color: #22302a;
	}
	.train a {
		color: #0b6b25;
		font-weight: 800;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem 1.25rem;
		margin-top: 1.4rem;
	}
	.actions a {
		font-size: 0.92rem;
		font-weight: 800;
		color: var(--toon-light);
		text-decoration: none;
	}
	.actions a:hover {
		text-decoration: underline;
		text-decoration-thickness: 2px;
	}
	.primary {
		font-family: var(--font-comic);
		font-weight: 400;
		font-size: 1.6rem;
		letter-spacing: 0.08em;
		padding: 0.2rem 1.8rem;
		border-radius: 0.9rem;
		border: 3px solid var(--ink);
		background: var(--toon-btn);
		color: #fff;
		-webkit-text-stroke: 1.5px var(--ink);
		paint-order: stroke fill;
		text-shadow: 2px 2px 0 var(--ink);
		box-shadow: 0 5px 0 var(--ink);
		cursor: pointer;
		transition: transform 0.08s, box-shadow 0.08s, background 0.12s;
	}
	.primary:hover {
		background: var(--toon-btn-hi);
		transform: translateY(-2px);
		box-shadow: 0 7px 0 var(--ink);
	}
	.primary:active {
		transform: translateY(4px);
		box-shadow: 0 1px 0 var(--ink);
	}
	.actions .primary.link {
		display: inline-block;
		color: #fff;
		font-size: 1.4rem;
	}
	.actions .primary.link:hover {
		text-decoration: none;
	}
	.actions button:not(.primary) {
		font: inherit;
		font-weight: 800;
		padding: 0.5rem 1.1rem;
		border-radius: 0.8rem;
		border: 3px solid var(--ink);
		background: var(--toon-well);
		color: #fff;
		box-shadow: 0 4px 0 var(--ink);
		cursor: pointer;
	}
	.actions button:not(.primary):active {
		transform: translateY(3px);
		box-shadow: 0 1px 0 var(--ink);
	}

	.end {
		top: 60%;
		text-align: center;
		background: #5a1d14;
	}
	.end.won {
		background: var(--toon-card);
	}
	.end h2 {
		margin: 0 0 0.5rem;
		font-family: var(--font-comic);
		font-weight: 400;
		font-size: 2.8rem;
		line-height: 1;
		letter-spacing: 0.05em;
		color: #ff8a6a;
		-webkit-text-stroke: 2px var(--ink);
		paint-order: stroke fill;
		text-shadow: 3px 4px 0 var(--ink);
		rotate: -2deg;
	}
	.end.won h2 {
		color: var(--toon-light);
	}
	.end p {
		font-weight: 600;
	}
	.stars {
		font-size: 3rem;
		letter-spacing: 0.15em;
		color: #0a2a1a;
		-webkit-text-stroke: 2px var(--ink);
	}
	.stars .on {
		color: var(--toon-gold);
		text-shadow: 2px 3px 0 var(--ink);
	}
	dl {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.3rem 1rem;
		width: min(17rem, 100%);
		margin: 0.8rem auto 0;
		padding: 0.6rem 0.9rem;
		border: 2px solid var(--ink);
		border-radius: 0.8rem;
		background: var(--toon-cream);
		color: #22302a;
		text-align: left;
	}
	dt {
		font-weight: 600;
	}
	dd {
		margin: 0;
		font-weight: 800;
		text-align: right;
	}
	.hint {
		font-size: 0.8rem;
		opacity: 0.8;
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
			width: min(12.5rem, 28vw);
			padding: 0.3rem 0.5rem;
			gap: 0.15rem;
			font-size: 0.62rem;
			border-width: 2px;
			box-shadow: 2px 2px 0 var(--ink);
			background: color-mix(in srgb, var(--toon-card) 70%, transparent);
		}
		.meters {
			font-size: 0.56rem;
			column-gap: 0.3rem;
		}
		.track {
			height: 8px;
			border-width: 1.5px;
		}
		.title {
			font-size: 0.8rem;
		}
		.objective {
			font-size: 0.66rem;
			line-height: 1.25;
		}
		.row.small {
			font-size: 0.62rem;
		}
		.comms {
			top: auto;
			bottom: calc(max(env(safe-area-inset-bottom), 8px) + 2.6rem);
			width: min(28rem, 44vw);
			min-width: 0;
			padding: 0.4rem 0.65rem;
			font-size: 0.85rem;
			line-height: 1.25;
		}
		.warning {
			top: 40%;
		}
		.banner {
			top: 30%;
			padding: 0.5rem 1.4rem;
		}
		.banner strong {
			font-size: 1.8rem;
		}
		.briefing,
		.end {
			max-height: 94vh;
			max-height: 94dvh;
			width: min(40rem, 94vw);
			padding: 1rem 1.25rem 0;
		}
		.briefing h1 {
			font-size: 1.8rem;
		}
		/* Launch is always in reach, however long the briefing: it stays at the bottom while the rest scrolls */
		.briefing .actions,
		.end .actions {
			position: sticky;
			bottom: 0;
			z-index: 1;
			margin: 0.75rem -1.25rem 0;
			padding: 0.6rem 1.25rem 0.8rem;
			background: inherit;
			border-top: 3px solid var(--ink);
		}
	}
</style>
