import { describe, expect, it } from 'vitest';
import { DOWNED_TIME, HIT_INVULN, damagePlayer, revivePlayer, updatePlayerCombat } from '../combat';
import { createConstructWorld, type ConstructWorld } from '../constructs/system';
import { isStanding, updateDummy } from '../dummy';
import { IDLE } from '../input';
import { LANTERNS } from '../lanterns';
import { createPlayer, updatePlayer, type Player } from '../player';
import type { Obstacle } from '../map';
import { ATTACK_BUDGET } from './director';
import { ENEMIES, ENEMY_SPACING, MELEE_SLOTS, createEnemy, updateEnemies, type Enemy, type Role } from './enemies';
import { clearShot, tryDodge } from './tactics';
import { ABILITIES, type AbilityId } from './redConstructs';

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
		expect(p.health).toBe(80);
		expect(p.hurtTimer).toBeGreaterThan(0);
		// A second hit right away does nothing
		expect(damagePlayer(w, p, 20, 50, 0)).toBe(0);
		run(w, [p], HIT_INVULN + 0.05);
		expect(damagePlayer(w, p, 20, 50, 0)).toBe(20);
	});

	it('the bubble shield takes the hit first', () => {
		const w = createConstructWorld([], []);
		const p = lantern();
		w.shields.push({ owner: p, target: p, hp: 50, maxHp: 50, life: 10, maxLife: 10, ripple: 0 });
		expect(damagePlayer(w, p, 30, 50, 0)).toBe(0);
		expect(p.health).toBe(100);
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
