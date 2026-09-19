// Gorilla Grodd's powers. He's a telepath and a telekinetic, and a gorilla
// the size of a truck besides:
//
//   Psychic Blast       a wave of force from his mind, spreading out in front
//                       of him. A bubble shield is no help: it's in your head
//   Mind Control        he gets into a Lantern's head: for a few seconds every
//                       move goes the wrong way (a hero just stands there,
//                       dazed). A bubble shield takes it instead
//   Telekinetic Throw   a car lifted off the street and hurled; it bursts where
//                       it lands
//   Debris Storm        everything loose around him lifted and flung at you
// He also leaps (slam), charges, roars and claws, like any gorilla.

import { damagePlayer } from '../combat';
import type { ConstructWorld } from '../constructs/system';
import type { Player } from '../player';
import { steer, type Enemy } from './enemies';
import { fire, power, type AbilityDef, type AbilityId } from './redConstructs';

export const GRODD_ABILITIES: ReadonlySet<AbilityId> = new Set<AbilityId>(['mindBlast', 'mindLock', 'carThrow', 'debrisStorm']);

/** Seconds of Mind Control. */
export const MIND_LOCK_TIME = 3.2;
/** Psychic Blast: half the angle of its cone (radians). */
const BLAST_SPREAD = 0.6;
/** Debris Storm: pieces thrown, and seconds between them. */
const STORM_PIECES = 10;
const STORM_GAP = 0.13;

/** A psychic wave or grip: drawn by draw/gorillas.ts. */
export interface PsychicFx {
	kind: 'wave' | 'lock';
	x: number;
	y: number;
	angle: number;
	/** How far the wave reaches. */
	radius: number;
	age: number;
	life: number;
	/** Mind Control: from Grodd to whoever he's in. */
	x2?: number;
	y2?: number;
}

const fxLists = new WeakMap<ConstructWorld, PsychicFx[]>();
export function psychicFx(w: ConstructWorld): PsychicFx[] {
	let list = fxLists.get(w);
	if (!list) fxLists.set(w, (list = []));
	return list;
}

export function updatePsychicFx(w: ConstructWorld, dt: number) {
	const list = psychicFx(w);
	for (const f of list) f.age += dt;
	list.splice(0, list.length, ...list.filter((f) => f.age < f.life));
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

export function startGroddAbility(e: Enemy, a: AbilityDef, w: ConstructWorld) {
	const b = e.brain;
	switch (a.id) {
		case 'mindBlast':
			psychicFx(w).push({ kind: 'wave', x: e.x, y: e.y, angle: Math.atan2(b.aimY, b.aimX), radius: a.maxRange, age: 0, life: a.active + 0.2 });
			w.effects.push({ kind: 'callout', x: e.x, y: e.y - 170, age: 0, life: 1.2, text: 'PSYCHIC BLAST', hurt: true });
			break;
		case 'mindLock':
			mindLock(e, a, w);
			break;
		case 'carThrow': {
			const car = fire(e, w, 'shell', a, b.aimX, b.aimY, false);
			car.radius = a.radius;
			car.size = 24;
			car.look = 'car';
			break;
		}
		case 'debrisStorm':
			w.effects.push({ kind: 'callout', x: e.x, y: e.y - 170, age: 0, life: 1.3, text: 'DEBRIS STORM', hurt: true });
			break;
	}
}

export function updateGroddAbility(e: Enemy, a: AbilityDef, w: ConstructWorld, players: readonly Player[], dt: number) {
	const b = e.brain;
	steer(e, 0, 0, 5, dt);
	switch (a.id) {
		case 'mindBlast': {
			// The wave spreads out over the active time; each Lantern it reaches is hit once, shield or not
			const reach = (b.elapsed / a.active) * a.maxRange;
			const aim = Math.atan2(b.aimY, b.aimX);
			for (const p of players) {
				if (p.downed || b.struck.includes(p)) continue;
				const d = dist(p, e);
				if (d > reach) continue;
				const off = Math.abs(Math.atan2(Math.sin(Math.atan2(p.y - e.y, p.x - e.x) - aim), Math.cos(Math.atan2(p.y - e.y, p.x - e.x) - aim)));
				if (d > 30 && off > BLAST_SPREAD) continue;
				b.struck.push(p);
				damagePlayer(w, p, power(e, a), e.x, e.y, a.knockback, true);
			}
			break;
		}
		case 'debrisStorm': {
			const up = players.filter((p) => !p.downed);
			if (up.length && b.fired < STORM_PIECES && b.elapsed >= b.fired * STORM_GAP) {
				b.fired++;
				const t = up[b.fired % up.length];
				const ang = Math.atan2(t.y - e.y, t.x - e.x) + (Math.random() - 0.5) * 0.5;
				const rock = fire(e, w, 'bolt', a, Math.cos(ang), Math.sin(ang), false);
				rock.look = 'rock';
				rock.size = 10;
			}
			break;
		}
	}
}

/** Mind Control on whoever he's after. A bubble shield takes it (and breaks). */
function mindLock(e: Enemy, a: AbilityDef, w: ConstructWorld) {
	const t = e.brain.target;
	if (!t || t.downed || dist(t, e) > a.maxRange + 120) return;
	psychicFx(w).push({ kind: 'lock', x: e.x, y: e.y, x2: t.x, y2: t.y, angle: 0, radius: 0, age: 0, life: 0.5 });
	const shield = w.shields.find((s) => s.target === t);
	if (shield) {
		w.shields.splice(w.shields.indexOf(shield), 1);
		w.effects.push({ kind: 'pop', x: t.x, y: t.y, age: 0, life: 0.45, owner: t });
		return;
	}
	t.confused = MIND_LOCK_TIME;
	damagePlayer(w, t, power(e, a), e.x, e.y, 0);
	w.effects.push({ kind: 'callout', x: t.x, y: t.y, age: 0, life: 1.4, text: 'MIND CONTROL', hurt: true, owner: t });
}
