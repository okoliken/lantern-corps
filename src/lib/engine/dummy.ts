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
export type TargetKind = 'dummy' | 'rageGrunt' | 'manhunterDrone' | 'redFighter' | 'zox' | 'skallox' | 'bleez' | 'rageTurret' | 'kilowog' | 'sinestro' | 'razer' | 'spaceRock' | 'rageTorpedo' | 'gorillaBrute' | 'gorillaGunner' | 'grodd' | 'manhunter' | 'manhunterPrime' | 'manhunterCore' | 'reverseFlash' | 'signalSpire' | 'dexStarr' | 'rageBubble' | 'bloodConduit' | 'atrocitus';

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
	/** A Red Lantern's Rage Shield around it: soaks up damage until broken or expired. */
	ward?: { hp: number; maxHp: number; life: number };
	/**
	 * A round thing floating free (an asteroid in a mission): it keeps its
	 * speed (no friction), passes over the map, and is `radius` px across the
	 * middle, drawn `float` px above its ground point.
	 */
	drift?: { radius: number; float: number; spin: number; seed: number };
	/** A broken Manhunter's core: how far (0..1) it has pulled itself back together. */
	rebuild?: number;
	/** Drawn this many times bigger (Manhunter Prime's core). */
	scale?: number;
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
	d.flash = 0.12;
	// A Rage Shield takes the hit first (and the knockback)
	if (d.ward) {
		const absorbed = Math.min(d.ward.hp, damage);
		d.ward.hp -= absorbed;
		damage -= absorbed;
		if (d.ward.hp <= 0) d.ward = undefined;
		if (damage <= 0) return false;
	}
	d.hp -= damage;

	// Caged targets can't be knocked around; that's the point of the cage.
	// Asteroids are heavy: a shot barely nudges them (bigger ones even less).
	if (d.drift) knockback *= 0.25 * (14 / d.drift.radius);
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
	if (d.ward && (d.ward.life -= dt) <= 0) d.ward = undefined;

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

/** The target's footprint as a Solid (what it stands on: for moving and colliding). */
export function dummyBox(d: Dummy): Solid {
	return { x: d.x - DUMMY_HALF_W, y: d.y - DUMMY_HALF_H, w: DUMMY_HALF_W * 2, h: DUMMY_HALF_H * 2, blocksFlying: false };
}

// ------------------------------------------------------------------ hurtboxes
//
// What you SEE is what you hit. Shots and beams travel along the ground plane
// but are drawn `lift` px higher (at the height of the ring that fired them),
// and a target is drawn as a tall body standing up from its feet. So a shot
// hits when its DRAWN position touches the target's DRAWN body:
//
//   drawn shot y = shot y - lift,   drawn body = from (feet y - height) to feet y
//   => the shot's ground y must be within [feet y - height + lift, feet y + lift]
//
// A footprint-only check (the old way) meant a bolt you saw fly through an
// enemy's chest could miss, and only one thin slice of its body counted.

/** How big each kind of target is drawn: half its width, and its height above its feet (world px). */
export const BODY: Record<TargetKind, { halfWidth: number; height: number }> = {
	dummy: { halfWidth: 15, height: 62 },
	rageGrunt: { halfWidth: 19, height: 92 },
	manhunterDrone: { halfWidth: 24, height: 86 },
	redFighter: { halfWidth: 38, height: 78 },
	zox: { halfWidth: 36, height: 112 },
	skallox: { halfWidth: 30, height: 128 },
	bleez: { halfWidth: 24, height: 100 },
	rageTurret: { halfWidth: 18, height: 76 },
	kilowog: { halfWidth: 28, height: 100 },
	sinestro: { halfWidth: 18, height: 96 },
	razer: { halfWidth: 18, height: 100 },
	// Real size comes from its drift radius
	spaceRock: { halfWidth: 20, height: 40 },
	rageTorpedo: { halfWidth: 14, height: 40 },
	gorillaBrute: { halfWidth: 26, height: 96 },
	gorillaGunner: { halfWidth: 24, height: 90 },
	grodd: { halfWidth: 34, height: 128 },
	// Flying: its body is drawn well off the ground, so the box reaches up to it
	manhunter: { halfWidth: 22, height: 160 },
	manhunterPrime: { halfWidth: 36, height: 250 },
	manhunterCore: { halfWidth: 22, height: 40 },
	signalSpire: { halfWidth: 44, height: 250 },
	// Small, and flying at head height
	dexStarr: { halfWidth: 22, height: 96 },
	rageBubble: { halfWidth: 44, height: 130 },
	bloodConduit: { halfWidth: 34, height: 220 },
	atrocitus: { halfWidth: 30, height: 170 },
	reverseFlash: { halfWidth: 14, height: 86 }
};
/** A little slack below the feet, and the size of a bolt. */
const HURT_SLACK = 8;

/** How high a target is off the ground right now (a leap, a dive), and how much bigger it's grown. */
function airAndGrowth(d: Dummy): [number, number] {
	const brain = (d as { brain?: { air: number; form: number } }).brain;
	return brain ? [brain.air * 70, 1 + 0.28 * brain.form] : [0, 1];
}

/** The target's body as seen by a shot flying at `lift`, as a box on the ground plane. */
export function hurtbox(d: Dummy, lift: number): Solid {
	// A floating round thing: a circle's worth of body around its drawn centre
	if (d.drift) {
		const { radius: r, float } = d.drift;
		return { x: d.x - r, y: d.y - float - r + lift, w: r * 2, h: r * 2, blocksFlying: false };
	}
	const body = BODY[d.kind];
	const [air, grow] = airAndGrowth(d);
	const hw = body.halfWidth * grow;
	const h = body.height * grow;
	return { x: d.x - hw, y: d.y - air - h + lift, w: hw * 2, h: h + HURT_SLACK, blocksFlying: false };
}

/** Where to aim a shot flying at `lift` so it goes through the middle of the target's body. */
export function aimPoint(d: Dummy, lift: number): [number, number] {
	const box = hurtbox(d, lift);
	return [d.x, box.y + (box.h - (d.drift ? 0 : HURT_SLACK)) / 2];
}

/**
 * The point of a target's footprint on the ground plane nearest to (x, y): its
 * full width (big enemies are wide, asteroids are round), not just its feet.
 * Close-range constructs (sword, fist, shockwave, pillars, mines) measure to
 * this, so anything they visibly reach, they hit.
 */
export function footprintPoint(d: Dummy, x: number, y: number): [number, number] {
	const hw = d.drift ? d.drift.radius : BODY[d.kind].halfWidth * airAndGrowth(d)[1];
	const hd = d.drift ? d.drift.radius * 0.6 : DUMMY_HALF_H;
	return [Math.min(Math.max(x, d.x - hw), d.x + hw), Math.min(Math.max(y, d.y - hd), d.y + hd)];
}

/** Ground-plane distance from (x, y) to the target's footprint; 0 if inside it. */
export function footprintGap(d: Dummy, x: number, y: number): number {
	const [fx, fy] = footprintPoint(d, x, y);
	return Math.hypot(fx - x, fy - y);
}

/** Distance from a point on the ground plane (at `lift`) to the target's body; 0 if inside it. */
export function distanceToBody(d: Dummy, x: number, y: number, lift: number): number {
	const b = hurtbox(d, lift);
	const dx = Math.max(b.x - x, 0, x - (b.x + b.w));
	const dy = Math.max(b.y - y, 0, y - (b.y + b.h));
	return Math.hypot(dx, dy);
}
