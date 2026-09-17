import { describe, expect, it } from 'vitest';
import { LAYOUTS, intentFromKeys } from './input';

const keys = (...codes: string[]) => new Set(codes);

describe('intentFromKeys', () => {
	it('no keys means no movement', () => {
		expect(intentFromKeys(keys(), LAYOUTS.wasd)).toEqual({ moveX: 0, moveY: 0 });
	});

	it('maps WASD to directions (y down is positive)', () => {
		expect(intentFromKeys(keys('KeyD'), LAYOUTS.wasd)).toEqual({ moveX: 1, moveY: 0 });
		expect(intentFromKeys(keys('KeyW'), LAYOUTS.wasd)).toEqual({ moveX: 0, moveY: -1 });
	});

	it('opposite keys cancel out', () => {
		expect(intentFromKeys(keys('KeyA', 'KeyD'), LAYOUTS.wasd).moveX).toBe(0);
	});

	it('diagonals are normalized so they are not faster', () => {
		const i = intentFromKeys(keys('KeyW', 'KeyD'), LAYOUTS.wasd);
		expect(Math.hypot(i.moveX, i.moveY)).toBeCloseTo(1);
	});

	it("one player's keys don't move the other player", () => {
		expect(intentFromKeys(keys('ArrowLeft'), LAYOUTS.wasd)).toEqual({ moveX: 0, moveY: 0 });
		expect(intentFromKeys(keys('KeyA'), LAYOUTS.arrows)).toEqual({ moveX: 0, moveY: 0 });
	});

	it('the "both" layout accepts either set', () => {
		expect(intentFromKeys(keys('KeyA'), LAYOUTS.both).moveX).toBe(-1);
		expect(intentFromKeys(keys('ArrowLeft'), LAYOUTS.both).moveX).toBe(-1);
	});
});
