import { describe, expect, it } from 'vitest';
import { IDLE, type Intent } from './input';
import { LANTERNS, type LanternId } from './lanterns';
import {
	FLY_SPEED_BONUS,
	TAKEOFF_TIME,
	clampToBounds,
	createPlayer,
	updatePlayer,
	type Solid,
	type WorldRules
} from './player';

const DT = 1 / 60;
const move = (moveX: number, moveY: number): Intent => ({ ...IDLE, moveX, moveY });
const RIGHT = move(1, 0);
const LEFT = move(-1, 0);
const DOWN = move(0, 1);
const FLY: Intent = { ...IDLE, toggleFly: true };

const make = (id: LanternId = 'hal') => createPlayer(0, LANTERNS[id], { read: () => IDLE }, 0, 0);

/** Run `intent` for `seconds` of fixed ticks. */
function hold(p: ReturnType<typeof make>, intent: Intent, seconds: number, world?: WorldRules) {
	for (let i = 0; i < Math.round(seconds * 60); i++) updatePlayer(p, intent, DT, world);
}

describe('updatePlayer: movement', () => {
	it('stands still with no input', () => {
		const p = make();
		hold(p, IDLE, 1);
		expect(p.x).toBe(0);
		expect(p.y).toBe(0);
	});

	it('accelerates up to max speed and no further', () => {
		const p = make();
		hold(p, RIGHT, 2);
		expect(p.vx).toBeCloseTo(LANTERNS.hal.maxSpeed);
	});

	it('does not reach top speed instantly', () => {
		const p = make();
		updatePlayer(p, RIGHT, DT);
		expect(p.vx).toBeLessThan(LANTERNS.hal.maxSpeed);
	});

	it('coasts to a full stop after letting go', () => {
		const p = make();
		hold(p, RIGHT, 1);
		hold(p, IDLE, 1);
		expect(p.vx).toBe(0);
	});

	it('Hal is faster than John', () => {
		const hal = make('hal');
		const john = make('john');
		hold(hal, RIGHT, 2);
		hold(john, RIGHT, 2);
		expect(hal.x).toBeGreaterThan(john.x);
	});

	it('faces left or right based on horizontal input', () => {
		const p = make();
		hold(p, LEFT, 0.2);
		expect(p.dir).toBe(-1);
		hold(p, RIGHT, 0.2);
		expect(p.dir).toBe(1);
	});

	it('keeps facing the same way when moving straight up or down', () => {
		const p = make();
		hold(p, LEFT, 0.2);
		hold(p, DOWN, 0.5);
		expect(p.dir).toBe(-1);
	});

	it('animates legs while walking and resets when stopped', () => {
		const p = make();
		hold(p, RIGHT, 0.5);
		expect(p.walkPhase).toBeGreaterThan(0);
		hold(p, IDLE, 1);
		expect(p.walkPhase).toBe(0);
	});

	it('remembers the previous position for smooth rendering', () => {
		const p = make();
		hold(p, RIGHT, 0.5);
		const before = p.x;
		updatePlayer(p, RIGHT, DT);
		expect(p.prevX).toBe(before);
	});
});

describe('updatePlayer: take off and land', () => {
	const openGround: WorldRules = { solids: [], alwaysFlying: false };

	it('the fly key takes off, and pressing again lands', () => {
		const p = make();
		updatePlayer(p, FLY, DT, openGround);
		expect(p.flying).toBe(true);
		updatePlayer(p, FLY, DT, openGround);
		expect(p.flying).toBe(false);
	});

	it('rises smoothly to full altitude', () => {
		const p = make();
		updatePlayer(p, FLY, DT, openGround);
		expect(p.altitude).toBeGreaterThan(0);
		expect(p.altitude).toBeLessThan(1);
		hold(p, IDLE, TAKEOFF_TIME + 0.05, openGround);
		expect(p.altitude).toBe(1);
	});

	it('does not walk while flying', () => {
		const p = make();
		updatePlayer(p, FLY, DT, openGround);
		hold(p, RIGHT, 0.5, openGround);
		expect(p.walkPhase).toBe(0);
		expect(p.x).toBeGreaterThan(0);
	});

	it('flying is faster than walking', () => {
		const p = make();
		updatePlayer(p, FLY, DT, openGround);
		hold(p, RIGHT, 2, openGround);
		expect(p.vx).toBeCloseTo(LANTERNS.hal.maxSpeed * FLY_SPEED_BONUS);
	});

	it('cannot land on top of an obstacle', () => {
		const roof: Solid = { x: -50, y: -50, w: 100, h: 100, blocksFlying: false };
		const p = make();
		const world: WorldRules = { solids: [roof], alwaysFlying: false };
		p.flying = true;
		updatePlayer(p, FLY, DT, world);
		expect(p.flying).toBe(true);
	});

	it('in space you are always flying, and the key does nothing', () => {
		const p = make();
		const space: WorldRules = { solids: [], alwaysFlying: true };
		updatePlayer(p, FLY, DT, space);
		expect(p.flying).toBe(true);
		updatePlayer(p, FLY, DT, space);
		expect(p.flying).toBe(true);
	});
});

describe('updatePlayer: collisions', () => {
	// A long wall just to the right of the player, from x=40 to x=90
	const wall = (blocksFlying: boolean): Solid => ({ x: 40, y: -1000, w: 50, h: 2000, blocksFlying });

	it('walking into a wall stops you at its edge', () => {
		const p = make();
		hold(p, RIGHT, 1, { solids: [wall(false)], alwaysFlying: false });
		expect(p.x).toBeLessThanOrEqual(40 - 8);
		expect(p.x).toBeGreaterThan(20);
	});

	it('you slide along a wall when moving diagonally into it', () => {
		const p = make();
		const world = { solids: [wall(false)], alwaysFlying: false };
		hold(p, move(Math.SQRT1_2, Math.SQRT1_2), 1, world);
		expect(p.x).toBeLessThanOrEqual(32);
		expect(p.y).toBeGreaterThan(100); // still moved down
	});

	it('flying passes over low obstacles', () => {
		const p = make();
		p.flying = true;
		hold(p, RIGHT, 1, { solids: [wall(false)], alwaysFlying: false });
		expect(p.x).toBeGreaterThan(90);
	});

	it('tall obstacles (asteroids) block flyers too', () => {
		const p = make();
		hold(p, RIGHT, 1, { solids: [wall(true)], alwaysFlying: true });
		expect(p.x).toBeLessThanOrEqual(32);
	});
});

describe('clampToBounds', () => {
	it('stops at the edge and cancels velocity into the edge', () => {
		const p = make();
		p.x = 120;
		p.vx = 300;
		clampToBounds(p, 0, 0, 100, 100);
		expect(p.x).toBe(100);
		expect(p.vx).toBe(0);
	});
});
