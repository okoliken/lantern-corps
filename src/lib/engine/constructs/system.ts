// The construct system: turns "use the construct in my hand" into things
// happening in the world.
//
// Split in two:
//  - updatePlayerConstructs: per player, per tick. Picks the construct,
//    checks cooldown and willpower, and starts the behavior.
//  - updateConstructWorld: once per tick. Moves projectiles, pulls tethers,
//    springs traps, lands delayed punches, fades walls and effects.
//
// Everything a construct can touch lives in a ConstructWorld, so this file
// doesn't depend on Game and is easy to test on its own.

import { castBeam } from '../beam';
import { DUMMY_HALF_H, DUMMY_HALF_W, dummyBox, hitDummy, isStanding, type Dummy } from '../dummy';
import type { Intent } from '../input';
import type { Obstacle } from '../map';
import { boxOverlap, type Solid } from '../physics';
import type { Player } from '../player';
import { RESTART_THRESHOLD, canSpend, spend } from '../willpower';
import { BUBBLE_SHIELD, HELD_BEHAVIORS, MAX_TRAPS_PER_PLAYER, STRUCTURE_BEHAVIORS, type ConstructDef } from './defs';

// ------------------------------------------------------------ world state

export interface Projectile {
	kind: 'bullet' | 'shell' | 'hook';
	owner: Player;
	def: ConstructDef;
	x: number;
	y: number;
	prevX: number;
	prevY: number;
	vx: number;
	vy: number;
	/** Seconds until it runs out of range. */
	life: number;
	damage: number;
	knockback: number;
	/** Solids it started inside (flying over a building); it passes through those. */
	ignore: Solid[];
}

export interface Tether {
	owner: Player;
	target: Dummy | Obstacle;
	/** Seconds of pulling left. */
	time: number;
}

export interface Trap {
	owner: Player;
	x: number;
	y: number;
	radius: number;
	/** Seconds until it fizzles out if nothing walks in. */
	life: number;
	/** How long it holds what it catches. */
	hold: number;
}

/** A punch that's winding up and lands shortly. */
export interface PendingSmash {
	owner: Player;
	def: ConstructDef;
	time: number;
	damage: number;
	knockback: number;
}

/** A bubble shield around a Lantern (and in M6, civilians). */
export interface Shield {
	owner: Player;
	/** Who's inside the bubble. */
	target: Player;
	hp: number;
	maxHp: number;
	life: number;
	maxLife: number;
	/** Seconds left on the ripple after absorbing a hit. */
	ripple: number;
}

/** Visual-only things that play out and disappear. */
export interface Effect {
	kind: 'slash' | 'fist' | 'shockwave' | 'blast' | 'burst' | 'fizzle' | 'impact' | 'number' | 'snap' | 'pop';
	x: number;
	y: number;
	age: number;
	life: number;
	/** Direction, for slashes and punches. */
	angle?: number;
	/** Size, for rings and arcs. */
	radius?: number;
	/** Damage number to show. */
	value?: number;
	/** Who made it: effects at hand height are drawn at that Lantern's ring height. */
	owner?: Player;
}

export interface ConstructWorld {
	obstacles: Obstacle[];
	dummies: Dummy[];
	projectiles: Projectile[];
	tethers: Tether[];
	traps: Trap[];
	pending: PendingSmash[];
	shields: Shield[];
	effects: Effect[];
}

export function createConstructWorld(obstacles: Obstacle[], dummies: Dummy[]): ConstructWorld {
	return { obstacles, dummies, projectiles: [], tethers: [], traps: [], pending: [], shields: [], effects: [] };
}

// --------------------------------------------------------------- tuning

/** How long the fist stays visible after the wind-up (punch out, hold, fade). */
export const FIST_OUT_TIME = 0.4;
/** How long the arm stays in its action pose after a one-shot construct. */
const ACTION_POSE_TIME = 0.45;
/** Energy walls: how far in front of you they go up, and how thick they are. */
const WALL_DISTANCE = 70;
const WALL_THICKNESS = 18;
const WALL_HEIGHT = 46;
/** Slash hits things within this angle either side of your aim. */
const SLASH_HALF_ANGLE = (55 * Math.PI) / 180;
/** Beam damage numbers pop up this often while it's on target. */
const BEAM_NUMBER_EVERY = 0.25;
/** Unused traps fizzle after this long (before durability). */
const TRAP_LIFE = 60;
/** The chain stops pulling once the target is this close. */
const TETHER_STOP_DISTANCE = 45;
const TETHER_PULL_SPEED = 650;
const TETHER_TIME = 0.45;

