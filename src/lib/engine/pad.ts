// The phone pad, as an input: a PS-style controller on your phone (/pad),
// connected to the game through the dev server (pad-relay.ts).
//
// The phone sends what its sticks and buttons are doing; PadState keeps the
// latest, and PadInput mixes it with the keyboard, so either (or both) works
// at any moment:
//
//   left stick    move              right stick   aim, and fire ring shots
//   □ square      ring shot         ✕ cross       construct (the smart ring picks)
//   ○ circle      bubble shield     △ triangle    fly / land
//   L1 / R1       previous / next construct
//   L2            lock a target     R2            signature
//   select        call for backup   start         pause (the page handles it)

import type { InputSource, Intent } from './input';
import type { Player } from './player';

export const PAD_BUTTONS = ['square', 'cross', 'circle', 'triangle', 'l1', 'r1', 'l2', 'r2', 'select', 'start'] as const;
export type PadButton = (typeof PAD_BUTTONS)[number];

/** What each button does, for the pad's labels. */
export const PAD_LABELS: Record<PadButton, string> = {
	square: 'Shot',
	cross: 'Construct',
	circle: 'Shield',
	triangle: 'Fly',
	l1: 'Prev',
	r1: 'Next',
	l2: 'Target',
	r2: 'Signature',
	select: 'Backup',
	start: 'Pause'
};

/** A message from the phone. */
export type PadMessage =
	| { t: 'sticks'; lx: number; ly: number; rx: number; ry: number }
	| { t: 'down'; b: PadButton }
	| { t: 'up'; b: PadButton };

/** Sticks below this (0..1) count as centred. */
export const DEAD_ZONE = 0.15;
/** The right stick fires once it's pushed this far. */
export const AIM_FIRE = 0.35;
/** How far out (world px) the right stick puts the crosshair. */
const AIM_REACH = 260;

/** The pad's latest state, from its messages. */
export class PadState {
	/** Pads connected to this game (from the relay). */
	connected = 0;
	lx = 0;
	ly = 0;
	rx = 0;
	ry = 0;
	readonly held = new Set<PadButton>();
	/** Presses since the game last read them (so a quick tap between ticks isn't lost). */
	private presses = new Set<PadButton>();

	apply(msg: PadMessage | { t: 'pads'; n: number }) {
		switch (msg.t) {
			case 'pads':
				this.connected = msg.n;
				if (msg.n === 0) this.release();
				break;
			case 'sticks':
				this.lx = clampUnit(msg.lx);
				this.ly = clampUnit(msg.ly);
				this.rx = clampUnit(msg.rx);
				this.ry = clampUnit(msg.ry);
				break;
			case 'down':
				this.held.add(msg.b);
				this.presses.add(msg.b);
				break;
			case 'up':
				this.held.delete(msg.b);
				break;
		}
	}

	/** Was this pressed since the last check? (Clears it.) */
	consume(b: PadButton): boolean {
		return this.presses.delete(b);
	}

	/** The pad went away: let go of everything. */
	release() {
		this.held.clear();
		this.presses.clear();
		this.lx = this.ly = this.rx = this.ry = 0;
	}
}

const clampUnit = (v: number) => (Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);

/**
 * The keyboard (or whatever the player had) plus the phone pad. The pad's
 * stick moves you when it's pushed, otherwise the keys do; any button on
 * either does its thing.
 */
export class PadInput implements InputSource {
	constructor(
		readonly keys: InputSource,
		private pad: PadState,
		private me: () => Player | null
	) {}

	read(): Intent {
		const k = this.keys.read();
		const pad = this.pad;
		const intent: Intent = { ...k };

		const move = Math.hypot(pad.lx, pad.ly);
		if (move > DEAD_ZONE) {
			const scale = Math.min(1, move) / move;
			intent.moveX = pad.lx * scale;
			intent.moveY = pad.ly * scale;
		}

		// The right stick aims (the crosshair out in that direction) and fires
		const aim = Math.hypot(pad.rx, pad.ry);
		const p = this.me();
		const aiming = aim > AIM_FIRE && p !== null;
		if (aiming) {
			intent.pointer = { x: p.x + (pad.rx / aim) * AIM_REACH, y: p.y - p.ringLift + (pad.ry / aim) * AIM_REACH };
		}

		const pressedConstruct = pad.consume('cross');
		intent.shot = k.shot || aiming || pad.held.has('square') || pad.consume('square');
		intent.construct = k.construct || pad.held.has('cross') || pressedConstruct;
		intent.constructPressed = k.constructPressed || pressedConstruct;
		intent.shield = k.shield || pad.consume('circle');
		intent.toggleFly = k.toggleFly || pad.consume('triangle');
		intent.target = k.target || pad.consume('l2');
		intent.signature = k.signature || pad.consume('r2');
		intent.backup = k.backup || pad.consume('select');
		const prev = pad.consume('l1');
		const next = pad.consume('r1');
		if (prev || next) intent.cycle = (next ? 1 : 0) - (prev ? 1 : 0);
		return intent;
	}
}
