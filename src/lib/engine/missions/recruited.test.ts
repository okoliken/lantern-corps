import { describe, expect, it } from 'vitest';
import { Game } from '../game';
import { CALM_RANGE, CALM_TIME, HOLD_TIME, Recruited, buildRecruitedMap } from './recruited';

function setup() {
	const game = new Game({
		players: [
			{ lantern: 'john', keys: 'solo' },
			{ lantern: 'wonderwoman', keys: 'p2', ai: true }
		],
		map: buildRecruitedMap()
	});
	game.setView({ width: 1400, height: 800 });
	const mission = new Recruited();
	game.director = mission;
	const john = game.players[0];
	const run = (seconds: number, each?: () => void) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) {
			game.update(1 / 60);
			each?.();
		}
	};
	const safe = () => (john.invuln = 1);
	const clear = () => {
		for (const e of game.enemies) {
			e.hp = 0;
			e.down = 1;
		}
	};
	return { game, mission, john, run, safe, clear };
}

describe('Season 2: Recruited', () => {
	it('John and Wonder Woman; the first nightmares are yellow copies of old enemies', () => {
		const { game, mission, run, safe } = setup();
		expect(game.players.map((p) => p.def.id)).toEqual(['john', 'wonderwoman']);
		run(3.1, safe);
		expect(mission.wave).toBe(1);
		expect(game.enemies.length).toBe(6);
		expect(game.enemies.every((e) => e.phantom)).toBe(true);
	});

	it('after two waves Ray comes, and he cannot be beaten', () => {
		const { mission, run, safe, clear } = setup();
		run(3.1, safe);
		clear();
		run(0.2, safe);
		clear();
		run(0.2, safe);
		expect(mission.phase).toBe('ray');
		const r = mission.ray!;
		r.hp = 0;
		r.down = 1;
		run(0.1, safe);
		expect(r.hp).toBeGreaterThan(0);
		expect(mission.held).toBeGreaterThan(0);
	});

	it('talk him down inside the lasso and it is won; walk away and he breaks free', () => {
		const { mission, john, run, safe, clear } = setup();
		run(3.1, safe);
		clear();
		run(0.2, safe);
		clear();
		run(0.2, safe);
		const r = mission.ray!;
		// Away from him the whole hold: he breaks free
		r.hp = r.maxHp * 0.15;
		run(HOLD_TIME + 0.5, () => {
			safe();
			john.x = r.x - CALM_RANGE - 400;
			john.y = r.y;
		});
		expect(mission.breaks).toBe(1);
		expect(mission.held).toBe(0);
		// Caught again, and this time John stays
		r.hp = r.maxHp * 0.15;
		run(CALM_TIME + 0.5, () => {
			safe();
			john.x = r.x - 120;
			john.y = r.y;
		});
		expect(mission.state).toBe('won');
		expect(mission.stars).toBe(2);
	});
});
