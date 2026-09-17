<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Lantern Corps</title>
</svelte:head>

{@render children()}

<style>
	:global(:root) {
		--green: #3dff6e;
		--green-dim: #1f7a3a;
		--bg: #03060a;
		--text: #d8f5e0;
	}
	:global(html, body) {
		margin: 0;
		height: 100%;
		background: var(--bg);
		color: var(--text);
		font-family: system-ui, sans-serif;
	}
	:global(a) {
		color: var(--green);
	}
</style>
