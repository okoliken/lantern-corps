// The Justice League, sparring with John on the Watchtower. They fight
// through the same brain as everyone else (windup, act, recover), but the
// moves are theirs, and none of them is trying to put him down for good.
//
//   The Flash      Speed Rush: in at a blur, four punches, out the far side.
//                  Lightning: thrown from wherever he stopped
//   Superman       Haymaker: a straight punch across the deck, with the wind-up
//                  of a man who knows what it does. Heat Vision: a line across
//                  the deck that ticks while it is on you. Freeze Breath: a cone
//                  that stops you moving more than it hurts
//   Wonder Woman   Sword Rush: closes and cuts three times. Golden Lasso: it
//                  takes you to her, and there is no arguing with it
//   Hawkgirl       Mace Dive: climbs, and comes down on the spot you were on.
//                  Mace Swing: up close

import type { damagePlayer as DamagePlayer } from '../combat';
import type { ConstructWorld } from '../constructs/system';
import type { heroFx as HeroFx } from '../heroes';
import type { Player } from '../player';
import type { steer as Steer, Enemy } from './enemies';
import type { power as Power, AbilityDef, AbilityId } from './redConstructs';

/**
 * What the moves need from the rest of the engine, handed in by the
 * dispatcher (redConstructs.ts) rather than imported here. This file sits
 * inside an import cycle (heroes -> enemies -> redConstructs -> here), and a
 * runtime import back into it changes the order the modules evaluate in,
 * which broke enemies that have nothing to do with the League.
 */
export interface LeagueCtx {
	damagePlayer: typeof DamagePlayer;
	heroFx: typeof HeroFx;
	steer: typeof Steer;
	power: typeof Power;
}

/**
 * A bubble shield is a Green Lantern's answer to most things. It is not the
 * answer to Superman's fist or an Amazon's sword: those take a bite out of
 * the bubble and land anyway, at a share of what they would have done.
 */
const THROUGH_BUBBLE = 0.6;
/**
 * The Flash is fast, not strong. His punches take a bite out of a bubble
 * (a big one - there are a lot of them) and none of it gets through until
 * the bubble is gone.
 */
const FLASH_BITE = 1.4;
function shred(w: ConstructWorld, t: Player, bite: number) {
	const sh = w.shields.find((s) => s.target === t);
	if (!sh) return false;
	sh.hp -= bite;
	sh.ripple = 0.25;
	if (sh.hp <= 0) {
		w.shields.splice(w.shields.indexOf(sh), 1);
		w.effects.push({ kind: 'pop', x: t.x, y: t.y, age: 0, life: 0.45, owner: t });
	}
	return true;
}

export const LEAGUE_ABILITIES: ReadonlySet<AbilityId> = new Set<AbilityId>([
	'flashRush',
	'flashBolt',
	'haymaker',
	'flyPunch',
	'heatVision',
	'frostBreath',
	'swordRush',
	'lasso',
	'maceDive',
	'maceSwing',
	'wingGuard',
	'talonThrow',
	'batarang',
	'smokeBomb',
	'grapple',
	'fearToxin',
	'ringSteal'
]);

/** How high moves at hand height are drawn, and where Superman's eyes are on a hovering figure. */
const HAND_LIFT = 40;
const EYE_LIFT = 92;
const RUSH = { speed: 1250, reach: 44, punches: 4, gap: 0.07 };
const HAYMAKER = { speed: 1050, reach: 40 };
const FLY_PUNCH = { speed: 1400, reach: 52 };
const HEAT = { tick: 0.15, width: 30 };
/** Freezing breath: the cone, and how long the cold stays on you after it. */
const FROST = { arc: 0.55, chill: 1.7 };
const SWORD = { speed: 900, reach: 60, cuts: [0.14, 0.32, 0.5] };
/** The lasso: the rope flies out first, then the pull. */
const LASSO = { flight: 0.15, pullTime: 0.7 };
const DIVE = { riseTime: 0.3, rise: 160 };
/** Talon Throw: carried up, held, and put down hard. */
const TALON = { carry: 0.55, hold: 0.3, lift: 0.9 };
/** Batman: three batarangs, how long each takes to arrive; the grapnel; the toxin; how long the ring is gone. */
const BATARANG = { count: 3, gap: 0.12, flight: 0.32 };
const GRAPNEL = { flight: 0.14, pull: 0.45, stop: 60 };
const TOXIN = { time: 2.8 };
const STEAL = { time: 5 };
/** Wing Guard: what the wings take before they give, and for how long. */
const WING = { hp: 70, life: 2.4 };
/** The Flash reads a shot coming and is somewhere else: how far, how soon, how often. */
const DODGE = { lookahead: 0.32, miss: 64, hop: 150, every: 0.8 };

