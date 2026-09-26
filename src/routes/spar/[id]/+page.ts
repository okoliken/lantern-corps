// The game uses canvas and window, which don't exist on the server.
import { error } from '@sveltejs/kit';
import { isLanternId } from '$lib/engine/lanterns';
import { isReady, opponentById } from '$lib/engine/missions/sparring';

export const ssr = false;

export function load({ params, url }: { params: { id: string }; url: URL }) {
	const opponent = opponentById(params.id);
	if (!opponent || !isReady(opponent)) throw error(404, 'No such sparring partner');
	const as = url.searchParams.get('as');
	return { opponent, lantern: isLanternId(as) ? as : ('hal' as const) };
}
