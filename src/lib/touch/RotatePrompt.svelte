<script lang="ts">
	// On a phone held upright, during a fight: a screen asking you to play
	// sideways. Only the fights need landscape; the menus work either way.
	//
	// Most people turn the phone and nothing happens, because rotation lock is
	// on. So the first step is unlocking it, told for the phone in your hand.
	// Where the browser allows it (Android, fullscreen), a button turns the
	// screen for you, lock or no lock. And the best fix of all is playing from
	// the home screen, so that is offered too.
	import { onMount } from 'svelte';
	import { settings } from '$lib/settings.svelte';
	import Backdrop from '$lib/components/menu/Backdrop.svelte';
	import { goFullscreen, wantsTouchControls } from './phone';
	import { fighting } from './fighting.svelte';
	import { install } from './install.svelte';
	import InstallSheet from './InstallSheet.svelte';

	let upright = $state(false);
	/** This browser can go fullscreen and lock the screen sideways (not iPhones). */
	let canLock = $state(false);
	let showInstall = $state(false);

	onMount(() => {
		const portrait = window.matchMedia('(orientation: portrait)');
		const check = () => (upright = portrait.matches && wantsTouchControls(settings.current.touchControls));
		check();
		portrait.addEventListener('change', check);
		window.addEventListener('resize', check);
		canLock = !!document.fullscreenEnabled && typeof (screen.orientation as ScreenOrientation & { lock?: unknown })?.lock === 'function';
		return () => {
			portrait.removeEventListener('change', check);
			window.removeEventListener('resize', check);
		};
	});
</script>

