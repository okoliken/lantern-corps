// Construct definitions: pure data.
//
// Every construct, preset or (in M8) made in the Ring Forge, is one of a
// fixed set of BEHAVIORS. The behavior decides what it does; the numbers
// decide how strong it is; the `shape` decides what it looks like. A
// Forge "AK-47" and the preset Minigun are both `rapid`, just with
// different names, shapes and stats.

import type { LanternId } from '../lanterns';

export type Behavior =
	| 'beam' // hold: a continuous line of energy
	| 'rapid' // hold: fast stream of small projectiles
	| 'heavy' // press: one slow, big projectile with a splash
	| 'slash' // press: quick close-range arc
	| 'smash' // press: big wind-up hit that sends things flying
	| 'barrier' // press: place a wall that blocks movement
	| 'grab' // press: fire a tether that pulls a target in
	| 'trap' // press: place a cage that catches whatever walks in
	| 'area' // press: shockwave all around you
	| 'shield' // press: bubble shield on yourself or an ally
	| 'snipe' // hold to charge, release: a piercing shot through a whole line
	| 'turret' // press: build a turret that fights on its own
	| 'pillars' // press: a warning circle, then pillars slam down and stun
	| 'volley' // press: a fan of homing missiles
	| 'boomerang' // press: throw something that cuts on the way out AND back
	| 'dash' // press: fly straight through enemies in a burst of speed
	| 'spread' // press: a short-range blast of pellets
	| 'mine' // press: place a mine that blows up when an enemy comes close
	| 'heal'; // press: a station that heals Lanterns standing in it

/** Drawing style for a construct. Forge constructs will add their own. */
export type ConstructShape =
	| 'beam'
	| 'minigun'
	| 'cannon'
	| 'sword'
	| 'fist'
	| 'wall'
	| 'chain'
	| 'cage'
	| 'shockwave'
	| 'bubble'
	| 'bolt'
	| 'sniper'
	| 'turret'
	| 'pillars'
	| 'hammer'
	| 'rockets'
	| 'saw'
	| 'jet'
	| 'shotgun'
	| 'mine'
	| 'aid';

export interface ConstructDef {
	id: string;
	name: string;
	/** Short label for the HUD slot, if the name is too long. */
	short?: string;
	/**
	 * How this construct looks and is named in SPACE, when its planet form
	 * depends on the ground (a wall standing on it, pillars falling onto it).
	 * Same key, same job, same numbers: only the form changes.
	 */
	space?: { name: string; short?: string };
	behavior: Behavior;
	shape: ConstructShape;
	/** Willpower per use. For `beam` it's per second. */
	cost: number;
	/** Seconds between uses. For `rapid` it's the time between shots. */
	cooldown: number;
	/** Damage per hit. For `beam` it's per second. */
	damage: number;
	/** Push strength in px/s given to things it hits. */
	knockback: number;
	/**
	 * Main size number, meaning depends on behavior:
	 * beam/rapid/heavy/grab: reach · slash/area: radius · smash: punch distance
	 * barrier: wall length · trap: placement distance
	 */
	range: number;
	/** Projectile speed (rapid, heavy, grab). */
	speed?: number;
	/** Splash radius (heavy), catch radius (trap), fist radius (smash). */
	radius?: number;
	/** Wind-up before a smash lands, in seconds. */
	windup?: number;
	/** How long a wall/trap lasts, or how long a trap holds its catch. */
	duration?: number;
	/** How much damage a wall or turret can take. */
	hp?: number;
	/** Sniper: seconds to reach full charge. Pillars: warning time before they land. */
	charge?: number;
	/** Pillar Drop and Warhammer: how long enemies are stunned. */
	stun?: number;
	/** How many at once: missiles in a volley, pellets in a spread. */
	count?: number;
	/** Aid Station: health per second for Lanterns inside. */
	heal?: number;
}

