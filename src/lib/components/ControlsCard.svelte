<script lang="ts">
	// First-time "how to play" card. Shows the player's CURRENT bindings, so it
	// stays correct after remapping. Dismissed once, then remembered.
	import { buttonLabel, type Action, type LayoutName } from '$lib/engine/input';
	import { settings } from '$lib/settings.svelte';

	interface Props {
		layout?: LayoutName;
		onClose: () => void;
	}

	let { layout = 'solo', onClose }: Props = $props();

	const rows: { actions: Action[]; what: string }[] = [
		{ actions: ['up', 'left', 'down', 'right'], what: 'Move' },
		{ actions: ['shot'], what: 'Ring shot: free, never runs out' },
		{ actions: ['construct'], what: 'Use your construct (costs willpower)' },
		{ actions: ['nextConstruct', 'slot1'], what: 'Switch construct (or keys 1–5)' },
		{ actions: ['shield'], what: 'Bubble shield' },
		{ actions: ['signature'], what: 'Signature ability, when the surge bar is full' },
		{ actions: ['fly'], what: 'Take off / land' },
		{ actions: ['target'], what: 'Lock onto a target (again to switch)' }
	];

	const keysFor = (actions: Action[]) =>
		actions.length === 4
			? actions.map((a) => buttonLabel(settings.current.bindings[layout][a][0] ?? '?')).join('')
			: buttonLabel(settings.current.bindings[layout][actions[0]][0] ?? '?');
</script>

<div class="backdrop" role="dialog" aria-modal="true" aria-label="How to play">
	<div class="card">
		<h2>How to play</h2>
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
		box-sizing: border-box;
		padding: 1.5rem;
		border: 2px solid var(--green);
		border-radius: 12px;
		background: #06100b;
		box-shadow: 0 0 40px rgba(61, 255, 110, 0.2);
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
		border: 1px solid var(--green-dim);
		border-bottom-width: 3px;
		border-radius: 6px;
		font-family: ui-monospace, monospace;
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
		color: var(--bg);
		background: var(--green);
		border: none;
		border-radius: 8px;
		cursor: pointer;
	}
</style>
