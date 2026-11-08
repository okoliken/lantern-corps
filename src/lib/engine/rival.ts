// A Lantern on the other side, with everything they have.
//
// When a Lantern fights you (Hal or John in a mirror match, Kilowog, Katma,
// Arisia, Boodikka, Sinestro before the yellow ring), they get their whole
// kit: the same ten constructs, willpower, cooldowns, bubble shield and
// signature move a player of that Lantern has, used by the same brain an AI
// partner uses (ally.ts).
//
// How it fits together:
//   body    the Enemy in the fight. It's what your constructs hit, and its
//           health is theirs. It doesn't think: it goes where the Lantern goes.
//   me      a Player of that Lantern, driven by AllyInput. It never takes
//           damage itself; it carries the kit, and moves the body.
//   world   a construct world of its own, so nothing it builds can heal or
//           shield you by mistake. In it, every Lantern on your side has a
//           stand-in: what its constructs do to the stand-in is done to you
//           (through your shields, like any hit), and the stand-in is put
//           back where you are every tick.

import { AllyInput } from './ally';
import { damagePlayer } from './combat';
import { createConstructWorld, updateConstructWorld, updatePlayerConstructs, type ConstructWorld } from './constructs/system';
import { updateSignature, updateSignatureWorld } from './constructs/signature';
import { isStanding } from './dummy';
import { createEnemy, type Enemy, type EnemyKind } from './enemies/enemies';
import { IDLE } from './input';
import { LANTERNS, type CrewId } from './lanterns';
import type { Obstacle } from './map';
import { createPlayer, updateFacing, updatePlayer, type Player, type WorldRules } from './player';
import { updateTargeting } from './targeting';
import { updateWillpower } from './willpower';

/**
 * Who fights with whose kit, and how hard that kit lands in the AI's hands
 * (`hit`): some kits are simply more than others with a brain that never
 * misses a cooldown (John's rifle, Sinestro's beam), Kilowog's is slow.
 * How experienced the Lantern is stays in the fight's might.
 */
export const RIVAL_KITS: Partial<Record<EnemyKind, { crew: CrewId; hit: number }>> = {
	sparHal: { crew: 'hal', hit: 0.8 },
	sparJohn: { crew: 'john', hit: 0.52 },
	kilowog: { crew: 'kilowog', hit: 1.35 },
	sparKatma: { crew: 'katma', hit: 0.8 },
	sparArisia: { crew: 'arisia', hit: 1.75 },
	sparBoodikka: { crew: 'boodikka', hit: 1 },
	sinestro: { crew: 'sinestro', hit: 0.27 }
};

/** A stand-in can take this much in a tick without going down (it's put back every tick). */
const STAND_IN_HP = 1e6;
/**
 * Player constructs are tuned against enemies with far more health than a
 * Lantern has, so a hit on you is this share of what it would do to them,
 * times how much the fight says this Lantern can hurt (its might).
 */
export const RIVAL_HIT = 0.045;

export interface Rival {
	body: Enemy;
	/** How hard their kit lands (RIVAL_KITS). */
	hit: number;
	me: Player;
	world: ConstructWorld;
	input: AllyInput;
	/** Your side's Lanterns, and who stands in for each in the rival's world. */
	standIns: Map<Player, Enemy>;
}

export function createRival(body: Enemy, { crew, hit }: { crew: CrewId; hit: number }, obstacles: Obstacle[], space: boolean): Rival {
	const world = createConstructWorld(obstacles, [], space);
	// It fights alone: the only Lantern on its side is itself
	const side: { players: Player[]; dummies: Enemy[]; constructs: ConstructWorld } = { players: [], dummies: world.dummies as Enemy[], constructs: world };
	const input = new AllyInput(side);
	input.varied = true;
	const me = createPlayer(-1, LANTERNS[crew], input, body.x, body.y);
	input.me = me;
	side.players.push(me);
	world.players = [me];
	body.puppet = true;
	return { body, hit, me, world, input, standIns: new Map() };
}

/**
 * One tick: put the stand-ins where your Lanterns are, let the rival read the
 * fight and use its kit, then do to you what it did to the stand-ins.
 */
