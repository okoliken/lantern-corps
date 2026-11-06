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
//   Manta's divers    a speargun, one heavy bolt and a long reload; a dive
//                     knife, stabbed in low.
//   Thunderers of Qward anti-matter soldiers. Qwa-bolts, javelins of black
//                     lightning thrown hard, and the same bolt held as a
//                     blade. Where they walk, light dies (Lights Out).
//   Firefly           Garfield Lynns, on a jetpack. A flamethrower held on
//                     you, firebombs lobbed onto you; both leave fire where
//                     they end (`ignitions`, for the mission to light).
//   Black Manta       wrist blades, two quick cuts; a harpoon that bites in and
//                     reels you to him; and the helmet's eyes, two red beams
//                     held on you after a long glow (a shield takes them).
//
// Projectiles go into the Red Lantern shot list (it flies them, hits things
// and bursts shells), with a `look` so they're drawn as what they are.
// Grenades, harpoons, Manta's beams and the swing trails live here
// (updateGear, once a tick).

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

export const GEAR_ABILITIES: ReadonlySet<AbilityId> = new Set<AbilityId>([
	'pistol',
	'batSwing',
	'pulseRifle',
	'shockBaton',
	'stunGrenade',
	'handCannon',
	'forgeBlade',
	'speargun',
	'diveKnife',
	'wristBlades',
	'mantaHarpoon',
	'opticBlast',
	'qwaBolt',
	'qwaBlade',
	'flamethrower',
	'firebomb'
]);
export const isGearAbility = (id: AbilityId) => GEAR_ABILITIES.has(id);
const MELEE: ReadonlySet<AbilityId> = new Set<AbilityId>(['batSwing', 'shockBaton', 'forgeBlade', 'diveKnife', 'wristBlades', 'qwaBlade']);
export const isGearMelee = (id: AbilityId | null) => id !== null && MELEE.has(id);

/** Pistol: three shots, close together, and not where they were aimed. */
const PISTOL = { shots: 3, gap: 0.13, wild: 0.34 };
/** Pulse rifle: a tight burst, each bolt led onto where you'll be. */
const RIFLE = { shots: 3, gap: 0.1, wild: 0.04 };
/** The hand-cannon kicks the smith back a step. */
const CANNON = { recoil: 170 };
/** A swing lunges them in a little. */
const LUNGE: Partial<Record<AbilityId, number>> = { batSwing: 260, shockBaton: 200, forgeBlade: 150, diveKnife: 300, wristBlades: 240, qwaBlade: 220 };
/** How wide a swing reaches round the aim (cosine of the half angle). */
const ARC: Partial<Record<AbilityId, number>> = { batSwing: 0.35, shockBaton: 0.45, forgeBlade: 0.05, diveKnife: 0.55, wristBlades: 0.3, qwaBlade: 0.4 };
/** Wrist blades: the second cut comes this long after the first. */
const SECOND_CUT = 0.17;
/** The harpoon: how long it reels you in, and how hard. */
const HARPOON = { reel: 0.75, pull: 760, stop: 70 };
/** The helmet's beams: how wide they hit, and how often they bite. */
const OPTIC = { width: 26, tick: 0.1, eyeGap: 7 };
/** The baton's jolt: legs that won't answer for a moment. */
const SHOCK = { time: 1.1 };
/** Stun grenades: time in the air, how long the stun lasts. */
const GRENADE = { flight: 0.95, stun: 1.5, lead: 0.5 };

export interface Grenade {
	/** A stun grenade, or one of Firefly's firebombs. */
	fire?: boolean;
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
	kind: 'swing' | 'muzzle' | 'bang' | 'spark' | 'burst';
	weapon?: AbilityId;
	x: number;
	y: number;
	angle: number;
	dir: 1 | -1;
	radius: number;
	age: number;
	life: number;
}

/** Black Manta's harpoon: flying, or bitten in and reeling someone to him. */
export interface Harpoon {
	owner: Enemy;
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	damage: number;
	/** Who it's in, and how much longer it pulls. */
	caught: Player | null;
	reel: number;
}

/** Firefly's flame, held along the aim while it lasts. */
export interface Flame {
	owner: Enemy;
	angle: number;
	time: number;
	tick: number;
	dps: number;
	reach: number;
}

