import { describe, expect, it } from 'vitest';
import { Game } from '../game';
import { KorugarMission, buildKorugarMap } from './korugar';

function setup() {
	const game = new Game({
		players: [
			{ lantern: 'hal', keys: 'solo' },
			{ lantern: 'kilowog', keys: 'p2', ai: true }
		],
		map: buildKorugarMap()
	});
	game.setView({ width: 1400, height: 800 });
	const mission = new KorugarMission();
	game.director = mission;
	const hal = game.players[0];
	const run = (seconds: number, each?: () => void) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) {
			game.update(1 / 60);
			each?.();
		}
	};
	const safe = () => (hal.invuln = 1);
	const go = (x: number, y: number) => run(0.2, () => {
		hal.x = x;
		hal.y = y;
		safe();
	});
	const clear = () => {
		for (const e of game.enemies) {
			if (e.kind === 'sinestro') continue;
			e.hp = 0;
			e.down = 1;
		}
		run(0.2, safe);
	};
	return { game, mission, hal, run, safe, go, clear };
}

describe('Season 2: Korugar', () => {
	it('Hal and Kilowog; each square wakes when Hal gets close and the one before is done', () => {
		const { game, mission, run, safe, go, clear } = setup();
		expect(game.players.map((p) => p.def.id)).toEqual(['hal', 'kilowog']);
		run(3.1, safe);
		go(mission.squares[1].x, mission.squares[1].y);
		expect(mission.squares[1].woke).toBe(false);
		go(mission.squares[0].x - 200, mission.squares[0].y);
		expect(mission.squares[0].woke).toBe(true);
		expect(game.enemies.filter((e) => e.kind === 'enforcer').length).toBe(4);
		clear();
		go(mission.squares[1].x - 200, mission.squares[1].y);
		expect(mission.squares[1].woke).toBe(true);
	});

	it('after the squares, Sinestro at the palace; beaten down, the Guardians take the ring and it is won', () => {
		const { mission, run, safe, go, clear } = setup();
		run(3.1, safe);
		for (const sq of mission.squares) {
			go(sq.x - 200, sq.y);
			clear();
		}
		expect(mission.phase).toBe('palace');
		const s = mission.sinestro!;
		expect(s).toBeTruthy();
		s.hp = s.maxHp * 0.2;
		run(0.2, safe);
		expect(mission.phase).toBe('judgement');
		run(8, safe);
		expect(mission.state).toBe('won');
		expect(s.hp).toBe(0);
	});
});
