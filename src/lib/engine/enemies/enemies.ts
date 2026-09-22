// Enemies: a target body (dummy.ts) plus a BRAIN that decides what to do.
//
// Every enemy thinks for itself. Each one has:
//  - a PERSONALITY (aggression, caution, patience) rolled when it spawns,
//  - EYES and a MEMORY (tactics.ts): it only chases what it can see, goes
//    to look where it last saw you, and calls nearby allies when it spots you,
//  - GOALS (tactics.ts): hold its range, close in, flank round behind you,
//    hide behind cover and peek out, wait for an opening, back off when hurt,
//  - REFLEXES: it can sidestep your shots, if it's quick and careful enough.
//
// The brain loops through:
//
//   idle ──(sees a Lantern)──▶ move ──(picks a construct)──▶ windup ──▶ act ──▶ recover ─┐
//                               ▲                                                       │
//                               └───────────────────────────────────────────────────────┘
//
// Attacks take turns (director.ts): only a couple can be coming at one
// Lantern at once, with a beat between them. Every construct has a WINDUP
// with a visible tell, so players can dodge, shield or interrupt it. Enough
// damage during a windup staggers the enemy.

import type { ConstructWorld } from '../constructs/system';
import { DUMMY_HALF_W, isStanding, type Dummy, type TargetKind } from '../dummy';
import { bodyAim, type Player } from '../player';
import { attackStarted, mayAttack, updatePressure, type Attacker } from './director';
import { ABILITIES, RED_HAND_LIFT, SWOOP_HEIGHT, cancelAbility, startAbility, updateAbility, updateRedConstructs, type AbilityDef, type AbilityId, RAGE_VS_SHIELD, randomKit } from './redConstructs';
import { flyShip } from './ships';
import { updateSquads, type SquadRole } from './squad';
import { chooseGoal, clearShot, navigate, perceive, tryDodge, wander, type Goal } from './tactics';

export type EnemyKind = Exclude<TargetKind, 'dummy' | 'spaceRock' | 'rageTorpedo' | 'manhunterCore' | 'signalSpire' | 'rageBubble'>;
export type EnemyState = 'idle' | 'move' | 'windup' | 'act' | 'recover';
export type Role = 'berserker' | 'hunter' | 'gunner';
/** How a faction thinks: rage never backs down and gets faster when hurt; machines stay cold and regroup. */
export type Mind = 'rage' | 'machine';
/** Enemy art is drawn red; a tint recolors it: a sparring Lantern's green, Gorilla City tech amber, Grodd's psychic purple. */
export type Tint = 'corps' | 'tech' | 'psychic';

export interface EnemyDef {
	kind: EnemyKind;
	name: string;
	/** 'corps': a Green Lantern sparring with you (Kilowog); his constructs are drawn green. 'gorilla': Grodd's army. */
	faction: 'red' | 'manhunter' | 'corps' | 'gorilla' | 'rogue';
	/** Its constructs and effects are drawn in this colour instead of red. */
	tint?: Tint;
	/** One line for the codex and lab. */
	description: string;
	mind: Mind;
	hp: number;
	/** Top speed (px/s) before role, personality and rage. */
	speed: number;
	/** How quickly it reaches its desired velocity (higher = snappier). */
	accel: number;
	/** Notices Lanterns within this range. */
	sight: number;
	/** Damage it can take in quick succession before being staggered out of a windup. */
	poise: number;
	/** Drawing size multiplier. */
	scale: number;
	/** How good it is at sidestepping shots (0 never, 1 as often as its personality allows). */
	agility: number;
	/** Hovers and moves any way like a Lantern, flies like a ship (always forward, turning), or stays put (a turret). */
	movement: 'hover' | 'ship' | 'static';
	/** A fixed kit. Without one it's a Rage Grunt: its ROLE picks the kit, range and leanings. */
	kit?: AbilityId[];
	/** Favourite fighting distance (enemies with a fixed kit). */
	range?: number;
	/** Personality leanings (enemies with a fixed kit). */
	leans?: Partial<Personality>;
	/** Ships: how fast they turn, in radians per second. */
	turnRate?: number;
	/** A named character from the show: its name shows above it, and it's announced when it arrives. */
	lieutenant?: boolean;
	/** Transforms into a bigger, angrier form once this hurt (0..1). */
	transformAt?: number;
	/** Burns out after this many seconds (built constructs, like a Rage Turret). */
	lifetime?: number;
}

