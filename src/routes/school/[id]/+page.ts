// The game needs canvas and window, so this page never renders on the server.
import { error } from '@sveltejs/kit';
import { lessonById } from '$lib/engine/missions/school';
import { isLanternId } from '$lib/engine/lanterns';

export const ssr = false;

export function load({ params, url }: { params: { id: string }; url: URL }) {
	const lesson = lessonById(params.id);
	if (!lesson) throw error(404, 'No such lesson');
	const as = url.searchParams.get('as');
	return { lesson, lantern: isLanternId(as) ? as : ('hal' as const) };
}
