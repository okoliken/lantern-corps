// The camera decides which part of the world is on screen.
//
// (x, y) is the WORLD point shown at the centre of the screen. It glides
// toward its target instead of snapping, and never shows past the map edge.
// `zoom` > 1 draws the world bigger, so characters are easier to see.

import type { View } from './canvas';

/** How quickly the camera catches up. Higher = snappier. */
const FOLLOW_RATE = 6;
/** How quickly zoom eases toward what's wanted (slower than moving, so it doesn't pump). */
const ZOOM_RATE = 2.5;

export class Camera {
	x = 0;
	y = 0;
	/** Position at the start of the last tick, to smooth rendering like players. */
	prevX = 0;
	prevY = 0;
	zoom: number;
	/** The normal, closest zoom. The camera only ever zooms OUT from here. */
	readonly baseZoom: number;
	/** Furthest it zooms out to fit everyone in. */
	minZoom = 1;

	constructor(zoom = 1.6) {
		this.zoom = zoom;
		this.baseZoom = zoom;
	}

	/**
	 * Ease zoom so a box of world px (width, height) fits on screen,
	 * never closer than baseZoom or further than minZoom.
	 */
	fit(width: number, height: number, dt: number, view: View) {
		const s = screenScale(view);
		const wanted = Math.min(this.baseZoom * s, view.width / Math.max(width, 1), view.height / Math.max(height, 1));
		const target = Math.max(this.minZoom * s, wanted);
		this.zoom += (target - this.zoom) * (1 - Math.exp(-ZOOM_RATE * dt));
	}

	/** Jump straight to a target (used when a level starts). */
	snapTo(tx: number, ty: number, view: View, mapW: number, mapH: number) {
		// A small screen starts zoomed out as far as it will play
		this.zoom = Math.min(this.zoom, this.baseZoom * screenScale(view));
		this.x = this.prevX = clampCameraAxis(tx, view.width / this.zoom, mapW);
		this.y = this.prevY = clampCameraAxis(ty, view.height / this.zoom, mapH);
	}

	/** One tick of following. */
	follow(tx: number, ty: number, dt: number, view: View, mapW: number, mapH: number) {
		this.prevX = this.x;
		this.prevY = this.y;
		// Exponential smoothing: close a fixed fraction of the gap each tick.
		// Using exp() keeps the feel the same at any tick rate.
		const k = 1 - Math.exp(-FOLLOW_RATE * dt);
		this.x = clampCameraAxis(this.x + (tx - this.x) * k, view.width / this.zoom, mapW);
		this.y = clampCameraAxis(this.y + (ty - this.y) * k, view.height / this.zoom, mapH);
	}
}

/** The screen size the zooms are tuned for (a laptop). */
const DESIGN_VIEW = { width: 1280, height: 720 };
/** On a small screen (a phone) the camera zooms out, but never below this, or everything is too small to see. */
const MIN_SCREEN_SCALE = 0.55;

/**
 * How much smaller than a laptop screen this one is (1 at laptop size and up):
 * the camera's zooms are scaled by it, so a phone sees about as much of the
 * fight as a laptop, just smaller.
 */
export function screenScale(view: View): number {
	if (view.width <= 0 || view.height <= 0) return 1;
	return Math.max(MIN_SCREEN_SCALE, Math.min(1, view.width / DESIGN_VIEW.width, view.height / DESIGN_VIEW.height));
}

/**
 * Keep the camera centre where the screen never shows outside the map.
 * If the map is smaller than the screen on this axis, just centre it.
 *
 * @param center  wanted centre, in world px
 * @param span    how much world fits on screen along this axis
 * @param mapSize map length along this axis
 */
export function clampCameraAxis(center: number, span: number, mapSize: number): number {
	const half = span / 2;
	if (span >= mapSize) return mapSize / 2;
	return Math.min(Math.max(center, half), mapSize - half);
}
