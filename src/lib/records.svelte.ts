// Best scores on the training grounds, kept in this browser. Nothing here is
// part of the story: it is only how well you have done at each drill.

import { browser } from '$app/environment';

export const RECORDS_KEY = 'lantern-corps:records';

export type Records = Record<string, number>;

function load(): Records {
	if (!browser) return {};
	try {
		const raw = JSON.parse(localStorage.getItem(RECORDS_KEY) ?? '{}');
		if (!raw || typeof raw !== 'object') return {};
		const out: Records = {};
		for (const [id, score] of Object.entries(raw as Record<string, unknown>)) {
			if (typeof score === 'number' && Number.isFinite(score)) out[id] = Math.max(0, Math.round(score));
		}
		return out;
	} catch {
		return {};
	}
}

class RecordStore {
	current = $state<Records>(load());

	best(id: string): number {
		return this.current[id] ?? 0;
	}

	/**
	 * Keep it if it beats what was there. Returns true if it did. A drill score
	 * is better when it is higher; a sparring time is better when it is lower.
	 */
	submit(id: string, score: number, opts?: { lower?: boolean }): boolean {
		const current = this.best(id);
		const beat = opts?.lower ? current === 0 || score < current : score > current;
		if (beat) {
			this.current = { ...this.current, [id]: Math.round(score) };
			this.save();
		}
		return beat;
	}

	private save() {
		if (!browser) return;
		try {
			localStorage.setItem(RECORDS_KEY, JSON.stringify($state.snapshot(this.current)));
		} catch {
			// Storage blocked: the score just will not last the session
		}
	}
}

export const records = new RecordStore();
