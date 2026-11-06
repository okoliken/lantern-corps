import { describe, expect, it } from 'vitest';
import { hitDummy, isStanding } from '../dummy';
import { Game } from '../game';
import { CARRY, HOME, SHIP, TAKEN_LIMIT, Taken, buildTakenMap } from './taken';

function setup() {
	const game = new Game({
		players: [
			{ lantern: 'john', keys: 'solo' },
			{ lantern: 'flash', keys: 'p2', ai: true }
		],
		map: buildTakenMap()
	});
	game.setView({ width: 1400, height: 800 });
	const mission = new Taken();
	game.director = mission;
	const [john, flash] = game.players;
	const run = (seconds: number, each?: () => void) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) {
			game.update(1 / 60);
			each?.();
		}
	};
	const safe = () => {
		for (const p of game.players) p.invuln = 1;
	};
	return { game, mission, john, flash, run, safe };
}

describe('Season 2: Taken', () => {
	it('John and the Flash; twelve people out in the streets; escorts round the ship, and carriers coming down', () => {
		const { game, mission, run, safe } = setup();
		expect(game.players.map((p) => p.def.id)).toEqual(['john', 'flash']);
		run(3.1, safe);
		expect(mission.people.length).toBe(12);
		run(2.5, safe);
		expect(game.enemies.filter((e) => e.kind === 'fearGrunt').length).toBeGreaterThanOrEqual(5);
	});

	it('a carrier grabs someone and flies them to the ship; there they are taken', () => {
		const { mission, john, run, safe } = setup();
		run(3.1, safe);
		const away = () => {
			safe();
			john.x = john.prevX = 200;
			john.y = john.prevY = 1900;
		};
		let grabbed = false;
		for (let s = 0; s < 40 && !grabbed; s++) {
			run(0.5, away);
			grabbed = mission.people.some((p) => p.state === 'grabbed');
		}
		expect(grabbed).toBe(true);
		for (let s = 0; s < 60 && mission.taken === 0; s++) run(0.5, away);
		expect(mission.taken).toBeGreaterThan(0);
		expect(Math.hypot(SHIP.x, SHIP.y)).toBeGreaterThan(0);
	});

	it('hurt a carrier enough and he lets go; the Flash runs them home', () => {
		const { mission, run, safe } = setup();
		run(3.1, safe);
		let p = mission.people.find((k) => k.state === 'grabbed');
		for (let s = 0; s < 40 && !p; s++) {
			run(0.5, safe);
			p = mission.people.find((k) => k.state === 'grabbed');
		}
		const c = p!.carrier!;
		hitDummy(c, c.maxHp * (CARRY.drop + 0.05), 0, c.x, c.y);
		run(0.1, safe);
		expect(p!.state).toBe('dropped');
		expect(mission.saves).toBe(1);
		for (let s = 0; s < 40 && p!.state !== 'home'; s++) run(0.5, safe);
		expect(p!.state).toBe('home');
		expect(Math.hypot(p!.x - HOME.x, p!.y - HOME.y)).toBeLessThan(150);
	});

	it(`${TAKEN_LIMIT} taken loses it`, () => {
		const { mission, run, safe } = setup();
		run(3.1, safe);
		for (const p of mission.people.slice(0, TAKEN_LIMIT)) p.state = 'taken';
		run(0.1, safe);
		expect(mission.state).toBe('lost');
		expect(mission.failReason).toBe('taken');
	});

	it('everyone home or taken (under the limit): won', () => {
		const { game, mission, run, safe } = setup();
		run(3.1, safe);
		for (const p of mission.people) p.state = 'home';
		mission.people[0].state = 'taken';
		run(0.1, safe);
		expect(mission.state).toBe('won');
		expect(game.enemies.some(isStanding)).toBe(true);
	});
});
