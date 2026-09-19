// Targeting: the ring knows what you mean to hit or protect.
//
//  - MOUSE AIM: shots go where the crosshair points. Aim assist nudges them
//    onto an enemy only if it's right along that line.
//  - KEYBOARD / PAD AIM: with nothing locked, the ring finds the enemy to
//    shoot ALL AROUND you (you don't have to face them: backing away while
//    shooting works). It prefers whoever is in front, whoever is attacking
//    you, and whoever it's already shooting, and only picks what you can SEE.
//    With no enemy about, a breakable object ahead; else straight where you face.
//  - LOCK ON: the Target key locks onto something and cycles through
//    everything in range: enemies first, then allies, then objects, then
//    back to no lock.
//  - PROTECT: lock onto an ally and your bubble shield goes on them instead
//    of you (attacks keep auto-targeting enemies).
//
// Training dummies stand in for enemies until Manhunters arrive in M5.

import { castBeam } from './beam';
import type { ConstructDef } from './constructs/defs';
import { aimPoint, isStanding, type Dummy } from './dummy';
import type { Obstacle } from './map';
import { AIM_HOLD_TIME, type Player } from './player';

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
/** Auto-target looks at most this far for enemies (about a ring shot's reach)... */
export const AUTO_RANGE = 600;
/** ...and this far for breakable objects (so crates don't steal your aim across the map). */
export const AUTO_OBJECT_RANGE = 220;

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

/**
 * How far auto-target should look for the construct in hand. A sword can't
 * hit something across the street, so it shouldn't aim there.
 */
export function autoReach(def: ConstructDef): number {
	switch (def.behavior) {
		case 'slash':
			return def.range + 45;
		case 'smash':
			return def.range + (def.radius ?? 40) + 35;
		case 'area':
			return def.range;
		case 'barrier':
			return 260;
		case 'trap':
			return 320;
		case 'turret':
			return 300;
		case 'pillars':
			return def.range + (def.radius ?? 0);
		case 'snipe':
			return AUTO_RANGE;
		default:
			return Math.min(AUTO_RANGE, def.range);
	}
}

/**
 * Can the player see (x, y)? Checked against each obstacle's whole on-screen
 * silhouette (its footprint plus the height drawn above it), not just the
 * footprint. Otherwise something standing "behind" a building, hidden under
 * its roof on screen, would still count as visible and pull your aim onto
 * it. `except` is the target itself; energy walls don't block your view.
 */
export function hasLineOfSight(p: Player, x: number, y: number, w: TargetWorld, except?: Obstacle): boolean {
	const dx = x - p.x;
	const dy = y - p.y;
	const dist = Math.hypot(dx, dy);
	if (dist < 1) return true;
	const silhouettes = w.obstacles
		.filter((o) => o !== except && o.kind !== 'wall')
		.map((o) => ({ x: o.x, y: o.y - o.height, w: o.w, h: o.h + o.height, blocksFlying: o.blocksFlying }));
	const { hit } = castBeam(p.x, p.y, dx / dist, dy / dist, silhouettes, dist);
	return hit === null;
}

/** Keyboard aiming: breakable objects are only auto-targeted within this angle of where you face (enemies anywhere). */
export const KEYBOARD_HALF_ANGLE = (30 * Math.PI) / 180;
/** All-around auto-aim: an enemy right behind you counts as this much further away than one in front... */
const BEHIND_COST = 0.6;
/** ...one attacking you as this much nearer... */
const THREAT_PULL = 0.75;
/** ...and the one you're already shooting as this much nearer, so the aim doesn't flick between two. */
const KEEP_PULL = 0.7;
/** Mouse aim assist: snap only to something this close to the crosshair direction. */
export const ASSIST_HALF_ANGLE = (12 * Math.PI) / 180;
/** A thumb on a phone's stick is far less exact than a mouse: it snaps onto anything this close to where it points. */
export const STICK_ASSIST_HALF_ANGLE = (30 * Math.PI) / 180;

