// Enemies: a target body (dummy.ts) plus a BRAIN that decides what to do.
//
// Each enemy follows a simple loop of states, which is easy to read and easy
// to see in the lab:
//
//   idle ──(sees a Lantern)──▶ chase ──(close enough)──▶ windup ──▶ attack ──▶ recover ─┐
//     ▲                          ▲                                                    │
//     └───(loses sight)──────────┴────────────────────────────────────────────────────┘
//
// The WINDUP is the important bit for fairness: every attack has a visible
// tell (flash, raised claws) before it lands, so players can react: dodge,
// shield, or interrupt it with a big hit.
//
// Stage 1 builds the Rage Grunt. Plasma Spitter and Rage Brute come next.

import { damagePlayer } from '../combat';
import type { ConstructWorld } from '../constructs/system';
import { DUMMY_HALF_W, isStanding, type Dummy, type TargetKind } from '../dummy';
import type { Player } from '../player';

export type EnemyKind = Exclude<TargetKind, 'dummy'>;
export type EnemyState = 'idle' | 'chase' | 'windup' | 'attack' | 'recover';

export interface EnemyDef {
	kind: EnemyKind;
	name: string;
	faction: 'red' | 'manhunter';
	/** One line for the codex and lab. */
	description: string;
	hp: number;
	/** Top speed (px/s) before rage. */
	speed: number;
	/** How quickly it reaches its desired velocity (higher = snappier). */
	accel: number;
	/** Notices Lanterns within this range. */
	sight: number;
	/** Starts an attack when this close. */
	attackRange: number;
	/** Seconds of tell before the attack lands. */
	windup: number;
	/** Seconds the attack itself lasts. */
	attackTime: number;
	/** Seconds of vulnerability after attacking. */
	recover: number;
	/** Seconds before it can start another attack. */
	cooldown: number;
	damage: number;
	knockback: number;
	/** Burst of speed toward the target when the attack lands. */
	lunge: number;
	/** Drawing size multiplier. */
	scale: number;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
	rageGrunt: {
		kind: 'rageGrunt',
		name: 'Rage Grunt',
		faction: 'red',
		description: 'A Red Lantern berserker. Rushes the nearest Lantern and slashes with rage claws. Gets faster the more it hurts.',
		hp: 120,
		speed: 185,
		accel: 5,
		sight: 560,
		attackRange: 52,
		windup: 0.42,
		attackTime: 0.18,
		recover: 0.5,
		cooldown: 0.85,
		damage: 12,
		knockback: 320,
		lunge: 340,
		scale: 1
	},
	// Stage 2 and 3 fill in their behaviors; the numbers are placeholders until then.
	plasmaSpitter: {
		kind: 'plasmaSpitter',
		name: 'Plasma Spitter',
		faction: 'red',
		description: 'Keeps its distance and spits burning plasma that leaves fire on the ground and melts constructs.',
		hp: 80,
		speed: 150,
		accel: 4,
		sight: 620,
		attackRange: 320,
		windup: 0.6,
		attackTime: 0.2,
		recover: 0.6,
		cooldown: 1.6,
		damage: 14,
		knockback: 120,
		lunge: 0,
		scale: 0.95
	},
	rageBrute: {
		kind: 'rageBrute',
		name: 'Rage Brute',
		faction: 'red',
		description: 'Huge and slow. Winds up a charge that smashes through energy walls, and is dazed if it crashes into something.',
		hp: 420,
		speed: 110,
		accel: 3,
		sight: 560,
		attackRange: 300,
		windup: 0.8,
		attackTime: 0.7,
		recover: 1.2,
		cooldown: 2.4,
		damage: 30,
		knockback: 620,
		lunge: 560,
		scale: 1.35
	}
};

