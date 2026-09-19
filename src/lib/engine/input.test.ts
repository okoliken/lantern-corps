import { describe, expect, it } from 'vitest';
import {
	BindingInput,
	ButtonState,
	DEFAULT_BINDINGS,
	PointerState,
	MOUSE_IDLE_MS,
	buttonLabel,
	moveFromButtons,
	shortLabel,
	usesMouse
} from './input';

function setup(layout: 'solo' | 'p1' | 'p2' = 'solo', options = {}) {
	const buttons = new ButtonState();
	const input = new BindingInput(buttons, DEFAULT_BINDINGS[layout], options);
	return { buttons, input };
}

describe('movement', () => {
	it('no buttons means no movement', () => {
		const { buttons } = setup();
		expect(moveFromButtons(buttons, DEFAULT_BINDINGS.solo)).toEqual({ moveX: 0, moveY: 0 });
	});

	it('WASD and arrows both move in single player', () => {
		const { buttons } = setup();
		buttons.press('KeyD');
		expect(moveFromButtons(buttons, DEFAULT_BINDINGS.solo).moveX).toBe(1);
		buttons.release('KeyD');
		buttons.press('ArrowUp');
		expect(moveFromButtons(buttons, DEFAULT_BINDINGS.solo).moveY).toBe(-1);
	});

	it('diagonals are normalized so they are not faster', () => {
		const { buttons } = setup();
		buttons.press('KeyW');
		buttons.press('KeyD');
		const m = moveFromButtons(buttons, DEFAULT_BINDINGS.solo);
		expect(Math.hypot(m.moveX, m.moveY)).toBeCloseTo(1);
	});

	it(`co-op: one player's keys don't move the other`, () => {
		const buttons = new ButtonState();
		buttons.press('ArrowLeft');
		expect(moveFromButtons(buttons, DEFAULT_BINDINGS.p1).moveX).toBe(0);
		expect(moveFromButtons(buttons, DEFAULT_BINDINGS.p2).moveX).toBe(-1);
	});
});

describe('mouse buttons are bindable like keys', () => {
	it('left click is the ring shot, right click the construct', () => {
		const { buttons, input } = setup();
		buttons.press('Mouse0');
		buttons.press('Mouse2');
		const intent = input.read();
		expect(intent.shot).toBe(true);
		expect(intent.construct).toBe(true);
		expect(intent.constructPressed).toBe(true);
	});

	it('scroll wheel switches construct', () => {
		const { buttons, input } = setup();
		buttons.tap('WheelDown');
		expect(input.read().cycle).toBe(1);
		buttons.tap('WheelUp');
		expect(input.read().cycle).toBe(-1);
		expect(input.read().cycle).toBe(0);
	});
});

describe('presses', () => {
	it('a press is seen once, while held stays true', () => {
		const { buttons, input } = setup();
		buttons.press('KeyK');
		expect(input.read()).toMatchObject({ construct: true, constructPressed: true });
		expect(input.read()).toMatchObject({ construct: true, constructPressed: false });
	});

	it('a quick tap between ticks is not lost', () => {
		const { buttons, input } = setup();
		buttons.press('Space');
		buttons.release('Space');
		expect(input.read().toggleFly).toBe(true);
	});

	it('key repeat while held does not count as more presses', () => {
		const { buttons, input } = setup();
		buttons.press('Space');
		buttons.press('Space');
		expect(input.read().toggleFly).toBe(true);
		expect(input.read().toggleFly).toBe(false);
	});

	it('slot keys select by index', () => {
		const { buttons, input } = setup();
		buttons.press('Digit3');
		expect(input.read().select).toBe(2);
		expect(input.read().select).toBe(-1);
	});

	it('player 2 uses 6-0 for their slots', () => {
		const buttons = new ButtonState();
		const p1 = new BindingInput(buttons, DEFAULT_BINDINGS.p1);
		const p2 = new BindingInput(buttons, DEFAULT_BINDINGS.p2);
		buttons.press('Digit7');
		expect(p1.read().select).toBe(-1);
		expect(p2.read().select).toBe(1);
	});

	it('shift is the shield', () => {
		const { buttons, input } = setup();
		buttons.press('ShiftLeft');
		expect(input.read().shield).toBe(true);
	});
});

