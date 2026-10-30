<script lang="ts">
	// Constructs: see what each of Hal's and John's constructs does (a live demo
	// on the stage), what's on their hotbar (keys 1 to 0), and swap in spares.
	// Picking a spare, then a hotbar slot, puts it on that key (armory.svelte.ts).
	import { onMount } from 'svelte';
	import MenuShell from '$lib/components/menu/MenuShell.svelte';
	import ConstructStage from '$lib/components/menu/ConstructStage.svelte';
	import { slidingPill } from '$lib/components/menu/slidingPill';
	import { rise } from '$lib/components/menu/motion';
	import { BUBBLE_SHIELD, CONSTRUCTS, KIT_SIZE, RING_SHOT, constructLabel } from '$lib/engine/constructs/defs';
	import { ABOUT, howToUse } from '$lib/engine/constructs/about';
	import { SIGNATURES } from '$lib/engine/constructs/signature';
	import { demoStill, type DemoSubject } from '$lib/engine/demo';
	import { LANTERNS } from '$lib/engine/lanterns';
	import { armory, type ArmoryLantern } from '$lib/armory.svelte';

	let who = $state<ArmoryLantern>('john');
	/** On the stage: a construct, or one of the three every Lantern has. */
	let shown = $state<DemoSubject>({ kind: 'construct', id: armory.kits.john[0] });
	/** Picked a spare and pressed "Put it on the hotbar": the hotbar is waiting for a slot. */
	let placing = $state(false);
	/** The slot that just changed, for a moment. */
	let landed = $state<number | null>(null);

	const kit = $derived(armory.kits[who]);
	const spares = $derived(armory.spares(who));
	const shownId = $derived(shown.kind === 'construct' ? shown.id : null);
	const slotOf = $derived(shownId ? kit.indexOf(shownId) : -1);

	/** The key for slot i: 1 to 9, then 0. */
	const keyOf = (i: number) => String((i + 1) % 10);

	const ALWAYS = $derived([
		{ subject: { kind: 'shot' } as const, name: RING_SHOT.name, key: 'Left click', text: 'Green bolts in a double tap. Free: it costs no willpower, so you can always fight back.' },
		{ subject: { kind: 'shield' } as const, name: BUBBLE_SHIELD.name, key: 'Shift', text: 'A bubble on you, or on the ally you are locked onto, that soaks up damage until it breaks.' },
		{ subject: { kind: 'signature' } as const, name: SIGNATURES[who].name, key: 'R, when charged', text: SIGNATURES[who].description }
	]);

	/** Name, how it's used, its key and what it does, for whatever is on the stage. */
	const info = $derived.by(() => {
		if (shown.kind !== 'construct') {
			const a = ALWAYS.find((x) => x.subject.kind === shown.kind)!;
			return { name: a.name, tags: [a.key, 'Always ready'], text: a.text };
		}
		const c = CONSTRUCTS[shown.id];
		return { name: c.name, tags: [slotOf >= 0 ? `Key ${keyOf(slotOf)}` : 'Not on the hotbar', howToUse(c.behavior), `${c.cost} willpower`], text: ABOUT[shown.id] ?? '' };
	});

	function pickLantern(id: ArmoryLantern) {
		who = id;
		placing = false;
		shown = { kind: 'construct', id: armory.kits[id][0] };
	}

	function show(subject: DemoSubject) {
		placing = false;
		shown = subject;
	}

	function tapSlot(i: number) {
		if (placing && shownId) {
			armory.place(who, i, shownId);
			placing = false;
			landed = i;
			setTimeout(() => (landed = landed === i ? null : landed), 700);
			return;
		}
		show({ kind: 'construct', id: kit[i] });
	}

	// Stills for the tiles: a frame from each one's own demo, made one at a time so the page stays smooth
	let stills = $state<Record<string, string>>({});
	const stillKey = (lantern: ArmoryLantern, s: DemoSubject) => `${lantern}:${s.kind === 'construct' ? s.id : s.kind}`;
	onMount(() => {
		const todo: [ArmoryLantern, DemoSubject][] = [];
		for (const l of ['john', 'hal'] as const) {
			for (const id of armory.all(l)) todo.push([l, { kind: 'construct', id }]);
			for (const kind of ['shot', 'shield', 'signature'] as const) todo.push([l, { kind }]);
		}
		let alive = true;
		const next = () => {
			if (!alive || !todo.length) return;
			const [l, s] = todo.shift()!;
			try {
				stills = { ...stills, [stillKey(l, s)]: demoStill(l, s, 200, 120) };
			} catch {
				// No still for this one: the tile shows its name alone
			}
			setTimeout(next, 0);
		};
		next();
		return () => (alive = false);
	});
</script>

