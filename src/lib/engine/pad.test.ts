import { describe, expect, it } from 'vitest';
import { IDLE, type InputSource, type Intent } from './input';
import { LANTERNS } from './lanterns';
import { PadInput, PadState } from './pad';
import { createPlayer } from './player';

function setup(keys: Partial<Intent> = {}) {
	const pad = new PadState();
	const keyboard: InputSource = { read: () => ({ ...IDLE, ...keys }) };
	const me = createPlayer(0, LANTERNS.john, keyboard, 500, 400);
	const input = new PadInput(keyboard, pad, () => me);
	pad.apply({ t: 'pads', n: 1 });
	return { pad, input, me };
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
