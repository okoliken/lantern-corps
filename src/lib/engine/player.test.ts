import { describe, expect, it } from 'vitest';
import { IDLE, type Intent } from './input';
import { LANTERNS, type LanternId } from './lanterns';
import { clampToBounds, createPlayer, updatePlayer } from './player';

const DT = 1 / 60;
const RIGHT: Intent = { moveX: 1, moveY: 0 };
const DOWN: Intent = { moveX: 0, moveY: 1 };

const make = (id: LanternId = 'hal') => createPlayer(0, LANTERNS[id], { read: () => IDLE }, 0, 0);

/** Run `intent` for `seconds` of fixed ticks. */
function hold(p: ReturnType<typeof make>, intent: Intent, seconds: number) {
	for (let i = 0; i < Math.round(seconds * 60); i++) updatePlayer(p, intent, DT);
}

describe('updatePlayer', () => {
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
		expect(p.x).toBeGreaterThan(0);
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
		hold(p, { moveX: -1, moveY: 0 }, 0.2);
		expect(p.dir).toBe(-1);
		hold(p, RIGHT, 0.2);
		expect(p.dir).toBe(1);
	});

	it('keeps facing the same way when moving straight up or down', () => {
		const p = make();
		hold(p, { moveX: -1, moveY: 0 }, 0.2);
		hold(p, DOWN, 0.5);
		expect(p.dir).toBe(-1);
	});

	it('animates legs while moving and resets when stopped', () => {
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

describe('clampToBounds', () => {
	it('stops at the edge and cancels velocity into the wall', () => {
		const p = make();
		p.x = 120;
		p.vx = 300;
		clampToBounds(p, 0, 0, 100, 100);
		expect(p.x).toBe(100);
		expect(p.vx).toBe(0);
	});
});
