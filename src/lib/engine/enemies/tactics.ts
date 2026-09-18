// How an enemy fights on its own: what it sees and remembers, what it's
// trying to do (its GOAL), how it moves there, and when it dodges.
//
// Goals, picked by weighing the situation against its personality:
//   hold        keep its favourite distance, circling slowly
//   approach    close in, ready to take a spot in melee
//   flank       swing round the side to get behind the Lantern
//   cover       tuck behind a rock or building, and peek out to shoot
//   wait        hang back a little: others are already attacking
//   retreat     back right off (machines, when badly damaged)
//   investigate go to where it last saw the Lantern
// It sticks with a goal for a while (longer if patient), then weighs up again.

import { castBeam } from '../beam';
import type { ConstructWorld } from '../constructs/system';
import type { Obstacle } from '../map';
import { boxOverlap } from '../physics';
import type { Player } from '../player';
import { ENEMIES, face, rangeOf, roleSpeed, steer, type Enemy } from './enemies';
import { ABILITIES } from './redConstructs';

export type Goal = 'hold' | 'approach' | 'flank' | 'cover' | 'wait' | 'retreat' | 'investigate';

/** Seconds it keeps hunting a Lantern it has lost sight of. */
export const MEMORY = 5;
/** Spotting a Lantern alerts allies this close (machines share data further). */
const CALL_RADIUS = 420;
const MACHINE_CALL_RADIUS = 900;
/** How far from a Lantern's feet an enemy in melee stands (the creatures are big). */
const MELEE_RING = 48;
/** Idle enemies drift around their spawn spot, within this distance. */
const WANDER_RADIUS = 90;
/** Shots passing closer than this are worth dodging. */
const DODGE_MISS = 28;
/** How far ahead (seconds) it watches incoming shots. */
const DODGE_LOOKAHEAD = 0.4;

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const inside = (o: Obstacle, x: number, y: number) => boxOverlap(x, y, 1, 1, o);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

// ------------------------------------------------------------ perception

/**
 * Nothing solid between two points. Enemies hover low, so buildings, rocks
 * and asteroids block the view; energy walls are see-through.
 */
export function hasLineOfSight(x0: number, y0: number, x1: number, y1: number, obstacles: readonly Obstacle[]): boolean {
	const dx = x1 - x0;
	const dy = y1 - y0;
	const d = Math.hypot(dx, dy);
	if (d < 1) return true;
	const blockers = obstacles.filter((o) => o.kind !== 'wall' && o.kind !== 'crate' && !inside(o, x0, y0) && !inside(o, x1, y1));
	return castBeam(x0, y0, dx / d, dy / d, blockers, d).length >= d - 1;
}

/** Would a red shot get from the enemy to the target? (Energy walls don't count: burning through them is fine.) */
export function clearShot(e: Enemy, t: Player, w: ConstructWorld): boolean {
	const dx = t.x - e.x;
	const dy = t.y - e.y;
	const d = Math.hypot(dx, dy);
	if (d < 1) return true;
	const blockers = w.obstacles.filter((o) => o.kind !== 'wall' && !inside(o, e.x, e.y) && !inside(o, t.x, t.y));
	return castBeam(e.x, e.y, dx / d, dy / d, blockers, d).length >= d - 1;
}

/**
 * Look around (a few times a second, not every tick): who can it see, who
 * should it fight, and does it still remember a Lantern it lost?
 */
export function perceive(e: Enemy, pack: readonly Enemy[], players: readonly Player[], w: ConstructWorld, dt: number) {
	const b = e.brain;
	const def = ENEMIES[e.kind];
	b.seenAgo += dt;
	if (b.target?.downed) {
		b.target = null;
		b.engaged = false;
		b.sees = false;
	}

	b.lookIn -= dt;
	if (b.lookIn > 0 && b.target) {
		if (b.sees) {
			b.lastSeenX = b.target.x;
			b.lastSeenY = b.target.y;
			b.seenAgo = 0;
		}
		return;
	}
	b.lookIn = 0.15 + Math.random() * 0.15;

	const before = b.target;
	const visible = players.filter(
		(p) =>
			!p.downed &&
			dist(p, e) <= (p === before ? def.sight * 1.3 : def.sight) &&
			hasLineOfSight(e.x, e.y, p.x, p.y, w.obstacles)
	);
	let t = pickTarget(e, pack, visible);
	// Lost sight: keep hunting for a while, going to where it last saw them
	if (!t && before && !before.downed && b.seenAgo < MEMORY) t = before;
	// Shot at, or an ally called out: go after the nearest Lantern even unseen
	if (!t && b.alert > 0) {
		for (const p of players) {
			if (p.downed || dist(p, e) > def.sight * 1.5) continue;
			if (!t || dist(p, e) < dist(t, e)) t = p;
		}
		if (t) {
			b.lastSeenX = t.x;
			b.lastSeenY = t.y;
			b.seenAgo = Math.max(b.seenAgo, 1);
		}
	}

	b.sees = t !== null && visible.includes(t);
	if (t && b.sees) {
		b.lastSeenX = t.x;
		b.lastSeenY = t.y;
		b.seenAgo = 0;
	}
	if (t !== before) {
		b.engaged = false;
		b.goalTimer = 0;
		if (t && !before) callAllies(e, pack, t);
	}
	b.target = t;
}

