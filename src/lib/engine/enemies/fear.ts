// Sinestro's own constructs, with the yellow ring. He builds like the best
// Lantern the Corps ever had, and everything he builds is meant to frighten:
//
//   Fear Hounds    two great yellow hounds that hunt you down and bite. They
//                  are enemies of their own: shoot them, or wait them out.
//   Gatling        a rotary cannon of Korugar beside him, spun up and swept
//                  across you in a stream of rounds.
//   Crushing Hand  a giant gauntlet rises out of the ground where you stand.
//                  Get clear before it closes: caught, it squeezes, then
//                  throws you. A shield keeps it from closing on you.
//   Executioner    a guillotine frame over where you're going, and the blade
//                  comes down along it.
//   Impalers       a line of spikes tearing up out of the ground toward you.
//
// The cage and the beam stay his too. The hounds, the gun, the hand, the
// blade and the spikes live here (updateFear, once a tick); draw/fear.ts
// draws them.

import type { damagePlayer as DamagePlayer } from '../combat';
import type { ConstructWorld } from '../constructs/system';
import type { Player } from '../player';
import type { steer as Steer, Enemy, EnemyKind } from './enemies';
import type { fire as Fire, AbilityDef, AbilityId } from './redConstructs';

export interface FearCtx {
	damagePlayer: typeof DamagePlayer;
	steer: typeof Steer;
	fire: typeof Fire;
	/** Build an enemy of its own (a hound) into the fight. */
	summon: (w: ConstructWorld, kind: EnemyKind, x: number, y: number, owner: Enemy) => Enemy;
}

export const FEAR_ABILITIES: ReadonlySet<AbilityId> = new Set<AbilityId>(['fearHounds', 'fangs', 'gatling', 'crushingHand', 'executioner', 'impalers']);

/** Hounds out at once, for one Sinestro. */
export const MAX_HOUNDS = 2;
/** The gatling: spin-up before the first round, time between rounds, how wild, how fast it follows you. */
export const GATLING = { spin: 0.3, gap: 0.075, wild: 0.08, turn: 1.5, reach: 46 };
/** The hand: how long it takes to rise, how long it holds you, how often it squeezes, and the throw. */
export const HAND = { rise: 0.85, hold: 1.3, tick: 0.26, throwShare: 2.2, linger: 0.45 };
/** The executioner: how long until the blade falls, how long the frame stays after, and how deep the cut. */
export const BLADE = { fall: 0.95, after: 0.5, depth: 30 };
/** The impalers: how many, how far apart, when the first comes up and how quickly the rest follow, how wide each one hits. */
export const IMPALE = { count: 10, gap: 56, first: 0.3, step: 0.055, width: 36, life: 0.55 };

export interface Gun {
	owner: Enemy;
	angle: number;
	time: number;
	age: number;
	next: number;
	/** Which side of him it hangs. */
	side: 1 | -1;
	/** 0..1 how fast the barrels turn (for drawing). */
	spin: number;
}

export interface Hand {
	owner: Enemy;
	x: number;
	y: number;
	age: number;
	radius: number;
	squeeze: number;
	throwDamage: number;
	knockback: number;
	closed: boolean;
	caught: Player | null;
	hold: number;
	tick: number;
	/** Seconds since it let go (or closed on nothing), for the fade. */
	gone: number;
}

export interface Blade {
	owner: Enemy;
	x: number;
	y: number;
	half: number;
	age: number;
	damage: number;
	knockback: number;
	fallen: boolean;
}

export interface ImpaleLine {
	owner: Enemy;
	x: number;
	y: number;
	ux: number;
	uy: number;
	age: number;
	damage: number;
	knockback: number;
	/** Each spike: where it comes up, and when. */
	spikes: { x: number; y: number; at: number }[];
	hit: Player[];
}

interface FearWorld {
	guns: Gun[];
	hands: Hand[];
	blades: Blade[];
	lines: ImpaleLine[];
	hounds: { hound: Enemy; owner: Enemy }[];
}
const worlds = new WeakMap<ConstructWorld, FearWorld>();
export function fearOf(w: ConstructWorld): FearWorld {
	let f = worlds.get(w);
	if (!f) worlds.set(w, (f = { guns: [], hands: [], blades: [], lines: [], hounds: [] }));
	return f;
}

const standing = (e: Enemy) => e.down === 0 && !e.gone;
const shieldedFrom = (w: ConstructWorld, p: Player) => w.shields.some((sh) => sh.target === p);

/** Where the target will be in `t` seconds (or straight ahead if there isn't one). */
function ahead(e: Enemy, t: number, far: number): [number, number] {
	const p = e.brain.target;
	if (p) return [p.x + p.vx * t, p.y + p.vy * t];
	return [e.x + e.brain.aimX * far, e.y + e.brain.aimY * far];
}

