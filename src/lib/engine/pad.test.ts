import { describe, expect, it } from 'vitest';
import { IDLE, type InputSource, type Intent } from './input';
import { LANTERNS } from './lanterns';
import { PadInput, PadState, STICK_TIMEOUT } from './pad';
import { createPlayer } from './player';

function setup(keys: Partial<Intent> = {}) {
	const clock = { t: 0 };
	const pad = new PadState(() => clock.t);
	const keyboard: InputSource = { read: () => ({ ...IDLE, ...keys }) };
	const me = createPlayer(0, LANTERNS.john, keyboard, 500, 400);
	const input = new PadInput(keyboard, pad, () => me);
	pad.apply({ t: 'pads', n: 1 });
	return { pad, input, me, clock };
}

describe('the phone pad', () => {
	it('the left stick moves you; a stick barely off centre does nothing', () => {
		const { pad, input } = setup();
		pad.apply({ t: 'sticks', lx: 0.05, ly: 0.05, rx: 0, ry: 0 });
		expect(input.read().moveX).toBe(0);
		pad.apply({ t: 'sticks', lx: 1, ly: 0, rx: 0, ry: 0 });
		const i = input.read();
		expect(i.moveX).toBeCloseTo(1);
		expect(i.moveY).toBeCloseTo(0);
	});

	it('the right stick aims the ring that way and fires', () => {
		const { pad, input, me } = setup();
		pad.apply({ t: 'sticks', lx: 0, ly: 0, rx: 0, ry: -1 });
		const i = input.read();
		expect(i.shot).toBe(true);
		expect(i.pointer!.x).toBeCloseTo(me.x);
		expect(i.pointer!.y).toBeLessThan(me.y);
	});

	it('buttons do their thing; a quick tap between ticks still counts, once', () => {
		const { pad, input } = setup();
		pad.apply({ t: 'down', b: 'circle' });
		pad.apply({ t: 'up', b: 'circle' });
		expect(input.read().shield).toBe(true);
		expect(input.read().shield).toBe(false);
		pad.apply({ t: 'down', b: 'cross' });
		const first = input.read();
		expect(first.construct && first.constructPressed).toBe(true);
		// Held: still on, but not pressed again
		const held = input.read();
		expect(held.construct).toBe(true);
		expect(held.constructPressed).toBe(false);
		pad.apply({ t: 'down', b: 'r1' });
		expect(input.read().cycle).toBe(1);
		pad.apply({ t: 'down', b: 'triangle' });
		expect(input.read().toggleFly).toBe(true);
	});

	it('the keyboard keeps working alongside it', () => {
		const { pad, input } = setup({ moveX: -1, shield: true });
		const i = input.read();
		expect(i.moveX).toBe(-1);
		expect(i.shield).toBe(true);
		// The stick wins while it's pushed
		pad.apply({ t: 'sticks', lx: 1, ly: 0, rx: 0, ry: 0 });
		expect(input.read().moveX).toBeCloseTo(1);
	});

	it("a lost 'released' never leaves you running: the pad goes quiet and the sticks centre", () => {
		const { pad, input, clock } = setup();
		pad.apply({ t: 'sticks', lx: 1, ly: 0, rx: 0, ry: 0 });
		clock.t = STICK_TIMEOUT - 50;
		expect(input.read().moveX).toBeCloseTo(1);
		clock.t = STICK_TIMEOUT + 50;
		expect(input.read().moveX).toBe(0);
	});

	it("the pad's regular updates say what's held, so a lost button release is corrected", () => {
		const { pad, input } = setup();
		pad.apply({ t: 'down', b: 'square' });
		expect(input.read().shot).toBe(true);
		// The 'up' never arrived, but the next update says nothing is held
		pad.apply({ t: 'sticks', lx: 0, ly: 0, rx: 0, ry: 0, held: [] });
		expect(input.read().shot).toBe(false);
	});

	it('the right stick marks its aim as a stick (so aim assist is wider than a mouse)', () => {
		const { pad, input } = setup();
		pad.apply({ t: 'sticks', lx: 0, ly: 0, rx: 1, ry: 0 });
		expect(input.read().stickAim).toBe(true);
	});

	it('when the phone disconnects, everything is let go', () => {
		const { pad, input } = setup();
		pad.apply({ t: 'down', b: 'square' });
		pad.apply({ t: 'sticks', lx: 1, ly: 0, rx: 1, ry: 0 });
		pad.apply({ t: 'pads', n: 0 });
		const i = input.read();
		expect(i.shot).toBe(false);
		expect(i.moveX).toBe(0);
	});
});
