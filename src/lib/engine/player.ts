// A Player is one Lantern in the world, driven by one InputSource.

import type { InputSource, Intent } from './input';
import type { LanternDef } from './lanterns';
import { MAX_WILLPOWER } from './willpower';

export interface Player {
	/** 0 = player 1, 1 = player 2. */
	slot: number;
	def: LanternDef;
	input: InputSource;
	/** Anchor position: the feet when walking, the spot below them when flying. */
	x: number;
	y: number;
	/** Position at the start of the last tick, used to smooth rendering. */
	prevX: number;
	prevY: number;
	vx: number;
	vy: number;
	/** Which way the Lantern faces on screen: 1 = right, -1 = left. */
	dir: 1 | -1;
	/** Advances while walking; drives the leg swing animation. Always 0 in the air. */
	walkPhase: number;
	/** Off the ground (or heading there). In space this is always true. */
	flying: boolean;
	/** 0 = on the ground, 1 = fully airborne. Eases between them on take-off/landing. */
	altitude: number;
	/** Direction the ring points (unit vector): the last direction you moved in. */
	aimX: number;
	aimY: number;
	/** 0..MAX_WILLPOWER. Powers every construct. */
	willpower: number;
	/** The beam is on right now. */
	firing: boolean;
	/** How far the beam reached this tick (for drawing). */
	beamLength: number;
	/** Drawing power from a Lantern battery this tick (for drawing the link). */
	charging: boolean;
}

/**
 * Something solid in the world. The rectangle is its FOOTPRINT on the
 * ground; how tall it looks is only a drawing detail.
 */
export interface Solid {
	x: number;
	y: number;
	w: number;
	h: number;
	/** Tall things (asteroids) stop flyers too. Buildings and rocks don't. */
	blocksFlying: boolean;
}

/** What the player needs to know about the world to move through it. */
export interface WorldRules {
	solids: readonly Solid[];
	/** Space: no landing allowed. */
	alwaysFlying: boolean;
}

const OPEN_WORLD: WorldRules = { solids: [], alwaysFlying: false };

/** Flying is faster than walking. */
export const FLY_SPEED_BONUS = 1.25;
/** Holding the beam steady slows you down. */
export const FIRING_SPEED_FACTOR = 0.55;
/** Seconds to rise from the ground to full height (and back down). */
export const TAKEOFF_TIME = 0.25;
/** The collision box around a Lantern's anchor (their feet): 16 x 10 px. */
export const FEET_HALF_W = 8;
export const FEET_HALF_H = 5;

export function createPlayer(slot: number, def: LanternDef, input: InputSource, x: number, y: number): Player {
	return {
		slot,
		def,
		input,
		x,
		y,
		prevX: x,
		prevY: y,
		vx: 0,
		vy: 0,
		dir: 1,
		walkPhase: 0,
		flying: false,
		altitude: 0,
		aimX: 1,
		aimY: 0,
		willpower: MAX_WILLPOWER,
		firing: false,
		beamLength: 0,
		charging: false
	};
}

/** Move `current` toward `target` by at most `maxDelta`. */
function approach(current: number, target: number, maxDelta: number): number {
	if (current < target) return Math.min(current + maxDelta, target);
	return Math.max(current - maxDelta, target);
}

/** Does a feet box centred at (x, y) overlap this solid? Touching edges don't count. */
export function feetOverlap(x: number, y: number, s: Solid): boolean {
	return (
		x + FEET_HALF_W > s.x && x - FEET_HALF_W < s.x + s.w && y + FEET_HALF_H > s.y && y - FEET_HALF_H < s.y + s.h
	);
}

/**
 * One tick of movement. Pure apart from mutating `p`, and takes the Intent as
 * an argument instead of reading input itself, which keeps it easy to test.
 */
export function updatePlayer(p: Player, intent: Intent, dt: number, world: WorldRules = OPEN_WORLD) {
	p.prevX = p.x;
	p.prevY = p.y;

	// ---- Take off / land ----
	if (world.alwaysFlying) {
		p.flying = true;
	} else if (intent.toggleFly) {
		if (!p.flying) {
			p.flying = true;
		} else if (!world.solids.some((s) => feetOverlap(p.x, p.y, s))) {
			// Only land on open ground. Landing on a building would trap you inside it.
			p.flying = false;
		}
	}
	p.altitude = approach(p.altitude, p.flying ? 1 : 0, dt / TAKEOFF_TIME);

	// ---- Steering ----
	const { accel, decel } = p.def;
	const maxSpeed = p.def.maxSpeed * (p.flying ? FLY_SPEED_BONUS : 1) * (p.firing ? FIRING_SPEED_FACTOR : 1);
	const moving = intent.moveX !== 0 || intent.moveY !== 0;

	// Steer velocity toward where the input points. Speeding up uses accel,
	// coasting to a stop uses decel. That gives a slight "flying" feel
	// instead of instant start/stop.
	const rate = (moving ? accel : decel) * dt;
	p.vx = approach(p.vx, intent.moveX * maxSpeed, rate);
	p.vy = approach(p.vy, intent.moveY * maxSpeed, rate);

	// ---- Moving, with collisions ----
	// Flyers only bump into things tall enough to block the sky.
	const blocking = p.flying ? world.solids.filter((s) => s.blocksFlying) : world.solids;
	moveAxis(p, 'x', p.vx * dt, blocking);
	moveAxis(p, 'y', p.vy * dt, blocking);

	// Only left/right input flips the character. Moving straight up or down
	// keeps whichever way they were already facing.
	if (intent.moveX !== 0) p.dir = intent.moveX > 0 ? 1 : -1;

	// The ring aims wherever you last pushed. Input is already normalized.
	if (moving) {
		p.aimX = intent.moveX;
		p.aimY = intent.moveY;
	}

	// Walking legs cycle faster the faster you go. Flying Lanterns don't walk.
	const speed = Math.hypot(p.vx, p.vy);
	p.walkPhase = !p.flying && speed > 5 ? p.walkPhase + speed * dt * 0.045 : 0;
}

/**
 * Move along ONE axis, then push back out of anything we walked into.
 * Doing x and y separately is what lets you slide along a wall when you
 * run into it diagonally, instead of sticking to it.
 */
function moveAxis(p: Player, axis: 'x' | 'y', delta: number, solids: readonly Solid[]) {
	if (delta === 0) return;
	p[axis] += delta;

	for (const s of solids) {
		if (!feetOverlap(p.x, p.y, s)) continue;
		if (axis === 'x') {
			p.x = delta > 0 ? s.x - FEET_HALF_W : s.x + s.w + FEET_HALF_W;
			p.vx = 0;
		} else {
			p.y = delta > 0 ? s.y - FEET_HALF_H : s.y + s.h + FEET_HALF_H;
			p.vy = 0;
		}
	}
}

/** Keep a player inside a rectangle, killing velocity into the edge. */
export function clampToBounds(p: Player, minX: number, minY: number, maxX: number, maxY: number) {
	if (p.x < minX) { p.x = minX; p.vx = Math.max(p.vx, 0); }
	if (p.x > maxX) { p.x = maxX; p.vx = Math.min(p.vx, 0); }
	if (p.y < minY) { p.y = minY; p.vy = Math.max(p.vy, 0); }
	if (p.y > maxY) { p.y = maxY; p.vy = Math.min(p.vy, 0); }
}