/** Is (x, y) within `range` and within `halfAngle` of the direction (dirX, dirY)? */
function inCone(p: Player, x: number, y: number, range: number, dirX: number, dirY: number, halfAngle: number): boolean {
	const dx = x - p.x;
	const dy = y - p.y;
	const dist = Math.hypot(dx, dy);
	if (dist > range) return false;
	if (dist < 20) return true;
	return (dx * dirX + dy * dirY) / dist >= Math.cos(halfAngle);
}

export interface AutoTargetOptions {
	/** Direction to look in (unit vector). Defaults to where the player faces. */
	dirX?: number;
	dirY?: number;
	/** How wide to look either side of that direction. Omitted: enemies all around (keyboard and pad aim). */
	halfAngle?: number;
	/** The current target: kept unless something is clearly better. */
	current?: Target | null;
}

/** Where on the ground plane a shot from this Lantern's ring has to go to hit the enemy's body. */
const enemyAim = (p: Player, d: Dummy): [number, number] => aimPoint(d, p.ringLift);

/**
 * The enemy to shoot. With a cone (mouse aim assist): the nearest visible one
 * in it. Without (keyboard and pad): the best visible one all around, nearest
 * first but leaning toward whoever is in front, whoever is attacking you, and
 * the current target. No enemy: the nearest visible breakable object ahead.
 */
export function findAutoTarget(p: Player, w: TargetWorld, reach = AUTO_RANGE, opts: AutoTargetOptions = {}): Target | null {
	const { dirX = p.faceX, dirY = p.faceY, halfAngle, current = null } = opts;
	const allAround = halfAngle === undefined;
	let best: Target | null = null;
	let bestScore = Infinity;
	for (const d of w.dummies) {
		if (!isStanding(d) || !hasLineOfSight(p, d.x, d.y, w)) continue;
		const dist = Math.hypot(d.x - p.x, d.y - p.y);
		let score = dist;
		if (allAround) {
			if (dist > reach) continue;
			const ahead = dist > 1 ? ((d.x - p.x) * dirX + (d.y - p.y) * dirY) / dist : 1;
			score *= 1 + BEHIND_COST * ((1 - ahead) / 2);
			const brain = (d as { brain?: { target: Player | null } }).brain;
			if (brain?.target === p) score *= THREAT_PULL;
			if (current?.kind === 'enemy' && current.dummy === d) score *= KEEP_PULL;
		} else {
			// The cone is checked against where the shot would go to hit its body, not its feet
			const [ax, ay] = enemyAim(p, d);
			if (!inCone(p, ax, ay, reach, dirX, dirY, halfAngle) && !inCone(p, d.x, d.y, reach, dirX, dirY, halfAngle)) continue;
		}
		if (score < bestScore) {
			best = { kind: 'enemy', dummy: d };
			bestScore = score;
		}
	}
	if (best) return best;

	// Breakable things only ahead of you: nothing blasts a car behind you just because it's there
	let bestDist = Infinity;
	for (const o of w.obstacles) {
		if (o.hp === undefined || o.kind === 'wall') continue;
		const [x, y] = [o.x + o.w / 2, o.y + o.h / 2];
		const range = Math.min(reach, AUTO_OBJECT_RANGE);
		if (!inCone(p, x, y, range, dirX, dirY, halfAngle ?? KEYBOARD_HALF_ANGLE) || !hasLineOfSight(p, x, y, w, o)) continue;
		const dist = Math.hypot(x - p.x, y - p.y);
		if (dist < bestDist) {
			best = { kind: 'object', obstacle: o };
			bestDist = dist;
		}
	}
	return best;
}

export interface TargetingOptions {
	/** Mouse position in world coordinates, or null when not aiming with a mouse. */
	pointer?: { x: number; y: number } | null;
	/** Let mouse aim snap to an enemy right next to the crosshair. */
	aimAssist?: boolean;
	/** The pointer comes from the phone pad's right stick: snap onto enemies roughly that way. */
	stickAim?: boolean;
}

