<script lang="ts" module>
	/** The menu's sections, in the order they are shown everywhere. */
	export const SECTIONS = [
		{ id: 'missions', href: '/missions', label: 'Missions', blurb: 'The story, act by act' },
		{ id: 'school', href: '/school', label: 'Training', blurb: 'Learn the ring, pass the drills' },
		{ id: 'armory', href: '/armory', label: 'Constructs', blurb: "What Hal and John build, and John's kit" },
	] as const;
	export type SectionId = (typeof SECTIONS)[number]['id'];
</script>

<script lang="ts">
	interface Props {
		name: SectionId | 'home' | 'lock' | 'play' | 'star';
		size?: number;
	}
	let { name, size = 22 }: Props = $props();
</script>

<svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
	{#if name === 'missions'}
		<path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" />
	{:else if name === 'school'}
		<circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.6" fill="currentColor" />
	{:else if name === 'armory'}
		<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
	{:else if name === 'home'}
		<path d="M15 18l-6-6 6-6" />
	{:else if name === 'lock'}
		<rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
	{:else if name === 'play'}
		<path d="M8 5l11 7-11 7z" fill="currentColor" />
	{:else if name === 'star'}
		<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" fill="currentColor" stroke="none" />
	{/if}
</svg>
