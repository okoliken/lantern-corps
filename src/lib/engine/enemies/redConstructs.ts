// Red Lantern constructs. Red rings run on rage, so their constructs are
// crude and brutal: claws, blasts, saws, barbed chains, and raw fury.
//
// They play by the same rules as the Green Lanterns' constructs, from the
// other side:
//  - Bubble shields soak them up, and a Fortress dome keeps them out.
//  - Energy walls block red projectiles, but take damage (saws most of all).
//  - Turrets can be shot down, and a Rage Roar tears them apart.

import { damagePlayer } from '../combat';
import { absorbWithShield, removeObstacle, type ConstructWorld } from '../constructs/system';
import { DUMMY_HALF_W, isStanding } from '../dummy';
import type { Obstacle } from '../map';
import { boxOverlap, type Solid } from '../physics';
import type { Player } from '../player';
import { ENEMIES, face, steer, type Enemy } from './enemies';

export type AbilityId = 'claws' | 'blast' | 'saw' | 'chain' | 'slam' | 'roar';

export interface AbilityDef {
	id: AbilityId;
	name: string;
	/** Seconds of tell before it happens. */
	windup: number;
	/** Seconds the construct lasts once it starts (at most, for chains). */
	active: number;
	/** Seconds of vulnerability afterwards. */
	recover: number;
	cooldown: number;
	/** Only used on targets between these distances. */
	minRange: number;
	maxRange: number;
	damage: number;
	knockback: number;
	/** Close-range, limited by melee slots. */
	melee: boolean;
	/** Big area attacks: only one enemy at a time uses one on the same Lantern. */
	heavy: boolean;
	/** Chance to go for it when it's available (so enemies don't always do the same thing). */
	chance: number;
	speed?: number;
	radius?: number;
}

export const ABILITIES: Record<AbilityId, AbilityDef> = {
	claws: {
		id: 'claws', name: 'Rage Claws', windup: 0.42, active: 0.18, recover: 0.45, cooldown: 0.9,
		minRange: 0, maxRange: 56, damage: 12, knockback: 320, melee: true, heavy: false, chance: 1
	},
	// Three bolts in quick succession
	blast: {
		id: 'blast', name: 'Rage Blast', windup: 0.5, active: 0.45, recover: 0.35, cooldown: 2.2,
		minRange: 90, maxRange: 460, damage: 7, knockback: 90, melee: false, heavy: false, chance: 0.8, speed: 540
	},
	// Flies out, then comes back to the thrower, hitting on the way out AND back
	saw: {
		id: 'saw', name: 'Rage Saw', windup: 0.55, active: 0.2, recover: 0.45, cooldown: 5,
		minRange: 90, maxRange: 340, damage: 12, knockback: 160, melee: false, heavy: false, chance: 0.55, speed: 470
	},
	// Hooks a Lantern and yanks them in for a clawing
	chain: {
		id: 'chain', name: 'Barbed Chain', windup: 0.5, active: 1.2, recover: 0.3, cooldown: 6.5,
		minRange: 120, maxRange: 340, damage: 6, knockback: 0, melee: false, heavy: false, chance: 0.6, speed: 950
	},
	// Leaps and crashes down where the target WAS when it jumped
	slam: {
		id: 'slam', name: 'Rage Slam', windup: 0.35, active: 0.7, recover: 0.7, cooldown: 7,
		minRange: 110, maxRange: 300, damage: 22, knockback: 480, melee: false, heavy: true, chance: 0.45, radius: 72
	},
	// A blast of fury all around: shreds shields, turrets and walls
	roar: {
		id: 'roar', name: 'Rage Roar', windup: 0.6, active: 0.15, recover: 0.6, cooldown: 10,
		minRange: 0, maxRange: 140, damage: 8, knockback: 560, melee: false, heavy: true, chance: 0.7, radius: 160
	}
};

/** How high above the ground red projectiles fly (about hand height on a hovering Red Lantern). */
export const RED_HAND_LIFT = 50;
/** How close a red projectile has to get to a Lantern's feet to hit. */
const PLAYER_HIT_RADIUS = 18;
const CHAIN_PULL_SPEED = 620;
const CHAIN_PULL_TIME = 0.4;
/** The chain lets go this close. */
const CHAIN_STOP_DISTANCE = 46;
/** Extra shield damage from a Rage Roar, on top of its normal damage. */
const ROAR_SHIELD_DAMAGE = 24;
const ROAR_TURRET_DAMAGE = 70;
const ROAR_WALL_DAMAGE = 90;
const SLAM_TURRET_DAMAGE = 40;
const SLAM_WALL_DAMAGE = 60;
/** How high a Rage Slam leap goes, in px (drawing uses this). */
export const SLAM_HEIGHT = 70;