/** When a combo made contact (seconds into the move), and how many ticks a beam has done. */
const contact = new WeakMap<Enemy, number>();
/** Batarangs in the air: where each lands, and when. */
const thrown = new WeakMap<Enemy, { x: number; y: number; at: number }[]>();
const ticks = new WeakMap<Enemy, number>();

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

export function startLeagueAbility(e: Enemy, a: AbilityDef, w: ConstructWorld, players: readonly Player[], ctx: LeagueCtx) {
	const { damagePlayer, heroFx, power } = ctx;
	const b = e.brain;
	const t = b.target;
	void players;
	switch (a.id) {
		case 'flashBolt': {
			if (!t || t.downed || dist(t, e) > a.maxRange + 100) return;
			damagePlayer(w, t, power(e, a), e.x, e.y, a.knockback);
			heroFx(w).push({ kind: 'bolt', x: e.x + e.dir * 10, y: e.y, x2: t.x, y2: t.y, age: 0, life: 0.3, lift: 36 });
			break;
		}
		case 'wingGuard': {
			const hp = WING.hp * b.might;
			e.ward = { hp, maxHp: hp, life: WING.life };
			w.effects.push({ kind: 'callout', x: e.x, y: e.y - 150, age: 0, life: 1, text: 'WING GUARD' });
			break;
		}
		case 'talonThrow': {
			if (!t || t.downed || dist(t, e) > a.maxRange + 80) {
				b.timer = 0;
				return;
			}
			b.struck = [t];
			// A bubble does not stop a grab; it goes
			const sh = w.shields.find((s) => s.target === t);
			if (sh) {
				w.shields.splice(w.shields.indexOf(sh), 1);
				w.effects.push({ kind: 'pop', x: t.x, y: t.y, age: 0, life: 0.45, owner: t });
			}
			heroFx(w).push({ kind: 'zip', x: e.x, y: e.y, x2: t.x, y2: t.y, age: 0, life: 0.25 });
			w.effects.push({ kind: 'callout', x: t.x, y: t.y - 100, age: 0, life: 1.2, text: 'TALONS', hurt: true, owner: t });
			break;
		}
		case 'batarang':
			// Thrown one at a time from the update; nothing to do yet
			break;
		case 'smokeBomb': {
			// Gone in the smoke, and behind them before it clears
			for (let i = 0; i < 3; i++) w.effects.push({ kind: 'burst', x: e.x + (i - 1) * 22, y: e.y - 20 - (i % 2) * 18, age: 0, life: 0.9 });
			heroFx(w).push({ kind: 'smoke', x: e.x, y: e.y, age: 0, life: 1.1, radius: 90, lift: 30 });
			if (t && !t.downed) {
				const away = Math.atan2(t.y - e.y, t.x - e.x);
				e.x = t.x + Math.cos(away) * 110;
				e.y = t.y + Math.sin(away) * 40;
				e.prevX = e.x;
				e.prevY = e.y;
				e.dir = t.x > e.x ? 1 : -1;
				heroFx(w).push({ kind: 'smoke', x: e.x, y: e.y, age: 0, life: 0.8, radius: 60, lift: 30 });
			}
			break;
		}
		case 'grapple': {
			if (!t || t.downed) return;
			heroFx(w).push({ kind: 'grapnel', x: e.x, y: e.y, x2: t.x, y2: t.y, age: 0, life: GRAPNEL.flight + GRAPNEL.pull + 0.1, lift: HAND_LIFT, track: [e, t] });
			break;
		}
		case 'fearToxin': {
			// A capsule where they are standing: whoever breathes it panics
			const cx = t ? t.x : e.x;
			const cy = t ? t.y : e.y;
			heroFx(w).push({ kind: 'toxin', x: cx, y: cy, age: 0, life: 1.6, radius: a.radius ?? 130, lift: 20 });
			for (const p of players) {
				if (p.downed || dist(p, { x: cx, y: cy }) > (a.radius ?? 130)) continue;
				p.confused = Math.max(p.confused, TOXIN.time);
				damagePlayer(w, p, power(e, a), cx, cy, 0);
				w.effects.push({ kind: 'callout', x: p.x, y: p.y - 100, age: 0, life: 1.4, text: 'FEAR TOXIN', hurt: true, owner: p });
			}
			break;
		}
		case 'ringSteal': {
			if (!t || t.downed || dist(t, e) > a.maxRange + 20) return;
			// A bubble is the one thing that stops it, and it costs you the bubble
			const sh = w.shields.find((s) => s.target === t);
			if (sh) {
				w.shields.splice(w.shields.indexOf(sh), 1);
				w.effects.push({ kind: 'pop', x: t.x, y: t.y, age: 0, life: 0.45, owner: t });
				break;
			}
			t.invuln = 0;
			damagePlayer(w, t, power(e, a), e.x, e.y, a.knockback, true);
			t.branded = Math.max(t.branded, STEAL.time);
			t.firing = false;
			t.charge = 0;
			w.effects.push({ kind: 'callout', x: t.x, y: t.y - 110, age: 0, life: 2, text: 'RING TAKEN', hurt: true, owner: t });
			w.effects.push({ kind: 'fizzle', x: t.x, y: t.y - 40, age: 0, life: 0.6 });
			break;
		}
		case 'flashRush':
		case 'swordRush':
		case 'haymaker':
		case 'flyPunch':
			b.struck = [];
			if (t) heroFx(w).push({ kind: 'zip', x: e.x, y: e.y, x2: t.x, y2: t.y, age: 0, life: 0.25 });
			break;
		case 'heatVision':
			ticks.set(e, 0);
			break;
		case 'frostBreath': {
			const ang = Math.atan2(b.aimY, b.aimX);
			heroFx(w).push({ kind: 'frost', x: e.x, y: e.y, age: 0, life: a.active + 0.2, angle: ang, radius: a.radius ?? 260, lift: 44 });
			break;
		}
		case 'lasso': {
			if (!t || t.downed) return;
			heroFx(w).push({ kind: 'lasso', x: e.x, y: e.y, x2: t.x, y2: t.y, age: 0, life: LASSO.flight + LASSO.pullTime + 0.2, lift: HAND_LIFT, gold: true, track: [e, t] });
			damagePlayer(w, t, power(e, a), e.x, e.y, 0);
			break;
		}
		case 'maceDive':
			// She marks where you are standing NOW, and climbs
			b.markX = t ? t.x : e.x;
			b.markY = t ? t.y : e.y;
			w.effects.push({ kind: 'slamMark', x: b.markX, y: b.markY, age: 0, life: a.active, radius: a.radius ?? 110 });
			break;
		case 'maceSwing': {
			const ang = Math.atan2(b.aimY, b.aimX);
			heroFx(w).push({ kind: 'mace', x: e.x, y: e.y, age: 0, life: 0.3, angle: ang, radius: a.radius ?? 90, lift: HAND_LIFT });
			for (const p of players) {
				if (p.downed || dist(p, e) > (a.radius ?? 90) + 10) continue;
				damagePlayer(w, p, power(e, a), e.x, e.y, a.knockback);
				w.effects.push({ kind: 'impact', x: p.x, y: p.y, age: 0, life: 0.2, lift: 34 });
			}
			break;
		}
	}
}

