// Where the phone pad and the game meet.
//
// Running from the dev server, that's the relay built into it (pad-relay.ts),
// on this same address. Published, it's the little Cloudflare service in
// pad-relay-worker/, whose address is set at build time in VITE_PAD_RELAY
// (Cloudflare Pages → Settings → Variables).

const configured = (import.meta.env.VITE_PAD_RELAY ?? '').replace(/\/$/, '');

/** The published relay's address, or null when the dev server is doing the job. */
export const RELAY = configured || null;

/** The WebSocket to join a room with, as a game or as a pad. */
export function padSocketUrl(role: 'game' | 'pad', room: string): string {
	if (RELAY) return `${RELAY.replace(/^http/, 'ws')}/ws?role=${role}&room=${room}`;
	const proto = location.protocol === 'https:' ? 'wss' : 'ws';
	return `${proto}://${location.host}/pad-ws?role=${role}&room=${room}`;
}

/** Where to ask which rooms have a game open. */
export const roomsUrl = () => (RELAY ? `${RELAY}/rooms` : '/pad-rooms');
