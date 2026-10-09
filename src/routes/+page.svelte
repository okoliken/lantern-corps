<script lang="ts">
	// The title screen: the poster, one big button that carries on the story
	// from where you left it, and a tile for every other mode. This page is
	// server-rendered like a normal website; only the game routes turn SSR off.
	import { dev } from '$app/environment';
	import MenuPoster from '$lib/components/MenuPoster.svelte';
	import FullscreenButton from '$lib/touch/FullscreenButton.svelte';
	import MenuIcon, { SECTIONS } from '$lib/components/menu/MenuIcon.svelte';
	import { campaign } from '$lib/campaign.svelte';
	import { missionById } from '$lib/story/missions';

	/** The next story mission to play, or none when the story is finished. */
	const nextIndex = $derived(campaign.order.findIndex((id) => campaign.stars(id) === 0 && campaign.isOpen(id)));
	const next = $derived(nextIndex >= 0 ? missionById(campaign.order[nextIndex]) : undefined);
	const started = $derived(Object.keys(campaign.current.done).length > 0);
</script>

<main>
	<MenuPoster />
	<div class="corner"><FullscreenButton /></div>

	<div class="title">
		<h1>Lantern Corps</h1>
		<p class="oath">A ring, a sector, and everyone in it.</p>

		{#if next}
			<a class="continue" href="/mission/{next.id}">
				<span class="play"><MenuIcon name="play" size={18} /></span>
				<span class="words">
					<strong>{started ? 'Continue' : 'Start the story'}</strong>
					<small>Mission {nextIndex + 1} · {next.title}</small>
				</span>
			</a>
		{:else}
			<a class="continue" href="/missions">
				<span class="play"><MenuIcon name="play" size={18} /></span>
				<span class="words">
					<strong>Missions</strong>
					<small>The story is done. Replay any mission.</small>
				</span>
			</a>
		{/if}

		<nav class="modes" aria-label="Modes">
			{#each SECTIONS as s (s.id)}
				<a class="mode" href={s.href}>
					<MenuIcon name={s.id} size={22} />
					<strong>{s.label}</strong>
					<small>{s.blurb}</small>
				</a>
			{/each}
		</nav>
		{#if dev}
			<a class="lab" href="/lab">Lab (dev only)</a>
		{/if}
	</div>
</main>

<style>
	main {
		position: fixed;
		inset: 0;
		overflow: hidden;
		display: grid;
		align-content: end;
		justify-content: center;
		justify-items: center;
		text-align: center;
		padding: 1rem 1rem max(2.2rem, env(safe-area-inset-bottom));
		box-sizing: border-box;
	}
	.corner {
		position: absolute;
		top: max(12px, env(safe-area-inset-top));
		right: max(12px, env(safe-area-inset-right));
		z-index: 2;
	}
	.title {
		position: relative;
		display: grid;
		justify-items: center;
		width: min(46rem, 100%);
	}
	h1 {
		font-size: clamp(2.2rem, 6.5vw, 4rem);
		margin: 0;
		line-height: 0.96;
		color: #05130b;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		font-weight: 800;
		font-style: italic;
		/* The animated series' lockup: dark letters cut out of a green edge */
		-webkit-text-stroke: clamp(3px, 0.5vw, 6px) var(--green);
		paint-order: stroke fill;
		text-shadow:
			0 0 14px color-mix(in srgb, var(--green) 85%, transparent),
			0 0 40px color-mix(in srgb, var(--green) 55%, transparent),
			0 5px 0 rgba(0, 0, 0, 0.55);
	}
	.oath {
		margin: 0.5rem 0 1.4rem;
		font-size: 0.95rem;
		opacity: 0.68;
		font-style: italic;
		letter-spacing: 0.04em;
	}

	/* The one big button */
	.continue {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		width: min(24rem, 100%);
		box-sizing: border-box;
		padding: 0.7rem 1.4rem 0.7rem 0.75rem;
		border-radius: 1rem;
		border: 1px solid var(--green);
		background: linear-gradient(100deg, var(--suit), var(--suit-dark));
		color: #fff;
		text-decoration: none;
		text-align: left;
		box-shadow: 0 0 0 1px rgba(61, 255, 110, 0.25), 0 0 34px rgba(61, 255, 110, 0.25), 0 10px 30px rgba(0, 0, 0, 0.5);
		transition: transform 0.12s, box-shadow 0.12s;
	}
	.continue:hover {
		transform: translateY(-2px);
		box-shadow: 0 0 0 1px rgba(61, 255, 110, 0.45), 0 0 44px rgba(61, 255, 110, 0.35), 0 12px 30px rgba(0, 0, 0, 0.5);
	}
	.continue:active {
		transform: scale(0.98);
	}
	.play {
		display: grid;
		place-items: center;
		width: 2.9rem;
		height: 2.9rem;
		border-radius: 0.75rem;
		background: var(--green);
		color: #04140a;
		flex-shrink: 0;
	}
	.words {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.words strong {
		font-family: var(--font-display);
		font-size: 1.05rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.words small {
		font-size: 0.85rem;
		color: #bfe9c9;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Every mode, one tile each */
	.modes {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 0.5rem;
		width: 100%;
		margin-top: 1rem;
	}
	.mode {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		padding: 0.8rem 0.5rem 0.75rem;
		border-radius: 0.9rem;
		border: 1px solid rgba(61, 255, 110, 0.16);
		background: rgba(3, 12, 8, 0.78);
		color: var(--green-ink, var(--green));
		text-decoration: none;
		transition: border-color 0.12s, background 0.12s;
	}
	.mode:hover,
	.mode:focus-visible {
		border-color: var(--suit-lit);
		background: rgba(15, 79, 52, 0.55);
		outline: none;
	}
	.mode strong {
		color: #fff;
		font-size: 0.9rem;
		letter-spacing: 0.04em;
	}
	.mode small {
		color: #8fb79b;
		font-size: 0.72rem;
		line-height: 1.3;
	}
	.lab {
		margin-top: 0.8rem;
		font-size: 0.8rem;
		opacity: 0.6;
	}

	/* A phone held sideways: no motto, compact tiles in one row */
	@media (max-height: 520px) and (orientation: landscape) {
		main {
			padding-bottom: max(0.8rem, env(safe-area-inset-bottom));
		}
		h1 {
			font-size: 2rem;
			-webkit-text-stroke-width: 2.5px;
		}
		.oath {
			display: none;
		}
		.continue {
			margin-top: 0.7rem;
			padding: 0.45rem 1.1rem 0.45rem 0.5rem;
		}
		.play {
			width: 2.3rem;
			height: 2.3rem;
		}
		.modes {
			margin-top: 0.6rem;
			gap: 0.4rem;
		}
		.mode {
			flex-direction: row;
			justify-content: center;
			padding: 0.55rem 0.4rem;
		}
		.mode small {
			display: none;
		}
		.mode strong {
			font-size: 0.78rem;
		}
		.lab {
			display: none;
		}
	}

	/* A phone held upright: the tiles stack in two columns, the big button full width */
	@media (orientation: portrait) and (max-width: 700px) {
		h1 {
			font-size: clamp(2rem, 11vw, 2.8rem);
			-webkit-text-stroke-width: 2.5px;
		}
		.continue {
			width: 100%;
		}
		.modes {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.mode {
			flex-direction: row;
			justify-content: flex-start;
			gap: 0.6rem;
			padding: 0.75rem 0.8rem;
			text-align: left;
		}
		.mode small {
			display: none;
		}
		/* Five tiles: the first spans the row */
		.mode:first-child {
			grid-column: 1 / -1;
		}
	}
</style>
