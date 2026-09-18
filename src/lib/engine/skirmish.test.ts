import { describe, expect, it } from 'vitest';
import { Game } from './game';
import type { GameMap } from './map';
import { AMBUSH_LIVES, AMBUSH_PACK, Skirmish } from './skirmish';

const arena = (): GameMap => ({
	name: 'arena',
	environment: 'planet',
	width: 2400,
	height: 2400,
	spawn: { x: 1200, y: 1200 },
	battery: { x: 1200, y: 1090 },
	dummies: [],
	obstacles: []
});

function setup() {
	const game = new Game({ players: [{ lantern: 'hal', keys: 'solo' }], map: arena() });
	game.setView({ width: 1400, height: 800 });
	const skirmish = new Skirmish();
	game.director = skirmish;
	return { game, skirmish, p: game.players[0] };
}

const run = (game: Game, seconds: number, each?: () => void) => {
	for (let i = 0; i < Math.round(seconds * 60); i++) {
		game.update(1 / 60);
		each?.();
	}
};

describe('Red Lantern Ambush', () => {
	it('gives you a moment, then five Red Lanterns fly in one after another', () => {
		const { game, skirmish } = setup();
		run(game, 2);
		expect(skirmish.state).toBe('intro');
		expect(game.enemies).toHaveLength(0);
		run(game, 1.5);
		expect(skirmish.state).toBe('fighting');
		expect(game.enemies.length).toBeLessThan(AMBUSH_PACK.length);
		run(game, 2.5);
		expect(skirmish.pack).toHaveLength(AMBUSH_PACK.length);
		expect(skirmish.left).toBe(AMBUSH_PACK.length);
	});

	it('beating all five is a win', () => {
		const { game, skirmish } = setup();
		run(game, 6);
		for (const e of skirmish.pack) {
			e.hp = 0;
			e.down = 0.5;
		}
		run(game, 0.2);
		expect(skirmish.left).toBe(0);
		expect(skirmish.state).toBe('won');
	});

	it(`going down ${AMBUSH_LIVES} times is a loss, and you stay down`, () => {
		const { game, skirmish, p } = setup();
		run(game, 6);
		for (let i = 0; i < AMBUSH_LIVES; i++) {
			// Knocked down (then, while lives remain, back up shortly after)
			p.downed = true;
			p.downTimer = 0.1;
			run(game, 0.5);
			expect(skirmish.lives).toBe(AMBUSH_LIVES - i - 1);
		}
		expect(skirmish.state).toBe('lost');
		run(game, 6);
		expect(p.downed).toBe(true);
	});
});
