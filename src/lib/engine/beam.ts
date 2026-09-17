// Raycasting: which solids does a straight line hit?
// Used by the beam (first hit) and the sniper rifle (every hit along the line).

import type { Solid } from './physics';

export interface BeamHit<T extends Solid> {
	/** How far the beam travels before stopping (`range` if it hits nothing). */
	length: number;
	/** The solid it stopped on, if any. */
	hit: T | null;
}

/**
 * Cast a ray from (ox, oy) along the unit direction (dx, dy) and find the
 * nearest solid it enters within `range`.
 *
 * Uses the "slab" method: for each axis, work out the distance along the
 * ray where it enters and leaves the box's range on that axis. The ray is
 * inside the box only where those overlap: from the LATER entry to the
 * EARLIER exit.
 *
 * Solids the ray starts inside are ignored, so a Lantern flying over a
 * building can still shoot out past it.
 */
export function castBeam<T extends Solid>(
	ox: number,
	oy: number,
	dx: number,
	dy: number,
	solids: readonly T[],
	range: number
): BeamHit<T> {
	let best: BeamHit<T> = { length: range, hit: null };
	for (const s of solids) {
		const enter = rayEnter(ox, oy, dx, dy, s);
		if (enter !== null && enter < best.length) best = { length: enter, hit: s };
	}
	return best;
}

/**
 * Every solid the ray enters within `range`, nearest first. For shots that
 * pierce through several things (the Sniper Rifle).
 */
export function castThrough<T extends Solid>(
	ox: number,
	oy: number,
	dx: number,
	dy: number,
	solids: readonly T[],
	range: number
): { distance: number; hit: T }[] {
	const hits: { distance: number; hit: T }[] = [];
	for (const s of solids) {
		const enter = rayEnter(ox, oy, dx, dy, s);
		if (enter !== null && enter <= range) hits.push({ distance: enter, hit: s });
	}
	return hits.sort((a, b) => a.distance - b.distance);
}

/** How far along the ray it enters this box, or null if it misses (or starts inside). */
function rayEnter(ox: number, oy: number, dx: number, dy: number, s: Solid): number | null {
	const [enterX, exitX] = slab(ox, dx, s.x, s.x + s.w);
	const [enterY, exitY] = slab(oy, dy, s.y, s.y + s.h);
	const enter = Math.max(enterX, enterY);
	const exit = Math.min(exitX, exitY);
	if (enter > exit) return null; // misses the box
	if (enter < 0) return null; // starts inside it (or it's behind us)
	return enter;
}

/** Distances along the ray where it is between min and max on one axis. */
function slab(origin: number, dir: number, min: number, max: number): [number, number] {
	if (dir === 0) {
		// Parallel to this axis: either always inside the slab or never.
		return origin >= min && origin <= max ? [-Infinity, Infinity] : [Infinity, -Infinity];
	}
	const t1 = (min - origin) / dir;
	const t2 = (max - origin) / dir;
	return t1 < t2 ? [t1, t2] : [t2, t1];
}
