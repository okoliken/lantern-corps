// The beam: the first construct. A straight line of ring energy that stops
// at the first solid thing it hits and damages it if it can be broken.

import type { Solid } from './player';

/** Longest reach, in world px. */
export const BEAM_RANGE = 420;
/** Damage per second to whatever the beam is touching. */
export const BEAM_DPS = 80;

export interface BeamHit<T extends Solid> {
	/** How far the beam travels before stopping (BEAM_RANGE if it hits nothing). */
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
	range = BEAM_RANGE
): BeamHit<T> {
	let best: BeamHit<T> = { length: range, hit: null };

	for (const s of solids) {
		const [enterX, exitX] = slab(ox, dx, s.x, s.x + s.w);
		const [enterY, exitY] = slab(oy, dy, s.y, s.y + s.h);
		const enter = Math.max(enterX, enterY);
		const exit = Math.min(exitX, exitY);

		if (enter > exit) continue; // misses the box
		if (enter < 0) continue; // starts inside it (or it's behind us)
		if (enter < best.length) best = { length: enter, hit: s };
	}
	return best;
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
