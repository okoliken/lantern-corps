// Targets: anything the Lanterns can fight. Training dummies, and every enemy.
//
// They all share the same body: health, knockback, being caged or stunned,
// and being defeated. That's why every construct works on every enemy with
// no special cases. Enemies add a BRAIN on top (see enemies/), which decides
// how they move and attack.

import { moveBody, type Solid } from './physics';

export const DUMMY_HP = 200;
/** Collision box half-size around the target's base. */
export const DUMMY_HALF_W = 12;
export const DUMMY_HALF_H = 7;
/** How quickly knockback wears off for things without a brain. */
const FRICTION = 7;
/** Seconds a broken training dummy stays down before popping back up. */
export const DUMMY_RESPAWN = 3;
/** Seconds a defeated enemy lies there before disappearing. */
export const DEFEAT_LINGER = 0.9;

/** What kind of target: a training dummy, or which enemy. */
export type TargetKind = 'dummy' | 'rageGrunt' | 'plasmaSpitter' | 'rageBrute';

export interface Dummy {
	kind: TargetKind;
	x: number;
	y: number;
	prevX: number;
	prevY: number;
	vx: number;
	vy: number;
	hp: number;
	maxHp: number;
	/** Where it goes back to after respawning. */
	homeX: number;
	homeY: number;
	/** Seconds left stuck in a cage. 0 = free. */
	caged: number;
	/** Seconds left on the white hit-flash. */
	flash: number;
	/** Seconds left dazed (Pillar Drop): can't move or attack, can still be hit and knocked. */
	stun: number;
	/** Seconds until it respawns (dummies) or disappears (enemies). 0 = standing. */
	down: number;
	/** Training dummies pop back up; enemies stay defeated. */
	respawns: boolean;
	/** A defeated enemy that has finished lingering: remove it from the world. */
	gone: boolean;
	/** Which way it faces: 1 right, -1 left. */
	dir: 1 | -1;
}

export function createDummy(x: number, y: number): Dummy {
	return {
		kind: 'dummy',
		x,
		y,
		prevX: x,
		prevY: y,
		vx: 0,
		vy: 0,
		hp: DUMMY_HP,
		maxHp: DUMMY_HP,
		homeX: x,
		homeY: y,
		caged: 0,
		flash: 0,
		stun: 0,
		down: 0,
		respawns: true,
		gone: false,
		dir: 1
	};
}

export function isStanding(d: Dummy): boolean {
	return d.down === 0 && !d.gone;
}

/**
 * Hit a target: take damage and get pushed away from (fromX, fromY).
 * Returns true if this hit defeated it.
 */
export function hitDummy(d: Dummy, damage: number, knockback: number, fromX: number, fromY: number): boolean {
	if (!isStanding(d)) return false;
	d.hp -= damage;
	d.flash = 0.12;

	// Caged targets can't be knocked around; that's the point of the cage.
	if (knockback > 0 && d.caged === 0) {
		const dx = d.x - fromX;
		const dy = d.y - fromY;
		const len = Math.hypot(dx, dy) || 1;
		d.vx += (dx / len) * knockback;
		d.vy += (dy / len) * knockback;
	}

	if (d.hp <= 0) {
		d.hp = 0;
		d.down = d.respawns ? DUMMY_RESPAWN : DEFEAT_LINGER;
		d.vx = d.vy = 0;
		d.caged = 0;
		d.stun = 0;
		return true;
	}
	return false;
}

/**
 * Move a target for one tick. Things with a brain do their own steering (and
 * their own slowing down), so they skip the built-in friction.
 */
export function updateDummy(d: Dummy, dt: number, solids: readonly Solid[], friction = true) {
	d.prevX = d.x;
	d.prevY = d.y;
	d.flash = Math.max(0, d.flash - dt);

	if (!isStanding(d)) {
		if (d.gone) return;
		d.down = Math.max(0, d.down - dt);
		if (d.down === 0) {
			if (d.respawns) {
				d.x = d.prevX = d.homeX;
				d.y = d.prevY = d.homeY;
				d.hp = d.maxHp;
			} else {
				d.gone = true;
			}
		}
		return;
	}

	if (d.caged > 0) {
		d.caged = Math.max(0, d.caged - dt);
		d.vx = d.vy = 0;
		return;
	}
	d.stun = Math.max(0, d.stun - dt);

	moveBody(d, dt, solids, DUMMY_HALF_W, DUMMY_HALF_H);
	if (friction) {
		const keep = Math.exp(-FRICTION * dt);
		d.vx *= keep;
		d.vy *= keep;
		if (Math.hypot(d.vx, d.vy) < 2) d.vx = d.vy = 0;
	}
}

/** The target's footprint as a Solid, so rays and projectiles can hit it. */
export function dummyBox(d: Dummy): Solid {
	return { x: d.x - DUMMY_HALF_W, y: d.y - DUMMY_HALF_H, w: DUMMY_HALF_W * 2, h: DUMMY_HALF_H * 2, blocksFlying: false };
}
