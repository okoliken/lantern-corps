// Red Lantern constructs. Red rings run on rage, so their constructs are
// crude and brutal: claws, scythes, spears, meteors, napalm and raw fury.
//
// Every Red Lantern gets its own random KIT from this list (see randomKit),
// so no two fight quite the same way.
//
// They play by the same rules as the Green Lanterns' constructs, from the
// other side:
//  - Bubble shields soak them up, and a Fortress dome keeps them out.
//  - Energy walls block red projectiles and beams, but take damage.
//  - Turrets can be shot down, and big blasts tear them apart.

import { castBeam } from '../beam';
import { damagePlayer } from '../combat';
import { absorbWithShield, removeObstacle, type ConstructWorld } from '../constructs/system';
import { DUMMY_HALF_W, isStanding } from '../dummy';
import type { Obstacle } from '../map';
import { boxOverlap, type Solid } from '../physics';
import { bodyAim, hitsBody, type Player } from '../player';
import { ENEMIES, createEnemy, face, steer, type Enemy, type Role } from './enemies';

export type AbilityId =
	| 'claws'
	| 'scythe'
	| 'roar'
	| 'charge'
	| 'slam'
	| 'chain'
	| 'vomit'
	| 'spikes'
	| 'cage'
	| 'blast'
	| 'saw'
	| 'spears'
	| 'meteors'
	| 'beam'
	| 'skulls'
	// Built like a Green Lantern's constructs, in rage-red
	| 'axe'
	| 'mace'
	| 'cannon'
	| 'redWall'
	| 'redShield'
	| 'redTurret'
	// Bleez
	| 'swoop'
	// Machines: Manhunter Drones and Red Lantern fighters
	| 'eyeLaser'
	| 'sweep'
	| 'pulse'
	| 'strafe'
	| 'bombs';

/** How far away a construct is used from. Kits take some of each. */
export type Band = 'close' | 'mid' | 'long' | 'support';

/**
 * What the windup looks like:
 * strike = body flashes, "!"   heavy = body flashes, "!!"
 * aim = orb in the hand and an aim line   sky = orb raised overhead, "!!"
 * build = energy gathering in the hand, no warning (it isn't an attack)
 */
export type Tell = 'strike' | 'heavy' | 'aim' | 'sky' | 'build';

export interface AbilityDef {
	id: AbilityId;
	name: string;
	band: Band;
	tell: Tell;
	/** Seconds of tell before it happens. */
	windup: number;
	/** Seconds the construct lasts once it starts (at most, for chains). */
	active: number;
	/** Seconds of vulnerability afterwards. */
	recover: number;
	cooldown: number;
	/** Only used on targets between these distances. */
	minRange: number;
	maxRange: number;
	/** Per hit (per second for the beam). */
	damage: number;
	knockback: number;
	/** Close-range, limited by melee slots. */
	melee: boolean;
	/** Big area attacks: only one enemy at a time uses one on the same Lantern. */
	heavy: boolean;
	/** Chance to go for it when it's available (so enemies don't always do the same thing). */
	chance: number;
	speed?: number;
	radius?: number;
}

const def = (d: AbilityDef) => d;

