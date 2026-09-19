// Earth's heroes: the Flash and Hawkgirl, who fight beside John in Act 2.
//
// They aren't Lanterns. No ring, no willpower, no constructs: each has powers
// of their own, run here instead of the construct system. The Game treats
// them like any other player otherwise (enemies hunt them, they get knocked
// down and back up), and HeroInput drives them like an AI partner.
//
//  THE FLASH (on foot, always moving)
//    Blitz          runs in, three punches faster than you can see, and out
//    Speed Barrage  zips through every enemy near him, hitting each one
//    Tornado        runs circles round a crowd: they're dragged in, spun
//                   helpless, and thrown out; shots caught in it fly apart
//    Lightning      Speed Force lightning thrown at someone out of reach
//    Phase dodge    sidesteps anything winding up on him (untouchable for a moment)
//  HAWKGIRL (in the air)
//    Nth Mace       a crackling swing that breaks enemy shields (Nth metal)
//    Dive           up out of reach, then straight down on them: a shockwave
//    Wing Rush      wings first through a line of enemies
//    Thunderclap    the mace into the ground, lightning all around
//    Wing Guard     wings wrapped round her against a big hit

import { hitDummyWithFx, type ConstructWorld } from './constructs/system';
import { isStanding, type Dummy } from './dummy';
import { isEnemy, type Enemy } from './enemies/enemies';
import { IDLE, type InputSource, type Intent } from './input';
import type { HeroId } from './lanterns';
import { moveBody, type Solid } from './physics';
import { FEET_HALF_H, FEET_HALF_W, type Player } from './player';

export type HeroPower = 'blitz' | 'barrage' | 'tornado' | 'lightning' | 'dodge' | 'mace' | 'dive' | 'rush' | 'thunder' | 'guard';

interface Move {
	power: HeroPower;
	elapsed: number;
	/** Blitz: 'in', 'hits', 'out'. Dive: 'rise', 'fall'. */
	step: string;
	/** Who it's aimed at. */
	target: Dummy | null;
	/** Barrage: who's left to hit. */
	queue: Dummy[];
	/** Already hit (once each). */
	hit: Dummy[];
	/** Where it's going, or the middle of a tornado. */
	x: number;
	y: number;
	/** Where it started from (barrage and dodge zips). */
	fromX: number;
	fromY: number;
	count: number;
}

export interface HeroState {
	id: HeroId;
	move: Move | null;
	cooldowns: Record<HeroPower, number>;
	/** Who they're fighting (HeroInput picks): an enemy, or a broken Manhunter's core. */
	target: Dummy | null;
	/** The Flash's speed trail: where he's been, newest last. */
	trail: { x: number; y: number; age: number }[];
	/** Seconds left with Hawkgirl's wings wrapped round her. */
	guard: number;
	/** How high above her usual flying height Hawkgirl is (a dive), px. */
	rise: number;
}

/** A flash of lightning, a tornado, a shockwave: drawn by draw/heroes.ts. */
export interface HeroFx {
	kind: 'bolt' | 'tornado' | 'thunder' | 'quake' | 'mace' | 'zip';
	x: number;
	y: number;
	/** Bolts and zips: the other end. */
	x2?: number;
	y2?: number;
	age: number;
	life: number;
	radius?: number;
	angle?: number;
	/** Drawn this high above the ground. */
	lift?: number;
	/** Reverse-Flash's: red lightning instead of yellow. */
	red?: boolean;
}

const COOLDOWNS: Record<HeroPower, number> = {
	blitz: 1.3,
	barrage: 7,
	tornado: 13,
	lightning: 4.5,
	dodge: 2.2,
	mace: 1,
	dive: 7,
	rush: 5,
	thunder: 10,
	guard: 5
};

