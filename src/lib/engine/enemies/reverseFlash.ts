// Reverse-Flash (Eobard Thawne): the Flash's powers, turned on the Flash. He
// came with Grodd, but he's only here for one thing.
//
//   Blitz        runs in at a blur, a burst of punches, and out again
//   Beatdown     pins his target and hits them again and again, faster than
//                they can fall down (what he does to the Flash)
//   Lightning    red Speed Force lightning, thrown from a distance
// The mission decides who he's after (the Flash, whenever the Flash is up).

import { damagePlayer } from '../combat';
import type { ConstructWorld } from '../constructs/system';
import { heroFx } from '../heroes';
import { steer, type Enemy } from './enemies';
import { power, type AbilityDef, type AbilityId } from './redConstructs';

export const REVERSE_FLASH_ABILITIES: ReadonlySet<AbilityId> = new Set<AbilityId>(['rfBlitz', 'rfBeatdown', 'rfLightning']);

/** How fast he runs in (px/s), how close counts as reached, and his punches. */
const DASH_SPEED = 1300;
const REACH = 46;
const RF_BLITZ = { punches: 4, gap: 0.07, lastKnockback: 520 };
const RF_BEATDOWN = { hits: 10, gap: 0.08 };

/** When each combo made contact (seconds into the move). */
const contact = new WeakMap<Enemy, number>();

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

export function startReverseFlashAbility(e: Enemy, a: AbilityDef, w: ConstructWorld) {
	const b = e.brain;
	const t = b.target;
	switch (a.id) {
		case 'rfLightning': {
			if (!t || t.downed || dist(t, e) > a.maxRange + 100) return;
			damagePlayer(w, t, power(e, a), e.x, e.y, a.knockback);
			heroFx(w).push({ kind: 'bolt', x: e.x + e.dir * 10, y: e.y, x2: t.x, y2: t.y, age: 0, life: 0.3, lift: 36, red: true });
			break;
		}
		case 'rfBlitz':
		case 'rfBeatdown':
			b.struck = [];
			if (t) heroFx(w).push({ kind: 'zip', x: e.x, y: e.y, x2: t.x, y2: t.y, age: 0, life: 0.25, red: true });
			if (a.id === 'rfBeatdown') w.effects.push({ kind: 'callout', x: e.x, y: e.y - 120, age: 0, life: 1, text: 'TOO SLOW', hurt: true });
			break;
	}
}

export function updateReverseFlashAbility(e: Enemy, a: AbilityDef, w: ConstructWorld, dt: number) {
	const b = e.brain;
	const t = b.target;
	if (a.id === 'rfLightning' || !t || t.downed) {
		steer(e, 0, 0, 8, dt);
		return;
	}
	// Done: running back out (keep going)
	if (b.hitDone && b.fired > 0) return;
	const d = dist(t, e);
	// Run in at a blur
	if (d > REACH && b.fired === 0) {
		e.vx = ((t.x - e.x) / d) * DASH_SPEED;
		e.vy = ((t.y - e.y) / d) * DASH_SPEED;
		e.dir = t.x > e.x ? 1 : -1;
		return;
	}
	// In reach: stay on them and hit
	e.vx = (t.x - e.x) * 8;
	e.vy = (t.y - e.y) * 8;
	e.dir = t.x > e.x ? 1 : -1;
	if (b.fired === 0) contact.set(e, b.elapsed);
	const hits = a.id === 'rfBeatdown' ? RF_BEATDOWN.hits : RF_BLITZ.punches;
	const gap = a.id === 'rfBeatdown' ? RF_BEATDOWN.gap : RF_BLITZ.gap;
	const since = b.elapsed - contact.get(e)!;
	if (b.fired < hits && since >= b.fired * gap) {
		b.fired++;
		const last = b.fired === hits;
		// Too fast to be hit only once: every punch lands, and the beatdown holds them in place
		t.invuln = 0;
		if (a.id === 'rfBeatdown' && !last) {
			t.vx *= 0.2;
			t.vy *= 0.2;
		}
		damagePlayer(w, t, power(e, a), e.x, e.y, last ? (a.id === 'rfBeatdown' ? a.knockback : RF_BLITZ.lastKnockback) : 60);
		w.effects.push({ kind: 'impact', x: t.x, y: t.y, age: 0, life: 0.15, lift: 34 });
	}
	if (b.fired >= hits) {
		// ...and out again
		b.hitDone = true;
		const away = Math.atan2(e.y - t.y, e.x - t.x) + (Math.random() - 0.5) * 1.6;
		e.vx = Math.cos(away) * DASH_SPEED * 0.7;
		e.vy = Math.sin(away) * DASH_SPEED * 0.5;
	}
}
