// Hal's and John's kits from the Constructs page: which ten constructs each
// takes into a fight. Always ten: picking a new one swaps it for one on the
// hotbar. Saved in the browser and handed to the engine (constructs/defs.ts,
// setKit), so every mission builds them with it.

import { browser } from '$app/environment';
import { ARMORY, KIT_SIZE, LOADOUTS, setKit, type ConstructId } from '$lib/engine/constructs/defs';

export type ArmoryLantern = 'hal' | 'john';
const key = (who: ArmoryLantern) => `lantern-corps:armory:${who}`;

function loadSaved(who: ArmoryLantern): ConstructId[] {
	if (!browser) return [...LOADOUTS[who]];
	try {
		const saved: unknown = JSON.parse(localStorage.getItem(key(who)) ?? 'null');
		const all = ARMORY[who]!;
		if (Array.isArray(saved) && saved.length === KIT_SIZE && new Set(saved).size === KIT_SIZE && saved.every((id) => all.includes(id))) return saved;
	} catch {
		// Unreadable: the usual kit
	}
	return [...LOADOUTS[who]];
}

class ArmoryStore {
	kits = $state<Record<ArmoryLantern, ConstructId[]>>({ hal: loadSaved('hal'), john: loadSaved('john') });

	constructor() {
		setKit('hal', this.kits.hal);
		setKit('john', this.kits.john);
	}

	/** Everything they can carry. */
	all(who: ArmoryLantern): ConstructId[] {
		return ARMORY[who]!;
	}

	/** The ones not on the hotbar. */
	spares(who: ArmoryLantern): ConstructId[] {
		return this.all(who).filter((id) => !this.kits[who].includes(id));
	}

	/** Put a construct on key `slot` (0-9). A spare replaces what was there; one already on the hotbar trades places. */
	place(who: ArmoryLantern, slot: number, id: ConstructId) {
		const kit = [...this.kits[who]];
		const from = kit.indexOf(id);
		if (from === slot) return;
		if (from !== -1) kit[from] = kit[slot];
		kit[slot] = id;
		this.kits[who] = kit;
		this.save(who);
	}

	isUsual(who: ArmoryLantern): boolean {
		return this.kits[who].every((id, i) => id === LOADOUTS[who][i]);
	}

	reset(who: ArmoryLantern) {
		this.kits[who] = [...LOADOUTS[who]];
		this.save(who);
	}

	private save(who: ArmoryLantern) {
		setKit(who, this.kits[who]);
		if (!browser) return;
		try {
			localStorage.setItem(key(who), JSON.stringify(this.kits[who]));
		} catch {
			// Storage blocked: the kit lasts until the page closes
		}
	}
}

export const armory = new ArmoryStore();
