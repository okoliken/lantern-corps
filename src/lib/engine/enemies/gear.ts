// People without rings: Scarecrow's Gotham thugs, Sinestro's police on
// Korugar, and the Weaponers of Qward. They walk, they carry real weapons,
// and they fight like who they are.
//
//   Gotham thugs      street hired muscle. A pistol fired wild, three shots
//                     and hope; a baseball bat. They rush in and scatter.
//   Korugar Enforcers trained riot police. A pulse rifle, a short accurate
//                     burst led onto where you're going; a shock baton that
//                     locks your legs up; stun grenades lobbed onto you.
//   Weaponers of Qward the anti-matter universe's smiths. A hand-cannon of
//                     their own making, slow and heavy, that bursts where it
//                     lands; a forged blade swung with both hands.
//
// Projectiles go into the Red Lantern shot list (it flies them, hits things
// and bursts shells), with a `look` so they're drawn as what they are.
// Grenades and the swing trails live here (updateGear, once a tick).

import type { damagePlayer as DamagePlayer } from '../combat';
import type { ConstructWorld } from '../constructs/system';
import type { Player } from '../player';
import type { steer as Steer, Enemy } from './enemies';
import type { fire as Fire, power as Power, AbilityDef, AbilityId } from './redConstructs';

/** What the moves need from the rest of the engine, handed in (this file sits in the enemies import cycle, like league.ts). */
export interface GearCtx {
	damagePlayer: typeof DamagePlayer;
	steer: typeof Steer;
	power: typeof Power;
	fire: typeof Fire;
}

export const GEAR_ABILITIES: ReadonlySet<AbilityId> = new Set<AbilityId>(['pistol', 'batSwing', 'pulseRifle', 'shockBaton', 'stunGrenade', 'handCannon', 'forgeBlade']);
export const isGearAbility = (id: AbilityId) => GEAR_ABILITIES.has(id);
const MELEE: ReadonlySet<AbilityId> = new Set<AbilityId>(['batSwing', 'shockBaton', 'forgeBlade']);
export const isGearMelee = (id: AbilityId | null) => id !== null && MELEE.has(id);

/** Pistol: three shots, close together, and not where they were aimed. */
const PISTOL = { shots: 3, gap: 0.13, wild: 0.34 };
/** Pulse rifle: a tight burst, each bolt led onto where you'll be. */
const RIFLE = { shots: 3, gap: 0.1, wild: 0.04 };
/** The hand-cannon kicks the smith back a step. */
const CANNON = { recoil: 170 };
/** A swing lunges them in a little. */
const LUNGE: Partial<Record<AbilityId, number>> = { batSwing: 260, shockBaton: 200, forgeBlade: 150 };
/** How wide a swing reaches round the aim (cosine of the half angle). */
const ARC: Partial<Record<AbilityId, number>> = { batSwing: 0.35, shockBaton: 0.45, forgeBlade: 0.05 };
/** The baton's jolt: legs that won't answer for a moment. */
const SHOCK = { time: 1.1 };
/** Stun grenades: time in the air, how long the stun lasts. */
const GRENADE = { flight: 0.95, stun: 1.5, lead: 0.5 };

export interface Grenade {
	owner: Enemy;
	fromX: number;
	fromY: number;
	x: number;
	y: number;
	t: number;
	damage: number;
	knockback: number;
	radius: number;
}

/** Something to draw for a moment: a swing's trail, a muzzle flash, a grenade going off. */
export interface GearFx {
	kind: 'swing' | 'muzzle' | 'bang' | 'spark';
	weapon?: AbilityId;
	x: number;
	y: number;
	angle: number;
	dir: 1 | -1;
	radius: number;
	age: number;
	life: number;
}

interface GearWorld {
	grenades: Grenade[];
	fx: GearFx[];
}
const worlds = new WeakMap<ConstructWorld, GearWorld>();
export function gearOf(w: ConstructWorld): GearWorld {
	let g = worlds.get(w);
	if (!g) worlds.set(w, (g = { grenades: [], fx: [] }));
	return g;
}

/** In front of where they're aiming. */
function inArc(e: Enemy, p: Player, cos: number): boolean {
	const dx = p.x - e.x;
	const dy = p.y - e.y;
	const d = Math.hypot(dx, dy);
	return d < 14 || (dx * e.brain.aimX + dy * e.brain.aimY) / d >= cos;
}

/** Aim at where the target will be when a shot this fast gets there. */
function leadOnto(e: Enemy, t: Player, speed: number): [number, number] {
	const eta = Math.hypot(t.x - e.x, t.y - e.y) / speed;
	const dx = t.x + t.vx * eta - e.x;
	const dy = t.y + t.vy * eta - e.y;
	const d = Math.hypot(dx, dy) || 1;
	return [dx / d, dy / d];
}