// ---- The Flash ----
/** How fast he runs in and out of a Blitz (px/s), and how close he stops. */
const BLITZ_SPEED = 1100;
const BLITZ_REACH = 32;
export const BLITZ = { punches: 3, gap: 0.08, damage: 7, knockback: 80, lastKnockback: 300, range: 620 };
/** Speed Barrage: how many, how far he looks, how long each zip takes. */
export const BARRAGE = { count: 5, range: 480, zip: 0.075, damage: 16, knockback: 280 };
/** Tornado: how long, how wide it drags, how wide it holds, and the damage. */
export const TORNADO = { time: 2.2, pull: 270, hold: 150, pullForce: 1400, dps: 10, fling: 480, flingDamage: 14, circle: 85 };
export const LIGHTNING = { minRange: 200, range: 700, damage: 24, knockback: 200, stun: 0.45 };
const DODGE = { distance: 120, time: 0.12, invuln: 0.4 };

// ---- Hawkgirl ----
export const MACE = { reach: 82, damage: 18, knockback: 360, windup: 0.16 };
/** Dive: how high she climbs, how long, and the shockwave where she lands. */
export const DIVE = { range: 540, riseTime: 0.45, rise: 150, fallTime: 0.2, radius: 120, damage: 34, knockback: 520, stun: 0.9 };
const RUSH = { length: 320, time: 0.26, width: 42, damage: 16, knockback: 320 };
export const THUNDER = { radius: 160, damage: 22, knockback: 380, stun: 0.7 };
/** Wing Guard: how long, and the share of any hit that gets through. */
export const GUARD = { time: 1.1, takes: 0.25 };

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

const fxLists = new WeakMap<ConstructWorld, HeroFx[]>();
/** The heroes' effects in this world (lightning, tornadoes, shockwaves). */
export function heroFx(w: ConstructWorld): HeroFx[] {
	let list = fxLists.get(w);
	if (!list) fxLists.set(w, (list = []));
	return list;
}

/** Age the heroes' effects: once per tick, after every hero has moved. */
export function updateHeroFx(w: ConstructWorld, dt: number) {
	const fx = heroFx(w);
	for (const f of fx) f.age += dt;
	fx.splice(0, fx.length, ...fx.filter((f) => f.age < f.life));
}

export function createHeroState(id: HeroId): HeroState {
	const cooldowns = Object.fromEntries(Object.keys(COOLDOWNS).map((k) => [k, 0])) as Record<HeroPower, number>;
	// Big moves aren't ready the moment the fight starts
	cooldowns.barrage = 3;
	cooldowns.tornado = 6;
	cooldowns.dive = 2;
	cooldowns.thunder = 5;
	return { id, move: null, cooldowns, target: null, trail: [], guard: 0, rise: 0 };
}

/** Is a hero in the middle of a move that carries them (the Game skips normal movement)? */
export function heroMoving(p: Player): boolean {
	const m = p.hero?.move;
	if (!m) return false;
	return m.power !== 'mace' && m.power !== 'thunder' && m.power !== 'lightning' && !(m.power === 'blitz' && m.step === 'hits');
}

const enemiesOf = (w: ConstructWorld) => w.dummies.filter((d): d is Enemy => isEnemy(d) && isStanding(d));
/** Everything a hero can hit: enemies, and a broken Manhunter's core. */
const foesOf = (w: ConstructWorld) => w.dummies.filter((d) => isStanding(d) && (isEnemy(d) || d.kind === 'manhunterCore'));
/** Nth metal: Hawkgirl's mace does this many times the damage to a Manhunter's core. */
export const NTH_VS_CORE = 3;

/**
 * One tick of a hero's powers: pick a move when free, run the one going.
 * Called by the Game instead of the construct and signature updates.
 */
