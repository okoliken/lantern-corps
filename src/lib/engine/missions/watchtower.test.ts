import { describe, expect, it } from 'vitest';
import { Game } from '../game';
import { DRILLS, Watchtower, buildWatchtowerMap } from './watchtower';

function setup() {
	const game = new Game({ players: [{ lantern: 'john', keys: 'solo' }], map: buildWatchtowerMap() });
	game.setView({ width: 1400, height: 800 });
	const mission = new Watchtower();
	game.director = mission;
	const run = (seconds: number, each: () => void = () => {}) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) {
			game.update(1 / 60);
			each();
		}
	};
	return { game, mission, run };
}

describe('the Watchtower', () => {
	it('has the League on the deck before the first drill', () => {
		const { game, mission, run } = setup();
		run(0.2);
		expect(mission.crew.map((p) => p.def.id).sort()).toEqual(['flash', 'hawkgirl', 'superman', 'wonderwoman']);
		expect(game.players[0].def.id).toBe('john');
	});

	it('starts on the laps once the introductions are over', () => {
		const { mission, run } = setup();
		expect(mission.state).toBe('intro');
		run(5);
		expect(mission.state).toBe('playing');
		expect(mission.drill).toBe('laps');
		expect(mission.objective).toContain('markers');
	});

	it('nothing on this deck can hurt him', () => {
		const { game, mission, run } = setup();
		run(6);
		const me = game.players[0];
		const health = me.health;
		run(20);
		expect(me.health).toBe(health);
		expect(mission.lives).toBe(3);
	});

	it('runs every drill in order and finishes', () => {
		const { mission, run } = setup();
		const seen = new Set<string>();
		run(180, () => seen.add(mission.drill));
		for (const drill of DRILLS) expect(seen.has(drill)).toBe(true);
		expect(mission.state).toBe('won');
		expect(mission.drill).toBe('done');
	});

	it('dropping things costs the second star, and the clock costs the third', () => {
		const { mission, run } = setup();
		run(180);
		expect(mission.stars).toBeGreaterThanOrEqual(1);
		// The bot does nothing at all, so it drops everything
		expect(mission.stars).toBeLessThan(3);
		expect(mission.stats().some((s) => s.label === 'Dropped')).toBe(true);
	});
});