<svelte:head>
	<title>Constructs · Lantern Corps</title>
</svelte:head>

{#snippet tile(subject: DemoSubject, label: string, badge: string, opts: { slot?: number; spare?: boolean })}
	{@const on = shown.kind === subject.kind && (subject.kind !== 'construct' || (shown.kind === 'construct' && shown.id === subject.id))}
	{@const target = placing && opts.slot !== undefined}
	<button
		class="tile"
		class:on
		class:spare={opts.spare}
		class:target
		class:landed={opts.slot !== undefined && landed === opts.slot}
		onclick={() => (opts.slot !== undefined ? tapSlot(opts.slot) : show(subject))}
		aria-label={target ? `Put it on key ${badge}, instead of ${label}` : `${label}: watch it`}
	>
		<span class="thumb">
			{#if stills[stillKey(who, subject)]}<img src={stills[stillKey(who, subject)]} alt="" />{/if}
			<span class="badge">{badge}</span>
		</span>
		<span class="label">{label}</span>
	</button>
{/snippet}

<MenuShell active="armory">
	<div class="head">
		<div>
			<h1>Constructs</h1>
			<p>Tap any construct to watch it in action. What's on the hotbar is what you take into a fight.</p>
		</div>
	</div>

	<div class="who" role="tablist" aria-label="Lantern" use:slidingPill>
		{#each ['hal', 'john'] as const as id (id)}
			<button role="tab" aria-selected={who === id} class:on={who === id} onclick={() => pickLantern(id)}>
				<strong>{LANTERNS[id].name}</strong>
				<small>{LANTERNS[id].title}</small>
			</button>
		{/each}
	</div>

	<!-- The stage: whatever is picked, live -->
	<section class="show">
		<ConstructStage lantern={who} subject={shown} />
		{#key stillKey(who, shown)}
			<div class="caption" in:rise={{ y: 6, duration: 200 }}>
				<h2>{info.name}</h2>
				<div class="tags">
					{#each info.tags as t, i (t)}<span class:key={i === 0}>{t}</span>{/each}
				</div>
				<p>{info.text}</p>
				{#if shownId && slotOf === -1}
					{#if placing}
						<p class="prompt">Now tap the hotbar slot it should replace <button class="text" onclick={() => (placing = false)}>Cancel</button></p>
					{:else}
						<button class="equip" onclick={() => (placing = true)}>Put it on the hotbar</button>
					{/if}
				{/if}
			</div>
		{/key}
	</section>

	<section class="group">
		<header class="group-head">
			<h2>Hotbar</h2>
			<p>Keys 1 to 0 · {KIT_SIZE} at a time</p>
		</header>
		<div class="bar" class:placing>
			{#each kit as id, i (id)}
				<div in:rise={{ delay: i * 25 }}>{@render tile({ kind: 'construct', id }, constructLabel(CONSTRUCTS[id], false).short, keyOf(i), { slot: i })}</div>
			{/each}
		</div>
		{#if !armory.isUsual(who)}
			<button class="text reset" onclick={() => armory.reset(who)}>Back to {LANTERNS[who].name.split(' ')[0]}'s usual hotbar</button>
		{/if}
	</section>

	{#if spares.length}
		<section class="group">
			<header class="group-head">
				<h2>More constructs</h2>
				<p>Tap one to watch it, then put it on the hotbar</p>
			</header>
			<div class="bar spares">
				{#each spares as id, i (id)}
					<div in:rise={{ delay: 100 + i * 30 }}>{@render tile({ kind: 'construct', id }, constructLabel(CONSTRUCTS[id], false).short, '+', { spare: true })}</div>
				{/each}
			</div>
		</section>
	{/if}

	<section class="group">
		<header class="group-head">
			<h2>Always ready</h2>
			<p>Every fight, no slot needed</p>
		</header>
		<div class="bar always">
			{#each ALWAYS as a (a.subject.kind)}
				{@render tile(a.subject, a.name, a.subject.kind === 'shot' ? '◎' : a.subject.kind === 'shield' ? '⬡' : 'R', {})}
			{/each}
		</div>
	</section>
</MenuShell>

<style>
	/* Hal or John */
	.who {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.3rem;
		padding: 0.3rem;
		margin-bottom: 1rem;
		border: 3px solid var(--ink);
		border-radius: 1.1rem;
		background: var(--well);
	}
	.who button {
		display: grid;
		justify-items: center;
		padding: 0.4rem 0.7rem;
		border: 0;
		border-radius: 0.8rem;
		background: none;
		color: var(--muted);
		font: inherit;
		cursor: pointer;
		transition: color 0.25s;
	}
	.who strong {
		font-family: var(--font-comic);
		font-weight: 400;
		font-size: 1.45rem;
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

	/* ---- the stage and what's on it ---- */
	.show {
		display: grid;
		gap: 0.8rem;
		padding: 0.8rem;
		margin-bottom: 1.4rem;
		border-radius: 1.3rem;
		border: 3px solid var(--ink);
		background: var(--panel);
		box-shadow: 6px 7px 0 var(--ink);
	}
	.caption {
		display: grid;
		gap: 0.45rem;
		justify-items: start;
	}
	.caption h2 {
		margin: 0;
		font-family: var(--font-comic);
		font-weight: 400;
		font-size: 1.9rem;
		letter-spacing: 0.04em;
		line-height: 1;
		color: #fff;
		text-shadow: 2px 3px 0 var(--ink);
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.tags span {
		padding: 0.15rem 0.6rem;
		border-radius: 99px;
		border: 2px solid var(--ink);
		background: var(--well);
		color: var(--muted);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.tags span.key {
		background: var(--gold);
		color: var(--ink);
	}
	.caption p {
		margin: 0;
		color: #d8efdf;
		font-weight: 600;
		line-height: 1.4;
	}
	.equip {
		padding: 0.45rem 1.3rem;
		border-radius: 0.8rem;
		border: 3px solid var(--ink);
		background: var(--green-hi);
		color: #fff;
		font-family: var(--font-comic);
		font-size: 1.25rem;
		letter-spacing: 0.06em;
		-webkit-text-stroke: 1px var(--ink);
		paint-order: stroke fill;
		box-shadow: 0 4px 0 var(--ink);
		cursor: pointer;
		transition: transform 0.08s, box-shadow 0.08s;
	}
	.equip:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 0 var(--ink);
	}
	.equip:active {
		transform: translateY(3px);
		box-shadow: 0 1px 0 var(--ink);
	}
	.caption .prompt {
		color: var(--gold);
		font-weight: 800;
	}
	.text {
		margin-left: 0.4rem;
		padding: 0;
		border: 0;
		background: none;
		color: var(--muted);
		font: inherit;
		font-weight: 700;
		text-decoration: underline;
		cursor: pointer;
	}

	/* ---- tiles: the hotbar, the spares, the always-ready three ---- */
	.bar {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 0.55rem;
	}
	.bar.always {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	.tile {
		display: grid;
		gap: 0.3rem;
		width: 100%;
		padding: 0.3rem;
		border-radius: 0.8rem;
		border: 3px solid var(--ink);
		background: var(--well);
		color: #fff;
		font: inherit;
		cursor: pointer;
		box-shadow: 2px 3px 0 var(--ink);
		transition: transform 0.12s var(--ease-out), box-shadow 0.12s var(--ease-out), background 0.2s;
	}
	.tile:hover {
		transform: translate(-1px, -2px);
		box-shadow: 3px 5px 0 var(--ink);
	}
	.tile.on {
		background: var(--gold);
		color: var(--ink);
	}
	.tile.spare {
		border-style: dashed;
	}
	.thumb {
		position: relative;
		display: block;
		aspect-ratio: 5 / 3;
		border-radius: 0.5rem;
		overflow: hidden;
		background: #0b1a12;
		border: 2px solid var(--ink);
	}
	.thumb img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.badge {
		position: absolute;
		top: 3px;
		left: 3px;
		min-width: 1.35rem;
		height: 1.35rem;
		padding: 0 0.2rem;
		display: grid;
		place-items: center;
		box-sizing: border-box;
		border-radius: 0.4rem;
		border: 2px solid var(--ink);
		background: var(--gold);
		color: var(--ink);
		font-family: var(--font-comic);
		font-size: 0.95rem;
		line-height: 1;
	}
	.tile.spare .badge {
		background: var(--green-hi);
		color: #fff;
	}
	.label {
		font-family: var(--font-comic);
		font-size: 0.95rem;
		letter-spacing: 0.04em;
		line-height: 1.05;
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	/* Waiting for a slot: every hotbar tile wobbles, ready to be replaced */
	.bar.placing .tile.target {
		border-color: var(--gold);
		animation: wobble 0.9s ease-in-out infinite;
	}
	@keyframes wobble {
		0%,
		100% {
			rotate: -1.5deg;
		}
		50% {
			rotate: 1.5deg;
		}
	}
	.tile.landed {
		animation: pick 0.5s var(--ease-out);
		background: var(--gold);
		color: var(--ink);
	}
	.reset {
		margin: 0.7rem 0 0;
	}
	/* A phone on its side: the stage beside its words, so both fit on the screen */
	@media (max-height: 520px) and (orientation: landscape) {
		.show {
			grid-template-columns: 1.5fr 1fr;
			align-items: start;
		}
		.label {
			font-size: 0.85rem;
		}
	}
</style>
