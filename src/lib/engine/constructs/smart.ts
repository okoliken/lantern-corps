// The smart ring: the construct button makes whatever the moment needs.
//
// A ring answers its bearer's will, so instead of the player picking one of
// ten constructs, the ring reads the fight and builds the right one:
//
//   enemy right next to you            sword, glove, fist, cutter
//   several close by                   hammer, wrecking ball, shockwave
//   a line or bunch further off        locomotive, I-beams, missiles, grenades, anvil
//   one far away                       sniper, beam, missiles
//   several enemies about              Marines (if none are out)
//   surrounded or badly hurt           Power Armor
//   something rushing you              wall, cage, mines (Kilowog)
//
// It scores every construct in the loadout by what it DOES (its behavior),
// not its name, so it works for any Lantern and for Forge constructs later.
// Only ones that are ready and affordable count. Holding the button keeps it
// choosing, so a player can fight with one button and just aim.
//
// The bubble shield works the same way: it goes on whoever needs it most
// (you, a partner, or something you're protecting, like a ship).

import { BUBBLE_SHIELD, HELD_BEHAVIORS, type ConstructDef } from './defs';
import { costOf, type ConstructWorld, type Protectable } from './system';
import { DUMMY_HALF_W, isStanding, type Dummy } from '../dummy';
import type { Player } from '../player';
import { canSpend, RESTART_THRESHOLD } from '../willpower';

export interface SmartPick {
	/** Which loadout slot to use. */
	slot: number;
	/** Seconds to hold it (beam, minigun, sniper charge); 0 = a single use. */
	hold: number;
}