describe('ring shot clicks', () => {
	it('a quick click fires even if it is released before the next tick', () => {
		const { buttons, input } = setup();
		buttons.press('Mouse0');
		buttons.release('Mouse0');
		expect(input.read().shot).toBe(true);
		expect(input.read().shot).toBe(false);
	});
});

describe('toggle ring shot (accessibility)', () => {
	it('tap to start, tap again to stop, no holding', () => {
		const { buttons, input } = setup('solo', { toggleShot: true });
		buttons.press('Mouse0');
		buttons.release('Mouse0');
		expect(input.read().shot).toBe(true);
		expect(input.read().shot).toBe(true);
		buttons.press('Mouse0');
		buttons.release('Mouse0');
		expect(input.read().shot).toBe(false);
	});
});

describe('pointer', () => {
	it('reports the mouse in world coordinates once it has moved', () => {
		const buttons = new ButtonState();
		const clock = { t: 1000 };
		const state = new PointerState(() => clock.t);
		const input = new BindingInput(buttons, DEFAULT_BINDINGS.solo, {
			pointer: { state, toWorld: (sx, sy) => ({ x: sx * 2, y: sy * 2 }) }
		});
		expect(input.read().pointer).toBeNull();
		Object.assign(state, { active: true, x: 10, y: 20, movedAt: clock.t });
		expect(input.read().pointer).toEqual({ x: 20, y: 40 });
	});

	it("a mouse left alone stops aiming (the ring auto-aims), unless a mouse button is held", () => {
		const buttons = new ButtonState();
		const clock = { t: 1000 };
		const state = new PointerState(() => clock.t);
		const input = new BindingInput(buttons, DEFAULT_BINDINGS.solo, {
			pointer: { state, toWorld: (sx, sy) => ({ x: sx, y: sy }) }
		});
		Object.assign(state, { active: true, x: 10, y: 20, movedAt: clock.t });
		clock.t += MOUSE_IDLE_MS + 100;
		expect(input.read().pointer).toBeNull();
		// Holding the mouse button to shoot: it's aiming again
		buttons.press('Mouse0');
		expect(input.read().pointer).toEqual({ x: 10, y: 20 });
	});

	it('only mouse layouts aim with the mouse', () => {
		expect(usesMouse(DEFAULT_BINDINGS.solo)).toBe(true);
		expect(usesMouse(DEFAULT_BINDINGS.p2)).toBe(false);
	});
});

describe('labels', () => {
	it('names buttons readably', () => {
		expect(buttonLabel('KeyE')).toBe('E');
		expect(buttonLabel('Mouse0')).toBe('Left click');
		expect(buttonLabel('ShiftLeft')).toBe('Left Shift');
		expect(buttonLabel('Digit7')).toBe('7');
	});

	it('HUD labels prefer a keyboard key over a mouse button', () => {
		expect(shortLabel(['Mouse2', 'KeyK'])).toBe('K');
		expect(shortLabel(['ShiftLeft', 'KeyL'])).toBe('LShift');
	});
});

describe('quick cast', () => {
	const make = (quickCast: boolean) => {
		const buttons = new ButtonState();
		const input = new BindingInput(buttons, structuredClone(DEFAULT_BINDINGS.solo), { quickCast });
		return { buttons, input };
	};

	it('tapping a construct key uses it straight away', () => {
		const { buttons, input } = make(true);
		buttons.press('Digit6');
		buttons.release('Digit6');
		const intent = input.read();
		expect(intent.select).toBe(5);
		expect(intent.constructPressed).toBe(true);
	});

	it('holding a construct key keeps it going (beam, minigun, sniper charge)', () => {
		const { buttons, input } = make(true);
		buttons.press('Digit1');
		input.read();
		const held = input.read();
		expect(held.select).toBe(0);
		expect(held.construct).toBe(true);
		buttons.release('Digit1');
		expect(input.read().construct).toBe(false);
	});

	it('turned off, construct keys only pick', () => {
		const { buttons, input } = make(false);
		buttons.press('Digit3');
		const intent = input.read();
		expect(intent.select).toBe(2);
		expect(intent.constructPressed).toBe(false);
		expect(intent.construct).toBe(false);
	});
});
