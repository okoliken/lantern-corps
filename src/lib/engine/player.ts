// A Player is one Lantern in the world, driven by one InputSource.

import { CONSTRUCTS, LOADOUTS, type ConstructDef } from './constructs/defs';
import type { InputSource, Intent } from './input';
import type { LanternDef } from './lanterns';
import type { Target } from './targeting';
import { approach, boxOverlap, moveBody, type Solid } from './physics';
import { MAX_WILLPOWER } from './willpower';

export type { Solid } from './physics';

export interface Player {
	/** 0 = player 1, 1 = player 2. */
	slot: number;
	def: LanternDef;
	input: InputSource;
	/** Anchor position: the feet when walking, the spot below them when flying. */
	x: number;
	y: number;
	/** Position at the start of the last tick, used to smooth rendering. */
	prevX: number;
	prevY: number;
	vx: number;
	vy: number;
	/** Which way the Lantern faces on screen: 1 = right, -1 = left. */
	dir: 1 | -1;
	/** Advances while walking; drives the leg swing animation. Always 0 in the air. */
	walkPhase: number;
	/** Off the ground (or heading there). In space this is always true. */
	flying: boolean;
	/** 0 = on the ground, 1 = fully airborne. Eases between them on take-off/landing. */
	altitude: number;
	/** Direction you last moved in (unit vector). */
	faceX: number;
	faceY: number;
	/** Direction the ring points: at the target if there is one, otherwise where you face. */
	aimX: number;
	aimY: number;

	// ---- Targeting (see targeting.ts) ----
	/** What the Target key has locked onto, if anything. */
	lock: Target | null;
	/** What attacks aim at this tick: the lock, or an automatic pick. */
	attackTarget: Target | null;
	/** Who the bubble shield goes on: a locked ally, or null for yourself. */
	protectTarget: Target | null;

	// ---- Willpower ----
	/** 0..MAX_WILLPOWER. Powers every construct. */
	willpower: number;
	/** Ran dry; nothing works until recovered to RESTART_THRESHOLD. */
	exhausted: boolean;
	/** Seconds until passive recovery starts. */
	recoverDelay: number;
	/** Drawing power from a Lantern battery this tick (for drawing the link). */
	charging: boolean;

	// ---- Constructs ----
	/** The five constructs on this Lantern's slots. */
	loadout: ConstructDef[];
	/** Index into loadout of the construct in hand. */
	selected: number;
	/** Seconds left before each slot can be used again. */
	cooldowns: number[];
	/** A hold-to-use construct (beam, minigun) is running right now. */
	firing: boolean;
	/** How far the beam reached this tick (for drawing). */
	beamLength: number;
	/** Seconds left on a one-shot action's arm pose (swing, punch, throw). */
	actionTimer: number;
	/** Which construct that action was, for drawing. */
	actionShape: ConstructDef['shape'] | null;
	/** Seconds until the bubble shield can be cast again. */
	shieldCooldown: number;
	/** Seconds until the next free ring shot. */
	shotCooldown: number;
}

/** What the player needs to know about the world to move through it. */
export interface WorldRules {
	solids: readonly Solid[];
	/** Space: no landing allowed. */
	alwaysFlying: boolean;
}

const OPEN_WORLD: WorldRules = { solids: [], alwaysFlying: false };

/** Flying is faster than walking. */
export const FLY_SPEED_BONUS = 1.25;
/** Holding the beam or minigun steady slows you down. */
export const FIRING_SPEED_FACTOR = 0.55;
/** Seconds to rise from the ground to full height (and back down). */
export const TAKEOFF_TIME = 0.25;
/** The collision box around a Lantern's anchor (their feet): 16 x 10 px. */
export const FEET_HALF_W = 8;
export const FEET_HALF_H = 5;

