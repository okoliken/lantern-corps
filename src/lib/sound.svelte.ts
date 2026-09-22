// The game's audio, shared by the whole app: one synthesizer, started on
// the first tap or key press (browsers won't play sound before one).

import { browser } from '$app/environment';
import { Synth } from '$lib/engine/audio/synth';

export const synth = new Synth();

if (browser) {
	const unlock = () => synth.unlock();
	// Keep listening: a phone can suspend audio again when the page is hidden
	window.addEventListener('pointerdown', unlock, { passive: true });
	window.addEventListener('keydown', unlock);
	window.addEventListener('touchend', unlock, { passive: true });
}
