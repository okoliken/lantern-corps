<script lang="ts">
	// Pause menu: resume, see and remap controls, accessibility options.
	// Every change is saved immediately and applied to the running game.
	import { onMount } from 'svelte';
	import { ACTION_LABELS, SLOT_ACTIONS, buttonLabel, type Action, type LayoutName } from '$lib/engine/input';
	import type { Game } from '$lib/engine/game';
	import { settings } from '$lib/settings.svelte';
	import PadPairing from './PadPairing.svelte';
	import FullscreenButton from '$lib/touch/FullscreenButton.svelte';
	import { TOUCH_MODES, type TouchControlsMode } from '$lib/engine/settings';

	interface Props {
		game: Game;
		/** Which binding set to show and edit. */
		layout?: LayoutName;
		onResume: () => void;
		/** Where you are, shown under "Paused" (the mission's objective). */
		where?: string;
		/** Extra links shown under Resume (e.g. change Lantern, main menu). */
		links?: { href: string; label: string }[];
	}

	let { game, layout = 'solo', onResume, where, links = [] }: Props = $props();

	let tab = $state<'controls' | 'options' | 'pad'>('controls');
	/** The ten construct slots are all obvious, so they stay folded away. */
	let showSlots = $state(false);
	/** What the panel on the right is explaining: whatever you last pointed at. */
	let hint = $state<{ title: string; text: string } | null>(null);
	const TAB_HELP: Record<'controls' | 'options' | 'pad', { title: string; text: string }> = {
		controls: {
			title: 'Controls',
			text: 'Every key and mouse button, and what it does. Click one to change it, then press whatever you would rather use.'
		},
		options: { title: 'Options', text: 'Sound, the ring\u2019s help, and what the screen shows you. Everything here saves as you change it.' },
		pad: { title: 'Phone pad', text: 'Use a phone as a controller: open the link on the phone and it pairs with this game.' }
	};
	const TOUCH_LABELS: Record<TouchControlsMode, string> = { auto: 'On touch screens', on: 'Always', off: 'Never' };
	/** The action waiting for a new button, while rebinding. */
	let listening = $state<Action | null>(null);

	function apply() {
		game.applySettings(settings.snapshot());
	}

	function capture(code: string) {
		if (!listening) return;
		settings.rebind(layout, listening, code);
		listening = null;
		apply();
	}

	// While listening, grab the very next key, mouse button, or wheel notch.
	onMount(() => {
		const key = (e: KeyboardEvent) => {
			if (!listening) return;
			e.preventDefault();
			e.stopPropagation();
			if (e.code === 'Escape') listening = null;
			else capture(e.code);
		};
		const mouse = (e: MouseEvent) => {
			if (!listening) return;
			e.preventDefault();
			capture(`Mouse${e.button}`);
		};
		const wheel = (e: WheelEvent) => {
			if (!listening || e.deltaY === 0) return;
			e.preventDefault();
			capture(e.deltaY < 0 ? 'WheelUp' : 'WheelDown');
		};
		// Capture phase, so the key never reaches the page's own Esc handler
		window.addEventListener('keydown', key, true);
		window.addEventListener('mousedown', mouse, true);
		window.addEventListener('wheel', wheel, { capture: true, passive: false });
		return () => {
			window.removeEventListener('keydown', key, true);
			window.removeEventListener('mousedown', mouse, true);
			window.removeEventListener('wheel', wheel, true);
		};
	});

	const groups: { title: string; actions: Action[] }[] = [
		{ title: 'Move', actions: ['up', 'down', 'left', 'right', 'fly'] },
		{ title: 'Fight', actions: ['shot', 'construct', 'shield', 'signature', 'target', 'backup'] },
		{ title: 'Choose construct', actions: ['prevConstruct', 'nextConstruct'] }
	];

	const options: { key: 'aimAssist' | 'toggleShot' | 'quickCast' | 'smartRing' | 'damageNumbers' | 'reduceFlashing'; label: string; help: string }[] = [
		{
			key: 'smartRing',
			label: 'Smart ring',
			help: 'The construct button makes whatever the moment needs: a fist or a sword up close, a train or missiles for a crowd, a sniper for far away, armor when you are in trouble. It sticks with what works, so holding it is steady. Number keys still pick by hand.'
		},
		{
			key: 'quickCast',
			label: 'Quick cast',
			help: "A construct's key uses it straight away: tap for one-shot constructs, hold for the beam and guns. Off: the keys only pick, and the construct button uses it."
		},
		{ key: 'aimAssist', label: 'Aim assist', help: 'Mouse aim gently snaps onto an enemy right next to the crosshair.' },
		{ key: 'toggleShot', label: 'Toggle ring shot', help: 'Tap once to start shooting, tap again to stop. No need to hold.' },
		{ key: 'damageNumbers', label: 'Damage numbers', help: 'Show how much damage each hit does.' },
		{ key: 'reduceFlashing', label: 'Reduce flashing', help: 'Softer hit flashes and no blinking effects.' }
	];