/** The helmet's beams, held along the aim while the blast lasts. */
export interface OpticBeam {
	owner: Enemy;
	angle: number;
	/** How far they reach this tick (a wall stops them). */
	length: number;
	time: number;
	tick: number;
	dps: number;
}

interface GearWorld {
	grenades: Grenade[];
	harpoons: Harpoon[];
	beams: OpticBeam[];
	flames: Flame[];
	/** Where fire has caught this tick (a flame's end, a firebomb's landing): the mission lights it, if it burns things. */
	ignitions: { x: number; y: number }[];
	fx: GearFx[];
}
const worlds = new WeakMap<ConstructWorld, GearWorld>();
export function gearOf(w: ConstructWorld): GearWorld {
	let g = worlds.get(w);
	if (!g) worlds.set(w, (g = { grenades: [], harpoons: [], beams: [], flames: [], ignitions: [], fx: [] }));
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
	if (a.id === 'mantaHarpoon') {
		const speed = a.speed ?? 900;
		g.harpoons.push({
			owner: e,
			x: e.x + b.aimX * 20,
			y: e.y + b.aimY * 20,
			vx: b.aimX * speed,
			vy: b.aimY * speed,
			life: (a.maxRange + 40) / speed,
			damage: a.damage * b.might,
			caught: null,
			reel: 0
		});
	}
	if (a.id === 'flamethrower') g.flames.push({ owner: e, angle, time: a.active, tick: 0, dps: a.damage * b.might, reach: a.radius ?? 260 });
	if (a.id === 'firebomb') {
		const t = b.target;
		g.grenades.push({ fire: true, owner: e, fromX: e.x, fromY: e.y, x: t ? t.x + t.vx * 0.4 : e.x + b.aimX * 300, y: t ? t.y + t.vy * 0.4 : e.y + b.aimY * 300, t: 0, damage: a.damage * b.might, knockback: a.knockback, radius: a.radius ?? 110 });
	}
	if (a.id === 'opticBlast') g.beams.push({ owner: e, angle, length: 0, time: a.active, tick: 0, dps: a.damage * b.might });
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
		case 'qwaBolt': {
			steer(e, 0, 0, 7, dt);
			if (b.fired > 0) return;
			b.fired = 1;
			const [dx, dy] = t ? leadOnto(e, t, a.speed ?? 760) : [b.aimX, b.aimY];
			e.dir = dx < 0 ? -1 : 1;
			const shot = fire(e, w, 'bolt', a, dx, dy, false);
			shot.look = 'qwa';
			g.fx.push({ kind: 'muzzle', weapon: a.id, x: e.x, y: e.y, angle: Math.atan2(dy, dx), dir: e.dir, radius: 0, age: 0, life: 0.18 });
			return;
		}
		case 'speargun': {
			steer(e, 0, 0, 7, dt);
			if (b.fired > 0) return;
			b.fired = 1;
			const [dx, dy] = t ? leadOnto(e, t, a.speed ?? 820) : [b.aimX, b.aimY];
			e.dir = dx < 0 ? -1 : 1;
			const shot = fire(e, w, 'bolt', a, dx, dy, false);
			shot.look = 'spear';
			return;
		}
		case 'wristBlades': {
			steer(e, 0, 0, 7, dt);
			// Two cuts: one as it starts, one a beat later with a second lunge
			const due = b.elapsed >= SECOND_CUT ? 2 : 1;
			if (b.fired >= due) return;
			b.fired++;
			if (b.fired === 2) {
				e.vx += b.aimX * (LUNGE.wristBlades ?? 0) * 0.6;
				e.vy += b.aimY * (LUNGE.wristBlades ?? 0) * 0.6;
				g.fx.push({ kind: 'swing', weapon: a.id, x: e.x, y: e.y, angle: Math.atan2(b.aimY, b.aimX), dir: (e.dir * -1) as 1 | -1, radius: a.maxRange + 18, age: 0, life: 0.22 });
			}
			cut(e, a, w, players, ctx);
			return;
		}
		case 'flamethrower':
			// He hangs in the air while it burns; it does the rest (updateGear)
			steer(e, 0, 0, 8, dt);
			if (!g.flames.some((f) => f.owner === e)) b.timer = 0;
			return;
		case 'firebomb':
			steer(e, 0, 0, 8, dt);
			return;
		case 'mantaHarpoon':
		case 'opticBlast':
			// Fired at the start; it does the rest on its own (updateGear). He plants his feet while it lasts.
			steer(e, 0, 0, 10, dt);
			if (a.id === 'mantaHarpoon' && !g.harpoons.some((h) => h.owner === e)) b.timer = 0;
			if (a.id === 'opticBlast' && !g.beams.some((bm) => bm.owner === e)) b.timer = 0;
			return;
		case 'batSwing':
		case 'shockBaton':
		case 'forgeBlade':
		case 'diveKnife':
		case 'qwaBlade': {
			steer(e, 0, 0, 7, dt);
			if (b.hitDone) return;
			b.hitDone = true;
			cut(e, a, w, players, ctx);
			return;
		}
		case 'stunGrenade':
			// Thrown at the start; it does the rest on its own (updateGear)
			steer(e, 0, 0, 8, dt);
			return;
	}
}

