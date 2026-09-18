// A Player is one Lantern in the world, driven by one InputSource.

import { CONSTRUCTS, LOADOUTS, type ConstructDef } from './constructs/defs';
import type { InputSource, Intent } from './input';
import type { LanternDef } from './lanterns';
import type { Target } from './targeting';
import { approach, boxOverlap, moveBody, type Solid } from './physics';
import { MAX_WILLPOWER } from './willpower';
import { PLAYER_MAX_HEALTH } from './combat';
import { STANDING_HEIGHT } from './animation';

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
	/** Drawn facing, easing toward `dir` so turning around takes a moment instead of snapping. */
	facing: number;
	/** Seconds left facing the aim after attacking, before turning back to the way you move. */
	aimHold: number;
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
	/**
	 * Where the ring is relative to the anchor, in world px: `ringDX` across,
	 * `ringLift` up. The Game sets these from the animated skeleton each tick,
	 * so shots, beams and punches start exactly at the ring.
	 */
	ringDX: number;
	ringLift: number;
	/**
	 * Where the body is drawn: its bottom and top, in px above the anchor
	 * (the Game keeps these up to date). Enemy shots hit what they're drawn
	 * touching, so a Lantern flying high isn't hit by bolts passing under them.
	 */
	bodyBottom: number;
	bodyTop: number;
	/** How far away the mouse crosshair is (world px), or null when not mouse aiming. */
	aimReach: number | null;

	// ---- Targeting (see targeting.ts) ----
	/** What the Target key has locked onto, if anything. */
	lock: Target | null;
	/** What attacks aim at this tick: the lock, or an automatic pick. */
	attackTarget: Target | null;
	/** Who the bubble shield goes on: a locked ally, or null for yourself. */
	protectTarget: Target | null;

	// ---- Willpower ----
	// ---- Health (see combat.ts) ----
	health: number;
	maxHealth: number;
	/** Seconds of invulnerability left (just hit, or just got back up). */
	invuln: number;
	/** Seconds since they last took damage (health regenerates after a while). */
	sinceHurt: number;
	/** Seconds until a downed Lantern gets back up. */
	downTimer: number;

	/** 0..maxWillpower. Powers every construct. */
	willpower: number;
	/** 100, plus the Willpower upgrade. */
	maxWillpower: number;
	/** Recovery speed multiplier from the Recovery upgrade. */
	regenMultiplier: number;
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
	/** Sniper Rifle charge, 0..1, while the construct button is held. */
	charge: number;
	/** Seconds left on a one-shot action's arm pose (swing, punch, throw). */
	actionTimer: number;
	/** Which construct that action was, for drawing. */
	actionShape: ConstructDef['shape'] | null;
	/** Seconds until the bubble shield can be cast again. */
	shieldCooldown: number;
	/** Seconds until the next free ring shot. */
	shotCooldown: number;
	/** Ring shots fired so far in the current double-tap. */
	burstShots: number;

	// ---- Signature ability (see constructs/signature.ts) ----
	/** 0..SURGE_MAX. Fills as you fight; full = signature ability ready. */
	surge: number;
	/** Hal's Jet Strike in progress: flying on rails along (dx, dy). */
	dash: Dash | null;

	// ---- Animation timers (drive poses; see animation.ts) ----
	/** Seconds left on ring-shot recoil. */
	shotTimer: number;
	/** Seconds left on the flinch from being hit (enemies arrive in M5). */
	hurtTimer: number;
	/** Knocked down (M5). */
	downed: boolean;
	/** Seconds into a victory pose, or 0 (missions, M6). */
	victoryTimer: number;
}

export interface Dash {
	/** Hal's Jet Strike (signature), or the Afterburner construct. */
	kind: 'jet' | 'burn';
	dx: number;
	dy: number;
	speed: number;
	/** Seconds of dash left. */
	time: number;
	/** Set when something solid stops the dash early. */
	blocked: boolean;
	/** Things already hit, so each is only hit once per dash. */
	hit: object[];
	/** Afterburner: what it does to anything in the way. */
	damage?: number;
	knockback?: number;
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
/** Moving away from the way you face (backing off while shooting) is slower. */
export const BACKPEDAL_SPEED_FACTOR = 0.8;
/** Seconds to turn all the way around. */
export const TURN_TIME = 0.12;
/** After attacking, keep facing the aim this long (so steady fire doesn't flip you back and forth). */
export const AIM_HOLD_TIME = 0.45;
/** Seconds to rise from the ground to full height (and back down). */
export const TAKEOFF_TIME = 0.35;
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
		facing: 1,
		aimHold: 0,
		walkPhase: 0,
		flying: false,
		altitude: 0,
		faceX: 1,
		faceY: 0,
		aimX: 1,
		aimY: 0,
		ringDX: 0,
		ringLift: 0,
		bodyBottom: 0,
		bodyTop: STANDING_HEIGHT * 1.35,
		aimReach: null,
		lock: null,
		attackTarget: null,
		protectTarget: null,
		shieldCooldown: 0,
		shotCooldown: 0,
		burstShots: 0,
		surge: 0,
		dash: null,
		shotTimer: 0,
		hurtTimer: 0,
		downed: false,
		victoryTimer: 0,
		health: PLAYER_MAX_HEALTH,
		maxHealth: PLAYER_MAX_HEALTH,
		sinceHurt: 99,
		invuln: 0,
		downTimer: 0,
		willpower: MAX_WILLPOWER,
		maxWillpower: MAX_WILLPOWER,
		regenMultiplier: 1,
		exhausted: false,
		recoverDelay: 0,
		charging: false,
		loadout,
		selected: 0,
		cooldowns: loadout.map(() => 0),
		firing: false,
		beamLength: 0,
		charge: 0,
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