export function updateHero(p: Player, dt: number, w: ConstructWorld, solids: readonly Solid[]) {
	const h = p.hero;
	if (!h) return;
	for (const k in h.cooldowns) h.cooldowns[k as HeroPower] = Math.max(0, h.cooldowns[k as HeroPower] - dt);
	h.guard = Math.max(0, h.guard - dt);
	p.actionTimer = Math.max(0, p.actionTimer - dt);
	p.shotTimer = Math.max(0, p.shotTimer - dt);
	for (const t of h.trail) t.age += dt;
	h.trail = h.trail.filter((t) => t.age < 0.28);

	// Knocked down, or Grodd in their head: no powers
	if (p.downed || p.confused > 0) {
		h.move = null;
		h.rise = 0;
		return;
	}
	if (!h.move) choose(p, h, w);
	if (h.move) run(p, h, h.move, dt, w, solids);
	// Hawkgirl drops back to her usual height after a dive
	if (h.move?.power !== 'dive') h.rise = Math.max(0, h.rise - 400 * dt);
	// The Flash leaves a streak behind whenever he's really moving
	if (h.id === 'flash' && Math.hypot(p.vx, p.vy) > 300) h.trail.push({ x: p.x, y: p.y, age: 0 });
}

function begin(h: HeroState, power: HeroPower, target: Dummy | null, x = 0, y = 0): Move {
	h.cooldowns[power] = COOLDOWNS[power];
	h.move = { power, elapsed: 0, step: '', target, queue: [], hit: [], x, y, fromX: 0, fromY: 0, count: 0 };
	return h.move;
}

/** What to do next, if anything. Defence first, then the big moves when they'd count, then the basics. */
function choose(p: Player, h: HeroState, w: ConstructWorld) {
	const enemies = enemiesOf(w);
	const ready = (k: HeroPower) => h.cooldowns[k] <= 0;
	const coming = enemies.some((e) => e.brain.target === p && e.brain.state === 'windup' && dist(e, p) < 340);
	const incoming = w.red.shots.some((s) => dist(s, p) < 110 && (s.vx * (p.x - s.x) + s.vy * (p.y - s.y)) > 0);
	const t = h.target && isStanding(h.target) ? h.target : null;
	const around = (x: number, y: number, r: number) => enemies.filter((e) => dist(e, { x, y }) <= r);

	if (h.id === 'flash') {
		if ((coming || incoming) && ready('dodge')) {
			const m = begin(h, 'dodge', null);
			const side = Math.random() < 0.5 ? -1 : 1;
			const threat = enemies.find((e) => e.brain.target === p) ?? t;
			const ax = threat ? p.x - threat.x : 1;
			const ay = threat ? p.y - threat.y : 0;
			const len = Math.hypot(ax, ay) || 1;
			m.fromX = p.x;
			m.fromY = p.y;
			m.x = p.x + (-ay / len) * side * DODGE.distance + (ax / len) * 40;
			m.y = p.y + (ax / len) * side * DODGE.distance + (ay / len) * 40;
			p.invuln = Math.max(p.invuln, DODGE.invuln);
			return;
		}
		if (!t) return;
		// A crowd: a tornado
		if (ready('tornado')) {
			const crowd = around(t.x, t.y, TORNADO.pull);
			if (crowd.length >= 3) {
				const cx = crowd.reduce((s, e) => s + e.x, 0) / crowd.length;
				const cy = crowd.reduce((s, e) => s + e.y, 0) / crowd.length;
				begin(h, 'tornado', t, cx, cy);
				w.effects.push({ kind: 'callout', x: p.x, y: p.y, age: 0, life: 1.3, text: 'TORNADO!', owner: p });
				return;
			}
		}
		if (ready('barrage') && around(p.x, p.y, BARRAGE.range).length >= 2) {
			const m = begin(h, 'barrage', t);
			// Nearest first, then the nearest to that, and so on
			let from: { x: number; y: number } = p;
			const left = foesOf(w).filter((d) => dist(d, p) <= BARRAGE.range);
			while (m.queue.length < BARRAGE.count && left.length > 0) {
				left.sort((a, b) => dist(a, from) - dist(b, from));
				const next = left.shift()!;
				m.queue.push(next);
				from = next;
			}
			m.fromX = p.x;
			m.fromY = p.y;
			w.effects.push({ kind: 'callout', x: p.x, y: p.y, age: 0, life: 1.1, text: 'SPEED BLITZ!', owner: p });
			return;
		}
		const d = dist(t, p);
		if (ready('lightning') && d >= LIGHTNING.minRange && d <= LIGHTNING.range && Math.random() < 0.5) {
			const m = begin(h, 'lightning', t);
			m.x = t.x;
			m.y = t.y;
			return;
		}
		if (ready('blitz') && d <= BLITZ.range) {
			const m = begin(h, 'blitz', t);
			m.step = 'in';
			p.invuln = Math.max(p.invuln, 0.1);
		}
		return;
	}

	// ---- Hawkgirl ----
	const big = enemies.some((e) => e.brain.target === p && e.brain.state === 'windup' && dist(e, p) < 320 && (e.brain.ability === 'slam' || e.brain.ability === 'charge' || e.brain.ability === 'roar' || e.brain.ability === 'cannon'));
	if (ready('guard') && (big || (coming && p.health < p.maxHealth * 0.45))) {
		h.cooldowns.guard = COOLDOWNS.guard;
		h.guard = GUARD.time;
		return;
	}
	if (!t) return;
	const d = dist(t, p);
	if (ready('thunder') && around(p.x, p.y, THUNDER.radius).length >= 2) {
		begin(h, 'thunder', t);
		return;
	}
	if (ready('dive') && d > 140 && d <= DIVE.range) {
		const m = begin(h, 'dive', t, t.x, t.y);
		m.step = 'rise';
		return;
	}
	if (ready('rush') && d > 120 && d < 300 && Math.random() < 0.35) {
		const m = begin(h, 'rush', t);
		const len = d || 1;
		m.fromX = p.x;
		m.fromY = p.y;
		m.x = p.x + ((t.x - p.x) / len) * RUSH.length;
		m.y = p.y + ((t.y - p.y) / len) * RUSH.length;
		return;
	}
	if (ready('mace') && d <= MACE.reach + 10) begin(h, 'mace', t);
}

