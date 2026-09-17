// Whole-game tests: build a tiny map, drive a player with scripted input,
// and check the pieces work together.

import { describe, expect, it } from 'vitest';
import { Game } from './game';
import { IDLE, type Intent } from './input';
import { CRATE_HP, type GameMap, type Obstacle } from './map';

const crate = (x: number, y: number): Obstacle => ({
	kind: 'crate',
	x,
	y,
	w: 40,
	h: 28,
	height: 28,
	blocksFlying: false,
	seed: 0.5,
	hp: CRATE_HP
});

function tinyPlanet(obstacles: Obstacle[]): GameMap {
	return {
		name: 'test',
		environment: 'planet',
		width: 2000,
		height: 2000,
		spawn: { x: 1000, y: 1000 },
		// Battery far away so it doesn't refill willpower during the test
		battery: { x: 100, y: 100 },
		dummies: [],
		obstacles
	};
}

function gameWith(map: GameMap, intent: Intent) {
	const game = new Game({ players: [{ lantern: 'hal', keys: 'both' }], map });
	game.setView({ width: 800, height: 600 });
	game.players[0].input = { read: () => intent };
	return game;
}

const run = (game: Game, seconds: number) => {
	for (let i = 0; i < Math.round(seconds * 60); i++) game.update(1 / 60);
};

describe('beam in the game', () => {
	const fireRight: Intent = { ...IDLE, fire: true };

	it('breaks a crate it is pointed at, and the crate stops blocking', () => {
		const target = crate(1100, 986);
		const map = tinyPlanet([target]);
		const game = gameWith(map, fireRight);
		run(game, 0.2);
		expect(target.hp).toBeLessThan(CRATE_HP);
		run(game, 1.5);
		expect(map.obstacles).not.toContain(target);
	});

	it('costs willpower while it fires', () => {
		const game = gameWith(tinyPlanet([]), fireRight);
		run(game, 1);
		expect(game.players[0].willpower).toBeLessThan(90);
		expect(game.players[0].firing).toBe(true);
	});

	it('does not hurt unbreakable things', () => {
		const wall: Obstacle = { ...crate(1100, 986), kind: 'rock', hp: undefined };
		const map = tinyPlanet([wall]);
		run(gameWith(map, fireRight), 2);
		expect(map.obstacles).toContain(wall);
	});
});