export const ABILITIES: Record<AbilityId, AbilityDef> = {
	// ---- close ----
	claws: def({
		id: 'claws', name: 'Rage Claws', band: 'close', tell: 'strike', windup: 0.5, active: 0.18, recover: 0.45, cooldown: 1.2,
		minRange: 0, maxRange: 56, damage: 12, knockback: 320, melee: true, heavy: false, chance: 1
	}),
	// A huge blade swung all the way round
	scythe: def({
		id: 'scythe', name: 'Blood Scythe', band: 'close', tell: 'heavy', windup: 0.66, active: 0.35, recover: 0.55, cooldown: 4.5,
		minRange: 0, maxRange: 85, damage: 20, knockback: 520, melee: true, heavy: false, chance: 0.9, radius: 95
	}),
	// A blast of fury all around: shreds shields, turrets and walls
	roar: def({
		id: 'roar', name: 'Rage Roar', band: 'close', tell: 'heavy', windup: 0.72, active: 0.15, recover: 0.6, cooldown: 13,
		minRange: 0, maxRange: 140, damage: 8, knockback: 560, melee: false, heavy: true, chance: 0.7, radius: 160
	}),
	// Barrels straight through whoever's in the way; crashing into a wall dazes it
	charge: def({
		id: 'charge', name: 'Rage Charge', band: 'close', tell: 'heavy', windup: 0.72, active: 0.45, recover: 0.8, cooldown: 7.8,
		minRange: 120, maxRange: 340, damage: 22, knockback: 600, melee: false, heavy: true, chance: 0.7, speed: 620
	}),

	// ---- mid ----
	// Leaps and crashes down where the target WAS when it jumped
	slam: def({
		id: 'slam', name: 'Rage Slam', band: 'mid', tell: 'heavy', windup: 0.42, active: 0.7, recover: 0.7, cooldown: 9.1,
		minRange: 110, maxRange: 300, damage: 22, knockback: 480, melee: false, heavy: true, chance: 0.45, radius: 72
	}),
	// Hooks a Lantern and yanks them in
	chain: def({
		id: 'chain', name: 'Barbed Chain', band: 'mid', tell: 'aim', windup: 0.6, active: 1.2, recover: 0.3, cooldown: 8.5,
		minRange: 120, maxRange: 340, damage: 6, knockback: 0, melee: false, heavy: false, chance: 0.6, speed: 760
	}),
	// The Red Lanterns' signature: a torrent of burning plasma that leaves fire behind
	vomit: def({
		id: 'vomit', name: 'Napalm Vomit', band: 'mid', tell: 'aim', windup: 0.54, active: 1, recover: 0.5, cooldown: 7.8,
		minRange: 30, maxRange: 190, damage: 5, knockback: 40, melee: false, heavy: false, chance: 0.8, speed: 260
	}),
	// A line of spikes bursting out of the ground toward the target
	spikes: def({
		id: 'spikes', name: 'Blood Spikes', band: 'mid', tell: 'aim', windup: 0.6, active: 0.6, recover: 0.45, cooldown: 6.5,
		minRange: 90, maxRange: 420, damage: 16, knockback: 260, melee: false, heavy: false, chance: 0.75, radius: 30
	}),
	// An orb that locks a Lantern in a cage of red bars
	cage: def({
		id: 'cage', name: 'Rage Prison', band: 'mid', tell: 'aim', windup: 0.66, active: 0.2, recover: 0.4, cooldown: 11.7,
		minRange: 120, maxRange: 380, damage: 6, knockback: 0, melee: false, heavy: false, chance: 0.6, speed: 500
	}),

	// ---- long ----
	// Three bolts in quick succession
	blast: def({
		id: 'blast', name: 'Rage Blast', band: 'long', tell: 'aim', windup: 0.6, active: 0.45, recover: 0.35, cooldown: 2.9,
		minRange: 90, maxRange: 460, damage: 7, knockback: 90, melee: false, heavy: false, chance: 0.8, speed: 430
	}),
	// Flies out, then comes back to the thrower, hitting on the way out AND back
	saw: def({
		id: 'saw', name: 'Rage Saw', band: 'long', tell: 'aim', windup: 0.66, active: 0.2, recover: 0.45, cooldown: 6.5,
		minRange: 90, maxRange: 340, damage: 12, knockback: 160, melee: false, heavy: false, chance: 0.55, speed: 380
	}),
	// A fan of five jagged spears
	spears: def({
		id: 'spears', name: 'Blood Spears', band: 'long', tell: 'aim', windup: 0.72, active: 0.15, recover: 0.45, cooldown: 5.9,
		minRange: 120, maxRange: 460, damage: 10, knockback: 180, melee: false, heavy: false, chance: 0.75, speed: 580
	}),
	// Marks the ground, then red meteors rain down on the marks
	meteors: def({
		id: 'meteors', name: 'Rage Meteors', band: 'long', tell: 'sky', windup: 0.84, active: 0.3, recover: 0.6, cooldown: 10.4,
		minRange: 150, maxRange: 520, damage: 24, knockback: 380, melee: false, heavy: true, chance: 0.7, radius: 58
	}),
	// A burning ray that follows its target (damage is per second)
	beam: def({
		id: 'beam', name: 'Rage Beam', band: 'long', tell: 'aim', windup: 0.84, active: 1.1, recover: 0.6, cooldown: 9.1,
		minRange: 150, maxRange: 480, damage: 34, knockback: 60, melee: false, heavy: false, chance: 0.7
	}),
	// Slow red skulls that hunt their target down
	skulls: def({
		id: 'skulls', name: 'Skull Seekers', band: 'long', tell: 'aim', windup: 0.72, active: 0.4, recover: 0.5, cooldown: 9.1,
		minRange: 150, maxRange: 520, damage: 11, knockback: 200, melee: false, heavy: false, chance: 0.7, speed: 210
	}),

	// ---- Weapons, the way a Green Lantern would build them ----
	// A huge jagged battle-axe, swung in a wide arc in front
	axe: def({
		id: 'axe', name: 'Rage Axe', band: 'close', tell: 'strike', windup: 0.6, active: 0.25, recover: 0.55, cooldown: 4.5,
		minRange: 0, maxRange: 90, damage: 18, knockback: 420, melee: true, heavy: false, chance: 0.85, radius: 100
	}),
	// A spiked mace brought down on the spot just ahead
	mace: def({
		id: 'mace', name: 'Blood Mace', band: 'close', tell: 'heavy', windup: 0.75, active: 0.2, recover: 0.7, cooldown: 6,
		minRange: 0, maxRange: 110, damage: 24, knockback: 520, melee: true, heavy: false, chance: 0.75, radius: 58
	}),
	// A cannon forms on the arm and lobs a slow shell that bursts
	cannon: def({
		id: 'cannon', name: 'Rage Cannon', band: 'long', tell: 'aim', windup: 0.8, active: 0.2, recover: 0.6, cooldown: 6,
		minRange: 150, maxRange: 520, damage: 18, knockback: 380, melee: false, heavy: true, chance: 0.7, speed: 380, radius: 62
	}),

	// ---- Support: not attacks, so they don't wait their turn, and reserves use them too ----
	// A jagged barrier between it and the Lantern: blocks green shots and beams, lets red ones through
	redWall: def({
		id: 'redWall', name: 'Rage Wall', band: 'support', tell: 'build', windup: 0.5, active: 0.1, recover: 0.3, cooldown: 10,
		minRange: 120, maxRange: 480, damage: 0, knockback: 0, melee: false, heavy: false, chance: 0.7
	}),
	// A bubble on a hurt ally (or itself) that soaks up damage
	redShield: def({
		id: 'redShield', name: 'Rage Shield', band: 'support', tell: 'build', windup: 0.45, active: 0.1, recover: 0.3, cooldown: 9,
		minRange: 0, maxRange: 9999, damage: 0, knockback: 0, melee: false, heavy: false, chance: 0.8
	}),
	// A spiked turret that shoots at Lanterns until it's broken or burns out
	redTurret: def({
		id: 'redTurret', name: 'Rage Turret', band: 'support', tell: 'build', windup: 0.7, active: 0.1, recover: 0.4, cooldown: 16,
		minRange: 180, maxRange: 700, damage: 0, knockback: 0, melee: false, heavy: false, chance: 0.6
	}),

	// ---- Bleez ----
	// Rises on her wings, then dives straight through whoever's in the way
	swoop: def({
		id: 'swoop', name: 'Blood Dive', band: 'mid', tell: 'heavy', windup: 0.65, active: 0.45, recover: 0.6, cooldown: 5,
		minRange: 110, maxRange: 360, damage: 18, knockback: 480, melee: false, heavy: false, chance: 0.8, speed: 760
	}),

	// ---- Manhunter Drone ----
	// Its eye glows, then fires two quick laser bolts
	eyeLaser: def({
		id: 'eyeLaser', name: 'Eye Laser', band: 'long', tell: 'aim', windup: 0.6, active: 0.3, recover: 0.4, cooldown: 3,
		minRange: 60, maxRange: 520, damage: 8, knockback: 80, melee: false, heavy: false, chance: 0.85, speed: 900
	}),
	// A thin laser held on the target and dragged across (damage per second)
	sweep: def({
		id: 'sweep', name: 'Laser Sweep', band: 'long', tell: 'aim', windup: 0.8, active: 1, recover: 0.6, cooldown: 8,
		minRange: 120, maxRange: 460, damage: 24, knockback: 40, melee: false, heavy: false, chance: 0.6
	}),
	// A ring of force that shoves away anyone who gets too close
	pulse: def({
		id: 'pulse', name: 'Repulse Pulse', band: 'close', tell: 'heavy', windup: 0.55, active: 0.15, recover: 0.5, cooldown: 5,
		minRange: 0, maxRange: 110, damage: 6, knockback: 520, melee: false, heavy: false, chance: 0.9, radius: 120
	}),

	// ---- Red Lantern fighter ----
	// Lined up on a Lantern: a stream of laser bolts straight ahead, without slowing down
	strafe: def({
		id: 'strafe', name: 'Strafing Run', band: 'long', tell: 'aim', windup: 0.35, active: 0.55, recover: 0.2, cooldown: 3.4,
		minRange: 80, maxRange: 420, damage: 7, knockback: 90, melee: false, heavy: false, chance: 0.9, speed: 820
	}),
	// Flying over: drops a line of rage bombs that go off a moment later
	bombs: def({
		id: 'bombs', name: 'Bombing Run', band: 'close', tell: 'aim', windup: 0.25, active: 0.55, recover: 0.2, cooldown: 7,
		minRange: 0, maxRange: 140, damage: 14, knockback: 300, melee: false, heavy: true, chance: 0.8, radius: 46
	})
};