/** Face the way we're going (or at the target). */
function face(p: Player, x: number) {
	if (Math.abs(x - p.x) > 2) p.dir = x > p.x ? 1 : -1;
}

function hit(w: ConstructWorld, p: Player, d: Dummy, damage: number, knockback: number, fromX: number, fromY: number) {
	if (d.kind === 'manhunterCore' && p.hero?.id === 'hawkgirl') damage *= NTH_VS_CORE;
	hitDummyWithFx(w, d, damage, knockback, fromX, fromY, p);
}

function run(p: Player, h: HeroState, m: Move, dt: number, w: ConstructWorld, solids: readonly Solid[]) {
	m.elapsed += dt;
	const fx = heroFx(w);
	const done = () => {
		h.move = null;
	};
	/** Run toward (x, y) at `speed`; true once there. */
	const runTo = (x: number, y: number, speed: number, stop = 0): boolean => {
		const dx = x - p.x;
		const dy = y - p.y;
		const d = Math.hypot(dx, dy);
		face(p, x);
		if (d <= stop + speed * dt) {
			p.prevX = p.x;
			p.prevY = p.y;
			const k = d > 0 ? Math.max(0, d - stop) / d : 0;
			p.x += dx * k;
			p.y += dy * k;
			p.vx = (dx / (d || 1)) * speed * 0.3;
			p.vy = (dy / (d || 1)) * speed * 0.3;
			return true;
		}
		p.prevX = p.x;
		p.prevY = p.y;
		p.vx = (dx / d) * speed;
		p.vy = (dy / d) * speed;
		moveBody(p, dt, p.flying ? solids.filter((s) => s.blocksFlying) : solids, FEET_HALF_W, FEET_HALF_H);
		// Walked into a wall: give up on getting there
		if (Math.hypot(p.vx, p.vy) < speed * 0.3) return true;
		return false;
	};

	switch (m.power) {
		case 'dodge': {
			const k = Math.min(1, m.elapsed / DODGE.time);
			if (m.count === 0) {
				fx.push({ kind: 'zip', x: m.fromX, y: m.fromY, x2: m.x, y2: m.y, age: 0, life: 0.25 });
				m.count = 1;
			}
			if (runTo(m.x, m.y, DODGE.distance / DODGE.time + 200) || k >= 1) done();
			return;
		}

		case 'blitz': {
			const t = m.target;
			if (!t || !isStanding(t)) {
				m.step = 'out';
			}
			if (m.step === 'in') {
				p.invuln = Math.max(p.invuln, 0.05);
				if (runTo(t!.x - (t!.x > p.x ? BLITZ_REACH : -BLITZ_REACH), t!.y, BLITZ_SPEED) || m.elapsed > 0.6) {
					m.step = 'hits';
					m.elapsed = 0;
				}
				return;
			}
			if (m.step === 'hits') {
				p.vx = p.vy = 0;
				if (t) face(p, t.x);
				if (m.elapsed >= m.count * BLITZ.gap) {
					m.count++;
					const last = m.count === BLITZ.punches;
					if (t && isStanding(t) && dist(t, p) < BLITZ_REACH + 40) {
						hit(w, p, t, BLITZ.damage, last ? BLITZ.lastKnockback : BLITZ.knockback, p.x, p.y);
						w.effects.push({ kind: 'impact', x: t.x, y: t.y, age: 0, life: 0.18, lift: 34 });
					}
					p.actionTimer = 0.12;
					p.shotTimer = 0.1;
					if (last) {
						m.step = 'out';
						m.elapsed = 0;
						// Out to one side or the other, never where he was hit from
						const ang = Math.random() * Math.PI * 2;
						m.x = p.x + Math.cos(ang) * 190;
						m.y = p.y + Math.sin(ang) * 130;
					}
				}
				return;
			}
			// out
			p.invuln = Math.max(p.invuln, 0.05);
			if (runTo(m.x, m.y, BLITZ_SPEED * 0.9) || m.elapsed > 0.4) done();
			return;
		}

		case 'barrage': {
			p.invuln = Math.max(p.invuln, 0.05);
			const t = m.queue[0];
			if (!t) {
				done();
				return;
			}
			if (!isStanding(t)) {
				m.queue.shift();
				return;
			}
			if (runTo(t.x - (t.x > p.x ? 26 : -26), t.y, 1700) || m.elapsed > BARRAGE.zip * 3) {
				fx.push({ kind: 'zip', x: m.fromX, y: m.fromY, x2: p.x, y2: p.y, age: 0, life: 0.3 });
				hit(w, p, t, BARRAGE.damage, BARRAGE.knockback, p.x, p.y);
				w.effects.push({ kind: 'impact', x: t.x, y: t.y, age: 0, life: 0.2, lift: 34 });
				p.actionTimer = 0.15;
				m.fromX = p.x;
				m.fromY = p.y;
				m.elapsed = 0;
				m.queue.shift();
			}
			return;
		}

		case 'tornado': {
			p.invuln = Math.max(p.invuln, 0.05);
			// Round and round the middle, faster than the eye can follow
			const ang = m.elapsed * 10;
			p.prevX = p.x;
			p.prevY = p.y;
			p.x = m.x + Math.cos(ang) * TORNADO.circle;
			p.y = m.y + Math.sin(ang) * TORNADO.circle * 0.55;
			p.vx = -Math.sin(ang) * 1200;
			p.vy = Math.cos(ang) * 660;
			p.dir = p.vx > 0 ? 1 : -1;
			if (m.count === 0) {
				fx.push({ kind: 'tornado', x: m.x, y: m.y, age: 0, life: TORNADO.time + 0.3, radius: TORNADO.hold });
				m.count = 1;
			}
			const tick = m.elapsed % 0.25 < dt;
			for (const e of enemiesOf(w)) {
				const d = dist(e, m);
				if (d > TORNADO.pull) continue;
				// Dragged in, harder the closer they are
				if (d > 12) {
					e.vx += ((m.x - e.x) / d) * TORNADO.pullForce * dt;
					e.vy += ((m.y - e.y) / d) * TORNADO.pullForce * dt;
				}
				if (d <= TORNADO.hold) {
					e.stun = Math.max(e.stun, 0.3);
					if (tick) hitDummyWithFx(w, e, TORNADO.dps / 4, 0, m.x, m.y, p, 0);
				}
			}
			// Anything thrown at it is torn apart
			w.red.shots = w.red.shots.filter((s) => {
				if (dist(s, m) > TORNADO.hold || s.kind === 'hook') return true;
				w.effects.push({ kind: 'fizzle', x: s.x, y: s.y - 30, age: 0, life: 0.3 });
				return false;
			});
			if (m.elapsed >= TORNADO.time) {
				// ...and then it lets go, throwing them all out
				for (const e of enemiesOf(w)) if (dist(e, m) <= TORNADO.hold + 30) hit(w, p, e, TORNADO.flingDamage, TORNADO.fling, m.x, m.y);
				p.x += Math.cos(ang) * 60;
				done();
			}
			return;
		}

		case 'lightning': {
			const t = m.target;
			p.shotTimer = 0.22;
			if (t) face(p, t.x);
			if (m.elapsed < 0.14) return;
			if (t && isStanding(t)) {
				hit(w, p, t, LIGHTNING.damage, LIGHTNING.knockback, p.x, p.y);
				t.stun = Math.max(t.stun, LIGHTNING.stun);
				fx.push({ kind: 'bolt', x: p.x + p.dir * 10, y: p.y, x2: t.x, y2: t.y, age: 0, life: 0.3, lift: 36 });
			}
			done();
			return;
		}

		case 'mace': {
			const t = m.target;
			if (t) face(p, t.x);
			p.actionTimer = 0.3;
			if (m.elapsed < MACE.windup) return;
			const ang = t ? Math.atan2(t.y - p.y, t.x - p.x) : p.dir > 0 ? 0 : Math.PI;
			for (const e of foesOf(w)) {
				const dx = e.x - p.x;
				const dy = e.y - p.y;
				const d = Math.hypot(dx, dy);
				if (d > MACE.reach + 14) continue;
				if (d > 20 && (dx * Math.cos(ang) + dy * Math.sin(ang)) / d < 0.1) continue;
				// Nth metal: an energy shield is no help against it
				if (e.ward) {
					e.ward = undefined;
					w.effects.push({ kind: 'pop', x: e.x, y: e.y, age: 0, life: 0.4 });
				}
				hit(w, p, e, MACE.damage, MACE.knockback, p.x, p.y);
			}
			fx.push({ kind: 'mace', x: p.x, y: p.y, age: 0, life: 0.3, angle: ang, radius: MACE.reach, lift: p.bodyBottom + 36 });
			done();
			return;
		}

		case 'dive': {
			const t = m.target;
			if (m.step === 'rise') {
				// Up out of reach, drifting over them
				h.rise = Math.min(DIVE.rise, h.rise + (DIVE.rise / DIVE.riseTime) * dt);
				if (t && isStanding(t)) {
					m.x = t.x;
					m.y = t.y;
				}
				runTo(p.x + (m.x - p.x) * 0.5, p.y + (m.y - p.y) * 0.5, 220);
				if (m.elapsed >= DIVE.riseTime) {
					m.step = 'fall';
					m.elapsed = 0;
				}
				return;
			}
			// Straight down on them
			p.invuln = Math.max(p.invuln, 0.05);
			h.rise = Math.max(0, DIVE.rise * (1 - m.elapsed / DIVE.fallTime));
			const there = runTo(m.x, m.y, dist(p, m) / Math.max(dt, DIVE.fallTime - m.elapsed + dt));
			if (there || m.elapsed >= DIVE.fallTime) {
				h.rise = 0;
				for (const e of foesOf(w)) {
					if (dist(e, m) > DIVE.radius) continue;
					hit(w, p, e, DIVE.damage, DIVE.knockback, m.x, m.y);
					e.stun = Math.max(e.stun, DIVE.stun);
				}
				fx.push({ kind: 'quake', x: m.x, y: m.y, age: 0, life: 0.55, radius: DIVE.radius });
				p.actionTimer = 0.35;
				done();
			}
			return;
		}

		case 'rush': {
			p.invuln = Math.max(p.invuln, 0.05);
			const speed = RUSH.length / RUSH.time;
			const there = runTo(m.x, m.y, speed);
			for (const e of foesOf(w)) {
				if (m.hit.includes(e) || dist(e, p) > RUSH.width) continue;
				m.hit.push(e);
				hit(w, p, e, RUSH.damage, RUSH.knockback, p.x - p.vx * 0.05, p.y - p.vy * 0.05);
			}
			if (there || m.elapsed >= RUSH.time + 0.1) done();
			return;
		}

		case 'thunder': {
			p.actionTimer = 0.4;
			if (m.elapsed < 0.28) return;
			for (const e of foesOf(w)) {
				if (dist(e, p) > THUNDER.radius) continue;
				hit(w, p, e, THUNDER.damage, THUNDER.knockback, p.x, p.y);
				e.stun = Math.max(e.stun, THUNDER.stun);
			}
			fx.push({ kind: 'thunder', x: p.x, y: p.y, age: 0, life: 0.6, radius: THUNDER.radius });
			done();
			return;
		}

		default:
			done();
	}
}

