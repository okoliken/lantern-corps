// Things a game running on a phone's own screen needs from the browser: no
// zooming on a quick double tap or two thumbs, fullscreen and landscape where
// the browser allows it, and the screen kept awake. Shared by the phone pad
// (/pad) and the on-screen touch controls.

import type { TouchControlsMode } from '$lib/engine/settings';

/** A touch screen with no mouse (a phone or a tablet). */
export function isTouchScreen(): boolean {
	if (typeof window === 'undefined') return false;
	return window.matchMedia?.('(pointer: coarse)').matches === true && !window.matchMedia?.('(any-pointer: fine)').matches;
}

/**
 * Should the game show its own touch controls? The setting decides; ?touch=1
 * or ?touch=0 in the address overrides it (handy for testing on a laptop).
 */
export function wantsTouchControls(mode: TouchControlsMode): boolean {
	const forced = new URLSearchParams(location.search).get('touch');
	if (forced === '1') return true;
	if (forced === '0') return false;
	return mode === 'on' || (mode === 'auto' && isTouchScreen());
}

const NO_ZOOM = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';

/**
 * Phone browsers zoom on a quick double tap or two thumbs at once, and ignore
 * "no zoom" for accessibility. While playing that's never wanted: take the
 * touches, and snap back if it zoomed anyway. Returns the undo.
 */
export function stopZooming(): () => void {
	// The site's own viewport tag comes first and would win: change it rather than add another
	let meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
	if (!meta) {
		meta = document.createElement('meta');
		meta.name = 'viewport';
		document.head.appendChild(meta);
	}
	const before = meta.content;
	meta.content = NO_ZOOM;
	const block = (e: Event) => e.preventDefault();
	const options = { passive: false } as const;
	const events = ['touchstart', 'touchmove', 'dblclick', 'gesturestart', 'gesturechange'];
	for (const name of events) document.addEventListener(name, block, options);
	// Zoomed in anyway: nudge the viewport tag to make the browser snap back to 1
	const unzoom = () => {
		const vv = window.visualViewport;
		if (!vv || vv.scale <= 1.01) return;
		meta!.content = NO_ZOOM.replace('initial-scale=1', 'initial-scale=0.99');
		requestAnimationFrame(() => (meta!.content = NO_ZOOM));
	};
	window.visualViewport?.addEventListener('resize', unzoom);
	return () => {
		for (const name of events) document.removeEventListener(name, block);
		window.visualViewport?.removeEventListener('resize', unzoom);
		meta!.content = before;
	};
}

/** Fullscreen and landscape, where the browser allows it (not iPhone Safari: it still works, with the bars). */
export async function goFullscreen() {
	try {
		if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
		await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape');
	} catch {
		// Not allowed here
	}
}

/** Keep the screen from going to sleep mid-fight. Returns the undo. */
export function keepAwake(): () => void {
	type Lock = { release: () => Promise<void> };
	let lock: Lock | null = null;
	let gone = false;
	const request = () => {
		void (navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<Lock> } }).wakeLock
			?.request('screen')
			.then((l) => {
				if (gone) void l.release();
				else lock = l;
			})
			.catch(() => {});
	};
	request();
	// The lock is dropped whenever the tab is hidden: take it again on the way back
	const back = () => {
		if (!document.hidden) request();
	};
	document.addEventListener('visibilitychange', back);
	return () => {
		gone = true;
		document.removeEventListener('visibilitychange', back);
		void lock?.release();
	};
}
