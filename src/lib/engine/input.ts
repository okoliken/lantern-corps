// Input.
//
// A player never reads the keyboard or mouse directly. Each tick it asks its
// InputSource for an Intent: "what does my controller want right now?"
// Keyboard+mouse, a gamepad (M7) or a network connection (Phase 5) can all
// produce Intents, so the player code never changes when we add them.
//
// Controls are ACTIONS (shot, construct, shield...) bound to BUTTON CODES.
// Keyboard keys use KeyboardEvent.code ("KeyW", "Space"), so WASD stays in
// place on AZERTY keyboards. Mouse buttons and the wheel get codes of their
// own ("Mouse0", "WheelUp"), so they can be bound and remapped exactly like
// keys.

// ------------------------------------------------------------------ intent

/** What a player wants to do this tick. */
export interface Intent {
	/** -1 (left) .. 1 (right) */
	moveX: number;
	/** -1 (up) .. 1 (down), because canvas y grows downward */
	moveY: number;
	/** Take off / land was PRESSED (not held) since the last tick. */
	toggleFly: boolean;
	/** Ring shot is on (held, or toggled on). Free: costs no willpower. */
	shot: boolean;
	/** Construct button is HELD (beam and minigun keep going while it's down). */
	construct: boolean;
	/** Construct button was PRESSED since the last tick (one-shot constructs). */
	constructPressed: boolean;
	/** A construct slot was picked: its index (0-9), or -1 for none. */
	select: number;
	/** Switch construct: -1 previous, 1 next, 0 no change. */
	cycle: number;
	/** Lock target was pressed. */
	target: boolean;
	/** Bubble shield was pressed. */
	shield: boolean;
	/** Signature ability was pressed (Jet Strike / Fortress). */
	signature: boolean;
	/** Where the mouse points, in WORLD coordinates. null = not aiming with a mouse. */
	pointer: { x: number; y: number } | null;
}

export const IDLE: Intent = {
	moveX: 0,
	moveY: 0,
	toggleFly: false,
	shot: false,
	construct: false,
	constructPressed: false,
	select: -1,
	cycle: 0,
	target: false,
	shield: false,
	signature: false,
	pointer: null
};

export interface InputSource {
	read(): Intent;
}

// ---------------------------------------------------------------- bindings

export const ACTIONS = [
	'up',
	'down',
	'left',
	'right',
	'shot',
	'construct',
	'prevConstruct',
	'nextConstruct',
	'slot1',
	'slot2',
	'slot3',
	'slot4',
	'slot5',
	'slot6',
	'slot7',
	'slot8',
	'slot9',
	'slot10',
	'shield',
	'signature',
	'fly',
	'target'
] as const;

export type Action = (typeof ACTIONS)[number];

/** Which button codes trigger each action. Several codes per action are allowed. */
export type Bindings = Record<Action, string[]>;

export const ACTION_LABELS: Record<Action, string> = {
	up: 'Move up',
	down: 'Move down',
	left: 'Move left',
	right: 'Move right',
	shot: 'Ring shot (free)',
	construct: 'Use construct',
	prevConstruct: 'Previous construct',
	nextConstruct: 'Next construct',
	slot1: 'Construct 1',
	slot2: 'Construct 2',
	slot3: 'Construct 3',
	slot4: 'Construct 4',
	slot5: 'Construct 5',
	slot6: 'Construct 6',
	slot7: 'Construct 7',
	slot8: 'Construct 8',
	slot9: 'Construct 9',
	slot10: 'Construct 10',
	shield: 'Bubble shield',
	signature: 'Signature ability',
	fly: 'Take off / land',
	target: 'Lock target'
};

/** solo = single player; p1 / p2 = two players sharing one keyboard (P1 also has the mouse). */
export type LayoutName = 'solo' | 'p1' | 'p2';