export function startFearAbility(e: Enemy, a: AbilityDef, w: ConstructWorld, ctx: FearCtx) {
	const b = e.brain;
	const f = fearOf(w);
	const might = b.might * (1 + 0.5 * b.rage);
	switch (a.id) {
		case 'fearHounds': {
			const mine = f.hounds.filter((h) => h.owner === e && standing(h.hound)).length;
			for (let i = 0; i < Math.max(1, MAX_HOUNDS - mine); i++) {
				const side = i === 0 ? 1 : -1;
				const x = e.x + b.aimX * 40 - b.aimY * 60 * side;
				const y = e.y + b.aimY * 40 + b.aimX * 60 * side;
				const h = ctx.summon(w, 'fearHound', x, y, e);
				h.brain.might = b.might;
				h.brain.target = b.target;
				f.hounds.push({ hound: h, owner: e });
				w.effects.push({ kind: 'roar', x, y, age: 0, life: 0.5, radius: 60, lift: 20, tint: 'fear' });
			}
			return;
		}
		case 'fangs':
			e.vx += b.aimX * 430;
			e.vy += b.aimY * 430;
			return;
		case 'gatling':
			f.guns.push({ owner: e, angle: Math.atan2(b.aimY, b.aimX), time: a.active, age: 0, next: GATLING.spin, side: b.aimX < 0 ? -1 : 1, spin: 0 });
			return;
		case 'crushingHand': {
			const [x, y] = ahead(e, 0.45, 300);
			f.hands.push({ owner: e, x, y, age: 0, radius: a.radius ?? 74, squeeze: a.damage * might, throwDamage: a.damage * might * HAND.throwShare, knockback: a.knockback, closed: false, caught: null, hold: 0, tick: 0, gone: -1 });
			return;
		}
		case 'executioner': {
			const [x, y] = ahead(e, 0.6, 400);
			f.blades.push({ owner: e, x, y, half: a.radius ?? 120, age: 0, damage: a.damage * might, knockback: a.knockback, fallen: false });
			return;
		}
		case 'impalers': {
			const [tx, ty] = ahead(e, 0.3, 400);
			const d = Math.hypot(tx - e.x, ty - e.y) || 1;
			const ux = (tx - e.x) / d;
			const uy = (ty - e.y) / d;
			const spikes = Array.from({ length: IMPALE.count }, (_, i) => ({ x: e.x + ux * (60 + i * IMPALE.gap), y: e.y + uy * (60 + i * IMPALE.gap), at: IMPALE.first + i * IMPALE.step }));
			f.lines.push({ owner: e, x: e.x, y: e.y, ux, uy, age: 0, damage: a.damage * might, knockback: a.knockback, spikes, hit: [] });
			return;
		}
	}
}

/** While the move lasts: he stands and works the construct; a hound bites once at the end of its lunge. */
export function updateFearAbility(e: Enemy, a: AbilityDef, w: ConstructWorld, players: readonly Player[], dt: number, ctx: FearCtx) {
	const b = e.brain;
	if (a.id === 'fangs') {
		ctx.steer(e, 0, 0, 4, dt);
		if (b.hitDone || b.elapsed < 0.08) return;
		for (const p of players) {
			if (p.downed || Math.hypot(p.x - e.x, p.y - e.y) > a.maxRange + 26) continue;
			b.hitDone = true;
			ctx.damagePlayer(w, p, a.damage * b.might, e.x, e.y, a.knockback);
			w.effects.push({ kind: 'impact', x: p.x, y: p.y, age: 0, life: 0.2, lift: 30 });
		}
		return;
	}
	ctx.steer(e, 0, 0, a.id === 'gatling' ? 9 : 7, dt);
	if (a.id === 'gatling') {
		// He keeps the gun on you for as long as it fires
		const g = fearOf(w).guns.find((k) => k.owner === e);
		if (!g) b.timer = 0;
	}
}

/** Everything he's built that's still out there, once a tick. */
export function updateFear(w: ConstructWorld, players: readonly Player[], dt: number, damagePlayer: typeof DamagePlayer, fire: typeof Fire, gatling: AbilityDef) {
	const f = worlds.get(w);
	if (!f) return;
	updateGuns(w, f, dt, fire, gatling);
	updateHands(w, f, players, dt, damagePlayer);
	updateBlades(w, f, players, dt, damagePlayer);
	updateLines(w, f, players, dt, damagePlayer);
	// Hounds go when he does
	f.hounds = f.hounds.filter(({ hound, owner }) => {
		if (!standing(hound)) return false;
		if (!standing(owner)) {
			hound.brain.lifeLeft = 0;
			return false;
		}
		return true;
	});
}