/** What the machines use. They're never part of a Red Lantern's random kit. */
export const MACHINE_ABILITIES: readonly AbilityId[] = ['eyeLaser', 'sweep', 'pulse', 'strafe', 'bombs'];
/** Signature moves of named Red Lanterns, never handed out in random kits. */
const SIGNATURE_ABILITIES: readonly AbilityId[] = ['swoop'];

/** Every red construct a Red Lantern's kit can be built from. */
export const ABILITY_LIST = (Object.keys(ABILITIES) as AbilityId[]).filter(
	(id) => !MACHINE_ABILITIES.includes(id) && !SIGNATURE_ABILITIES.includes(id)
);

/** Which bands each role's kit is built from ('any' = a random fighting band). Everyone gets one support construct. */
const KIT_PLAN: Record<Role, (Band | 'any')[]> = {
	berserker: ['close', 'close', 'mid', 'any', 'support'],
	hunter: ['close', 'mid', 'long', 'any', 'support'],
	gunner: ['long', 'long', 'mid', 'any', 'support']
};

/** A random kit of five different constructs that suits the role: four to fight with, one to support. */
export function randomKit(role: Role, rand = Math.random): AbilityId[] {
	const kit: AbilityId[] = [];
	const bands: Band[] = ['close', 'mid', 'long'];
	for (const slot of KIT_PLAN[role]) {
		const band = slot === 'any' ? bands[Math.floor(rand() * bands.length)] : slot;
		let pool = ABILITY_LIST.filter((id) => ABILITIES[id].band === band && !kit.includes(id));
		if (pool.length === 0) pool = ABILITY_LIST.filter((id) => !kit.includes(id));
		kit.push(pool[Math.floor(rand() * pool.length)]);
	}
	return kit;
}

/** How high above the ground red projectiles fly (about hand height on a hovering Red Lantern). */
export const RED_HAND_LIFT = 50;
const CHAIN_PULL_SPEED = 620;
const CHAIN_PULL_TIME = 0.4;
/** The chain lets go this close. */
const CHAIN_STOP_DISTANCE = 46;
/** Extra shield damage from a Rage Roar, on top of its normal damage. */
const ROAR_SHIELD_DAMAGE = 24;
const CAGE_TIME = 1.4;
const BEAM_LENGTH = 520;
/** The beam damages this often (a Lantern's hit invulnerability would swallow faster ticks). */
const BEAM_TICK = 0.36;
const BEAM_TURN_RATE = 1.4;
const SKULL_TURN_RATE = 2.6;
const PUDDLE_TICK = 0.4;
/** Rage Wall size, distance in front, health and lifetime. */
const RED_WALL_LENGTH = 110;
const RED_WALL_DISTANCE = 60;
const RED_WALL_HP = 140;
const RED_WALL_LIFE = 8;
/** Rage Shield strength and lifetime. */
const RED_SHIELD_HP = 90;
const RED_SHIELD_LIFE = 8;
/** How high Bleez climbs (0..1 of a slam's height) before a Blood Dive. */
export const SWOOP_HEIGHT = 0.7;
/** How high a Rage Slam leap goes, in px (drawing uses this). */
export const SLAM_HEIGHT = 70;

export interface RedShot {
	/** Rage Cannon shells: how big the burst is. */
	radius?: number;
	/** bolt: Rage Blast · saw · hook: Barbed Chain · spear · skull · plasma: Napalm Vomit · orb: Rage Prison · laser: machines */
	kind: 'bolt' | 'saw' | 'hook' | 'spear' | 'skull' | 'plasma' | 'orb' | 'laser' | 'shell';
	owner: Enemy;
	x: number;
	y: number;
	prevX: number;
	prevY: number;
	vx: number;
	vy: number;
	life: number;
	/** Cruising speed (saws and skulls keep it while turning). */
	speed: number;
	damage: number;
	knockback: number;
	/** Solids it started inside; it passes out of those. */
	ignore: Solid[];
	/** Lanterns a saw already cut on this pass. */
	hit: Player[];
	/** Saws: px travelled, and how far before heading back. */
	travelled: number;
	out: number;
	returning: boolean;
}

/** A Barbed Chain hooked into a Lantern, dragging them in. */
export interface RedChain {
	owner: Enemy;
	target: Player;
	time: number;
}

/** Something about to hit the ground: a meteor, or one spike in a line. */
export interface RedStrike {
	kind: 'meteor' | 'spike' | 'bomb';
	x: number;
	y: number;
	radius: number;
	/** Seconds until it lands. */
	delay: number;
	/** Seconds of warning it started with (meteors draw a filling circle). */
	warning: number;
	damage: number;
	knockback: number;
}

/** Burning plasma on the ground. */
export interface RedPuddle {
	x: number;
	y: number;
	radius: number;
	life: number;
	maxLife: number;
	tick: number;
	damage: number;
}

export interface RedBeam {
	owner: Enemy;
	/** A ragged Rage Beam, or a Manhunter's thin laser. */
	style: 'rage' | 'laser';
	/** How fast it swings toward its target (radians per second). */
	turnRate: number;
	angle: number;
	/** How far it reaches this tick (stopped by walls and domes). */
	length: number;
	time: number;
	tick: number;
	dps: number;
}

/** A Lantern locked in a Rage Prison. */
export interface RedCage {
	target: Player;
	x: number;
	y: number;
	time: number;
	maxTime: number;
}

export interface RedWorld {
	shots: RedShot[];
	chains: RedChain[];
	strikes: RedStrike[];
	puddles: RedPuddle[];
	beams: RedBeam[];
	cages: RedCage[];
}

export function createRedWorld(): RedWorld {
	return { shots: [], chains: [], strikes: [], puddles: [], beams: [], cages: [] };
}

/** Damage for one hit of a construct: angrier and mightier enemies hit harder. */
function power(e: Enemy, a: AbilityDef): number {
	return a.damage * e.brain.might * (1 + 0.5 * e.brain.rage);
}

// --------------------------------------------------------------- using them

