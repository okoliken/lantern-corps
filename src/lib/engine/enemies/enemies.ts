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
import type { Player } from '../player';
import { attackStarted, mayAttack, updatePressure, type Attacker } from './director';
import { ABILITIES, cancelAbility, startAbility, updateAbility, updateRedConstructs, type AbilityDef, type AbilityId } from './redConstructs';
import { chooseGoal, clearShot, navigate, perceive, tryDodge, wander, type Goal } from './tactics';

export type EnemyKind = Exclude<TargetKind, 'dummy'>;
export type EnemyState = 'idle' | 'move' | 'windup' | 'act' | 'recover';
export type Role = 'berserker' | 'hunter' | 'gunner';
/** How a faction thinks: rage never backs down and gets faster when hurt; machines stay cold and regroup. */
export type Mind = 'rage' | 'machine';

export interface EnemyDef {
	kind: EnemyKind;
	name: string;
	faction: 'red' | 'manhunter';
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
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
	rageGrunt: {
		kind: 'rageGrunt',
		name: 'Rage Grunt',
		faction: 'red',
		description: "Atrocitus's foot soldiers. Each fights its own way: Berserkers charge, Hunters chain and flank, Gunners blast from range.",
		mind: 'rage',
		hp: 120,
		speed: 150,
		accel: 5,
		sight: 640,
		poise: 34,
		scale: 1,
		agility: 0.7
	},
	// Stage 2 and 3 fill in their behaviors; the numbers are placeholders until then.
	plasmaSpitter: {
		kind: 'plasmaSpitter',
		name: 'Plasma Spitter',
		faction: 'red',
		description: 'Keeps its distance and spits burning plasma that leaves fire on the ground and melts constructs.',
		mind: 'rage',
		hp: 80,
		speed: 130,
		accel: 4,
		sight: 620,
		poise: 26,
		scale: 0.95,
		agility: 0.6
	},
	rageBrute: {
		kind: 'rageBrute',
		name: 'Rage Brute',
		faction: 'red',
		description: 'Huge and slow. Winds up a charge that smashes through energy walls, and is dazed if it crashes into something.',
		mind: 'rage',
		hp: 420,
		speed: 100,
		accel: 3,
		sight: 560,
		poise: 90,
		scale: 1.35,
		agility: 0.15
	}
};

export interface RoleDef {
	name: string;
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
		description: 'Charges in with Rage Claws, leaps into a Rage Slam, and roars to blow apart shields and turrets.',
		abilities: ['roar', 'slam', 'claws'],
		range: 150,
		speed: 1.1,
		hp: 1.1,
		leans: { aggression: 0.3, caution: -0.2 }
	},
	hunter: {
		name: 'Hunter',
		description: 'Circles to your flank, drags you in with a Barbed Chain, then goes for the claws.',
		abilities: ['chain', 'claws'],
		range: 200,
		speed: 1.05,
		hp: 1,
		leans: { aggression: 0.15, patience: 0.2 }
	},
	gunner: {
		name: 'Gunner',
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
	/** Poise multiplier: tougher enemies (the demo's packs) are harder to stagger too. */
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
	/** Its own clock, for idle drift and bobbing. */
	clock: number;
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

function rollPersonality(role: Role, rand: () => number): Personality {
	const leans = ROLES[role].leans;
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
	kit: AbilityId[] = ROLES[role].abilities
): Enemy {
	const def = ENEMIES[kind];
	const hp = Math.round(def.hp * ROLES[role].hp);
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
			persona: rollPersonality(role, rand),
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
			clock: rand() * 100
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
	return ROLES[e.brain.role].range;
}

// ------------------------------------------------------------------- brains

/** One tick for every enemy: think, then the red constructs move. Moving the bodies happens in updateDummy. */
export function updateEnemies(w: ConstructWorld, players: readonly Player[], dt: number) {
	const pack = w.dummies.filter((d): d is Enemy => isEnemy(d) && isStanding(d));
	updatePressure(w.pressure, players, dt);
	const attackers: (Attacker & { e: Enemy })[] = pack.map((e) => ({ e, target: e.brain.target, attack: attackOf(e) }));
	for (const e of pack) think(e, pack, attackers, w, players, dt);
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

	// Caged or stunned: can't act, and whatever it was doing is cancelled
	if (e.caged > 0 || e.stun > 0) {
		if (b.state === 'windup' || b.state === 'act') interrupt(e, w, 0.2);
		b.timer = Math.max(b.timer, 0.2);
		steer(e, 0, 0, def.accel * 2, dt);
		return;
	}

	perceive(e, pack, players, w, dt);
	const t = b.target;

	switch (b.state) {
		case 'idle': {
			wander(e, dt);
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
			if (b.goalTimer <= 0) chooseGoal(e, t, pack, w);
			navigate(e, t, dt, w);
			tryDodge(e, w);
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
			if (t && !a.melee && b.timer > a.windup * 0.3) aimAt(e, t);
			if (t) face(e, t.x - e.x);
			b.timer -= dt;
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

	// Keep the director's picture of who's attacking up to date
	const entry = attackers.find((a) => a.e === e);
	if (entry) {
		entry.target = b.target;
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
	if (melee && !b.engaged && b.breather === 0 && wantsIn) {
		const holders = pack.filter((o) => o !== e && o.brain.target === t && o.brain.engaged).length;
		if (holders < MELEE_SLOTS) b.engaged = true;
	}

	// Can't see them: nothing to aim at
	if (!b.sees) return;

	const me = attackers.find((a) => a.e === e) ?? { target: t, attack: null };
	const range = rangeOf(e);
	// Least-used first (ties keep the kit's order), so each enemy shows off its whole kit
	const order = [...b.kit].sort((x, y) => b.uses[x] - b.uses[y]);
	let blocked = false;
	for (const id of order) {
		const a = ABILITIES[id];
		if (b.cooldowns[id] > 0) continue;
		if (dist < a.minRange || dist > a.maxRange + DUMMY_HALF_W) continue;
		if (a.melee && !b.engaged) continue;
		// Ranged fighters with nothing for close up back off to their range before shooting
		if (!melee && dist < range * 0.7) continue;
		if (id === 'roar' && !roarWorthIt(e, w, players)) continue;
		// Something in the way: don't waste it on a rock, go round
		if (needsClearShot(a) && !clearShot(e, t, w)) {
			blocked = true;
			continue;
		}
		// Wait for a turn to attack this Lantern
		if (!mayAttack(w.pressure, me, t, a, attackers, w.redTempo)) continue;
		if (Math.random() > Math.min(1, a.chance * w.redTempo)) continue;
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

function beginWindup(e: Enemy, id: AbilityId, t: Player) {
	const b = e.brain;
	const a = ABILITIES[id];
	b.state = 'windup';
	b.ability = id;
	b.timer = a.windup;
	b.hitDone = false;
	b.fired = 0;
	aimAt(e, t);
	// The landing spot, no further than the construct reaches
	const dx = t.x - e.x;
	const dy = t.y - e.y;
	const dist = Math.hypot(dx, dy) || 1;
	const reach = Math.min(dist, a.maxRange);
	b.markX = e.x + (dx / dist) * reach;
	b.markY = e.y + (dy / dist) * reach;
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
			// Push harder the more they overlap (a soft spring, not a hard wall)
			const push = (want - dist) * 90 * dt;
			a.vx -= (dx / dist) * push;
			a.vy -= (dy / dist) * push;
			c.vx += (dx / dist) * push;
			c.vy += (dy / dist) * push;
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
