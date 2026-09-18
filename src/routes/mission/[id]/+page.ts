import { error } from '@sveltejs/kit';
import { missionById } from '$lib/story/missions';

// The game uses canvas and window, which don't exist on the server.
export const ssr = false;

export function load({ params }) {
	const mission = missionById(params.id);
	if (!mission) error(404, 'No such mission');
	return { mission };
}