/** The colour an enemy's constructs are drawn in, if not red. */
export const tintOf = (e: { kind: EnemyKind }): Tint | undefined => ENEMIES[e.kind].tint;

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
	rageGrunt: {
		kind: 'rageGrunt',
		name: 'Rage Grunt',
		faction: 'red',
		description:
			"Atrocitus's foot soldiers: aliens from every corner of the universe, chosen by the red ring for their rage. Hulking Rage Brutes charge in, four-armed Rage Stalkers chain and flank, big-headed Rage Spitters blast from range.",
		mind: 'rage',
		hp: 120,
		speed: 150,
		accel: 5,
		sight: 640,
		poise: 34,
		scale: 1,
		agility: 0.7,
		movement: 'hover'
	},
	// A flying robot: the Guardians' first peacekeepers. Cold logic, not rage.
	manhunterDrone: {
		kind: 'manhunterDrone',
		name: 'Manhunter Drone',
		faction: 'manhunter',
		description:
			"The Guardians' first peacekeepers, built to hunt. A flying robot with one burning eye: laser bolts, a sweeping laser, and a pulse that shoves you away. Drones gang up on one target and pull back to regroup when damaged.",
		mind: 'machine',
		hp: 140,
		speed: 140,
		accel: 4,
		sight: 700,
		poise: 44,
		scale: 1,
		agility: 0.35,
		movement: 'hover',
		kit: ['eyeLaser', 'sweep', 'pulse'],
		range: 280,
		leans: { caution: 0.2, patience: 0.3 }
	},
	// A Red Lantern warship from Atrocitus's fleet
	redFighter: {
		kind: 'redFighter',
		name: 'Red Lantern Fighter',
		faction: 'red',
		description:
			'A small, fast Red Lantern warship. It lines up on you for strafing runs, drops rage bombs as it flies over, then loops round for another pass. It never stops moving, so get out of its line.',
		mind: 'rage',
		hp: 90,
		speed: 250,
		accel: 3,
		sight: 820,
		poise: 60,
		scale: 1,
		agility: 0,
		movement: 'ship',
		kit: ['strafe', 'bombs'],
		range: 320,
		turnRate: 2.1,
		leans: { aggression: 0.3 }
	},

	// ---- Friendly sparring: the Corps' drill sergeant ----
	kilowog: {
		kind: 'kilowog',
		name: 'Kilowog',
		faction: 'corps',
		tint: 'corps',
		description:
			"The Corps' drill sergeant, and the biggest Lantern you'll ever meet. He loves a hammer: a giant one brought down with a shockwave, a hammer cyclone, thrown hammers that come back, hammers raining from the sky, and a fist the size of a car.",
		mind: 'rage',
		hp: 1800,
		speed: 140,
		accel: 3,
		sight: 900,
		poise: 300,
		scale: 1.2,
		agility: 0.25,
		movement: 'hover',
		kit: ['bigHammer', 'hammerSpin', 'hammerThrow', 'hammerRain', 'bigFist', 'charge', 'roar'],
		range: 150,
		leans: { aggression: 0.3, caution: -0.2 },
		lieutenant: true
	},
	sinestro: {
		kind: 'sinestro',
		name: 'Sinestro',
		faction: 'corps',
		tint: 'corps',
		description:
			"The greatest Lantern in the Corps, and he knows it. Fast, precise and merciless: sword lunges, fans of blades that land where you're going, a storm of blades in every direction, cages, a beam, and a giant fist.",
		mind: 'rage',
		hp: 2200,
		speed: 185,
		accel: 5,
		sight: 1000,
		poise: 340,
		scale: 1.12,
		agility: 0.75,
		movement: 'hover',
		kit: ['sword', 'bladeFan', 'bladeStorm', 'bigFist', 'cage', 'beam'],
		range: 210,
		leans: { aggression: 0.5, caution: -0.3, patience: -0.3 },
		lieutenant: true
	},

	// ---- Lieutenants: Atrocitus's inner circle, from the animated series ----
	zox: {
		kind: 'zox',
		name: 'Zilius Zox',
		faction: 'red',
		description:
			"A round, grinning Red Lantern who is mostly mouth. He floods the ground with napalm, bounces in for belly slams, and laughs at you the whole time.",
		mind: 'rage',
		hp: 520,
		speed: 115,
		accel: 3.5,
		sight: 680,
		poise: 90,
		scale: 1.25,
		agility: 0.2,
		movement: 'hover',
		kit: ['vomit', 'slam', 'blast', 'spikes', 'redTurret'],
		range: 190,
		leans: { aggression: 0.25, patience: -0.1 },
		lieutenant: true
	},
	skallox: {
		kind: 'skallox',
		name: 'Skallox',
		faction: 'red',
		description:
			'A horned brute who smashes through walls with his charge. Hurt him badly and he TRANSFORMS into a bigger, faster monster, so finish him fast or get ready for round two.',
		mind: 'rage',
		hp: 780,
		speed: 105,
		accel: 3,
		sight: 620,
		poise: 140,
		scale: 1.3,
		agility: 0.1,
		movement: 'hover',
		kit: ['charge', 'claws', 'roar', 'slam', 'mace'],
		range: 150,
		leans: { aggression: 0.4, caution: -0.3 },
		lieutenant: true,
		transformAt: 0.5
	},
	bleez: {
		kind: 'bleez',
		name: 'Bleez',
		faction: 'red',
		description:
			'Fast and cruel, on torn black wings. She circles out of reach, hurls blood spears, climbs high and dives straight through you, and is hard to pin down with shots.',
		mind: 'rage',
		hp: 400,
		speed: 185,
		accel: 5,
		sight: 720,
		poise: 70,
		scale: 1.05,
		agility: 1,
		movement: 'hover',
		kit: ['swoop', 'spears', 'claws', 'cage', 'redShield'],
		range: 240,
		leans: { caution: 0.3, aggression: 0.2 },
		lieutenant: true
	},

	// A cat. A Red Lantern cat. Small, very fast, and never where you're aiming
	dexStarr: {
		kind: 'dexStarr',
		name: 'Dex-Starr',
		faction: 'red',
		description:
			"A blue house cat from Earth whose rage drew a Red Lantern ring. Small, fast and hard to hit: he darts in with rage claws, dives out of the air, spits blood napalm and throws spears of rage. Calls himself a good kitty. He is not.",
		mind: 'rage',
		hp: 520,
		speed: 240,
		accel: 6,
		sight: 900,
		poise: 60,
		scale: 1,
		agility: 1,
		movement: 'hover',
		kit: ['swoop', 'claws', 'vomit', 'spears', 'redShield'],
		range: 220,
		leans: { caution: 0.2, aggression: 0.4 },
		lieutenant: true
	},

	// Act 1's boss: Atrocitus's lieutenant. His kit grows as the fight goes on (the mission sets it)
	razer: {
		kind: 'razer',
		name: 'Razer',
		faction: 'red',
		description:
			"Atrocitus's lieutenant, and the angriest Red Lantern of them all: grief turned to rage. He fights up close with twin blades, throws curving chakrams, shatters Green Lantern constructs, and brands Lanterns so their rings go dark.",
		mind: 'rage',
		hp: 2600,
		speed: 245,
		accel: 7,
		sight: 1000,
		poise: 320,
		scale: 1.08,
		agility: 1,
		movement: 'hover',
		kit: ['twinBlades', 'chakram', 'chain', 'redShield'],
		range: 150,
		leans: { aggression: 0.85, caution: -0.4 },
		lieutenant: true
	},

	// ---- Gorilla Grodd's army (Act 2): soldiers from Gorilla City, their tech glowing amber ----
	gorillaBrute: {
		kind: 'gorillaBrute',
		name: 'Gorilla Soldier',
		faction: 'gorilla',
		tint: 'tech',
		description:
			"One of Grodd's soldiers from Gorilla City: four hundred pounds of armored gorilla with power gauntlets. It charges, leaps in to pound the ground, and punches hard enough to throw you across the street.",
		mind: 'rage',
		hp: 230,
		speed: 140,
		accel: 5,
		sight: 700,
		poise: 70,
		scale: 1.15,
		agility: 0.35,
		movement: 'hover',
		kit: ['claws', 'charge', 'slam', 'roar'],
		range: 120,
		leans: { aggression: 0.45, caution: -0.25 }
	},
	gorillaGunner: {
		kind: 'gorillaGunner',
		name: 'Gorilla Trooper',
		faction: 'gorilla',
		tint: 'tech',
		description:
			'A Gorilla City trooper with a heavy energy rifle. It keeps its distance, fires bursts and cannon shells, throws up energy barricades, and calls down mortar fire.',
		mind: 'rage',
		hp: 170,
		speed: 120,
		accel: 5,
		sight: 760,
		poise: 50,
		scale: 1.05,
		agility: 0.55,
		movement: 'hover',
		kit: ['blast', 'cannon', 'redWall', 'meteors'],
		range: 320,
		leans: { caution: 0.3, patience: 0.2 }
	},
	// Act 2's first villain: a telepathic gorilla with an army (his kit is set by the mission)
	grodd: {
		kind: 'grodd',
		name: 'Gorilla Grodd',
		faction: 'gorilla',
		tint: 'psychic',
		description:
			'The smartest gorilla alive, and a telepath: psychic blasts that go straight through a bubble shield, mind control that turns your moves around, and cars thrown with a thought. Up close he is still a gorilla the size of a truck.',
		mind: 'rage',
		hp: 2400,
		speed: 160,
		accel: 5,
		sight: 1000,
		poise: 320,
		scale: 1.45,
		agility: 0.4,
		movement: 'hover',
		kit: ['mindBlast', 'mindLock', 'carThrow', 'claws', 'slam', 'charge'],
		range: 220,
		leans: { aggression: 0.5, caution: -0.2 },
		lieutenant: true
	},
	// The Flash's nemesis, along with Grodd for one reason: to end the Flash
	reverseFlash: {
		kind: 'reverseFlash',
		name: 'Reverse-Flash',
		faction: 'rogue',
		description:
			"Eobard Thawne: everything the Flash can do, turned against him. He runs in at a blur, pins his target for a beatdown faster than they can fall, and throws red lightning. He's here for the Flash, and turns on anyone else only when the Flash is down.",
		mind: 'rage',
		hp: 1500,
		speed: 600,
		accel: 12,
		sight: 1200,
		poise: 220,
		scale: 1,
		agility: 1,
		movement: 'hover',
		kit: ['rfBlitz', 'rfBeatdown', 'rfLightning'],
		range: 190,
		leans: { aggression: 0.8, caution: -0.3 },
		lieutenant: true
	},
	// The Guardians' first peacekeepers, woken under Central City: it rebuilds itself when destroyed
	manhunter: {
		kind: 'manhunter',
		name: 'Manhunter',
		faction: 'manhunter',
		description:
			"A Manhunter android, one of the Guardians' first peacekeepers, asleep under the Earth for thousands of years. Eye lasers, a sweeping beam, a pulse that throws you back, and fists of steel. Break it and it rebuilds itself, unless you destroy its core.",
		mind: 'machine',
		hp: 1500,
		speed: 150,
		accel: 4,
		sight: 1000,
		poise: 260,
		scale: 1.3,
		agility: 0.3,
		movement: 'hover',
		kit: ['eyeLaser', 'sweep', 'pulse', 'claws', 'slam'],
		range: 230,
		leans: { aggression: 0.4, caution: -0.3 },
		lieutenant: true
	},

	manhunterPrime: {
		kind: 'manhunterPrime',
		name: 'Manhunter Prime',
		faction: 'manhunter',
		description:
			'The first Manhunter: the mind every other one was copied from, buried deepest of all. It watches how you fight. At each stage it takes the construct you have leaned on most: your ring can no longer make it, and it can. Keep changing what you use. Broken, it rebuilds round its core like the rest.',
		mind: 'machine',
		hp: 2600,
		speed: 165,
		accel: 4,
		sight: 1400,
		poise: 700,
		scale: 2,
		agility: 0.25,
		movement: 'hover',
		kit: ['eyeLaser', 'sweep', 'pulse', 'claws', 'slam', 'charge'],
		range: 260,
		leans: { aggression: 0.6, caution: -0.4 },
		lieutenant: true
	},

	// Built by a Red Lantern (the Rage Turret construct): stays put, shoots, burns out
	rageTurret: {
		kind: 'rageTurret',
		name: 'Rage Turret',
		faction: 'red',
		description: 'A spiked red turret a Red Lantern built. It fires rage bolts at the nearest Lantern until it is broken or burns out.',
		mind: 'rage',
		hp: 90,
		speed: 0,
		accel: 20,
		sight: 520,
		poise: 999,
		scale: 1,
		agility: 0,
		movement: 'static',
		kit: ['blast'],
		range: 420,
		lifetime: 14
	}
};

