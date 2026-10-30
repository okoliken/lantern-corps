// John's kit from the Armory: which ten constructs he takes into a fight.
// Saved in the browser and handed to the engine (constructs/defs.ts, setKit),
// so every mission builds him with it. Until ten are picked he takes his usual kit.

import { browser } from '$app/environment';
import { ARMORY, KIT_SIZE, LOADOUTS, setKit, type ConstructId } from '$lib/engine/constructs/defs';

const KEY = 'lantern-corps:armory:john';
const ALL = ARMORY.john!;

function loadSaved(): ConstructId[] {
	if (!browser) return [...LOADOUTS.john];
	try {
		const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
		if (Array.isArray(saved) && saved.length <= KIT_SIZE && new Set(saved).size === saved.length && saved.every((id) => ALL.includes(id))) return saved;
	} catch {
		// Unreadable: his usual kit
	}
	return [...LOADOUTS.john];
}

class ArmoryStore {
	john = $state<ConstructId[]>(loadSaved());
	/** Everything he can carry. */
	readonly all = ALL;

	constructor() {
		this.apply();
	}

	carrying(id: ConstructId): boolean {
		return this.john.includes(id);
	}

	get ready(): boolean {
		return this.john.length === KIT_SIZE;
	}

	/** Take one along (if there's room), or leave it behind. */
	toggle(id: ConstructId) {
		if (this.carrying(id)) this.john = this.john.filter((c) => c !== id);
		else if (!this.ready) this.john = [...this.john, id];
		this.save();
	}

	/** His usual ten. */
	reset() {
		this.john = [...LOADOUTS.john];
		this.save();
	}

	private apply() {
		setKit('john', this.ready ? this.john : null);
	}

	private save() {
		this.apply();
		if (!browser) return;
		try {
			localStorage.setItem(KEY, JSON.stringify(this.john));
		} catch {
			// Storage blocked: the kit lasts until the page closes
		}
	}
}

export const armory = new ArmoryStore();