// ------------------------------------------------------------ per player

export function updatePlayerConstructs(p: Player, intent: Intent, dt: number, w: ConstructWorld) {
	p.cooldowns = p.cooldowns.map((c) => Math.max(0, c - dt));
	p.shieldCooldown = Math.max(0, p.shieldCooldown - dt);
	p.actionTimer = Math.max(0, p.actionTimer - dt);
	if (p.actionTimer === 0) p.actionShape = null;

	if (intent.shield) castShield(p, w);

	// ---- Switching constructs ----
	const before = p.selected;
	if (intent.select >= 0 && intent.select < p.loadout.length) p.selected = intent.select;
	if (intent.cycle) p.selected = (p.selected + 1) % p.loadout.length;
	if (p.selected !== before) p.firing = false;

	const def = p.loadout[p.selected];
	const slot = p.selected;

	if (HELD_BEHAVIORS.has(def.behavior)) {
		if (def.behavior === 'beam') useBeam(p, def, intent.fire, dt, w);
		else useRapid(p, def, intent.fire, w);
		return;
	}

	p.firing = false;
	p.beamLength = 0;
	if (!intent.firePressed || p.cooldowns[slot] > 0) return;

	const cost = costOf(p, def);
	if (!canSpend(p, cost)) return;
	if (!perform(p, def, w)) return; // e.g. no room to place a wall: don't charge

	spend(p, cost);
	p.cooldowns[slot] = def.cooldown * p.def.traits.cooldown;
	p.actionTimer = ACTION_POSE_TIME + (def.windup ?? 0);
	p.actionShape = def.shape;
}

/** Willpower cost after this Lantern's traits (John's structures are cheaper). */
export function costOf(p: Player, def: ConstructDef): number {
	return def.cost * (STRUCTURE_BEHAVIORS.has(def.behavior) ? p.def.traits.structureCost : 1);
}

const power = (p: Player, n: number) => n * p.def.traits.power;
const durable = (p: Player, n: number) => n * p.def.traits.durability;

// ------------------------------------------------------------- held uses

function useBeam(p: Player, def: ConstructDef, held: boolean, dt: number, w: ConstructWorld) {
	if (p.firing) {
		if (!held || p.exhausted) p.firing = false;
	} else if (held && !p.exhausted && p.willpower >= RESTART_THRESHOLD) {
		p.firing = true;
	}
	if (!p.firing) {
		p.beamLength = 0;
		return;
	}

	spend(p, def.cost * dt);
	if (p.exhausted) p.firing = false;

	// Cast along the ground plane from the feet: obstacles are footprints,
	// so that's where "what am I pointing at" lives in this view.
	const { length, hit } = castAtTargets(p.x, p.y, p.aimX, p.aimY, def.range, w);
	p.beamLength = length;
	if (!hit) return;

	const dps = power(p, def.damage);
	const slot = p.selected;
	const showNumber = p.cooldowns[slot] === 0;
	if (showNumber) p.cooldowns[slot] = BEAM_NUMBER_EVERY;

	if ('dummy' in hit) {
		hitDummyWithFx(w, hit.dummy, dps * dt, 0, p.x, p.y, showNumber ? dps * BEAM_NUMBER_EVERY : 0);
	} else {
		damageObstacle(w, hit, dps * dt);
	}
}

function useRapid(p: Player, def: ConstructDef, held: boolean, w: ConstructWorld) {
	p.firing = held && !p.exhausted && p.willpower > 0;
	p.beamLength = 0;
	const slot = p.selected;
	if (!p.firing || p.cooldowns[slot] > 0 || !canSpend(p, def.cost)) return;

	// A little spread so it feels like a stream, not a laser
	const spread = (Math.random() - 0.5) * 0.1;
	const cos = Math.cos(spread);
	const sin = Math.sin(spread);
	const dx = p.aimX * cos - p.aimY * sin;
	const dy = p.aimX * sin + p.aimY * cos;
	launch(p, def, 'bullet', dx, dy, w);
	spend(p, def.cost);
	p.cooldowns[slot] = def.cooldown * p.def.traits.cooldown;
}

// --------------------------------------------------------- one-shot uses

