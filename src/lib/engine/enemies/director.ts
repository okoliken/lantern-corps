// The attack director: whose turn is it to attack?
//
// Enemies think for themselves, but a good fight has a rhythm. If every
// enemy that CAN attack does, a pack lands everything at once and the
// Lantern gets flattened without a chance to react. So attacks on a Lantern
// take turns, the way fighting games and action games pace their crowds:
//
//  - TOKENS: each Lantern has a small budget of attacks that can be coming at
//    them at the same moment (2 normally). A big area attack costs 2. An
//    enemy has to get a token before it starts a windup and gives it back
//    when the attack is over.
//  - SPACING: after an attack starts on a Lantern, the next one on them has
//    to wait a moment, so hits come one after another, not in one burst.
//  - BREATHING ROOM: a Lantern who has just taken a lot of damage gets a
//    smaller budget for a few seconds.
//
// Everyone else keeps moving, circling and looking for an opening, which is
// what makes the wait look like tactics instead of standing in a queue.

import type { Player } from '../player';
import type { AbilityDef } from './redConstructs';

export interface Pressure {
	/** Recent damage taken; fades over a few seconds. */
	heat: number;
	/** Seconds before another attack may start on this Lantern. */
	gap: number;
	/** Health last tick, to measure damage taken. */
	lastHealth: number;
}

export type PressureMap = Map<Player, Pressure>;

/** How many attacks can be coming at one Lantern at once. */
export const ATTACK_BUDGET = 3;
/** Recent damage above this shrinks the budget to 1 until it cools down. */
const HEAT_LIMIT = 28;
/** Seconds for recent damage to fade to about a third. */
const HEAT_FADE = 2.5;
/** Seconds between attacks starting on the same Lantern (random in this range). */
const GAP_MIN = 0.35;
const GAP_MAX = 0.75;

/** Anything with an attack in progress that the director counts. */
export interface Attacker {
	target: Player | null;
	/** The ability being wound up or used, or null. */
	attack: AbilityDef | null;
}

function pressureOn(map: PressureMap, p: Player): Pressure {
	let entry = map.get(p);
	if (!entry) {
		entry = { heat: 0, gap: 0, lastHealth: p.health };
		map.set(p, entry);
	}
	return entry;
}

/** Once per tick: cool down and count the damage each Lantern took. */
export function updatePressure(map: PressureMap, players: readonly Player[], dt: number) {
	for (const p of players) {
		const entry = pressureOn(map, p);
		const took = Math.max(0, entry.lastHealth - p.health);
		entry.lastHealth = p.health;
		entry.heat = entry.heat * Math.exp(-dt / HEAT_FADE) + took;
		entry.gap = Math.max(0, entry.gap - dt);
	}
}

/** Attacks cost 1 token, big area attacks 2. */
const attackCost = (a: AbilityDef) => (a.heavy ? 2 : 1);

/** How many tokens a Lantern has right now. Higher tempo (a harder fight) allows one more. */
function budgetFor(map: PressureMap, p: Player, tempo: number): number {
	const entry = pressureOn(map, p);
	let budget = ATTACK_BUDGET + (tempo > 1.5 ? 1 : 0);
	if (entry.heat > HEAT_LIMIT) budget -= 1;
	return Math.max(1, budget);
}

/** May `me` start `a` on `t` now? */
export function mayAttack(
	map: PressureMap,
	me: Attacker,
	t: Player,
	a: AbilityDef,
	others: readonly Attacker[],
	tempo: number
): boolean {
	const entry = pressureOn(map, t);
	if (entry.gap > 0) return false;
	let used = 0;
	for (const o of others) if (o !== me && o.target === t && o.attack) used += attackCost(o.attack);
	return used + attackCost(a) <= budgetFor(map, t, tempo);
}

/** An attack on `t` just started: the next one has to wait a moment. */
export function attackStarted(map: PressureMap, t: Player, tempo: number, rand = Math.random) {
	pressureOn(map, t).gap = (GAP_MIN + rand() * (GAP_MAX - GAP_MIN)) / Math.max(1, tempo * 0.8);
}