function updateGuns(w: ConstructWorld, f: FearWorld, dt: number, fire: typeof Fire, gatling: AbilityDef) {
	f.guns = f.guns.filter((g) => {
		const o = g.owner;
		g.time -= dt;
		g.age += dt;
		g.spin = Math.min(1, g.age / GATLING.spin);
		if (g.time <= 0 || !standing(o) || o.stun > 0) return false;
		const t = o.brain.target;
		if (t) {
			let diff = Math.atan2(t.y - o.y, t.x - o.x) - g.angle;
			diff = Math.atan2(Math.sin(diff), Math.cos(diff));
			g.angle += Math.max(-GATLING.turn * dt, Math.min(GATLING.turn * dt, diff));
			g.side = Math.cos(g.angle) < 0 ? -1 : 1;
		}
		g.next -= dt;
		while (g.next <= 0) {
			g.next += GATLING.gap;
			const angle = g.angle + (Math.random() - 0.5) * GATLING.wild;
			const shot = fire(o, w, 'bolt', gatling, Math.cos(angle), Math.sin(angle), false);
			shot.look = 'fearRound';
			// Out of the muzzle, not his chest
			const [mx, my] = gunMuzzle(g);
			shot.x = shot.prevX = mx;
			shot.y = shot.prevY = my;
		}
		return true;
	});
}

/** Where the gun hangs beside him, and where its rounds come out. */
export function gunAt(g: Gun): [number, number] {
	return [g.owner.x + g.side * 34, g.owner.y + 6];
}
export function gunMuzzle(g: Gun): [number, number] {
	const [x, y] = gunAt(g);
	return [x + Math.cos(g.angle) * GATLING.reach, y + Math.sin(g.angle) * GATLING.reach];
}

function updateHands(w: ConstructWorld, f: FearWorld, players: readonly Player[], dt: number, damagePlayer: typeof DamagePlayer) {
	f.hands = f.hands.filter((h) => {
		h.age += dt;
		if (h.gone >= 0) {
			h.gone += dt;
			return h.gone < HAND.linger;
		}
		if (!h.closed) {
			if (h.age < HAND.rise) return true;
			h.closed = true;
			for (const p of players) {
				if (p.downed || p.dash || Math.hypot(p.x - h.x, p.y - h.y) > h.radius) continue;
				// A shield takes the grip; it can't close on what's inside one
				if (shieldedFrom(w, p)) {
					damagePlayer(w, p, h.throwDamage, h.x, h.y + 20, 0);
					continue;
				}
				h.caught = p;
				h.hold = HAND.hold;
				h.tick = 0;
				w.effects.push({ kind: 'callout', x: p.x, y: p.y - 110, age: 0, life: 1.1, text: 'CRUSHED', hurt: true, owner: p });
				break;
			}
			if (!h.caught) h.gone = 0;
			return true;
		}
		const p = h.caught!;
		h.hold -= dt;
		if (p.downed || !standing(h.owner) || shieldedFrom(w, p)) {
			h.caught = null;
			h.gone = 0;
			return true;
		}
		// Held fast where the hand closed
		p.x = p.prevX = h.x;
		p.y = p.prevY = h.y;
		p.vx = p.vy = 0;
		h.tick -= dt;
		if (h.tick <= 0) {
			h.tick = HAND.tick;
			damagePlayer(w, p, h.squeeze * HAND.tick, h.x, h.y, 0);
		}
		if (h.hold <= 0) {
			// And thrown
			damagePlayer(w, p, h.throwDamage, h.owner.x, h.owner.y, h.knockback);
			h.caught = null;
			h.gone = 0;
		}
		return true;
	});
}

function updateBlades(w: ConstructWorld, f: FearWorld, players: readonly Player[], dt: number, damagePlayer: typeof DamagePlayer) {
	f.blades = f.blades.filter((bl) => {
		bl.age += dt;
		if (!bl.fallen && bl.age >= BLADE.fall) {
			bl.fallen = true;
			w.effects.push({ kind: 'impact', x: bl.x, y: bl.y, age: 0, life: 0.3, lift: 0 });
			for (const p of players) {
				if (p.downed || Math.abs(p.x - bl.x) > bl.half || Math.abs(p.y - bl.y) > BLADE.depth) continue;
				damagePlayer(w, p, bl.damage, p.x, bl.y - 60, bl.knockback);
			}
		}
		return bl.age < BLADE.fall + BLADE.after;
	});
}

function updateLines(w: ConstructWorld, f: FearWorld, players: readonly Player[], dt: number, damagePlayer: typeof DamagePlayer) {
	f.lines = f.lines.filter((l) => {
		const before = l.age;
		l.age += dt;
		for (let i = 0; i < l.spikes.length; i++) {
			const s = l.spikes[i];
			if (s.at <= before || s.at > l.age) continue;
			// A wall stops the line: spikes don't come up through stone, or past it
			if (w.obstacles.some((o) => s.x > o.x && s.x < o.x + o.w && s.y > o.y && s.y < o.y + o.h)) {
				for (const rest of l.spikes.slice(i)) rest.at = Infinity;
				break;
			}
			for (const p of players) {
				if (p.downed || l.hit.includes(p) || Math.hypot(p.x - s.x, p.y - s.y) > IMPALE.width) continue;
				l.hit.push(p);
				damagePlayer(w, p, l.damage, s.x - l.ux * 20, s.y - l.uy * 20, l.knockback);
			}
		}
		return l.age < IMPALE.first || l.spikes.some((s) => Number.isFinite(s.at) && l.age < s.at + IMPALE.life);
	});
}
