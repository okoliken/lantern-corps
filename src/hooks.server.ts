// Runs on the server for every request, before any route.
//
// The /lab test pages are dev-only. In a production build (dev = false) we
// answer 404 right here. A guard inside the lab route wouldn't be enough:
// lab pages have ssr = false, so the server sends the page shell without
// running any of the route's load functions.
import { dev } from '$app/environment';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	if (!dev && (path === '/lab' || path.startsWith('/lab/'))) {
		return new Response('Not found', { status: 404 });
	}
	return resolve(event);
};
