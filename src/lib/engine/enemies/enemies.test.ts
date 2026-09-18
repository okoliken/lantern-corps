import { describe, expect, it } from 'vitest';
import { DOWNED_TIME, HIT_INVULN, REGEN_DELAY, damagePlayer, revivePlayer, updatePlayerCombat } from '../combat';
import { createConstructWorld, updateConstructWorld, updatePlayerConstructs, type ConstructWorld } from '../constructs/system';
import { hitDummy, isStanding, updateDummy } from '../dummy';
import { IDLE } from '../input';
import { LANTERNS } from '../lanterns';
import { bodyAim, createPlayer, hitsBody, updatePlayer, type Player } from '../player';
import type { Obstacle } from '../map';
import { ATTACK_BUDGET } from './director';
import { ENEMIES, ENEMY_SPACING, MAX_RED_TURRETS, MELEE_SLOTS, createEnemy, updateEnemies, type Enemy, type Role } from './enemies';
import { clearShot, tryDodge } from './tactics';
import { ASSAULT_PER_EXTRA_LANTERN, ASSAULT_SIZE } from './squad';
import { ABILITIES, RED_HAND_LIFT, randomKit, type AbilityId } from './redConstructs';

const DT = 1 / 60;
const lantern = (x = 0, y = 0) => createPlayer(0, LANTERNS.hal, { read: () => IDLE }, x, y);

function run(w: ConstructWorld, players: Player[], seconds: number, each?: () => void) {
	for (let i = 0; i < Math.round(seconds * 60); i++) {
		for (const p of players) {
			updatePlayerCombat(p, DT);
			updatePlayer(p, IDLE, DT);
		}
		updateEnemies(w, players, DT);
		for (const d of w.dummies) updateDummy(d, DT, w.obstacles, false);
		each?.();
	}
}

/** A grunt of a role, ready to act right away (no spawn grace). */
function grunt(x: number, y: number, role: Role = 'berserker'): Enemy {
	const e = createEnemy('rageGrunt', x, y, role);
	for (const id in e.brain.cooldowns) e.brain.cooldowns[id as AbilityId] = 0;
	e.brain.think = 0;
	return e;
}

/** Skip straight to the end of a windup: the construct starts next tick. */
function force(e: Enemy, id: AbilityId, t: Player) {
	const b = e.brain;
	const dx = t.x - e.x;
	const dy = t.y - e.y;
	const len = Math.hypot(dx, dy) || 1;
	Object.assign(b, { state: 'windup', ability: id, timer: 1e-6, target: t, aimX: dx / len, aimY: dy / len });
	const reach = Math.min(len, ABILITIES[id].maxRange);
	b.markX = e.x + (dx / len) * reach;
	b.markY = e.y + (dy / len) * reach;
}

describe('Lanterns taking damage', () => {
	it('lowers health, flinches, and gives a moment of invulnerability', () => {
		const w = createConstructWorld([], []);
		const p = lantern();
		expect(damagePlayer(w, p, 20, 50, 0)).toBe(20);
		expect(p.health).toBe(p.maxHealth - 20);
		expect(p.hurtTimer).toBeGreaterThan(0);
		// A second hit right away does nothing
		expect(damagePlayer(w, p, 20, 50, 0)).toBe(0);
		run(w, [p], HIT_INVULN + 0.05);
		expect(damagePlayer(w, p, 20, 50, 0)).toBe(20);
	});

	it('out of the fight for a few seconds, health slowly comes back', () => {
		const w = createConstructWorld([], []);
		const p = lantern();
		damagePlayer(w, p, 60, 50, 0);
		const hurt = p.health;
		run(w, [p], REGEN_DELAY - 0.5);
		expect(p.health).toBe(hurt);
		run(w, [p], 3);
		expect(p.health).toBeGreaterThan(hurt);
		expect(p.health).toBeLessThanOrEqual(p.maxHealth);
	});

	it('the bubble shield takes the hit first', () => {
		const w = createConstructWorld([], []);
		const p = lantern();
		w.shields.push({ owner: p, target: p, hp: 50, maxHp: 50, life: 10, maxLife: 10, ripple: 0 });
		expect(damagePlayer(w, p, 30, 50, 0)).toBe(0);
		expect(p.health).toBe(p.maxHealth);
	});

	it('knockback pushes away from the attacker', () => {
		const w = createConstructWorld([], []);
		const p = lantern();
		damagePlayer(w, p, 10, 50, 0, 300);
		expect(p.vx).toBeLessThan(0);
	});

	it('at 0 health the Lantern goes down, then can get back up', () => {
		const w = createConstructWorld([], []);
		const p = lantern();
		damagePlayer(w, p, 999, 50, 0);
		expect(p.downed).toBe(true);
		let ready = false;
		for (let i = 0; i < Math.round((DOWNED_TIME + 0.1) * 60); i++) ready = updatePlayerCombat(p, DT) || ready;
		expect(ready).toBe(true);
		revivePlayer(p, 10, 20);
		expect(p.downed).toBe(false);
		expect(p.health).toBe(p.maxHealth);
		expect(p.invuln).toBeGreaterThan(0);
	});

	it('a downed Lantern takes no more damage', () => {
		const w = createConstructWorld([], []);
		const p = lantern();
		damagePlayer(w, p, 999, 50, 0);
		p.invuln = 0;
		expect(damagePlayer(w, p, 10, 50, 0)).toBe(0);
	});
});

