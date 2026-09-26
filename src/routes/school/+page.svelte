<script lang="ts">
	// Survival School: two teachers, two ideas about staying alive.
	import MenuPoster from '$lib/components/MenuPoster.svelte';
	import Emblem from '$lib/components/Emblem.svelte';
	import { LESSONS, TEACHERS, type Teacher } from '$lib/engine/missions/school';
	import { records } from '$lib/records.svelte';
	import { settings } from '$lib/settings.svelte';

	const byTeacher = (who: Teacher) => LESSONS.filter((l) => l.teacher === who);
	/** Katma's half of the school is written but not built yet. */
	const KATMA_TO_COME = [
		{ name: 'The Feint', brief: 'Build something big and obvious. Hit them with something small they never saw.' },
		{ name: 'Read the Room', brief: 'Every opponent has a tell. Watch before you commit.' },
		{ name: 'The Yellow Problem', brief: 'Some things the ring cannot touch. Move the ground, not the target.' },
		{ name: 'Use Everything', brief: 'Debris, terrain, their own momentum. The ring moves what is already there.' }
	];
</script>

<MenuPoster />
<div class="shade"></div>

<header class="bar">
	<a class="brand" href="/">
		<Emblem size={26} />
		<span class="name">Lantern Corps</span>
	</a>
	<nav class="tabs">
		<a href="/missions">Missions</a>
		<a class="on" href="/school">Training</a>
		<a href="/spar">Sparring</a>
		<a href="/skirmish">Skirmish</a>
		<a href="/hq">Corps HQ</a>
	</nav>
</header>