export interface EnemyBrain {
	state: EnemyState;
	/** Seconds left in the current state (windup, attack, recover). */
	timer: number;
	/** Seconds before it can attack again. */
	cooldown: number;
	target: Player | null;
	/** Direction the attack is aimed (locked in at the start of the windup). */
	aimX: number;
	aimY: number;
	/** 0..1: how hurt it is. Rage makes Red Lanterns faster and harder-hitting. */
	rage: number;
	/** The current attack already dealt its damage. */
	hitDone: boolean;
}

/** An enemy: a target body with a brain. */
export interface Enemy extends Dummy {
	kind: EnemyKind;
	brain: EnemyBrain;
}

export function isEnemy(d: Dummy): d is Enemy {
	return d.kind !== 'dummy' && 'brain' in d;
}

export function createEnemy(kind: EnemyKind, x: number, y: number): Enemy {
	const def = ENEMIES[kind];
	return {
		kind,
		x,
		y,
		prevX: x,
		prevY: y,
		vx: 0,
		vy: 0,
		hp: def.hp,
		maxHp: def.hp,
		homeX: x,
		homeY: y,
		caged: 0,
		flash: 0,
		stun: 0,
		down: 0,
		respawns: false,
		gone: false,
		dir: -1,
		brain: { state: 'idle', timer: 0, cooldown: 0.5, target: null, aimX: -1, aimY: 0, rage: 0, hitDone: false }
	};
}

// ------------------------------------------------------------------- brains

/** One tick of thinking for every enemy. Moving happens afterwards in updateDummy. */
export function updateEnemies(w: ConstructWorld, players: readonly Player[], dt: number) {
	for (const d of w.dummies) {
		if (!isEnemy(d) || !isStanding(d)) continue;
		think(d, w, players, dt);
	}
	separate(w, dt);
}

/** Enemies closer than this push apart, so a pack surrounds you instead of stacking. */
export const ENEMY_SPACING = 34;

function separate(w: ConstructWorld, dt: number) {
	const list = w.dummies.filter((d): d is Enemy => isEnemy(d) && isStanding(d));
	for (let i = 0; i < list.length; i++) {
		for (let j = i + 1; j < list.length; j++) {
			const a = list[i];
			const c = list[j];
			const want = ENEMY_SPACING * (ENEMIES[a.kind].scale + ENEMIES[c.kind].scale) / 2;
			let dx = c.x - a.x;
			let dy = c.y - a.y;
			let dist = Math.hypot(dx, dy);
			if (dist >= want) continue;
			if (dist < 0.01) {
				// Exactly on top of each other: pick a direction from their order
				dx = Math.cos(i * 2.4 + j);
				dy = Math.sin(i * 2.4 + j);
				dist = 1;
			}
			// Push harder the more they overlap (a soft spring, not a hard wall)
			const push = (want - dist) * 90 * dt;
			a.vx -= (dx / dist) * push;
			a.vy -= (dy / dist) * push;
			c.vx += (dx / dist) * push;
			c.vy += (dy / dist) * push;
		}
	}
}