export function startGearAbility(e: Enemy, a: AbilityDef, w: ConstructWorld) {
	const b = e.brain;
	const g = gearOf(w);
	const angle = Math.atan2(b.aimY, b.aimX);
	const lunge = LUNGE[a.id];
	if (lunge) {
		e.vx += b.aimX * lunge;
		e.vy += b.aimY * lunge;
		g.fx.push({ kind: 'swing', weapon: a.id, x: e.x, y: e.y, angle, dir: e.dir, radius: a.maxRange + 18, age: 0, life: 0.26 });
	}
	if (a.id === 'stunGrenade') {
		const t = b.target;
		const tx = t ? t.x + t.vx * GRENADE.lead : e.x + b.aimX * a.maxRange * 0.7;
		const ty = t ? t.y + t.vy * GRENADE.lead : e.y + b.aimY * a.maxRange * 0.7;
		g.grenades.push({ owner: e, fromX: e.x, fromY: e.y, x: tx, y: ty, t: 0, damage: a.damage * b.might, knockback: a.knockback, radius: a.radius ?? 110 });
	}
}

export function updateGearAbility(e: Enemy, a: AbilityDef, w: ConstructWorld, players: readonly Player[], dt: number, ctx: GearCtx) {
	const { damagePlayer, steer, power, fire } = ctx;
	const b = e.brain;
	const g = gearOf(w);
	const t = b.target;
	switch (a.id) {
		case 'pistol':
		case 'pulseRifle': {
			steer(e, 0, 0, 8, dt);
			const spec = a.id === 'pistol' ? PISTOL : RIFLE;
			if (b.fired >= spec.shots || b.elapsed < b.fired * spec.gap) return;
			b.fired++;
			let [dx, dy] = t && a.id === 'pulseRifle' ? leadOnto(e, t, a.speed ?? 900) : [b.aimX, b.aimY];
			const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * spec.wild;
			dx = Math.cos(angle);
			dy = Math.sin(angle);
			e.dir = dx < 0 ? -1 : 1;
			const shot = fire(e, w, 'bolt', a, dx, dy, false);
			shot.look = a.id === 'pistol' ? 'bullet' : 'energy';
			g.fx.push({ kind: 'muzzle', weapon: a.id, x: e.x, y: e.y, angle, dir: e.dir, radius: 0, age: 0, life: 0.07 });
			return;
		}
		case 'handCannon': {
			steer(e, 0, 0, 6, dt);
			if (b.fired > 0) return;
			b.fired = 1;
			const angle = Math.atan2(b.aimY, b.aimX);
			const shot = fire(e, w, 'shell', a, b.aimX, b.aimY, false);
			shot.look = 'slug';
			shot.radius = a.radius;
			e.vx -= b.aimX * CANNON.recoil;
			e.vy -= b.aimY * CANNON.recoil;
			g.fx.push({ kind: 'muzzle', weapon: a.id, x: e.x, y: e.y, angle, dir: e.dir, radius: 0, age: 0, life: 0.12 });
			return;
		}
		case 'batSwing':
		case 'shockBaton':
		case 'forgeBlade': {
			steer(e, 0, 0, 7, dt);
			if (b.hitDone) return;
			b.hitDone = true;
			const reach = a.maxRange + 24;
			const cos = ARC[a.id] ?? 0.35;
			for (const p of players) {
				if (p.downed || Math.hypot(p.x - e.x, p.y - e.y) > reach || !inArc(e, p, cos)) continue;
				const dealt = damagePlayer(w, p, power(e, a), e.x, e.y, a.knockback);
				w.effects.push({ kind: 'impact', x: p.x, y: p.y, age: 0, life: 0.2, lift: 40 });
				if (a.id === 'shockBaton') {
					g.fx.push({ kind: 'spark', weapon: a.id, x: p.x, y: p.y, angle: 0, dir: e.dir, radius: 30, age: 0, life: 0.45 });
					// The jolt goes through even if the bubble took the hit: it's the current, not the blow
					if (dealt > 0 || p.chilled <= 0) {
						if (p.chilled <= 0) w.effects.push({ kind: 'callout', x: p.x, y: p.y - 100, age: 0, life: 1.1, text: 'SHOCKED', hurt: true, owner: p });
						p.chilled = Math.max(p.chilled, SHOCK.time);
					}
				}
			}
			return;
		}
		case 'stunGrenade':
			// Thrown at the start; it does the rest on its own (updateGear)
			steer(e, 0, 0, 8, dt);
			return;
	}
}

/** Once a tick: grenades in flight and going off, and the trails fading. */
export function updateGear(w: ConstructWorld, players: readonly Player[], dt: number, damagePlayer: typeof DamagePlayer) {
	const g = worlds.get(w);
	if (!g) return;
	for (const f of g.fx) f.age += dt;
	g.fx = g.fx.filter((f) => f.age < f.life);
	for (const n of [...g.grenades]) {
		n.t += dt;
		if (n.t < GRENADE.flight) continue;
		g.grenades.splice(g.grenades.indexOf(n), 1);
		g.fx.push({ kind: 'bang', x: n.x, y: n.y, angle: 0, dir: 1, radius: n.radius, age: 0, life: 0.5 });
		for (const p of players) {
			if (p.downed || Math.hypot(p.x - n.x, p.y - n.y) > n.radius) continue;
			damagePlayer(w, p, n.damage, n.x, n.y, n.knockback);
			if (p.chilled <= 0) w.effects.push({ kind: 'callout', x: p.x, y: p.y - 100, age: 0, life: 1.2, text: 'STUNNED', hurt: true, owner: p });
			p.chilled = Math.max(p.chilled, GRENADE.stun);
		}
	}
}

/** How far through its flight a grenade is (0..1), for drawing the arc and the warning. */
export const grenadeProgress = (n: Grenade) => Math.min(1, n.t / GRENADE.flight);