export function updateRival(r: Rival, foes: readonly Player[], main: ConstructWorld, rules: WorldRules, dt: number, ring: (p: Player) => void) {
	const { body, me, world } = r;
	// Hits on the body push the Lantern (the body doesn't move on its own)
	me.vx += body.vx;
	me.vy += body.vy;
	body.vx = body.vy = 0;

	syncStandIns(r, foes);
	// The bubble on the body: what's left of it, after your hits
	const bubble = world.shields.find((s) => s.target === me);
	if (bubble) {
		if (!body.ward) bubble.hp = 0;
		else bubble.hp = Math.min(bubble.hp, body.ward.hp);
		if (bubble.hp <= 0) world.shields.splice(world.shields.indexOf(bubble), 1);
	}

	const held = body.caged > 0 || body.stun > 0;
	const intent = held ? { ...IDLE } : r.input.read();
	if (held) me.vx = me.vy = 0;
	updatePlayer(me, intent, dt, rules);
	if (intent.pointer) intent.pointer = { x: intent.pointer.x, y: intent.pointer.y + me.ringLift };
	updateTargeting(me, intent.target, { dummies: world.dummies, obstacles: world.obstacles, players: [me] }, 900, { pointer: intent.pointer, aimAssist: true });
	updateFacing(me, dt);
	ring(me);
	updateWillpower(me, dt, []);
	updatePlayerConstructs(me, intent, dt, world);
	updateSignature(me, intent, dt, world);
	updateConstructWorld(world, dt);
	updateSignatureWorld(world, dt);

	// Its bubble holds off your hits on the body
	const up = world.shields.find((s) => s.target === me);
	body.ward = up ? { hp: up.hp, maxHp: up.maxHp, life: Math.max(0.05, up.life) } : undefined;

	landOnFoes(r, main);
	// Damage numbers come from your side's hits, not the stand-ins'
	world.effects = world.effects.filter((e) => e.kind !== 'number');
	world.events.length = 0;
}

function syncStandIns(r: Rival, foes: readonly Player[]) {
	const { world, me } = r;
	for (const p of foes) {
		let s = r.standIns.get(p);
		if (p.downed || p.boarded) {
			if (s) {
				world.dummies.splice(world.dummies.indexOf(s), 1);
				r.standIns.delete(p);
			}
			continue;
		}
		if (!s) {
			s = createEnemy('rageGrunt', p.x, p.y);
			r.standIns.set(p, s);
			world.dummies.push(s);
		}
		s.x = s.prevX = s.homeX = p.x;
		s.y = s.prevY = s.homeY = p.y;
		s.vx = s.vy = 0;
		s.hp = s.maxHp = STAND_IN_HP;
		s.caged = 0;
		s.stun = 0;
		// So the brain knows who's after it, and who's winding up
		s.brain.target = p.attackTarget?.kind === 'enemy' && p.attackTarget.dummy === r.body ? me : null;
		s.brain.state = p.firing || p.actionShape ? 'act' : 'idle';
	}
	for (const [p, s] of r.standIns) {
		if (foes.includes(p)) continue;
		world.dummies.splice(world.dummies.indexOf(s), 1);
		r.standIns.delete(p);
	}
}

/** What the rival's constructs did to each stand-in, done to the Lantern it stands in for. */
function landOnFoes(r: Rival, main: ConstructWorld) {
	const scale = RIVAL_HIT * r.hit * r.body.brain.might;
	for (const [p, s] of r.standIns) {
		const lost = STAND_IN_HP - s.hp;
		const shove = Math.hypot(s.vx, s.vy);
		if (lost > 0.01) damagePlayer(main, p, lost * scale, s.x - s.vx, s.y - s.vy, 0);
		// A knock or a pull sets how fast you're going (a chain pulls every tick: added up, it would fling you), and a bubble stops it
		const bubbled = main.shields.some((sh) => sh.target === p);
		if (shove > 1 && !bubbled && shove > Math.hypot(p.vx, p.vy)) {
			p.vx = s.vx;
			p.vy = s.vy;
		}
		// A cage or a stun on the stand-in holds you
		if (s.caged > 0 || s.stun > 0) {
			p.vx = p.vy = 0;
			p.chilled = Math.max(p.chilled, 0.25);
		}
		s.hp = STAND_IN_HP;
		s.vx = s.vy = 0;
		if (!isStanding(s)) s.down = 0;
	}
}

/** The body goes where the Lantern is (instead of moving itself). */
export function followRival(r: Rival) {
	const { body, me } = r;
	body.prevX = me.prevX;
	body.prevY = me.prevY;
	body.x = me.x;
	body.y = me.y;
	body.dir = me.dir;
	body.brain.aimX = me.aimX;
	body.brain.aimY = me.aimY;
	body.brain.state = 'idle';
}