/** Start a one-shot construct. Returns false if it couldn't happen (nothing spent). */
function perform(p: Player, def: ConstructDef, w: ConstructWorld): boolean {
	switch (def.behavior) {
		case 'heavy':
			launch(p, def, 'shell', p.aimX, p.aimY, w);
			return true;
		case 'grab':
			launch(p, def, 'hook', p.aimX, p.aimY, w);
			return true;
		case 'slash':
			slash(p, def, w);
			return true;
		case 'smash':
			w.pending.push({ owner: p, def, time: def.windup ?? 0, damage: power(p, def.damage), knockback: power(p, def.knockback) });
			w.effects.push({ kind: 'fist', x: p.x, y: p.y, age: 0, life: (def.windup ?? 0) + FIST_OUT_TIME, angle: Math.atan2(p.aimY, p.aimX), radius: def.radius, owner: p });
			return true;
		case 'barrier':
			return placeWall(p, def, w);
		case 'trap':
			placeTrap(p, def, w);
			return true;
		case 'area':
			shockwave(p, def, w);
			return true;
		default:
			return false;
	}
}

function launch(p: Player, def: ConstructDef, kind: Projectile['kind'], dx: number, dy: number, w: ConstructWorld) {
	const speed = def.speed ?? 600;
	const x = p.x + dx * 14;
	const y = p.y + dy * 14;
	w.projectiles.push({
		kind,
		owner: p,
		def,
		x,
		y,
		prevX: x,
		prevY: y,
		vx: dx * speed,
		vy: dy * speed,
		life: def.range / speed,
		damage: power(p, def.damage),
		knockback: power(p, def.knockback),
		ignore: w.obstacles.filter((o) => boxOverlap(x, y, 1, 1, o))
	});
}

function slash(p: Player, def: ConstructDef, w: ConstructWorld) {
	const aim = Math.atan2(p.aimY, p.aimX);
	const inArc = (tx: number, ty: number, reach: number) => {
		const dist = Math.hypot(tx - p.x, ty - p.y);
		if (dist > reach) return false;
		if (dist < 12) return true; // right on top of you: always hit
		// Angle between your aim and the target, wrapped to 0..PI
		const toTarget = Math.atan2(ty - p.y, tx - p.x);
		const diff = Math.abs(Math.atan2(Math.sin(toTarget - aim), Math.cos(toTarget - aim)));
		return diff <= SLASH_HALF_ANGLE;
	};
	for (const d of w.dummies) {
		if (isStanding(d) && inArc(d.x, d.y, def.range + DUMMY_HALF_W)) {
			hitDummyWithFx(w, d, power(p, def.damage), power(p, def.knockback), p.x, p.y);
		}
	}
	for (const o of breakables(w)) {
		const [cx, cy] = center(o);
		if (inArc(cx, cy, def.range + Math.max(o.w, o.h) / 2)) damageObstacle(w, o, power(p, def.damage));
	}
	w.effects.push({ kind: 'slash', x: p.x, y: p.y, age: 0, life: 0.35, angle: aim, radius: def.range, owner: p });
}

function placeWall(p: Player, def: ConstructDef, w: ConstructWorld): boolean {
	const cx = p.x + p.aimX * WALL_DISTANCE;
	const cy = p.y + p.aimY * WALL_DISTANCE;
	// Walls are boxes, so they stand either across or along: pick whichever
	// is closer to being perpendicular to your aim.
	const across = Math.abs(p.aimX) >= Math.abs(p.aimY);
	const ww = across ? WALL_THICKNESS : def.range;
	const wh = across ? def.range : WALL_THICKNESS;
	const wall: Obstacle = {
		kind: 'wall',
		x: cx - ww / 2,
		y: cy - wh / 2,
		w: ww,
		h: wh,
		height: WALL_HEIGHT,
		blocksFlying: true,
		seed: Math.random(),
		hp: durable(p, def.hp ?? 100),
		maxHp: durable(p, def.hp ?? 100),
		life: durable(p, def.duration ?? 8),
		maxLife: durable(p, def.duration ?? 8)
	};
	// Don't wall anyone (or any dummy) inside it
	const blocked =
		w.dummies.some((d) => isStanding(d) && boxOverlap(d.x, d.y, DUMMY_HALF_W, DUMMY_HALF_H, wall)) ||
		boxOverlap(p.x, p.y, 8, 5, wall);
	if (blocked) return false;
	w.obstacles.push(wall);
	w.effects.push({ kind: 'snap', x: cx, y: cy, age: 0, life: 0.4, radius: def.range / 2 });
	return true;
}

