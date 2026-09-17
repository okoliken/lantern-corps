// Targeting: the ring knows what you mean to hit or protect.
//
//  - AUTO TARGET: with nothing locked, the ring picks the nearest enemy in
//    front of you (the way you're facing). If there's no enemy, a nearby
//    breakable object. Attacks aim straight at it.
//  - LOCK ON: the Target key locks onto something and cycles through
//    everything in range: enemies first, then allies, then objects, then
//    back to no lock.
//  - PROTECT: lock onto an ally and your bubble shield goes on them instead
//    of you (attacks keep auto-targeting enemies).
//
// Training dummies stand in for enemies until Manhunters arrive in M5.

import { isStanding, type Dummy } from './dummy';
import type { Obstacle } from './map';
import type { Player } from './player';

export type Target =
	| { kind: 'enemy'; dummy: Dummy }
	| { kind: 'object'; obstacle: Obstacle }
	| { kind: 'ally'; player: Player };

export interface TargetWorld {
	dummies: readonly Dummy[];
	obstacles: readonly Obstacle[];
	players: readonly Player[];
}

/** You can lock onto things this far away. Locks break a bit beyond it. */
export const LOCK_RANGE = 600;
/** Auto-target looks this far ahead for enemies... */
export const AUTO_RANGE = 460;
/** ...and this far for breakable objects (so crates don't steal your aim across the map). */
export const AUTO_OBJECT_RANGE = 220;
/** Auto-target only considers things within this angle either side of where you face. */
export const AUTO_HALF_ANGLE = (70 * Math.PI) / 180;

export function targetPosition(t: Target): [number, number] {
	switch (t.kind) {
		case 'enemy':
			return [t.dummy.x, t.dummy.y];
		case 'ally':
			return [t.player.x, t.player.y];
		case 'object':
			return [t.obstacle.x + t.obstacle.w / 2, t.obstacle.y + t.obstacle.h / 2];
	}
}

/** Still there to be targeted? (Not broken, not destroyed.) */
export function isTargetValid(t: Target, w: TargetWorld): boolean {
	switch (t.kind) {
		case 'enemy':
			return isStanding(t.dummy);
		case 'ally':
			return w.players.includes(t.player);
		case 'object':
			return w.obstacles.includes(t.obstacle);
	}
}

export function sameTarget(a: Target | null, b: Target | null): boolean {
	if (!a || !b || a.kind !== b.kind) return false;
	return targetRef(a) === targetRef(b);
}

const targetRef = (t: Target) => (t.kind === 'enemy' ? t.dummy : t.kind === 'ally' ? t.player : t.obstacle);

const distanceTo = (p: Player, t: Target) => {
	const [x, y] = targetPosition(t);
	return Math.hypot(x - p.x, y - p.y);
};

/** Everything lockable in range, in cycle order: enemies, allies, objects; nearest first within each. */
export function lockCandidates(p: Player, w: TargetWorld): Target[] {
	const byDistance = (a: Target, b: Target) => distanceTo(p, a) - distanceTo(p, b);
	const inRange = (t: Target) => distanceTo(p, t) <= LOCK_RANGE;

	const enemies: Target[] = w.dummies.filter(isStanding).map((dummy) => ({ kind: 'enemy', dummy }));
	const allies: Target[] = w.players.filter((o) => o !== p).map((player) => ({ kind: 'ally', player }));
	const objects: Target[] = w.obstacles
		.filter((o) => o.hp !== undefined && o.kind !== 'wall')
		.map((obstacle) => ({ kind: 'object', obstacle }));

	return [enemies, allies, objects].flatMap((group) => group.filter(inRange).sort(byDistance));
}

/** Target key: lock onto the next thing, or let go after the last one. */
export function cycleLock(p: Player, w: TargetWorld) {
	const list = lockCandidates(p, w);
	if (list.length === 0) {
		p.lock = null;
		return;
	}
	const current = list.findIndex((t) => sameTarget(t, p.lock));
	// Not locked (or lock not in the list any more): start at the first.
	// Locked on the last one: unlock.
	p.lock = current === -1 ? list[0] : (list[current + 1] ?? null);
}

/** Is (x, y) in front of the player, within `range`? */
function inFront(p: Player, x: number, y: number, range: number): boolean {
	const dx = x - p.x;
	const dy = y - p.y;
	const dist = Math.hypot(dx, dy);
	if (dist > range) return false;
	if (dist < 20) return true;
	const cos = (dx * p.faceX + dy * p.faceY) / dist;
	return cos >= Math.cos(AUTO_HALF_ANGLE);
}

/** The nearest enemy in front of you; failing that, the nearest breakable object in front. */
export function findAutoTarget(p: Player, w: TargetWorld): Target | null {
	let best: Target | null = null;
	let bestDist = Infinity;
	for (const d of w.dummies) {
		if (!isStanding(d) || !inFront(p, d.x, d.y, AUTO_RANGE)) continue;
		const dist = Math.hypot(d.x - p.x, d.y - p.y);
		if (dist < bestDist) {
			best = { kind: 'enemy', dummy: d };
			bestDist = dist;
		}
	}
	if (best) return best;

	for (const o of w.obstacles) {
		if (o.hp === undefined || o.kind === 'wall') continue;
		const [x, y] = [o.x + o.w / 2, o.y + o.h / 2];
		if (!inFront(p, x, y, AUTO_OBJECT_RANGE)) continue;
		const dist = Math.hypot(x - p.x, y - p.y);
		if (dist < bestDist) {
			best = { kind: 'object', obstacle: o };
			bestDist = dist;
		}
	}
	return best;
}

/**
 * One tick of targeting, after movement and before constructs.
 * Sets p.attackTarget, p.protectTarget and the ring's aim.
 */
export function updateTargeting(p: Player, cyclePressed: boolean, w: TargetWorld) {
	// Locks break when the target is gone or you've moved well away from it
	if (p.lock && (!isTargetValid(p.lock, w) || distanceTo(p, p.lock) > LOCK_RANGE * 1.25)) p.lock = null;
	if (cyclePressed) cycleLock(p, w);

	const lockedAttack = p.lock && p.lock.kind !== 'ally' ? p.lock : null;

	// While a construct is running, stick with the current auto target so the
	// beam doesn't jump between two dummies standing side by side.
	const busy = p.firing || p.actionTimer > 0;
	const keepAuto =
		busy && p.attackTarget && !lockedAttack && isTargetValid(p.attackTarget, w) && distanceTo(p, p.attackTarget) <= AUTO_RANGE;

	p.attackTarget = lockedAttack ?? (keepAuto ? p.attackTarget : findAutoTarget(p, w));
	p.protectTarget = p.lock?.kind === 'ally' ? p.lock : null;

	// Aim: at the attack target if there is one, otherwise where you face
	if (p.attackTarget) {
		const [tx, ty] = targetPosition(p.attackTarget);
		const dx = tx - p.x;
		const dy = ty - p.y;
		const len = Math.hypot(dx, dy);
		if (len > 1) {
			p.aimX = dx / len;
			p.aimY = dy / len;
		}
		// Turn to face what you're attacking while you're attacking it
		if (busy && Math.abs(dx) > 4) p.dir = dx > 0 ? 1 : -1;
	} else {
		p.aimX = p.faceX;
		p.aimY = p.faceY;
	}
}