/** The windup is over: the construct happens. */
export function startAbility(e: Enemy, w: ConstructWorld, players: readonly Player[]) {
	const b = e.brain;
	const a = ABILITIES[b.ability!];
	b.state = 'act';
	b.timer = a.active;
	b.elapsed = 0;
	b.fired = 0;
	b.hitDone = false;
	b.struck = [];

	switch (a.id) {
		case 'claws':
			e.vx += b.aimX * 340;
			e.vy += b.aimY * 340;
			w.effects.push({ kind: 'claw', x: e.x, y: e.y, age: 0, life: 0.3, angle: Math.atan2(b.aimY, b.aimX), lift: 40 * ENEMIES[e.kind].scale, radius: a.maxRange });
			break;
		case 'scythe':
			w.effects.push({ kind: 'scythe', x: e.x, y: e.y, age: 0, life: 0.45, angle: Math.atan2(b.aimY, b.aimX), radius: a.radius, lift: 34 });
			break;
		case 'saw':
			fire(e, w, 'saw', a, b.aimX, b.aimY);
			break;
		case 'chain':
			fire(e, w, 'hook', a, b.aimX, b.aimY);
			break;
		case 'cage':
			fire(e, w, 'orb', a, b.aimX, b.aimY);
			break;
		case 'spears': {
			const base = Math.atan2(b.aimY, b.aimX);
			for (let i = -2; i <= 2; i++) fire(e, w, 'spear', a, Math.cos(base + i * 0.18), Math.sin(base + i * 0.18));
			break;
		}
		case 'slam': {
			// Cover the distance to the mark over the length of the leap
			e.vx = (b.markX - e.x) / a.active;
			e.vy = (b.markY - e.y) / a.active;
			w.effects.push({ kind: 'slamMark', x: b.markX, y: b.markY, age: 0, life: a.active, radius: a.radius });
			break;
		}
		case 'roar':
			roar(e, a, w, players);
			break;
		case 'spikes':
			spikeLine(e, a, w);
			break;
		case 'meteors':
			meteorShower(e, a, w);
			break;
		case 'beam':
		case 'sweep': {
			const laser = a.id === 'sweep';
			w.red.beams.push({
				owner: e,
				style: laser ? 'laser' : 'rage',
				turnRate: laser ? 1 : BEAM_TURN_RATE,
				angle: Math.atan2(b.aimY, b.aimX),
				length: 0,
				time: a.active,
				tick: 0,
				dps: a.damage * b.might
			});
			break;
		}
		case 'pulse':
			pulse(e, a, w, players);
			break;
		case 'axe':
			cleave(e, a, w, players);
			break;
		case 'mace': {
			const x = e.x + b.aimX * 55;
			const y = e.y + b.aimY * 55;
			areaHit(e, a, w, players, x, y, a.radius ?? 58, 50, 80);
			w.effects.push({ kind: 'redMace', x: e.x, y: e.y, age: 0, life: 0.4, angle: Math.atan2(b.aimY, b.aimX), value: 55, radius: a.radius, lift: 40 });
			w.effects.push({ kind: 'redBlast', x, y, age: 0, life: 0.45, radius: a.radius });
			break;
		}
		case 'cannon': {
			const shell = fire(e, w, 'shell', a, b.aimX, b.aimY);
			shell.radius = a.radius;
			break;
		}
		case 'redWall':
			raiseWall(e, w, players);
			break;
		case 'redShield':
			shieldAlly(e, w);
			break;
		case 'redTurret':
			buildTurret(e, w);
			break;
	}
}

/** Rage Axe: everything in a wide arc in front. */
function cleave(e: Enemy, a: AbilityDef, w: ConstructWorld, players: readonly Player[]) {
	const b = e.brain;
	const r = a.radius ?? 100;
	for (const p of players) {
		if (p.downed) continue;
		const dx = p.x - e.x;
		const dy = p.y - e.y;
		const d = Math.hypot(dx, dy);
		if (d > r + 10) continue;
		if (d > 14 && (dx * b.aimX + dy * b.aimY) / d < 0.25) continue; // about 75 degrees either side
		damagePlayer(w, p, power(e, a), e.x, e.y, a.knockback);
	}
	for (const t of w.turrets) if (Math.hypot(t.x - e.x, t.y - e.y) <= r) t.hp -= 40;
	for (const o of wallsNear(w, e.x + b.aimX * r * 0.5, e.y + b.aimY * r * 0.5, r * 0.6)) damageWall(w, o, 60);
	w.effects.push({ kind: 'redAxe', x: e.x, y: e.y, age: 0, life: 0.4, angle: Math.atan2(b.aimY, b.aimX), radius: r, lift: 40 });
}

/** Rage Wall: a jagged barrier across the line to the Lantern. Not on top of anyone. */
function raiseWall(e: Enemy, w: ConstructWorld, players: readonly Player[]) {
	const b = e.brain;
	const cx = e.x + b.aimX * RED_WALL_DISTANCE;
	const cy = e.y + b.aimY * RED_WALL_DISTANCE;
	const across = Math.abs(b.aimX) >= Math.abs(b.aimY);
	const ww = across ? 16 : RED_WALL_LENGTH;
	const wh = across ? RED_WALL_LENGTH : 16;
	const hp = RED_WALL_HP * b.might;
	const wall: Obstacle = {
		kind: 'redWall',
		x: cx - ww / 2,
		y: cy - wh / 2,
		w: ww,
		h: wh,
		height: 50,
		blocksFlying: false,
		seed: Math.random(),
		hp,
		maxHp: hp,
		life: RED_WALL_LIFE,
		maxLife: RED_WALL_LIFE
	};
	if (players.some((p) => boxOverlap(p.x, p.y, 10, 6, wall))) return;
	w.obstacles.push(wall);
	w.effects.push({ kind: 'roar', x: cx, y: cy, age: 0, life: 0.35, radius: RED_WALL_LENGTH / 2, lift: 20 });
}

/** Rage Shield on the ally it picked (itself if none). */
function shieldAlly(e: Enemy, w: ConstructWorld) {
	const b = e.brain;
	const ally = b.ally && isStanding(b.ally) ? b.ally : e;
	const hp = RED_SHIELD_HP * b.might;
	ally.ward = { hp, maxHp: hp, life: RED_SHIELD_LIFE };
	b.ally = null;
	w.effects.push({ kind: 'roar', x: ally.x, y: ally.y, age: 0, life: 0.4, radius: 40, lift: 36 });
}

/** Rage Turret: a static enemy of its own, just ahead of the builder. */
function buildTurret(e: Enemy, w: ConstructWorld) {
	const b = e.brain;
	let x = e.x + b.aimX * 45 - b.aimY * 30;
	let y = e.y + b.aimY * 45 + b.aimX * 30;
	if (w.obstacles.some((o) => boxOverlap(x, y, 14, 8, o))) {
		x = e.x;
		y = e.y + 20;
	}
	const t = createEnemy('rageTurret', x, y);
	t.brain.might = b.might;
	t.brain.target = b.target;
	w.dummies.push(t);
	w.effects.push({ kind: 'roar', x, y, age: 0, life: 0.5, radius: 50, lift: 20 });
}