export function updateLeagueAbility(e: Enemy, a: AbilityDef, w: ConstructWorld, players: readonly Player[], dt: number, ctx: LeagueCtx) {
	const { damagePlayer, heroFx, steer, power } = ctx;
	const b = e.brain;
	const t = b.target;
	switch (a.id) {
		case 'flashRush':
			rushAndPunch(e, a, w, dt, RUSH.speed, RUSH.reach, RUSH.punches, RUSH.gap, true, ctx);
			return;
		case 'swordRush': {
			if (!t || t.downed) {
				steer(e, 0, 0, 8, dt);
				return;
			}
			const d = dist(t, e);
			// Close, then three cuts, then a step back
			if (d > SWORD.reach && b.fired === 0) {
				e.vx = ((t.x - e.x) / d) * SWORD.speed;
				e.vy = ((t.y - e.y) / d) * SWORD.speed;
				e.dir = t.x > e.x ? 1 : -1;
				return;
			}
			if (b.fired === 0) contact.set(e, b.elapsed);
			steer(e, (t.x - e.x) * 4, (t.y - e.y) * 4, 8, dt);
			e.dir = t.x > e.x ? 1 : -1;
			const since = b.elapsed - (contact.get(e) ?? b.elapsed);
			if (b.fired < SWORD.cuts.length && since >= SWORD.cuts[b.fired]) {
				b.fired++;
				const ang = Math.atan2(t.y - e.y, t.x - e.x);
				heroFx(w).push({ kind: 'cut', x: e.x, y: e.y, age: 0, life: 0.22, angle: ang + (b.fired % 2 ? 0.4 : -0.4), radius: SWORD.reach + 10, lift: HAND_LIFT, gold: true });
				for (const p of players) {
					if (p.downed || dist(p, e) > SWORD.reach + 24) continue;
					p.invuln = 0;
					const dmg = power(e, a);
					const bubbled = shred(w, p, dmg);
					damagePlayer(w, p, bubbled ? dmg * THROUGH_BUBBLE : dmg, e.x, e.y, b.fired === SWORD.cuts.length ? a.knockback : 60, true);
					w.effects.push({ kind: 'impact', x: p.x, y: p.y, age: 0, life: 0.15, lift: 34 });
				}
			}
			if (b.fired >= SWORD.cuts.length && !b.hitDone) {
				b.hitDone = true;
				const away = Math.atan2(e.y - t.y, e.x - t.x);
				e.vx = Math.cos(away) * 420;
				e.vy = Math.sin(away) * 300;
			}
			return;
		}
		case 'haymaker': {
			if (!t || t.downed) {
				steer(e, 0, 0, 8, dt);
				return;
			}
			if (b.hitDone) {
				steer(e, 0, 0, 6, dt);
				return;
			}
			const d = dist(t, e);
			if (d > HAYMAKER.reach) {
				e.vx = ((t.x - e.x) / d) * HAYMAKER.speed;
				e.vy = ((t.y - e.y) / d) * HAYMAKER.speed;
				e.dir = t.x > e.x ? 1 : -1;
				return;
			}
			b.hitDone = true;
			t.invuln = 0;
			const dmg = power(e, a);
			const bubbled = shred(w, t, dmg * 1.5);
			damagePlayer(w, t, bubbled ? dmg * THROUGH_BUBBLE : dmg, e.x, e.y, a.knockback, true);
			w.effects.push({ kind: 'impact', x: t.x, y: t.y, age: 0, life: 0.25, lift: 50 });
			heroFx(w).push({ kind: 'boom', x: t.x, y: t.y, age: 0, life: 0.5, radius: 90 });
			e.vx *= 0.1;
			e.vy *= 0.1;
			return;
		}
		case 'flyPunch': {
			// Straight through at flying speed; whoever is on the line gets the fist
			if (!t || t.downed) {
				steer(e, 0, 0, 8, dt);
				return;
			}
			if (b.fired === 0) {
				const d = dist(t, e) || 1;
				b.aimX = (t.x - e.x) / d;
				b.aimY = (t.y - e.y) / d;
				b.fired = 1;
			}
			e.vx = b.aimX * FLY_PUNCH.speed;
			e.vy = b.aimY * FLY_PUNCH.speed;
			e.dir = b.aimX > 0 ? 1 : -1;
			for (const p of players) {
				if (p.downed || b.struck.includes(p) || dist(p, e) > FLY_PUNCH.reach) continue;
				b.struck.push(p);
				p.invuln = 0;
				const dmg = power(e, a);
				const bubbled = shred(w, p, dmg * 1.5);
				damagePlayer(w, p, bubbled ? dmg * THROUGH_BUBBLE : dmg, e.x - b.aimX * 30, e.y - b.aimY * 30, a.knockback, true);
				w.effects.push({ kind: 'impact', x: p.x, y: p.y, age: 0, life: 0.25, lift: 50 });
				heroFx(w).push({ kind: 'boom', x: p.x, y: p.y, age: 0, life: 0.5, radius: 100 });
			}
			return;
		}
		case 'wingGuard':
			steer(e, 0, 0, 8, dt);
			return;
		case 'talonThrow': {
			const held = b.struck[0];
			if (!held || b.hitDone) {
				steer(e, 0, 0, 8, dt);
				return;
			}
			if (held.downed) {
				b.hitDone = true;
				return;
			}
			// In fast, then up with them
			const d = dist(held, e);
			if (b.elapsed < 0.25 && d > 40) {
				e.vx = ((held.x - e.x) / d) * 1100;
				e.vy = ((held.y - e.y) / d) * 1100;
				e.dir = held.x > e.x ? 1 : -1;
				return;
			}
			steer(e, 0, 0, 10, dt);
			if (held.hero) held.hero.move = null;
			held.branded = Math.max(held.branded, 0.1);
			const up = Math.min(1, Math.max(0, (b.elapsed - 0.25) / TALON.carry));
			b.air = up;
			held.altitude = Math.max(held.altitude, TALON.lift * up);
			if (b.elapsed < 0.25 + TALON.carry + TALON.hold) {
				const k = Math.min(1, dt * 10);
				held.prevX = held.x;
				held.prevY = held.y;
				held.x += (e.x + e.dir * 20 - held.x) * k;
				held.y += (e.y + 8 - held.y) * k;
				held.vx = held.vy = 0;
				return;
			}
			// ...and into the deck
			b.hitDone = true;
			b.air = 0;
			held.altitude = 0;
			held.invuln = 0;
			damagePlayer(w, held, power(e, a), e.x, e.y - 40, 0, true);
			held.vx = e.dir * 260;
			held.vy = 520;
			heroFx(w).push({ kind: 'quake', x: held.x, y: held.y + 30, age: 0, life: 0.55, radius: 120 });
			w.effects.push({ kind: 'impact', x: held.x, y: held.y, age: 0, life: 0.3, lift: 20 });
			return;
		}
		case 'heatVision': {
			steer(e, 0, 0, 8, dt);
			if (!t || t.downed) return;
			e.dir = t.x > e.x ? 1 : -1;
			const n = ticks.get(e) ?? 0;
			if (b.elapsed >= n * HEAT.tick) {
				ticks.set(e, n + 1);
				// A line from his eyes to where he is looking; it burns whoever is on it
				const dx = t.x - e.x;
				const dy = t.y - e.y;
				const d = Math.hypot(dx, dy) || 1;
				const ex = e.x + (dx / d) * (a.maxRange + 60);
				const ey = e.y + (dy / d) * (a.maxRange + 60);
				heroFx(w).push({ kind: 'heat', x: e.x + e.dir * 6, y: e.y, x2: ex, y2: ey, age: 0, life: HEAT.tick + 0.05, lift: EYE_LIFT });
				for (const p of players) {
					if (p.downed) continue;
					// Distance from the player's body to the line
					const px = p.x - e.x;
					const py = p.y - e.y;
					const along = (px * dx + py * dy) / (d * d);
					if (along < 0 || along > 1.2) continue;
					const off = Math.abs(px * dy - py * dx) / d;
					if (off <= HEAT.width) {
						p.invuln = 0;
						damagePlayer(w, p, power(e, a) * HEAT.tick, e.x, e.y, a.knockback);
					}
				}
			}
			return;
		}
		case 'frostBreath': {
			steer(e, 0, 0, 8, dt);
			const ang = Math.atan2(b.aimY, b.aimX);
			for (const p of players) {
				if (p.downed) continue;
				const d = dist(p, e);
				if (d > (a.radius ?? 260)) continue;
				const to = Math.atan2(p.y - e.y, p.x - e.x);
				const diff = Math.atan2(Math.sin(to - ang), Math.cos(to - ang));
				if (Math.abs(diff) > FROST.arc) continue;
				// Frozen: they move at a crawl for a while after, and a little cold
				if (p.chilled <= 0) w.effects.push({ kind: 'callout', x: p.x, y: p.y - 100, age: 0, life: 1.2, text: 'FROZEN', hurt: true, owner: p });
				p.chilled = Math.max(p.chilled, FROST.chill);
				p.vx *= 0.3;
				p.vy *= 0.3;
				if (!b.hitDone) damagePlayer(w, p, power(e, a), e.x, e.y, a.knockback);
			}
			b.hitDone = true;
			return;
		}
		case 'lasso': {
			steer(e, 0, 0, 8, dt);
			if (!t || t.downed) return;
			// The rope flies out, then they are reeled in, then held a moment
			if (b.elapsed > LASSO.flight && b.elapsed <= LASSO.flight + LASSO.pullTime) {
				const k = Math.min(1, dt * 7);
				const stop = 70;
				const d = dist(t, e);
				if (d > stop) {
					t.x += ((e.x - t.x) / d) * (d - stop) * k;
					t.y += ((e.y - t.y) / d) * (d - stop) * k;
					t.vx *= 0.3;
					t.vy *= 0.3;
				}
			}
			e.dir = t.x > e.x ? 1 : -1;
			return;
		}
		case 'maceDive': {
			// Up, over the mark, and down on it
			const upFor = DIVE.riseTime;
			if (b.elapsed < upFor) {
				b.air = Math.min(1, b.elapsed / upFor);
				const d = Math.hypot(b.markX - e.x, b.markY - e.y) || 1;
				steer(e, ((b.markX - e.x) / d) * Math.min(d * 4, 700), ((b.markY - e.y) / d) * Math.min(d * 4, 700), 10, dt);
				return;
			}
			b.air = Math.max(0, 1 - (b.elapsed - upFor) / 0.2);
			steer(e, 0, 0, 10, dt);
			if (b.hitDone || b.air > 0) return;
			b.hitDone = true;
			e.x = b.markX;
			e.y = b.markY;
			e.prevX = e.x;
			e.prevY = e.y;
			heroFx(w).push({ kind: 'quake', x: e.x, y: e.y, age: 0, life: 0.55, radius: a.radius ?? 110 });
			for (const p of players) {
				if (p.downed || dist(p, e) > (a.radius ?? 110) + 10) continue;
				const dmg = power(e, a);
				const bubbled = shred(w, p, dmg * 1.5);
				damagePlayer(w, p, bubbled ? dmg * THROUGH_BUBBLE : dmg, e.x, e.y, a.knockback, true);
				w.effects.push({ kind: 'impact', x: p.x, y: p.y, age: 0, life: 0.25, lift: 40 });
			}
			return;
		}
		case 'batarang': {
			steer(e, 0, 0, 8, dt);
			if (!t || t.downed) return;
			e.dir = t.x > e.x ? 1 : -1;
			// Throw them one at a time; each lands where they will be when it gets there
			if (b.fired < BATARANG.count && b.elapsed >= b.fired * BATARANG.gap) {
				b.fired++;
				const ax = t.x + t.vx * BATARANG.flight;
				const ay = t.y + t.vy * BATARANG.flight;
				heroFx(w).push({ kind: 'batarang', x: e.x + e.dir * 10, y: e.y, x2: ax, y2: ay, age: 0, life: BATARANG.flight, lift: HAND_LIFT });
				thrown.set(e, [...(thrown.get(e) ?? []), { x: ax, y: ay, at: b.elapsed + BATARANG.flight }]);
			}
			const list = thrown.get(e) ?? [];
			for (const bt of [...list]) {
				if (b.elapsed < bt.at) continue;
				list.splice(list.indexOf(bt), 1);
				for (const p of players) {
					if (p.downed || Math.abs(p.x - bt.x) > 34 || Math.abs(p.y - bt.y) > 50) continue;
					p.invuln = 0;
					damagePlayer(w, p, power(e, a), bt.x, bt.y, a.knockback);
					w.effects.push({ kind: 'impact', x: p.x, y: p.y, age: 0, life: 0.15, lift: 40 });
				}
			}
			return;
		}
		case 'grapple': {
			steer(e, 0, 0, 8, dt);
			if (!t || t.downed) return;
			e.dir = t.x > e.x ? 1 : -1;
			if (b.elapsed > GRAPNEL.flight && b.elapsed <= GRAPNEL.flight + GRAPNEL.pull) {
				const k = Math.min(1, dt * 8);
				const d = dist(t, e);
				if (d > GRAPNEL.stop) {
					t.x += ((e.x - t.x) / d) * (d - GRAPNEL.stop) * k;
					t.y += ((e.y - t.y) / d) * (d - GRAPNEL.stop) * k;
					t.vx *= 0.3;
					t.vy *= 0.3;
				}
				return;
			}
			// ...and the kick when they arrive
			if (!b.hitDone && b.elapsed > GRAPNEL.flight + GRAPNEL.pull) {
				b.hitDone = true;
				if (dist(t, e) <= GRAPNEL.stop + 40) {
					t.invuln = 0;
					damagePlayer(w, t, power(e, a), e.x, e.y, a.knockback, true);
					w.effects.push({ kind: 'impact', x: t.x, y: t.y, age: 0, life: 0.2, lift: 40 });
				}
			}
			return;
		}
		case 'smokeBomb':
		case 'fearToxin':
		case 'ringSteal':
		case 'flashBolt':
		case 'maceSwing':
			steer(e, 0, 0, 8, dt);
			return;
	}
}

