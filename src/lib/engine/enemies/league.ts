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
	'heatVision',
	'frostBreath',
	'swordRush',
	'lasso',
	'maceDive',
	'maceSwing'
]);

/** How high moves at hand height are drawn. */
const HAND_LIFT = 40;
const RUSH = { speed: 1250, reach: 44, punches: 4, gap: 0.07 };
const HAYMAKER = { speed: 1050, reach: 40 };
const HEAT = { tick: 0.15, width: 30 };
const FROST = { arc: 0.55, slow: 0.12 };
const SWORD = { speed: 900, reach: 60, cuts: [0.14, 0.32, 0.5] };
const LASSO = { pullTime: 0.7 };
const DIVE = { riseTime: 0.3, rise: 160 };

/** When a combo made contact (seconds into the move), and how many ticks a beam has done. */
const contact = new WeakMap<Enemy, number>();
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
		case 'flashRush':
		case 'swordRush':
		case 'haymaker':
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
			heroFx(w).push({ kind: 'lasso', x: e.x, y: e.y, x2: t.x, y2: t.y, age: 0, life: LASSO.pullTime + 0.15, lift: HAND_LIFT, gold: true, track: [e, t] });
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
				heroFx(w).push({ kind: 'heat', x: e.x + e.dir * 8, y: e.y, x2: ex, y2: ey, age: 0, life: HEAT.tick + 0.05, lift: 70 });
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
				// Slowed to a crawl while the breath is on them, and a little cold
				p.vx *= FROST.slow;
				p.vy *= FROST.slow;
				if (!b.hitDone) damagePlayer(w, p, power(e, a), e.x, e.y, a.knockback);
			}
			b.hitDone = true;
			return;
		}
		case 'lasso': {
			steer(e, 0, 0, 8, dt);
			if (!t || t.downed) return;
			// Reeled in over the pull time, then held a moment
			if (b.elapsed <= LASSO.pullTime) {
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
		const bubbled = shred(w, t, dmg);
		damagePlayer(w, t, bubbled ? dmg * THROUGH_BUBBLE : dmg, e.x, e.y, last ? a.knockback : 50, true);
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