export interface RedShot {
	kind: 'bolt' | 'saw' | 'hook';
	owner: Enemy;
	x: number;
	y: number;
	prevX: number;
	prevY: number;
	vx: number;
	vy: number;
	life: number;
	/** Cruising speed (saws keep it while turning back). */
	speed: number;
	damage: number;
	knockback: number;
	/** Solids it started inside; it passes out of those. */
	ignore: Solid[];
	/** Lanterns a saw already cut on this pass. */
	hit: Player[];
	/** Saws: px travelled, and how far before heading back. */
	travelled: number;
	out: number;
	returning: boolean;
}

/** A Barbed Chain hooked into a Lantern, dragging them in. */
export interface RedChain {
	owner: Enemy;
	target: Player;
	time: number;
}

export interface RedWorld {
	shots: RedShot[];
	chains: RedChain[];
}

export function createRedWorld(): RedWorld {
	return { shots: [], chains: [] };
}

// --------------------------------------------------------------- using them

/** The windup is over: the construct happens. */
export function startAbility(e: Enemy, w: ConstructWorld, players: readonly Player[]) {
	const b = e.brain;
	const a = ABILITIES[b.ability!];
	b.state = 'act';
	b.timer = a.active;
	b.elapsed = 0;

	switch (a.id) {
		case 'claws':
			e.vx += b.aimX * 340;
			e.vy += b.aimY * 340;
			w.effects.push({ kind: 'claw', x: e.x, y: e.y, age: 0, life: 0.3, angle: Math.atan2(b.aimY, b.aimX), lift: 40 * ENEMIES[e.kind].scale, radius: a.maxRange });
			break;
		case 'saw':
			fire(e, w, 'saw', a, b.aimX, b.aimY);
			break;
		case 'chain':
			fire(e, w, 'hook', a, b.aimX, b.aimY);
			break;
		case 'slam': {
			// Cover the distance to the mark over the length of the leap
			e.vx = (b.markX - e.x) / a.active;
			e.vy = (b.markY - e.y) / a.active;
			w.effects.push({ kind: 'slamMark', x: b.markX, y: b.markY, age: 0, life: a.active, radius: a.radius });
			break;
		}
		case 'roar':
			roar(e, a, w, players);
			break;
	}
}

/** One tick of a construct in use. Returns true when it's finished. */
export function updateAbility(e: Enemy, w: ConstructWorld, players: readonly Player[], dt: number): boolean {
	const b = e.brain;
	const a = ABILITIES[b.ability!];
	b.elapsed += dt;
	b.timer -= dt;

	switch (a.id) {
		case 'claws':
			if (!b.hitDone) {
				b.hitDone = true;
				clawHit(e, a, w, players);
			}
			break;
		case 'blast': {
			steer(e, 0, 0, ENEMIES[e.kind].accel, dt);
			if (b.fired < 3 && b.elapsed >= b.fired * 0.15) {
				// Each bolt re-aims a little toward the target, so strafing sideways still matters
				const t = b.target;
				if (t) {
					const dx = t.x - e.x;
					const dy = t.y - e.y;
					const len = Math.hypot(dx, dy) || 1;
					b.aimX += (dx / len - b.aimX) * 0.4;
					b.aimY += (dy / len - b.aimY) * 0.4;
					const n = Math.hypot(b.aimX, b.aimY) || 1;
					b.aimX /= n;
					b.aimY /= n;
					face(e, dx);
				}
				fire(e, w, 'bolt', a, b.aimX, b.aimY);
				b.fired++;
			}
			break;
		}
		case 'chain': {
			steer(e, 0, 0, ENEMIES[e.kind].accel * 2, dt);
			const busy = w.red.shots.some((s) => s.owner === e && s.kind === 'hook') || w.red.chains.some((c) => c.owner === e);
			if (!busy && b.elapsed > 0.05) b.timer = 0;
			break;
		}
		case 'slam': {
			const progress = Math.min(1, b.elapsed / a.active);
			b.air = Math.sin(progress * Math.PI);
			if (b.timer <= 0) {
				b.air = 0;
				e.vx = e.vy = 0;
				slamImpact(e, a, w, players);
			}
			break;
		}
		default:
			steer(e, 0, 0, ENEMIES[e.kind].accel, dt);
	}
	return b.timer <= 0;
}

/** Interrupted: reel in any hooks and chains (saws and bolts already thrown keep going). */
export function cancelAbility(e: Enemy, w: ConstructWorld) {
	w.red.shots = w.red.shots.filter((s) => !(s.owner === e && s.kind === 'hook'));
	w.red.chains = w.red.chains.filter((c) => c.owner !== e);
	e.brain.air = 0;
}

