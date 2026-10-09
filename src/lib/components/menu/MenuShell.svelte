<script lang="ts">
	// The frame every menu page sits in: the sections down the side (a rail on a
	// desktop or a phone held sideways, a tab bar along the bottom on a phone held
	// upright), and the page itself in a column that scrolls on its own.
	//
	// The pages share one look through the classes styled here: .head, .seg,
	// .group, .row (badge, main, aside, .go) and .panel.
	import type { Snippet } from 'svelte';
	import Emblem from '$lib/components/Emblem.svelte';
	import FullscreenButton from '$lib/touch/FullscreenButton.svelte';
	import { campaign } from '$lib/campaign.svelte';
	import MenuIcon, { SECTIONS, type SectionId } from './MenuIcon.svelte';

	interface Props {
		active: SectionId;
		children: Snippet;
	}
	let { active, children }: Props = $props();

	const stars = $derived(Object.values(campaign.current.done).reduce((n, s) => n + s, 0));
</script>

<div class="shell">
	<div class="backdrop" aria-hidden="true">
		<span class="glow"></span>
	</div>

	<nav class="rail" aria-label="Menu">
		<a class="brand" href="/" aria-label="Title screen">
			<Emblem size={30} />
			<span>Lantern<br />Corps</span>
		</a>
		<div class="items">
			{#each SECTIONS as s (s.id)}
				<a class="item" class:on={s.id === active} href={s.href} aria-current={s.id === active ? 'page' : undefined}>
					<MenuIcon name={s.id} />
					<span>{s.label}</span>
				</a>
			{/each}
		</div>
		<div class="foot">
			<span class="stars" title="Stars earned"><MenuIcon name="star" size={16} />{stars}</span>
			<FullscreenButton compact />
		</div>
	</nav>

	<header class="topbar">
		<a class="brand" href="/" aria-label="Title screen">
			<MenuIcon name="home" size={18} />
			<Emblem size={24} />
			<span>Lantern Corps</span>
		</a>
		<span class="stars" title="Stars earned"><MenuIcon name="star" size={14} />{stars}</span>
	</header>

	<main class="body">
		<div class="page">
			{@render children()}
		</div>
	</main>
</div>

<style>
	.shell {
		--green: #00711d; /* the menu green (the user's pick) */
		--green-ink: #3fb562; /* green text: a lighter tint of it, readable on the dark panels */
		--panel: rgba(8, 22, 15, 0.86);
		--panel-hi: rgba(14, 40, 26, 0.92);
		--line: rgba(61, 255, 110, 0.14);
		--line-hi: rgba(61, 255, 110, 0.45);
		--muted: #8fb79b;
		--gold: #ffd84a;
		position: fixed;
		inset: 0;
		display: grid;
		grid-template-columns: 13.5rem minmax(0, 1fr);
		grid-template-rows: minmax(0, 1fr);
		color: var(--text);
	}

	/* Quiet behind the lists: a dark field with one soft green light, nothing to read through the cards */
	.backdrop {
		position: absolute;
		inset: 0;
		background: radial-gradient(ellipse 80% 60% at 70% 0%, #0b2216 0%, #050d09 55%, #020504 100%);
		z-index: 0;
		overflow: hidden;
	}
	.glow {
		position: absolute;
		right: -10rem;
		top: -12rem;
		width: 36rem;
		height: 36rem;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(61, 255, 110, 0.12), transparent 65%);
	}

	/* --- the rail --- */
	.rail {
		position: relative;
		z-index: 2;
		display: flex;
		flex-direction: column;
		gap: 1.2rem;
		padding: max(1.2rem, env(safe-area-inset-top)) 0.8rem max(1rem, env(safe-area-inset-bottom)) max(0.8rem, env(safe-area-inset-left));
		background: rgba(3, 10, 7, 0.82);
		border-right: 1px solid var(--line);
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.2rem 0.4rem;
		text-decoration: none;
		color: #fff;
		font-family: var(--font-display);
		font-size: 0.78rem;
		line-height: 1.15;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.items {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-height: 2.9rem;
		padding: 0 0.85rem;
		border-radius: 0.7rem;
		color: var(--muted);
		text-decoration: none;
		font-weight: 600;
		font-size: 0.95rem;
		letter-spacing: 0.02em;
		border: 1px solid transparent;
		transition: background 0.12s, color 0.12s;
	}
	.item:hover {
		color: #fff;
		background: rgba(255, 255, 255, 0.04);
	}
	.item.on {
		color: #fff;
		background: var(--suit);
		border-color: var(--suit-lit);
		box-shadow: 0 0 18px rgba(61, 255, 110, 0.14);
	}
	.item.on :global(svg) {
		color: var(--green-ink, var(--green));
	}
	.foot {
		margin-top: auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0 0.3rem;
	}
	.stars {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		color: var(--gold);
		font-weight: 700;
		font-size: 0.95rem;
	}
	.topbar {
		display: none;
	}

	/* --- the page column --- */
	.body {
		position: relative;
		z-index: 1;
		overflow-y: auto;
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
	}
	.page {
		max-width: 52rem;
		margin: 0 auto;
		padding: 2rem 2rem 3rem;
		padding-right: max(2rem, env(safe-area-inset-right));
	}

	/* ===== The shared page pieces ===== */
	.page :global(.head) {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 1.2rem;
	}
	.page :global(.head h1) {
		margin: 0;
		font-size: 1.9rem;
		color: #fff;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		text-shadow: 0 0 22px rgba(61, 255, 110, 0.35);
	}
	.page :global(.head p) {
		margin: 0.35rem 0 0;
		color: var(--muted);
		font-size: 0.95rem;
		max-width: 36rem;
		line-height: 1.4;
	}

	/* A segmented control: acts, who you fight as, which Lantern */
	.page :global(.seg) {
		display: flex;
		gap: 0.4rem;
		padding: 0.3rem;
		margin-bottom: 1rem;
		border-radius: 0.9rem;
		background: rgba(0, 0, 0, 0.35);
		border: 1px solid var(--line);
		overflow-x: auto;
		scrollbar-width: none;
	}
	.page :global(.seg::-webkit-scrollbar) {
		display: none;
	}
	.page :global(.seg button) {
		flex: 1 0 auto;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.1rem;
		min-height: 2.6rem;
		padding: 0.4rem 0.9rem;
		border: 1px solid transparent;
		border-radius: 0.65rem;
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-weight: 600;
		font-size: 0.9rem;
		text-align: left;
		cursor: pointer;
		white-space: nowrap;
	}
	.page :global(.seg button small) {
		font-size: 0.65rem;
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		opacity: 0.8;
	}
	.page :global(.seg button:hover) {
		color: #fff;
	}
	.page :global(.seg button.on) {
		background: var(--suit);
		border-color: var(--suit-lit);
		color: #fff;
	}
	.page :global(.seg button.on small) {
		color: var(--green-ink, var(--green));
		opacity: 1;
	}

	/* A group of rows under a small heading */
	.page :global(.group) {
		margin-top: 1.6rem;
	}
	.page :global(.group-head) {
		display: flex;
		align-items: baseline;
		gap: 0.8rem;
		flex-wrap: wrap;
		margin: 0 0 0.6rem;
		padding-left: 0.2rem;
	}
	.page :global(.group-head h2) {
		margin: 0;
		font-size: 0.85rem;
		color: var(--green-ink, var(--green));
		text-transform: uppercase;
		letter-spacing: 0.16em;
	}
	.page :global(.group-head p) {
		margin: 0;
		font-size: 0.85rem;
		color: var(--muted);
	}
	.page :global(.list) {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	/* A row: badge, the words, and what you can do with it */
	.page :global(.row) {
		display: grid;
		grid-template-columns: 2.6rem minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.9rem;
		padding: 0.75rem 0.9rem;
		border-radius: 0.9rem;
		border: 1px solid var(--line);
		background: var(--panel);
		color: var(--text);
		text-decoration: none;
		transition: border-color 0.12s, background 0.12s, transform 0.12s;
	}
	.page :global(a.row:hover),
	.page :global(a.row:focus-visible) {
		border-color: var(--line-hi);
		background: var(--panel-hi);
		outline: none;
	}
	.page :global(a.row:active) {
		transform: scale(0.99);
	}
	.page :global(.row .badge) {
		width: 2.6rem;
		height: 2.6rem;
		display: grid;
		place-items: center;
		border-radius: 0.7rem;
		background: rgba(61, 255, 110, 0.08);
		border: 1px solid var(--line);
		color: var(--green-ink, var(--green));
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1rem;
	}
	.page :global(.row .main) {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}
	.page :global(.row .main strong) {
		font-family: var(--font-display);
		font-size: 1rem;
		letter-spacing: 0.03em;
		color: #fff;
		font-weight: 600;
	}
	.page :global(.row .main small) {
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.page :global(.row .blurb) {
		font-size: 0.88rem;
		line-height: 1.35;
		color: #c3dfca;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.page :global(.row .aside) {
		display: flex;
		align-items: center;
		gap: 0.8rem;
	}
	.page :global(.row .score) {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		font-size: 0.7rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--muted);
		white-space: nowrap;
	}
	.page :global(.row .score b) {
		font-size: 1.05rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		color: #fff;
		text-transform: none;
	}
	.page :global(.row .pips) {
		display: flex;
		gap: 0.1rem;
		color: rgba(255, 255, 255, 0.16);
	}
	.page :global(.row .pips .on) {
		color: var(--gold);
	}
	.page :global(.go) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		min-height: 2.5rem;
		min-width: 5.5rem;
		padding: 0 1rem;
		border-radius: 0.7rem;
		border: 1px solid var(--suit-lit);
		background: rgba(15, 79, 52, 0.35);
		color: #e8fff0;
		font-family: var(--font-display);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		white-space: nowrap;
		text-decoration: none;
		cursor: pointer;
	}
	.page :global(a.row:hover .go),
	.page :global(.go.solid) {
		background: var(--suit);
		color: #fff;
	}

	/* Done: a gold badge */
	.page :global(.row.done .badge) {
		background: rgba(255, 216, 74, 0.12);
		border-color: rgba(255, 216, 74, 0.4);
		color: var(--gold);
	}
	/* Up next: the one to play */
	.page :global(.row.next) {
		border-color: var(--green);
		background: linear-gradient(100deg, rgba(15, 79, 52, 0.75), var(--panel));
		box-shadow: 0 0 0 1px rgba(61, 255, 110, 0.3), 0 0 28px rgba(61, 255, 110, 0.14);
	}
	.page :global(.row.next .badge) {
		background: var(--green);
		color: #ffffff;
		border-color: var(--green);
	}
	.page :global(.row.next .go) {
		background: var(--suit);
		border-color: var(--green);
		color: #fff;
		box-shadow: 0 0 14px rgba(61, 255, 110, 0.3);
	}
	/* Locked or not built yet: quiet, one line */
	.page :global(.row.locked) {
		background: rgba(4, 10, 7, 0.6);
		border-style: dashed;
		border-color: rgba(143, 183, 155, 0.18);
		padding-top: 0.55rem;
		padding-bottom: 0.55rem;
	}
	.page :global(.row.locked .badge) {
		background: transparent;
		border-color: rgba(143, 183, 155, 0.18);
		color: #5d7666;
	}
	.page :global(.row.locked .main strong) {
		color: #a9bfb0;
	}
	.page :global(.row.locked .blurb) {
		color: #7f9787;
		-webkit-line-clamp: 1;
		line-clamp: 1;
	}
	.page :global(.row .tag) {
		font-size: 0.68rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #6f8a78;
		white-space: nowrap;
	}

	/* A plain card for anything that isn't a list */
	.page :global(.panel) {
		border-radius: 1rem;
		border: 1px solid var(--line);
		background: var(--panel);
		padding: 1rem 1.1rem;
	}

	/* ===== A phone held sideways: a slim icon rail, everything tighter ===== */
	@media (max-height: 520px) and (orientation: landscape) {
		.shell {
			grid-template-columns: calc(4.6rem + env(safe-area-inset-left)) minmax(0, 1fr);
		}
		.rail {
			gap: 0.4rem;
			padding: 0.5rem 0.35rem max(0.4rem, env(safe-area-inset-bottom)) calc(0.35rem + env(safe-area-inset-left));
			align-items: stretch;
		}
		.rail .brand {
			justify-content: center;
			padding: 0.1rem 0;
		}
		.rail .brand span {
			display: none;
		}
		.items {
			gap: 0.15rem;
			flex: 1;
			justify-content: center;
		}
		.item {
			flex-direction: column;
			justify-content: center;
			gap: 0.1rem;
			min-height: 2.9rem;
			padding: 0.2rem 0;
			font-size: 0.62rem;
			letter-spacing: 0.03em;
			border-radius: 0.6rem;
			text-align: center;
		}
		.foot {
			flex-direction: column;
			margin-top: 0;
			gap: 0.3rem;
		}
		.foot :global(button) {
			display: none;
		}
		.stars {
			font-size: 0.75rem;
		}
		.page {
			padding: 0.8rem 1rem 1.5rem;
			padding-right: max(1rem, env(safe-area-inset-right));
		}
		.page :global(.head) {
			margin-bottom: 0.6rem;
		}
		.page :global(.head h1) {
			font-size: 1.3rem;
		}
		.page :global(.head p) {
			font-size: 0.85rem;
			margin-top: 0.15rem;
		}
		.page :global(.seg) {
			margin-bottom: 0.6rem;
		}
		.page :global(.seg button) {
			min-height: 2.3rem;
			padding: 0.25rem 0.75rem;
		}
		.page :global(.group) {
			margin-top: 1rem;
		}
		.page :global(.row) {
			padding: 0.5rem 0.7rem;
			gap: 0.7rem;
			grid-template-columns: 2.2rem minmax(0, 1fr) auto;
		}
		.page :global(.row .badge) {
			width: 2.2rem;
			height: 2.2rem;
			font-size: 0.9rem;
		}
		.page :global(.row .blurb) {
			-webkit-line-clamp: 1;
			line-clamp: 1;
			font-size: 0.82rem;
		}
		.page :global(.go) {
			min-height: 2.3rem;
			min-width: 4.8rem;
		}
	}

	/* ===== A phone held upright: a top bar, the sections as a tab bar along the bottom ===== */
	@media (orientation: portrait) and (max-width: 700px) {
		.shell {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto minmax(0, 1fr) auto;
		}
		.topbar {
			position: relative;
			z-index: 2;
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: max(0.6rem, env(safe-area-inset-top)) 1rem 0.6rem;
			background: rgba(3, 10, 7, 0.82);
			border-bottom: 1px solid var(--line);
		}
		.topbar .brand {
			font-size: 0.75rem;
			padding: 0;
			gap: 0.45rem;
			color: var(--muted);
		}
		.topbar .brand span {
			color: #fff;
		}
		.rail {
			grid-row: 3;
			flex-direction: row;
			padding: 0.3rem 0.3rem max(0.4rem, env(safe-area-inset-bottom));
			border-right: none;
			border-top: 1px solid var(--line);
			background: rgba(3, 10, 7, 0.94);
		}
		.rail .brand,
		.foot {
			display: none;
		}
		.items {
			flex-direction: row;
			flex: 1;
			gap: 0.2rem;
		}
		.item {
			flex: 1;
			flex-direction: column;
			justify-content: center;
			gap: 0.15rem;
			min-height: 3.3rem;
			padding: 0.2rem 0;
			font-size: 0.66rem;
			text-align: center;
			min-width: 0;
		}
		.body {
			grid-row: 2;
		}
		.page {
			padding: 1rem 1rem 1.6rem;
		}
		.page :global(.head h1) {
			font-size: 1.5rem;
		}
		.page :global(.row) {
			gap: 0.7rem;
			padding: 0.65rem 0.75rem;
			grid-template-columns: 2.3rem minmax(0, 1fr) auto;
		}
		.page :global(.row .badge) {
			width: 2.3rem;
			height: 2.3rem;
		}
		.page :global(.go) {
			min-width: 0;
			padding: 0 0.8rem;
		}
		/* No room for a score beside the button: it moves under the words */
		.page :global(.row .aside) {
			flex-direction: column;
			align-items: flex-end;
			gap: 0.35rem;
		}
	}
</style>
