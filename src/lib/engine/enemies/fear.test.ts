import { describe, expect, it } from 'vitest';
import { Game } from '../game';
import { FirstLight, buildFirstLightMap } from '../missions/firstLight';
import { fearOf } from './fear';

function duel() {
	const game = new Game({ players: [{ lantern: 'hal', keys: 'solo' }], map: buildFirstLightMap() });
	game.setView({ width: 1400, height: 800 });
	const mission = new FirstLight();
	game.director = mission;
	const hal = game.players[0];
	const run = (seconds: number) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) {
			hal.invuln = 1;
			game.update(1 / 60);
		}
	};
	return { game, mission, hal, run };
}

describe("Sinestro's yellow constructs", () => {
	it('he builds his own: hounds, the gatling, the hand, the executioner and the impalers', () => {
		const { game, mission, hal, run } = duel();
		run(3.1);
		const used = new Set<string>();
		for (let i = 0; i < 60 * 90; i++) {
			const s = mission.sinestro!;
			hal.x = s.x - 260;
			hal.y = s.y + 40;
			run(1 / 60);
			if (s.brain.state === 'act' && s.brain.ability) used.add(s.brain.ability);
		}
		for (const id of ['fearHounds', 'gatling', 'crushingHand', 'executioner', 'impalers']) expect(used).toContain(id);
		expect(game.dummies.some((d) => d.kind === 'fearHound')).toBe(true);
	});

	it('the hounds go when he does', () => {
		const { game, mission, run } = duel();
		run(3.1);
		const s = mission.sinestro!;
		for (let i = 0; i < 60 * 40 && !fearOf(game.constructs).hounds.length; i++) run(1 / 60);
		expect(fearOf(game.constructs).hounds.length).toBeGreaterThan(0);
		s.hp = 0;
		s.down = 1;
		run(0.5);
		expect(game.enemies.some((e) => e.kind === 'fearHound')).toBe(false);
	});
});
