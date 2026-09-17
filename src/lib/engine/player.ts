// A Player is one Lantern in the world, driven by one InputSource.

import type { InputSource, Intent } from './input';
import type { LanternDef } from './lanterns';

export interface Player {
	/** 0 = player 1, 1 = player 2. */
	slot: number;
	def: LanternDef;
	input: InputSource;
	x: number;
	y: number;
	/** Position at the start of the last tick, used to smooth rendering. */
	prevX: number;
	prevY: number;
	vx: number;
	vy: number;
	/** Which way the Lantern faces on screen: 1 = right, -1 = left. */
	dir: 1 | -1;
	/** Advances while moving; drives the leg swing animation. */
	walkPhase: number;
}

export function createPlayer(slot: number, def: LanternDef, input: InputSource, x: number, y: number): Player {
	return { slot, def, input, x, y, prevX: x, prevY: y, vx: 0, vy: 0, dir: 1, walkPhase: 0 };
}

/** Move `current` toward `target` by at most `maxDelta`. */
function approach(current: number, target: number, maxDelta: number): number {
	if (current < target) return Math.min(current + maxDelta, target);
	return Math.max(current - maxDelta, target);
}

/**
 * One tick of movement. Pure apart from mutating `p`, and takes the Intent as
 * an argument instead of reading input itself, which keeps it easy to test.
 */
export function updatePlayer(p: Player, intent: Intent, dt: number) {
	p.prevX = p.x;
	p.prevY = p.y;

	const { maxSpeed, accel, decel } = p.def;
	const moving = intent.moveX !== 0 || intent.moveY !== 0;

	// Steer velocity toward where the input points. Speeding up uses accel,
	// coasting to a stop uses decel. That gives a slight "flying" feel
	// instead of instant start/stop.
	const targetVx = intent.moveX * maxSpeed;
	const targetVy = intent.moveY * maxSpeed;
	const rate = (moving ? accel : decel) * dt;
	p.vx = approach(p.vx, targetVx, rate);
	p.vy = approach(p.vy, targetVy, rate);

	p.x += p.vx * dt;
	p.y += p.vy * dt;

	// Only left/right input flips the character. Moving straight up or down
	// keeps whichever way they were already facing.
	if (intent.moveX !== 0) p.dir = intent.moveX > 0 ? 1 : -1;

	// Legs cycle faster the faster you go.
	const speed = Math.hypot(p.vx, p.vy);
	p.walkPhase = speed > 5 ? p.walkPhase + speed * dt * 0.045 : 0;
}

/** Keep a player inside a rectangle, killing velocity into the wall. */
export function clampToBounds(p: Player, minX: number, minY: number, maxX: number, maxY: number) {
	if (p.x < minX) { p.x = minX; p.vx = Math.max(p.vx, 0); }
	if (p.x > maxX) { p.x = maxX; p.vx = Math.min(p.vx, 0); }
	if (p.y < minY) { p.y = minY; p.vy = Math.max(p.vy, 0); }
	if (p.y > maxY) { p.y = maxY; p.vy = Math.min(p.vy, 0); }
}