describe('Red Lantern brains', () => {
	it('notices a Lantern in sight and closes in', () => {
		const e = createEnemy('rageGrunt', 500, 0);
		const w = createConstructWorld([], [e]);
		run(w, [lantern()], 0.8);
		expect(e.brain.state).not.toBe('idle');
		expect(e.x).toBeLessThan(480);
	});

	it('ignores Lanterns out of sight', () => {
		const e = createEnemy('rageGrunt', ENEMIES.rageGrunt.sight + 200, 0);
		const w = createConstructWorld([], [e]);
		run(w, [lantern()], 1);
		expect(e.brain.state).toBe('idle');
	});

	it('does not attack the instant it appears (short grace period)', () => {
		const e = createEnemy('rageGrunt', 40, 0);
		const w = createConstructWorld([], [e]);
		run(w, [lantern()], 0.1);
		expect(e.brain.state).not.toBe('windup');
	});

	it('winds up its claws (a visible tell) before they land', () => {
		const e = grunt(40, 0);
		const w = createConstructWorld([], [e]);
		const p = lantern();
		run(w, [p], 0.05);
		expect(e.brain.state).toBe('windup');
		expect(e.brain.ability).toBe('claws');
		expect(p.health).toBe(p.maxHealth);
		run(w, [p], ABILITIES.claws.windup + 0.1);
		expect(p.health).toBeLessThan(p.maxHealth);
	});

	it('can be dodged: moving away during the windup avoids the hit', () => {
		const e = grunt(40, 0);
		const w = createConstructWorld([], [e]);
		const p = lantern();
		run(w, [p], 0.05);
		expect(e.brain.state).toBe('windup');
		p.x = -300;
		run(w, [p], ABILITIES.claws.windup + 0.1);
		expect(p.health).toBe(p.maxHealth);
	});

	it('a burst of damage during a windup staggers it out of the attack', () => {
		const e = grunt(40, 0);
		const w = createConstructWorld([], [e]);
		const p = lantern();
		run(w, [p], 0.05);
		expect(e.brain.state).toBe('windup');
		e.hp -= ENEMIES.rageGrunt.poise + 5;
		run(w, [p], ABILITIES.claws.windup + 0.1);
		expect(p.health).toBe(p.maxHealth);
	});

	it('stunned enemies stop attacking', () => {
		const e = grunt(40, 0);
		e.stun = 2;
		const w = createConstructWorld([], [e]);
		const p = lantern();
		run(w, [p], 1.5);
		expect(p.health).toBe(p.maxHealth);
	});

	it(`only ${MELEE_SLOTS} get in close on one Lantern at a time; the rest wait their turn`, () => {
		const pack = [0, 1, 2, 3].map((i) => grunt(Math.cos(i * 1.6) * 160, Math.sin(i * 1.6) * 160));
		const w = createConstructWorld([], pack);
		const p = lantern();
		let most = 0;
		run(w, [p], 4, () => {
			p.invuln = 1; // keep them fighting
			most = Math.max(most, pack.filter((e) => e.brain.engaged).length);
		});
		expect(most).toBeGreaterThan(0);
		expect(most).toBeLessThanOrEqual(MELEE_SLOTS);
	});

	it('a pack spreads out instead of stacking on one spot', () => {
		const pack = [grunt(200, 0), grunt(200, 0), grunt(200, 0)];
		const w = createConstructWorld([], pack);
		const p = lantern();
		run(w, [p], 1, () => (p.invuln = 1));
		// A lunge can briefly bring two together; on average over a second they stay apart
		let total = 0;
		let samples = 0;
		run(w, [p], 1, () => {
			p.invuln = 1;
			for (let i = 0; i < pack.length; i++)
				for (let j = i + 1; j < pack.length; j++) total += Math.hypot(pack[i].x - pack[j].x, pack[i].y - pack[j].y);
			samples += 3;
		});
		expect(total / samples).toBeGreaterThan(ENEMY_SPACING);
	});

	it('splits up between two Lanterns instead of all chasing one', () => {
		const pack = [grunt(0, -40), grunt(0, 0), grunt(0, 40), grunt(10, 20)];
		const w = createConstructWorld([], pack);
		const hal = lantern(-150, 0);
		const john = createPlayer(1, LANTERNS.john, { read: () => IDLE }, 150, 0);
		run(w, [hal, john], 0.5, () => (hal.invuln = john.invuln = 1));
		expect(pack.filter((e) => e.brain.target === hal).length).toBeGreaterThan(0);
		expect(pack.filter((e) => e.brain.target === john).length).toBeGreaterThan(0);
	});

	it('gunners keep their distance', () => {
		const e = grunt(90, 0, 'gunner');
		const w = createConstructWorld([], [e]);
		const p = lantern();
		run(w, [p], 2.5, () => (p.invuln = 1));
		expect(Math.hypot(e.x - p.x, e.y - p.y)).toBeGreaterThan(180);
	});

	it('mixes up its constructs instead of repeating the same one', () => {
		const e = grunt(250, 0, 'gunner');
		const w = createConstructWorld([], [e]);
		w.redTempo = 1.8;
		const p = lantern();
		run(w, [p], 12, () => (p.invuln = 1));
		expect(e.brain.uses.blast).toBeGreaterThan(0);
		expect(e.brain.uses.saw).toBeGreaterThan(0);
	});

	it('gets faster as it gets hurt (rage)', () => {
		const calm = createEnemy('rageGrunt', 600, 0);
		const angry = createEnemy('rageGrunt', 600, 0);
		angry.hp = angry.maxHp * 0.2;
		angry.brain.lastHp = angry.hp;
		const w1 = createConstructWorld([], [calm]);
		const w2 = createConstructWorld([], [angry]);
		run(w1, [lantern()], 0.6);
		run(w2, [lantern()], 0.6);
		expect(angry.x).toBeLessThan(calm.x);
	});

	it('does not go after downed Lanterns', () => {
		const e = grunt(200, 0);
		const w = createConstructWorld([], [e]);
		const p = lantern();
		p.downed = true;
		p.downTimer = 99;
		run(w, [p], 1);
		expect(e.brain.state).toBe('idle');
	});

	it('stays defeated and then leaves the world (no respawning like dummies)', () => {
		const e: Enemy = createEnemy('rageGrunt', 0, 0);
		const w = createConstructWorld([], [e]);
		e.hp = 0;
		e.down = 0.1;
		expect(isStanding(e)).toBe(false);
		run(w, [], 0.2);
		expect(e.gone).toBe(true);
	});
});

