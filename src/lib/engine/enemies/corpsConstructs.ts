// Constructs of the Green Lanterns you spar with, used through the same
// brain as the Red Lanterns (windup, act, recover), but built the Corps way.
//
// Kilowog loves hammers:
//   Giant Hammer   a huge hammer raised overhead and brought down, with a shockwave
//   Hammer Cyclone spins with a hammer, hitting everything around him as he closes in
//   Hammer Toss    throws a spinning hammer that flies out and comes back
//   Hammer Drop    hammers rain down on marks around you
//   Giant Fist     a fist the size of a car punches straight through
// Sinestro is precise and merciless:
//   Sword Lunge    darts in with a sword and cuts
//   Blade Volley   a fan of blades, aimed where you're going
//   Blade Storm    a ring of blades bursting out in every direction
//   (plus the Giant Fist, and green versions of the cage and the beam)

import { damagePlayer } from '../combat';
import type { ConstructWorld } from '../constructs/system';
import type { Player } from '../player';
import { steer, type Enemy } from './enemies';
import { areaHit, fire, power, type AbilityDef, type AbilityId } from './redConstructs';

export const CORPS_ABILITIES: ReadonlySet<AbilityId> = new Set<AbilityId>([
	'bigHammer',
	'hammerSpin',
	'hammerThrow',
	'hammerRain',
	'bigFist',
	'sword',
	'bladeFan',
	'bladeStorm'
]);

/** The shockwave around a Giant Hammer's impact reaches this much further, for a little damage. */
const SHOCKWAVE = 80;
/** A Hammer Cyclone hits the same Lantern again after this long. */
const SPIN_REHIT = 0.3;
/** How long into a Sword Lunge the cut lands (after the dash). */
const LUNGE_CUT = 0.12;

/** The windup is over: the construct happens. */
export function startCorpsAbility(e: Enemy, a: AbilityDef, w: ConstructWorld, players: readonly Player[]) {
	const b = e.brain;
	const angle = Math.atan2(b.aimY, b.aimX);
	switch (a.id) {
		case 'bigHammer': {
			const reach = 95;
			const x = e.x + b.aimX * reach;
			const y = e.y + b.aimY * reach;
			const r = a.radius ?? 115;
			areaHit(e, a, w, players, x, y, r, 80, 120);
			// The shockwave: a lighter hit further out
			for (const p of players) {
				const d = Math.hypot(p.x - x, p.y - y);
				if (!p.downed && d > r + 10 && d <= r + SHOCKWAVE) damagePlayer(w, p, power(e, a) * 0.3, x, y, a.knockback * 0.45);
			}
			w.effects.push({ kind: 'bigHammer', x: e.x, y: e.y, age: 0, life: 0.7, angle, value: reach, radius: r, lift: 40, form: e.kind === 'guySpar' ? 'bat' : undefined });
			break;
		}
		case 'hammerThrow': {
			const shot = fire(e, w, 'hammer', a, b.aimX, b.aimY);
			shot.size = 18;
			break;
		}
		case 'hammerRain': {
			const t = b.target;
			const cx = t ? t.x + t.vx * 0.6 : b.markX;
			const cy = t ? t.y + t.vy * 0.6 : b.markY;
			for (let i = 0; i < 6; i++) {
				const around = (i / 5) * Math.PI * 2 + Math.random() * 0.6;
				const r = i === 0 ? 0 : 70 + Math.random() * 70;
				const warning = 0.85 + i * 0.12;
				w.red.strikes.push({
					kind: 'hammer',
					x: cx + Math.cos(around) * r,
					y: cy + Math.sin(around) * r * 0.8,
					radius: a.radius ?? 60,
					delay: warning,
					warning,
					damage: power(e, a),
					knockback: a.knockback
				});
			}
			break;
		}
		case 'bigFist': {
			const shot = fire(e, w, 'fist', a, b.aimX, b.aimY);
			shot.size = 24;
			break;
		}
		case 'sword':
			// Dart in, then cut (in updateCorpsAbility)
			e.vx = b.aimX * (a.speed ?? 700);
			e.vy = b.aimY * (a.speed ?? 700);
			break;
		case 'bladeFan':
			for (let i = -3; i <= 3; i++) fire(e, w, 'blade', a, Math.cos(angle + i * 0.11), Math.sin(angle + i * 0.11));
			break;
		case 'bladeStorm':
			for (let i = 0; i < 16; i++) {
				const t = angle + (i / 16) * Math.PI * 2;
				fire(e, w, 'blade', a, Math.cos(t), Math.sin(t), false);
			}
			w.effects.push({ kind: 'swordArc', x: e.x, y: e.y, age: 0, life: 0.35, angle, radius: 70, value: 1, lift: 40 });
			break;
	}
}

/** One tick of a Corps construct in use. */
export function updateCorpsAbility(e: Enemy, a: AbilityDef, w: ConstructWorld, players: readonly Player[], dt: number) {
	const b = e.brain;
	const accel = 3;
	switch (a.id) {
		case 'hammerSpin': {
			// Closes in while spinning
			const t = b.target;
			if (t) {
				const dx = t.x - e.x;
				const dy = t.y - e.y;
				const d = Math.hypot(dx, dy) || 1;
				steer(e, (dx / d) * (a.speed ?? 150), (dy / d) * (a.speed ?? 150), accel * 2, dt);
			}
			const r = a.radius ?? 125;
			for (const p of players) {
				if (p.downed || Math.hypot(p.x - e.x, p.y - e.y) > r + 10) continue;
				const last = b.struck.indexOf(p);
				if (last >= 0) continue;
				b.struck.push(p);
				damagePlayer(w, p, power(e, a), e.x, e.y, a.knockback);
			}
			// Everyone can be hit again each turn of the spin
			if (b.elapsed % SPIN_REHIT < dt) b.struck = [];
			w.effects.push({ kind: 'hammerSpin', x: e.x, y: e.y, age: 0, life: 0.1, angle: b.elapsed * 14, radius: r, lift: 40, form: e.kind === 'guySpar' ? 'bat' : undefined });
			break;
		}
		case 'sword':
			if (!b.hitDone && b.elapsed >= LUNGE_CUT) {
				b.hitDone = true;
				e.vx *= 0.3;
				e.vy *= 0.3;
				const r = a.radius ?? 120;
				for (const p of players) {
					if (p.downed) continue;
					const dx = p.x - e.x;
					const dy = p.y - e.y;
					const d = Math.hypot(dx, dy);
					if (d > r + 10) continue;
					if (d > 14 && (dx * b.aimX + dy * b.aimY) / d < 0.2) continue;
					damagePlayer(w, p, power(e, a), e.x, e.y, a.knockback);
				}
				w.effects.push({ kind: 'swordArc', x: e.x, y: e.y, age: 0, life: 0.35, angle: Math.atan2(b.aimY, b.aimX), radius: r, lift: 40 });
			}
			break;
		default:
			steer(e, 0, 0, accel, dt);
	}
}