/** "Over here!": idle allies nearby turn up to help. */
function callAllies(e: Enemy, pack: readonly Enemy[], t: Player) {
	const radius = ENEMIES[e.kind].mind === 'machine' ? MACHINE_CALL_RADIUS : CALL_RADIUS;
	for (const o of pack) {
		if (o === e || o.brain.target || dist(o, e) > radius) continue;
		o.brain.alert = Math.max(o.brain.alert, 3);
		o.brain.lookIn = Math.min(o.brain.lookIn, 0.2 + Math.random() * 0.4);
	}
}

/**
 * Nearest Lantern it can see, but spread out: a Lantern who already has
 * enemies on them counts as further away (machines care less: they focus
 * fire). Sticks with its current target unless another is clearly better.
 */
function pickTarget(e: Enemy, pack: readonly Enemy[], candidates: readonly Player[]): Player | null {
	const current = e.brain.target;
	const crowdCost = ENEMIES[e.kind].mind === 'machine' ? 60 : 160;
	let best: Player | null = null;
	let bestScore = Infinity;
	for (const p of candidates) {
		const crowd = pack.filter((o) => o !== e && o.brain.target === p).length;
		let score = dist(p, e) + crowd * crowdCost;
		if (p === current) score *= 0.7;
		if (score < bestScore) {
			best = p;
			bestScore = score;
		}
	}
	return best;
}

// ------------------------------------------------------------------ goals

/** Weigh up the situation and pick a goal, with a little randomness so a pack doesn't agree on everything. */
export function chooseGoal(e: Enemy, t: Player, pack: readonly Enemy[], w: ConstructWorld) {
	const b = e.brain;
	const P = b.persona;
	const def = ENEMIES[e.kind];
	b.goalTimer = (1.4 + Math.random() * 1.6) * (0.6 + P.patience * 0.8);

	// Can't see them: go and look
	if (!b.sees && b.seenAgo > 0.5) {
		b.goal = 'investigate';
		b.goalX = b.lastSeenX;
		b.goalY = b.lastSeenY;
		b.goalTimer = 1;
		return;
	}

	const melee = b.kit.some((id) => ABILITIES[id].melee);
	const options: [typeof b.goal, number][] = [];
	const add = (goal: typeof b.goal, score: number) => options.push([goal, score + Math.random() * 0.3]);

	add('hold', 0.45 + P.patience * 0.15);
	if (melee) add('approach', 0.25 + P.aggression * 0.5 + b.rage * 0.4);
	// The Lantern is looking this way: an aggressive one goes round the side
	const facingMe = (e.x - t.x) * t.dir > 0;
	add('flank', (facingMe ? 0.2 : 0) + P.aggression * 0.3 + (b.role === 'hunter' ? 0.2 : 0));

	let cover: [number, number] | null = null;
	if (!melee || b.role === 'gunner') {
		cover = findCover(e, t, w);
		if (cover) add('cover', P.caution * 0.6 + (b.sinceHit < 2 ? 0.35 : 0));
	}
	// Others are already on this Lantern: hang back and wait for an opening
	const busy = pack.filter((o) => o !== e && o.brain.target === t && (o.brain.state === 'windup' || o.brain.state === 'act')).length;
	if (busy >= 2) add('wait', 0.35 + P.patience * 0.4);
	// Machines pull back to repair when badly damaged; rage never backs down
	if (def.mind === 'machine' && b.hurt > 0.5) add('retreat', 0.3 + P.caution * 0.7);

	let best = options[0];
	for (const o of options) if (o[1] > best[1]) best = o;
	b.goal = best[0];
	if (b.goal === 'cover' && cover) {
		b.goalX = cover[0];
		b.goalY = cover[1];
	}
}

