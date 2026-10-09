import { redirect } from '@sveltejs/kit';

// Removed from the game (2026-10-09): straight to the missions.
export function load() {
	redirect(307, '/missions');
}