describe('enemies thinking for themselves', () => {
	it(`attacks take turns: at most ${ATTACK_BUDGET} coming at one Lantern at once, never starting together`, () => {
		const pack = [0, 1, 2, 3, 4].map((i) => grunt(Math.cos(i * 1.25) * 260, Math.sin(i * 1.25) * 260, 'gunner'));
		const w = createConstructWorld([], pack);
		const p = lantern();
		let most = 0;
		const starts: number[] = [];
		let tick = 0;
		run(w, [p], 8, () => {
			tick++;
			p.invuln = 1;
			p.health = p.maxHealth;
			const attacking = pack.filter((e) => e.brain.state === 'windup' || e.brain.state === 'act');
			most = Math.max(most, attacking.length);
			for (const e of pack) if (e.brain.state === 'windup' && e.brain.timer > ABILITIES[e.brain.ability!].windup - DT * 0.5) starts.push(tick * DT);
		});
		expect(starts.length).toBeGreaterThan(3);
		expect(most).toBeLessThanOrEqual(ATTACK_BUDGET);
		const gaps = starts.slice(1).map((t, i) => t - starts[i]);
		expect(Math.min(...gaps)).toBeGreaterThan(0.2);
	});

	it("doesn't see a Lantern behind an asteroid, but getting shot puts it on the hunt", () => {
		const rock: Obstacle = { kind: 'asteroid', x: 150, y: -60, w: 80, h: 120, height: 40, blocksFlying: true, seed: 0 };
		const e = createEnemy('rageGrunt', 400, 0);
		const w = createConstructWorld([rock], [e]);
		const p = lantern();
		run(w, [p], 0.6);
		expect(e.brain.target).toBeNull();
		e.hp -= 5; // shot from out of sight
		run(w, [p], 0.6);
		expect(e.brain.target).toBe(p);
		expect(e.brain.sees).toBe(false);
	});

	it('spotting a Lantern calls nearby allies over', () => {
		const rock: Obstacle = { kind: 'asteroid', x: 300, y: 60, w: 60, h: 300, height: 40, blocksFlying: true, seed: 0 };
		const spotter = createEnemy('rageGrunt', 250, 0);
		const friend = createEnemy('rageGrunt', 450, 200); // behind the rock, can't see
		const w = createConstructWorld([rock], [spotter, friend]);
		const p = lantern();
		run(w, [p], 1.2);
		expect(spotter.brain.target).toBe(p);
		expect(friend.brain.target).toBe(p);
	});

	it('a quick, careful enemy sidesteps a shot coming straight at it', () => {
		let dodged = 0;
		for (let trial = 0; trial < 20; trial++) {
			const e = createEnemy('rageGrunt', 300, 0, 'gunner');
			e.brain.persona.caution = 1;
			e.brain.dodgeIn = 0;
			e.brain.state = 'move';
			const w = createConstructWorld([], [e]);
			const p = lantern();
			const bolt = { kind: 'bolt', owner: p, x: 200, y: 0, prevX: 200, prevY: 0, vx: 800, vy: 0, life: 1, damage: 10, knockback: 0, ignore: [], lift: 30 };
			w.projectiles.push(bolt as unknown as (typeof w.projectiles)[number]);
			tryDodge(e, w);
			if (Math.abs(e.vy) > 100) dodged++;
		}
		expect(dodged).toBeGreaterThan(5);
		expect(dodged).toBeLessThan(20); // not superhuman: sometimes it doesn't react
	});

	it("won't waste a shot on a rock: with no clear line it goes round instead", () => {
		const rock: Obstacle = { kind: 'rock', x: 120, y: -40, w: 40, h: 80, height: 20, blocksFlying: false, seed: 0 };
		const e = grunt(300, 0, 'gunner');
		const w = createConstructWorld([rock], [e]);
		const p = lantern();
		// Rocks are low: it can see over them, but its shots would hit it
		expect(clearShot(e, p, w)).toBe(false);
		run(w, [p], 0.4);
		expect(e.brain.state).not.toBe('windup');
	});
});