/**
 * One tick of targeting, after movement and before constructs.
 * Sets p.attackTarget, p.protectTarget and the ring's aim.
 * `reach` is how far auto-target looks: see autoReach().
 *
 * Aim, in order of priority:
 *  1. A locked target (Tab).
 *  2. MOUSE: straight at the crosshair, nudged onto an enemy only if one sits
 *     right along that line (aim assist).
 *  3. KEYBOARD / PAD: the best visible enemy all around you (see
 *     findAutoTarget), otherwise straight where you face.
 */
export function updateTargeting(
	p: Player,
	cyclePressed: boolean,
	w: TargetWorld,
	reach = AUTO_RANGE,
	{ pointer = null, aimAssist = true, stickAim = false }: TargetingOptions = {}
) {
	// Locks break when the target is gone or you've moved well away from it
	if (p.lock && (!isTargetValid(p.lock, w) || distanceTo(p, p.lock) > LOCK_RANGE * 1.25)) p.lock = null;
	if (cyclePressed) cycleLock(p, w);

	p.protectTarget = p.lock?.kind === 'ally' ? p.lock : null;
	const lockedAttack = p.lock && p.lock.kind !== 'ally' ? p.lock : null;
	const busy = p.firing || p.actionTimer > 0 || p.shotTimer > 0;
	// Attacking turns you toward the aim, and you keep facing it for a moment
	if (busy) p.aimHold = AIM_HOLD_TIME;

	if (lockedAttack) {
		p.attackTarget = lockedAttack;
		p.aimReach = null;
	} else if (pointer) {
		// Aim from the ring, so the shot's line passes exactly through the crosshair
		const dx = pointer.x - (p.x + p.ringDX);
		const dy = pointer.y - p.y;
		const len = Math.hypot(dx, dy);
		p.aimReach = len;
		const dirX = len > 1 ? dx / len : p.faceX;
		const dirY = len > 1 ? dy / len : p.faceY;
		p.attackTarget = aimAssist || stickAim ? findAutoTarget(p, w, reach, { dirX, dirY, halfAngle: stickAim ? STICK_ASSIST_HALF_ANGLE : ASSIST_HALF_ANGLE }) : null;
		if (!p.attackTarget) {
			p.aimX = dirX;
			p.aimY = dirY;
		}
		// With a mouse, the character looks toward the crosshair while attacking
		// (and just after), or while standing still. Otherwise they face the
		// way they're moving (player.ts), so walking away means turning away.
		const still = Math.abs(p.vx) < 30;
		if ((p.aimHold > 0 || still) && Math.abs(dx) > 4) p.dir = dx > 0 ? 1 : -1;
	} else {
		p.aimReach = null;
		// While a construct is running, stick with the current auto target so
		// the beam doesn't jump between two dummies standing side by side.
		const keep = busy && p.attackTarget && isTargetValid(p.attackTarget, w) && distanceTo(p, p.attackTarget) <= reach;
		p.attackTarget = keep ? p.attackTarget : findAutoTarget(p, w, reach, { current: p.attackTarget });
		if (!p.attackTarget) {
			p.aimX = p.faceX;
			p.aimY = p.faceY;
		}
	}

	// Aim at the attack target, if there is one (an enemy's body, at the ring's height)
	if (p.attackTarget) {
		const [tx, ty] = p.attackTarget.kind === 'enemy' ? enemyAim(p, p.attackTarget.dummy) : targetPosition(p.attackTarget);
		const dx = tx - (p.x + p.ringDX);
		const dy = ty - p.y;
		const len = Math.hypot(dx, dy);
		if (len > 1) {
			p.aimX = dx / len;
			p.aimY = dy / len;
		}
		// Turn to face what you're attacking while you're attacking it
		if (busy && Math.abs(dx) > 4) p.dir = dx > 0 ? 1 : -1;
	}
}
