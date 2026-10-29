<script lang="ts">
	// The frame every menu page sits in, one column down the middle like the
	// title screen: the emblem (back to the title), a switch between the
	// sections, and the page itself in a card-width column that scrolls.
	//
	// The pages share one look through the classes styled here: .head, .seg,
	// .group, .row (badge, main, aside, .go) and .panel.
	import type { Snippet } from 'svelte';
	import Emblem from '$lib/components/Emblem.svelte';
	import FullscreenButton from '$lib/touch/FullscreenButton.svelte';
	import { campaign } from '$lib/campaign.svelte';
	import Backdrop from './Backdrop.svelte';
	import MenuIcon, { SECTIONS, type SectionId } from './MenuIcon.svelte';
	import { slidingPill } from './slidingPill';

	interface Props {
		active: SectionId;
		children: Snippet;
	}
	let { active, children }: Props = $props();

	const stars = $derived(Object.values(campaign.current.done).reduce((n, s) => n + s, 0));
</script>

<div class="shell">
	<Backdrop />

	<div class="corner left">
		<a class="back" href="/" aria-label="Title screen"><MenuIcon name="home" size={18} /></a>
	</div>
	<div class="corner right">
		<span class="stars" title="Stars earned"><MenuIcon name="star" size={15} />{stars}</span>
		<FullscreenButton compact />
	</div>

	<main class="body">
		<div class="page">
			<header class="top">
				<a class="brand" href="/" aria-label="Title screen">
					<Emblem size={46} glow={false} />
					<span>Lantern Corps</span>
				</a>
				<nav class="switch" aria-label="Menu" use:slidingPill>
					{#each SECTIONS as s (s.id)}
						<!-- Named so the labels stay above the highlight while it slides across pages -->
						<a class:on={s.id === active} href={s.href} aria-current={s.id === active ? 'page' : undefined} style:view-transition-name="menu-{s.id}">
							<MenuIcon name={s.id} size={17} />
							{s.label}
						</a>
					{/each}
				</nav>
			</header>
			<div class="content">
				{@render children()}
			</div>
		</div>
	</main>
</div>

<style>
	.shell {
		--green: #00711d; /* the menu green (the user's pick) */
		--green-ink: #3fb562; /* green text: a lighter tint of it, readable on the dark panels */
		--green-hi: #19a83d; /* the bright, flat green of buttons */
		--panel: #145236;
		--panel-hi: #19603f;
		--well: #0d3b26;
		--line: var(--ink);
		--line-hi: var(--ink);
		--muted: #a6d4b3;
		--gold: #ffd84a;
		position: fixed;
		inset: 0;
		color: var(--text);
	}

	.corner {
		position: fixed;
		z-index: 3;
		top: max(12px, env(safe-area-inset-top));
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.corner.left {
		left: max(12px, env(safe-area-inset-left));
	}
	.corner.right {
		right: max(12px, env(safe-area-inset-right));
	}
	.back {
		box-shadow: 2px 3px 0 var(--ink);
		display: grid;
		place-items: center;
		width: 2.4rem;
		height: 2.4rem;
		border-radius: 50%;
		border: 3px solid var(--ink);
		background: var(--panel);
		color: #fff;
	}
	.stars {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.35rem 0.7rem;
		border-radius: 99px;
		border: 3px solid var(--ink);
		background: var(--panel);
		color: var(--gold);
		font-weight: 800;
		font-size: 0.9rem;
		box-shadow: 2px 3px 0 var(--ink);
	}

	/* --- the column --- */
	.body {
		position: absolute;
		inset: 0;
		z-index: 1;
		overflow-y: auto;
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
	}
	.page {
		width: min(38rem, 100%);
		box-sizing: border-box;
		margin: 0 auto;
		padding: max(1.4rem, env(safe-area-inset-top)) 1rem calc(max(2.5rem, env(safe-area-inset-bottom)) + var(--install-space));
	}
	.top {
		display: grid;
		justify-items: center;
		gap: 1rem;
		margin-bottom: 1.4rem;
	}
	.brand {
		display: grid;
		justify-items: center;
		gap: 0.3rem;
		text-decoration: none;
		color: #7dff9e;
		font-family: var(--font-comic);
		font-size: 1.7rem;
		letter-spacing: 0.06em;
		-webkit-text-stroke: 2px var(--ink);
		paint-order: stroke fill;
		text-shadow: 2px 3px 0 var(--ink);
	}
	.brand :global(.emblem) {
		filter: drop-shadow(2px 3px 0 var(--ink));
	}
	.switch {
		display: flex;
		gap: 0.3rem;
		padding: 0.3rem;
		border-radius: 99px;
		border: 3px solid var(--ink);
		background: var(--well);
		box-shadow: 3px 4px 0 var(--ink);
	}
	.switch a {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.5rem 1.1rem;
		border-radius: 99px;
		color: var(--muted);
		text-decoration: none;
		font-weight: 700;
		font-size: 0.9rem;
		transition: color 0.25s;
	}
	.switch a:hover {
		color: #fff;
	}
	.switch a.on {
		color: var(--ink);
	}
	/* The gold highlight: slides to the picked section, and across pages too */
	.switch :global(.pill) {
		border-radius: 99px;
		background: var(--gold);
		box-shadow: inset 0 0 0 2px var(--ink);
		view-transition-name: menu-pill;
	}
	/* What changes from page to page: it slides in under the shell, which stays put */
	.content {
		view-transition-name: page;
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
		font-family: var(--font-comic);
		font-weight: 400;
		font-size: 2.6rem;
		color: #fff;
		letter-spacing: 0.05em;
		-webkit-text-stroke: 2px var(--ink);
		paint-order: stroke fill;
		text-shadow: 3px 4px 0 var(--ink);
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
		border: 3px solid var(--ink);
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
		background: var(--gold);
		border-color: var(--ink);
		color: var(--ink);
	}
	.page :global(.seg button.on small) {
		color: var(--ink);
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
		font-family: var(--font-comic);
		font-weight: 400;
		font-size: 1.4rem;
		color: #7dff9e;
		letter-spacing: 0.06em;
		text-shadow: 2px 2px 0 var(--ink);
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
		border: 3px solid var(--ink);
		background: var(--panel);
		color: var(--text);
		text-decoration: none;
		box-shadow: 3px 4px 0 var(--ink);
		transition: background 0.1s, transform 0.1s, box-shadow 0.1s;
	}
	.page :global(a.row:hover),
	.page :global(a.row:focus-visible) {
		background: var(--panel-hi);
		transform: translate(-1px, -2px);
		box-shadow: 4px 6px 0 var(--ink);
		outline: none;
	}
	.page :global(a.row:active) {
		transform: translate(2px, 3px);
		box-shadow: 1px 1px 0 var(--ink);
	}
	.page :global(.row .badge) {
		width: 2.6rem;
		height: 2.6rem;
		display: grid;
		place-items: center;
		border-radius: 0.7rem;
		background: var(--well);
		border: 3px solid var(--ink);
		color: #fff;
		font-family: var(--font-comic);
		font-weight: 400;
		font-size: 1.3rem;
	}
	.page :global(.row .main) {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}
	.page :global(.row .main strong) {
		font-family: var(--font-comic);
		font-size: 1.3rem;
		letter-spacing: 0.05em;
		color: #fff;
		font-weight: 400;
		text-shadow: 2px 2px 0 var(--ink);
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
		border: 3px solid var(--ink);
		background: var(--green-hi);
		color: #fff;
		box-shadow: 0 4px 0 var(--ink);
		font-family: var(--font-comic);
		font-size: 1.1rem;
		font-weight: 400;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		white-space: nowrap;
		text-decoration: none;
		cursor: pointer;
	}
	.page :global(a.row:hover .go),
	.page :global(.go.solid) {
		background: #22c24a;
	}

	/* Done: a gold badge */
	.page :global(.row.done .badge) {
		background: #fff8d6;
		color: var(--ink);
	}
	/* Up next: the one to play */
	.page :global(.row.next) {
		background: var(--panel-hi);
	}
	.page :global(.row.next .badge) {
		background: var(--gold);
		color: var(--ink);
	}
	/* Locked or not built yet: quiet, one line */
	.page :global(.row.locked) {
		background: var(--well);
		border-style: dashed;
		box-shadow: none;
		padding-top: 0.55rem;
		padding-bottom: 0.55rem;
	}
	.page :global(.row.locked .badge) {
		background: transparent;
		border-style: dashed;
		color: #6f9a7e;
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
		box-shadow: 4px 5px 0 var(--ink);
		border-radius: 1rem;
		border: 3px solid var(--ink);
		background: var(--panel);
		padding: 1rem 1.1rem;
	}

	/* ===== A phone held sideways: everything tighter ===== */
	@media (max-height: 520px) and (orientation: landscape) {
		.page {
			padding-top: 0.7rem;
		}
		.top {
			grid-template-columns: auto auto;
			justify-content: center;
			align-items: center;
			gap: 1.2rem;
			margin-bottom: 0.8rem;
		}
		.brand {
			grid-auto-flow: column;
			align-items: center;
			gap: 0.5rem;
			font-size: 0.75rem;
		}
		.brand :global(svg) {
			width: 30px;
			height: 30px;
		}
		.switch a {
			padding: 0.35rem 0.9rem;
			font-size: 0.8rem;
		}
		.page :global(.head h1) {
			font-size: 1.3rem;
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
	}

	/* ===== A phone held upright: no room for a score beside the button ===== */
	@media (max-width: 520px) {
		.page {
			padding-top: max(3.6rem, env(safe-area-inset-top));
		}
		.page :global(.row) {
			gap: 0.7rem;
			padding: 0.65rem 0.75rem;
			grid-template-columns: 2.3rem minmax(0, 1fr) auto;
		}
		.page :global(.row .aside) {
			flex-direction: column;
			align-items: flex-end;
			gap: 0.35rem;
		}
		.page :global(.go) {
			min-width: 0;
			padding: 0 0.8rem;
		}
	}
</style>
