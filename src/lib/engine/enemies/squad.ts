// Squads: a big pack doesn't all charge at once.
//
// Every enemy that knows about the Lanterns is in one of two groups:
//
//   ASSAULT   the ones fighting right now (3, or 5 against two Lanterns)
//   RESERVE   hanging back at a distance, circling, waiting to be sent in
//
// The squad leader (this file, thinking for the pack as a whole) keeps it
// that way:
//  - when an attacker falls, the best reserve moves up to replace it,
//  - every so often a badly hurt attacker is pulled back and a fresh one
//    goes in (machines always; Red Lanterns only if they're careful ones),
//  - named lieutenants and ships always fight: they lead from the front,
//  - "blood in the water": if a Lantern is nearly down or out of
//    willpower, everyone piles in for a few seconds.
//
// Reserves don't attack (the brain skips their attack decisions), but
// they're still dangerous to walk into, and they fill in the moment
// there's a gap.

import type { ConstructWorld } from '../constructs/system';
import type { Player } from '../player';
import { RESTART_THRESHOLD } from '../willpower';
import { ENEMIES, type Enemy } from './enemies';

export type SquadRole = 'assault' | 'reserve';

export interface SquadState {
	/** Seconds of everyone-attacks left. */
	allIn: number;
	/** Seconds until the leader next swaps a hurt attacker for a fresh one. */
	rotateIn: number;
}

export function createSquadState(): SquadState {
	return { allIn: 0, rotateIn: ROTATE_EVERY };
}

/** Attackers against one Lantern; each extra Lantern adds this many more. */
export const ASSAULT_SIZE = 3;
export const ASSAULT_PER_EXTRA_LANTERN = 2;
/** How long an all-in rush lasts once a Lantern looks beaten. */
const ALL_IN_TIME = 4;
/** A Lantern below this fraction of health looks beaten. */
const ALL_IN_HEALTH = 0.3;
const ROTATE_EVERY = 8;

/** Enemies that always fight, and don't take one of the squad's places. */
const leadsFromFront = (e: Enemy) => ENEMIES[e.kind].lieutenant === true || ENEMIES[e.kind].movement !== 'hover';

export function assaultSize(players: readonly Player[]): number {
	const up = players.filter((p) => !p.downed).length;
	return up === 0 ? 0 : ASSAULT_SIZE + (up - 1) * ASSAULT_PER_EXTRA_LANTERN;
}

/** Once per tick, before the enemies think. */
export function updateSquads(pack: readonly Enemy[], players: readonly Player[], w: ConstructWorld, dt: number) {
	const s = w.squad;
	s.allIn = Math.max(0, s.allIn - dt);
	s.rotateIn -= dt;
	for (const e of pack) e.brain.squadTime += dt;

	// Blood in the water
	const beaten = players.some((p) => !p.downed && (p.health < p.maxHealth * ALL_IN_HEALTH || p.willpower < RESTART_THRESHOLD * 0.5));
	if (beaten && s.allIn === 0) s.allIn = ALL_IN_TIME;

	// Only enemies that know about the fight count; the rest are idle anyway
	const aware = pack.filter((e) => e.brain.target);
	if (s.allIn > 0) {
		for (const e of aware) setRole(e, 'assault');
		return;
	}

	const size = assaultSize(players);
	const assault = aware.filter((e) => e.brain.squad === 'assault' || leadsFromFront(e));
	const reserve = aware.filter((e) => !assault.includes(e));
	for (const e of aware) if (leadsFromFront(e)) setRole(e, 'assault');

	// Rotation: pull a badly hurt attacker back, send a fresh one in
	if (s.rotateIn <= 0) {
		s.rotateIn = ROTATE_EVERY;
		const tired = assault
			.filter((e) => !leadsFromFront(e) && e.brain.hurt > 0.5 && e.brain.state === 'move')
			.filter((e) => ENEMIES[e.kind].mind === 'machine' || e.brain.persona.caution > 0.5)
			.sort((a, b) => b.brain.hurt - a.brain.hurt)[0];
		if (tired && reserve.length > 0) {
			setRole(tired, 'reserve');
			assault.splice(assault.indexOf(tired), 1);
			reserve.push(tired);
		}
	}

	// Keen, healthy, close, and waited longest: the best ones to be attacking
	const score = (e: Enemy) => {
		const b = e.brain;
		const t = b.target!;
		const waited = b.squad === 'reserve' ? b.squadTime * 0.1 : 0;
		return b.persona.aggression + (1 - b.hurt) - Math.hypot(t.x - e.x, t.y - e.y) / 400 + waited;
	};

	// Too many attacking (a fresh pack arriving): the least suited wait
	// Lieutenants, ships and turrets fight on top of the squad, not instead of it
	const movable = assault.filter((e) => !leadsFromFront(e)).sort((a, b) => score(a) - score(b));
	let count = movable.length;
	for (const e of movable) {
		if (count <= size) break;
		if (e.brain.state === 'windup' || e.brain.state === 'act') continue; // finish what it started
		setRole(e, 'reserve');
		count--;
	}

	// Gaps: the best reserves move up
	const waiting = reserve.sort((a, b) => score(b) - score(a));
	for (const e of waiting) {
		if (count >= size) break;
		// A roar as a reserve goes in, so the player sees the next one coming
		if (e.brain.squadTime > 1) w.effects.push({ kind: 'roar', x: e.x, y: e.y, age: 0, life: 0.4, radius: 36, lift: 36 });
		setRole(e, 'assault');
		count++;
	}
}

function setRole(e: Enemy, role: SquadRole) {
	const b = e.brain;
	if (b.squad === role) return;
	b.squad = role;
	b.squadTime = 0;
	b.goalTimer = 0; // rethink straight away
	if (role === 'reserve') b.engaged = false;
	else b.think = 0; // sent in: act on it now
}
