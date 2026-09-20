// What Cloudflare runs: the game itself (the built static site) and the
// phone pad's relay, in one Worker on one address.
//
//   /ws?role=game|pad&room=CODE   the pad and the game meet here (relay.ts)
//   /rooms                        which rooms have a game open
//   everything else               the game's files (index.html for any route)

import { Relay } from './relay';

export interface Env {
	RELAY: DurableObjectNamespace;
	ASSETS: Fetcher;
}

export { Relay };

export default {
	fetch(request: Request, env: Env): Promise<Response> | Response {
		const { pathname } = new URL(request.url);
		if (pathname === '/ws' || pathname === '/rooms') {
			// One relay for everyone: both ends of a room land on the same object
			return env.RELAY.get(env.RELAY.idFromName('relay')).fetch(request);
		}
		return env.ASSETS.fetch(request);
	}
};