export const CONSTRUCTS = {
	beam: {
		id: 'beam', name: 'Beam', behavior: 'beam', shape: 'beam',
		cost: 10, cooldown: 0, damage: 80, knockback: 0, range: 420
	},
	minigun: {
		id: 'minigun', name: 'Minigun', behavior: 'rapid', shape: 'minigun',
		cost: 0.6, cooldown: 0.08, damage: 5, knockback: 30, range: 460, speed: 950
	},
	cannon: {
		id: 'cannon', name: 'Cannon', behavior: 'heavy', shape: 'cannon',
		cost: 10, cooldown: 0.9, damage: 34, knockback: 420, range: 520, speed: 540, radius: 60
	},
	sword: {
		id: 'sword', name: 'Sword', behavior: 'slash', shape: 'sword',
		cost: 3, cooldown: 0.3, damage: 16, knockback: 160, range: 75
	},
	fist: {
		id: 'fist', name: 'Giant Fist', short: 'Fist', behavior: 'smash', shape: 'fist',
		cost: 10, cooldown: 0.8, damage: 38, knockback: 560, range: 70, radius: 42, windup: 0.16
	},
	wall: {
		id: 'wall', name: 'Energy Wall', short: 'Wall', space: { name: 'Force Field', short: 'Field' }, behavior: 'barrier', shape: 'wall',
		cost: 15, cooldown: 1.2, damage: 0, knockback: 0, range: 120, duration: 25, hp: 300
	},
	chain: {
		id: 'chain', name: 'Chain', behavior: 'grab', shape: 'chain',
		cost: 6, cooldown: 0.7, damage: 6, knockback: 0, range: 340, speed: 1000
	},
	cage: {
		id: 'cage', name: 'Cage', space: { name: 'Snare Field', short: 'Snare' }, behavior: 'trap', shape: 'cage',
		cost: 12, cooldown: 1.5, damage: 0, knockback: 0, range: 100, radius: 40, duration: 7
	},
	shockwave: {
		id: 'shockwave', name: 'Shockwave', behavior: 'area', shape: 'shockwave',
		cost: 20, cooldown: 2.5, damage: 22, knockback: 480, range: 150
	},
	// damage = full-charge damage; a quick tap does about a third
	sniper: {
		id: 'sniper', name: 'Sniper Rifle', short: 'Sniper', behavior: 'snipe', shape: 'sniper',
		cost: 12, cooldown: 0.5, damage: 110, knockback: 220, range: 900, charge: 0.9
	},
	// range = how far ahead it's built; duration/hp before John's durability
	turret: {
		id: 'turret', name: 'Auto-Turret', short: 'Turret', space: { name: 'Sentry Drone', short: 'Drone' }, behavior: 'turret', shape: 'turret',
		cost: 18, cooldown: 1.5, damage: 9, knockback: 60, range: 60, speed: 900,
		duration: 14, hp: 80, radius: 360
	},
	// range = furthest target distance; radius = impact area; charge = warning time
	pillars: {
		id: 'pillars', name: 'Pillar Drop', short: 'Pillars', space: { name: 'Vice Crush', short: 'Crush' }, behavior: 'pillars', shape: 'pillars',
		cost: 16, cooldown: 2.2, damage: 40, knockback: 120, range: 320, radius: 75, charge: 0.55, stun: 1.5
	},

	// ---- Hal: more ways to hit hard and fast ----
	// Swung overhead and brought down just ahead: hits everything there and dazes it
	hammer: {
		id: 'hammer', name: 'Warhammer', short: 'Hammer', behavior: 'smash', shape: 'hammer',
		cost: 14, cooldown: 1.6, damage: 42, knockback: 260, range: 80, radius: 62, windup: 0.32, stun: 1
	},
	// Four missiles fanned out, each homing in on a target ahead
	rockets: {
		id: 'rockets', name: 'Rocket Pod', short: 'Rockets', behavior: 'volley', shape: 'rockets',
		cost: 16, cooldown: 2.4, damage: 16, knockback: 200, range: 600, speed: 480, radius: 40, count: 4
	},
	// Thrown out, and comes back: cuts through everything both ways
	buzzsaw: {
		id: 'buzzsaw', name: 'Buzzsaw', behavior: 'boomerang', shape: 'saw',
		cost: 8, cooldown: 1.1, damage: 14, knockback: 120, range: 320, speed: 620, radius: 14
	},
	// A test pilot's move: a burst of speed straight through the enemy line (can't be hurt while it lasts)
	afterburner: {
		id: 'afterburner', name: 'Afterburner', short: 'Burn', behavior: 'dash', shape: 'jet',
		cost: 10, cooldown: 2.5, damage: 24, knockback: 380, range: 260, speed: 900
	},
	shotgun: {
		id: 'shotgun', name: 'Shotgun', behavior: 'spread', shape: 'shotgun',
		cost: 6, cooldown: 0.8, damage: 7, knockback: 70, range: 260, speed: 900, count: 7
	},

	// ---- John: engineering ----
	// range = how far ahead it's placed; radius = blast; duration = how long it waits
	mines: {
		id: 'mines', name: 'Mines', behavior: 'mine', shape: 'mine',
		cost: 8, cooldown: 0.8, damage: 40, knockback: 340, range: 70, radius: 60, duration: 45
	},
	// A field medic's station: Lanterns standing in it heal
	aid: {
		id: 'aid', name: 'Aid Station', short: 'Aid', space: { name: 'Med Beacon', short: 'Beacon' }, behavior: 'heal', shape: 'aid',
		cost: 25, cooldown: 12, damage: 0, knockback: 0, range: 40, radius: 110, duration: 10, heal: 8
	}
} satisfies Record<string, ConstructDef>;

