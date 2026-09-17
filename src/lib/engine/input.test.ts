import { describe, expect, it } from 'vitest';
import { KeyboardInput, KeyboardState, LAYOUTS, intentFromKeys } from './input';

const keys = (...codes: string[]) => new Set(codes);
const still = { moveX: 0, moveY: 0, toggleFly: false };

describe('intentFromKeys', () => {
	it('no keys means no movement', () => {
		expect(intentFromKeys(keys(), LAYOUTS.wasd)).toEqual(still);
	});

	it('maps WASD to directions (y down is positive)', () => {
		expect(intentFromKeys(keys('KeyD'), LAYOUTS.wasd)).toMatchObject({ moveX: 1, moveY: 0 });
		expect(intentFromKeys(keys('KeyW'), LAYOUTS.wasd)).toMatchObject({ moveX: 0, moveY: -1 });
	});

	it('opposite keys cancel out', () => {
		expect(intentFromKeys(keys('KeyA', 'KeyD'), LAYOUTS.wasd).moveX).toBe(0);
	});

	it('diagonals are normalized so they are not faster', () => {
		const i = intentFromKeys(keys('KeyW', 'KeyD'), LAYOUTS.wasd);
		expect(Math.hypot(i.moveX, i.moveY)).toBeCloseTo(1);
	});

	it("one player's keys don't move the other player", () => {
		expect(intentFromKeys(keys('ArrowLeft'), LAYOUTS.wasd)).toEqual(still);
		expect(intentFromKeys(keys('KeyA'), LAYOUTS.arrows)).toEqual(still);
	});

	it('the "both" layout accepts either set', () => {
		expect(intentFromKeys(keys('KeyA'), LAYOUTS.both).moveX).toBe(-1);
		expect(intentFromKeys(keys('ArrowLeft'), LAYOUTS.both).moveX).toBe(-1);
	});
});

describe('fly key presses', () => {
	it('a press is reported exactly once, even if the key is still held', () => {
		const kb = new KeyboardState();
		const input = new KeyboardInput(kb, LAYOUTS.both);
		kb.press('Space');
		expect(input.read().toggleFly).toBe(true);
		expect(input.read().toggleFly).toBe(false);
	});

	it('a quick tap between ticks is not lost', () => {
		const kb = new KeyboardState();
		const input = new KeyboardInput(kb, LAYOUTS.both);
		kb.press('Space');
		kb.release('Space');
		expect(input.read().toggleFly).toBe(true);
	});

	it('holding a key down (key repeat) does not count as more presses', () => {
		const kb = new KeyboardState();
		const input = new KeyboardInput(kb, LAYOUTS.both);
		kb.press('Space');
		kb.press('Space');
		kb.press('Space');
		expect(input.read().toggleFly).toBe(true);
		expect(input.read().toggleFly).toBe(false);
	});

	it('player 2 flies with their own key', () => {
		const kb = new KeyboardState();
		const p1 = new KeyboardInput(kb, LAYOUTS.wasd);
		const p2 = new KeyboardInput(kb, LAYOUTS.arrows);
		kb.press('ShiftRight');
		expect(p1.read().toggleFly).toBe(false);
		expect(p2.read().toggleFly).toBe(true);
	});
});