<main>
	<div class="rail">
		<h1>Survival School</h1>
		<p class="lead">Kilowog keeps you alive. Katma Tui makes you dangerous. Nothing here touches the story.</p>

		<a class="card first" href="/training">
			<span class="text">
				<strong>Corps training</strong>
				<small>With Kilowog · about 3 minutes</small>
				<span>Everything a ring does, one thing at a time. Start here if it is new.</span>
			</span>
			<span class="score">{settings.current.trained ? 'Done' : 'Start'}</span>
		</a>

		{#each ['kilowog', 'katma'] as const as who (who)}
			<section>
				<header class="teacher">
					<h2>{TEACHERS[who].name}</h2>
					<p>{TEACHERS[who].line}</p>
				</header>

				{#each byTeacher(who) as lesson (lesson.id)}
					{@const best = records.best(`school:${lesson.id}`)}
					<a class="card" class:passed={best >= lesson.pass} href="/school/{lesson.id}">
						<span class="text">
							<strong>{lesson.name}</strong>
							<small>{lesson.place} · {lesson.seconds} seconds · pass at {lesson.pass}</small>
							<span>{lesson.brief}</span>
						</span>
						<span class="score">
							{#if best > 0}
								<b>{best}</b><i>{lesson.unit}</i>
							{:else}
								<i>not taken</i>
							{/if}
						</span>
					</a>
				{/each}

				{#if who === 'katma'}
					{#each KATMA_TO_COME as lesson (lesson.name)}
						<div class="card locked">
							<span class="text">
								<strong>{lesson.name}</strong>
								<small>Tactics hall · being built</small>
								<span>{lesson.brief}</span>
							</span>
						</div>
					{/each}
				{/if}
			</section>
		{/each}

		<div class="card locked exam">
			<span class="text">
				<strong>Final exam</strong>
				<small>Drill yard · two on one · being built</small>
				<span>Both teachers at once. One hits hard, one hits smart. Pass it and you graduate.</span>
			</span>
		</div>

		<div class="rule"></div>
		<nav class="plain"><a href="/">Main menu</a></nav>
	</div>
</main>

<style>
	:global(body) {
		overflow-y: auto;
	}
	.shade {
		position: fixed;
		inset: 0;
		background: linear-gradient(90deg, rgba(2, 8, 6, 0.94) 0%, rgba(2, 8, 6, 0.86) 42%, rgba(2, 8, 6, 0.35) 100%);
		z-index: 0;
	}
	.bar {
		position: relative;
		z-index: 2;
		display: flex;
		align-items: stretch;
		gap: clamp(1rem, 4vw, 2.5rem);
		min-height: 3.4rem;
		padding: 0 clamp(0.8rem, 4vw, 3rem);
		background: linear-gradient(rgba(2, 8, 6, 0.94), rgba(2, 8, 6, 0.6));
		border-bottom: 1px solid color-mix(in srgb, var(--suit-lit) 55%, transparent);
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		text-decoration: none;
		color: var(--text);
		flex-shrink: 0;
	}
	.name {
		font-family: var(--font-display);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		font-size: 0.82rem;
	}
	.tabs {
		display: flex;
		align-items: stretch;
		gap: clamp(0.9rem, 3vw, 1.6rem);
		overflow-x: auto;
		scrollbar-width: none;
		margin-bottom: -1px;
	}
	.tabs::-webkit-scrollbar {
		display: none;
	}
	.tabs a {
		display: flex;
		align-items: center;
		white-space: nowrap;
		text-decoration: none;
		color: color-mix(in srgb, var(--text) 62%, transparent);
		text-transform: uppercase;
		letter-spacing: 0.12em;
		font-size: 0.76rem;
		font-weight: 600;
		border-bottom: 3px solid transparent;
	}
	.tabs a:hover {
		color: var(--text);
	}
	.tabs a.on {
		color: var(--green);
		border-bottom-color: var(--green);
	}
	main {
		position: relative;
		z-index: 1;
		padding: 1.4rem clamp(1rem, 4vw, 3rem) 4rem;
	}
	.rail {
		display: grid;
		gap: 0.6rem;
		width: min(40rem, 100%);
	}
	h1 {
		margin: 0;
		font-size: 1.6rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--green);
	}
	.lead {
		margin: 0 0 0.6rem;
		font-size: 0.86rem;
		opacity: 0.6;
		max-width: 32rem;
	}
	section {
		display: grid;
		gap: 0.5rem;
		margin-top: 0.8rem;
	}
	.teacher {
		border-left: 3px solid var(--green);
		padding-left: 0.8rem;
	}
	.teacher h2 {
		margin: 0;
		font-size: 1.05rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.teacher p {
		margin: 0;
		font-size: 0.74rem;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: var(--green);
		opacity: 0.85;
	}
	.card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem 0.9rem;
		border: 1px solid color-mix(in srgb, var(--suit-lit) 40%, transparent);
		border-left: 3px solid transparent;
		border-radius: 4px;
		background: rgba(4, 14, 10, 0.75);
		text-decoration: none;
		color: var(--text);
	}
	a.card:hover {
		border-color: var(--green);
		border-left-color: var(--green);
		background: color-mix(in srgb, var(--suit) 40%, rgba(4, 14, 10, 0.75));
	}
	.card.first {
		border-left-color: var(--green);
	}
	.card.passed {
		border-left-color: #ffd21e;
	}
	.card.locked {
		opacity: 0.42;
		border-style: dashed;
	}
	.text {
		display: grid;
		gap: 0.15rem;
	}
	.text strong {
		font-family: var(--font-display);
		letter-spacing: 0.05em;
		color: var(--green);
		text-transform: uppercase;
		font-size: 0.95rem;
	}
	.text small {
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		opacity: 0.55;
	}
	.text span {
		font-size: 0.84rem;
		opacity: 0.78;
		max-width: 28rem;
	}
	.score {
		display: grid;
		justify-items: end;
		gap: 0.1rem;
		white-space: nowrap;
		color: var(--green);
	}
	.score b {
		font-family: var(--font-display);
		font-size: 1.3rem;
	}
	.score i {
		font-style: normal;
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		opacity: 0.6;
	}
	.rule {
		height: 1px;
		margin: 1rem 0 0.2rem;
		background: linear-gradient(90deg, color-mix(in srgb, var(--suit-lit) 70%, transparent), transparent);
	}
	.plain a {
		color: color-mix(in srgb, var(--text) 75%, transparent);
		text-decoration: none;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		font-size: 0.78rem;
		font-weight: 600;
	}
	.plain a:hover {
		color: var(--green);
	}
	@media (max-height: 560px) {
		.bar {
			min-height: 2.5rem;
		}
		main {
			padding: 0.7rem clamp(0.6rem, 3vw, 1.4rem) 2rem;
		}
		h1 {
			font-size: 1.15rem;
		}
		.lead {
			font-size: 0.74rem;
		}
		.card {
			padding: 0.5rem 0.6rem;
		}
		.text strong {
			font-size: 0.85rem;
		}
		.text span {
			font-size: 0.72rem;
		}
		.score b {
			font-size: 1rem;
		}
	}
</style>