/** Things worth hitting: enemies and asteroids (not training dummies... unless that's all there is). */
function hostiles(w: ConstructWorld): Dummy[] {
	const all = w.dummies.filter(isStanding);
	const real = all.filter((d) => 'brain' in d || d.drift);
	return real.length > 0 ? real : all;
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

interface Situation {
	target: Dummy | null;
	/** Ground distance to the target. */
	d: number;
	/** Hostiles within melee-ish range of me. */
	near: number;
	/** Hostiles bunched around the target (including it). */
	cluster: number;
	/** Something is coming right at me. */
	rushed: boolean;
	/** Me or a nearby friend is badly hurt. */
	hurt: boolean;
	all: Dummy[];
}

function read(p: Player, w: ConstructWorld): Situation {
	const all = hostiles(w);
	let target = p.attackTarget?.kind === 'enemy' ? p.attackTarget.dummy : null;
	if (!target) {
		// Nothing aimed at: the nearest threat within reach
		for (const d of all) if (dist(d, p) < 600 && (!target || dist(d, p) < dist(target, p))) target = d;
	}
	const near = all.filter((d) => dist(d, p) < 150).length;
	const cluster = target ? all.filter((d) => dist(d, target!) < 110).length : 0;
	const rushed = all.some((d) => {
		if (dist(d, p) > 220) return false;
		const brain = (d as { brain?: { target: Player | null; engaged: boolean } }).brain;
		if (brain) return brain.target === p && (brain.engaged || dist(d, p) < 140);
		// A drifting rock heading my way
		return (p.x - d.x) * d.vx + (p.y - d.y) * d.vy > 0;
	});
	const friends = [p, ...w.players.filter((o) => o !== p && !o.downed && dist(o, p) < 450)];
	const hurt = friends.some((o) => o.health < o.maxHealth * 0.5);
	return { target, d: target ? dist(target, p) : Infinity, near, cluster, rushed, hurt, all };
}

/** How good a construct is right now, 0 = not at all. */
function score(def: ConstructDef, s: Situation, p: Player, w: ConstructWorld): number {
	const { d, cluster, near } = s;
	const hasTarget = s.target !== null;
	const reach = def.range;
	switch (def.behavior) {
		case 'slash':
			return hasTarget && d < reach + DUMMY_HALF_W ? 0.75 : 0;
		case 'smash': {
			if (!hasTarget || d > reach + (def.radius ?? 40)) return 0;
			return 0.6 + 0.2 * Math.min(cluster - 1, 2) + (def.stun ? 0.05 : 0);
		}
		case 'spread':
			return hasTarget && d < reach * 0.75 ? 0.5 + 0.15 * Math.min(cluster - 1, 2) + 0.05 * near : 0;
		case 'area':
			return near >= 2 ? 0.6 + 0.12 * near : near === 1 && s.rushed ? 0.45 : 0;
		case 'volley': {
			if (!hasTarget || d < 120 || d > reach) return 0;
			const ahead = s.all.filter((o) => dist(o, p) < reach).length;
			return ahead >= 2 ? 0.7 : 0.35;
		}
		case 'pillars':
			return hasTarget && d < reach ? (cluster >= 2 ? 0.72 : 0.35) : 0;
		case 'heavy':
			return hasTarget && d > 150 && d < reach ? 0.45 + 0.15 * Math.min(cluster - 1, 2) : 0;
		case 'snipe':
			return hasTarget && d > 220 ? 0.45 + (d > 400 ? 0.2 : 0) : 0;
		case 'boomerang':
			return hasTarget && d > 80 && d < reach ? 0.5 : 0;
		case 'grab':
			return hasTarget && 'brain' in s.target! && d > 170 && d < reach ? 0.5 : 0;
		case 'dash':
			return hasTarget && d > 90 && d < reach ? 0.38 : 0;
		case 'rapid':
			return hasTarget && d < reach ? 0.45 + 0.05 * Math.min(cluster, 3) : 0;
		case 'beam':
			return hasTarget && d < reach ? 0.4 : 0;
		case 'barrier':
			return s.rushed && d > 50 ? 0.6 : 0;
		case 'trap':
			return s.rushed ? 0.45 : 0;
		case 'mine':
			return s.rushed ? 0.5 : 0;
		case 'turret': {
			const mine = w.turrets.filter((t) => t.owner === p).length;
			return mine === 0 && s.all.length >= 2 ? 0.55 : 0;
		}
		case 'heal':
			return s.hurt && !w.aids.some((a) => a.owner === p) ? 0.95 : 0;
		case 'grind':
			return hasTarget && d < reach + (def.radius ?? 36) + 10 ? 0.78 : 0;
		case 'lances': {
			if (!hasTarget || d < 110 || d > reach) return 0;
			return 0.5 + 0.12 * Math.min(cluster - 1, 2);
		}
		case 'ram': {
			if (!hasTarget || d < 110 || d > reach) return 0;
			const inLine = s.all.filter((o) => dist(o, p) < reach).length;
			return inLine >= 2 ? 0.72 : 0.42;
		}
		case 'squad': {
			const out = w.turrets.some((t) => t.owner === p && t.follow);
			return !out && s.all.length >= 2 ? 0.66 : 0;
		}
		case 'armor':
			return !p.armor && (near >= 2 || p.health < p.maxHealth * 0.45) ? 0.8 : 0;
		default:
			return 0;
	}
}

/** Can this slot be used right now? */
function ready(p: Player, slot: number): boolean {
	const def = p.loadout[slot];
	if (p.cooldowns[slot] > 0 || p.exhausted || p.locked.has(def.id)) return false;
	if (def.behavior === 'beam') return p.willpower >= RESTART_THRESHOLD;
	return canSpend(p, costOf(p, def));
}

/** The best construct for this moment, or null if nothing makes sense. */
export function pickConstruct(p: Player, w: ConstructWorld): SmartPick | null {
	const s = read(p, w);
	let best: SmartPick | null = null;
	let bestScore = 0;
	p.loadout.forEach((def, slot) => {
		if (!ready(p, slot)) return;
		const sc = score(def, s, p, w);
		if (sc > bestScore) {
			bestScore = sc;
			best = { slot, hold: holdFor(def) };
		}
	});
	return best;
}

export interface SmartChoice extends SmartPick {
	/** It's the right construct but it's still cooling down: wait for it rather than use a worse one. */
	wait: boolean;
}

/** Keep the last pick while it's still at least this good compared with the best. */
const STICK = 0.75;
/** Wait this long (seconds of cooldown left) for the best construct before settling for another. */
const WAIT_FOR_BEST = 0.45;

/**
 * The smart ring for a player: like pickConstruct, but steady. It sticks with
 * what it last picked while that still fits, and waits a moment for the best
 * construct to come off cooldown instead of reaching for the next one down, so
 * holding the button doesn't cycle through the whole loadout.
 */
export function smartChoice(p: Player, w: ConstructWorld): SmartChoice | null {
	const s = read(p, w);
	const scores = p.loadout.map((def, slot) => (affordable(p, slot) ? score(def, s, p, w) : 0));
	let top = -1;
	scores.forEach((sc, slot) => {
		if (sc > 0 && (top < 0 || sc > scores[top])) top = slot;
	});
	if (top < 0) return null;
	const prev = p.smartPick;
	const choice = prev >= 0 && scores[prev] >= scores[top] * STICK ? prev : top;
	const def = p.loadout[choice];
	if (ready(p, choice)) return { slot: choice, hold: holdFor(def), wait: false };
	if (p.cooldowns[choice] <= WAIT_FOR_BEST) return { slot: choice, hold: holdFor(def), wait: true };
	// A long wait: the best of what's ready, if it's nearly as good
	let alt = -1;
	scores.forEach((sc, slot) => {
		if (sc >= scores[top] * STICK && ready(p, slot) && (alt < 0 || sc > scores[alt])) alt = slot;
	});
	return alt >= 0 ? { slot: alt, hold: holdFor(p.loadout[alt]), wait: false } : { slot: choice, hold: holdFor(def), wait: true };
}

/** Enough willpower for it (cooldowns aside). */
function affordable(p: Player, slot: number): boolean {
	const def = p.loadout[slot];
	if (p.exhausted) return false;
	if (def.behavior === 'beam') return p.willpower >= RESTART_THRESHOLD;
	return canSpend(p, costOf(p, def));
}

function holdFor(def: ConstructDef): number {
	if (def.behavior === 'snipe') return def.charge ?? 1;
	return HELD_BEHAVIORS.has(def.behavior) ? 1 : 0;
}

// ------------------------------------------------------------------ shield

/** How much danger a Lantern is in right now: attacks winding up on them, shots flying at them. */
function dangerTo(p: Player, w: ConstructWorld): number {
	let danger = 0;
	for (const d of w.dummies) {
		const brain = (d as { brain?: { target: Player | null; state: string } }).brain;
		if (!brain || !isStanding(d) || brain.target !== p) continue;
		if ((brain.state === 'windup' || brain.state === 'act') && dist(d, p) < 450) danger += 1;
	}
	for (const s of w.red.shots) {
		const toP = Math.hypot(p.x - s.x, p.y - s.y);
		if (toP > 260) continue;
		// Heading this way?
		if ((p.x - s.x) * s.vx + (p.y - s.y) * s.vy > 0) danger += 0.5;
	}
	// Asteroids heading straight in
	for (const d of w.dummies) {
		if (!d.drift || !isStanding(d) || dist(d, p) > 200) continue;
		if ((p.x - d.x) * d.vx + (p.y - d.y) * d.vy > 0) danger += 0.5;
	}
	if (danger > 0 && p.health < p.maxHealth * 0.4) danger += 0.5;
	return danger;
}

/**
 * Who the bubble shield should go on: whoever is in the most danger among
 * me, my partners in reach, and anything I'm protecting (a ship). Ties go to
 * me. A locked ally (Tab) always wins: that's the player choosing.
 */
export function chooseShieldTarget(p: Player, w: ConstructWorld): Player | Protectable {
	const locked = p.protectTarget?.kind === 'ally' ? p.protectTarget.player : null;
	if (locked && dist(locked, p) <= BUBBLE_SHIELD.range) return locked;

	let best: Player | Protectable = p;
	let bestDanger = dangerTo(p, w) + 0.01;
	for (const thing of w.protectables) {
		if (dist(thing, p) > BUBBLE_SHIELD.range + thing.radius) continue;
		if (thing.threat > bestDanger) {
			best = thing;
			bestDanger = thing.threat;
		}
	}
	// The thing we're here to protect comes before a partner, who can shield themselves
	if (best !== p) return best;
	for (const o of w.players) {
		if (o === p || o.downed || dist(o, p) > BUBBLE_SHIELD.range) continue;
		const danger = dangerTo(o, w);
		if (danger > bestDanger) {
			best = o;
			bestDanger = danger;
		}
	}
	return best;
}