describe('Red Lantern constructs', () => {
	const wall = (x: number, y: number) => ({
		kind: 'wall' as const, x, y, w: 18, h: 120, height: 46, blocksFlying: true, seed: 0, hp: 300, maxHp: 300, life: 20, maxLife: 20
	});

	it('Rage Blast fires a burst of bolts that hurt', () => {
		const e = grunt(250, 0, 'gunner');
		const w = createConstructWorld([], [e]);
		const p = lantern();
		force(e, 'blast', p);
		run(w, [p], 1);
		expect(p.health).toBeLessThan(p.maxHealth);
	});

	it('an energy wall blocks red bolts, and takes the damage instead', () => {
		const e = grunt(250, 0, 'gunner');
		const shield = wall(100, -60);
		const w = createConstructWorld([shield], [e]);
		const p = lantern();
		force(e, 'blast', p);
		run(w, [p], 1);
		expect(p.health).toBe(p.maxHealth);
		expect(shield.hp).toBeLessThan(300);
	});

	it('Rage Saw cuts on the way out AND on the way back', () => {
		const e = grunt(200, 0, 'gunner');
		const w = createConstructWorld([], [e]);
		const p = lantern();
		force(e, 'saw', p);
		run(w, [p], 0.05);
		e.stun = 5; // stays put, so the saw flies straight back through the Lantern
		run(w, [p], 2.5);
		expect(p.health).toBeCloseTo(p.maxHealth - 2 * ABILITIES.saw.damage, 5);
	});

	it('Barbed Chain drags a Lantern in', () => {
		const e = grunt(260, 0, 'hunter');
		const w = createConstructWorld([], [e]);
		const p = lantern();
		force(e, 'chain', p);
		run(w, [p], 0.5);
		expect(p.x).toBeGreaterThan(100);
	});

	it('a bubble shield breaks the Barbed Chain off', () => {
		const e = grunt(260, 0, 'hunter');
		const w = createConstructWorld([], [e]);
		const p = lantern();
		w.shields.push({ owner: p, target: p, hp: 120, maxHp: 120, life: 10, maxLife: 10, ripple: 0 });
		force(e, 'chain', p);
		run(w, [p], 0.5);
		expect(Math.abs(p.x)).toBeLessThan(20);
	});

	it('Rage Slam lands where the Lantern WAS: moving out of the circle avoids it', () => {
		const stay = lantern();
		const e1 = grunt(200, 0);
		const w1 = createConstructWorld([], [e1]);
		force(e1, 'slam', stay);
		run(w1, [stay], ABILITIES.slam.active + 0.1);
		expect(stay.health).toBeLessThan(stay.maxHealth);

		const dodge = lantern();
		const e2 = grunt(200, 0);
		const w2 = createConstructWorld([], [e2]);
		force(e2, 'slam', dodge);
		run(w2, [dodge], 0.05);
		dodge.x = -200;
		run(w2, [dodge], ABILITIES.slam.active + 0.1);
		expect(dodge.health).toBe(dodge.maxHealth);
	});

	it('Rage Roar shreds shields and turrets nearby', () => {
		const e = grunt(60, 0);
		const w = createConstructWorld([], [e]);
		const p = lantern();
		w.shields.push({ owner: p, target: p, hp: 30, maxHp: 120, life: 10, maxLife: 10, ripple: 0 });
		w.turrets.push({ owner: p, def: {} as never, x: 90, y: 30, aim: 0, cooldown: 99, life: 10, maxLife: 10, hp: 60, maxHp: 80 });
		force(e, 'roar', p);
		run(w, [p], 0.1);
		expect(w.shields.length).toBe(0);
		expect(w.turrets[0]?.hp ?? 0).toBeLessThanOrEqual(0);
	});

	it("red shots can't get into John's Fortress", () => {
		const e = grunt(300, 0, 'gunner');
		const w = createConstructWorld([], [e]);
		const p = lantern();
		w.fortresses.push({ owner: p, x: 0, y: 0, radius: 120, life: 10, maxLife: 10, turrets: [] });
		force(e, 'blast', p);
		run(w, [p], 1);
		expect(p.health).toBe(p.maxHealth);
	});

	it('Rage Meteors mark the ground first, then hit whoever stays in the circle', () => {
		const e = grunt(400, 0, 'gunner');
		const w = createConstructWorld([], [e]);
		const p = lantern();
		force(e, 'meteors', p);
		run(w, [p], 0.3);
		expect(w.red.strikes.filter((s) => s.kind === 'meteor').length).toBe(4);
		expect(p.health).toBe(p.maxHealth);
		e.stun = 5;
		run(w, [p], 1.6);
		expect(p.health).toBeLessThan(p.maxHealth);
	});

	it('Rage Prison locks a Lantern in place', () => {
		const e = grunt(250, 0, 'hunter');
		const w = createConstructWorld([], [e]);
		const p = lantern();
		force(e, 'cage', p);
		run(w, [p], 0.6);
		expect(w.red.cages).toHaveLength(1);
		p.vx = 500;
		run(w, [p], 0.2);
		expect(Math.abs(p.x - w.red.cages[0].x)).toBeLessThan(1);
	});

	it('an energy wall stops a Rage Beam and burns', () => {
		const e = grunt(300, 0, 'gunner');
		const barrier = wall(140, -60);
		const w = createConstructWorld([barrier], [e]);
		const p = lantern();
		force(e, 'beam', p);
		run(w, [p], 1);
		expect(p.health).toBe(p.maxHealth);
		expect(barrier.hp).toBeLessThan(300);
	});

	it('Rage Charge barrels through a Lantern in its path', () => {
		const e = grunt(250, 0, 'berserker');
		const w = createConstructWorld([], [e]);
		const p = lantern();
		force(e, 'charge', p);
		run(w, [p], 0.6);
		expect(p.health).toBeLessThan(p.maxHealth);
		expect(e.x).toBeLessThan(0);
	});

	it('might makes red constructs hit harder', () => {
		const hits = [1, 2].map((might) => {
			const e = grunt(40, 0);
			e.brain.might = might;
			const w = createConstructWorld([], [e]);
			const p = lantern();
			force(e, 'claws', p);
			run(w, [p], 0.1);
			return p.maxHealth - p.health;
		});
		expect(hits[1]).toBeCloseTo(hits[0] * 2, 5);
	});
});

