// The phone pad's relay, for the published game (the dev server has its own:
// see pad-relay.ts). Phones and game tabs open a WebSocket here and give a
// room code; whatever a pad sends goes to the games in its room, and each
// side is told how many of the other are connected.
//
// One Durable Object holds every room, so both ends always meet in the same
// place. Sockets hibernate between messages, so an idle relay costs nothing.

export interface Env {
	RELAY: DurableObjectNamespace;
}

interface Tag {
	role: 'game' | 'pad';
	room: string;
}

const CORS = { 'Access-Control-Allow-Origin': '*' };

export class Relay {
	constructor(private state: DurableObjectState) {}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		// Which rooms have a game open: a pad opened without a code joins the only one
		if (url.pathname === '/rooms') {
			const open = new Set<string>();
			for (const ws of this.state.getWebSockets()) {
				const tag = ws.deserializeAttachment() as Tag | null;
				if (tag?.role === 'game') open.add(tag.room);
			}
			return Response.json([...open], { headers: CORS });
		}

		const room = (url.searchParams.get('room') ?? '').toUpperCase().slice(0, 8);
		const role = url.searchParams.get('role');
		if (request.headers.get('Upgrade') !== 'websocket' || !room || (role !== 'game' && role !== 'pad')) {
			return new Response('Expected a pad or game WebSocket', { status: 400, headers: CORS });
		}

		const { 0: client, 1: server } = new WebSocketPair();
		this.state.acceptWebSocket(server);
		server.serializeAttachment({ role, room } satisfies Tag);
		// Tell both sides who's there now
		server.send(JSON.stringify(role === 'pad' ? { t: 'games', n: this.count('game', room) } : { t: 'pads', n: this.count('pad', room) }));
		this.tell(room);
		return new Response(null, { status: 101, webSocket: client });
	}

	/** A pad's messages go to the games in its room, and the other way round. */
	webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
		const tag = ws.deserializeAttachment() as Tag | null;
		if (!tag || typeof message !== 'string') return;
		for (const other of this.peers(tag.role === 'pad' ? 'game' : 'pad', tag.room)) other.send(message);
	}

	webSocketClose(ws: WebSocket) {
		const tag = ws.deserializeAttachment() as Tag | null;
		if (tag) this.tell(tag.room, ws);
	}

	webSocketError(ws: WebSocket) {
		this.webSocketClose(ws);
	}

	/** Everyone of this role in the room (except `skip`, which may be closing). */
	private peers(role: Tag['role'], room: string, skip?: WebSocket): WebSocket[] {
		return this.state.getWebSockets().filter((ws) => {
			if (ws === skip) return false;
			const tag = ws.deserializeAttachment() as Tag | null;
			return tag?.role === role && tag.room === room;
		});
	}

	private count(role: Tag['role'], room: string, skip?: WebSocket): number {
		return this.peers(role, room, skip).length;
	}

	/** Let each side know how many of the other are in the room. */
	private tell(room: string, closing?: WebSocket) {
		const pads = this.count('pad', room, closing);
		const games = this.count('game', room, closing);
		for (const ws of this.peers('game', room, closing)) ws.send(JSON.stringify({ t: 'pads', n: pads }));
		for (const ws of this.peers('pad', room, closing)) ws.send(JSON.stringify({ t: 'games', n: games }));
	}
}

export default {
	fetch(request: Request, env: Env): Promise<Response> | Response {
		const url = new URL(request.url);
		if (url.pathname === '/') return new Response('Lantern Corps pad relay', { headers: CORS });
		// One relay for everyone: both ends of a room always land on the same object
		return env.RELAY.get(env.RELAY.idFromName('relay')).fetch(request);
	}
};
