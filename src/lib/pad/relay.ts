// Where the phone pad and the game meet.
//
// Published, the game is served by the Worker in worker/, which is also the
// relay: /ws and /rooms on the same address. Running from the dev server,
// it's the relay built into it (pad-relay.ts): /pad-ws and /pad-rooms.
// VITE_PAD_RELAY overrides both, for a relay hosted somewhere else.

const configured = (import.meta.env.VITE_PAD_RELAY ?? '').replace(/\/$/, '');
const sameOrigin = import.meta.env.PROD;

/** A relay of its own, set at build time; otherwise the game's own address serves it. */
const RELAY = configured || null;

/** The WebSocket to join a room with, as a game or as a pad. */
export function padSocketUrl(role: 'game' | 'pad', room: string): string {
	const where = `role=${role}&room=${room}`;
	if (RELAY) return `${RELAY.replace(/^http/, 'ws')}/ws?${where}`;
	const proto = location.protocol === 'https:' ? 'wss' : 'ws';
	return `${proto}://${location.host}${sameOrigin ? '/ws' : '/pad-ws'}?${where}`;
}

/** Where to ask which rooms have a game open. */
export const roomsUrl = () => (RELAY ? `${RELAY}/rooms` : sameOrigin ? '/rooms' : '/pad-rooms');

/** The published game serves the pad and the relay itself: the pairing QR points at this very site. */
export const relayIsHere = sameOrigin || RELAY !== null;