describe('machines', () => {
	const drone = (x: number, y: number) => {
		const e = createEnemy('manhunterDrone', x, y);
		for (const id in e.brain.cooldowns) e.brain.cooldowns[id as AbilityId] = 0;
		e.brain.think = 0;
		return e;
	};

	it('a Manhunter Drone hangs back at range and shoots eye lasers', () => {
		const e = drone(300, 0);
		const w = createConstructWorld([], [e]);
		const p = lantern();
		let lasers = 0;
		run(w, [p], 4, () => {
			p.invuln = 0;
			p.health = p.maxHealth;
			lasers = Math.max(lasers, w.red.shots.filter((s) => s.kind === 'laser').length);
		});
		expect(lasers).toBeGreaterThan(0);
		expect(Math.hypot(e.x - p.x, e.y - p.y)).toBeGreaterThan(180);
	});

	it('a drone shoves away a Lantern who gets right up close', () => {
		const e = drone(60, 0);
		e.brain.kit = ['pulse'];
		const w = createConstructWorld([], [e]);
		const p = lantern();
		// The Lantern keeps crowding it until it reacts
		let shoved = false;
		run(w, [p], 3, () => {
			if (p.health < p.maxHealth) shoved = true;
			if (!shoved) {
				p.x = e.x - 55;
				p.y = e.y;
			}
		});
		expect(shoved).toBe(true);
		expect(Math.hypot(e.x - p.x, e.y - p.y)).toBeGreaterThan(90);
	});

	it('damaged drones pull back instead of fighting to the end (machines, not rage)', () => {
		let retreated = 0;
		for (let i = 0; i < 12; i++) {
			const e = drone(250, 0);
			e.hp = e.maxHp * 0.3;
			e.brain.lastHp = e.hp;
			e.brain.persona.caution = 1;
			const w = createConstructWorld([], [e]);
			const p = lantern();
			run(w, [p], 0.5, () => (p.invuln = 1));
			if (e.brain.goal === 'retreat') retreated++;
		}
		expect(retreated).toBeGreaterThan(6);
	});

	it('a Red Lantern fighter never stops: it makes passes, strafing along its nose', () => {
		const e = createEnemy('redFighter', 500, 0);
		e.brain.cooldowns.strafe = 0;
		const w = createConstructWorld([], [e]);
		const p = lantern();
		let slowest = Infinity;
		let strafed = false;
		let ticks = 0;
		run(w, [p], 5, () => {
			p.invuln = 1;
			// (after getting up to speed from a standstill)
			if (++ticks > 60) slowest = Math.min(slowest, Math.hypot(e.vx, e.vy));
			if (e.brain.ability === 'strafe' && e.brain.state === 'act') strafed = true;
		});
		expect(strafed).toBe(true);
		expect(slowest).toBeGreaterThan(100);
	});

	it("a fighter's laser flies where its nose points", () => {
		const e = createEnemy('redFighter', 300, 0);
		e.brain.heading = Math.PI;
		const w = createConstructWorld([], [e]);
		const p = lantern();
		force(e, 'strafe', p);
		run(w, [p], 0.1);
		const laser = w.red.shots.find((s) => s.kind === 'laser')!;
		expect(laser.vx).toBeLessThan(0);
		expect(Math.abs(laser.vy)).toBeLessThan(Math.abs(laser.vx) * 0.2);
	});
});