export type ConstructId = keyof typeof CONSTRUCTS;

/** The name a construct goes by where you are: its space form in space, otherwise its normal name. */
export function constructLabel(def: ConstructDef, inSpace: boolean): { name: string; short: string } {
	const form = inSpace && def.space ? def.space : def;
	return { name: form.name, short: form.short ?? form.name };
}

/**
 * The ring's basic shot: green bolts in a double tap ("pum-pum ... pum-pum"),
 * on their own button. FREE: it costs no willpower and works even when
 * exhausted, so a Lantern can always fight back. Constructs are the special
 * moves that cost willpower.
 */
export const RING_SHOT: ConstructDef = {
	id: 'ringShot',
	name: 'Ring Shot',
	behavior: 'rapid',
	shape: 'bolt',
	cost: 0,
	/** Rest after each double tap. With the gap, a little under four bolts a second. */
	cooldown: 0.42,
	damage: 10,
	knockback: 60,
	range: 520,
	speed: 820
};
/** Bolts per tap, and the seconds between them. A tap always fires the whole burst. */
export const RING_SHOT_BURST = 2;
export const RING_SHOT_GAP = 0.11;

/**
 * Every Lantern can raise a bubble shield, on its own key rather than a
 * slot. It goes on you, or on the ally you've locked onto, and soaks up
 * damage until it breaks or runs out.
 */
export const BUBBLE_SHIELD: ConstructDef = {
	id: 'bubble',
	name: 'Bubble Shield',
	behavior: 'shield',
	shape: 'bubble',
	cost: 12,
	cooldown: 1,
	damage: 0,
	knockback: 0,
	/** Furthest away an ally can be and still get the shield. */
	range: 450,
	duration: 12,
	hp: 120
};

/** Hold-to-use behaviors. Everything else fires once per key press. */
export const HELD_BEHAVIORS: ReadonlySet<Behavior> = new Set(['beam', 'rapid']);

/** Structures: things you build and leave in the world. John is cheaper at these. */
export const STRUCTURE_BEHAVIORS: ReadonlySet<Behavior> = new Set(['barrier', 'trap', 'turret', 'mine', 'heal']);

/** Ten slots each, on keys 1-9 and 0. */
export const LOADOUTS: Record<LanternId, ConstructId[]> = {
	// Test pilot: fast, aggressive, up close
	hal: ['beam', 'minigun', 'sword', 'fist', 'chain', 'hammer', 'rockets', 'buzzsaw', 'afterburner', 'shotgun'],
	// Marine and architect: precision, fortification, engineering
	john: ['beam', 'sniper', 'wall', 'turret', 'pillars', 'cannon', 'cage', 'shockwave', 'mines', 'aid']
};

/** How many traps a single Lantern can have out at once. */
export const MAX_TRAPS_PER_PLAYER = 3;
/** Mines out at once per Lantern (placing another replaces the oldest). */
export const MAX_MINES_PER_PLAYER = 4;
/** How many auto-turrets a single Lantern can have out at once. */
export const MAX_TURRETS_PER_PLAYER = 2;