/** One tick of a construct in use. Returns true when it's finished. */
export function updateAbility(e: Enemy, w: ConstructWorld, players: readonly Player[], dt: number): boolean {
	const b = e.brain;
	const a = ABILITIES[b.ability!];
	const accel = ENEMIES[e.kind].accel;
	b.elapsed += dt;
	b.timer -= dt;

	switch (a.id) {
		case 'claws':
			if (!b.hitDone) {
				b.hitDone = true;
				clawHit(e, a, w, players);
			}
			break;
		case 'scythe':
			steer(e, 0, 0, accel, dt);
			if (!b.hitDone) {
				b.hitDone = true;
				areaHit(e, a, w, players, e.x, e.y, a.radius ?? 90, 40, 60);
			}
			break;
		case 'blast':
			steer(e, 0, 0, accel, dt);
			if (b.fired < 3 && b.elapsed >= b.fired * 0.15) {
				track(e, 0.4);
				fire(e, w, 'bolt', a, b.aimX, b.aimY);
				b.fired++;
			}
			break;
		case 'skulls':
			steer(e, 0, 0, accel, dt);
			if (b.fired < 3 && b.elapsed >= b.fired * 0.12) {
				const spread = (b.fired - 1) * 0.5;
				const angle = Math.atan2(b.aimY, b.aimX) + spread;
				fire(e, w, 'skull', a, Math.cos(angle), Math.sin(angle));
				b.fired++;
			}
			break;
		case 'vomit':
			steer(e, 0, 0, accel, dt);
			// A spray of burning blobs, every few hundredths of a second
			while (b.fired < b.elapsed / 0.05) {
				track(e, 0.05);
				const angle = Math.atan2(b.aimY, b.aimX) + (Math.random() - 0.5) * 0.7;
				const shot = fire(e, w, 'plasma', a, Math.cos(angle), Math.sin(angle));
				const k = 0.8 + Math.random() * 0.4;
				shot.vx *= k;
				shot.vy *= k;
				shot.life = (a.maxRange / a.speed!) * (0.55 + Math.random() * 0.45);
				b.fired++;
			}
			break;
		case 'chain': {
			steer(e, 0, 0, accel * 2, dt);
			const busy = w.red.shots.some((s) => s.owner === e && s.kind === 'hook') || w.red.chains.some((c) => c.owner === e);
			if (!busy && b.elapsed > 0.05) b.timer = 0;
			break;
		}
		case 'charge':
			updateCharge(e, a, w, players, dt);
			break;
		case 'swoop':
			// A charge from the air: she comes down out of the sky as she goes
			updateCharge(e, a, w, players, dt);
			b.air = SWOOP_HEIGHT * Math.max(0, 1 - b.elapsed / a.active);
			if (b.timer <= 0) b.air = 0;
			break;
		case 'slam': {
			const progress = Math.min(1, b.elapsed / a.active);
			b.air = Math.sin(progress * Math.PI);
			if (b.timer <= 0) {
				b.air = 0;
				e.vx = e.vy = 0;
				areaHit(e, a, w, players, e.x, e.y, a.radius ?? 70, 40, 60);
				w.effects.push({ kind: 'redBlast', x: e.x, y: e.y, age: 0, life: 0.55, radius: a.radius });
			}
			break;
		}
		case 'beam':
		case 'sweep': {
			steer(e, 0, 0, accel * 2, dt);
			if (!w.red.beams.some((bm) => bm.owner === e)) b.timer = 0;
			break;
		}
		case 'eyeLaser':
			steer(e, 0, 0, accel, dt);
			if (b.fired < 2 && b.elapsed >= b.fired * 0.14) {
				track(e, 0.3);
				fire(e, w, 'laser', a, b.aimX, b.aimY);
				b.fired++;
			}
			break;
		// Fighters keep flying through their attacks (ships.ts steers them)
		case 'strafe':
			if (b.fired < 5 && b.elapsed >= b.fired * 0.11) {
				fire(e, w, 'laser', a, Math.cos(b.heading), Math.sin(b.heading));
				b.fired++;
			}
			break;
		case 'bombs':
			if (b.fired < 3 && b.elapsed >= b.fired * 0.18) {
				w.red.strikes.push({ kind: 'bomb', x: e.x, y: e.y, radius: a.radius ?? 46, delay: 0.75, warning: 0.75, damage: power(e, a), knockback: a.knockback });
				b.fired++;
			}
			break;
		default:
			steer(e, 0, 0, accel, dt);
	}
	return b.timer <= 0;
}

/** Interrupted: hooks, chains and beams stop (thrown things and meteors already on the way keep going). */
export function cancelAbility(e: Enemy, w: ConstructWorld) {
	w.red.shots = w.red.shots.filter((s) => !(s.owner === e && s.kind === 'hook'));
	w.red.chains = w.red.chains.filter((c) => c.owner !== e);
	w.red.beams = w.red.beams.filter((bm) => bm.owner !== e);
	e.brain.air = 0;
}

/** Turn the aim part of the way toward the target. */
function track(e: Enemy, amount: number) {
	const b = e.brain;
	if (!b.target) return;
	const t = bodyAim(b.target, RED_HAND_LIFT);
	const dx = t.x - e.x;
	const dy = t.y - e.y;
	const len = Math.hypot(dx, dy) || 1;
	b.aimX += (dx / len - b.aimX) * amount;
	b.aimY += (dy / len - b.aimY) * amount;
	const n = Math.hypot(b.aimX, b.aimY) || 1;
	b.aimX /= n;
	b.aimY /= n;
	face(e, dx);
}

function fire(e: Enemy, w: ConstructWorld, kind: RedShot['kind'], a: AbilityDef, dx: number, dy: number): RedShot {
	const speed = a.speed ?? 500;
	const x = e.x + dx * 14;
	const y = e.y + dy * 14;
	const shot: RedShot = {
		kind,
		owner: e,
		x,
		y,
		prevX: x,
		prevY: y,
		vx: dx * speed,
		vy: dy * speed,
		life: kind === 'saw' ? 3 : kind === 'skull' ? 3.2 : (a.maxRange + 60) / speed,
		speed,
		damage: power(e, a),
		knockback: a.knockback,
		ignore: w.obstacles.filter((o) => boxOverlap(x, y, 1, 1, o)),
		hit: [],
		travelled: 0,
		out: a.maxRange,
		returning: false
	};
	w.red.shots.push(shot);
	return shot;
}

