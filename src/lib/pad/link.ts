// The game tab's end of the phone pad: one connection to the dev server's
// relay (pad-relay.ts), shared by every game on the page. It keeps the pad's
// latest state for PadInput, and turns Start into Esc (pause, skip a scene),
// so the pages don't need to know about the pad at all.

import { PadState, type PadMessage } from '$lib/engine/pad';

/** Letters that can't be mistaken for each other (no 0/O, 1/I). */
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_KEY = 'lantern-corps:pad-room';

/** This tab's pairing code: the same across reloads, so the phone stays paired. */
export function roomCode(): string {
	try {
		const saved = sessionStorage.getItem(ROOM_KEY);
		if (saved) return saved;
	} catch {
		// Storage blocked: a fresh code each load is fine
	}
	let code = '';
	for (let i = 0; i < 4; i++) code += LETTERS[Math.floor(Math.random() * LETTERS.length)];
	try {
		sessionStorage.setItem(ROOM_KEY, code);
	} catch {
		// see above
	}
	return code;
}

class PadLink {
	readonly state = new PadState();
	readonly room = roomCode();
	private socket: WebSocket | null = null;
	private retry = 1000;
	/** Called whenever the number of connected pads changes. */
	onChange: (() => void) | null = null;

	constructor() {
		this.connect();
	}

	private connect() {
		const proto = location.protocol === 'https:' ? 'wss' : 'ws';
		let ws: WebSocket;
		try {
			ws = new WebSocket(`${proto}://${location.host}/pad-ws?role=game&room=${this.room}`);
		} catch {
			return;
		}
		this.socket = ws;
		ws.onopen = () => (this.retry = 1000);
		ws.onmessage = (event) => {
			let msg: PadMessage | { t: 'pads'; n: number };
			try {
				msg = JSON.parse(String(event.data));
			} catch {
				return;
			}
			this.state.apply(msg);
			if (msg.t === 'pads') this.onChange?.();
			// Start is Esc: pause, unpause, skip a scene
			if (msg.t === 'down' && msg.b === 'start') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }));
		};
		ws.onclose = () => {
			this.socket = null;
			this.state.connected = 0;
			this.state.release();
			this.onChange?.();
			// The dev server restarted, or there's no relay (a production build): try again later
			setTimeout(() => this.connect(), this.retry);
			this.retry = Math.min(15000, this.retry * 2);
		};
	}
}

let link: PadLink | null = null;

/** The page's pad connection (made the first time it's asked for, in the browser only). */
export function padLink(): PadLink {
	return (link ??= new PadLink());
}
