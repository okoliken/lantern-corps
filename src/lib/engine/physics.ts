// Shared movement-with-collisions for anything that walks, flies, or gets
// knocked around: players, training dummies, and (in M5) enemies.

/**
 * Something solid in the world. The rectangle is its FOOTPRINT on the
 * ground; how tall it looks is only a drawing detail.
 */
export interface Solid {
	x: number;
	y: number;
	w: number;
	h: number;
	/** Tall things (asteroids, energy walls) stop flyers too. Buildings and rocks don't. */
	blocksFlying: boolean;
}

/** Anything with a position and velocity. */
export interface Body {
	x: number;
	y: number;
	vx: number;
	vy: number;
}

/** Does a box of half-size (hw, hh) centred at (x, y) overlap this solid? Touching edges don't count. */
export function boxOverlap(x: number, y: number, hw: number, hh: number, s: Solid): boolean {
	return x + hw > s.x && x - hw < s.x + s.w && y + hh > s.y && y - hh < s.y + s.h;
}

/**
 * Move along ONE axis, then push back out of anything we moved into.
 * Doing x and y separately is what lets you slide along a wall when you
 * run into it diagonally, instead of sticking to it.
 */
export function moveAxis(
	b: Body,
	axis: 'x' | 'y',
	delta: number,
	solids: readonly Solid[],
	hw: number,
	hh: number
) {
	if (delta === 0) return;
	b[axis] += delta;

	for (const s of solids) {
		if (!boxOverlap(b.x, b.y, hw, hh, s)) continue;
		if (axis === 'x') {
			b.x = delta > 0 ? s.x - hw : s.x + s.w + hw;
			b.vx = 0;
		} else {
			b.y = delta > 0 ? s.y - hh : s.y + s.h + hh;
			b.vy = 0;
		}
	}
}

/** Move a body by its velocity for one tick, colliding with solids. */
export function moveBody(b: Body, dt: number, solids: readonly Solid[], hw: number, hh: number) {
	moveAxis(b, 'x', b.vx * dt, solids, hw, hh);
	moveAxis(b, 'y', b.vy * dt, solids, hw, hh);
}

/** Move `current` toward `target` by at most `maxDelta`. */
export function approach(current: number, target: number, maxDelta: number): number {
	if (current < target) return Math.min(current + maxDelta, target);
	return Math.max(current - maxDelta, target);
}