export const DEFAULT_BINDINGS: Record<LayoutName, Bindings> = {
	solo: {
		up: ['KeyW', 'ArrowUp'],
		down: ['KeyS', 'ArrowDown'],
		left: ['KeyA', 'ArrowLeft'],
		right: ['KeyD', 'ArrowRight'],
		shot: ['Mouse0', 'KeyJ'],
		construct: ['Mouse2', 'KeyK'],
		prevConstruct: ['WheelUp', 'KeyQ'],
		nextConstruct: ['WheelDown', 'KeyE'],
		slot1: ['Digit1'],
		slot2: ['Digit2'],
		slot3: ['Digit3'],
		slot4: ['Digit4'],
		slot5: ['Digit5'],
		slot6: ['Digit6'],
		slot7: ['Digit7'],
		slot8: ['Digit8'],
		slot9: ['Digit9'],
		slot10: ['Digit0'],
		shield: ['ShiftLeft', 'KeyL'],
		signature: ['KeyR', 'Mouse1'],
		fly: ['Space'],
		target: ['Tab']
	},
	p1: {
		up: ['KeyW'],
		down: ['KeyS'],
		left: ['KeyA'],
		right: ['KeyD'],
		shot: ['Mouse0', 'KeyF'],
		construct: ['Mouse2', 'KeyG'],
		prevConstruct: ['WheelUp', 'KeyQ'],
		nextConstruct: ['WheelDown', 'KeyE'],
		slot1: ['Digit1'],
		slot2: ['Digit2'],
		slot3: ['Digit3'],
		slot4: ['Digit4'],
		slot5: ['Digit5'],
		// The row below, since P2 has 6-0
		slot6: ['KeyZ'],
		slot7: ['KeyX'],
		slot8: ['KeyC'],
		slot9: ['KeyV'],
		slot10: ['KeyB'],
		shield: ['ShiftLeft'],
		signature: ['KeyR'],
		fly: ['Space'],
		target: ['Tab']
	},
	p2: {
		up: ['ArrowUp'],
		down: ['ArrowDown'],
		left: ['ArrowLeft'],
		right: ['ArrowRight'],
		shot: ['Period'],
		construct: ['Slash'],
		prevConstruct: ['Semicolon'],
		nextConstruct: ['Quote'],
		// Top-row 6-0, so it works on laptops without a number pad
		slot1: ['Digit6'],
		slot2: ['Digit7'],
		slot3: ['Digit8'],
		slot4: ['Digit9'],
		slot5: ['Digit0'],
		// Carrying on to the right of 0, then the row below
		slot6: ['Minus'],
		slot7: ['Equal'],
		slot8: ['BracketLeft'],
		slot9: ['BracketRight'],
		slot10: ['Backslash'],
		shield: ['ShiftRight'],
		signature: ['KeyP'],
		fly: ['Enter'],
		target: ['Comma']
	}
};

export const SLOT_ACTIONS = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6', 'slot7', 'slot8', 'slot9', 'slot10'] as const;

/** Does this binding set use the mouse at all? Then that player aims with it. */
export function usesMouse(b: Bindings): boolean {
	return Object.values(b).some((codes) => codes.some((c) => c.startsWith('Mouse') || c.startsWith('Wheel')));
}

/** A short readable name for a button code: "KeyE" -> "E", "Mouse0" -> "Left click". */
export function buttonLabel(code: string): string {
	const names: Record<string, string> = {
		Mouse0: 'Left click',
		Mouse1: 'Middle click',
		Mouse2: 'Right click',
		WheelUp: 'Scroll up',
		WheelDown: 'Scroll down',
		ShiftLeft: 'Left Shift',
		ShiftRight: 'Right Shift',
		ControlLeft: 'Left Ctrl',
		ControlRight: 'Right Ctrl',
		AltLeft: 'Left Alt',
		AltRight: 'Right Alt',
		ArrowUp: '↑',
		ArrowDown: '↓',
		ArrowLeft: '←',
		ArrowRight: '→',
		Period: '.',
		Comma: ',',
		Slash: '/',
		Semicolon: ';',
		Quote: "'",
		Backquote: '`',
		BracketLeft: '[',
		BracketRight: ']',
		Backslash: '\\',
		Minus: '-',
		Equal: '='
	};
	return names[code] ?? code.replace(/^(Key|Digit|Numpad)/, '');
}

/** Short label for the HUD: prefers a keyboard key, since mouse names are long. */
export function shortLabel(codes: string[]): string {
	const key = codes.find((c) => !c.startsWith('Mouse') && !c.startsWith('Wheel')) ?? codes[0];
	return key ? buttonLabel(key).replace('Left ', 'L').replace('Right ', 'R') : '';
}

// ------------------------------------------------------------ button state

/**
 * Tracks which buttons (keys, mouse buttons, wheel) are held, and counts
 * presses. One per game, shared by every player on this computer.
 */
export class ButtonState {
	readonly held = new Set<string>();
	/**
	 * Presses not yet handled by the game. "Held" isn't enough for one-shot
	 * actions: a quick tap can start and end between two ticks and never be
	 * seen as held. Counting presses means no tap is ever lost.
	 */
	private presses = new Map<string, number>();

	/** Keys the game uses, so the browser doesn't also act on them (scrolling, tabbing). */
	gameButtons = new Set<string>();

	/** Call when a button goes down. Exposed so tests can simulate input. */
	press(code: string) {
		if (!this.held.has(code)) this.presses.set(code, (this.presses.get(code) ?? 0) + 1);
		this.held.add(code);
	}

	release(code: string) {
		this.held.delete(code);
	}

	/** A wheel notch is a press with no hold. */
	tap(code: string) {
		this.presses.set(code, (this.presses.get(code) ?? 0) + 1);
	}

	/** Uses up one press of any of these codes. True if there was one. */
	consumePress(codes: string[]): boolean {
		for (const code of codes) {
			const n = this.presses.get(code) ?? 0;
			if (n > 0) {
				this.presses.set(code, n - 1);
				return true;
			}
		}
		return false;
	}

	anyHeld(codes: string[]): boolean {
		return codes.some((c) => this.held.has(c));
	}