function placeTrap(p: Player, def: ConstructDef, w: ConstructWorld) {
	const mine = w.traps.filter((t) => t.owner === p);
	if (mine.length >= MAX_TRAPS_PER_PLAYER) w.traps.splice(w.traps.indexOf(mine[0]), 1);
	const x = p.x + p.aimX * def.range;
	const y = p.y + p.aimY * def.range;
	w.traps.push({ owner: p, x, y, radius: def.radius ?? 40, life: durable(p, TRAP_LIFE), hold: durable(p, def.duration ?? 3) });
	w.effects.push({ kind: 'snap', x, y, age: 0, life: 0.4, radius: def.radius });
}

function shockwave(p: Player, def: ConstructDef, w: ConstructWorld) {
	for (const d of w.dummies) {
		if (isStanding(d) && Math.hypot(d.x - p.x, d.y - p.y) <= def.range + DUMMY_HALF_W) {
			hitDummyWithFx(w, d, power(p, def.damage), power(p, def.knockback), p.x, p.y);
		}
	}
	for (const o of breakables(w)) {
		const [cx, cy] = center(o);
		if (Math.hypot(cx - p.x, cy - p.y) <= def.range) damageObstacle(w, o, power(p, def.damage));
	}
	w.effects.push({ kind: 'shockwave', x: p.x, y: p.y, age: 0, life: 0.65, radius: def.range, owner: p });
}

// ----------------------------------------------------------------- shield

/** Who a Lantern's shield would go on right now: a locked ally in reach, else themselves. */
export function shieldRecipient(p: Player): Player {
	const ally = p.protectTarget?.kind === 'ally' ? p.protectTarget.player : null;
	if (ally && Math.hypot(ally.x - p.x, ally.y - p.y) <= BUBBLE_SHIELD.range) return ally;
	return p;
}

function castShield(p: Player, w: ConstructWorld) {
	if (p.shieldCooldown > 0 || !canSpend(p, BUBBLE_SHIELD.cost)) return;
	const target = shieldRecipient(p);
	const hp = durable(p, BUBBLE_SHIELD.hp ?? 100);
	const life = durable(p, BUBBLE_SHIELD.duration ?? 10);

	// One bubble per person: casting again refreshes it
	const existing = w.shields.find((s) => s.target === target);
	if (existing) {
		Object.assign(existing, { owner: p, hp, maxHp: hp, life, maxLife: life, ripple: 0.3 });
	} else {
		w.shields.push({ owner: p, target, hp, maxHp: hp, life, maxLife: life, ripple: 0.3 });
	}

	spend(p, BUBBLE_SHIELD.cost);
	p.shieldCooldown = BUBBLE_SHIELD.cooldown * p.def.traits.cooldown;
	w.effects.push({ kind: 'snap', x: target.x, y: target.y, age: 0, life: 0.35, radius: 40 });
	if (target !== p) {
		// Reach toward the ally you're protecting
		const dx = target.x - p.x;
		const dy = target.y - p.y;
		const len = Math.hypot(dx, dy) || 1;
		p.aimX = dx / len;
		p.aimY = dy / len;
		p.actionTimer = 0.35;
		p.actionShape = 'bubble';
	}
}

/**
 * Damage aimed at a Lantern hits their bubble first. Returns what gets
 * through. (Enemies start using this in M5.)
 */
export function absorbWithShield(w: ConstructWorld, target: Player, damage: number): number {
	const shield = w.shields.find((s) => s.target === target);
	if (!shield) return damage;
	const absorbed = Math.min(shield.hp, damage);
	shield.hp -= absorbed;
	shield.ripple = 0.25;
	if (shield.hp <= 0) {
		w.shields.splice(w.shields.indexOf(shield), 1);
		w.effects.push({ kind: 'pop', x: target.x, y: target.y, age: 0, life: 0.45, owner: target });
	}
	return damage - absorbed;
}

// ----------------------------------------------------------- world tick

export function updateConstructWorld(w: ConstructWorld, dt: number) {
	updateProjectiles(w, dt);
	updatePending(w, dt);
	updateTethers(w, dt);
	updateTraps(w, dt);

	for (const s of [...w.shields]) {
		s.life -= dt;
		s.ripple = Math.max(0, s.ripple - dt);
		if (s.life <= 0) {
			w.shields.splice(w.shields.indexOf(s), 1);
			w.effects.push({ kind: 'pop', x: s.target.x, y: s.target.y, age: 0, life: 0.45, owner: s.target });
		}
	}

	// Energy walls fade away
	for (const o of [...w.obstacles]) {
		if (o.life === undefined) continue;
		o.life -= dt;
		if (o.life <= 0) removeObstacle(w, o, 'fizzle');
	}

	for (const e of w.effects) e.age += dt;
	w.effects = w.effects.filter((e) => e.age < e.life);
}

