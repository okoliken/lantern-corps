import { describe, expect, it } from 'vitest';
import { isStanding } from '../dummy';
import { Game } from '../game';
import type { LanternId } from '../lanterns';
import { RED_DAWN } from '../../story/scenes';
import { RedDawn } from '../scenes/redDawn';
import { BATTERY, BATTERY_POWER, DRAIN_RANGE, FLAGSHIP_TIME, INTRO_TIME, SiegeOfOa, buildOaPlazaMap } from './siegeOfOa';

function setup(me: LanternId = 'hal') {
	const game = new Game({
		players: [
			{ lantern: me, keys: 'solo' },
			{ lantern: me === 'hal' ? 'john' : 'hal', keys: 'p2', ai: true },
			{ lantern: 'kilowog', keys: 'p2', ai: true }
		],
		map: buildOaPlazaMap()
	});
	game.setView({ width: 1400, height: 800 });
	const mission = new SiegeOfOa();
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
	const sweep = () => {
		for (const e of game.enemies) {
			e.hp = 0;
			e.down = 1;
		}
	};
	const until = (done: () => boolean, limit = 200) => {
		for (let t = 0; t < limit && !done(); t += 0.5) {
			sweep();
			run(0.5, () => {
				safe();
				mission.power = BATTERY_POWER;
			});
		}
		expect(done()).toBe(true);
	};
	return { game, mission, run, safe, sweep, until };
}

describe('Act 3, Mission 1: Siege of Oa', () => {
	it('you choose Hal or John, and the other and Kilowog fight beside you', () => {
		const { game } = setup('john');
		expect(game.players.map((p) => p.def.id)).toEqual(['john', 'hal', 'kilowog']);
	});

	it('drop pods come down round the battery, and a Red Lantern climbs out of each', () => {
		const { game, mission, run } = setup();
		run(3.1);
		expect(mission.phase).toBe('drop');
		expect(game.enemies.length).toBe(0);
		run(5);
		// Six pods land, and with six Lanterns on the plaza one of them may
		// already be down by the time we look
		expect(game.enemies.filter((e) => e.kind === 'rageGrunt').length).toBeGreaterThanOrEqual(5);
	});

	it('a Red Lantern near the battery drinks its light; with none on it, it fills back up', () => {
		const { game, mission, run } = setup();
		run(3.1 + 5);
		const e = game.enemies[0];
		for (const o of game.enemies) if (o !== e) {
			o.x = BATTERY.x + 1200;
			o.brain.speedMul = 0;
		}
		const before = mission.power;
		run(3, () => {
			e.x = BATTERY.x + DRAIN_RANGE / 2;
			e.y = BATTERY.y;
			// John's turrets sit by the battery and would finish an already-hurt
			// Red in a second; this is about the drinking, so keep it standing
			e.hp = Math.max(e.hp, e.maxHp * 0.5);
			for (const p of game.players) {
				p.invuln = 1;
				p.x = BATTERY.x - 900;
			}
		});
		expect(mission.power).toBeLessThan(before);
		const drained = mission.power;
		e.hp = 0;
		e.down = 1;
		for (const o of game.enemies) o.x = BATTERY.x + 1400;
		run(3, () => {
			for (const o of game.enemies) o.x = BATTERY.x + 1400;
		});
		expect(mission.power).toBeGreaterThan(drained);
	});

	it('three drops, then fighters torpedo the battery; a bubble on it takes the hit', () => {
		const { game, mission, run, until } = setup();
		until(() => mission.phase === 'bombard');
		run(3);
		const fighters = game.enemies.filter((e) => e.kind === 'redFighter');
		expect(fighters.length).toBeGreaterThan(0);
		let torpedo = false;
		run(10, () => {
			for (const p of game.players) p.invuln = 1;
			if (game.dummies.some((d) => d.kind === 'rageTorpedo' && isStanding(d))) torpedo = true;
		});
		expect(torpedo).toBe(true);
	});

	it('every Lantern who got home is on the plaza from the first drop', () => {
		const { game, mission, run } = setup();
		run(INTRO_TIME + 0.5);
		expect(mission.guard.length).toBe(3);
		expect(game.players.map((p) => p.def.id)).toEqual(['hal', 'john', 'kilowog', 'arisia', 'katma', 'boodikka']);
	});

	it('Zox and Skallox land, and the rest of the Corps fires on Oa from wherever it is', () => {
		const { game, mission, until } = setup();
		until(() => mission.phase === 'corps');
		expect(mission.zox).not.toBeNull();
		expect(mission.skallox).not.toBeNull();
		const before = game.enemies.filter(isStanding).length;
		until(() => mission.said.has('home'), 60);
		expect(game.enemies.filter(isStanding).length).toBeLessThanOrEqual(before);
	});

	it('the flagship fires for a minute, then the battery blazes out and Dex-Starr takes a Guardian', () => {
		const { game, mission, run, until } = setup();
		until(() => mission.phase === 'flagship');
		let strikes = 0;
		run(FLAGSHIP_TIME + 0.5, () => {
			for (const p of game.players) p.invuln = 1;
			mission.power = BATTERY_POWER;
			strikes = Math.max(strikes, game.constructs.effects.filter((e) => e.kind === 'slamMark').length);
		});
		expect(strikes).toBeGreaterThan(0);
		expect(['flare', 'taken']).toContain(mission.phase);
		expect(game.enemies.filter(isStanding).length).toBe(0);
		run(90);
		expect(mission.state).toBe('won');
		expect(mission.stars).toBe(3);
	});

	it('the battery going dark loses it', () => {
		const { mission, run } = setup();
		run(3.1);
		mission.power = 0.5;
		mission.power -= 1;
		run(0.1);
		expect(mission.state).toBe('lost');
		expect(mission.failReason).toBe('battery');
	});

	it('opens with the Red fleet over Oa', () => {
		const scene = new RedDawn(RED_DAWN);
		expect(RED_DAWN.some((l) => l.who === 'guardian')).toBe(true);
		expect(scene.done).toBe(false);
	});
});