function clawHit(e: Enemy, a: AbilityDef, w: ConstructWorld, players: readonly Player[]) {
	const b = e.brain;
	for (const p of players) {
		if (p.downed) continue;
		const dx = p.x - e.x;
		const dy = p.y - e.y;
		const dist = Math.hypot(dx, dy);
		if (dist > a.maxRange + DUMMY_HALF_W + 10) continue;
		// In front of the swipe (within about 70 degrees of the aim)
		if (dist > 12 && (dx * b.aimX + dy * b.aimY) / dist < 0.35) continue;
		damagePlayer(w, p, power(e, a), e.x, e.y, a.knockback);
	}
}

/** Hurt every Lantern, turret and energy wall in a circle. */
function areaHit(e: Enemy, a: AbilityDef, w: ConstructWorld, players: readonly Player[], x: number, y: number, r: number, turretDamage: number, wallDamage: number) {
	for (const p of players) {
		if (!p.downed && Math.hypot(p.x - x, p.y - y) <= r + 10) damagePlayer(w, p, power(e, a), x, y, a.knockback);
	}
	for (const t of w.turrets) if (Math.hypot(t.x - x, t.y - y) <= r + 10) t.hp -= turretDamage;
	for (const o of wallsNear(w, x, y, r)) damageWall(w, o, wallDamage);
}

function roar(e: Enemy, a: AbilityDef, w: ConstructWorld, players: readonly Player[]) {
	const r = a.radius ?? 150;
	for (const p of players) {
		if (p.downed) continue;
		const dx = p.x - e.x;
		const dy = p.y - e.y;
		const dist = Math.hypot(dx, dy);
		if (dist > r + 10) continue;
		// Tears into bubble shields first, then hits whatever's left
		if (w.shields.some((s) => s.target === p)) absorbWithShield(w, p, ROAR_SHIELD_DAMAGE * e.brain.might);
		damagePlayer(w, p, power(e, a), e.x, e.y, 0);
		// Blown back even if a shield took the hit (not from inside a Fortress)
		if (!inFortress(w, p.x, p.y)) {
			const len = dist || 1;
			p.vx += (dx / len) * a.knockback;
			p.vy += (dy / len) * a.knockback;
		}
	}
	for (const t of w.turrets) if (Math.hypot(t.x - e.x, t.y - e.y) <= r + 10) t.hp -= 70;
	for (const o of wallsNear(w, e.x, e.y, r)) damageWall(w, o, 90);
	w.effects.push({ kind: 'roar', x: e.x, y: e.y, age: 0, life: 0.6, radius: r, lift: 36 });
}

/** A ring of force: shoves every Lantern nearby away, and knocks turrets about. */
function pulse(e: Enemy, a: AbilityDef, w: ConstructWorld, players: readonly Player[]) {
	const r = a.radius ?? 120;
	for (const p of players) {
		if (!p.downed && Math.hypot(p.x - e.x, p.y - e.y) <= r + 10) damagePlayer(w, p, power(e, a), e.x, e.y, a.knockback);
	}
	for (const t of w.turrets) if (Math.hypot(t.x - e.x, t.y - e.y) <= r + 10) t.hp -= 25;
	w.effects.push({ kind: 'pulse', x: e.x, y: e.y, age: 0, life: 0.45, radius: r, lift: 40 });
}

function updateCharge(e: Enemy, a: AbilityDef, w: ConstructWorld, players: readonly Player[], dt: number) {
	const b = e.brain;
	const speed = a.speed ?? 700;
	// Something tall stopped us last tick (movement zeroes velocity on a collision): crash
	if (b.elapsed > 0.05 && Math.hypot(e.vx, e.vy) < speed * 0.4) {
		const wall = w.obstacles.find((o) => o.kind === 'wall' && boxOverlap(e.x, e.y, DUMMY_HALF_W + 8, DUMMY_HALF_W + 8, o));
		if (wall) damageWall(w, wall, 140);
		e.stun = 0.7;
		b.timer = 0;
		w.effects.push({ kind: 'redBlast', x: e.x, y: e.y, age: 0, life: 0.4, radius: 40 });
		return;
	}
	e.vx = b.aimX * speed;
	e.vy = b.aimY * speed;
	if (Math.random() < 0.6) w.effects.push({ kind: 'redTrail', x: e.x, y: e.y, age: 0, life: 0.35, angle: Math.atan2(b.aimY, b.aimX), lift: 34 });
	for (const p of players) {
		if (p.downed || b.struck.includes(p) || Math.hypot(p.x - e.x, p.y - e.y) > 34) continue;
		b.struck.push(p);
		damagePlayer(w, p, power(e, a), e.x - b.aimX * 20, e.y - b.aimY * 20, a.knockback);
	}
	// Skid to a stop at the end
	if (b.timer <= dt) {
		e.vx *= 0.25;
		e.vy *= 0.25;
	}
}

/** Nine spikes erupting one after another along the aim. An energy wall stops the line. */
function spikeLine(e: Enemy, a: AbilityDef, w: ConstructWorld) {
	const b = e.brain;
	for (let i = 0; i < 9; i++) {
		const x = e.x + b.aimX * (40 + i * 44);
		const y = e.y + b.aimY * (40 + i * 44);
		const wall = w.obstacles.find((o) => o.kind === 'wall' && boxOverlap(x, y, 10, 10, o));
		if (wall) {
			damageWall(w, wall, 60);
			w.effects.push({ kind: 'redImpact', x, y, age: 0, life: 0.3, lift: 10 });
			break;
		}
		w.red.strikes.push({ kind: 'spike', x, y, radius: a.radius ?? 30, delay: 0.04 + i * 0.055, warning: 0, damage: power(e, a), knockback: a.knockback });
	}
}

/** One meteor right on the target, three more scattered around it. */
function meteorShower(e: Enemy, a: AbilityDef, w: ConstructWorld) {
	const t = e.brain.target;
	const cx = t ? t.x : e.brain.markX;
	const cy = t ? t.y : e.brain.markY;
	for (let i = 0; i < 4; i++) {
		const angle = Math.random() * Math.PI * 2;
		const r = i === 0 ? 0 : 50 + Math.random() * 80;
		const warning = 0.95 + i * 0.14;
		w.red.strikes.push({
			kind: 'meteor',
			x: cx + Math.cos(angle) * r,
			y: cy + Math.sin(angle) * r,
			radius: a.radius ?? 58,
			delay: warning,
			warning,
			damage: power(e, a),
			knockback: a.knockback
		});
	}
}

// -------------------------------------------------------------- world tick

