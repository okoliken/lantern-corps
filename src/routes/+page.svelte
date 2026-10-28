<script lang="ts">
	// The title screen: everything in one column down the middle. The emblem and
	// name, then one card that holds the choice (Story or Training) and a big
	// Play, then how to play. This page is server-rendered like a normal website;
	// only the game routes turn SSR off.
	import { onMount } from 'svelte';
	import { dev } from '$app/environment';
	import Emblem from '$lib/components/Emblem.svelte';
	import LanternPortrait from '$lib/components/LanternPortrait.svelte';
	import Backdrop from '$lib/components/menu/Backdrop.svelte';
	import MenuIcon from '$lib/components/menu/MenuIcon.svelte';
	import FullscreenButton from '$lib/touch/FullscreenButton.svelte';
	import { campaign } from '$lib/campaign.svelte';
	import { settings } from '$lib/settings.svelte';
	import { missionById } from '$lib/story/missions';
	import { LANTERNS } from '$lib/engine/lanterns';
	import { buttonLabel } from '$lib/engine/input';
	import { wantsTouchControls } from '$lib/touch/phone';
	import { install } from '$lib/touch/install.svelte';
	import InstallSheet from '$lib/touch/InstallSheet.svelte';

	/** The next story mission to play, or none when the story is finished. */
	const nextIndex = $derived(campaign.order.findIndex((id) => campaign.stars(id) === 0 && campaign.isOpen(id)));
	const next = $derived(nextIndex >= 0 ? missionById(campaign.order[nextIndex]) : undefined);
	const started = $derived(Object.keys(campaign.current.done).length > 0);
	const finished = $derived(campaign.order.filter((id) => campaign.stars(id) > 0).length);
	const stars = $derived(Object.values(campaign.current.done).reduce((n, s) => n + s, 0));
	const lantern = $derived(LANTERNS[next?.lantern ?? 'hal']);

	let mode = $state<'story' | 'training'>('story');
	const trained = $derived(settings.current.trained);
	const playHref = $derived(mode === 'training' ? (trained ? '/school' : '/training') : next ? `/mission/${next.id}` : '/missions');

	// Keys are read after the page reaches the browser, so a phone shows its thumbs instead
	let touch = $state(false);
	let mounted = $state(false);
	let showInstall = $state(false);
	/** Android can install in one tap; elsewhere the sheet shows how. */
	async function playAsApp() {
		if (install.canPrompt) await install.prompt();
		else showInstall = true;
	}
	onMount(() => {
		touch = wantsTouchControls(settings.current.touchControls);
		mounted = true;
	});
	const key = (action: 'up' | 'left' | 'down' | 'right' | 'shot' | 'construct' | 'shield' | 'signature' | 'fly') =>
		mounted ? buttonLabel(settings.current.bindings.solo[action][0] ?? '?') : '·';
	const move = $derived(key('up') + key('left') + key('down') + key('right'));
</script>

<svelte:head>
	<title>Lantern Corps</title>
</svelte:head>

<Backdrop />

