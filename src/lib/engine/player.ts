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
	/** Direction faced, in radians. 0 = right, PI/2 = down. */
	facing: number;
	prevFacing: number;
}

export function createPlayer(slot: number, def: LanternDef, input: InputSource, x: number, y: number): Player {
	const facing = -Math.PI / 2; // start facing up
	return { slot, def, input, x, y, prevX: x, prevY: y, vx: 0, vy: 0, facing, prevFacing: facing };
}

/** Move `current` toward `target` by at most `maxDelta`. */
function approach(current: number, target: number, maxDelta: number): number {
	if (current < target) return Math.min(current + maxDelta, target);
	return Math.max(current - maxDelta, target);
}

/** Wraps an angle into -PI..PI, so turning always takes the short way round. */
export function wrapAngle(a: number): number {
	return Math.atan2(Math.sin(a), Math.cos(a));
}

/**
 * One tick of movement. Pure apart from mutating `p`, and takes the Intent as
 * an argument instead of reading input itself, which keeps it easy to test.
 */
export function updatePlayer(p: Player, intent: Intent, dt: number) {
	p.prevX = p.x;
	p.prevY = p.y;
	p.prevFacing = p.facing;

	const { maxSpeed, accel, decel, turnRate } = p.def;
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

	if (moving) {
		const want = Math.atan2(intent.moveY, intent.moveX);
		const diff = wrapAngle(want - p.facing);
		const maxTurn = turnRate * dt;
		p.facing = wrapAngle(p.facing + Math.max(-maxTurn, Math.min(maxTurn, diff)));
	}
}

/** Keep a player inside a rectangle, killing velocity into the wall. */
export function clampToBounds(p: Player, minX: number, minY: number, maxX: number, maxY: number) {
	if (p.x < minX) { p.x = minX; p.vx = Math.max(p.vx, 0); }
	if (p.x > maxX) { p.x = maxX; p.vx = Math.min(p.vx, 0); }
	if (p.y < minY) { p.y = minY; p.vy = Math.max(p.vy, 0); }
	if (p.y > maxY) { p.y = maxY; p.vy = Math.min(p.vy, 0); }
}
