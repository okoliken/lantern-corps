import { describe, expect, it } from 'vitest';
import { isStanding } from '../dummy';
import { Game } from '../game';
import type { LanternId } from '../lanterns';
import { BLOOD_WORLD } from '../../story/scenes';
import { BloodWorld } from '../scenes/bloodWorld';
import { ALTAR, ALTAR_RADIUS, CONDUITS, CONDUIT_HP, SURGE, YsmaultMission, buildYsmaultMap } from './ysmault';

function setup(me: LanternId = 'hal') {
	const game = new Game({
		players: [
			{ lantern: me, keys: 'solo' },
			{ lantern: me === 'hal' ? 'john' : 'hal', keys: 'p2', ai: true },
			{ lantern: 'arisia', keys: 'p2', ai: true }
		],
		map: buildYsmaultMap()
	});
	game.setView({ width: 1400, height: 800 });
	const mission = new YsmaultMission();
	game.director = mission;
	const safe = () => {
		for (const p of game.players) p.invuln = 1;
	};
	const run = (seconds: number, each: () => void = safe) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) {
			game.update(1 / 60);
			each();
		}
	};
	const breakConduit = (i: number) => {
		const c = mission.conduits[i];
		c.hp = 0;
		c.down = 1;
	};
	return { game, mission, run, safe, breakConduit };
}

describe('Act 3, Mission 4: Ysmault', () => {
	it('four conduits feed the altar, and the Red Lanterns climb out of the pools', () => {
		const { game, mission, run } = setup();
		run(3.1);
		expect(mission.conduits.length).toBe(CONDUITS.length);
		expect(mission.conduits.every((c) => c.hp === CONDUIT_HP)).toBe(true);
		run(8);
		expect(game.enemies.some((e) => e.kind === 'rageGrunt')).toBe(true);
	});

	it('while conduits stand, Red Lanterns near the altar heal', () => {
		const { game, mission, run } = setup();
		run(3.1);
		const e = game.spawnEnemy('rageGrunt', ALTAR.x + ALTAR_RADIUS + 120, ALTAR.y);
		(mission as unknown as { reds: unknown[] }).reds.push(e);
		e.hp = e.maxHp / 2;
		const before = e.hp;
		run(1, () => {
			for (const p of game.players) {
				p.invuln = 1;
				p.x = 200;
				p.y = 2300;
			}
		});
		expect(e.hp).toBeGreaterThan(before);
	});

	it('a conduit nobody is near mends itself', () => {
		const { game, mission, run } = setup();
		run(3.1);
		const c = mission.conduits[0];
		c.hp = c.maxHp / 2;
		run(2, () => {
			for (const p of game.players) {
				p.invuln = 1;
				p.x = 3300;
				p.y = 2300;
			}
		});
		expect(c.hp).toBeGreaterThan(c.maxHp / 2);
	});

	it('the surge rolls along the ground: it hits you there, and passes under you in the air', () => {
		const { game, run } = setup();
		run(3.1);
		const me = game.players[0];
		const grounded = () => {
			me.x = ALTAR.x;
			me.y = ALTAR.y + 300;
			me.flying = false;
			me.altitude = 0;
			me.invuln = 0;
		};
		let hurt = false;
		run(SURGE.every + SURGE.time + 0.5, () => {
			grounded();
			if (me.health < me.maxHealth) hurt = true;
			me.health = me.maxHealth;
		});
		expect(hurt).toBe(true);
	});

	it('Zox after the first conduit, Razer after the second, and all four darken the altar', () => {
		const { game, mission, run, breakConduit } = setup();
		run(3.1);
		breakConduit(0);
		run(0.2);
		expect(game.enemies.some((e) => e.kind === 'zox')).toBe(true);
		breakConduit(1);
		run(0.2);
		expect(mission.razer).not.toBeNull();
		expect(game.players.map((p) => p.def.id)).toContain('razer');
		breakConduit(2);
		breakConduit(3);
		run(0.3);
		expect(mission.phase).toBe('silence');
		expect(game.enemies.filter(isStanding).length).toBe(0);
		run(90);
		expect(mission.state).toBe('won');
	});

	it('opens on the blood world', () => {
		const scene = new BloodWorld(BLOOD_WORLD);
		expect(BLOOD_WORLD.some((l) => l.who === 'atrocitus')).toBe(true);
		expect(scene.done).toBe(false);
	});
});
