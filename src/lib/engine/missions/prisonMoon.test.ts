import { describe, expect, it } from 'vitest';
import { damageObstacle } from '../constructs/system';
import { Game } from '../game';
import { IDLE } from '../input';
import { CELL_HP, PrisonMoon, buildPrisonMap } from './prisonMoon';

function setup() {
	const map = buildPrisonMap();
	const game = new Game({
		players: [
			{ lantern: 'hal', keys: 'solo' },
			{ lantern: 'kilowog', keys: 'p2', ai: true }
		],
		map
	});
	game.setView({ width: 1400, height: 800 });
	const mission = new PrisonMoon(map);
	game.director = mission;
	const run = (seconds: number, each?: () => void) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) {
			game.update(1 / 60);
			each?.();
		}
	};
	const safe = () => {
		for (const p of game.players) p.invuln = 1;
	};
	const clear = () => {
		for (const e of game.enemies) {
			e.hp = 0;
			e.down = 1;
		}
		run(0.1, safe);
	};
	const breakCell = (i: number) => {
		damageObstacle(game.constructs, mission.cells[i].obstacle, CELL_HP * 2);
		run(0.1, safe);
	};
	return { game, mission, run, safe, clear, breakCell };
}

describe('Act 1, Mission 4: Prison Moon', () => {
	it('Hal and Kilowog land; every cell has guards waiting', () => {
		const { game, run } = setup();
		run(0.1);
		expect(game.players.map((p) => p.def.id)).toEqual(['hal', 'kilowog']);
		expect(game.enemies.length).toBe(11);
	});

	it('a cell is a breakable target: ring shots and constructs wear it down', () => {
		const { game, mission, run, safe } = setup();
		run(3.1);
		const hal = game.players[0];
		const c = mission.cells[0];
		hal.x = c.spot.x - 200;
		hal.y = c.spot.y;
		for (const e of game.enemies) e.hp = 0;
		hal.input = { read: () => ({ ...IDLE, shot: true, pointer: { x: c.spot.x, y: c.spot.y - hal.ringLift } }) };
		run(2, safe);
		expect(c.obstacle.hp!).toBeLessThan(CELL_HP);
	});

	it('breaking a cell frees the Lantern inside, who joins the fight; the prison answers', () => {
		const { game, mission, run, safe, clear, breakCell } = setup();
		run(3.1);
		clear();
		breakCell(0);
		expect(mission.freed).toBe(1);
		const freed = game.players[2];
		expect(freed.def.id).toBe('arisia');
		// Reinforcements come, and the freed Lantern fights them
		expect(game.enemies.length).toBeGreaterThan(0);
		const before = game.enemies.reduce((sum, e) => sum + e.hp, 0);
		run(8, safe);
		const after = game.enemies.reduce((sum, e) => sum + e.hp, 0);
		expect(after).toBeLessThan(before);
	});

	it('everyone free brings the warden; beating the garrison reveals Razer and wins', () => {
		const { game, mission, run, safe, clear, breakCell } = setup();
		run(3.1);
		clear();
		for (const i of [0, 1]) {
			breakCell(i);
			clear();
		}
		// The warden and the garrison arrive the moment the last one's out
		breakCell(2);
		expect(game.players.map((p) => p.def.id)).toEqual(['hal', 'kilowog', 'arisia', 'boodikka', 'katma']);
		expect(mission.phase).toBe('warden');
		expect(game.enemies.some((e) => e.kind === 'skallox')).toBe(true);
		clear();
		run(0.2, safe);
		expect(mission.phase).toBe('reveal');
		run(40, safe);
		expect(mission.state).toBe('won');
		expect(mission.stars).toBe(3);
	});

	it('Hal going down three times loses it', () => {
		const { game, mission, run } = setup();
		run(3.1);
		const hal = game.players[0];
		for (let i = 0; i < 3; i++) {
			hal.health = 0;
			hal.downed = true;
			hal.downTimer = 5;
			run(0.1);
			hal.downed = false;
			run(0.1);
		}
		expect(mission.state).toBe('lost');
	});
});