export interface RoleDef {
	name: string;
	/** The kind of creature that fights this way (draw/creatures.ts). */
	species: string;
	description: string;
	/** Its default kit (random kits are built per enemy with randomKit). */
	abilities: AbilityId[];
	/** Distance it keeps from its target while not in close. */
	range: number;
	/** Speed and health multipliers. */
	speed: number;
	hp: number;
	/** Personality leanings, added to the random roll. */
	leans: Partial<Personality>;
}

export const ROLES: Record<Role, RoleDef> = {
	berserker: {
		name: 'Berserker',
		species: 'Rage Brute',
		description: 'Charges in with Rage Claws, leaps into a Rage Slam, and roars to blow apart shields and turrets.',
		abilities: ['roar', 'slam', 'claws'],
		range: 150,
		speed: 1.1,
		hp: 1.1,
		leans: { aggression: 0.3, caution: -0.2 }
	},
	hunter: {
		name: 'Hunter',
		species: 'Rage Stalker',
		description: 'Circles to your flank, drags you in with a Barbed Chain, then goes for the claws.',
		abilities: ['chain', 'claws'],
		range: 200,
		speed: 1.05,
		hp: 1,
		leans: { aggression: 0.15, patience: 0.2 }
	},
	gunner: {
		name: 'Gunner',
		species: 'Rage Spitter',
		description: 'Hangs back and strafes, hides behind cover and pops out to fire bursts of Rage Blasts and Rage Saws.',
		abilities: ['saw', 'blast'],
		range: 290,
		speed: 0.9,
		hp: 0.85,
		leans: { caution: 0.3, aggression: -0.15 }
	}
};

