// The phone pad's relay, part of the dev server (see vite.config.ts).
//
// A phone opens /pad and connects here as a PAD; a game tab connects as a
// GAME. Both give the same room code, and whatever a pad sends (stick
// positions, buttons) is passed straight on to the games in its room. Games
// hear when a pad joins or leaves.
//
// /pad-info tells the game page this computer's address on the local network,
// so the pairing QR code points the phone at the laptop (not at "localhost").

import { networkInterfaces } from 'node:os';
import type { Plugin } from 'vite';
import { WebSocketServer, type WebSocket } from 'ws';

interface Room {
	games: Set<WebSocket>;
	pads: Set<WebSocket>;
}

/** This machine's IPv4 addresses on the local network (Wi-Fi first). */
function lanAddresses(): string[] {
	const found: string[] = [];
	for (const [name, list] of Object.entries(networkInterfaces())) {
		for (const a of list ?? []) {
			if (a.family === 'IPv4' && !a.internal) found.push(name.startsWith('en0') ? `!${a.address}` : a.address);
		}
	}
	return found.sort().map((a) => a.replace('!', ''));
}

export function padRelay(): Plugin {
	return {
		name: 'lantern-corps-pad-relay',
		configureServer(server) {
			const rooms = new Map<string, Room>();
			const roomOf = (code: string) => {
				let room = rooms.get(code);
				if (!room) rooms.set(code, (room = { games: new Set(), pads: new Set() }));
				return room;
			};
			const tellGames = (room: Room) => {
				const msg = JSON.stringify({ t: 'pads', n: room.pads.size });
				for (const g of room.games) g.send(msg);
			};

			const wss = new WebSocketServer({ noServer: true });
			server.httpServer?.on('upgrade', (req, socket, head) => {
				const url = new URL(req.url ?? '', 'http://x');
				if (url.pathname !== '/pad-ws') return; // Vite's own hot reload socket, and anything else
				const code = (url.searchParams.get('room') ?? '').toUpperCase().slice(0, 8);
				const role = url.searchParams.get('role');
				if (!code || (role !== 'game' && role !== 'pad')) {
					socket.destroy();
					return;
				}
				wss.handleUpgrade(req, socket, head, (ws) => {
					const room = roomOf(code);
					const mine = role === 'game' ? room.games : room.pads;
					mine.add(ws);
					if (role === 'pad') tellGames(room);
					else ws.send(JSON.stringify({ t: 'pads', n: room.pads.size }));
					ws.on('message', (data) => {
						// Pads talk to games; games can answer pads (a buzz, who they're playing)
						const to = role === 'pad' ? room.games : room.pads;
						const text = data.toString();
						for (const other of to) other.send(text);
					});
					ws.on('close', () => {
						mine.delete(ws);
						if (role === 'pad') tellGames(room);
						if (room.games.size === 0 && room.pads.size === 0) rooms.delete(code);
					});
				});
			});

			// Rooms with a game open in them: a pad opened without a code joins the only one
			server.middlewares.use('/pad-rooms', (_req, res) => {
				res.setHeader('Content-Type', 'application/json');
				res.end(JSON.stringify([...rooms].filter(([, r]) => r.games.size > 0).map(([code]) => code)));
			});

			server.middlewares.use('/pad-info', (_req, res) => {
				const address = server.httpServer?.address();
				const port = typeof address === 'object' && address ? address.port : 5173;
				res.setHeader('Content-Type', 'application/json');
				// Without --host the dev server only listens on this computer: a phone can't reach it
				const exposed = Boolean(server.config.server.host);
				// Through a tunnel (when the phone can't reach the laptop on the local network): its public address
				const publicUrl = process.env.PAD_PUBLIC_URL || null;
				res.end(JSON.stringify({ addresses: lanAddresses(), port, exposed, publicUrl }));
			});
		}
	};
}