</script>

<div class="backdrop" role="dialog" aria-modal="true" aria-label="Paused">
	<div class="panel">
		<header>
			<span class="left">
				<button class="back" onclick={onResume}>
					<span aria-hidden="true">←</span> Resume {#if !game.touch}<kbd>Esc</kbd>{/if}
				</button>
				<span class="where">
					<h2>Paused</h2>
					{#if where}<p>{where}</p>{/if}
				</span>
			</span>
			<span class="head-actions">
				<FullscreenButton compact />
				<span class="wordmark">Lantern Corps</span>
			</span>
		</header>

		<nav class="tabs" aria-label="Pause menu sections">
			<button class:on={tab === 'controls'} onclick={() => (tab = 'controls')}>Controls</button>
			<button class:on={tab === 'options'} onclick={() => (tab = 'options')}>Options</button>
			{#if !game.touch}<button class:on={tab === 'pad'} onclick={() => (tab = 'pad')}>Phone pad</button>{/if}
		</nav>

		<div class="body">
			<div class="content">
		{#if tab === 'controls' && game.touch}
			<ul class="touch-help">
				<li><b>Left thumb</b> anywhere on the left: move</li>
				<li><b>Right thumb</b> anywhere else: aim and fire (the ring also aims itself)</li>
				<li><b>□</b> ring shot · <b>✕</b> construct (hold to keep going) · <b>○</b> bubble shield · <b>△</b> fly / land</li>
				<li><b>◀ ▶</b> change construct · <b>◎</b> lock a target · <b>★</b> signature, when it glows</li>
				<li><b>Tap a slot</b> in the hotbar (top left) to use that construct; hold it for the beam and the guns</li>
				<li><b>Backup</b> calls for help, where a mission has it</li>
			</ul>
		{:else if tab === 'controls'}
			<p class="help">Click a button to change it, then press the new key or mouse button. Esc cancels.</p>
			<div class="groups">
				{#each groups as group (group.title)}
					<section>
						<h3>{group.title}</h3>
						{#each group.actions as action (action)}
							<div class="row">
								<span class="label">{ACTION_LABELS[action]}</span>
								<button
									class="bind"
									class:listening={listening === action}
									onclick={() => (listening = listening === action ? null : action)}
								>
									{#if listening === action}
										Press a key…
									{:else}
										{settings.current.bindings[layout][action].map(buttonLabel).join('  /  ') || 'Unbound'}
									{/if}
								</button>
							</div>
						{/each}
					</section>
				{/each}
			</div>
			<div class="slots">
				<button class="fold" onclick={() => (showSlots = !showSlots)} aria-expanded={showSlots}>
					{showSlots ? 'Hide' : 'Show'} the ten construct slot keys
				</button>
				{#if showSlots}
					<div class="slot-rows">
						{#each SLOT_ACTIONS as action (action)}
							<div class="row">
								<span class="label">{ACTION_LABELS[action]}</span>
								<button
									class="bind"
									class:listening={listening === action}
									onclick={() => (listening = listening === action ? null : action)}
								>
									{#if listening === action}
										Press a key…
									{:else}
										{settings.current.bindings[layout][action].map(buttonLabel).join('  /  ') || 'Unbound'}
									{/if}
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>
			<button
				class="reset"
				onclick={() => {
					settings.resetControls(layout);
					apply();
				}}>Reset controls to default</button
			>
		{:else if tab === 'pad'}
			<PadPairing />
		{:else}
			<div class="options">
				{#each [['sound', 'Sound effects'], ['music', 'Music']] as const as [key, label] (key)}
					<label class="option volume">
						<span>
							<strong>{label}</strong>
							<input
								type="range"
								min="0"
								max="1"
								step="0.05"
								value={settings.current[key]}
								oninput={(e) => settings.set(key, Number(e.currentTarget.value))}
								aria-label={label}
							/>
						</span>
						<small class="level">{Math.round(settings.current[key] * 100)}%</small>
					</label>
				{/each}
				<div class="option">
					<span>
						<strong>Touch controls</strong>
						<small>The on-screen controller for playing on a phone or tablet. Changes take effect the next time a fight starts.</small>
						<span class="modes">
							{#each TOUCH_MODES as mode (mode)}
								<button class:on={settings.current.touchControls === mode} onclick={() => settings.set('touchControls', mode)}>{TOUCH_LABELS[mode]}</button>
							{/each}
						</span>
					</span>
				</div>
				{#each options as opt (opt.key)}
					<label
						class="option"
						onmouseenter={() => (hint = { title: opt.label, text: opt.help })}
						onfocusin={() => (hint = { title: opt.label, text: opt.help })}
						onmouseleave={() => (hint = null)}
					>
						<input
							type="checkbox"
							checked={settings.current[opt.key]}
							onchange={(e) => {
								settings.set(opt.key, e.currentTarget.checked);
								apply();
							}}
						/>
						<span>
							<strong>{opt.label}</strong>
						</span>
					</label>
				{/each}
			</div>
		{/if}

			</div>

			<aside class="help-panel">
				<h3>{hint?.title ?? TAB_HELP[tab].title}</h3>
				<p>{hint?.text ?? TAB_HELP[tab].text}</p>
			</aside>
		</div>

		{#if links.length}
			<footer>
				{#each links as link (link.href)}
					<a href={link.href}>{link.label}</a>
				{/each}
			</footer>
		{/if}
	</div>
</div>

<style>
	.backdrop {
		--green: #00711d; /* the menu green (the user's pick) */
		--green-ink: #3fb562; /* green text: a lighter tint of it, readable on the dark panels */
		position: absolute;
		inset: 0;
		background: rgba(2, 10, 6, 0.6);
		backdrop-filter: blur(3px);
		z-index: 10;
		display: grid;
		place-items: center;
		padding: 1rem;
		box-sizing: border-box;
	}
	.panel {
		/* a card floating over the paused fight, not a full screen */
		width: min(58rem, 100%);
		max-height: min(46rem, 100%);
		overflow: auto;
		box-sizing: border-box;
		padding: 1.2rem clamp(1rem, 2.4vw, 1.8rem) 1.4rem;
		background: var(--toon-card);
		border: 3px solid var(--ink);
		border-radius: 1.4rem;
		box-shadow: 7px 8px 0 var(--ink);
		display: grid;
		align-content: start;
		gap: 0.9rem;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding-bottom: 0.9rem;
		border-bottom: 3px solid var(--ink);
	}
	.left {
		display: flex;
		align-items: center;
		gap: 1.2rem;
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-family: var(--font-comic);
		font-size: 1.35rem;
		letter-spacing: 0.06em;
		min-height: 2.8rem;
		padding: 0.2rem 1.1rem;
		border-radius: 0.9rem;
		background: var(--toon-btn);
		color: #fff;
		border-color: var(--ink);
		text-shadow: 2px 2px 0 var(--ink);
		box-shadow: 0 5px 0 var(--ink);
	}
	.back:hover {
		background: var(--toon-btn-hi);
	}
	.back:active {
		transform: translateY(4px);
		box-shadow: 0 1px 0 var(--ink);
	}
	.back kbd {
		font-family: var(--font-ui);
		text-shadow: none;
	}
	.wordmark {
		font-family: var(--font-comic);
		font-size: 1.4rem;
		letter-spacing: 0.06em;
		color: var(--toon-light);
		text-shadow: 2px 2px 0 var(--ink);
		rotate: -2deg;
	}
	.body {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1.6rem;
		align-items: start;
	}
	.content {
		display: grid;
		gap: 0.75rem;
		align-content: start;
	}
	.help-panel {
		display: none;
		position: sticky;
		top: 1rem;
		border: 2px solid var(--ink);
		border-radius: 0.9rem;
		background: var(--toon-cream);
		color: #22302a;
		padding: 0.7rem 0.9rem;
	}
	.help-panel h3 {
		margin: 0 0 0.4rem;
		font-size: 0.72rem;
		letter-spacing: 0.16em;
		opacity: 0.9;
		color: var(--green-ink, var(--green));
	}
	.help-panel p {
		margin: 0;
		font-size: 0.85rem;
		line-height: 1.55;
		opacity: 0.72;
	}
	@media (max-width: 860px) {
		.body {
			grid-template-columns: 1fr;
		}
		.help-panel {
			display: none;
		}
	}
	/* Sideways on a phone: short and wide */
	@media (max-height: 560px) {
		.panel {
			padding: 0.6rem 0.9rem 1.2rem;
			gap: 0.5rem;
		}
		header {
			padding-bottom: 0.5rem;
		}
		h2 {
			font-size: 1rem;
		}
		.where p {
			font-size: 0.7rem;
		}
		.back {
			font-size: 0.7rem;
			padding: 0.3rem 0.7rem;
		}
		.tabs button {
			font-size: 0.68rem;
			padding: 0.25rem 0.6rem;
		}
		.help {
			font-size: 0.72rem;
			margin-bottom: 0.4rem;
		}
		.groups {
			gap: 0.5rem;
		}
		h3 {
			font-size: 0.64rem;
		}
		.row {
			font-size: 0.76rem;
			padding: 0.12rem 0.25rem;
		}
		.bind {
			min-width: 5rem;
			font-size: 0.68rem;
			padding: 0.2rem 0.5rem;
		}
		.option {
			gap: 0.5rem;
		}
		.option input {
			width: 1rem;
			height: 1rem;
		}
		.help-panel p {
			font-size: 0.76rem;
		}
		footer {
			font-size: 0.78rem;
		}
	}
	@media (max-width: 640px) {
		.panel {
			padding: 0.9rem 0.8rem 1.6rem;
			gap: 0.7rem;
		}
		header {
			flex-wrap: wrap;
			gap: 0.6rem;
			padding-bottom: 0.7rem;
		}
		.left {
			gap: 0.8rem;
		}
		.wordmark {
			display: none;
		}
		h2 {
			font-size: 1.1rem;
		}
		.where p {
			font-size: 0.74rem;
		}
		.tabs {
			overflow-x: auto;
			scrollbar-width: none;
		}
		.tabs::-webkit-scrollbar {
			display: none;
		}
		.tabs button {
			white-space: nowrap;
		}
		.groups {
			grid-template-columns: 1fr;
			gap: 0.4rem;
		}
		.row {
			font-size: 0.82rem;
		}
		.bind {
			min-width: 5.5rem;
			font-size: 0.72rem;
		}
		.slot-rows {
			grid-template-columns: 1fr;
		}
		.options {
			max-width: none;
		}
		footer {
			flex-wrap: wrap;
			gap: 0.8rem;
		}
	}
	.head-actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	h2 {
		margin: 0;
		font-family: var(--font-comic);
		font-weight: 400;
		font-size: 2.2rem;
		line-height: 1;
		letter-spacing: 0.05em;
		color: #fff;
		-webkit-text-stroke: 2px var(--ink);
		paint-order: stroke fill;
		text-shadow: 3px 3px 0 var(--ink);
	}
	h3 {
		margin: 0 0 0.4rem;
		font-family: var(--font-comic);
		font-weight: 400;
		font-size: 1.15rem;
		letter-spacing: 0.06em;
		opacity: 0.9;
	}
	button {
		font: inherit;
		font-weight: 700;
		color: #fff;
		background: var(--toon-well);
		border: 3px solid var(--ink);
		border-radius: 0.8rem;
		padding: 0.35rem 0.9rem;
		min-height: 2.4rem;
		cursor: pointer;
		box-shadow: 0 3px 0 var(--ink);
	}
	button:hover,
	button:focus-visible {
		background: #145a3a;
		outline: none;
	}
	button:active {
		transform: translateY(2px);
		box-shadow: 0 1px 0 var(--ink);
	}
	.tabs {
		display: flex;
		gap: 0.4rem;
	}
	.tabs button {
		border-radius: 999px;
		font-family: var(--font-comic);
		font-size: 1.15rem;
		letter-spacing: 0.06em;
		font-weight: 400;
		min-height: 2.6rem;
		padding: 0.2rem 1.1rem;
		color: #a6d4b3;
	}
	.tabs button.on {
		background: var(--toon-gold);
		color: var(--ink);
	}
	.help {
		margin: 0 0 0.75rem;
		font-size: 0.88rem;
		font-weight: 600;
		color: #a6d4b3;
	}
	.groups {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
		align-items: start;
		gap: 0.8rem;
	}
	.groups section {
		border: 0;
		border: 3px solid var(--ink);
		border-radius: 1rem;
		padding: 0.6rem 0.6rem 0.5rem;
		background: var(--toon-well);
		box-shadow: 3px 4px 0 var(--ink);
	}
	.groups h3 {
		color: var(--toon-gold);
		opacity: 1;
		padding-left: 0.3rem;
		text-shadow: 1px 2px 0 var(--ink);
	}
	.where {
		display: grid;
		gap: 0.1rem;
	}
	.where p {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 600;
		color: #a6d4b3;
	}
	.slots {
		margin-top: 0.8rem;
	}
	.fold {
		font-size: 0.8rem;
		opacity: 0.85;
	}
	.slot-rows {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
		gap: 0 1.2rem;
		margin-top: 0.6rem;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.22rem 0.3rem;
		font-size: 0.88rem;
		font-weight: 600;
		border-radius: 0.5rem;
	}
	.row:hover {
		background: rgba(255, 255, 255, 0.05);
	}
	.bind {
		min-width: 6.5rem;
		font-size: 0.8rem;
		font-family: var(--font-ui);
		font-weight: 800;
		background: #fff;
		color: var(--ink);
		white-space: nowrap;
		padding-inline: 0.6rem;
	}
	.bind:hover,
	.bind:focus-visible {
		background: var(--toon-cream);
	}
	.bind.listening {
		background: var(--toon-gold);
		color: var(--ink);
		animation: pulse 0.5s ease-in-out infinite alternate;
	}
	@keyframes pulse {
		to {
			transform: scale(1.05);
		}
	}
	.reset {
		margin-top: 0.9rem;
		font-size: 0.78rem;
		opacity: 0.8;
		justify-self: start;
	}
	.slots {
		justify-self: start;
	}
	.options {
		display: grid;
		gap: 0.55rem;
		max-width: 34rem;
	}
	.option {
		display: flex;
		gap: 0.9rem;
		align-items: center;
		cursor: pointer;
		padding: 0.7rem 0.9rem;
		border-radius: 1rem;
		border: 3px solid var(--ink);
		background: var(--toon-well);
		box-shadow: 3px 4px 0 var(--ink);
		min-height: 3rem;
		font-weight: 700;
	}
	.option input[type='checkbox'] {
		flex-shrink: 0;
		appearance: none;
		width: 3rem;
		height: 1.7rem;
		border-radius: 999px;
		border: 3px solid var(--ink);
		box-sizing: border-box;
		background: #0a2a1a;
		position: relative;
		margin: 0;
		order: 2;
		margin-left: auto;
		transition: background 0.15s;
	}
	.option input[type='checkbox']::after {
		content: '';
		position: absolute;
		top: 0.1rem;
		left: 0.1rem;
		width: 1.1rem;
		height: 1.1rem;
		border-radius: 50%;
		border: 2px solid var(--ink);
		background: #fff;
		transition: transform 0.15s;
	}
	.option input[type='checkbox']:checked {
		background: var(--toon-btn);
	}
	.option input[type='checkbox']:checked::after {
		transform: translateX(1.3rem);
	}
	.option span {
		display: grid;
	}
	.option small {
		font-weight: 500;
		color: #a6d4b3;
	}
	.volume input[type='range'] {
		width: min(18rem, 60vw);
		accent-color: var(--toon-gold);
		margin-top: 0.3rem;
	}
	.volume .level {
		align-self: center;
		margin-left: auto;
		opacity: 0.7;
	}
	.option .modes {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.4rem;
	}
	.modes button.on {
		background: var(--toon-gold);
		color: var(--ink);
	}
	.touch-help {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: 0.5rem;
		font-size: 0.9rem;
	}
	.touch-help li {
		padding: 0.6rem 0.9rem;
		border-radius: 1rem;
		border: 3px solid var(--ink);
		background: var(--toon-well);
		box-shadow: 3px 4px 0 var(--ink);
		font-weight: 600;
	}
	.touch-help b {
		color: var(--toon-gold);
	}
	footer {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin-top: 1.25rem;
		padding-top: 1rem;
		border-top: 3px solid var(--ink);
	}
	footer a {
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		min-height: 2.6rem;
		padding: 0 1.1rem;
		border-radius: 0.9rem;
		border: 3px solid var(--ink);
		background: var(--toon-well);
		color: #fff;
		font-family: var(--font-comic);
		font-size: 1.15rem;
		letter-spacing: 0.06em;
		box-shadow: 0 4px 0 var(--ink);
	}
	footer a:hover {
		background: #145a3a;
	}
	footer a:active {
		transform: translateY(3px);
		box-shadow: 0 1px 0 var(--ink);
	}
	kbd {
		font-size: 0.7rem;
		padding: 0 0.3rem;
		border: 1px solid currentColor;
		border-radius: 3px;
		margin-left: 0.3rem;
		opacity: 0.8;
	}
</style>