<main>
	<div class="corner"><FullscreenButton compact /></div>

	<header class="brand">
		<Emblem size={76} glow={false} />
		<h1>Lantern Corps</h1>
		<p class="oath">A ring, a sector, and everyone in it.</p>
	</header>

	{#if mounted && install.worthIt}
		<button class="app" onclick={playAsApp}>
			<span class="app-icon" aria-hidden="true"><Emblem size={30} glow={false} /></span>
			<span class="app-words">
				<strong>Play it like an app</strong>
				<small>Fullscreen, no address bar in the way.</small>
			</span>
			<span class="app-go">{install.canPrompt ? 'Install' : 'How?'}</span>
		</button>
	{/if}

	<section class="card main-card" aria-label="Play">
		<div class="who">
			<div class="portrait"><LanternPortrait def={lantern} size={112} /></div>
			<div class="next">
				{#if next}
					<small>{started ? 'Up next' : 'Your first mission'} · Mission {nextIndex + 1}</small>
					<strong>{next.title}</strong>
					<span>{next.choose ? 'Hal or John' : lantern.name} · {next.place}</span>
				{:else}
					<small>The story is done</small>
					<strong>Every mission, yours to replay</strong>
				{/if}
				<div class="progress" aria-label="{finished} of {campaign.order.length} missions done">
					<i style:width="{(finished / Math.max(1, campaign.order.length)) * 100}%"></i>
				</div>
				<span class="tally"><MenuIcon name="star" size={13} /> {stars} · {finished}/{campaign.order.length} missions</span>
			</div>
		</div>

		<p class="label">Mode</p>
		<div class="modes" role="radiogroup" aria-label="Mode">
			<button class="mode" class:on={mode === 'story'} role="radio" aria-checked={mode === 'story'} onclick={() => (mode = 'story')}>
				<span class="mode-head"><MenuIcon name="missions" size={18} /> Story</span>
				<span>{started ? 'Pick up where you left off.' : `The whole story, ${campaign.order.length} missions.`}</span>
			</button>
			<button class="mode" class:on={mode === 'training'} role="radio" aria-checked={mode === 'training'} onclick={() => (mode = 'training')}>
				<span class="mode-head"><MenuIcon name="school" size={18} /> Training</span>
				<span>{trained ? 'Drills with Kilowog and Katma Tui.' : 'New to the ring? Start here.'}</span>
			</button>
		</div>

		<a class="play" href={playHref}>Play!</a>
		<a class="all" href={mode === 'story' ? '/missions' : '/school'}>{mode === 'story' ? 'Choose a mission' : 'All drills'} →</a>
	</section>

	<section class="card how" aria-labelledby="how-title">
		<h2 id="how-title">How to play</h2>
		{#if touch}
			<ol>
				<li>Hold your phone sideways. Push anywhere on the left to move.</li>
				<li><b>□</b> fires the ring at the nearest enemy, <b>✕</b> makes a construct, <b>○</b> throws up a bubble shield.</li>
				<li>When the surge bar fills, <b>★</b> lets loose your signature move.</li>
			</ol>
		{:else}
			<ol>
				<li>Move with <kbd>{move}</kbd> and aim with the mouse. <kbd>{key('shot')}</kbd> fires the ring, and it never runs out.</li>
				<li><kbd>{key('construct')}</kbd> makes a construct and <kbd>{key('shield')}</kbd> throws up a bubble shield. Both cost willpower.</li>
				<li>Fill the surge bar, then <kbd>{key('signature')}</kbd> for your signature move. <kbd>{key('fly')}</kbd> takes off. <kbd>Esc</kbd> shows everything else.</li>
			</ol>
		{/if}
		<p class="tip">Low on willpower? Stand by a glowing green Lantern to recharge.</p>
	</section>

	{#if dev}<a class="lab" href="/lab">Lab (dev only)</a>{/if}
</main>
{#if showInstall}<InstallSheet onClose={() => (showInstall = false)} />{/if}

<style>
	main {
		--green: #00711d;
		--green-hi: #19a83d; /* the bright, flat green of buttons and picked things */
		--green-ink: #7dffa0;
		--muted: #a6d4b3;
		--gold: #ffd84a;
		--card: #145236;
		--well: #0d3b26;
		--pop: 4px 5px 0 var(--ink);
		position: fixed;
		inset: 0;
		z-index: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.3rem;
		padding: max(2rem, env(safe-area-inset-top)) 1rem max(2rem, env(safe-area-inset-bottom));
		box-sizing: border-box;
	}
	.corner {
		position: fixed;
		top: max(12px, env(safe-area-inset-top));
		right: max(12px, env(safe-area-inset-right));
		z-index: 2;
	}

	/* ---- the name, lettered like a comic cover ---- */
	.brand {
		display: grid;
		justify-items: center;
		text-align: center;
		gap: 0.2rem;
	}
	.brand :global(.emblem) {
		filter: drop-shadow(0 0 0 var(--ink)) drop-shadow(3px 4px 0 var(--ink));
		animation: bob 3.2s ease-in-out infinite;
	}
	h1 {
		margin: 0.5rem 0 0;
		font-family: var(--font-comic);
		font-weight: 400;
		font-size: clamp(2.6rem, 7vw, 4.4rem);
		line-height: 0.95;
		letter-spacing: 0.04em;
		color: #7dff9e;
		-webkit-text-stroke: 3px var(--ink);
		paint-order: stroke fill;
		text-shadow: 3px 4px 0 var(--ink), 6px 8px 0 #0a2a1a;
		transform: rotate(-2deg);
	}
	.oath {
		margin: 0.2rem 0 0;
		padding: 0.25rem 0.8rem;
		border: 2px solid var(--ink);
		border-radius: 99px;
		background: #fff8d6;
		color: var(--ink);
		font-size: 0.85rem;
		font-weight: 700;
		box-shadow: 2px 3px 0 var(--ink);
		transform: rotate(1deg);
	}
	@keyframes bob {
		50% {
			transform: translateY(-5px);
		}
	}

	/* ---- the cards: flat, outlined in ink, a hard shadow underneath ---- */
	.card {
		width: min(30rem, 100%);
		box-sizing: border-box;
		padding: 1.2rem;
		border-radius: 1.3rem;
		border: 3px solid var(--ink);
		background: var(--card);
		box-shadow: 6px 7px 0 var(--ink);
	}

	.who {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.portrait {
		flex-shrink: 0;
		width: 112px;
		height: 112px;
		border-radius: 50%;
		background: #fff8d6;
		border: 3px solid var(--ink);
		box-shadow: var(--pop);
		overflow: hidden;
		display: grid;
		place-items: center;
	}
	.next {
		display: grid;
		gap: 0.2rem;
		min-width: 0;
		flex: 1;
	}
	.next small {
		font-size: 0.7rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--green-ink);
		font-weight: 800;
	}
	.next strong {
		font-family: var(--font-comic);
		font-weight: 400;
		font-size: 1.7rem;
		letter-spacing: 0.04em;
		color: #fff;
		line-height: 1;
		text-shadow: 2px 2px 0 var(--ink);
	}
	.next > span {
		font-size: 0.85rem;
		color: var(--muted);
		font-weight: 600;
	}
	.progress {
		height: 12px;
		margin-top: 0.4rem;
		border-radius: 99px;
		border: 2px solid var(--ink);
		background: var(--well);
		overflow: hidden;
	}
	.progress i {
		display: block;
		height: 100%;
		background: var(--gold);
	}
	.tally {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.8rem;
		color: var(--gold);
		font-weight: 800;
	}

	.label {
		margin: 1.2rem 0 0.5rem;
		font-family: var(--font-comic);
		font-size: 1.15rem;
		letter-spacing: 0.06em;
		color: #fff;
	}
	.modes {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.7rem;
	}
	.mode {
		display: grid;
		align-content: start;
		gap: 0.35rem;
		padding: 0.8rem 0.9rem;
		border-radius: 0.9rem;
		border: 3px solid var(--ink);
		background: var(--well);
		color: var(--muted);
		font: inherit;
		font-size: 0.82rem;
		font-weight: 600;
		line-height: 1.35;
		text-align: left;
		cursor: pointer;
		box-shadow: 3px 4px 0 var(--ink);
		transition: transform 0.1s, box-shadow 0.1s, background 0.1s;
	}
	.mode:hover {
		transform: translate(-1px, -2px);
		box-shadow: 4px 6px 0 var(--ink);
	}
	.mode:active {
		transform: translate(2px, 3px);
		box-shadow: 1px 1px 0 var(--ink);
	}
	.mode-head {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-family: var(--font-comic);
		font-size: 1.35rem;
		font-weight: 400;
		letter-spacing: 0.05em;
		color: #fff;
	}
	/* Picked: the bright comic yellow, like a highlighted panel */
	.mode.on {
		background: var(--gold);
		color: #2b2a10;
	}
	.mode.on .mode-head {
		color: var(--ink);
	}

	.play {
		display: grid;
		place-items: center;
		margin-top: 1.2rem;
		padding: 0.55rem;
		border-radius: 0.9rem;
		border: 3px solid var(--ink);
		background: var(--green-hi);
		color: #fff;
		font-family: var(--font-comic);
		font-size: 2.1rem;
		letter-spacing: 0.08em;
		text-decoration: none;
		-webkit-text-stroke: 2px var(--ink);
		paint-order: stroke fill;
		text-shadow: 2px 3px 0 var(--ink);
		box-shadow: 0 6px 0 var(--ink);
		transition: transform 0.08s, box-shadow 0.08s, background 0.12s;
	}
	.play:hover {
		background: #22c24a;
		transform: translateY(-2px);
		box-shadow: 0 8px 0 var(--ink);
	}
	.play:active {
		transform: translateY(5px);
		box-shadow: 0 1px 0 var(--ink);
	}
	.all {
		display: block;
		margin-top: 0.9rem;
		text-align: center;
		font-size: 0.9rem;
		font-weight: 800;
		color: var(--green-ink);
		text-decoration: none;
	}
	.all:hover {
		text-decoration: underline;
		text-decoration-thickness: 2px;
	}

	/* ---- play it as an app: a yellow strip above the card ---- */
	.app {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		width: min(30rem, 100%);
		box-sizing: border-box;
		padding: 0.6rem 0.8rem;
		border: 3px solid var(--ink);
		border-radius: 1.1rem;
		background: var(--gold);
		color: var(--ink);
		font: inherit;
		text-align: left;
		box-shadow: 4px 5px 0 var(--ink);
		cursor: pointer;
		transition: transform 0.1s, box-shadow 0.1s;
	}
	.app:active {
		transform: translate(3px, 4px);
		box-shadow: 1px 1px 0 var(--ink);
	}
	.app-icon {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 2.6rem;
		height: 2.6rem;
		border: 3px solid var(--ink);
		border-radius: 0.8rem;
		background: #0c3a24;
	}
	.app-words {
		display: grid;
		flex: 1;
		min-width: 0;
	}
	.app-words strong {
		font-family: var(--font-comic);
		font-weight: 400;
		font-size: 1.35rem;
		letter-spacing: 0.04em;
		line-height: 1.1;
	}
	.app-words small {
		font-size: 0.8rem;
		font-weight: 700;
	}
	.app-go {
		padding: 0.1rem 0.8rem;
		border: 3px solid var(--ink);
		border-radius: 0.7rem;
		background: var(--green-hi);
		color: #fff;
		font-family: var(--font-comic);
		font-size: 1.2rem;
		letter-spacing: 0.05em;
		text-shadow: 1px 2px 0 var(--ink);
		box-shadow: 0 3px 0 var(--ink);
	}

	/* ---- how to play ---- */
	.how {
		background: #fff8d6;
		color: #2a3a2e;
	}
	.how h2 {
		margin: 0 0 0.6rem;
		font-family: var(--font-comic);
		font-weight: 400;
		font-size: 1.6rem;
		letter-spacing: 0.05em;
		color: var(--ink);
	}
	.how ol {
		margin: 0;
		padding-left: 1.2rem;
		display: grid;
		gap: 0.55rem;
		font-size: 0.9rem;
		font-weight: 600;
		line-height: 1.55;
	}
	kbd,
	.how b {
		display: inline-block;
		min-width: 1.3em;
		padding: 0 0.45em;
		border-radius: 0.4rem;
		border: 2px solid var(--ink);
		background: #fff;
		color: var(--ink);
		font: 800 0.75rem/1.6 var(--font-ui);
		text-align: center;
		text-transform: uppercase;
		box-shadow: 0 2px 0 var(--ink);
	}
	.tip {
		margin: 0.9rem 0 0;
		padding-top: 0.7rem;
		border-top: 2px dashed #04120a33;
		font-size: 0.82rem;
		font-weight: 600;
		color: #4c5f50;
	}
	.lab {
		font-size: 0.8rem;
		opacity: 0.7;
	}
	@media (prefers-reduced-motion: reduce) {
		.brand :global(.emblem) {
			animation: none;
		}
	}

	/* A phone held sideways: the name on the left, the card on the right, how to play below */
	@media (max-height: 520px) and (orientation: landscape) {
		main {
			display: grid;
			grid-template-columns: minmax(0, 14rem) minmax(0, 28rem);
			justify-content: center;
			align-content: start;
			column-gap: 1.5rem;
			row-gap: 1.1rem;
			padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) 1rem max(1rem, env(safe-area-inset-left));
		}
		.brand {
			position: sticky;
			top: 1rem;
			align-self: start;
			grid-row: 1 / span 4;
			padding-top: 1.5rem;
		}
		h1 {
			font-size: 2.3rem;
		}
		.card {
			padding: 0.9rem;
		}
		.portrait,
		.portrait :global(canvas) {
			width: 80px !important;
			height: 80px !important;
		}
		.label {
			margin-top: 0.7rem;
		}
		.play {
			font-size: 1.7rem;
			padding: 0.35rem;
		}
	}
	@media (max-width: 420px) {
		.portrait,
		.portrait :global(canvas) {
			width: 84px !important;
			height: 84px !important;
		}
		.modes {
			grid-template-columns: 1fr;
		}
	}
</style>