export function createPlayer(slot: number, def: LanternDef, input: InputSource, x: number, y: number): Player {
	const loadout = LOADOUTS[def.id].map((id) => CONSTRUCTS[id]);
	return {
		slot,
		def,
		input,
		x,
		y,
		prevX: x,
		prevY: y,
		vx: 0,
		vy: 0,
		dir: 1,
		walkPhase: 0,
		flying: false,
		altitude: 0,
		faceX: 1,
		faceY: 0,
		aimX: 1,
		aimY: 0,
		lock: null,
		attackTarget: null,
		protectTarget: null,
		shieldCooldown: 0,
		shotCooldown: 0,
		willpower: MAX_WILLPOWER,
		exhausted: false,
		recoverDelay: 0,
		charging: false,
		loadout,
		selected: 0,
		cooldowns: loadout.map(() => 0),
		firing: false,
		beamLength: 0,
		actionTimer: 0,
		actionShape: null
	};
}

/** Does a feet box centred at (x, y) overlap this solid? Touching edges don't count. */
export function feetOverlap(x: number, y: number, s: Solid): boolean {
	return boxOverlap(x, y, FEET_HALF_W, FEET_HALF_H, s);
}

/**
 * One tick of movement. Pure apart from mutating `p`, and takes the Intent as
 * an argument instead of reading input itself, which keeps it easy to test.
 */
export function updatePlayer(p: Player, intent: Intent, dt: number, world: WorldRules = OPEN_WORLD) {
	p.prevX = p.x;
	p.prevY = p.y;

	// ---- Take off / land ----
	if (world.alwaysFlying) {
		p.flying = true;
	} else if (intent.toggleFly) {
		if (!p.flying) {
			p.flying = true;
		} else if (!world.solids.some((s) => feetOverlap(p.x, p.y, s))) {
			// Only land on open ground. Landing on a building would trap you inside it.
			p.flying = false;
		}
	}
	p.altitude = approach(p.altitude, p.flying ? 1 : 0, dt / TAKEOFF_TIME);

	// ---- Steering ----
	const { accel, decel } = p.def;
	const maxSpeed = p.def.maxSpeed * (p.flying ? FLY_SPEED_BONUS : 1) * (p.firing ? FIRING_SPEED_FACTOR : 1);
	const moving = intent.moveX !== 0 || intent.moveY !== 0;

	// Steer velocity toward where the input points. Speeding up uses accel,
	// coasting to a stop uses decel. That gives a slight "flying" feel
	// instead of instant start/stop.
	const rate = (moving ? accel : decel) * dt;
	p.vx = approach(p.vx, intent.moveX * maxSpeed, rate);
	p.vy = approach(p.vy, intent.moveY * maxSpeed, rate);

	// ---- Moving, with collisions ----
	// Flyers only bump into things tall enough to block the sky.
	const blocking = p.flying ? world.solids.filter((s) => s.blocksFlying) : world.solids;
	moveBody(p, dt, blocking, FEET_HALF_W, FEET_HALF_H);

	// Only left/right input flips the character. Moving straight up or down
	// keeps whichever way they were already facing.
	if (intent.moveX !== 0) p.dir = intent.moveX > 0 ? 1 : -1;

	// Facing follows movement. Input is already normalized. The ring's aim
	// starts here too; targeting may then point it at a target instead.
	if (moving) {
		p.faceX = intent.moveX;
		p.faceY = intent.moveY;
	}
	p.aimX = p.faceX;
	p.aimY = p.faceY;

	// Walking legs cycle faster the faster you go. Flying Lanterns don't walk.
	const speed = Math.hypot(p.vx, p.vy);
	p.walkPhase = !p.flying && speed > 5 ? p.walkPhase + speed * dt * 0.045 : 0;
}

/** Keep a player inside a rectangle, killing velocity into the edge. */
export function clampToBounds(p: Player, minX: number, minY: number, maxX: number, maxY: number) {
	if (p.x < minX) { p.x = minX; p.vx = Math.max(p.vx, 0); }
	if (p.x > maxX) { p.x = maxX; p.vx = Math.min(p.vx, 0); }
	if (p.y < minY) { p.y = minY; p.vy = Math.max(p.vy, 0); }
	if (p.y > maxY) { p.y = maxY; p.vy = Math.min(p.vy, 0); }
}
