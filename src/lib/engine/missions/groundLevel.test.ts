import { describe, expect, it } from 'vitest';
import { Game } from '../game';
import { BRACE_RANGE, GroundLevel, buildGroundLevelMap } from './groundLevel';

function setup() {
	const game = new Game({
		players: [
			{ lantern: 'john', keys: 'solo' },
			{ lantern: 'superman', keys: 'p2', ai: true }
		],
		map: buildGroundLevelMap()
	});
	game.setView({ width: 1400, height: 800 });
	const mission = new GroundLevel();
	game.director = mission;
	const john = game.players[0];
	const run = (seconds: number, each?: () => void) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) {
			game.update(1 / 60);
			each?.();
		}
	};
	const at = (x: number, y: number) => () => {
		john.x = x;
		john.y = y;
		john.invuln = 1;
	};
	return { game, mission, john, run, at };
}

describe('Season 2: Ground Level', () => {
	it('John with Superman, who stays under the far end', () => {
		const { game, run } = setup();
		expect(game.players.map((p) => p.def.id)).toEqual(['john', 'superman']);
		run(5);
		expect(Math.hypot(game.players[1].x - 1610, game.players[1].y - 850)).toBeLessThan(5);
	});

	it('the strain climbs away from the load and falls while John braces it, at a willpower cost', () => {
		const { mission, john, run, at } = setup();
		run(3.1);
		run(6, at(400, 1500));
		const away = mission.strain;
		expect(away).toBeGreaterThan(0.25);
		const will = john.willpower;
		run(3, at(1500, 820 + BRACE_RANGE / 2));
		expect(mission.bracing).toBe(true);
		expect(mission.strain).toBeLessThan(away);
		expect(john.willpower).toBeLessThan(will);
	});

	it('left alone, the lifter comes down', () => {
		const { mission, run, at } = setup();
		run(3.1);
		run(40, at(400, 1500));
		expect(mission.state).toBe('lost');
		expect(mission.failReason).toBe('dropped');
	});

	it('crews follow John to the exit; then Superman lowers it and it is won', () => {
		const { game, mission, john, run, at } = setup();
		run(3.1);
		game.infiniteWillpower = true;
		for (const c of mission.crews) {
			run(0.2, at(c.x, c.y));
			expect(c.state).toBe('following');
			// Walk them out: John heads for the gate, keeping the strain down meanwhile
			for (let i = 0; i < 40 && c.state === 'following'; i++) {
				const d = Math.hypot(330 - john.x, 1560 - john.y);
				const k = Math.min(1, 140 / Math.max(1, d));
				run(0.5, at(john.x + (330 - john.x) * k, john.y + (1560 - john.y) * k));
				mission.strain = 0.2;
			}
			expect(c.state).toBe('out');
		}
		expect(mission.phase).toBe('lower');
		run(26, at(1500, 900));
		expect(mission.state).toBe('won');
		expect(john.downed).toBe(false);
	});
});