/**
 * A spot behind something solid, on the far side from the Lantern, at a
 * sensible range. Null if there's nothing to hide behind.
 */
export function findCover(e: Enemy, t: Player, w: ConstructWorld): [number, number] | null {
	const range = rangeOf(e);
	let best: [number, number] | null = null;
	let bestDist = Infinity;
	for (const o of w.obstacles) {
		if (o.kind === 'wall' || o.kind === 'crate') continue;
		const cx = o.x + o.w / 2;
		const cy = o.y + o.h / 2;
		if (Math.hypot(cx - e.x, cy - e.y) > 380) continue;
		const dx = cx - t.x;
		const dy = cy - t.y;
		const d = Math.hypot(dx, dy) || 1;
		const pad = Math.max(o.w, o.h) / 2 + 24;
		const sx = cx + (dx / d) * pad;
		const sy = cy + (dy / d) * pad;
		const fromT = Math.hypot(sx - t.x, sy - t.y);
		if (fromT < range * 0.6 || fromT > range * 1.7) continue;
		if (w.obstacles.some((other) => boxOverlap(sx, sy, 12, 8, other))) continue;
		if (hasLineOfSight(t.x, t.y, sx, sy, [o])) continue; // not actually hidden
		const travel = Math.hypot(sx - e.x, sy - e.y);
		if (travel < bestDist) {
			best = [sx, sy];
			bestDist = travel;
		}
	}
	return best;
}

// --------------------------------------------------------------- moving

/** Move toward whatever the goal asks for. Close to the fight it moves at a measured pace, not flat out. */
export function navigate(e: Enemy, t: Player, dt: number, w: ConstructWorld) {
	const def = ENEMIES[e.kind];
	const b = e.brain;
	const range = rangeOf(e);
	const dx = t.x - e.x;
	const dy = t.y - e.y;
	const d = Math.hypot(dx, dy) || 1;

	const ring = (angle: number, r: number): [number, number] => [t.x + Math.cos(angle) * r, t.y + Math.sin(angle) * r];
	let [gx, gy] = [e.x, e.y];
	let pace = 1;

	if (b.engaged) {
		// Each comes in from its own side of the target. Hunters swing wide first to flank.
		const r = b.role === 'hunter' && d > 110 ? 80 : MELEE_RING;
		[gx, gy] = ring(b.orbit, r);
	} else {
		switch (b.goal) {
			case 'approach':
				[gx, gy] = ring(b.orbit + b.strafe * 0.35, Math.max(100, range * 0.6));
				pace = 0.9;
				break;
			case 'hold':
				// Its own spot on a ring around the target, drifting round slowly
				[gx, gy] = ring(b.orbit + b.strafe * 0.35 + Math.sin(b.clock * 0.4) * 0.3, range * (b.breather > 0 ? 1.15 : 1));
				pace = 0.7;
				break;
			case 'wait':
				[gx, gy] = ring(b.orbit + b.strafe * 0.2, range * 1.25);
				pace = 0.5;
				break;
			case 'flank': {
				// Work round in an arc (never straight through the Lantern) toward their back
				const behind = t.dir === 1 ? Math.PI : 0;
				const side = Math.sin(b.orbit) >= 0 ? 1 : -1;
				const want = behind + side * 0.5;
				const now = Math.atan2(e.y - t.y, e.x - t.x);
				const turn = wrap(want - now);
				// Too close: get out to the arc first, then swing round. Ranged
				// fighters keep their full range while they go.
				const melee = b.kit.some((id) => ABILITIES[id].melee);
				const r = melee ? Math.max(90, range * 0.8) : range;
				const step = d < r * 0.75 ? 0.25 : 0.5;
				[gx, gy] = ring(now + Math.max(-step, Math.min(step, turn)), r);
				if (Math.abs(turn) < 0.3) b.goalTimer = Math.min(b.goalTimer, 0.6);
				break;
			}
			case 'cover':
				[gx, gy] = [b.goalX, b.goalY];
				break;
			case 'retreat': {
				const away = Math.atan2(e.y - t.y, e.x - t.x);
				[gx, gy] = ring(away, range * 1.8);
				pace = 1.05;
				break;
			}
			case 'investigate':
				[gx, gy] = [b.lastSeenX, b.lastSeenY];
				pace = 0.8;
				break;
		}
	}

	// A slow personal bob, so nobody hangs perfectly still
	gx += Math.sin(b.clock * 0.9) * 12;
	gy += Math.cos(b.clock * 0.7) * 9;
	// Far from the fight, or far too close: full speed. The measured pace is for fighting.
	if (d > range * 1.4 + 80 || d < range * 0.6) pace = 1;

	const speed = def.speed * roleSpeed(e) * b.speedMul * (1 + 0.35 * b.rage) * pace;
	const gdx = gx - e.x;
	const gdy = gy - e.y;
	const gd = Math.hypot(gdx, gdy);
	// Slow down on arrival instead of overshooting and jittering
	const want = gd < 6 ? 0 : Math.min(speed, gd * 4);
	steer(e, gd > 0 ? (gdx / gd) * want : 0, gd > 0 ? (gdy / gd) * want : 0, def.accel, dt);

	// Face the Lantern while fighting; otherwise face the way it's going
	const fighting = b.engaged || d < range * 1.5 || b.goal === 'hold' || b.goal === 'wait' || b.goal === 'cover';
	if (fighting && b.sees) face(e, dx);
	else if (Math.abs(e.vx) > 20) face(e, e.vx);
}

