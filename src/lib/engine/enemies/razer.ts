// Razer's constructs. Atrocitus's lieutenant doesn't build Earth things: his
// rage makes blades, and weapons made to break a Green Lantern's will.
//
//   Twin Rage Blades   a lunge and three quick cuts with blades on both arms
//   Crimson Chakram    two crescent blades thrown wide; they swing round in arcs
//                      and come back
//   Construct Shatter  a pulse of hate that breaks every Green Lantern construct
//                      near him: walls, turrets, Marines, domes, armor, bubbles
//   Rage Brand         a red sigil burned onto a Lantern: their ring builds
//                      nothing for a few seconds (a bubble shield blocks it)
//   Crimson Nova       a huge ring of rage around him after a long warning: get
//                      out, or shield in time
//   Blade Storm        a spinning vortex of blades that drags Lanterns in, then
//                      bursts outward
// He also uses the Barbed Chain (his Rage Tether), Napalm Vomit (Rage Plasma)
// and the Rage Shield, from the Red Lanterns' kit.

import { damagePlayer } from '../combat';
import { removeObstacle, type ConstructWorld } from '../constructs/system';
import type { Player } from '../player';
import { steer, type Enemy } from './enemies';
import { fire, power, type AbilityDef, type AbilityId } from './redConstructs';

export const RAZER_ABILITIES: ReadonlySet<AbilityId> = new Set<AbilityId>(['twinBlades', 'chakram', 'shatter', 'brand', 'crimsonNova', 'razerStorm']);

/** Seconds a Rage Brand keeps a Lantern's ring from building anything. */
export const BRAND_TIME = 3;
/** When each of the three blade cuts lands, in seconds after the lunge starts. */
const CUTS = [0.14, 0.32, 0.5];
/** How hard the Blade Storm drags Lanterns in (px/s²), how close it cuts, and how often. */
const STORM_PULL = 900;
const STORM_CUT_RANGE = 115;
const STORM_REHIT = 0.3;
/** Seconds of warning on the Crimson Nova's ring. */
const NOVA_WARNING = 1.1;

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** The windup is over: the construct happens. */
export function startRazerAbility(e: Enemy, a: AbilityDef, w: ConstructWorld, players: readonly Player[]) {
	const b = e.brain;
	const angle = Math.atan2(b.aimY, b.aimX);
	switch (a.id) {
		case 'twinBlades':
			// Lunge in; the cuts land in updateRazerAbility
			e.vx = b.aimX * (a.speed ?? 680);
			e.vy = b.aimY * (a.speed ?? 680);
			break;
		case 'chakram':
			// Thrown wide to either side, curving back in toward the Lantern
			for (const side of [-1, 1]) {
				const t = angle + side * 0.6;
				const shot = fire(e, w, 'saw', a, Math.cos(t), Math.sin(t), false);
				shot.curve = -side * 1.7;
				shot.out = a.maxRange * 0.85;
				shot.size = 14;
			}
			break;
		case 'shatter':
			shatter(e, a, w, players);
			break;
		case 'brand':
			brand(e, a, w);
			break;
		case 'crimsonNova':
			w.red.strikes.push({
				kind: 'nova',
				x: e.x,
				y: e.y,
				radius: a.radius ?? 250,
				delay: NOVA_WARNING,
				warning: NOVA_WARNING,
				damage: power(e, a),
				knockback: a.knockback
			});
			w.effects.push({ kind: 'callout', x: e.x, y: e.y - 150, age: 0, life: 1.4, text: 'CRIMSON NOVA', hurt: true });
			break;
		case 'razerStorm':
			w.effects.push({ kind: 'callout', x: e.x, y: e.y - 150, age: 0, life: 1.4, text: 'BLADE STORM', hurt: true });
			break;
	}
}

/** One tick of one of Razer's constructs in use. */
export function updateRazerAbility(e: Enemy, a: AbilityDef, w: ConstructWorld, players: readonly Player[], dt: number) {
	const b = e.brain;
	switch (a.id) {
		case 'twinBlades': {
			const next = CUTS[b.fired];
			if (next !== undefined && b.elapsed >= next) {
				b.fired++;
				// Slows from the lunge into the cuts
				e.vx *= 0.35;
				e.vy *= 0.35;
				cut(e, a, w, players, b.fired % 2 === 0 ? 1 : -1);
			}
			break;
		}
		case 'razerStorm': {
			// Drifts after the Lantern while the blades spin
			const t = b.target;
			if (t) {
				const d = dist(t, e) || 1;
				steer(e, ((t.x - e.x) / d) * 90, ((t.y - e.y) / d) * 90, 3, dt);
			}
			const r = a.radius ?? 330;
			for (const p of players) {
				if (p.downed || p.dash) continue;
				const d = dist(p, e);
				if (d > r || d < 20) continue;
				// Dragged toward the middle, harder the closer they are
				const pull = STORM_PULL * (1 - (d / r) * 0.5);
				p.vx += ((e.x - p.x) / d) * pull * dt;
				p.vy += ((e.y - p.y) / d) * pull * dt;
				if (d <= STORM_CUT_RANGE && !b.struck.includes(p)) {
					b.struck.push(p);
					damagePlayer(w, p, power(e, a), e.x, e.y, 60);
				}
			}
			if (b.elapsed % STORM_REHIT < dt) b.struck = [];
			if (b.elapsed % 0.12 < dt) w.effects.push({ kind: 'scythe', x: e.x, y: e.y, age: 0, life: 0.3, angle: b.elapsed * 12, radius: STORM_CUT_RANGE, lift: 40 });
			// It ends in a burst of blades flying outward
			if (!b.hitDone && b.timer <= dt) {
				b.hitDone = true;
				for (let i = 0; i < 14; i++) {
					const ang = (i / 14) * Math.PI * 2 + b.elapsed;
					fire(e, w, 'spear', a, Math.cos(ang), Math.sin(ang), false);
				}
				w.effects.push({ kind: 'spikeBurst', x: e.x, y: e.y, age: 0, life: 0.5, radius: STORM_CUT_RANGE * 1.4 });
			}
			break;
		}
		default:
			steer(e, 0, 0, 3, dt);
	}
}

