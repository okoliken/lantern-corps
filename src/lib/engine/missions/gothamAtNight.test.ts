import { describe, expect, it } from 'vitest';
import { Game } from '../game';
import { GothamAtNight, buildGothamMap } from './gothamAtNight';

function setup() {
	const game = new Game({
		players: [
			{ lantern: 'john', keys: 'solo' },
			{ lantern: 'batman', keys: 'p2', ai: true }
		],
		map: buildGothamMap()
	});
	game.setView({ width: 1400, height: 800 });
	const mission = new GothamAtNight();
	game.director = mission;
	const john = game.players[0];
	const run = (seconds: number, each?: () => void) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) {
			game.update(1 / 60);
			each?.();
		}
	};
	const safe = () => (john.invuln = 1);
	return { game, mission, john, run, safe };
}

describe('Season 2: Gotham at Night', () => {
	it('John and Batman (on foot); three toxin tanks, each guarded', () => {
		const { game, mission, run, safe } = setup();
		expect(game.players.map((p) => p.def.id)).toEqual(['john', 'batman']);
		run(3.1, safe);
		expect(mission.tanks.length).toBe(3);
		expect(game.enemies.filter((e) => e.kind === 'thug').length).toBe(12);
		expect(game.players[1].flying).toBe(false);
	});

	it('standing in a tank\'s gas fills dread', () => {
		const { mission, john, run, safe } = setup();
		run(3.1, safe);
		const t = mission.tanks[0];
		run(2, () => {
			safe();
			john.x = t.x + 60;
			john.y = t.y;
		});
		expect(john.dread).toBeGreaterThan(0.15);
	});

	it('break the tanks and Scarecrow comes; beat him and it is won', () => {
		const { game, mission, run, safe } = setup();
		run(3.1, safe);
		for (const t of mission.tanks) {
			t.hp = 0;
			t.down = 1;
		}
		run(0.2, safe);
		expect(mission.phase).toBe('scarecrow');
		expect(mission.scarecrow?.kind).toBe('scarecrow');
		const s = mission.scarecrow!;
		s.hp = 0;
		s.down = 1;
		run(0.2, safe);
		expect(mission.state).toBe('won');
		expect(game.players[0].dread).toBe(0);
	});
});