export const ROLE_LIST: Role[] = ['berserker', 'hunter', 'gunner'];

/** How many enemies can be in close, clawing, on one Lantern at a time. */
export const MELEE_SLOTS = 2;
/** How far a Rage Shield can be thrown: far enough for a reserve to reach the attackers. */
const RED_SHIELD_REACH = 450;
/** Rage Turrets out at once, across the whole pack. */
export const MAX_RED_TURRETS = 2;
/** Enemies closer than this push apart, so a pack surrounds you instead of stacking. */
export const ENEMY_SPACING = 34;

/** Rolled per enemy, 0..1 each, so no two in a pack act the same. */
export interface Personality {
	/** Wants to be in your face: closes in, flanks, takes the first opening. */
	aggression: number;
	/** Careful: dodges more, uses cover, backs off (machines) when hurt. */
	caution: number;
	/** Sticks with a plan longer before changing its mind. */
	patience: number;
}

export interface EnemyBrain {
	role: Role;
	persona: Personality;
	/** The red constructs this particular enemy can use. */
	kit: AbilityId[];
	/** Damage multiplier: how strong this enemy is. */
	might: number;
	/** Lanterns already hit by the current Rage Charge. */
	struck: Player[];
	state: EnemyState;
	/** The construct being wound up or used. */
	ability: AbilityId | null;
	/** Seconds left in the current windup / act / recover. */
	timer: number;
	/** Seconds since the current act started. */
	elapsed: number;
	/** Seconds before each construct can be used again. */
	cooldowns: Record<AbilityId, number>;
	target: Player | null;
	/** Direction the construct is aimed. Melee locks it at the start of the windup. */
	aimX: number;
	aimY: number;
	/** A spot on the ground picked at the start of the windup (where a Rage Slam lands). */
	markX: number;
	markY: number;
	/** 0..1: how hurt it is. Rage makes Red Lanterns faster and more relentless (machines don't get angry: 0). */
	rage: number;
	/** 0..1: how hurt it is, whatever it's made of. */
	hurt: number;
	/** The current attack already dealt its damage. */
	hitDone: boolean;
	/** Shots fired so far in this act (Rage Blast bursts). */
	fired: number;
	/** Holds one of its target's melee slots. */
	engaged: boolean;
	/** Seconds backing off before it tries to get in close again. */
	breather: number;
	/** Seconds until its next decision. */
	think: number;
	/** How long this enemy takes to make decisions (its own personality). */
	reaction: number;
	/** Personal speed multiplier, so a pack doesn't move in lockstep. */
	speedMul: number;
	/** Angle around the target this enemy is holding (spread out by the pack). */
	orbit: number;
	/** Which way it circles: 1 or -1. Flips now and then. */
	strafe: 1 | -1;
	/** Recent damage, drains over time. Past the enemy's poise it's staggered. */
	poise: number;
	lastHp: number;
	/** 0..1 height off the ground during a Rage Slam leap. */
	air: number;
	/** Poise multiplier: tougher enemies (co-op lab packs, scenes) are harder to stagger too. */
	grit: number;
	/** Times each construct has been used, so it mixes them up rather than repeating one. */
	uses: Record<AbilityId, number>;

	// ---- Tactics (tactics.ts) ----
	/** What it's trying to do while moving. */
	goal: Goal;
	/** Seconds before it reconsiders its goal. */
	goalTimer: number;
	/** Where the goal is taking it (cover spot, last-seen spot, wander spot). */
	goalX: number;
	goalY: number;
	/** Can it see its target right now? */
	sees: boolean;
	/** Where it last saw its target, and how many seconds ago. */
	lastSeenX: number;
	lastSeenY: number;
	seenAgo: number;
	/** Seconds until it looks around again (sight checks aren't free). */
	lookIn: number;
	/** Seconds of being on alert: it was hit, or an ally called out. Hunts the nearest Lantern even unseen. */
	alert: number;
	/** Seconds before it can try to dodge again. */
	dodgeIn: number;
	/** Seconds since it last took damage. */
	sinceHit: number;
	/** The Lantern who last hurt it, and how many seconds ago: it holds a grudge. */
	grudge: Player | null;
	grudgeAgo: number;
	/** Seconds on its current target: it gets restless and looks for someone else. */
	focusTime: number;
	/** Its target is chosen for it (a boss fight decides when it turns on whom): it keeps it until they go down. */
	directed: boolean;
	/** Its own clock, for idle drift and bobbing. */
	clock: number;

	/** Fighting now, or held back until the squad leader sends it in (squad.ts). */
	squad: SquadRole;
	/** Seconds in its current squad role. */
	squadTime: number;

	/** Transformed into its bigger form (Skallox), and how far into it (0..1, for drawing). */
	transformed: boolean;
	form: number;