{#if upright && fighting.count > 0}
	<div class="rotate" role="alertdialog" aria-modal="true" aria-label="Play sideways">
		<Backdrop />
		<div class="column">
			<div class="phone" aria-hidden="true"><span></span></div>
			<h2>Play sideways</h2>

			{#if canLock}
				<button class="big" onclick={() => void goFullscreen()}>Turn it for me</button>
				<p class="or">or do it yourself:</p>
			{/if}

			<ol class="steps">
				<li>
					<span class="num">1</span>
					<div>
						<strong>Switch off rotation lock</strong>
						<p>With the lock on, turning your phone does nothing.</p>
						{#if install.platform === 'iphone'}
							<p class="how">Swipe down from the <b>top right corner</b>, then tap the <span class="key">🔒</span> lock with the circle arrow so it turns off.</p>
						{:else}
							<p class="how">Swipe down from the <b>top of the screen</b> and turn on <b>Auto-rotate</b> (on some phones it shows as <b>Portrait</b>: tap it).</p>
						{/if}
					</div>
				</li>
				<li>
					<span class="num">2</span>
					<div>
						<strong>Turn your phone sideways</strong>
						<p>Left thumb moves, right thumb fights.</p>
					</div>
				</li>
			</ol>

			{#if install.worthIt}
				<button class="app" onclick={() => (showInstall = true)}>
					<strong>Better: play it as an app</strong>
					<span>Fullscreen, no address bar in the way.</span>
				</button>
			{/if}
		</div>
	</div>
	{#if showInstall}<InstallSheet onClose={() => (showInstall = false)} />{/if}
{/if}

<style>
	.rotate {
		position: fixed;
		inset: 0;
		z-index: 1000;
		overflow-y: auto;
		touch-action: pan-y;
		color: #fff;
	}
	.column {
		position: relative;
		z-index: 1;
		display: grid;
		justify-items: center;
		gap: 0.9rem;
		width: min(24rem, 100%);
		box-sizing: border-box;
		margin: 0 auto;
		padding: max(1.6rem, env(safe-area-inset-top)) 1.1rem max(1.6rem, env(safe-area-inset-bottom));
		text-align: center;
	}
	h2 {
		margin: 0.3rem 0 0;
		font-family: var(--font-comic);
		font-weight: 400;
		font-size: 2.8rem;
		line-height: 1;
		letter-spacing: 0.05em;
		color: var(--toon-light);
		-webkit-text-stroke: 2px var(--ink);
		paint-order: stroke fill;
		text-shadow: 3px 4px 0 var(--ink);
		rotate: -2deg;
	}
	.big {
		width: 100%;
		padding: 0.25rem;
		font-family: var(--font-comic);
		font-size: 1.8rem;
		letter-spacing: 0.06em;
		color: #fff;
		background: var(--toon-btn);
		border: 3px solid var(--ink);
		border-radius: 0.9rem;
		text-shadow: 2px 2px 0 var(--ink);
		box-shadow: 0 5px 0 var(--ink);
	}
	.big:active {
		transform: translateY(4px);
		box-shadow: 0 1px 0 var(--ink);
	}
	.or {
		margin: 0;
		font-weight: 700;
		color: #a6d4b3;
	}
	.steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.7rem;
		width: 100%;
		text-align: left;
	}
	.steps li {
		display: grid;
		grid-template-columns: 2.4rem 1fr;
		gap: 0.7rem;
		align-items: start;
		padding: 0.8rem 0.9rem;
		border: 3px solid var(--ink);
		border-radius: 1rem;
		background: var(--toon-card);
		box-shadow: 4px 5px 0 var(--ink);
	}
	.steps li:first-child {
		background: var(--toon-cream);
		color: #22302a;
	}
	.num {
		display: grid;
		place-items: center;
		width: 2.4rem;
		height: 2.4rem;
		box-sizing: border-box;
		border: 3px solid var(--ink);
		border-radius: 50%;
		background: var(--toon-gold);
		color: var(--ink);
		font-family: var(--font-comic);
		font-size: 1.4rem;
	}
	.steps strong {
		display: block;
		font-family: var(--font-comic);
		font-weight: 400;
		font-size: 1.4rem;
		letter-spacing: 0.04em;
		line-height: 1.1;
	}
	.steps li:first-child strong {
		color: var(--ink);
	}
	.steps li:not(:first-child) strong {
		text-shadow: 2px 2px 0 var(--ink);
	}
	.steps p {
		margin: 0.25rem 0 0;
		font-size: 0.92rem;
		font-weight: 600;
		line-height: 1.4;
	}
	.how {
		padding-top: 0.35rem;
		border-top: 2px dashed #04120a33;
	}
	.key {
		display: inline-block;
		padding: 0 0.25rem;
		border: 2px solid var(--ink);
		border-radius: 0.4rem;
		background: #fff;
		box-shadow: 0 2px 0 var(--ink);
	}
	.app {
		display: grid;
		gap: 0.1rem;
		width: 100%;
		padding: 0.7rem 0.9rem;
		text-align: left;
		font: inherit;
		color: var(--ink);
		background: var(--toon-gold);
		border: 3px solid var(--ink);
		border-radius: 1rem;
		box-shadow: 4px 5px 0 var(--ink);
		cursor: pointer;
	}
	.app strong {
		font-family: var(--font-comic);
		font-weight: 400;
		font-size: 1.35rem;
		letter-spacing: 0.04em;
	}
	.app span {
		font-size: 0.88rem;
		font-weight: 700;
	}
	.app:active {
		transform: translate(3px, 4px);
		box-shadow: 1px 1px 0 var(--ink);
	}
	/* A phone turning: outlined in ink, a little screen with the emblem's green */
	.phone {
		position: relative;
		width: 54px;
		height: 92px;
		box-sizing: border-box;
		border: 4px solid var(--ink);
		border-radius: 12px;
		background: #fff;
		box-shadow: 3px 4px 0 var(--ink);
		animation: turn 2.2s ease-in-out infinite;
	}
	.phone span {
		position: absolute;
		inset: 6px 4px;
		border-radius: 4px;
		background: var(--toon-btn);
	}
	@keyframes turn {
		0%,
		25% {
			transform: rotate(0deg);
		}
		55%,
		100% {
			transform: rotate(-90deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.phone {
			animation: none;
		}
	}
</style>
