<script lang="ts">
	// Constructs: everything Hal and John build with the ring, what each one does,
	// and the key it's on. John is a Marine with a motor pool: he picks which ten
	// of his constructs to take into a fight (armory.svelte.ts).
	import MenuShell from '$lib/components/menu/MenuShell.svelte';
	import LanternPortrait from '$lib/components/LanternPortrait.svelte';
	import { slidingPill } from '$lib/components/menu/slidingPill';
	import { rise } from '$lib/components/menu/motion';
	import { BUBBLE_SHIELD, CONSTRUCTS, KIT_SIZE, LOADOUTS, RING_SHOT, type ConstructId } from '$lib/engine/constructs/defs';
	import { ABOUT, howToUse } from '$lib/engine/constructs/about';
	import { SIGNATURES } from '$lib/engine/constructs/signature';
	import { LANTERNS } from '$lib/engine/lanterns';
	import { armory } from '$lib/armory.svelte';

	type Who = 'hal' | 'john';
	let who = $state<Who>('john');
	/** Tried to take an eleventh: which one, for a moment. */
	let tooMany = $state<ConstructId | null>(null);

	/** The hotbar key for slot i: 1 to 9, then 0. */
	const keyOf = (i: number) => String((i + 1) % 10);
	const kit = $derived(who === 'john' ? armory.john : LOADOUTS.hal);
	const extras = $derived(who === 'john' ? armory.all.filter((id) => !armory.carrying(id)) : []);

	function take(id: ConstructId) {
		if (!armory.carrying(id) && armory.ready) {
			tooMany = id;
			setTimeout(() => (tooMany = tooMany === id ? null : tooMany), 1600);
			return;
		}
		armory.toggle(id);
	}
</script>

