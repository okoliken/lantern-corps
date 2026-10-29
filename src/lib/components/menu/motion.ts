// The menus' motion: short, springy, and off for anyone whose device asks for
// less motion. CSS animations are switched off in +layout.svelte; Svelte's
// transitions run in JS, so they ask here.

import { cubicOut } from 'svelte/easing';
import type { TransitionConfig } from 'svelte/transition';

/** True when the device asks for reduced motion. */
export const still = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Rise into place: up a few pixels and in from clear. Lists use `delay` to land one after another. */
export function rise(_node: Element, { delay = 0, duration = 260, y = 12 } = {}): TransitionConfig {
	if (still()) return { duration: 0 };
	return {
		delay,
		duration,
		easing: cubicOut,
		css: (t, u) => `opacity: ${t}; transform: translateY(${u * y}px) scale(${0.98 + 0.02 * t})`
	};
}

/** Open downward: height and padding grow from nothing while it fades in. */
export function unfold(node: Element, { duration = 220 } = {}): TransitionConfig {
	if (still()) return { duration: 0 };
	const style = getComputedStyle(node);
	const height = parseFloat(style.height);
	const top = parseFloat(style.paddingTop);
	const bottom = parseFloat(style.paddingBottom);
	return {
		duration,
		easing: cubicOut,
		css: (t) => `overflow: hidden; opacity: ${t}; height: ${t * height}px; padding-top: ${t * top}px; padding-bottom: ${t * bottom}px`
	};
}
