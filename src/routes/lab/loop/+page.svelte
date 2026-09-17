<script lang="ts">
	// Proves the fixed timestep works: add fake lag and watch fps drop while
	// ups stays near 60 and the emblem keeps pulsing at the same speed.
	import GameCanvas from '$lib/components/GameCanvas.svelte';
	import { Game } from '$lib/engine/game';

	class LaggyGame extends Game {
		lagMs = 0;

		override render(...args: Parameters<Game['render']>) {
			// Busy-wait to simulate a slow computer drawing a heavy frame.
			const until = performance.now() + this.lagMs;
			while (performance.now() < until);
			super.render(...args);
		}
	}

	const game = new LaggyGame();
	let lag = $state(0);

	$effect(() => {
		game.lagMs = lag;
	});
</script>

<div class="page">
	<div class="controls">
		<label>
			Fake render lag: <strong>{lag} ms</strong>
			<input type="range" min="0" max="60" bind:value={lag} />
		</label>
		<p>
			fps should drop as lag goes up. ups should stay near 60, and the pulse speed shouldn't change,
			just get choppier.
		</p>
	</div>
	<div class="stage">
		<GameCanvas {game} showStats />
	</div>
</div>

<style>
	.page {
		height: 100%;
		display: flex;
		flex-direction: column;
	}
	.controls {
		padding: 0.75rem 1rem;
		font-size: 0.9rem;
	}
	.controls p {
		margin: 0.4rem 0 0;
		opacity: 0.7;
	}
	input {
		width: min(20rem, 100%);
		vertical-align: middle;
	}
	.stage {
		flex: 1;
		min-height: 0;
	}
</style>