/** Run in at a blur, land a burst of hits, and run out the other side. */
function rushAndPunch(e: Enemy, a: AbilityDef, w: ConstructWorld, dt: number, speed: number, reach: number, hits: number, gap: number, out: boolean, ctx: LeagueCtx) {
	const { damagePlayer, steer, power } = ctx;
	const b = e.brain;
	const t = b.target;
	if (!t || t.downed) {
		steer(e, 0, 0, 8, dt);
		return;
	}
	if (b.hitDone && b.fired > 0) return;
	const d = dist(t, e);
	if (d > reach && b.fired === 0) {
		e.vx = ((t.x - e.x) / d) * speed;
		e.vy = ((t.y - e.y) / d) * speed;
		e.dir = t.x > e.x ? 1 : -1;
		return;
	}
	e.vx = (t.x - e.x) * 8;
	e.vy = (t.y - e.y) * 8;
	e.dir = t.x > e.x ? 1 : -1;
	if (b.fired === 0) contact.set(e, b.elapsed);
	const since = b.elapsed - (contact.get(e) ?? b.elapsed);
	if (b.fired < hits && since >= b.fired * gap) {
		b.fired++;
		const last = b.fired === hits;
		t.invuln = 0;
		const dmg = power(e, a);
		const bubbled = shred(w, t, dmg * FLASH_BITE);
		if (!bubbled) damagePlayer(w, t, dmg, e.x, e.y, last ? a.knockback : 50, true);
		w.effects.push({ kind: 'impact', x: t.x, y: t.y, age: 0, life: 0.15, lift: 34 });
	}
	if (b.fired >= hits) {
		b.hitDone = true;
		if (out) {
			const away = Math.atan2(e.y - t.y, e.x - t.x) + (Math.random() - 0.5) * 1.6;
			e.vx = Math.cos(away) * speed * 0.7;
			e.vy = Math.sin(away) * speed * 0.5;
		}
	}
}