/** A swing or a stab: everyone in front of them within reach. */
function cut(e: Enemy, a: AbilityDef, w: ConstructWorld, players: readonly Player[], { damagePlayer, power }: GearCtx) {
	const g = gearOf(w);
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
}

/** Once a tick: grenades in flight and going off, and the trails fading. */
export function updateGear(w: ConstructWorld, players: readonly Player[], dt: number, damagePlayer: typeof DamagePlayer) {
	const g = worlds.get(w);
	if (!g) return;
	for (const f of g.fx) f.age += dt;
	g.fx = g.fx.filter((f) => f.age < f.life);
	updateHarpoons(w, g, players, dt, damagePlayer);
	updateBeams(w, g, players, dt, damagePlayer);
	updateFlames(w, g, players, dt, damagePlayer);
	for (const n of [...g.grenades]) {
		n.t += dt;
		if (n.t < GRENADE.flight) continue;
		g.grenades.splice(g.grenades.indexOf(n), 1);
		g.fx.push({ kind: n.fire ? 'burst' : 'bang', x: n.x, y: n.y, angle: 0, dir: 1, radius: n.radius, age: 0, life: 0.5 });
		if (n.fire) g.ignitions.push({ x: n.x, y: n.y });
		for (const p of players) {
			if (p.downed || Math.hypot(p.x - n.x, p.y - n.y) > n.radius) continue;
			damagePlayer(w, p, n.damage, n.x, n.y, n.knockback);
			if (n.fire) continue;
			if (p.chilled <= 0) w.effects.push({ kind: 'callout', x: p.x, y: p.y - 100, age: 0, life: 1.2, text: 'STUNNED', hurt: true, owner: p });
			p.chilled = Math.max(p.chilled, GRENADE.stun);
		}
	}
}

/** How far through its flight a grenade is (0..1), for drawing the arc and the warning. */
export const grenadeProgress = (n: Grenade) => Math.min(1, n.t / GRENADE.flight);

const shieldedFrom = (w: ConstructWorld, p: Player) => w.shields.some((sh) => sh.target === p);

/** Harpoons fly until they hit someone or run out of line; one that bites reels them in. A shield knocks it away. */
function updateHarpoons(w: ConstructWorld, g: GearWorld, players: readonly Player[], dt: number, damagePlayer: typeof DamagePlayer) {
	g.harpoons = g.harpoons.filter((h) => {
		const o = h.owner;
		if (!isStandingEnemy(o)) return false;
		if (h.caught) {
			const p = h.caught;
			h.reel -= dt;
			h.x = p.x;
			h.y = p.y;
			const dx = o.x - p.x;
			const dy = o.y - p.y;
			const d = Math.hypot(dx, dy) || 1;
			if (h.reel <= 0 || p.downed || d < HARPOON.stop || shieldedFrom(w, p)) return false;
			p.vx = (dx / d) * HARPOON.pull;
			p.vy = (dy / d) * HARPOON.pull;
			return true;
		}
		h.life -= dt;
		h.x += h.vx * dt;
		h.y += h.vy * dt;
		if (w.obstacles.some((ob) => h.x > ob.x && h.x < ob.x + ob.w && h.y > ob.y && h.y < ob.y + ob.h)) return false;
		for (const p of players) {
			if (p.downed || Math.hypot(p.x - h.x, p.y - h.y) > 30) continue;
			damagePlayer(w, p, h.damage, h.x - h.vx * 0.05, h.y - h.vy * 0.05, 0);
			if (shieldedFrom(w, p) || p.dash) return false;
			h.caught = p;
			h.reel = HARPOON.reel;
			w.effects.push({ kind: 'callout', x: p.x, y: p.y - 100, age: 0, life: 1, text: 'HOOKED', hurt: true, owner: p });
			return true;
		}
		return h.life > 0;
	});
}