function updateProjectiles(w: ConstructWorld, dt: number) {
	const alive: Projectile[] = [];
	for (const pr of w.projectiles) {
		pr.prevX = pr.x;
		pr.prevY = pr.y;
		pr.x += pr.vx * dt;
		pr.y += pr.vy * dt;
		pr.life -= dt;

		const dummy = w.dummies.find((d) => isStanding(d) && boxOverlap(pr.x, pr.y, 3, 3, dummyBox(d)));
		// Your own constructs pass through your energy walls
		const solid = w.obstacles.find((o) => o.kind !== 'wall' && !pr.ignore.includes(o) && boxOverlap(pr.x, pr.y, 3, 3, o));

		if (dummy || solid) {
			projectileHit(w, pr, dummy ?? null, solid ?? null);
			continue;
		}
		if (pr.life <= 0) {
			if (pr.kind === 'shell') explode(w, pr);
			continue;
		}
		alive.push(pr);
	}
	w.projectiles = alive;
}

function projectileHit(w: ConstructWorld, pr: Projectile, dummy: Dummy | null, solid: Obstacle | null) {
	if (pr.kind === 'shell') return explode(w, pr);

	if (pr.kind === 'hook') {
		const target = dummy ?? (solid?.movable ? solid : null);
		if (target) {
			if (dummy) hitDummyWithFx(w, dummy, pr.damage, 0, pr.x, pr.y);
			w.tethers.push({ owner: pr.owner, target, time: TETHER_TIME });
		} else {
			w.effects.push({ kind: 'impact', x: pr.x, y: pr.y, age: 0, life: 0.15, owner: pr.owner });
		}
		return;
	}

	// Bullet
	if (dummy) hitDummyWithFx(w, dummy, pr.damage, pr.knockback, pr.x - pr.vx, pr.y - pr.vy);
	if (solid) damageObstacle(w, solid, pr.damage);
	w.effects.push({ kind: 'impact', x: pr.x, y: pr.y, age: 0, life: 0.12, owner: pr.owner });
}

/** A cannon shell bursts, hurting everything in its splash radius. */
function explode(w: ConstructWorld, pr: Projectile) {
	const r = pr.def.radius ?? 50;
	for (const d of w.dummies) {
		if (isStanding(d) && Math.hypot(d.x - pr.x, d.y - pr.y) <= r + DUMMY_HALF_W) {
			hitDummyWithFx(w, d, pr.damage, pr.knockback, pr.x, pr.y);
		}
	}
	for (const o of breakables(w)) {
		const [cx, cy] = center(o);
		if (Math.hypot(cx - pr.x, cy - pr.y) <= r + Math.max(o.w, o.h) / 2) damageObstacle(w, o, pr.damage);
	}
	w.effects.push({ kind: 'blast', x: pr.x, y: pr.y, age: 0, life: 0.5, radius: r, owner: pr.owner });
}

function updatePending(w: ConstructWorld, dt: number) {
	const waiting: PendingSmash[] = [];
	for (const s of w.pending) {
		s.time -= dt;
		if (s.time > 0) {
			waiting.push(s);
			continue;
		}
		// The fist lands in front of wherever the Lantern is aiming NOW
		const p = s.owner;
		const hx = p.x + p.aimX * s.def.range;
		const hy = p.y + p.aimY * s.def.range;
		const r = s.def.radius ?? 40;
		for (const d of w.dummies) {
			if (isStanding(d) && Math.hypot(d.x - hx, d.y - hy) <= r + DUMMY_HALF_W) {
				hitDummyWithFx(w, d, s.damage, s.knockback, p.x, p.y);
			}
		}
		for (const o of breakables(w)) {
			const [cx, cy] = center(o);
			if (Math.hypot(cx - hx, cy - hy) <= r + Math.max(o.w, o.h) / 2) damageObstacle(w, o, s.damage);
		}
	}
	w.pending = waiting;
}