/** Move red projectiles, beams, chains, cages, falling strikes and fire. Called once per tick after the brains. */
export function updateRedConstructs(w: ConstructWorld, players: readonly Player[], dt: number) {
	const red = w.red;
	red.shots = red.shots.filter((s) => updateShot(s, w, players, dt));
	red.chains = red.chains.filter((c) => updateChain(c, dt));
	red.beams = red.beams.filter((bm) => updateBeam(bm, w, players, dt));
	red.strikes = red.strikes.filter((s) => updateStrike(s, w, players, dt));

	red.cages = red.cages.filter((c) => {
		c.time -= dt;
		const p = c.target;
		if (c.time <= 0 || p.downed || p.dash) return false;
		p.x = c.x;
		p.y = c.y;
		p.vx = p.vy = 0;
		return true;
	});

	red.puddles = red.puddles.filter((pd) => {
		pd.life -= dt;
		pd.tick -= dt;
		if (pd.tick <= 0) {
			pd.tick = PUDDLE_TICK;
			for (const p of players) {
				if (!p.downed && Math.hypot(p.x - pd.x, p.y - pd.y) <= pd.radius) damagePlayer(w, p, pd.damage, pd.x, pd.y, 0);
			}
		}
		return pd.life > 0;
	});
}

function updateChain(c: RedChain, dt: number): boolean {
	c.time -= dt;
	const e = c.owner;
	const p = c.target;
	const dx = e.x - p.x;
	const dy = e.y - p.y;
	const dist = Math.hypot(dx, dy);
	const holding = isStanding(e) && e.caged === 0 && e.stun === 0 && !p.downed && !p.dash;
	if (!holding || c.time <= 0 || dist <= CHAIN_STOP_DISTANCE) {
		if (holding) {
			// Reeled in: straight into whatever it hits up close with
			p.vx *= 0.3;
			p.vy *= 0.3;
			e.brain.engaged = true;
			e.brain.cooldowns.claws = 0;
			e.brain.cooldowns.scythe = 0;
			e.brain.think = 0;
		}
		return false;
	}
	p.vx = (dx / dist) * CHAIN_PULL_SPEED;
	p.vy = (dy / dist) * CHAIN_PULL_SPEED;
	return true;
}

function updateBeam(bm: RedBeam, w: ConstructWorld, players: readonly Player[], dt: number): boolean {
	const e = bm.owner;
	bm.time -= dt;
	if (bm.time <= 0 || !isStanding(e) || e.stun > 0 || e.caged > 0) return false;

	// Sweep slowly toward the target
	const t = e.brain.target ? bodyAim(e.brain.target, RED_HAND_LIFT) : null;
	if (t) {
		const want = Math.atan2(t.y - e.y, t.x - e.x);
		const diff = Math.atan2(Math.sin(want - bm.angle), Math.cos(want - bm.angle));
		bm.angle += Math.max(-bm.turnRate * dt, Math.min(bm.turnRate * dt, diff));
		face(e, t.x - e.x);
	}
	const dx = Math.cos(bm.angle);
	const dy = Math.sin(bm.angle);
	e.brain.aimX = dx;
	e.brain.aimY = dy;

	// Stopped by energy walls (which burn) and tall things
	const blockers = w.obstacles.filter((o) => o.kind === 'wall' || o.blocksFlying);
	const { length, hit } = castBeam<Obstacle>(e.x, e.y, dx, dy, blockers, BEAM_LENGTH);
	bm.length = length;
	// ...and by a Fortress dome it's pointed into from outside
	for (const f of w.fortresses) {
		if (Math.hypot(e.x - f.x, e.y - f.y) <= f.radius) continue;
		const along = (f.x - e.x) * dx + (f.y - e.y) * dy;
		const off = Math.hypot(f.x - (e.x + dx * along), f.y - (e.y + dy * along));
		if (along > 0 && off < f.radius) bm.length = Math.min(bm.length, along - Math.sqrt(f.radius ** 2 - off ** 2));
	}

	bm.tick -= dt;
	if (bm.tick > 0) return true;
	bm.tick = BEAM_TICK;
	if (hit && hit.kind === 'wall') damageWall(w, hit, bm.dps * BEAM_TICK * 1.5);
	for (const p of players) {
		if (p.downed) continue;
		// Anywhere along the drawn beam touching the drawn body
		let touches = false;
		for (let d = 0; d <= bm.length && !touches; d += 6) touches = hitsBody(p, e.x + dx * d, e.y + dy * d, RED_HAND_LIFT);
		const kb = bm.style === 'laser' ? ABILITIES.sweep.knockback : ABILITIES.beam.knockback;
		if (touches) damagePlayer(w, p, bm.dps * BEAM_TICK, e.x, e.y, kb);
	}
	for (const tr of w.turrets) {
		const along = (tr.x - e.x) * dx + (tr.y - e.y) * dy;
		if (along > 0 && along < bm.length && Math.abs((tr.x - e.x) * dy - (tr.y - e.y) * dx) < 16) tr.hp -= bm.dps * BEAM_TICK;
	}
	return true;
}

function updateStrike(s: RedStrike, w: ConstructWorld, players: readonly Player[], dt: number): boolean {
	s.delay -= dt;
	if (s.delay > 0) return true;
	for (const p of players) {
		if (!p.downed && Math.hypot(p.x - s.x, p.y - s.y) <= s.radius + 8) damagePlayer(w, p, s.damage, s.x, s.y, s.knockback);
	}
	const big = s.kind !== 'spike';
	for (const t of w.turrets) if (Math.hypot(t.x - s.x, t.y - s.y) <= s.radius + 8) t.hp -= big ? 40 : 20;
	for (const o of wallsNear(w, s.x, s.y, s.radius)) damageWall(w, o, big ? 60 : 30);
	if (s.kind === 'meteor') {
		w.effects.push({ kind: 'redBlast', x: s.x, y: s.y, age: 0, life: 0.6, radius: s.radius * 1.2 });
		if (Math.random() < 0.5) addPuddle(w, s.x, s.y, 34, s.damage * 0.25);
	} else if (s.kind === 'bomb') {
		w.effects.push({ kind: 'redBlast', x: s.x, y: s.y, age: 0, life: 0.5, radius: s.radius * 1.1 });
	} else {
		w.effects.push({ kind: 'spikeBurst', x: s.x, y: s.y, age: 0, life: 0.55, radius: s.radius });
	}
	return false;
}

function addPuddle(w: ConstructWorld, x: number, y: number, radius: number, damage: number) {
	if (w.red.puddles.length > 40) w.red.puddles.shift();
	w.red.puddles.push({ x, y, radius, life: 3.5, maxLife: 3.5, tick: 0.2, damage });
}