describe('lieutenants from the animated series', () => {
	it('Skallox transforms when badly hurt: bigger, faster, harder hitting', () => {
		const e = createEnemy('skallox', 300, 0);
		const w = createConstructWorld([], [e]);
		const p = lantern();
		const might = e.brain.might;
		run(w, [p], 0.2, () => (p.invuln = 1));
		expect(e.brain.transformed).toBe(false);
		e.hp = e.maxHp * 0.45;
		run(w, [p], 0.5, () => (p.invuln = 1));
		expect(e.brain.transformed).toBe(true);
		expect(e.brain.might).toBeGreaterThan(might);
		expect(w.effects.some((fx) => fx.kind === 'callout' && fx.text?.includes('TRANSFORMS'))).toBe(true);
	});

	it("Bleez climbs into the air on her dive's windup, then comes down through the Lantern", () => {
		const e = createEnemy('bleez', 250, 0);
		const w = createConstructWorld([], [e]);
		const p = lantern();
		Object.assign(e.brain, { state: 'windup', ability: 'swoop', timer: ABILITIES.swoop.windup, target: p, aimX: -1, aimY: 0 });
		run(w, [p], ABILITIES.swoop.windup * 0.9);
		expect(e.brain.air).toBeGreaterThan(0.4);
		run(w, [p], ABILITIES.swoop.active + 0.3);
		expect(p.health).toBeLessThan(p.maxHealth);
		expect(e.brain.air).toBe(0);
	});

	it("signature and machine moves never turn up in a Red Lantern grunt's random kit", () => {
		for (let i = 0; i < 200; i++) {
			for (const role of ['berserker', 'hunter', 'gunner'] as const) {
				for (const id of randomKit(role)) expect(['swoop', 'eyeLaser', 'sweep', 'pulse', 'strafe', 'bombs']).not.toContain(id);
			}
		}
	});
});

