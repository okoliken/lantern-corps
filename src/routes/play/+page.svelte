<script lang="ts">
	import GameCanvas from '$lib/components/GameCanvas.svelte';
	import { Game } from '$lib/engine/game';

	const game = new Game();
</script>

<div class="screen">
	<GameCanvas {game} />
	<a class="back" href="/">← Menu</a>
</div>

<style>
	.screen {
		position: fixed;
		inset: 0;
	}
	.back {
		position: absolute;
		top: 10px;
		left: 12px;
		font-size: 0.9rem;
		text-decoration: none;
		opacity: 0.7;
	}
</style>