/** Returns false when the shot is used up. */
function updateShot(s: RedShot, w: ConstructWorld, players: readonly Player[], dt: number): boolean {
	s.prevX = s.x;
	s.prevY = s.y;
	const owner = s.owner;
	const ownerUp = isStanding(owner);
	if (s.kind === 'hook' && !ownerUp) return false;

	if (s.kind === 'saw') {
		if (!s.returning && s.travelled >= s.out) startReturn(s);
		if (s.returning && ownerUp) {
			// Home back in on the thrower
			const dx = owner.x - s.x;
			const dy = owner.y - s.y;
			const dist = Math.hypot(dx, dy);
			if (dist < 22) return false;
			s.vx += ((dx / dist) * s.speed - s.vx) * Math.min(1, 8 * dt);
			s.vy += ((dy / dist) * s.speed - s.vy) * Math.min(1, 8 * dt);
		}
	} else if (s.kind === 'skull') {
		// Hunt the nearest Lantern who's still up
		let prey: Player | null = null;
		for (const p of players) if (!p.downed && (!prey || Math.hypot(p.x - s.x, p.y - s.y) < Math.hypot(prey.x - s.x, prey.y - s.y))) prey = p;
		if (prey) {
			const current = Math.atan2(s.vy, s.vx);
			const aim = bodyAim(prey, RED_HAND_LIFT);
			const want = Math.atan2(aim.y - s.y, aim.x - s.x);
			const diff = Math.atan2(Math.sin(want - current), Math.cos(want - current));
			const angle = current + Math.max(-SKULL_TURN_RATE * dt, Math.min(SKULL_TURN_RATE * dt, diff));
			s.vx = Math.cos(angle) * s.speed;
			s.vy = Math.sin(angle) * s.speed;
		}
	}

	s.x += s.vx * dt;
	s.y += s.vy * dt;
	s.travelled += Math.hypot(s.vx, s.vy) * dt;
	s.life -= dt;
	if (s.life <= 0) {
		if (s.kind === 'shell') shellBurst(w, s, players);
		// Plasma that falls short splatters into a burning puddle
		if (s.kind === 'plasma' && Math.random() < 0.3) addPuddle(w, s.x, s.y, 24, s.damage * 1.6);
		return false;
	}

	// Solid things. Energy walls take the hit (and stop it); saws bounce back once.
	// Their own Rage Walls let red shots through.
	const solid = w.obstacles.find((o) => o.kind !== 'redWall' && !s.ignore.includes(o) && boxOverlap(s.x, s.y, 3, 3, o));
	if (solid && s.kind === 'shell') {
		shellBurst(w, s, players);
		return false;
	}
	if (solid) {
		if (solid.kind === 'wall') damageWall(w, solid, s.kind === 'saw' ? s.damage * 2.5 : s.damage);
		impact(w, s);
		if (s.kind === 'saw' && !s.returning) {
			s.x = s.prevX;
			s.y = s.prevY;
			startReturn(s);
			s.vx = -s.vx;
			s.vy = -s.vy;
			return true;
		}
		return false;
	}

	// A Fortress dome: shots from outside stop at its edge
	if (w.fortresses.some((f) => Math.hypot(s.x - f.x, s.y - f.y) <= f.radius && Math.hypot(s.prevX - f.x, s.prevY - f.y) > f.radius)) {
		impact(w, s);
		return false;
	}

	for (const t of w.turrets) {
		if (Math.hypot(t.x - s.x, t.y - s.y) > 16) continue;
		if (s.kind === 'shell') {
			shellBurst(w, s, players);
			return false;
		}
		t.hp -= s.damage;
		impact(w, s);
		if (s.kind !== 'saw') return false;
	}

	for (const p of players) {
		if (p.downed || s.hit.includes(p)) continue;
		// Hits what it's drawn touching: the Lantern's body, not a spot at their feet
		if (!hitsBody(p, s.x, s.y, RED_HAND_LIFT)) continue;
		if (s.kind === 'shell') {
			shellBurst(w, s, players);
			return false;
		}
		const shielded = w.shields.some((sh) => sh.target === p) || inFortress(w, p.x, p.y);
		switch (s.kind) {
			case 'saw':
				s.hit.push(p);
				damagePlayer(w, p, s.damage, s.x - s.vx, s.y - s.vy, s.knockback);
				impact(w, s);
				continue;
			case 'hook':
				// A shield or Fortress breaks the hook off; otherwise it bites in and pulls
				damagePlayer(w, p, s.damage, s.x - s.vx, s.y - s.vy, 0);
				if (!shielded && !p.dash) w.red.chains.push({ owner, target: p, time: CHAIN_PULL_TIME });
				break;
			case 'orb':
				damagePlayer(w, p, s.damage, s.x - s.vx, s.y - s.vy, 0);
				if (!shielded && !p.dash && !w.red.cages.some((c) => c.target === p)) {
					w.red.cages.push({ target: p, x: p.x, y: p.y, time: CAGE_TIME, maxTime: CAGE_TIME });
				}
				break;
			default:
				damagePlayer(w, p, s.damage, s.x - s.vx, s.y - s.vy, s.knockback);
		}
		impact(w, s);
		return false;
	}
	return true;
}

/** A Rage Cannon shell bursts: hurts every Lantern, turret and energy wall in the blast. */
function shellBurst(w: ConstructWorld, s: RedShot, players: readonly Player[]) {
	const r = s.radius ?? 60;
	for (const p of players) {
		if (!p.downed && Math.hypot(p.x - s.x, p.y - s.y) <= r + 10) damagePlayer(w, p, s.damage, s.x, s.y, s.knockback);
	}
	for (const t of w.turrets) if (Math.hypot(t.x - s.x, t.y - s.y) <= r + 10) t.hp -= 45;
	for (const o of wallsNear(w, s.x, s.y, r)) damageWall(w, o, 70);
	w.effects.push({ kind: 'redBlast', x: s.x, y: s.y, age: 0, life: 0.55, radius: r });
}

function startReturn(s: RedShot) {
	s.returning = true;
	s.hit = []; // it can cut the same Lantern again on the way back
}

function impact(w: ConstructWorld, s: RedShot) {
	w.effects.push({ kind: 'redImpact', x: s.x, y: s.y, age: 0, life: 0.2, lift: RED_HAND_LIFT });
}

const inFortress = (w: ConstructWorld, x: number, y: number) => w.fortresses.some((f) => Math.hypot(x - f.x, y - f.y) <= f.radius);

function wallsNear(w: ConstructWorld, x: number, y: number, r: number): Obstacle[] {
	return w.obstacles.filter((o) => o.kind === 'wall' && Math.hypot(o.x + o.w / 2 - x, o.y + o.h / 2 - y) <= r + Math.max(o.w, o.h) / 2);
}

/** Energy walls (and Force Fields) can be worn down by red constructs. */
export function damageWall(w: ConstructWorld, o: Obstacle, damage: number) {
	if (o.hp === undefined) return;
	o.hp -= damage;
	if (o.hp <= 0) removeObstacle(w, o, 'burst');
}
