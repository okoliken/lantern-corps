// Settings shared across the app, saved in the browser.
// The engine's settings.ts defines the data; this wraps it in Svelte state
// so menus update live, and saves on every change.

import { browser } from '$app/environment';
import { defaultSettings, loadSettings, rebind, saveSettings, type Settings } from '$lib/engine/settings';
import type { Action, LayoutName } from '$lib/engine/input';

class SettingsStore {
	current = $state<Settings>(browser ? loadSettings(localStorage) : defaultSettings());

	/** A plain (non-reactive) copy to hand to the game engine. */
	snapshot(): Settings {
		return $state.snapshot(this.current) as Settings;
	}

	save() {
		if (browser) saveSettings(localStorage, this.snapshot());
	}

	set<K extends keyof Settings>(key: K, value: Settings[K]) {
		this.current[key] = value;
		this.save();
	}

	rebind(layout: LayoutName, action: Action, code: string) {
		this.current.bindings[layout] = rebind(this.snapshot().bindings[layout], action, code);
		this.save();
	}

	resetControls(layout: LayoutName) {
		this.current.bindings[layout] = defaultSettings().bindings[layout];
		this.save();
	}
}

export const settings = new SettingsStore();