/** One cut of the Twin Rage Blades: everything in a wide arc in front. */
function cut(e: Enemy, a: AbilityDef, w: ConstructWorld, players: readonly Player[], side: number) {
	const b = e.brain;
	const r = a.radius ?? 100;
	for (const p of players) {
		if (p.downed) continue;
		const dx = p.x - e.x;
		const dy = p.y - e.y;
		const d = Math.hypot(dx, dy);
		if (d > r + 12) continue;
		if (d > 16 && (dx * b.aimX + dy * b.aimY) / d < 0.1) continue;
		damagePlayer(w, p, power(e, a), e.x, e.y, a.knockback);
	}
	for (const t of w.turrets) if (dist(t, e) <= r) t.hp -= 30;
	w.effects.push({ kind: 'redAxe', x: e.x, y: e.y, age: 0, life: 0.3, angle: Math.atan2(b.aimY, b.aimX) + side * 0.35, radius: r, lift: 40 });
}

/**
 * Construct Shatter: everything a Green Lantern has built near him breaks.
 * Bubble shields pop, walls and domes come down, turrets and Marines
 * fizzle, mines and cages go dark, and Power Armor falls away. Lanterns in
 * reach are hurt and thrown back too.
 */
function shatter(e: Enemy, a: AbilityDef, w: ConstructWorld, players: readonly Player[]) {
	const r = a.radius ?? 280;
	const near = (o: { x: number; y: number }) => dist(o, e) <= r;
	w.shields = w.shields.filter((s) => {
		if (!near(s.target)) return true;
		w.effects.push({ kind: 'pop', x: s.target.x, y: s.target.y, age: 0, life: 0.5 });
		return false;
	});
	for (const o of w.obstacles.filter((o) => o.kind === 'wall' && near({ x: o.x + o.w / 2, y: o.y + o.h / 2 }))) removeObstacle(w, o, 'burst');
	const gone = (o: { x: number; y: number }) => {
		w.effects.push({ kind: 'fizzle', x: o.x, y: o.y - 16, age: 0, life: 0.5 });
		return false;
	};
	w.turrets = w.turrets.filter((t) => !near(t) || gone(t));
	w.fortresses = w.fortresses.filter((f) => !near(f) || gone(f));
	w.traps = w.traps.filter((t) => !near(t) || gone(t));
	w.aids = w.aids.filter((s) => !near(s) || gone(s));
	for (const p of players) {
		if (p.downed || !near(p)) continue;
		if (p.armor) {
			p.armor = null;
			w.effects.push({ kind: 'fizzle', x: p.x, y: p.y - 30, age: 0, life: 0.6 });
		}
		damagePlayer(w, p, power(e, a), e.x, e.y, a.knockback);
	}
	w.effects.push({ kind: 'roar', x: e.x, y: e.y, age: 0, life: 0.6, radius: r, lift: 30 });
	w.effects.push({ kind: 'callout', x: e.x, y: e.y - 150, age: 0, life: 1.4, text: 'CONSTRUCT SHATTER', hurt: true });
}

/** Rage Brand: burned onto the Lantern he's after. A bubble shield takes it instead. */
function brand(e: Enemy, a: AbilityDef, w: ConstructWorld) {
	const t = e.brain.target;
	if (!t || t.downed || dist(t, e) > a.maxRange + 120) return;
	const shielded = w.shields.find((s) => s.target === t);
	if (shielded) {
		shielded.hp -= 40;
		shielded.ripple = 0.3;
		w.effects.push({ kind: 'redImpact', x: t.x, y: t.y, age: 0, life: 0.3, lift: 50 });
		return;
	}
	t.branded = BRAND_TIME;
	damagePlayer(w, t, power(e, a), e.x, e.y, 0);
	w.effects.push({ kind: 'callout', x: t.x, y: t.y, age: 0, life: 1.4, text: 'BRANDED', hurt: true, owner: t });
}
