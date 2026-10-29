import { describe, expect, it } from 'vitest';
import { Game } from '../game';
import { HardOrder, buildHardOrderMap } from './hardOrder';

function setup() {
	const game = new Game({
		players: [
			{ lantern: 'hal', keys: 'solo' },
			{ lantern: 'kilowog', keys: 'p2', ai: true },
			{ lantern: 'sinestro', keys: 'p2', ai: true }
		],
		map: buildHardOrderMap()
	});
	game.setView({ width: 1400, height: 800 });
	const mission = new HardOrder();
	game.director = mission;
	const hal = game.players[0];
	const run = (seconds: number, each?: () => void) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) {
			game.update(1 / 60);
			each?.();
		}
	};
	const safe = () => (hal.invuln = 1);
	const clear = () => {
		for (const e of game.enemies) {
			e.hp = 0;
			e.down = 1;
		}
		run(0.2, safe);
	};
	return { game, mission, hal, run, safe, clear };
}

describe('Season 2: Hard Order', () => {
	it('Hal flies with Kilowog and Sinestro', () => {
		const { game } = setup();
		expect(game.players.map((p) => p.def.id)).toEqual(['hal', 'kilowog', 'sinestro']);
	});

	it('three raid waves, then Sinestro cages the colonists, then the last push', () => {
		const { game, mission, run, safe, clear } = setup();
		run(3.1, safe);
		expect(mission.state).toBe('playing');
		for (let i = 0; i < 3; i++) {
			expect(mission.phase).toBe('raid');
			clear();
		}
		expect(mission.phase).toBe('order');
		run(9.5, safe);
		expect(mission.phase).toBe('hold');
		expect(mission.cages.every((c) => c.built === 1)).toBe(true);
		// Hold out until the raiders break, then the last of them go down
		run(76, () => {
			safe();
			for (const e of game.enemies) {
				e.hp = 0;
				e.down = 1;
			}
		});
		clear();
		expect(mission.state).toBe('won');
	});

	it('raiders next to a cage drain it, and a broken cage loses the mission', () => {
		const { game, mission, run, safe, clear } = setup();
		run(3.1, safe);
		clear();
		clear();
		clear();
		run(9.5, safe);
		const cage = mission.cages[0];
		// Raiders parked by the cage (and kept standing: Kilowog and Sinestro would beat them)
		const hold = () => {
			safe();
			for (const e of game.enemies) {
				if (e.down > 0) continue;
				e.x = cage.x + 40;
				e.y = cage.y;
				e.stun = 1;
				e.hp = e.maxHp;
			}
		};
		run(2, hold);
		expect(cage.hp).toBeLessThan(100);
		run(60, hold);
		expect(mission.state).toBe('lost');
		expect(mission.failReason).toBe('cage');
	});
});
