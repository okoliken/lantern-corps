import { describe, expect, it } from 'vitest';
import { DOWNED_TIME, HIT_INVULN, damagePlayer, revivePlayer, updatePlayerCombat } from '../combat';
import { createConstructWorld, type ConstructWorld } from '../constructs/system';
import { isStanding, updateDummy } from '../dummy';
import { IDLE } from '../input';
import { LANTERNS } from '../lanterns';
import { createPlayer, type Player } from '../player';
import { ENEMIES, ENEMY_SPACING, createEnemy, updateEnemies, type Enemy } from './enemies';

const DT = 1 / 60;
const lantern = (x = 0, y = 0) => createPlayer(0, LANTERNS.hal, { read: () => IDLE }, x, y);

function run(w: ConstructWorld, players: Player[], seconds: number) {
	for (let i = 0; i < Math.round(seconds * 60); i++) {
		for (const p of players) updatePlayerCombat(p, DT);
		updateEnemies(w, players, DT);
		for (const d of w.dummies) updateDummy(d, DT, [], false);
	}
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

describe('Rage Grunt', () => {
	const setup = (distance = 300) => {
		const g = createEnemy('rageGrunt', distance, 0);
		const w = createConstructWorld([], [g]);
		const p = lantern();
		return { g, w, p };
	};

	it('notices a Lantern in sight and closes in', () => {
		const { g, w, p } = setup(400);
		run(w, [p], 0.8);
		expect(g.brain.state).not.toBe('idle');
		expect(g.x).toBeLessThan(380);
	});

	it('ignores Lanterns out of sight', () => {
		const { g, w, p } = setup(ENEMIES.rageGrunt.sight + 200);
		run(w, [p], 1);
		expect(g.brain.state).toBe('idle');
	});

	it('does not attack the instant it appears (short grace period)', () => {
		const { g, w, p } = setup(40);
		run(w, [p], 0.1);
		expect(g.brain.state).not.toBe('windup');
	});

	it('winds up (a visible tell) before the claws land', () => {
		const { g, w, p } = setup(40);
		g.brain.cooldown = 0;
		run(w, [p], 0.05);
		expect(g.brain.state).toBe('windup');
		expect(p.health).toBe(p.maxHealth);
		run(w, [p], ENEMIES.rageGrunt.windup + 0.1);
		expect(p.health).toBeLessThan(p.maxHealth);
	});

	it('can be dodged: moving away during the windup avoids the hit', () => {
		const { g, w, p } = setup(40);
		g.brain.cooldown = 0;
		run(w, [p], 0.05);
		expect(g.brain.state).toBe('windup');
		p.x = -300; // dashed away
		run(w, [p], ENEMIES.rageGrunt.windup + 0.1);
		expect(p.health).toBe(p.maxHealth);
	});

	it('stunned grunts stop attacking', () => {
		const { g, w, p } = setup(40);
		g.stun = 2;
		run(w, [p], 1.5);
		expect(p.health).toBe(p.maxHealth);
	});

	it('gets faster as it gets hurt (rage)', () => {
		const calm = setup(500);
		const angry = setup(500);
		angry.g.hp = angry.g.maxHp * 0.2;
		run(calm.w, [calm.p], 0.6);
		run(angry.w, [angry.p], 0.6);
		expect(angry.g.x).toBeLessThan(calm.g.x);
	});

	it('does not go after downed Lanterns', () => {
		const { g, w, p } = setup(200);
		p.downed = true;
		run(w, [p], 1);
		expect(g.brain.state).toBe('idle');
	});

	it('a pack spreads out instead of stacking on one spot', () => {
		const pack = [createEnemy('rageGrunt', 200, 0), createEnemy('rageGrunt', 200, 0), createEnemy('rageGrunt', 200, 0)];
		const w = createConstructWorld([], pack);
		run(w, [lantern()], 1.5);
		for (let i = 0; i < pack.length; i++)
			for (let j = i + 1; j < pack.length; j++)
				expect(Math.hypot(pack[i].x - pack[j].x, pack[i].y - pack[j].y)).toBeGreaterThan(ENEMY_SPACING * 0.6);
	});

	it('stays defeated and then leaves the world (no respawning like dummies)', () => {
		const g: Enemy = createEnemy('rageGrunt', 0, 0);
		g.hp = 1;
		const w = createConstructWorld([], [g]);
		g.hp = 0;
		g.down = 0.1;
		expect(isStanding(g)).toBe(false);
		run(w, [], 0.2);
		expect(g.gone).toBe(true);
	});
});
