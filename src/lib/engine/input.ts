// Input sources.
//
// A player never reads the keyboard directly. Each tick it asks its
// InputSource for an Intent: "what does my controller want right now?"
// A keyboard, a gamepad, or (in Phase 5) a network connection can all
// produce Intents, so the player code never changes when we add them.

/** What a player wants to do this tick. More actions (fire, fly...) come later. */
export interface Intent {
	/** -1 (left) .. 1 (right) */
	moveX: number;
	/** -1 (up) .. 1 (down), because canvas y grows downward */
	moveY: number;
}

export const IDLE: Intent = { moveX: 0, moveY: 0 };

export interface InputSource {
	read(): Intent;
}

/** Which physical keys mean which direction. Uses KeyboardEvent.code, so
 *  WASD stays in the same place on AZERTY and other keyboard layouts. */
export interface KeyLayout {
	up: string[];
	down: string[];
	left: string[];
	right: string[];
}

export const LAYOUTS = {
	wasd: { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'] },
	arrows: { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'] },
	/** Single player: either set of keys works. */
	both: {
		up: ['KeyW', 'ArrowUp'],
		down: ['KeyS', 'ArrowDown'],
		left: ['KeyA', 'ArrowLeft'],
		right: ['KeyD', 'ArrowRight']
	}
} satisfies Record<string, KeyLayout>;

export type LayoutName = keyof typeof LAYOUTS;

/**
 * Pure function: held keys + layout -> Intent.
 * Diagonals are normalized so moving diagonally isn't ~41% faster.
 */
export function intentFromKeys(held: ReadonlySet<string>, layout: KeyLayout): Intent {
	const any = (codes: string[]) => codes.some((c) => held.has(c));
	let x = (any(layout.right) ? 1 : 0) - (any(layout.left) ? 1 : 0);
	let y = (any(layout.down) ? 1 : 0) - (any(layout.up) ? 1 : 0);
	if (x !== 0 && y !== 0) {
		x *= Math.SQRT1_2;
		y *= Math.SQRT1_2;
	}
	return { moveX: x, moveY: y };
}

/** Tracks which keys are currently held. One per game, shared by all keyboard players. */
export class KeyboardState {
	readonly held = new Set<string>();
	/** Keys the game uses; we stop the browser scrolling the page with them. */
	private gameKeys = new Set(Object.values(LAYOUTS.both).flat());

	/** Starts listening. Returns a function that stops listening. */
	attach(target: Window): () => void {
		const down = (e: KeyboardEvent) => {
			if (this.gameKeys.has(e.code)) e.preventDefault();
			this.held.add(e.code);
		};
		const up = (e: KeyboardEvent) => this.held.delete(e.code);
		// If the window loses focus mid-press we never get keyup, and the
		// Lantern would drift forever. Clear everything instead.
		const blur = () => this.held.clear();

		target.addEventListener('keydown', down);
		target.addEventListener('keyup', up);
		target.addEventListener('blur', blur);
		return () => {
			target.removeEventListener('keydown', down);
			target.removeEventListener('keyup', up);
			target.removeEventListener('blur', blur);
			this.held.clear();
		};
	}
}

/** An InputSource that reads one key layout from a shared KeyboardState. */
export class KeyboardInput implements InputSource {
	constructor(
		private keyboard: KeyboardState,
		private layout: KeyLayout
	) {}

	read(): Intent {
		return intentFromKeys(this.keyboard.held, this.layout);
	}
}
