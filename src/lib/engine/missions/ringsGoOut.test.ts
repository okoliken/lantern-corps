import { describe, expect, it } from 'vitest';
import { Game } from '../game';
import { RESCUE_TIME, RingsGoOut, buildRingsMap } from './ringsGoOut';

function setup() {
	const game = new Game({
		players: [
			{ lantern: 'hal', keys: 'solo' },
			{ lantern: 'kilowog', keys: 'p2', ai: true }
		],
		map: buildRingsMap()
	});
	game.setView({ width: 1400, height: 800 });
	const mission = new RingsGoOut();
	game.director = mission;
	const hal = game.players[0];
	const run = (seconds: number, each?: () => void) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) {
			game.update(1 / 60);
			each?.();
		}
	};
	const safe = () => {
		hal.invuln = 1;
		game.players[1].invuln = 1;
	};
	return { game, mission, hal, run, safe };
}

describe('Season 2: The Rings Go Out', () => {
	it('three stranded Lanterns, every one hunted', () => {
		const { game, mission, run, safe } = setup();
		run(3.1, safe);
		expect(mission.stranded.map((s) => s.hunted)).toEqual([true, true, true]);
		expect(game.enemies.every((e) => e.kind === 'fearGrunt')).toBe(true);
		expect(game.enemies.length).toBe(9);
	});

	it('no charging her ring while hunters are on her', () => {
		const { mission, hal, run, safe } = setup();
		run(3.1, safe);
		const s = mission.stranded[0];
		run(RESCUE_TIME + 0.5, () => {
			safe();
			hal.x = s.x + 40;
			hal.y = s.y;
		});
		expect(s.charge).toBe(0);
	});

	it('hunters wear a stranded Lantern down until she is lost', () => {
		const { game, mission, hal, run, safe } = setup();
		run(3.1, safe);
		game.players[1].x = hal.x = 200;
		const s = mission.stranded[0];
		const before = s.hp;
		run(5, () => {
			safe();
			for (const e of game.enemies) {
				e.x = s.x + 60;
				e.y = s.y;
			}
		});
		expect(s.hp).toBeLessThan(before);
		s.hp = 0.01;
		run(0.2, safe);
		expect(s.state).toBe('lost');
	});

	it('stay close and her ring charges and she flies out; clear them all and Arkillo comes; beat him and it is won', () => {
		const { game, mission, hal, run, safe } = setup();
		run(3.1, safe);
		const clear = () => {
			for (const e of game.enemies) {
				e.hp = 0;
				e.down = 1;
			}
		};
		for (const s of mission.stranded) {
			run(RESCUE_TIME + 0.3, () => {
				safe();
				clear();
				hal.x = s.x + 40;
				hal.y = s.y;
			});
			expect(s.state).toBe('out');
		}
		run(0.2, safe);
		expect(mission.phase).toBe('arkillo');
		const a = mission.arkillo!;
		expect(a.kind).toBe('arkillo');
		a.hp = 0;
		a.down = 1;
		run(0.2, safe);
		expect(mission.state).toBe('won');
		expect(mission.stars).toBe(3);
	});
});