	/** The ally it's about to put a Rage Shield on. */
	ally: Enemy | null;
	/** Seconds before it burns out (built constructs); Infinity for everyone else. */
	lifeLeft: number;

	// ---- Ships (ships.ts) ----
	/** Which way the ship's nose points (radians). */
	heading: number;
	/** Seconds left flying straight on after an attack run, before looping round. */
	pass: number;
}

/** An enemy: a target body with a brain. */
export interface Enemy extends Dummy {
	kind: EnemyKind;
	brain: EnemyBrain;
}

export function isEnemy(d: Dummy): d is Enemy {
	return d.kind !== 'dummy' && 'brain' in d;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function rollPersonality(leans: Partial<Personality>, rand: () => number): Personality {
	return {
		aggression: clamp01(rand() * 0.8 + 0.1 + (leans.aggression ?? 0)),
		caution: clamp01(rand() * 0.8 + 0.1 + (leans.caution ?? 0)),
		patience: clamp01(rand() * 0.8 + 0.1 + (leans.patience ?? 0))
	};
}

export function createEnemy(
	kind: EnemyKind,
	x: number,
	y: number,
	role: Role = 'berserker',
	rand = Math.random,
	// Rage Grunts each get a full kit of constructs for their role
	kit: AbilityId[] = ENEMIES[kind].kit ?? (kind === 'rageGrunt' ? randomKit(role, rand) : ROLES[role].abilities)
): Enemy {
	const def = ENEMIES[kind];
	const hp = Math.round(def.hp * (def.kit ? 1 : ROLES[role].hp));
	const leans = def.kit ? (def.leans ?? {}) : ROLES[role].leans;
	// A short, slightly different grace period on every construct, so a pack
	// that arrives together doesn't attack together
	const cooldowns = {} as Record<AbilityId, number>;
	const uses = {} as Record<AbilityId, number>;
	for (const id of Object.keys(ABILITIES) as AbilityId[]) {
		cooldowns[id] = 0.8 + rand() * 1.6;
		uses[id] = 0;
	}
	return {
		kind,
		x,
		y,
		prevX: x,
		prevY: y,
		vx: 0,
		vy: 0,
		hp,
		maxHp: hp,
		homeX: x,
		homeY: y,
		caged: 0,
		flash: 0,
		stun: 0,
		down: 0,
		respawns: false,
		gone: false,
		dir: -1,
		brain: {
			role,
			persona: rollPersonality(leans, rand),
			kit: [...kit],
			might: 1,
			struck: [],
			state: 'idle',
			ability: null,
			timer: 0,
			elapsed: 0,
			cooldowns,
			target: null,
			aimX: -1,
			aimY: 0,
			markX: x,
			markY: y,
			rage: 0,
			hurt: 0,
			hitDone: false,
			fired: 0,
			engaged: false,
			breather: 0,
			think: rand() * 0.3,
			reaction: 0.28 + rand() * 0.3,
			speedMul: 0.88 + rand() * 0.24,
			orbit: 0,
			strafe: rand() < 0.5 ? 1 : -1,
			poise: 0,
			lastHp: hp,
			air: 0,
			grit: 1,
			uses,
			goal: 'hold',
			goalTimer: 0,
			goalX: x,
			goalY: y,
			sees: false,
			lastSeenX: x,
			lastSeenY: y,
			seenAgo: 99,
			lookIn: 0,
			alert: 0,
			dodgeIn: rand(),
			sinceHit: 99,
			grudge: null,
			grudgeAgo: 99,
			focusTime: 0,
			directed: false,
			clock: rand() * 100,
			squad: 'assault',
			squadTime: 0,
			ally: null,
			lifeLeft: def.lifetime ?? Infinity,
			transformed: false,
			form: 0,
			heading: Math.PI,
			pass: 0
		}
	};
}

/** The ability an enemy is winding up or using, if any (for the director). */
function attackOf(e: Enemy): AbilityDef | null {
	const b = e.brain;
	return b.ability && (b.state === 'windup' || b.state === 'act') ? ABILITIES[b.ability] : null;
}

/** The distance this enemy likes to fight from. */
export function rangeOf(e: Enemy): number {
	return ENEMIES[e.kind].range ?? ROLES[e.brain.role].range;
}

/** Role speed multiplier (only Rage Grunts have roles). */
export function roleSpeed(e: Enemy): number {
	return ENEMIES[e.kind].kit ? 1 : ROLES[e.brain.role].speed;
}

/** What to call it: the grunt's species, or the enemy's own name. */
export function enemyLabel(e: Enemy): string {
	return ENEMIES[e.kind].kit ? ENEMIES[e.kind].name : ROLES[e.brain.role].species;
}

/** Effects that are already drawn in Corps green (the rest get recolored for a sparring Green Lantern). */
const CORPS_ART: ReadonlySet<string> = new Set(['bigHammer', 'hammerSpin', 'hammerDrop', 'swordArc', 'callout']);
/** Effects that aren't the enemy's art at all (damage numbers, a Lantern's shield popping): never tinted. */
const UNTINTED: ReadonlySet<string> = new Set(['number', 'pop', 'text', 'burst', 'fizzle', 'snap']);

// ------------------------------------------------------------------- brains

/** One tick for every enemy: think, then the red constructs move. Moving the bodies happens in updateDummy. */
export function updateEnemies(w: ConstructWorld, players: readonly Player[], dt: number) {
	const pack = w.dummies.filter((d): d is Enemy => isEnemy(d) && isStanding(d));
	updatePressure(w.pressure, players, dt);
	updateSquads(pack, players, w, dt);
	const attackers: (Attacker & { e: Enemy })[] = pack.map((e) => ({ e, target: e.brain.target, attack: attackOf(e) }));
	for (const e of pack) {
		const before = w.effects.length;
		w.rage = ENEMIES[e.kind].faction === 'red' ? RAGE_VS_SHIELD : 1;
		think(e, pack, attackers, w, players, dt);
		w.rage = 1;
		// A Green Lantern sparring with you makes green constructs, not red ones (and Grodd's army, amber and purple)
		const tint = tintOf(e);
		if (tint) for (let i = before; i < w.effects.length; i++) if (!CORPS_ART.has(w.effects[i].kind) && !UNTINTED.has(w.effects[i].kind)) w.effects[i].tint = tint;
	}
	spreadAround(pack);
	separate(pack, dt);
	updateRedConstructs(w, players, dt);
}

function think(
	e: Enemy,
	pack: readonly Enemy[],
	attackers: (Attacker & { e: Enemy })[],
	w: ConstructWorld,
	players: readonly Player[],
	dt: number
) {
	const def = ENEMIES[e.kind];
	const b = e.brain;
	const tempo = w.redTempo;
	for (const id in b.cooldowns) b.cooldowns[id as AbilityId] = Math.max(0, b.cooldowns[id as AbilityId] - dt * tempo);
	b.breather = Math.max(0, b.breather - dt);
	b.dodgeIn = Math.max(0, b.dodgeIn - dt);
	b.alert = Math.max(0, b.alert - dt);
	b.goalTimer -= dt;
	b.clock += dt;
	b.sinceHit += dt;
	b.grudgeAgo += dt;
	b.focusTime += dt;
	b.hurt = 1 - e.hp / e.maxHp;
	b.rage = def.mind === 'rage' ? b.hurt : 0;

	// Poise: a burst of damage knocks it out of a windup
	const took = Math.max(0, b.lastHp - e.hp);
	b.lastHp = e.hp;
	if (took > 0) {
		b.sinceHit = 0;
		// Getting shot puts it on alert, even if it didn't see who did it
		b.alert = Math.max(b.alert, 4);
	}
	const poise = def.poise * b.grit;
	b.poise = Math.max(0, b.poise - poise * 0.8 * dt) + took;
	if (b.poise >= poise) {
		b.poise = 0;
		if (b.state === 'windup') interrupt(e, w, 0.45);
	}

	// Built constructs burn out
	b.lifeLeft -= dt;
	if (b.lifeLeft <= 0) {
		e.hp = 0;
		e.down = 0.5;
		w.effects.push({ kind: 'redImpact', x: e.x, y: e.y, age: 0, life: 0.4, lift: 30 });
		return;
	}

	// Hurt enough: transform (Skallox). A moment of roaring, then bigger, faster, stronger.
	if (def.transformAt !== undefined && !b.transformed && b.hurt >= def.transformAt) transform(e, w);
	if (b.transformed) b.form = Math.min(1, b.form + dt * 1.5);

	// Caged or stunned: can't act, and whatever it was doing is cancelled
	if (e.caged > 0 || e.stun > 0) {
		if (b.state === 'windup' || b.state === 'act') interrupt(e, w, 0.2);
		b.timer = Math.max(b.timer, 0.2);
		steer(e, 0, 0, def.accel * 2, dt);
		return;
	}

	perceive(e, pack, players, w, dt);
	const t = b.target;

	if (def.movement === 'ship') {
		flyShip(e, t, attackers, w, players, dt);
		syncAttacker(e, attackers);
		return;
	}

	switch (b.state) {
		case 'idle': {
			if (def.movement === 'static') steer(e, 0, 0, def.accel, dt);
			else wander(e, dt);
			if (t) {
				b.state = 'move';
				b.goalTimer = 0;
			}
			break;
		}
		case 'move': {
			if (!t) {
				b.state = 'idle';
				b.engaged = false;
				break;
			}
			if (def.movement === 'static') {
				e.vx = e.vy = 0;
				face(e, t.x - e.x);
			} else {
				if (b.goalTimer <= 0) chooseGoal(e, t, pack, w);
				navigate(e, t, dt, w);
				tryDodge(e, w);
			}
			b.think -= dt;
			// In close, react fast; otherwise on its own personal clock
			const close = b.engaged && Math.hypot(t.x - e.x, t.y - e.y) < 90;
			if (close) b.think = Math.min(b.think, 0.1);
			if (b.think <= 0) {
				b.think = (b.reaction * (0.6 + Math.random() * 0.8)) / tempo;
				decide(e, t, pack, attackers, w, players);
			}
			break;
		}
		case 'windup': {
			steer(e, 0, 0, def.accel * 2, dt);
			const a = ABILITIES[b.ability!];
			// Ranged constructs keep tracking for most of the windup, then lock (so they can be dodged)
			if (t && !a.melee && b.timer > a.windup * 0.3) aimAt(e, aimPointFor(a, t));
			if (t) face(e, t.x - e.x);
			b.timer -= dt;
			// Climbing into the air before a dive
			if (a.id === 'swoop') b.air = SWOOP_HEIGHT * Math.min(1, 1 - b.timer / a.windup);
			if (b.timer <= 0) startAbility(e, w, players);
			break;
		}
		case 'act': {
			if (updateAbility(e, w, players, dt)) {
				const a = ABILITIES[b.ability!];
				b.state = 'recover';
				b.timer = a.recover;
				b.cooldowns[a.id] = a.cooldown * (1 - 0.3 * b.rage) * (0.85 + Math.random() * 0.3);
				// After clawing, often step back and let someone else in
				if (a.melee && Math.random() < 0.6 - 0.3 * b.rage) {
					b.engaged = false;
					b.breather = 1 + Math.random() * 1.5;
				}
				// Rethink after every attack (a careful gunner goes back behind cover)
				b.goalTimer = Math.min(b.goalTimer, 0.3);
			}
			break;
		}
		case 'recover': {
			steer(e, 0, 0, def.accel, dt);
			tryDodge(e, w);
			b.timer -= dt;
			if (b.timer <= 0) {
				b.state = t ? 'move' : 'idle';
				b.ability = null;
				b.think = Math.max(b.think, b.reaction * 0.8);
			}
			break;
		}
	}

	syncAttacker(e, attackers);
}

/** Keep the director's picture of who's attacking up to date. */
function syncAttacker(e: Enemy, attackers: (Attacker & { e: Enemy })[]) {
	const entry = attackers.find((a) => a.e === e);
	if (entry) {
		entry.target = e.brain.target;
		entry.attack = attackOf(e);
	}
}

/** Pick what to do next: maybe ask for a melee slot, maybe start a construct. */
function decide(
	e: Enemy,
	t: Player,
	pack: readonly Enemy[],
	attackers: readonly (Attacker & { e: Enemy })[],
	w: ConstructWorld,
	players: readonly Player[]
) {
	const b = e.brain;
	if (Math.random() < 0.15) b.strafe = b.strafe === 1 ? -1 : 1;
	const dist = Math.hypot(t.x - e.x, t.y - e.y);

	// Melee fighters ask for a spot in close when they mean to go in (or the Lantern is right there)
	const melee = b.kit.some((id) => ABILITIES[id].melee);
	const wantsIn = b.goal === 'approach' || b.goal === 'flank' || dist < 90;
	if (melee && !b.engaged && b.breather === 0 && wantsIn && b.squad === 'assault') {
		const holders = pack.filter((o) => o !== e && o.brain.target === t && o.brain.engaged).length;
		if (holders < MELEE_SLOTS) b.engaged = true;
	}

	if (!b.sees) return;
	// Shields, walls and turrets aren't attacks: no turn needed, and reserves use them too
	if (trySupport(e, t, pack, dist)) return;
	// Held in reserve: no closing in, but it harasses from range while it waits to be sent in
	const reserve = b.squad === 'reserve';

	const me = attackers.find((a) => a.e === e) ?? { target: t, attack: null };
	const range = rangeOf(e);
	// Least-used first (ties keep the kit's order), so each enemy shows off its whole kit
	const order = [...b.kit].sort((x, y) => b.uses[x] - b.uses[y]);
	let blocked = false;
	for (const id of order) {
		const a = ABILITIES[id];
		if (a.band === 'support' || b.cooldowns[id] > 0) continue;
		if (reserve && (a.melee || a.band === 'close')) continue;
		if (dist < a.minRange || dist > a.maxRange + DUMMY_HALF_W) continue;
		if (a.melee && !b.engaged) continue;
		// Ranged fighters with nothing for close up back off to their range before shooting
		if (!melee && a.band !== 'close' && dist < range * 0.7) continue;
		if (id === 'roar' && !roarWorthIt(e, w, players)) continue;
		// Something in the way: don't waste it on a rock, go round
		if (needsClearShot(a) && !clearShot(e, t, w)) {
			blocked = true;
			continue;
		}
		// Wait for a turn to attack this Lantern
		if (!mayAttack(w.pressure, me, t, a, attackers, w.redTempo)) continue;
		if (Math.random() > Math.min(1, a.chance * w.redTempo * (reserve ? RESERVE_EAGERNESS : 1))) continue;
		b.uses[id]++;
		beginWindup(e, id, t);
		attackStarted(w.pressure, t, w.redTempo);
		return;
	}
	// Something's in the way with a shot ready: step out to take it. From
	// cover that's a peek, so it waits a moment first rather than popping
	// straight back out.
	if (blocked && b.goal !== 'flank' && (b.goal !== 'cover' || Math.random() < 0.35)) {
		b.goal = 'flank';
		b.goalTimer = 1.2 + Math.random();
	}
}

/**
 * Support constructs, when they'd help:
 *  - Rage Shield on an ally who's getting hurt (or itself),
 *  - Rage Wall when it's being shot at from range,
 *  - Rage Turret when it's at a distance and there aren't many out already.
 */
function trySupport(e: Enemy, t: Player, pack: readonly Enemy[], dist: number): boolean {
	const b = e.brain;
	// Every Lantern (red or green) can put up a shield, whatever else it carries
	const kit = SHIELDERS.has(e.kind) && !b.kit.includes('redShield') ? [...b.kit, 'redShield' as const] : b.kit;
	for (const id of kit) {
		const a = ABILITIES[id];
		if (a.band !== 'support' || b.cooldowns[id] > 0) continue;
		if (dist < a.minRange || dist > a.maxRange) continue;
		let worth = false;
		if (id === 'redShield') {
			// Someone hurt and still taking hits gets one, the most hurt first; itself before a friend on a tie
			// (rage would rather attack, so it isn't every scratch)
			const underFire = (o: Enemy) => !o.ward && o.brain.sinceHit < 1.5 && o.brain.hurt > 0.2;
			const ally = pack
				.filter((o) => o.kind !== 'rageTurret' && Math.hypot(o.x - e.x, o.y - e.y) < RED_SHIELD_REACH && underFire(o))
				.sort((x, y) => y.brain.hurt - x.brain.hurt + (x === e ? -0.05 : 0) + (y === e ? 0.05 : 0))[0];
			b.ally = ally ?? null;
			worth = ally !== undefined;
		} else if (id === 'redWall') {
			worth = b.sinceHit < 1.5 || (b.goal === 'hold' && Math.random() < 0.25);
		} else if (id === 'redTurret') {
			// Count the ones being built right now too, or two builders could both go over the limit
			const building = pack.filter((o) => o.brain.ability === 'redTurret' && (o.brain.state === 'windup' || o.brain.state === 'act')).length;
			worth = pack.filter((o) => o.kind === 'rageTurret').length + building < MAX_RED_TURRETS;
		}
		if (!worth || Math.random() > a.chance) continue;
		b.uses[id]++;
		beginWindup(e, id, t);
		return true;
	}
	return false;
}

/** Reserves take their ranged shots less often than the assault does. */
const RESERVE_EAGERNESS = 0.55;

/** Lanterns, red or green: they can all raise a shield. Machines, ships and turrets can't. */
const SHIELDERS: ReadonlySet<EnemyKind> = new Set(['rageGrunt', 'zox', 'skallox', 'bleez', 'kilowog', 'sinestro']);

/** Aimed constructs need a clear line; area and self-centred ones don't. */
function needsClearShot(a: AbilityDef): boolean {
	return a.tell === 'aim' && a.id !== 'skulls' && a.id !== 'spikes';
}

/** Roar only when there's something worth blowing away. */
function roarWorthIt(e: Enemy, w: ConstructWorld, players: readonly Player[]): boolean {
	const r = ABILITIES.roar.radius ?? 150;
	const near = (x: number, y: number) => Math.hypot(x - e.x, y - e.y) <= r;
	const lanterns = players.filter((p) => !p.downed && near(p.x, p.y));
	if (lanterns.length === 0) return false;
	if (lanterns.length >= 2 || w.redTempo > 1) return true;
	if (w.turrets.some((t) => near(t.x, t.y))) return true;
	if (lanterns.some((p) => w.shields.some((s) => s.target === p))) return true;
	return e.brain.rage > 0.5;
}

export function beginWindup(e: Enemy, id: AbilityId, t: Player) {
	const b = e.brain;
	const a = ABILITIES[id];
	b.state = 'windup';
	b.ability = id;
	b.timer = a.windup;
	b.hitDone = false;
	b.fired = 0;
	aimAt(e, aimPointFor(a, t));
	// The landing spot, no further than the construct reaches
	const dx = t.x - e.x;
	const dy = t.y - e.y;
	const dist = Math.hypot(dx, dy) || 1;
	const reach = Math.min(dist, a.maxRange);
	b.markX = e.x + (dx / dist) * reach;
	b.markY = e.y + (dy / dist) * reach;
}

function transform(e: Enemy, w: ConstructWorld) {
	const b = e.brain;
	interrupt(e, w, 0.9);
	b.transformed = true;
	b.might *= 1.3;
	b.speedMul *= 1.3;
	b.grit *= 1.4;
	e.stun = 0;
	w.effects.push({ kind: 'roar', x: e.x, y: e.y, age: 0, life: 0.8, radius: 140, lift: 40 });
	w.effects.push({ kind: 'callout', x: e.x, y: e.y - 120, age: 0, life: 1.8, text: `${ENEMIES[e.kind].name.toUpperCase()} TRANSFORMS!`, hurt: true });
}

/**
 * Shots fly at hand height, so aim them at the Lantern's body as drawn (a
 * Lantern flying high over a planet is well above their feet). Everything
 * else (claws, slams, things on the ground) goes for where they stand.
 */
function aimPointFor(a: AbilityDef, t: Player): { x: number; y: number } {
	return a.tell === 'aim' && !a.melee ? bodyAim(t, RED_HAND_LIFT) : t;
}

/** Knocked out of what it was doing: a short stagger. */
function interrupt(e: Enemy, w: ConstructWorld, time: number) {
	const b = e.brain;
	cancelAbility(e, w);
	if (b.ability) b.cooldowns[b.ability] = Math.max(b.cooldowns[b.ability], 1);
	b.state = 'recover';
	b.ability = null;
	b.timer = time;
	b.air = 0;
}

/** Give enemies sharing a target evenly spaced spots around it, in the order they already stand. */
function spreadAround(pack: readonly Enemy[]) {
	const groups = new Map<Player, Enemy[]>();
	for (const e of pack) {
		const t = e.brain.target;
		if (!t) continue;
		const group = groups.get(t) ?? [];
		group.push(e);
		groups.set(t, group);
	}
	for (const [t, group] of groups) {
		const angleOf = (e: Enemy) => Math.atan2(e.y - t.y, e.x - t.x);
		group.sort((a, b) => angleOf(a) - angleOf(b));
		const base = angleOf(group[0]);
		group.forEach((e, i) => (e.brain.orbit = base + (i * Math.PI * 2) / group.length));
	}
}

function separate(pack: readonly Enemy[], dt: number) {
	for (let i = 0; i < pack.length; i++) {
		for (let j = i + 1; j < pack.length; j++) {
			const a = pack[i];
			const c = pack[j];
			const want = (ENEMY_SPACING * (ENEMIES[a.kind].scale + ENEMIES[c.kind].scale)) / 2;
			let dx = c.x - a.x;
			let dy = c.y - a.y;
			let dist = Math.hypot(dx, dy);
			if (dist >= want) continue;
			if (dist < 0.01) {
				// Exactly on top of each other: pick a direction from their order
				dx = Math.cos(i * 2.4 + j);
				dy = Math.sin(i * 2.4 + j);
				dist = 1;
			}
			// Push harder the more they overlap (a soft spring, not a hard wall).
			// Turrets are built into the ground: only the other one moves.
			const push = (want - dist) * 90 * dt;
			const aFixed = ENEMIES[a.kind].movement === 'static';
			const cFixed = ENEMIES[c.kind].movement === 'static';
			if (!aFixed) {
				a.vx -= (dx / dist) * push * (cFixed ? 2 : 1);
				a.vy -= (dy / dist) * push * (cFixed ? 2 : 1);
			}
			if (!cFixed) {
				c.vx += (dx / dist) * push * (aFixed ? 2 : 1);
				c.vy += (dy / dist) * push * (aFixed ? 2 : 1);
			}
		}
	}
}

/**
 * Ease velocity toward a desired velocity. Because it eases instead of
 * setting it, knockback from constructs still sends enemies flying and
 * fades out naturally.
 */
export function steer(e: Enemy, wantVx: number, wantVy: number, accel: number, dt: number) {
	const k = 1 - Math.exp(-accel * dt);
	e.vx += (wantVx - e.vx) * k;
	e.vy += (wantVy - e.vy) * k;
}

export function aimAt(e: Enemy, t: { x: number; y: number }) {
	const dx = t.x - e.x;
	const dy = t.y - e.y;
	const len = Math.hypot(dx, dy);
	if (len < 1) return;
	e.brain.aimX = dx / len;
	e.brain.aimY = dy / len;
}

export function face(e: Enemy, dx: number) {
	if (Math.abs(dx) > 4) e.dir = dx > 0 ? 1 : -1;
}
