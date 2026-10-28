// Playing as an app: put on the home screen, the game opens with no browser
// bars (and, on Android, sideways by itself). Android Chrome offers a real
// install; iPhones only allow it by hand, through the Share menu.

import { browser } from '$app/environment';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
type WithPrompt = Window & { __installPrompt?: InstallPrompt | null };

export type Platform = 'iphone' | 'android' | 'other';

class Install {
	/** Opened from the home screen already. */
	installed = $state(false);
	/** The browser has offered an install we can start with a button. */
	canPrompt = $state(false);
	platform = $state<Platform>('other');
	/** Which browser on an iPhone: the Share button sits in a different place in each. */
	iosBrowser = $state<'safari' | 'chrome' | 'other'>('safari');

	constructor() {
		if (!browser) return;
		const ua = navigator.userAgent;
		const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
		this.platform = /iPhone|iPad|iPod/.test(ua) || iPadOS ? 'iphone' : /Android/.test(ua) ? 'android' : 'other';
		this.iosBrowser = /CriOS/.test(ua) ? 'chrome' : /FxiOS|EdgiOS|OPiOS/.test(ua) ? 'other' : 'safari';
		this.installed =
			matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
		const w = window as WithPrompt;
		this.canPrompt = !!w.__installPrompt;
		addEventListener('installprompt', () => (this.canPrompt = !!w.__installPrompt));
		addEventListener('appinstalled', () => {
			this.installed = true;
			this.canPrompt = false;
			w.__installPrompt = null;
		});
	}

	/** Worth suggesting: a phone or tablet, in the browser rather than the installed app. */
	get worthIt(): boolean {
		return !this.installed && (this.platform !== 'other' || this.canPrompt);
	}

	/** Start the browser's own install. Resolves true when it was accepted. */
	async prompt(): Promise<boolean> {
		const w = window as WithPrompt;
		const offer = w.__installPrompt;
		if (!offer) return false;
		await offer.prompt();
		const { outcome } = await offer.userChoice;
		// An offer can only be used once
		w.__installPrompt = null;
		this.canPrompt = false;
		return outcome === 'accepted';
	}
}

export const install = new Install();
