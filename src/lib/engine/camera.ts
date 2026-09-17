// The camera decides which part of the world is on screen.
//
// (x, y) is the WORLD point shown at the centre of the screen. It glides
// toward its target instead of snapping, and never shows past the map edge.
// `zoom` > 1 draws the world bigger, so characters are easier to see.

import type { View } from './canvas';

/** How quickly the camera catches up. Higher = snappier. */
const FOLLOW_RATE = 6;

export class Camera {
	x = 0;
	y = 0;
	/** Position at the start of the last tick, to smooth rendering like players. */
	prevX = 0;
	prevY = 0;
	zoom: number;

	constructor(zoom = 1.6) {
		this.zoom = zoom;
	}

	/** Jump straight to a target (used when a level starts). */
	snapTo(tx: number, ty: number, view: View, mapW: number, mapH: number) {
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