describe('squads: a big pack takes turns', () => {
	const ring7 = () => [0, 1, 2, 3, 4, 5, 6].map((i) => grunt(Math.cos(i * 0.9) * 330, Math.sin(i * 0.9) * 330, (['berserker', 'hunter', 'gunner'] as const)[i % 3]));

	it(`with 7 enemies, only ${ASSAULT_SIZE} attack; the rest hold back in reserve`, () => {
		const pack = ring7();
		const w = createConstructWorld([], pack);
		const p = lantern();
		let most = 0;
		run(w, [p], 5, () => {
			p.invuln = 1;
			p.health = p.maxHealth;
			most = Math.max(most, pack.filter((e) => e.brain.target && e.brain.squad === 'assault').length);
			for (const e of pack) if (e.brain.squad === 'reserve') expect(e.brain.state === 'windup' || e.brain.state === 'act').toBe(false);
		});
		expect(most).toBe(ASSAULT_SIZE);
		const reserves = pack.filter((e) => e.brain.squad === 'reserve');
		expect(reserves.length).toBe(pack.length - ASSAULT_SIZE);
		// Reserves keep their distance
		for (const e of reserves) {
			expect(Math.hypot(e.x - p.x, e.y - p.y)).toBeGreaterThan(250);
		}
	});

	it('when an attacker falls, a reserve moves up to take its place', () => {
		const pack = ring7();
		const w = createConstructWorld([], pack);
		const p = lantern();
		run(w, [p], 2, () => (p.invuln = 1));
		const fallen = pack.find((e) => e.brain.squad === 'assault')!;
		fallen.hp = 0;
		fallen.down = 1;
		run(w, [p], 0.2, () => (p.invuln = 1));
		expect(pack.filter((e) => isStanding(e) && e.brain.squad === 'assault').length).toBe(ASSAULT_SIZE);
	});

	it('blood in the water: when a Lantern is nearly down, everyone piles in', () => {
		const pack = ring7();
		const w = createConstructWorld([], pack);
		const p = lantern();
		run(w, [p], 1.5, () => (p.invuln = 1));
		p.health = p.maxHealth * 0.2;
		run(w, [p], 0.1, () => (p.invuln = 1));
		expect(pack.every((e) => e.brain.squad === 'assault')).toBe(true);
	});

	it('two Lanterns face a bigger assault', () => {
		const pack = ring7();
		const w = createConstructWorld([], pack);
		const hal = lantern(-80, 0);
		const john = createPlayer(1, LANTERNS.john, { read: () => IDLE }, 80, 0);
		run(w, [hal, john], 2, () => (hal.invuln = john.invuln = 1));
		expect(pack.filter((e) => e.brain.squad === 'assault').length).toBe(ASSAULT_SIZE + ASSAULT_PER_EXTRA_LANTERN);
	});
});

describe('Red Lanterns build constructs too', () => {
	it('Rage Wall: a barrier that stops green shots but lets red shots through', () => {
		const e = grunt(300, 0, 'gunner');
		const w = createConstructWorld([], [e]);
		const p = lantern();
		force(e, 'redWall', p);
		run(w, [p], 0.1);
		const wall = w.obstacles.find((o) => o.kind === 'redWall');
		expect(wall).toBeDefined();
		// A green bolt from the Lantern toward the enemy hits the wall
		updatePlayerConstructs(p, { ...IDLE, shot: true }, DT, w);
		const hpBefore = wall!.hp!;
		for (let i = 0; i < 40; i++) updateConstructWorld(w, DT);
		expect(wall!.hp).toBeLessThan(hpBefore);
		expect(e.hp).toBe(e.maxHp);
		// A red bolt the other way passes straight through
		force(e, 'blast', p);
		run(w, [p], 0.8);
		expect(p.health).toBeLessThan(p.maxHealth);
	});

	it('Rage Shield on an ally soaks up damage', () => {
		const caster = grunt(300, 0, 'gunner');
		const ally = grunt(260, 60, 'berserker');
		ally.hp = ally.maxHp * 0.6;
		ally.brain.lastHp = ally.hp;
		ally.brain.sinceHit = 0.2;
		const w = createConstructWorld([], [caster, ally]);
		const p = lantern();
		caster.brain.ally = ally;
		force(caster, 'redShield', p);
		run(w, [p], 0.05);
		expect(ally.ward).toBeDefined();
		const hp = ally.hp;
		hitDummy(ally, 30, 0, 0, 0);
		expect(ally.hp).toBe(hp);
	});

	it('Rage Turret: builds a turret that shoots at the Lantern, then burns out', () => {
		const e = grunt(400, 0, 'gunner');
		const w = createConstructWorld([], [e]);
		const p = lantern();
		force(e, 'redTurret', p);
		run(w, [p], 0.1);
		const turret = w.dummies.find((d) => d.kind === 'rageTurret') as Enemy;
		expect(turret).toBeDefined();
		const where = [turret.x, turret.y];
		run(w, [p], 5, () => (p.invuln = 0));
		expect([turret.x, turret.y]).toEqual(where); // it doesn't move
		expect(p.health).toBeLessThan(p.maxHealth);
		run(w, [p], 12);
		expect(isStanding(turret)).toBe(false);
	});

	it('Rage Cannon shell bursts and hurts everyone near where it lands', () => {
		const e = grunt(300, 0, 'gunner');
		const w = createConstructWorld([], [e]);
		const p = lantern();
		const q = createPlayer(1, LANTERNS.john, { read: () => IDLE }, 0, 40);
		force(e, 'cannon', p);
		run(w, [p, q], 1.2);
		expect(p.health).toBeLessThan(p.maxHealth);
		expect(q.health).toBeLessThan(q.maxHealth);
	});

	it('Rage Axe cleaves in front, not behind', () => {
		const e = grunt(0, 0, 'berserker');
		const w = createConstructWorld([], [e]);
		const front = lantern(60, 0);
		const behind = createPlayer(1, LANTERNS.john, { read: () => IDLE }, -60, 0);
		force(e, 'axe', front);
		run(w, [front, behind], 0.05);
		expect(front.health).toBeLessThan(front.maxHealth);
		expect(behind.health).toBe(behind.maxHealth);
	});

	it('reserves help from the back: shielding the attackers who are getting hurt', () => {
		const pack = [0, 1, 2, 3, 4, 5].map((i) => grunt(Math.cos(i) * 300, Math.sin(i) * 300, 'gunner'));
		for (const e of pack) e.brain.kit = ['blast', 'redShield'];
		const w = createConstructWorld([], pack);
		const p = lantern();
		let shielded = false;
		run(w, [p], 6, () => {
			p.invuln = 1;
			p.health = p.maxHealth;
			// The Lantern keeps shooting whoever is attacking
			for (const e of pack) {
				if (e.brain.squad === 'assault' && isStanding(e)) {
					e.brain.sinceHit = 0;
					if (e.hp > e.maxHp * 0.5) e.hp -= 0.4;
				}
				if (e.ward && e.brain.squad === 'assault') shielded = true;
			}
		});
		expect(shielded).toBe(true);
		expect(pack.some((e) => e.brain.squad === 'reserve' && e.brain.uses.redShield > 0)).toBe(true);
	});
});