function fire(e: Enemy, w: ConstructWorld, kind: RedShot['kind'], a: AbilityDef, dx: number, dy: number) {
	const speed = a.speed ?? 500;
	const x = e.x + dx * 14;
	const y = e.y + dy * 14;
	w.red.shots.push({
		kind,
		owner: e,
		x,
		y,
		prevX: x,
		prevY: y,
		vx: dx * speed,
		vy: dy * speed,
		life: kind === 'saw' ? 3 : (a.maxRange + 60) / speed,
		speed,
		damage: a.damage,
		knockback: a.knockback,
		ignore: w.obstacles.filter((o) => boxOverlap(x, y, 1, 1, o)),
		hit: [],
		travelled: 0,
		out: a.maxRange,
		returning: false
	});
}

function clawHit(e: Enemy, a: AbilityDef, w: ConstructWorld, players: readonly Player[]) {
	const b = e.brain;
	const damage = a.damage * (1 + 0.5 * b.rage);
	for (const p of players) {
		if (p.downed) continue;
		const dx = p.x - e.x;
		const dy = p.y - e.y;
		const dist = Math.hypot(dx, dy);
		if (dist > a.maxRange + DUMMY_HALF_W + 10) continue;
		// In front of the swipe (within about 70 degrees of the aim)
		if (dist > 12 && (dx * b.aimX + dy * b.aimY) / dist < 0.35) continue;
		damagePlayer(w, p, damage, e.x, e.y, a.knockback);
	}
}

function slamImpact(e: Enemy, a: AbilityDef, w: ConstructWorld, players: readonly Player[]) {
	const r = a.radius ?? 70;
	const damage = a.damage * (1 + 0.5 * e.brain.rage);
	for (const p of players) {
		if (!p.downed && Math.hypot(p.x - e.x, p.y - e.y) <= r + 10) damagePlayer(w, p, damage, e.x, e.y, a.knockback);
	}
	for (const t of w.turrets) if (Math.hypot(t.x - e.x, t.y - e.y) <= r) t.hp -= SLAM_TURRET_DAMAGE;
	for (const o of wallsNear(w, e.x, e.y, r)) damageWall(w, o, SLAM_WALL_DAMAGE);
	w.effects.push({ kind: 'redBlast', x: e.x, y: e.y, age: 0, life: 0.55, radius: r });
}

function roar(e: Enemy, a: AbilityDef, w: ConstructWorld, players: readonly Player[]) {
	const r = a.radius ?? 150;
	for (const p of players) {
		if (p.downed) continue;
		const dx = p.x - e.x;
		const dy = p.y - e.y;
		const dist = Math.hypot(dx, dy);
		if (dist > r + 10) continue;
		// Tears into bubble shields first, then hits whatever's left
		if (w.shields.some((s) => s.target === p)) absorbWithShield(w, p, ROAR_SHIELD_DAMAGE);
		damagePlayer(w, p, a.damage, e.x, e.y, 0);
		// Blown back even if a shield took the hit (not from inside a Fortress)
		if (!w.fortresses.some((f) => Math.hypot(p.x - f.x, p.y - f.y) <= f.radius)) {
			const len = dist || 1;
			p.vx += (dx / len) * a.knockback;
			p.vy += (dy / len) * a.knockback;
		}
	}
	for (const t of w.turrets) if (Math.hypot(t.x - e.x, t.y - e.y) <= r + 10) t.hp -= ROAR_TURRET_DAMAGE;
	for (const o of wallsNear(w, e.x, e.y, r)) damageWall(w, o, ROAR_WALL_DAMAGE);
	w.effects.push({ kind: 'roar', x: e.x, y: e.y, age: 0, life: 0.6, radius: r, lift: 36 });
}

// -------------------------------------------------------------- world tick

/** Move red projectiles and pull chains. Called once per tick after the brains. */
export function updateRedConstructs(w: ConstructWorld, players: readonly Player[], dt: number) {
	const alive: RedShot[] = [];
	for (const s of w.red.shots) {
		if (updateShot(s, w, players, dt)) alive.push(s);
	}
	w.red.shots = alive;

	const pulling: RedChain[] = [];
	for (const c of w.red.chains) {
		c.time -= dt;
		const e = c.owner;
		const p = c.target;
		const dx = e.x - p.x;
		const dy = e.y - p.y;
		const dist = Math.hypot(dx, dy);
		const holding = isStanding(e) && e.caged === 0 && e.stun === 0 && !p.downed && !p.dash;
		if (!holding || c.time <= 0 || dist <= CHAIN_STOP_DISTANCE) {
			if (holding) {
				// Reeled in: straight into the claws
				p.vx *= 0.3;
				p.vy *= 0.3;
				e.brain.engaged = true;
				e.brain.cooldowns.claws = 0;
				e.brain.think = 0;
			}
			continue;
		}
		p.vx = (dx / dist) * CHAIN_PULL_SPEED;
		p.vy = (dy / dist) * CHAIN_PULL_SPEED;
		pulling.push(c);
	}
	w.red.chains = pulling;
}