// ------------------------------------------------------------------ the brain

/** Health (0..1) where a hero backs out of the fight, and where they go back in. */
const RETREAT_BELOW = 0.3;
const RETURN_ABOVE = 0.65;
/** How far they'll roam from the Lantern they're fighting beside. */
const LEASH = 950;
/** They'll drop what they're doing to stop a hit on the Lantern from this close. */
const HELP_RANGE = 450;

export interface HeroWorld {
	readonly players: readonly Player[];
	readonly dummies: readonly Dummy[];
	readonly constructs: ConstructWorld;
}

/**
 * Drives a hero like an AI partner: who to fight and where to stand. The
 * powers themselves are picked in updateHero.
 *  - the Flash circles his target at a run, never standing still,
 *  - Hawkgirl gets in close with the mace,
 *  - each picks their own fight: enemies nobody else is on, roaming well away
 *    from the Lantern, and only comes back to stop something about to hit
 *    him; both back out when badly hurt.
 */
export class HeroInput implements InputSource {
	me: Player | null = null;
	private orbit = Math.random() * Math.PI * 2;
	private orbitDir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
	private flipIn = 2;
	private retreating = false;

	constructor(private world: HeroWorld) {}

	read(): Intent {
		const me = this.me;
		const h = me?.hero;
		if (!me || !h || me.downed) return IDLE;
		const dt = 1 / 60;
		const lead = this.world.players.find((p) => !p.hero && !p.downed) ?? null;
		const enemies = this.world.dummies.filter((d): d is Enemy => isEnemy(d) && isStanding(d));
		// A broken Manhunter's core comes first: it has to be smashed before it rebuilds
		const core = this.world.dummies.find((d) => d.kind === 'manhunterCore' && isStanding(d));
		// The Flash drops everything for Reverse-Flash
		const rival = h.id === 'flash' ? enemies.find((e) => e.kind === 'reverseFlash') : undefined;
		h.target = core ?? rival ?? this.pickTarget(me, lead, enemies);
		const t = h.target;
		const intent: Intent = { ...IDLE };
		if (h.id === 'hawkgirl' && !me.flying) intent.toggleFly = true;

		if (!this.retreating && me.health < me.maxHealth * RETREAT_BELOW) this.retreating = true;
		else if (this.retreating && me.health > me.maxHealth * RETURN_ABOVE) this.retreating = false;

		let gx = me.x;
		let gy = me.y;
		if (this.retreating && enemies.length > 0) {
			// Out of the fight, toward the Lantern, until recovered
			const cx = enemies.reduce((s, e) => s + e.x, 0) / enemies.length;
			const cy = enemies.reduce((s, e) => s + e.y, 0) / enemies.length;
			const d = Math.hypot(me.x - cx, me.y - cy) || 1;
			gx = me.x + ((me.x - cx) / d) * 300;
			gy = me.y + ((me.y - cy) / d) * 300;
		} else if (t) {
			this.flipIn -= dt;
			if (this.flipIn <= 0) {
				this.orbitDir = this.orbitDir === 1 ? -1 : 1;
				this.flipIn = 1.5 + Math.random() * 2.5;
			}
			if (h.id === 'flash') {
				// Always running: round and round whoever he's after (flat out against another speedster)
				const duel = t.kind === 'reverseFlash';
				this.orbit += this.orbitDir * (duel ? 3.2 : 1.4) * dt;
				gx = t.x + Math.cos(this.orbit) * (duel ? 200 : 180);
				gy = t.y + Math.sin(this.orbit) * (duel ? 150 : 120);
			} else {
				const ang = Math.atan2(me.y - t.y, me.x - t.x) + this.orbitDir * 0.3;
				gx = t.x + Math.cos(ang) * 60;
				gy = t.y + Math.sin(ang) * 60;
			}
		} else if (lead) {
			const side = me.x < lead.x ? -1 : 1;
			gx = lead.x + side * 150;
			gy = lead.y + (h.id === 'flash' ? 60 : -40);
		}
		if (lead) {
			const d = dist({ x: gx, y: gy }, lead);
			if (d > LEASH) {
				gx = lead.x + ((gx - lead.x) * LEASH) / d;
				gy = lead.y + ((gy - lead.y) * LEASH) / d;
			}
		}
		// Out of slam circles
		for (const fx of this.world.constructs.effects) {
			if (fx.kind === 'slamMark' && dist(me, fx) < (fx.radius ?? 70) + 24) {
				const d = dist(me, fx) || 1;
				gx = me.x + ((me.x - fx.x) / d) * 180;
				gy = me.y + ((me.y - fx.y) / d) * 180;
			}
		}

		const dx = gx - me.x;
		const dy = gy - me.y;
		const d = Math.hypot(dx, dy);
		if (d > 12) {
			const k = Math.min(1, d / 60) / d;
			intent.moveX = dx * k;
			intent.moveY = dy * k;
		}
		return intent;
	}