	// ---- Downed: no control, just sliding to a stop from the knockback ----
	if (p.downed) {
		const keep = Math.exp(-6 * dt);
		p.vx *= keep;
		p.vy *= keep;
		moveBody(p, dt, p.flying ? world.solids.filter((s) => s.blocksFlying) : world.solids, FEET_HALF_W, FEET_HALF_H);
		p.walkPhase = 0;
		return;
	}

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

	// ---- Jet Strike: flying on rails, input ignored ----
	if (p.dash) {
		const d = p.dash;
		p.vx = d.dx * d.speed;
		p.vy = d.dy * d.speed;
		// The jet flies over everything; an Afterburner on foot still hits buildings
		const low = d.kind === 'burn' && !p.flying;
		moveBody(p, dt, low ? world.solids : world.solids.filter((s) => s.blocksFlying), FEET_HALF_W, FEET_HALF_H);
		// Collisions zero the velocity: that means we hit something tall
		if (Math.hypot(p.vx, p.vy) < d.speed * 0.5) d.blocked = true;
		if (d.dx !== 0) p.dir = d.dx > 0 ? 1 : -1;
		p.walkPhase = 0;
		return;
	}

	// ---- Steering ----
	const { accel, decel } = p.def;
	const moving = intent.moveX !== 0 || intent.moveY !== 0;
	const backpedal = p.aimHold > 0 && intent.moveX * p.dir < -0.3;
	const maxSpeed =
		p.def.maxSpeed *
		(p.flying ? FLY_SPEED_BONUS : 1) *
		(p.firing ? FIRING_SPEED_FACTOR : 1) *
		(backpedal ? BACKPEDAL_SPEED_FACTOR : 1);

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

	// Face the way you move. Only left/right input flips the character: moving
	// straight up or down keeps whichever way they were already facing. Right
	// after attacking they keep facing the aim instead (targeting.ts).
	p.aimHold = Math.max(0, p.aimHold - dt);
	if (intent.moveX !== 0 && p.aimHold === 0) p.dir = intent.moveX > 0 ? 1 : -1;

	// Facing follows movement. Input is already normalized. The ring's aim
	// starts here too; targeting may then point it at a target instead.
	if (moving) {
		p.faceX = intent.moveX;
		p.faceY = intent.moveY;
	}
	p.aimX = p.faceX;
	p.aimY = p.faceY;

	// Walking legs cycle faster the faster you go, and run backwards when
	// backing away from the way you face. Flying Lanterns don't walk.
	const speed = Math.hypot(p.vx, p.vy);
	const stepDir = p.vx * p.dir < -20 ? -1 : 1;
	p.walkPhase = !p.flying && speed > 5 ? p.walkPhase + stepDir * speed * dt * 0.045 : 0;
}

/** Ease the drawn facing toward `dir`, so turning around is a quick turn rather than a flip. */
export function updateFacing(p: Player, dt: number) {
	const step = (2 * dt) / TURN_TIME;
	p.facing = p.facing < p.dir ? Math.min(p.dir, p.facing + step) : Math.max(p.dir, p.facing - step);
}

/** Half the width of a Lantern's drawn body. */
const BODY_HALF_W = 13;

/** Is a shot at (x, y) on the ground plane, drawn `lift` px up, touching the Lantern's drawn body? */
export function hitsBody(p: Player, x: number, y: number, lift: number): boolean {
	if (Math.abs(x - p.x) > BODY_HALF_W) return false;
	const drawnY = y - lift;
	return drawnY >= p.y - p.bodyTop && drawnY <= p.y - p.bodyBottom + 6;
}

/** Where a shot flying at `lift` has to go (on the ground plane) to hit the middle of the Lantern's body. */
export function bodyAim(p: Player, lift: number): { x: number; y: number } {
	return { x: p.x, y: p.y - (p.bodyBottom + p.bodyTop) / 2 + lift };
}

/** Keep a player inside a rectangle, killing velocity into the edge. */
export function clampToBounds(p: Player, minX: number, minY: number, maxX: number, maxY: number) {
	if (p.x < minX) { p.x = minX; p.vx = Math.max(p.vx, 0); }
	if (p.x > maxX) { p.x = maxX; p.vx = Math.min(p.vx, 0); }
	if (p.y < minY) { p.y = minY; p.vy = Math.max(p.vy, 0); }
	if (p.y > maxY) { p.y = maxY; p.vy = Math.min(p.vy, 0); }
}
