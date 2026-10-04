<script lang="ts">
	// Survival School: two teachers, two ideas about staying alive.
	import MenuShell from '$lib/components/menu/MenuShell.svelte';
	import MenuIcon from '$lib/components/menu/MenuIcon.svelte';
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

<svelte:head>
	<title>Training · Lantern Corps</title>
</svelte:head>

<MenuShell active="school">
	<div class="head">
		<div>
			<h1>Survival School</h1>
			<p>Kilowog keeps you alive. Katma Tui makes you dangerous. Nothing here touches the story.</p>
		</div>
	</div>

	<div class="list">
		<a class="row" class:done={settings.current.trained} class:next={!settings.current.trained} href="/training">
			<span class="badge"><MenuIcon name="school" size={20} /></span>
			<span class="main">
				<small>With Kilowog · about 3 minutes</small>
				<strong>Corps training</strong>
				<span class="blurb">Everything a ring does, one thing at a time. Start here if it is new.</span>
			</span>
			<span class="aside">
				{#if settings.current.trained}<span class="score"><b>Done</b></span>{/if}
				<span class="go"><MenuIcon name="play" size={12} />{settings.current.trained ? 'Again' : 'Start'}</span>
			</span>
		</a>
	</div>

	{#each ['kilowog', 'katma'] as const as who (who)}
		<section class="group">
			<header class="group-head">
				<h2>{TEACHERS[who].name}</h2>
				<p>{TEACHERS[who].line}</p>
			</header>
			<div class="list">
				{#each byTeacher(who) as lesson, i (lesson.id)}
					{@const best = records.best(`school:${lesson.id}`)}
					<a class="row" class:done={best >= lesson.pass} href="/school/{lesson.id}">
						<span class="badge">{i + 1}</span>
						<span class="main">
							<small>{lesson.place} · {lesson.seconds} seconds · pass at {lesson.pass}</small>
							<strong>{lesson.name}</strong>
							<span class="blurb">{lesson.brief}</span>
						</span>
						<span class="aside">
							<span class="score">
								{#if best > 0}<b>{best}</b>{lesson.unit}{:else}Not taken{/if}
							</span>
							<span class="go"><MenuIcon name="play" size={12} />Go</span>
						</span>
					</a>
				{/each}
				{#if who === 'katma'}
					{#each KATMA_TO_COME as lesson (lesson.name)}
						<div class="row locked">
							<span class="badge"><MenuIcon name="lock" size={16} /></span>
							<span class="main">
								<strong>{lesson.name}</strong>
								<span class="blurb">{lesson.brief}</span>
							</span>
							<span class="aside"><span class="tag">Being built</span></span>
						</div>
					{/each}
				{/if}
			</div>
		</section>
	{/each}

	<section class="group">
		<header class="group-head"><h2>Final exam</h2></header>
		<div class="list">
			<div class="row locked">
				<span class="badge"><MenuIcon name="lock" size={16} /></span>
				<span class="main">
					<strong>Final exam</strong>
					<span class="blurb">Both teachers at once. One hits hard, one hits smart. Pass it and you graduate.</span>
				</span>
				<span class="aside"><span class="tag">Being built</span></span>
			</div>
		</div>
	</section>
</MenuShell>
