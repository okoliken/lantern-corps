<script lang="ts" module>
	/** The menu's sections, in the order they are shown everywhere. */
	export const SECTIONS = [
		{ id: 'missions', href: '/missions', label: 'Missions', blurb: 'The story, act by act' },
		{ id: 'school', href: '/school', label: 'Training', blurb: 'Learn the ring, pass the drills' },
		{ id: 'spar', href: '/spar', label: 'Sparring', blurb: 'One on one with anyone' },
		{ id: 'skirmish', href: '/skirmish', label: 'Skirmish', blurb: 'Five Red Lanterns, three lives' },
		{ id: 'hq', href: '/hq', label: 'Corps HQ', blurb: 'Levels and upgrades' }
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
	{:else if name === 'spar'}
		<path d="M4 4l9 9" /><path d="M4 4h4" /><path d="M4 4v4" /><path d="M20 4l-9 9" /><path d="M20 4h-4" /><path d="M20 4v4" /><path d="M7 17l-3 3" /><path d="M17 17l3 3" /><path d="M9 15l-2 2" /><path d="M15 15l2 2" />
	{:else if name === 'skirmish'}
		<path d="M12 2l2.2 5.6L20 6l-3.4 4.8L22 13l-5.8 1.2L17 20l-5-3.4L7 20l.8-5.8L2 13l5.4-2.2L4 6l5.8 1.6z" />
	{:else if name === 'hq'}
		<path d="M12 3l8 3v6c0 4.6-3.4 8-8 9-4.6-1-8-4.4-8-9V6z" /><path d="M12 8v7" /><path d="M9 11l3-3 3 3" />
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
