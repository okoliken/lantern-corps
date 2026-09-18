// The game uses canvas and window, which don't exist on the server.
import { isLanternId } from '$lib/engine/lanterns';

export const ssr = false;

export function load({ url }: { url: URL }) {
	const as = url.searchParams.get('as');
	return { lantern: isLanternId(as) ? as : 'hal' };
}