/** Returns false when the shot is used up. */
function updateShot(s: RedShot, w: ConstructWorld, players: readonly Player[], dt: number): boolean {
	s.prevX = s.x;
	s.prevY = s.y;
	const owner = s.owner;
	const ownerUp = isStanding(owner);
	if (s.kind === 'hook' && !ownerUp) return false;

	if (s.kind === 'saw') {
		const speed = s.speed;
		if (!s.returning && s.travelled >= s.out) startReturn(s);
		if (s.returning && ownerUp) {
			// Home back in on the thrower
			const dx = owner.x - s.x;
			const dy = owner.y - s.y;
			const dist = Math.hypot(dx, dy);
			if (dist < 22) return false;
			s.vx += ((dx / dist) * speed - s.vx) * Math.min(1, 8 * dt);
			s.vy += ((dy / dist) * speed - s.vy) * Math.min(1, 8 * dt);
		}
	}

	s.x += s.vx * dt;
	s.y += s.vy * dt;
	s.travelled += Math.hypot(s.vx, s.vy) * dt;
	s.life -= dt;
	if (s.life <= 0) return false;

	// Solid things. Energy walls take the hit (and stop it); saws bounce back once.
	const solid = w.obstacles.find((o) => !s.ignore.includes(o) && boxOverlap(s.x, s.y, 3, 3, o));
	if (solid) {
		if (solid.kind === 'wall') damageWall(w, solid, s.kind === 'saw' ? s.damage * 2.5 : s.damage);
		impact(w, s);
		if (s.kind === 'saw' && !s.returning) {
			s.x = s.prevX;
			s.y = s.prevY;
			startReturn(s);
			s.vx = -s.vx;
			s.vy = -s.vy;
			return true;
		}
		return false;
	}

	// A Fortress dome: shots from outside stop at its edge
	if (w.fortresses.some((f) => Math.hypot(s.x - f.x, s.y - f.y) <= f.radius && Math.hypot(s.prevX - f.x, s.prevY - f.y) > f.radius)) {
		impact(w, s);
		return false;
	}

	for (const t of w.turrets) {
		if (Math.hypot(t.x - s.x, t.y - s.y) > 16) continue;
		t.hp -= s.damage;
		impact(w, s);
		if (s.kind !== 'saw') return false;
	}

	for (const p of players) {
		if (p.downed || s.hit.includes(p)) continue;
		if (Math.hypot(p.x - s.x, p.y - s.y) > PLAYER_HIT_RADIUS) continue;
		if (s.kind === 'saw') {
			s.hit.push(p);
			damagePlayer(w, p, s.damage, s.x - s.vx, s.y - s.vy, s.knockback);
			impact(w, s);
			continue;
		}
		if (s.kind === 'hook') {
			// A shield or Fortress breaks the hook off; otherwise it bites in and pulls
			const protectedBy = w.shields.some((sh) => sh.target === p) || w.fortresses.some((f) => Math.hypot(p.x - f.x, p.y - f.y) <= f.radius);
			damagePlayer(w, p, s.damage, s.x - s.vx, s.y - s.vy, 0);
			if (!protectedBy && !p.dash) w.red.chains.push({ owner, target: p, time: CHAIN_PULL_TIME });
			impact(w, s);
			return false;
		}
		damagePlayer(w, p, s.damage, s.x - s.vx, s.y - s.vy, s.knockback);
		impact(w, s);
		return false;
	}
	return true;
}

function startReturn(s: RedShot) {
	s.returning = true;
	s.hit = []; // it can cut the same Lantern again on the way back
}

function impact(w: ConstructWorld, s: RedShot) {
	w.effects.push({ kind: 'redImpact', x: s.x, y: s.y, age: 0, life: 0.2, lift: RED_HAND_LIFT });
}

function wallsNear(w: ConstructWorld, x: number, y: number, r: number): Obstacle[] {
	return w.obstacles.filter((o) => o.kind === 'wall' && Math.hypot(o.x + o.w / 2 - x, o.y + o.h / 2 - y) <= r + Math.max(o.w, o.h) / 2);
}

/** Energy walls (and Force Fields) can be worn down by red constructs. */
export function damageWall(w: ConstructWorld, o: Obstacle, damage: number) {
	if (o.hp === undefined) return;
	o.hp -= damage;
	if (o.hp <= 0) removeObstacle(w, o, 'burst');
}
