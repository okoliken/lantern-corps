// Training dummies: targets that take hits, get knocked back, pulled, and
// caged, but never fight back. They exist so constructs can be tried
// before enemies arrive in M5, and enemies will reuse the same ideas
// (health, knockback, being caged).

import { moveBody, type Solid } from './physics';

export const DUMMY_HP = 200;
/** Collision box half-size around the dummy's base. */
export const DUMMY_HALF_W = 12;
export const DUMMY_HALF_H = 7;
/** How quickly knockback wears off (fraction of speed lost per second, roughly). */
const FRICTION = 7;
/** Seconds a broken dummy stays down before popping back up. */
export const DUMMY_RESPAWN = 3;

export interface Dummy {
	x: number;
	y: number;
	prevX: number;
	prevY: number;
	vx: number;
	vy: number;
	hp: number;
	/** Where it goes back to after respawning. */
	homeX: number;
	homeY: number;
	/** Seconds left stuck in a cage. 0 = free. */
	caged: number;
	/** Seconds left on the white hit-flash. */
	flash: number;
	/** Seconds until it respawns. 0 = standing. */
	down: number;
}

export function createDummy(x: number, y: number): Dummy {
	return { x, y, prevX: x, prevY: y, vx: 0, vy: 0, hp: DUMMY_HP, homeX: x, homeY: y, caged: 0, flash: 0, down: 0 };
}

export function isStanding(d: Dummy): boolean {
	return d.down === 0;
}

/**
 * Hit a dummy: take damage and get pushed away from (fromX, fromY).
 * Returns true if this hit broke it.
 */
export function hitDummy(d: Dummy, damage: number, knockback: number, fromX: number, fromY: number): boolean {
	if (!isStanding(d)) return false;
	d.hp -= damage;
	d.flash = 0.12;

	// Caged dummies can't be knocked around; that's the point of the cage.
	if (knockback > 0 && d.caged === 0) {
		const dx = d.x - fromX;
		const dy = d.y - fromY;
		const len = Math.hypot(dx, dy) || 1;
		d.vx += (dx / len) * knockback;
		d.vy += (dy / len) * knockback;
	}

	if (d.hp <= 0) {
		d.hp = 0;
		d.down = DUMMY_RESPAWN;
		d.vx = d.vy = 0;
		d.caged = 0;
		return true;
	}
	return false;
}

export function updateDummy(d: Dummy, dt: number, solids: readonly Solid[]) {
	d.prevX = d.x;
	d.prevY = d.y;
	d.flash = Math.max(0, d.flash - dt);

	if (!isStanding(d)) {
		d.down = Math.max(0, d.down - dt);
		if (d.down === 0) {
			d.x = d.prevX = d.homeX;
			d.y = d.prevY = d.homeY;
			d.hp = DUMMY_HP;
		}
		return;
	}

	if (d.caged > 0) {
		d.caged = Math.max(0, d.caged - dt);
		d.vx = d.vy = 0;
		return;
	}

	moveBody(d, dt, solids, DUMMY_HALF_W, DUMMY_HALF_H);
	const keep = Math.exp(-FRICTION * dt);
	d.vx *= keep;
	d.vy *= keep;
	if (Math.hypot(d.vx, d.vy) < 2) d.vx = d.vy = 0;
}

/** The dummy's footprint as a Solid, so rays and projectiles can hit it. */
export function dummyBox(d: Dummy): Solid {
	return { x: d.x - DUMMY_HALF_W, y: d.y - DUMMY_HALF_H, w: DUMMY_HALF_W * 2, h: DUMMY_HALF_H * 2, blocksFlying: false };
}