/** No one to fight: drift about near where it started. */
export function wander(e: Enemy, dt: number) {
	const b = e.brain;
	const def = ENEMIES[e.kind];
	if (b.goalTimer <= 0) {
		const angle = Math.random() * Math.PI * 2;
		const r = Math.random() * WANDER_RADIUS;
		b.goalX = e.homeX + Math.cos(angle) * r;
		b.goalY = e.homeY + Math.sin(angle) * r;
		b.goalTimer = 2 + Math.random() * 2.5;
	}
	const dx = b.goalX - e.x;
	const dy = b.goalY - e.y;
	const d = Math.hypot(dx, dy);
	const want = d < 8 ? 0 : Math.min(def.speed * 0.3, d * 2);
	steer(e, d > 0 ? (dx / d) * want : 0, d > 0 ? (dy / d) * want : 0, def.accel * 0.5, dt);
	if (Math.abs(e.vx) > 10) face(e, e.vx);
}

// ---------------------------------------------------------------- reflexes

/**
 * A Lantern's shot is about to hit: sidestep it, if this enemy is quick and
 * careful enough to react. It notices each shot once; after a dodge it needs
 * a moment before it can dodge again.
 */
export function tryDodge(e: Enemy, w: ConstructWorld) {
	const b = e.brain;
	if (b.dodgeIn > 0) return;
	const def = ENEMIES[e.kind];
	const skill = def.agility * (0.15 + 0.6 * b.persona.caution) * (b.state === 'move' ? 1 : 0.4);
	if (skill <= 0) return;
	for (const pr of w.projectiles) {
		if (pr.kind === 'missile') continue; // homing: no point
		const v2 = pr.vx * pr.vx + pr.vy * pr.vy;
		if (v2 < 1) continue;
		const rx = e.x - pr.x;
		const ry = e.y - pr.y;
		const when = (rx * pr.vx + ry * pr.vy) / v2;
		if (when < 0 || when > DODGE_LOOKAHEAD) continue;
		const px = pr.x + pr.vx * when;
		const py = pr.y + pr.vy * when;
		if (Math.hypot(e.x - px, e.y - py) > DODGE_MISS) continue;

		// Seen it. Whether it reacts in time depends on the enemy.
		b.dodgeIn = 0.5;
		if (Math.random() > skill) return;
		const len = Math.sqrt(v2);
		let nx = -pr.vy / len;
		let ny = pr.vx / len;
		if ((e.x - px) * nx + (e.y - py) * ny < 0) {
			nx = -nx;
			ny = -ny;
		}
		const burst = 260 + 160 * def.agility;
		e.vx += nx * burst;
		e.vy += ny * burst;
		b.dodgeIn = 1.1 + Math.random() * 1.3;
		w.effects.push({ kind: 'redTrail', x: e.x, y: e.y, age: 0, life: 0.3, angle: Math.atan2(ny, nx), lift: 34 });
		return;
	}
}
