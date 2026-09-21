// The campaign: which story missions are finished, and which are open.
//
// The story is played in order. The first mission is always open; every
// mission after it opens when the one before it is finished. Training and
// sparring are always open (they aren't part of the story). A finished
// mission keeps its best star count.

/** Finished missions, by id, with the most stars earned. */
export interface Campaign {
	done: Record<string, number>;
}

export const CAMPAIGN_KEY = 'lantern-corps:campaign';

export function newCampaign(): Campaign {
	return { done: {} };
}

/** Whatever was saved (maybe old, maybe broken) as a valid campaign. */
export function parseCampaign(raw: unknown): Campaign {
	const campaign = newCampaign();
	const done = (raw as { done?: unknown } | null)?.done;
	if (!done || typeof done !== 'object') return campaign;
	for (const [id, stars] of Object.entries(done as Record<string, unknown>)) {
		if (typeof stars === 'number' && Number.isFinite(stars)) campaign.done[id] = Math.max(0, Math.min(3, Math.round(stars)));
	}
	return campaign;
}

/** A mission won: it's finished, keeping the best stars. */
export function complete(c: Campaign, id: string, stars: number) {
	c.done[id] = Math.max(c.done[id] ?? 0, Math.max(1, Math.min(3, stars)));
}

/** The mission before this one in the story (null for the first, or one not in it). */
export function before(order: readonly string[], id: string): string | null {
	const i = order.indexOf(id);
	return i > 0 ? order[i - 1] : null;
}

/** Can this mission be played? The first always; the rest once the one before is finished. */
export function isOpen(c: Campaign, order: readonly string[], id: string): boolean {
	const i = order.indexOf(id);
	if (i < 0) return true;
	return i === 0 || order[i - 1] in c.done;
}

/** The mission after this one, if there is one built. */
export function next(order: readonly string[], id: string): string | null {
	const i = order.indexOf(id);
	return i >= 0 && i < order.length - 1 ? order[i + 1] : null;
}
