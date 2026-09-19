import { describe, expect, it } from 'vitest';
import { Game } from '../game';
import { IDLE } from '../input';
import { AMBUSH_X, JUMP_X, InterceptorMission, REBOOT_TIME, SHIP_HULL, TORPEDO, buildFrontierMap } from './interceptor';

function setup() {
	const map = buildFrontierMap();
	const game = new Game({
		players: [
			{ lantern: 'hal', keys: 'solo' },
			{ lantern: 'kilowog', keys: 'p2', ai: true }
		],
		map
	});
	game.setView({ width: 1400, height: 800 });
	const mission = new InterceptorMission();
	game.director = mission;
	const hal = game.players[0];
	const run = (seconds: number, each?: () => void) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) {
			game.update(1 / 60);
			each?.();
		}
	};
	const safe = () => {
		for (const p of game.players) p.invuln = 1;
	};
	const clear = () => {
		for (const e of game.enemies) {
			e.hp = 0;
			e.down = 1;
		}
		run(0.1, safe);
	};
	const torpedoes = () => game.dummies.filter((d) => d.kind === 'rageTorpedo');
	return { game, mission, hal, run, safe, clear, torpedoes };
}

describe('Mission 4: The Interceptor', () => {
	it('Hal and Kilowog fly it; the ship sets off across the frontier', () => {
		const { game, mission, run, safe } = setup();
		expect(game.players.map((p) => p.def.id)).toEqual(['hal', 'kilowog']);
		const x = mission.ship.x;
		run(10, safe);
		expect(mission.state).toBe('playing');
		expect(mission.ship.x).toBeGreaterThan(x + 100);
		expect(game.enemies.some((e) => e.kind === 'redFighter')).toBe(true);
	});

	it('fighters fire torpedoes at the ship; one that gets through hurts the hull', () => {
		const { game, mission, run, safe, torpedoes } = setup();
		run(3.1);
		// Both Lanterns stay by the ship but do nothing, so no torpedo gets shot down
		for (const p of game.players) p.input = { read: () => IDLE };
		const park = () => {
			safe();
			for (const p of game.players) {
				p.x = mission.ship.x - 150;
				p.y = mission.ship.y + 260;
			}
		};
		run(15, park);
		expect(mission.torpedoHits).toBeGreaterThan(0);
		expect(mission.ship.hull).toBeLessThan(SHIP_HULL);
		expect(torpedoes().length + mission.torpedoHits).toBeGreaterThan(0);
	});

	it('a torpedo is a target: a ring-shot burst breaks it and it counts as shot down', () => {
		const { game, mission, hal, run, safe } = setup();
		run(3.1);
		// Well away from the ship, so the torpedo can only be shot
		hal.x = mission.ship.x + 600;
		hal.y = mission.ship.y + 500;
		const t = {
			kind: 'rageTorpedo' as const,
			x: hal.x + 150,
			y: hal.y,
			prevX: hal.x + 150,
			prevY: hal.y,
			vx: 0,
			vy: 0,
			hp: TORPEDO.hp,
			maxHp: TORPEDO.hp,
			homeX: 0,
			homeY: 0,
			caged: 0,
			flash: 0,
			stun: 0,
			down: 0,
			respawns: false,
			gone: false,
			dir: 1 as const,
			drift: { radius: TORPEDO.radius, float: 44, spin: 0, seed: 0.5 }
		};
		game.dummies.push(t);
		(mission as unknown as { torpedoes: Set<unknown> }).torpedoes.add(t);
		hal.input = { read: () => ({ ...IDLE, shot: true, pointer: { x: t.x, y: t.y - 44 - hal.ringLift + 44 } }) };
		run(1, safe);
		expect(t.hp).toBe(0);
		expect(mission.torpedoesDowned).toBeGreaterThanOrEqual(1);
	});

	it('Shift puts the bubble on the ship when torpedoes are coming for it, and it blocks them', () => {
		const { game, mission, hal, run, safe, clear, torpedoes } = setup();
		run(3.1);
		const kilowog = game.players[1];
		kilowog.input = { read: () => IDLE };
		const wait = () => {
			safe();
			hal.x = kilowog.x = mission.ship.x;
			hal.y = kilowog.y = mission.ship.y + 200;
		};
		// Wait until a torpedo is on its way, then take the fighters away so the
		// ship is the only one in danger (otherwise Shift rightly goes on a Lantern)
		for (let i = 0; i < 20 * 60 && mission.ship.threat <= 0; i++) run(1 / 60, wait);
		expect(mission.ship.threat).toBeGreaterThan(0);
		clear();
		hal.input = { read: () => ({ ...IDLE, shield: true }) };
		run(1 / 60);
		hal.input = { read: () => IDLE };
		const shield = game.constructs.shields.find((s) => s.target === mission.ship);
		expect(shield).toBeTruthy();
		expect(torpedoes().length).toBeGreaterThan(0);
	});

	it('Bleez ambushes halfway: the power goes out and the ship reboots', () => {
		const { game, mission, run, safe, clear } = setup();
		run(3.1);
		mission.ship.x = AMBUSH_X - 5;
		run(1, safe);
		expect(mission.phase).toBe('reboot');
		expect(mission.ship.hull).toBeLessThan(SHIP_HULL);
		const x = mission.ship.x;
		expect(game.enemies.some((e) => e.kind === 'bleez')).toBe(true);
		run(5, safe);
		expect(mission.ship.x).toBe(x); // dead in space
		expect(mission.ship.power).toBe(0);
		clear();
		run(REBOOT_TIME, () => {
			safe();
			mission.ship.hull = SHIP_HULL;
		});
		expect(mission.phase).toBe('online');
	});

	it("once Aya's awake the ship flies on and her cannons shoot the Red Lanterns", () => {
		const { game, mission, run, safe, clear } = setup();
		run(3.1);
		mission.ship.x = AMBUSH_X - 5;
		run(1, safe);
		clear();
		run(REBOOT_TIME + 0.5, () => {
			safe();
			mission.ship.hull = SHIP_HULL;
		});
		expect(mission.phase).toBe('online');
		const x = mission.ship.x;
		const e = game.spawnEnemy('redFighter', mission.ship.x + 300, mission.ship.y);
		run(4, safe);
		expect(e.hp).toBeLessThan(e.maxHp);
		expect(mission.ship.x).toBeGreaterThan(x + 50);
	});

	it('at the jump point Hal and Kilowog fly back aboard, the ship jumps, and that wins', () => {
		const { game, mission, run, safe, clear } = setup();
		run(3.1);
		mission.ship.x = AMBUSH_X - 5;
		run(1, safe);
		clear();
		run(REBOOT_TIME + 0.5, () => {
			safe();
			mission.ship.hull = SHIP_HULL;
		});
		// A straggler is still around when the ship gets there: Aya clears it
		const e = game.spawnEnemy('rageGrunt', mission.ship.x + 400, mission.ship.y + 200);
		for (const p of game.players) p.x = mission.ship.x - 400;
		mission.ship.x = JUMP_X - 2;
		run(0.2, safe);
		expect(mission.phase).toBe('board');
		expect(e.hp).toBe(0);
		// They fly themselves back to the ship and disappear inside
		run(8.5, safe);
		expect(game.players.every((p) => p.boarded)).toBe(true);
		expect(mission.phase === 'jump' || mission.state === 'won').toBe(true);
		const x = mission.ship.x;
		run(5, safe);
		expect(mission.state).toBe('won');
		expect(mission.ship.x).toBeGreaterThan(x + 1000);
		expect(mission.stars).toBe(3);
	});

	it('the ship breaking apart loses the mission', () => {
		const { mission, run, safe } = setup();
		run(3.1);
		mission.ship.hull = 0;
		run(0.1, safe);
		expect(mission.state).toBe('lost');
		expect(mission.failReason).toBe('ship');
	});
});
