import { describe, expect, it } from 'vitest';
import { Game } from '../game';
import { DUEL_TIME, FLOOR, FirstLight, buildFirstLightMap } from './firstLight';

function setup() {
	const game = new Game({ players: [{ lantern: 'hal', keys: 'solo' }], map: buildFirstLightMap() });
	game.setView({ width: 1400, height: 800 });
	const mission = new FirstLight();
	game.director = mission;
	const hal = game.players[0];
	const run = (seconds: number, each?: () => void) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) {
			game.update(1 / 60);
			each?.();
		}
	};
	const safe = () => (hal.invuln = 1);
	return { game, mission, hal, run, safe };
}

describe('Season 2: First Light of Fear', () => {
	it('Hal alone against Sinestro in yellow, who fills his dread', () => {
		const { game, mission, hal, run, safe } = setup();
		run(3.1, safe);
		expect(game.players.length).toBe(1);
		expect(mission.sinestro?.kind).toBe('sinestroYellow');
		run(4, () => {
			safe();
			hal.x = mission.sinestro!.x - 200;
			hal.y = mission.sinestro!.y;
		});
		expect(hal.dread).toBeGreaterThan(0.1);
	});

	it("the yellow ring won't let him fall below a third", () => {
		const { mission, run, safe } = setup();
		run(3.1, safe);
		const s = mission.sinestro!;
		s.hp = 1;
		run(0.1, safe);
		expect(s.hp).toBeCloseTo(s.maxHp * FLOOR, 0);
		expect(mission.dealt).toBeGreaterThan(0.6);
	});

	it('it ends when the time is up (still standing) or when Hal goes down, and either way it is complete', () => {
		const standing = setup();
		standing.run(3.1, standing.safe);
		standing.run(DUEL_TIME + 10, standing.safe);
		expect(standing.mission.state).toBe('won');
		expect(standing.mission.fell).toBe(false);

		const fell = setup();
		fell.run(3.1, fell.safe);
		fell.hal.health = 0;
		fell.hal.downed = true;
		fell.hal.downTimer = 5;
		fell.run(10);
		expect(fell.mission.state).toBe('won');
		expect(fell.mission.fell).toBe(true);
		expect(fell.mission.stars).toBeLessThan(3);
	});
});
