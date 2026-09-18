import { describe, expect, it } from 'vitest';
import { Game } from '../game';
import { IDLE } from '../input';
import { MISSION_LIVES, ROCKS, SafePassage, TOTAL_ROCKS, buildBeltMap } from './safePassage';

function setup(seed = 1) {
	const map = buildBeltMap();
	const game = new Game({ players: [{ lantern: 'hal', keys: 'solo' }], map });
	game.setView({ width: 1400, height: 800 });
	game.dummies.length = 0;
	const mission = new SafePassage(map, seed);
	game.director = mission;
	return { game, mission, p: game.players[0] };
}

const run = (game: Game, seconds: number, each?: () => void) => {
	for (let i = 0; i < Math.round(seconds * 60); i++) {
		game.update(1 / 60);
		each?.();
	}
};

const rocks = (game: Game) => game.dummies.filter((d) => d.kind === 'spaceRock');

describe('Mission 1: Safe Passage', () => {
	it(`sends ${TOTAL_ROCKS} asteroids in all, in waves, while the ship crosses the belt`, () => {
		expect(TOTAL_ROCKS).toBe(100);
		const { game, mission, p } = setup();
		run(game, 2);
		expect(mission.state).toBe('intro');
		const start = mission.ship.x;
		// Nobody's shooting here, so keep the ship in one piece
		const keep = () => {
			p.invuln = 1;
			mission.ship.hull = mission.ship.maxHull;
		};
		run(game, 40, keep);
		expect(mission.state).toBe('playing');
		expect(mission.ship.x).toBeGreaterThan(start);
		expect(mission.spawned).toBeGreaterThan(10);
		expect(mission.spawned).toBeLessThan(TOTAL_ROCKS);
		run(game, 130, keep);
		expect(mission.spawned).toBe(TOTAL_ROCKS);
	});

	it('asteroids are targets like any other: shooting one breaks it and counts it', () => {
		const { game, mission, p } = setup();
		run(game, 12, () => (p.invuln = 1));
		const rock = rocks(game)[0];
		expect(rock).toBeDefined();
		rock.hp = 1;
		// A ring shot straight at it (the game aims at its drawn body)
		game.buttons.press('KeyJ');
		p.lock = { kind: 'enemy', dummy: rock };
		run(game, 1.2, () => (p.invuln = 1));
		game.buttons.release('KeyJ');
		expect(mission.destroyed).toBeGreaterThan(0);
	});

	it('an asteroid reaching the ship damages its hull (and does not count as blasted)', () => {
		const { game, mission, p } = setup();
		run(game, 9, () => (p.invuln = 1));
		const rock = rocks(game)[0];
		const hull = mission.ship.hull;
		rock.x = mission.ship.x + 20;
		rock.y = mission.ship.y;
		run(game, 0.05);
		expect(mission.ship.hull).toBeLessThan(hull);
		expect(mission.impacts).toBe(1);
		run(game, 0.5, () => (p.invuln = 1));
		expect(mission.destroyed).toBe(0);
	});

	it('the ship making it across is a win, rated by hull and asteroids blasted', () => {
		const { game, mission, p } = setup();
		run(game, 4);
		mission.ship.x = buildBeltMap().width - 430;
		run(game, 1, () => (p.invuln = 1));
		expect(mission.state).toBe('won');
		expect(mission.stars).toBeGreaterThanOrEqual(1);
		expect(mission.stars).toBeLessThanOrEqual(3);
	});

	it('losing the ship loses the mission', () => {
		const { game, mission } = setup();
		run(game, 4);
		mission.ship.hull = 1;
		const rock = rocks(game)[0] ?? null;
		run(game, 2);
		const r = rocks(game)[0] ?? rock;
		if (r) {
			r.x = mission.ship.x;
			r.y = mission.ship.y;
		} else {
			mission.ship.hull = 0;
		}
		run(game, 0.2);
		expect(mission.state).toBe('lost');
		expect(mission.failReason).toBe('ship');
	});

	it(`Hal going down ${MISSION_LIVES} times loses the mission`, () => {
		const { game, mission, p } = setup();
		run(game, 4);
		for (let i = 0; i < MISSION_LIVES; i++) {
			p.downed = true;
			p.downTimer = 0.1;
			run(game, 0.5);
		}
		expect(mission.state).toBe('lost');
		expect(mission.failReason).toBe('lantern');
	});

	it('the Lantern battery rides with the ship', () => {
		const { game, mission, p } = setup();
		run(game, 20, () => (p.invuln = 1));
		expect(Math.abs(game.batteries[0].x - mission.ship.x)).toBeLessThan(40);
	});

	it('bigger asteroids are tougher and hit harder', () => {
		expect(ROCKS.large.hp).toBeGreaterThan(ROCKS.medium.hp);
		expect(ROCKS.medium.hp).toBeGreaterThan(ROCKS.small.hp);
		expect(ROCKS.large.shipDamage).toBeGreaterThan(ROCKS.small.shipDamage);
	});

	it('the ship can be shielded, and asteroids on a collision course make Shift pick it', () => {
		const { game, mission, p } = setup();
		run(game, 9, () => (p.invuln = 1));
		expect(game.constructs.protectables).toContain(mission.ship);
		// Park Hal next to the ship and aim a rock straight at it
		p.x = mission.ship.x - 60;
		p.y = mission.ship.y + 80;
		const rock = rocks(game)[0];
		rock.x = mission.ship.x + 200;
		rock.y = mission.ship.y;
		rock.vx = -150;
		rock.vy = 0;
		run(game, 1 / 60);
		expect(mission.ship.threat).toBeGreaterThan(0);
		p.input = { read: () => ({ ...IDLE, shield: true }) };
		run(game, 1 / 60);
		expect(game.constructs.shields.some((s) => s.target === mission.ship)).toBe(true);
	});

	it('a shielded ship takes no hull damage; the rock breaks on the bubble and counts', () => {
		const { game, mission, p } = setup();
		run(game, 9, () => (p.invuln = 1));
		const ship = mission.ship;
		game.constructs.shields.push({ owner: p, target: ship, hp: 200, maxHp: 200, life: 10, maxLife: 10, ripple: 0 });
		const hull = ship.hull;
		const rock = rocks(game)[0];
		rock.x = ship.x + 20;
		rock.y = ship.y;
		run(game, 0.5, () => (p.invuln = 1));
		expect(ship.hull).toBe(hull);
		expect(mission.impacts).toBe(0);
		expect(mission.destroyed).toBe(1);
	});
});