describe('all in is a burst, not a siege', () => {
	it('a Lantern who stays badly hurt gets swarmed briefly, then the squad goes back to taking turns', () => {
		const pack = [0, 1, 2, 3, 4, 5, 6].map((i) => grunt(Math.cos(i * 0.9) * 330, Math.sin(i * 0.9) * 330, 'gunner'));
		const w = createConstructWorld([], pack);
		const p = lantern();
		run(w, [p], 1.5, () => (p.invuln = 1));
		p.health = p.maxHealth * 0.2;
		run(w, [p], 0.2, () => (p.invuln = 1));
		expect(pack.every((e) => e.brain.squad === 'assault')).toBe(true);
		run(w, [p], 6, () => (p.invuln = 1));
		expect(pack.filter((e) => e.brain.squad === 'assault').length).toBeLessThanOrEqual(ASSAULT_SIZE + 1);
	});
});

describe('Rage Turret limit', () => {
	it(`never more than ${MAX_RED_TURRETS} out, even when several want to build at once`, () => {
		const pack = [0, 1, 2, 3, 4].map((i) => grunt(Math.cos(i) * 400, Math.sin(i) * 400, 'gunner'));
		for (const e of pack) e.brain.kit = ['redTurret'];
		const w = createConstructWorld([], pack);
		const p = lantern();
		let most = 0;
		run(w, [p], 8, () => {
			p.invuln = 1;
			most = Math.max(most, w.dummies.filter((d) => d.kind === 'rageTurret' && isStanding(d)).length);
		});
		expect(most).toBeGreaterThan(0);
		expect(most).toBeLessThanOrEqual(MAX_RED_TURRETS);
	});
});

describe('enemy shots hit what they are seen to hit', () => {
	it('a Lantern flying high over a planet is hit by bolts aimed at their body, not ones passing under their feet', () => {
		const p = lantern();
		p.bodyBottom = 78; // hovering high: body drawn from 78 to 152 px above the ground
		p.bodyTop = 152;
		// A bolt at hand height (50) passing right through their feet spot on the ground: drawn below them
		expect(hitsBody(p, p.x, p.y, RED_HAND_LIFT)).toBe(false);
		// Aimed at their body
		const aim = bodyAim(p, RED_HAND_LIFT);
		expect(hitsBody(p, aim.x, aim.y, RED_HAND_LIFT)).toBe(true);
	});

	it('a Red Lantern shooting at a high flyer aims at their body, and connects', () => {
		const e = grunt(300, 0, 'gunner');
		const w = createConstructWorld([], [e]);
		const p = lantern();
		p.bodyBottom = 78;
		p.bodyTop = 152;
		force(e, 'blast', p);
		// force() aims at the feet; the brain re-aims at the body once the attack starts
		e.brain.timer = 0.3;
		run(w, [p], 1.2, () => {
			p.bodyBottom = 78;
			p.bodyTop = 152;
		});
		expect(p.health).toBeLessThan(p.maxHealth);
	});
});
