<script lang="ts">
	// First-time "how to play" card. Shows the player's CURRENT bindings, so it
	// stays correct after remapping. Dismissed once, then remembered.
	import { buttonLabel, type Action, type LayoutName } from '$lib/engine/input';
	import { settings } from '$lib/settings.svelte';
	import { wantsTouchControls } from '$lib/touch/phone';

	interface Props {
		layout?: LayoutName;
		onClose: () => void;
	}

	let { layout = 'solo', onClose }: Props = $props();

	// The whole fight works on the first four rows; the rest are extras
	const rows = $derived<{ actions: Action[]; what: string }[]>([
		{ actions: ['up', 'left', 'down', 'right'], what: 'Move' },
		{ actions: ['shot'], what: 'Ring shot: free, never runs out' },
		settings.current.smartRing
			? { actions: ['construct'], what: 'Construct: the ring makes what the moment needs (hold to keep going)' }
			: { actions: ['construct'], what: 'Use your construct (costs willpower)' },
		{ actions: ['shield'], what: 'Bubble shield: goes on whoever needs it most, you, your partner, or what you protect' },
		{ actions: ['signature'], what: 'Signature ability, when the surge bar is full' },
		{ actions: ['slot1'], what: 'Keys 1–0 pick a construct yourself (optional)' },
		{ actions: ['fly'], what: 'Take off / land' },
		{ actions: ['target'], what: 'Lock onto a target (again to switch)' }
	]);

	/** Playing on a phone's own screen: its touch controls instead of keys. */
	const touch = wantsTouchControls(settings.current.touchControls);
	const touchRows: { key: string; what: string }[] = [
		{ key: 'Left thumb', what: 'Move: put your thumb down anywhere on the left and push' },
		{ key: '□', what: 'Ring shot: the ring aims itself at the nearest enemy' },
		{ key: 'Right thumb', what: 'Aim and fire a way yourself (optional)' },
		{ key: '✕', what: 'Construct: the ring makes what the moment needs (hold to keep going)' },
		{ key: '○', what: 'Bubble shield: goes on whoever needs it most' },
		{ key: '★', what: 'Signature ability, lit up when the surge bar is full' },
		{ key: 'Hotbar', what: 'Tap a construct at the top left to use it yourself' },
		{ key: '△  ◎  ◀ ▶', what: 'Take off / land · lock a target · change construct' }
	];

	const keysFor = (actions: Action[]) =>
		actions.length === 4
			? actions.map((a) => buttonLabel(settings.current.bindings[layout][a][0] ?? '?')).join('')
			: buttonLabel(settings.current.bindings[layout][actions[0]][0] ?? '?');
</script>

<div class="backdrop" role="dialog" aria-modal="true" aria-label="How to play">
	<div class="card">
		<h2>How to play</h2>
		{#if touch}
			<p class="lead">Hold your phone sideways. Your thumbs do the work.</p>
			<ul>
				{#each touchRows as row (row.what)}
					<li>
						<kbd>{row.key}</kbd>
						<span>{row.what}</span>
					</li>
				{/each}
				<li><kbd>❚❚ Pause</kbd><span>Pause, options and controls</span></li>
			</ul>
		{:else}
			<p class="lead">Aim with the mouse. The ring fires where the crosshair points.</p>
			<ul>
				{#each rows as row (row.what)}
					<li>
						<kbd>{keysFor(row.actions)}</kbd>
						<span>{row.what}</span>
					</li>
				{/each}
				<li><kbd>Esc</kbd><span>Pause, see all controls, change keys and options</span></li>
			</ul>
		{/if}
		<p class="tip">Low on willpower? Stand next to the glowing green Lantern to recharge.</p>
		<button
			onclick={() => {
				settings.set('seenControls', true);
				onClose();
			}}>Got it</button
		>
	</div>
</div>

<style>
	.backdrop {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: rgba(3, 6, 10, 0.65);
		z-index: 10;
	}
	.card {
		width: min(30rem, 100%);
		max-height: 100%;
		overflow: auto;
		box-sizing: border-box;
		padding: 1.5rem;
		border: 2px solid var(--suit-lit);
		border-radius: 12px;
		background: #06100b;
		box-shadow: 0 0 40px color-mix(in srgb, var(--green) 20%, transparent);
	}
	h2 {
		margin: 0;
		color: var(--green);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	.lead {
		margin: 0.4rem 0 1rem;
		opacity: 0.85;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.5rem;
	}
	li {
		display: grid;
		grid-template-columns: 7.5rem 1fr;
		align-items: center;
		gap: 0.75rem;
	}
	kbd {
		justify-self: start;
		padding: 0.2rem 0.5rem;
		border: 1px solid var(--suit-lit);
		border-bottom-width: 3px;
		border-radius: 6px;
		font-family: var(--font-ui);
		font-weight: 700;
		font-size: 0.8rem;
		color: var(--green);
		white-space: nowrap;
	}
	.tip {
		margin: 1rem 0;
		font-size: 0.85rem;
		opacity: 0.7;
	}
	button {
		width: 100%;
		padding: 0.7rem;
		font: inherit;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text);
		background: var(--suit);
		border: none;
		border-radius: 8px;
		cursor: pointer;
	}
	/* A phone on its side: two columns, so it all fits without scrolling */
	@media (max-height: 520px) {
		.card {
			width: min(44rem, 100%);
			padding: 1rem 1.25rem;
		}
		ul {
			grid-template-columns: 1fr 1fr;
			gap: 0.45rem 1rem;
		}
		li {
			grid-template-columns: 5.5rem 1fr;
			font-size: 0.85rem;
		}
		.tip {
			margin: 0.6rem 0;
		}
	}
</style>
