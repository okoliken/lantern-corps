<script lang="ts">
	// Index of test pages. Add a line here for each new lab.
	const labs = [
		{ href: '/lab/loop', name: 'Game loop', about: 'Fixed timestep: fps vs ups, simulated lag.' },
		{ href: '/lab/movement', name: 'Movement & world', about: 'Both Lanterns, test maps, flying/landing, camera zoom, collision boxes.' },
		{ href: '/lab/animation', name: 'Animation', about: 'Every Lantern animation up close, slow motion, skeleton view.' },
		{ href: '/lab/enemies', name: 'Enemies', about: 'Fight Red Lanterns: spawn them, god mode, freeze AI, see their states.' },
		{ href: '/lab/constructs', name: 'Constructs', about: 'Every construct on training dummies. Switch Lantern, infinite willpower.' }
	];
</script>

<main>
	<h2>Test labs</h2>
	<p>Each lab runs one piece of the engine on its own.</p>
	<ul>
		{#each labs as lab (lab.href)}
			<li>
				<a href={lab.href}>{lab.name}</a>
				<span>{lab.about}</span>
			</li>
		{/each}
	</ul>
</main>

<style>
	main {
		padding: 1rem 1.5rem;
		max-width: 40rem;
	}
	ul {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 0.75rem;
	}
	li {
		display: grid;
		gap: 0.15rem;
	}
	span {
		opacity: 0.7;
		font-size: 0.9rem;
	}
</style>
