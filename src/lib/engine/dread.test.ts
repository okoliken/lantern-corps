import { describe, expect, it } from 'vitest';
import { Game } from './game';
import { DREAD, addDread, dreadPower } from './dread';
import { buildWatchtowerMap } from './missions/watchtower';

function setup() {
	const game = new Game({ players: [{ lantern: 'john', keys: 'solo' }], map: buildWatchtowerMap() });
	game.setView({ width: 1400, height: 800 });
	const john = game.players[0];
	const run = (seconds: number) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) game.update(1 / 60);
	};
	return { game, john, run };
}

describe('dread', () => {
	it('weakens constructs the more afraid you are', () => {
		expect(dreadPower({ dread: 0 })).toBe(1);
		expect(dreadPower({ dread: 1 })).toBeCloseTo(1 - DREAD.weakest);
	});

	it('drains away by itself, and much faster behind a shield', () => {
		const { john, run } = setup();
		addDread(john, 0.8);
		run(2);
		const alone = 0.8 - john.dread;
		expect(alone).toBeGreaterThan(0);
		expect(alone).toBeLessThan(0.15);
	});

	it('builds near a fear enemy, and fast when it hurts you', () => {
		const { game, john, run } = setup();
		// Any enemy in the fear tint will do: a Sinestro Corps soldier stands in for Scarecrow here
		const e = game.spawnEnemy('fearGrunt', john.x + 200, john.y);
		e.stun = 99;
		run(3);
		expect(john.dread).toBeGreaterThan(0.03);
		const before = john.dread;
		john.health -= 30;
		run(1 / 60);
		expect(john.dread).toBeGreaterThan(before + 0.15);
	});
});