{#snippet slot(id: ConstructId, i: number)}
	{@const c = CONSTRUCTS[id]}
	<span class="badge key">{keyOf(i)}</span>
	<span class="main">
		<small>{howToUse(c.behavior)} · {c.cost} willpower</small>
		<strong>{c.name}</strong>
		<span class="blurb">{ABOUT[id]}</span>
	</span>
{/snippet}

<svelte:head>
	<title>Constructs · Lantern Corps</title>
</svelte:head>

<MenuShell active="armory">
	<div class="head">
		<div>
			<h1>Constructs</h1>
			<p>Everything Hal and John build with the ring. In a fight, keys 1 to 0 pick one and right click builds it.</p>
		</div>
	</div>

	<div class="who" role="tablist" aria-label="Lantern" use:slidingPill>
		{#each ['hal', 'john'] as const as id (id)}
			<button role="tab" aria-selected={who === id} class:on={who === id} onclick={() => (who = id)}>
				<LanternPortrait def={LANTERNS[id]} size={54} />
				<span>
					<strong>{LANTERNS[id].name}</strong>
					<small>{LANTERNS[id].title}</small>
				</span>
			</button>
		{/each}
	</div>

	{#key who}
		<section class="group">
			<header class="group-head">
				<h2>Always ready</h2>
				<p>No key needed</p>
			</header>
			<div class="list">
				{#each [{ name: RING_SHOT.name, how: 'Left click', text: 'Green bolts in a double tap. Free: it costs no willpower, so you can always fight back.' }, { name: BUBBLE_SHIELD.name, how: 'Shift', text: 'A bubble on you, or on the ally you are locked onto, that soaks up damage until it breaks.' }, { name: SIGNATURES[who].name, how: 'R, when charged', text: SIGNATURES[who].description }] as a, i (a.name)}
					<div class="row" in:rise={{ delay: i * 40 }}>
						<span class="badge ring"><span class="glyph">◎</span></span>
						<span class="main">
							<small>{a.how}</small>
							<strong>{a.name}</strong>
							<span class="blurb">{a.text}</span>
						</span>
					</div>
				{/each}
			</div>
		</section>

		<section class="group">
			<header class="group-head">
				<h2>{who === 'john' ? 'Taking into the fight' : 'His ten'}</h2>
				{#if who === 'john'}
					<p class:short={!armory.ready}>{armory.john.length} / {KIT_SIZE}{armory.ready ? '' : ': pick ten, or he takes his usual kit'}</p>
				{:else}
					<p>A test pilot's kit: flashy, fast, and a little showy</p>
				{/if}
			</header>
			<div class="list">
				{#each kit as id, i (id)}
					{#if who === 'john'}
						<button class="row construct pick" in:rise={{ delay: 120 + i * 30 }} onclick={() => take(id)} aria-label="{CONSTRUCTS[id].name}: leave behind">
							{@render slot(id, i)}
							<span class="aside"><span class="tag">Leave</span></span>
						</button>
					{:else}
						<div class="row construct" in:rise={{ delay: 120 + i * 30 }}>{@render slot(id, i)}</div>
					{/if}
				{/each}
			</div>
		</section>

		{#if who === 'john'}
			<section class="group">
				<header class="group-head">
					<h2>The motor pool</h2>
					<p>{extras.length ? 'Tap one to take it along' : 'Everything he owns is in his kit'}</p>
				</header>
				<div class="list">
					{#each extras as id, i (id)}
						{@const c = CONSTRUCTS[id]}
						<button class="row construct pick spare" class:refused={tooMany === id} in:rise={{ delay: 200 + i * 30 }} onclick={() => take(id)} aria-label="{c.name}: take along">
							<span class="badge key">+</span>
							<span class="main">
								<small>{howToUse(c.behavior)} · {c.cost} willpower</small>
								<strong>{c.name}</strong>
								<span class="blurb">{tooMany === id ? `He already has ${KIT_SIZE}. Leave one behind first.` : ABOUT[id]}</span>
							</span>
							<span class="aside"><span class="go">Take</span></span>
						</button>
					{/each}
				</div>
				<button class="reset" onclick={() => armory.reset()}>His usual kit</button>
			</section>
		{/if}
	{/key}
</MenuShell>

<style>
	/* Hal or John: two big tabs with the gold highlight sliding between them */
	.who {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.3rem;
		padding: 0.3rem;
		margin-bottom: 1.2rem;
		border: 3px solid var(--ink);
		border-radius: 1.1rem;
		background: var(--well);
	}
	.who button {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.3rem 0.7rem;
		border: 0;
		border-radius: 0.8rem;
		background: none;
		color: var(--muted);
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition: color 0.25s;
	}
	.who button span {
		display: grid;
	}
	.who strong {
		font-family: var(--font-comic);
		font-weight: 400;
		font-size: 1.4rem;
		letter-spacing: 0.05em;
		color: #fff;
		text-shadow: 2px 2px 0 var(--ink);
		transition: color 0.25s, text-shadow 0.25s;
	}
	.who small {
		font-size: 0.72rem;
		font-weight: 700;
	}
	.who button.on {
		color: #4a4413;
	}
	.who button.on strong {
		color: var(--ink);
		text-shadow: none;
	}
	.who :global(.pill) {
		border-radius: 0.8rem;
		background: var(--gold);
		box-shadow: inset 0 0 0 2px var(--ink), 0 3px 0 var(--ink);
	}

	/* A construct row, as a button for John (tap to take or leave) */
	button.row {
		width: 100%;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.row.pick:hover {
		background: var(--panel-hi);
		transform: translate(-1px, -2px);
		box-shadow: 4px 6px 0 var(--ink);
	}
	.row.pick:active {
		transform: translate(2px, 3px);
		box-shadow: 1px 1px 0 var(--ink);
	}
	.badge.key {
		font-family: var(--font-comic);
		font-size: 1.3rem;
	}
	/* What a construct does is the point of this page: never cut short, even on a phone
	   (specific enough to beat the shared row style, which clamps it) */
	.group .list .row .blurb {
		-webkit-line-clamp: unset;
		line-clamp: unset;
		display: block;
	}
	.row.spare .badge.key {
		font-size: 1.7rem;
	}
	.badge.ring .glyph {
		font-size: 1.3rem;
		line-height: 1;
	}
	/* Spares sit back a little until you take one */
	.row.spare {
		background: var(--well);
	}
	.row.spare .badge {
		border-style: dashed;
	}
	.row.refused {
		animation: shake 0.4s;
	}
	.row.refused .blurb {
		color: var(--gold);
	}
	@keyframes shake {
		20%,
		60% {
			translate: -6px 0;
		}
		40%,
		80% {
			translate: 6px 0;
		}
	}
	.group-head p.short {
		color: var(--gold);
		font-weight: 700;
	}
	.reset {
		margin-top: 0.8rem;
		padding: 0.45rem 1rem;
		border-radius: 99px;
		border: 2px solid var(--ink);
		background: var(--well);
		color: var(--muted);
		font: inherit;
		font-weight: 700;
		font-size: 0.85rem;
		cursor: pointer;
		box-shadow: 2px 3px 0 var(--ink);
	}
	.reset:hover {
		color: #fff;
	}
	@media (max-width: 520px) {
		.who button :global(canvas) {
			display: none;
		}
	}
</style>
