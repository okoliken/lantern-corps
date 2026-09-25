<script lang="ts">
	// The Corps' emblem, drawn once and used wherever it is needed: a thick
	// green rim, a pale field inside it, and the lantern on that field.
	interface Props {
		/** Size in px. */
		size?: number;
		/** A soft halo around it, for dark backgrounds. */
		glow?: boolean;
		title?: string;
	}
	let { size = 24, glow = true, title }: Props = $props();
</script>

<svg
	class="emblem"
	class:glow
	viewBox="0 0 100 100"
	width={size}
	height={size}
	role={title ? 'img' : 'presentation'}
	aria-label={title}
	aria-hidden={title ? undefined : 'true'}
>
	<circle cx="50" cy="50" r="48" fill="var(--green)" />
	<circle cx="50" cy="50" r="35" fill="#e8f7ea" />
	<rect x="8" y="26" width="84" height="11" rx="3" fill="var(--green)" />
	<rect x="8" y="63" width="84" height="11" rx="3" fill="var(--green)" />
	<circle cx="50" cy="50" r="16" fill="none" stroke="var(--green)" stroke-width="7" />
	<circle cx="50" cy="50" r="9" fill="#f2fff4" />
</svg>

<style>
	.emblem {
		display: block;
		flex-shrink: 0;
	}
	.glow {
		filter: drop-shadow(0 0 6px color-mix(in srgb, var(--green) 65%, transparent));
	}
</style>
