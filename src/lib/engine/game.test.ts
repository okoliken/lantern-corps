// Whole-game tests: build a tiny map, drive a player with scripted input,
// and check the pieces work together.

import { describe, expect, it } from 'vitest';
import { Game } from './game';
import { IDLE, type Intent } from './input';
import { CRATE_HP, type GameMap, type Obstacle } from './map';
import { XP_PER_DEFEAT, newProfiles } from './progression';

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
	const game = new Game({ players: [{ lantern: 'hal', keys: 'solo' }], map });
	game.setView({ width: 800, height: 600 });
	game.players[0].input = { read: () => intent };
	game.players[0].selected = game.players[0].loadout.findIndex((d) => d.id === 'beam');
	return game;
}

const run = (game: Game, seconds: number) => {
	for (let i = 0; i < Math.round(seconds * 60); i++) game.update(1 / 60);
};

describe('beam in the game', () => {
	const fireRight: Intent = { ...IDLE, construct: true };

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

describe('progression in the game', () => {
	it('defeating a dummy earns XP and reports the change', () => {
		const dummyMap = tinyPlanet([]);
		dummyMap.dummies = [{ x: 1100, y: 1000 }];
		const profiles = newProfiles();
		const reports: number[] = [];
		const game = new Game({
			players: [{ lantern: 'hal', keys: 'solo' }],
			map: dummyMap,
			profiles,
			onProgress: (_id, profile) => reports.push(profile.xp)
		});
		game.setView({ width: 800, height: 600 });
		game.players[0].input = { read: () => ({ ...IDLE, construct: true }) };
		game.infiniteWillpower = true;
		run(game, 5);
		expect(profiles.hal.xp).toBeGreaterThanOrEqual(XP_PER_DEFEAT);
		expect(reports.length).toBeGreaterThan(0);
	});

	it('upgrades from the profile apply when the game starts', () => {
		const profiles = newProfiles();
		profiles.john.level = 3;
		profiles.john.ranks.willpower = 2;
		const game = new Game({ players: [{ lantern: 'john', keys: 'solo' }], map: tinyPlanet([]), profiles });
		expect(game.players[0].maxWillpower).toBe(120);
		expect(game.players[0].willpower).toBe(120);
	});

	it('labs without profiles earn nothing and change nothing', () => {
		const dummyMap = tinyPlanet([]);
		dummyMap.dummies = [{ x: 1100, y: 1000 }];
		const game = gameWith(dummyMap, { ...IDLE, construct: true });
		game.infiniteWillpower = true;
		run(game, 5);
		expect(game.players[0].maxWillpower).toBe(100);
	});
});

describe('a downed Lantern', () => {
	it('lies still: moving the mouse does not turn the body or the aim', () => {
		const game = new Game({ players: [{ lantern: 'hal', keys: 'solo' }] });
		game.setView({ width: 1200, height: 800 });
		game.update(1 / 60);
		const p = game.players[0];
		p.downed = true;
		p.downTimer = 3;
		const dir = p.dir;
		const aim = [p.aimX, p.aimY];
		// Crosshair far off to the other side
		game.pointer.active = true;
		game.pointer.x = p.dir === 1 ? 0 : 1200;
		game.pointer.y = 400;
		for (let i = 0; i < 30; i++) game.update(1 / 60);
		expect(p.dir).toBe(dir);
		expect([p.aimX, p.aimY]).toEqual(aim);
	});
});