function updateTethers(w: ConstructWorld, dt: number) {
	const active: Tether[] = [];
	for (const t of w.tethers) {
		t.time -= dt;
		const p = t.owner;
		// Dummies have a home to respawn at; crates don't
		const isDummy = 'homeX' in t.target;
		const [tx, ty] = isDummy ? [t.target.x, t.target.y] : center(t.target as Obstacle);
		const dx = p.x - tx;
		const dy = p.y - ty;
		const dist = Math.hypot(dx, dy);

		const gone = isDummy ? !isStanding(t.target as Dummy) : !w.obstacles.includes(t.target as Obstacle);
		if (t.time <= 0 || dist <= TETHER_STOP_DISTANCE || gone) {
			if (isDummy) {
				const d = t.target as Dummy;
				d.vx *= 0.3;
				d.vy *= 0.3;
			}
			continue;
		}

		if (isDummy) {
			const d = t.target as Dummy;
			if (d.caged === 0) {
				d.vx = (dx / dist) * TETHER_PULL_SPEED;
				d.vy = (dy / dist) * TETHER_PULL_SPEED;
			}
		} else {
			// Drag the crate, unless that would shove it into something else
			const o = t.target as Obstacle;
			const step = Math.min(TETHER_PULL_SPEED * dt, dist - TETHER_STOP_DISTANCE);
			const nx = o.x + (dx / dist) * step;
			const ny = o.y + (dy / dist) * step;
			const moved = { ...o, x: nx, y: ny };
			const bumps = w.obstacles.some((other) => other !== o && overlapsRect(moved, other));
			if (!bumps) {
				o.x = nx;
				o.y = ny;
			}
		}
		active.push(t);
	}
	w.tethers = active;
}

function updateTraps(w: ConstructWorld, dt: number) {
	const armed: Trap[] = [];
	for (const t of w.traps) {
		t.life -= dt;
		const catchable = w.dummies.find((d) => isStanding(d) && d.caged === 0 && Math.hypot(d.x - t.x, d.y - t.y) <= t.radius);
		if (catchable) {
			catchable.caged = t.hold;
			catchable.vx = catchable.vy = 0;
			w.effects.push({ kind: 'snap', x: t.x, y: t.y, age: 0, life: 0.3, radius: t.radius });
			continue;
		}
		if (t.life <= 0) {
			w.effects.push({ kind: 'fizzle', x: t.x, y: t.y, age: 0, life: 0.4 });
			continue;
		}
		armed.push(t);
	}
	w.traps = armed;
}

// -------------------------------------------------------------- helpers

type BeamTarget = Obstacle | (Solid & { dummy: Dummy });

/** Nearest breakable-or-solid thing (or dummy) along a ray. Your own walls don't stop you. */
function castAtTargets(x: number, y: number, dx: number, dy: number, range: number, w: ConstructWorld) {
	const targets: BeamTarget[] = [
		...w.obstacles.filter((o) => o.kind !== 'wall'),
		...w.dummies.filter(isStanding).map((d) => ({ ...dummyBox(d), dummy: d }))
	];
	return castBeam<BeamTarget>(x, y, dx, dy, targets, range);
}

function hitDummyWithFx(w: ConstructWorld, d: Dummy, damage: number, knockback: number, fromX: number, fromY: number, shown = damage) {
	const broke = hitDummy(d, damage, knockback, fromX, fromY);
	if (shown >= 1) w.effects.push({ kind: 'number', x: d.x, y: d.y, age: 0, life: 1, value: Math.round(shown) });
	if (broke) w.effects.push({ kind: 'burst', x: d.x, y: d.y - 20, age: 0, life: 0.65 });
}

function damageObstacle(w: ConstructWorld, o: Obstacle, damage: number) {
	if (o.hp === undefined || o.kind === 'wall') return;
	o.hp -= damage;
	if (o.hp <= 0) removeObstacle(w, o, 'burst');
}

/** Removing from w.obstacles also removes it from collisions: they share the array. */
function removeObstacle(w: ConstructWorld, o: Obstacle, effect: 'burst' | 'fizzle') {
	const i = w.obstacles.indexOf(o);
	if (i === -1) return;
	w.obstacles.splice(i, 1);
	const [cx, cy] = center(o);
	w.effects.push({ kind: effect, x: cx, y: cy - o.height, age: 0, life: 0.65 });
}

const breakables = (w: ConstructWorld) => w.obstacles.filter((o) => o.hp !== undefined && o.kind !== 'wall');
const center = (o: Solid): [number, number] => [o.x + o.w / 2, o.y + o.h / 2];
const overlapsRect = (a: Solid, b: Solid) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