/** The helmet's beams: they reach until a wall, and bite whoever's in them, a shield taking it instead. */
function updateBeams(w: ConstructWorld, g: GearWorld, players: readonly Player[], dt: number, damagePlayer: typeof DamagePlayer) {
	g.beams = g.beams.filter((bm) => {
		const o = bm.owner;
		bm.time -= dt;
		if (bm.time <= 0 || !isStandingEnemy(o) || o.stun > 0) return false;
		// It drags round after you, slowly
		const t = o.brain.target;
		if (t) {
			const want = Math.atan2(t.y - o.y, t.x - o.x);
			let diff = want - bm.angle;
			diff = Math.atan2(Math.sin(diff), Math.cos(diff));
			bm.angle += Math.max(-0.9 * dt, Math.min(0.9 * dt, diff));
		}
		const ux = Math.cos(bm.angle);
		const uy = Math.sin(bm.angle);
		const reach = ABILITY_REACH;
		let length = reach;
		for (let d = 20; d < reach; d += 16) {
			const x = o.x + ux * d;
			const y = o.y + uy * d;
			if (w.obstacles.some((ob) => x > ob.x && x < ob.x + ob.w && y > ob.y && y < ob.y + ob.h)) {
				length = d;
				break;
			}
		}
		bm.length = length;
		bm.tick -= dt;
		if (bm.tick > 0) return true;
		bm.tick = OPTIC.tick;
		for (const p of players) {
			if (p.downed) continue;
			const along = (p.x - o.x) * ux + (p.y - o.y) * uy;
			const off = Math.abs(-(p.x - o.x) * uy + (p.y - o.y) * ux);
			if (along < 0 || along > length || off > OPTIC.width) continue;
			damagePlayer(w, p, bm.dps * OPTIC.tick, o.x, o.y, 0);
		}
		return true;
	});
}

/** How far the helmet's beams reach. */
const ABILITY_REACH = 680;
/** The two beams leave the helmet this far apart (for drawing). */
export const OPTIC_EYE_GAP = OPTIC.eyeGap;

const isStandingEnemy = (e: Enemy) => e.down === 0 && !e.gone;

/** Firefly's flame: it follows his aim slowly, burns whoever's in its cone, and the ground where it ends catches. */
function updateFlames(w: ConstructWorld, g: GearWorld, players: readonly Player[], dt: number, damagePlayer: typeof DamagePlayer) {
	g.flames = g.flames.filter((f) => {
		const o = f.owner;
		f.time -= dt;
		if (f.time <= 0 || !isStandingEnemy(o) || o.stun > 0) return false;
		const t = o.brain.target;
		if (t) {
			let diff = Math.atan2(t.y - o.y, t.x - o.x) - f.angle;
			diff = Math.atan2(Math.sin(diff), Math.cos(diff));
			f.angle += Math.max(-1.2 * dt, Math.min(1.2 * dt, diff));
		}
		f.tick -= dt;
		if (f.tick > 0) return true;
		f.tick = FLAME.tick;
		for (const p of players) {
			if (p.downed) continue;
			const dx = p.x - o.x;
			const dy = p.y - o.y;
			const d = Math.hypot(dx, dy);
			if (d > f.reach) continue;
			let off = Math.atan2(dy, dx) - f.angle;
			off = Math.atan2(Math.sin(off), Math.cos(off));
			if (d > 30 && Math.abs(off) > FLAME.halfAngle) continue;
			damagePlayer(w, p, f.dps * FLAME.tick, o.x, o.y, 0);
		}
		// Now and then the ground where it ends catches
		if (Math.random() < FLAME.catches) g.ignitions.push({ x: o.x + Math.cos(f.angle) * f.reach * 0.85, y: o.y + Math.sin(f.angle) * f.reach * 0.85 });
		return true;
	});
}

/** The flame's cone: how wide, how often it bites, and the chance a bite sets the ground alight. */
const FLAME = { halfAngle: 0.32, tick: 0.25, catches: 0.2 };
export const FLAME_HALF_ANGLE = FLAME.halfAngle;
