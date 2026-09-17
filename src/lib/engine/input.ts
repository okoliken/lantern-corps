// Input sources.
//
// A player never reads the keyboard directly. Each tick it asks its
// InputSource for an Intent: "what does my controller want right now?"
// A keyboard, a gamepad, or (in Phase 5) a network connection can all
// produce Intents, so the player code never changes when we add them.

/** What a player wants to do this tick. More construct actions come in M4. */
export interface Intent {
	/** -1 (left) .. 1 (right) */
	moveX: number;
	/** -1 (up) .. 1 (down), because canvas y grows downward */
	moveY: number;
	/** The take-off / land key was PRESSED (not held) since the last tick. */
	toggleFly: boolean;
	/** The fire key is HELD (the beam fires for as long as it's down). */
	fire: boolean;
}

export const IDLE: Intent = { moveX: 0, moveY: 0, toggleFly: false, fire: false };

export interface InputSource {
	read(): Intent;
}

/** Which physical keys do what. Uses KeyboardEvent.code, so WASD stays in
 *  the same place on AZERTY and other keyboard layouts. */
export interface KeyLayout {
	up: string[];
	down: string[];
	left: string[];
	right: string[];
	/** Take off / land. */
	fly: string[];
	/** Hold to fire the ring. */
	fire: string[];
}

export const LAYOUTS = {
	wasd: { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], fly: ['Space'], fire: ['KeyF'] },
	arrows: {
		up: ['ArrowUp'],
		down: ['ArrowDown'],
		left: ['ArrowLeft'],
		right: ['ArrowRight'],
		fly: ['ShiftRight'],
		fire: ['Enter']
	},
	/** Single player: either set of keys works. */
	both: {
		up: ['KeyW', 'ArrowUp'],
		down: ['KeyS', 'ArrowDown'],
		left: ['KeyA', 'ArrowLeft'],
		right: ['KeyD', 'ArrowRight'],
		fly: ['Space'],
		fire: ['KeyJ', 'KeyF']
	}
} satisfies Record<string, KeyLayout>;

export type LayoutName = keyof typeof LAYOUTS;

/**
 * Pure function: held keys + layout -> movement part of an Intent.
 * Diagonals are normalized so moving diagonally isn't ~41% faster.
 * (toggleFly needs press counting, so KeyboardInput fills it in.)
 */
export function intentFromKeys(held: ReadonlySet<string>, layout: KeyLayout): Intent {
	const any = (codes: string[]) => codes.some((c) => held.has(c));
	let x = (any(layout.right) ? 1 : 0) - (any(layout.left) ? 1 : 0);
	let y = (any(layout.down) ? 1 : 0) - (any(layout.up) ? 1 : 0);
	if (x !== 0 && y !== 0) {
		x *= Math.SQRT1_2;
		y *= Math.SQRT1_2;
	}
	return { moveX: x, moveY: y, toggleFly: false, fire: any(layout.fire) };
}

/** Tracks which keys are held, and counts presses. One per game, shared by all keyboard players. */
export class KeyboardState {
	readonly held = new Set<string>();
	/**
	 * Presses not yet handled by the game. "Held" isn't enough for one-shot
	 * actions: a quick tap can start and end between two ticks and never be
	 * seen as held. Counting presses means no tap is ever lost.
	 */
	private presses = new Map<string, number>();
	/** Keys the game uses; we stop the browser scrolling the page with them. */
	private gameKeys = new Set(Object.values(LAYOUTS).flatMap((layout) => Object.values(layout).flat()));

	/** Call when a key goes down. Exposed so tests can simulate presses. */
	press(code: string) {
		if (!this.held.has(code)) this.presses.set(code, (this.presses.get(code) ?? 0) + 1);
		this.held.add(code);
	}

	release(code: string) {
		this.held.delete(code);
	}

	/** Uses up one press of any of these keys. True if there was one. */
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

	/** Starts listening. Returns a function that stops listening. */
	attach(target: Window): () => void {
		const down = (e: KeyboardEvent) => {
			if (this.gameKeys.has(e.code)) e.preventDefault();
			this.press(e.code);
		};
		const up = (e: KeyboardEvent) => this.release(e.code);
		// If the window loses focus mid-press we never get keyup, and the
		// Lantern would drift forever. Clear everything instead.
		const blur = () => this.clear();

		target.addEventListener('keydown', down);
		target.addEventListener('keyup', up);
		target.addEventListener('blur', blur);
		return () => {
			target.removeEventListener('keydown', down);
			target.removeEventListener('keyup', up);
			target.removeEventListener('blur', blur);
			this.clear();
		};
	}

	private clear() {
		this.held.clear();
		this.presses.clear();
	}
}

/** An InputSource that reads one key layout from a shared KeyboardState. */
export class KeyboardInput implements InputSource {
	constructor(
		private keyboard: KeyboardState,
		private layout: KeyLayout
	) {}

	read(): Intent {
		const intent = intentFromKeys(this.keyboard.held, this.layout);
		intent.toggleFly = this.keyboard.consumePress(this.layout.fly);
		return intent;
	}
}
