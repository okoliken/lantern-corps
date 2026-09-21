// The campaign's progress (which story missions are finished), shared across
// the app and saved in the browser. The rules are in engine/campaign.ts.

import { browser } from '$app/environment';
import { CAMPAIGN_KEY, complete, isOpen, newCampaign, next, parseCampaign, before, type Campaign } from '$lib/engine/campaign';
import { storyOrder } from '$lib/story/missions';

function load(): Campaign {
	if (!browser) return newCampaign();
	try {
		const text = localStorage.getItem(CAMPAIGN_KEY);
		return parseCampaign(text ? JSON.parse(text) : null);
	} catch {
		return newCampaign();
	}
}

class CampaignStore {
	current = $state<Campaign>(load());
	readonly order = storyOrder();

	private save() {
		if (!browser) return;
		try {
			localStorage.setItem(CAMPAIGN_KEY, JSON.stringify($state.snapshot(this.current)));
		} catch {
			// Storage blocked or full: progress just won't persist this time
		}
	}

	/** A story mission won. */
	complete(id: string, stars: number) {
		complete(this.current, id, stars);
		this.save();
	}

	isOpen(id: string): boolean {
		return isOpen(this.current, this.order, id);
	}

	stars(id: string): number {
		return this.current.done[id] ?? 0;
	}

	before(id: string): string | null {
		return before(this.order, id);
	}

	next(id: string): string | null {
		return next(this.order, id);
	}

	/** Every mission open (for testing a new one without playing the whole story first). */
	unlockAll() {
		for (const id of this.order.slice(0, -1)) if (!(id in this.current.done)) this.current.done[id] = 1;
		this.save();
	}
}

export const campaign = new CampaignStore();
