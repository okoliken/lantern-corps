/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
// Makes the game installable as an app, and quick to open: the built files are
// kept on the phone, one copy per release, and the pages always try the
// network first so a new release shows up straight away.
import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `lantern-corps-${version}`;
const ASSETS = [...build, ...files];

sw.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => sw.skipWaiting()));
});

sw.addEventListener('activate', (event) => {
	// Old releases go
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	// Only this site's own files; the phone pad's relay is live traffic, never cached
	if (event.request.method !== 'GET' || url.origin !== sw.location.origin) return;
	if (url.pathname.startsWith('/rooms') || url.pathname.startsWith('/ws') || url.pathname.startsWith('/pad-')) return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);
			// Built files never change under the same name: straight from the cache
			if (ASSETS.includes(url.pathname)) {
				const hit = await cache.match(url.pathname);
				if (hit) return hit;
			}
			// Pages and anything else: the network, falling back to what was kept
			try {
				const response = await fetch(event.request);
				if (response.ok && response.type === 'basic') cache.put(event.request, response.clone());
				return response;
			} catch (err) {
				const hit = (await cache.match(event.request)) ?? (await cache.match('/'));
				if (hit) return hit;
				throw err;
			}
		})()
	);
});
