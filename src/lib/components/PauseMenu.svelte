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
			<span class="where">
				<h2>Paused</h2>
				{#if where}<p>{where}</p>{/if}
			</span>
			<span class="head-actions">
				<FullscreenButton compact />
				<button class="primary" onclick={onResume}>Resume {#if !game.touch}<kbd>Esc</kbd>{/if}</button>
			</span>
		</header>

		<nav class="tabs" aria-label="Pause menu sections">
			<button class:on={tab === 'controls'} onclick={() => (tab = 'controls')}>Controls</button>
			<button class:on={tab === 'options'} onclick={() => (tab = 'options')}>Options</button>
			{#if !game.touch}<button class:on={tab === 'pad'} onclick={() => (tab = 'pad')}>Phone pad</button>{/if}
		</nav>

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
					<label class="option">
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
							<small>{opt.help}</small>
						</span>
					</label>
				{/each}
			</div>
		{/if}

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
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: rgba(3, 6, 10, 0.72);
		backdrop-filter: blur(3px);
		z-index: 10;
	}
	.panel {
		width: min(46rem, 100%);
		max-height: 100%;
		overflow: auto;
		box-sizing: border-box;
		padding: 1.25rem 1.5rem;
		border: 2px solid var(--suit-lit);
		border-radius: 12px;
		background: #06100b;
		box-shadow: 0 0 40px color-mix(in srgb, var(--green) 12%, transparent);
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	.head-actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	h2 {
		margin: 0;
		color: var(--green);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	h3 {
		margin: 0 0 0.4rem;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		opacity: 0.6;
	}
	button {
		font: inherit;
		color: var(--text);
		background: transparent;
		border: 1px solid var(--suit-lit);
		border-radius: 6px;
		padding: 0.35rem 0.8rem;
		cursor: pointer;
	}
	button:hover,
	button:focus-visible {
		border-color: var(--green);
	}
	button.primary {
		background: var(--suit);
		color: var(--text);
		border-color: var(--suit-lit);
		font-weight: 700;
	}
	.tabs {
		display: flex;
		gap: 0.5rem;
		margin: 1rem 0 0.75rem;
	}
	.tabs button.on {
		background: color-mix(in srgb, var(--suit) 75%, transparent);
		border-color: var(--green);
	}
	.help {
		margin: 0 0 0.75rem;
		font-size: 0.85rem;
		opacity: 0.7;
	}
	.groups {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
		align-items: start;
		gap: 0.8rem;
	}
	.groups section {
		border: 1px solid color-mix(in srgb, var(--suit-lit) 45%, transparent);
		border-radius: 8px;
		padding: 0.7rem 0.8rem;
		background: color-mix(in srgb, var(--suit) 12%, transparent);
	}
	.where {
		display: grid;
		gap: 0.1rem;
	}
	.where p {
		margin: 0;
		font-size: 0.82rem;
		opacity: 0.6;
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
		padding: 0.2rem 0;
		font-size: 0.9rem;
	}
	.bind {
		min-width: 6.5rem;
		font-size: 0.8rem;
		font-family: var(--font-ui);
		font-weight: 700;
	}
	.bind.listening {
		border-color: var(--suit-lit);
		color: var(--green);
		animation: pulse 0.8s ease-in-out infinite alternate;
	}
	@keyframes pulse {
		to {
			box-shadow: 0 0 12px color-mix(in srgb, var(--green) 50%, transparent);
		}
	}
	.reset {
		margin-top: 0.9rem;
		font-size: 0.8rem;
		opacity: 0.8;
	}
	.options {
		display: grid;
		gap: 0.75rem;
	}
	.option {
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
		cursor: pointer;
	}
	.option input {
		flex-shrink: 0;
		width: 1.2rem;
		height: 1.2rem;
		accent-color: var(--suit-lit);
		margin-top: 0.15rem;
	}
	.option span {
		display: grid;
	}
	.option small {
		opacity: 0.7;
	}
	.volume input[type='range'] {
		width: min(18rem, 60vw);
		accent-color: var(--suit-lit);
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
		background: var(--suit);
		border-color: var(--green);
	}
	.touch-help {
		margin: 0;
		padding-left: 1.1rem;
		display: grid;
		gap: 0.45rem;
		font-size: 0.9rem;
	}
	.touch-help b {
		color: var(--green);
	}
	footer {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin-top: 1.25rem;
		padding-top: 1rem;
		border-top: 1px solid var(--suit-lit);
	}
	footer a {
		text-decoration: none;
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
