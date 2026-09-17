// Hal's and John's progress, shared across the app and saved in the browser.
// The engine's progression.ts has the rules; this keeps them reactive for
// menus and saves after every change.

import { browser } from '$app/environment';
import type { LanternId } from '$lib/engine/lanterns';
import {
	PROFILES_KEY,
	newProfiles,
	parseProfiles,
	refund,
	upgrade,
	type Profile,
	type Profiles,
	type UpgradeId
} from '$lib/engine/progression';

function load(): Profiles {
	if (!browser) return newProfiles();
	try {
		const text = localStorage.getItem(PROFILES_KEY);
		return parseProfiles(text ? JSON.parse(text) : null);
	} catch {
		return newProfiles();
	}
}

class ProfilesStore {
	current = $state<Profiles>(load());

	/** A plain copy for the engine. The game changes it as XP comes in and reports back. */
	snapshot(): Profiles {
		return $state.snapshot(this.current) as Profiles;
	}

	save() {
		if (!browser) return;
		try {
			localStorage.setItem(PROFILES_KEY, JSON.stringify(this.snapshot()));
		} catch {
			// Storage blocked or full: progress just won't persist this time
		}
	}

	/** The game reports a changed profile (XP earned, level up). */
	update(id: LanternId, profile: Profile) {
		this.current[id] = structuredClone(profile);
		this.save();
	}

	upgrade(id: LanternId, upgradeId: UpgradeId) {
		const p = this.snapshot()[id];
		if (upgrade(p, upgradeId)) this.update(id, p);
	}

	refund(id: LanternId) {
		const p = this.snapshot()[id];
		refund(p);
		this.update(id, p);
	}
}

export const profiles = new ProfilesStore();
