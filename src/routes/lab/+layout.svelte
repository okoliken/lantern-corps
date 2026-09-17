<script lang="ts">
	let { children } = $props();
</script>

<div class="lab">
	<header>
		<a href="/lab">🧪 Lab</a>
		<span class="tag">dev only</span>
		<a class="menu" href="/">Menu</a>
	</header>
	<div class="body">
		{@render children()}
	</div>
</div>

<style>
	.lab {
		position: fixed;
		inset: 0;
		display: flex;
		flex-direction: column;
	}
	header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 1rem;
		border-bottom: 1px dashed var(--green-dim);
		font-size: 0.9rem;
	}
	header a {
		text-decoration: none;
		font-weight: 600;
	}
	.tag {
		font-size: 0.7rem;
		padding: 0.1rem 0.4rem;
		border: 1px solid var(--green-dim);
		border-radius: 4px;
		opacity: 0.7;
	}
	.menu {
		margin-left: auto;
	}
	.body {
		flex: 1;
		min-height: 0;
		overflow: auto;
	}
</style>