function think(e: Enemy, w: ConstructWorld, players: readonly Player[], dt: number) {
	const def = ENEMIES[e.kind];
	const b = e.brain;
	b.cooldown = Math.max(0, b.cooldown - dt);
	b.rage = 1 - e.hp / e.maxHp;

	// Caged or stunned: can't act. A big enough hit also cancels an attack in progress.
	if (e.caged > 0 || e.stun > 0) {
		b.state = 'recover';
		b.timer = Math.max(b.timer, 0.2);
		steer(e, 0, 0, def.accel * 2, dt);
		return;
	}

	const rageSpeed = 1 + 0.6 * b.rage;
	b.target = pickTarget(e, players, def.sight, b.target);
	const t = b.target;

	switch (b.state) {
		case 'idle': {
			// Drift gently around where it started
			steer(e, (e.homeX - e.x) * 0.5, (e.homeY - e.y) * 0.5, def.accel * 0.5, dt);
			if (t) b.state = 'chase';
			break;
		}
		case 'chase': {
			if (!t) {
				b.state = 'idle';
				break;
			}
			const dx = t.x - e.x;
			const dy = t.y - e.y;
			const dist = Math.hypot(dx, dy) || 1;
			face(e, dx);
			if (dist <= def.attackRange && b.cooldown === 0) {
				// Lock the aim in now: the attack goes where the tell pointed
				b.aimX = dx / dist;
				b.aimY = dy / dist;
				b.state = 'windup';
				b.timer = def.windup;
				b.hitDone = false;
				break;
			}
			// Close in, but don't push right into the target
			const want = dist > def.attackRange * 0.7 ? def.speed * rageSpeed : 0;
			steer(e, (dx / dist) * want, (dy / dist) * want, def.accel, dt);
			break;
		}
		case 'windup': {
			steer(e, 0, 0, def.accel * 2, dt);
			b.timer -= dt;
			if (b.timer <= 0) {
				b.state = 'attack';
				b.timer = def.attackTime;
				// Lunge along the locked aim
				e.vx += b.aimX * def.lunge;
				e.vy += b.aimY * def.lunge;
				w.effects.push({ kind: 'claw', x: e.x, y: e.y, age: 0, life: 0.3, angle: Math.atan2(b.aimY, b.aimX), lift: 40 * def.scale, radius: def.attackRange });
			}
			break;
		}
		case 'attack': {
			if (!b.hitDone) {
				b.hitDone = true;
				clawHit(e, def, w, players);
			}
			b.timer -= dt;
			if (b.timer <= 0) {
				b.state = 'recover';
				b.timer = def.recover;
				b.cooldown = def.cooldown * (1 - 0.35 * b.rage);
			}
			break;
		}
		case 'recover': {
			steer(e, 0, 0, def.accel, dt);
			b.timer -= dt;
			if (b.timer <= 0) b.state = t ? 'chase' : 'idle';
			break;
		}
	}
}

/** The claw swipe: hurts every Lantern close in front of the grunt. */
function clawHit(e: Enemy, def: EnemyDef, w: ConstructWorld, players: readonly Player[]) {
	const b = e.brain;
	const damage = def.damage * (1 + 0.5 * b.rage);
	for (const p of players) {
		if (p.downed) continue;
		const dx = p.x - e.x;
		const dy = p.y - e.y;
		const dist = Math.hypot(dx, dy);
		if (dist > def.attackRange + DUMMY_HALF_W + 10) continue;
		// In front of the swipe (within about 70 degrees of the aim)
		if (dist > 12 && (dx * b.aimX + dy * b.aimY) / dist < 0.35) continue;
		damagePlayer(w, p, damage, e.x, e.y, def.knockback);
	}
}

/** Nearest Lantern who's up and in sight. Sticks with the current target a little longer. */
function pickTarget(e: Enemy, players: readonly Player[], sight: number, current: Player | null): Player | null {
	if (current && !current.downed && Math.hypot(current.x - e.x, current.y - e.y) <= sight * 1.3) return current;
	let best: Player | null = null;
	let bestDist = sight;
	for (const p of players) {
		if (p.downed) continue;
		const dist = Math.hypot(p.x - e.x, p.y - e.y);
		if (dist <= bestDist) {
			best = p;
			bestDist = dist;
		}
	}
	return best;
}

/**
 * Ease velocity toward a desired velocity. Because it eases instead of
 * setting it, knockback from constructs still sends enemies flying and
 * fades out naturally.
 */
function steer(e: Enemy, wantVx: number, wantVy: number, accel: number, dt: number) {
	const k = 1 - Math.exp(-accel * dt);
	e.vx += (wantVx - e.vx) * k;
	e.vy += (wantVy - e.vy) * k;
}

function face(e: Enemy, dx: number) {
	if (Math.abs(dx) > 4) e.dir = dx > 0 ? 1 : -1;
}