	/** Forget everything (window lost focus, game paused). */
	clear() {
		this.held.clear();
		this.presses.clear();
	}

	/** Listen to the keyboard on `win` and the mouse on `surface`. Returns a function that stops listening. */
	attach(win: Window, surface: HTMLElement): () => void {
		const keyDown = (e: KeyboardEvent) => {
			if (this.gameButtons.has(e.code)) e.preventDefault();
			this.press(e.code);
		};
		const keyUp = (e: KeyboardEvent) => this.release(e.code);
		const mouseDown = (e: MouseEvent) => {
			e.preventDefault();
			this.press(`Mouse${e.button}`);
		};
		// Mouse-up on the whole window, so releasing outside the canvas still counts
		const mouseUp = (e: MouseEvent) => this.release(`Mouse${e.button}`);
		const wheel = (e: WheelEvent) => {
			e.preventDefault();
			if (e.deltaY !== 0) this.tap(e.deltaY < 0 ? 'WheelUp' : 'WheelDown');
		};
		const noMenu = (e: Event) => e.preventDefault();
		const blur = () => this.clear();

		win.addEventListener('keydown', keyDown);
		win.addEventListener('keyup', keyUp);
		win.addEventListener('mouseup', mouseUp);
		win.addEventListener('blur', blur);
		surface.addEventListener('mousedown', mouseDown);
		surface.addEventListener('wheel', wheel, { passive: false });
		surface.addEventListener('contextmenu', noMenu);
		return () => {
			win.removeEventListener('keydown', keyDown);
			win.removeEventListener('keyup', keyUp);
			win.removeEventListener('mouseup', mouseUp);
			win.removeEventListener('blur', blur);
			surface.removeEventListener('mousedown', mouseDown);
			surface.removeEventListener('wheel', wheel);
			surface.removeEventListener('contextmenu', noMenu);
			this.clear();
		};
	}
}

/** Where the mouse is over the game, in screen (CSS) pixels. */
export class PointerState {
	x = 0;
	y = 0;
	/** Becomes true once the mouse has moved over the game. */
	active = false;

	attach(surface: HTMLElement): () => void {
		const move = (e: MouseEvent) => {
			const rect = surface.getBoundingClientRect();
			this.x = e.clientX - rect.left;
			this.y = e.clientY - rect.top;
			this.active = true;
		};
		surface.addEventListener('mousemove', move);
		return () => surface.removeEventListener('mousemove', move);
	}
}

// ------------------------------------------------------------- the source

export interface BindingInputOptions {
	/** Tap the shot button to start/stop shooting, instead of holding it. */
	toggleShot?: boolean;
	/** Mouse position and how to turn screen pixels into world coordinates. */
	pointer?: { state: PointerState; toWorld: (sx: number, sy: number) => { x: number; y: number } };
}

/** Movement from held buttons. Diagonals are normalized so they aren't ~41% faster. */
export function moveFromButtons(buttons: ButtonState, b: Bindings): { moveX: number; moveY: number } {
	let x = (buttons.anyHeld(b.right) ? 1 : 0) - (buttons.anyHeld(b.left) ? 1 : 0);
	let y = (buttons.anyHeld(b.down) ? 1 : 0) - (buttons.anyHeld(b.up) ? 1 : 0);
	if (x !== 0 && y !== 0) {
		x *= Math.SQRT1_2;
		y *= Math.SQRT1_2;
	}
	return { moveX: x, moveY: y };
}

/** An InputSource that reads one player's bindings from the shared button state. */
export class BindingInput implements InputSource {
	private shotLatched = false;

	constructor(
		private buttons: ButtonState,
		public bindings: Bindings,
		public options: BindingInputOptions = {}
	) {}

	read(): Intent {
		const { buttons: btn, bindings: b, options } = this;

		// Shot: held, or tap-to-toggle for players who'd rather not hold a button.
		// A press counts too, so a quick click that's over before the next tick
		// still fires a bolt.
		const shotPressed = btn.consumePress(b.shot);
		let shot = btn.anyHeld(b.shot) || shotPressed;
		if (options.toggleShot) {
			if (shotPressed) this.shotLatched = !this.shotLatched;
			shot = this.shotLatched;
		}

		const prev = btn.consumePress(b.prevConstruct);
		const next = btn.consumePress(b.nextConstruct);
		const p = options.pointer;

		return {
			...moveFromButtons(btn, b),
			toggleFly: btn.consumePress(b.fly),
			shot,
			construct: btn.anyHeld(b.construct),
			constructPressed: btn.consumePress(b.construct),
			select: SLOT_ACTIONS.findIndex((a) => btn.consumePress(b[a])),
			cycle: (next ? 1 : 0) - (prev ? 1 : 0),
			target: btn.consumePress(b.target),
			shield: btn.consumePress(b.shield),
			signature: btn.consumePress(b.signature),
			pointer: p && p.state.active ? p.toWorld(p.state.x, p.state.y) : null
		};
	}
}