/**
 * The Flash sees a shot coming and is somewhere else by the time it arrives.
 * The missions call this every tick he is free; it does nothing for anyone
 * else. Returns true if he moved.
 */
const dodgedAt = new WeakMap<Enemy, number>();
export function dodgeIfShot(e: Enemy, w: ConstructWorld, time: number, ctx: LeagueCtx): boolean {
	if (e.kind !== 'flashSpar') return false;
	const b = e.brain;
	if (b.state !== 'move' && b.state !== 'idle') return false;
	if (time - (dodgedAt.get(e) ?? -10) < DODGE.every) return false;
	for (const pr of w.projectiles) {
		const v2 = pr.vx * pr.vx + pr.vy * pr.vy;
		if (v2 < 1) continue;
		const rx = e.x - pr.x;
		const ry = e.y - pr.y;
		const when = (rx * pr.vx + ry * pr.vy) / v2;
		if (when < 0 || when > DODGE.lookahead) continue;
		const px = pr.x + pr.vx * when;
		const py = pr.y + pr.vy * when;
		if (Math.hypot(e.x - px, e.y - py) > DODGE.miss) continue;
		const len = Math.sqrt(v2);
		let nx = -pr.vy / len;
		let ny = pr.vx / len;
		if ((e.x - px) * nx + (e.y - py) * ny < 0) {
			nx = -nx;
			ny = -ny;
		}
		const fromX = e.x;
		const fromY = e.y;
		e.x += nx * DODGE.hop;
		e.y += ny * DODGE.hop;
		e.prevX = e.x;
		e.prevY = e.y;
		ctx.heroFx(w).push({ kind: 'zip', x: fromX, y: fromY, x2: e.x, y2: e.y, age: 0, life: 0.22 });
		dodgedAt.set(e, time);
		return true;
	}
	return false;
}