	/**
	 * Their own fight, not the Lantern's: whoever's about to hit the Lantern
	 * (if I'm close enough to stop it and nobody else is), then whoever's on
	 * me, then who I'm already fighting, then the nearest enemy nobody else is
	 * fighting, and only then anyone.
	 */
	private pickTarget(me: Player, lead: Player | null, enemies: Enemy[]): Enemy | null {
		const near = (e: Enemy, r: number) => dist(e, me) < r;
		const others = this.world.players.filter((p) => p !== me);
		const taken = (e: Enemy) =>
			others.some((p) => (p.hero ? p.hero.target === e : p.attackTarget?.kind === 'enemy' && p.attackTarget.dummy === e));
		const held = me.hero?.target;
		const current = held && isEnemy(held) && isStanding(held) && near(held, 800) ? held : null;
		const winding = enemies.filter(
			(e) => lead && e.brain.target === lead && e.brain.state === 'windup' && dist(e, lead) < HELP_RANGE && near(e, 700) && !taken(e)
		);
		const onMe = enemies.filter((e) => e.brain.target === me && near(e, 450));
		const free = enemies.filter((e) => !taken(e) && (!lead || dist(e, lead) < LEASH + 150));
		const pool = [winding, onMe, current ? [current] : [], free, enemies].find((l) => l.length > 0) ?? [];
		let best: Enemy | null = null;
		for (const e of pool) if (!best || dist(e, me) < dist(best, me)) best = e;
		return best;
	}
}
