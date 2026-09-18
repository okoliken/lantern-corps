// Character definitions. Pure data: to tune Hal or John, change numbers here.
// Their construct loadouts live in constructs/defs.ts (LOADOUTS).

export type LanternId = 'hal' | 'john';

/** How a Lantern looks (drawing only). */
export interface Look {
	skin: string;
	hair: string;
	/** Hal's hair sits up with a side sweep; John's is cropped short. */
	hairStyle: 'swept' | 'cropped';
	/** Hal wears the domino mask; John goes without one. */
	mask: boolean;
	/** A beaked, crested head instead of a human one (Tomar-Re). */
	avian?: { beak: string; crest: string };
	/** A big, bald, heavy-jawed head (Kilowog of Bolovax Vik). */
	bolovaxian?: boolean;
}

export interface LanternDef {
	id: LanternId;
	name: string;
	title: string;
	blurb: string;
	/** Top speed in px/s. */
	maxSpeed: number;
	/** How fast they reach top speed, in px/s². */
	accel: number;
	/** How fast they stop when no key is held, in px/s². */
	decel: number;
	/** Multipliers applied to every construct this Lantern makes. 1 = normal. */
	traits: {
		/** Damage and knockback. */
		power: number;
		/** Wall health, how long walls and traps last, how long a cage holds. */
		durability: number;
		/** Cooldown length. Lower = faster. */
		cooldown: number;
		/** Willpower cost of structures (walls, traps). */
		structureCost: number;
	};
	look: Look;
}

export const LANTERNS: Record<LanternId, LanternDef> = {
	hal: {
		id: 'hal',
		name: 'Hal Jordan',
		title: 'The Test Pilot',
		blurb: 'Fast and fearless. Constructs build quickly and hit hard, but break sooner.',
		maxSpeed: 320,
		accel: 2600,
		decel: 2000,
		// Hits harder and faster, but what he builds doesn't last
		traits: { power: 1.2, durability: 0.85, cooldown: 0.85, structureCost: 1 },
		look: { skin: '#e2b48e', hair: '#5b3a21', hairStyle: 'swept', mask: true }
	},
	john: {
		id: 'john',
		name: 'John Stewart',
		title: 'The Architect',
		blurb: 'Marine discipline. Sturdy constructs, and walls and turrets cost less.',
		maxSpeed: 280,
		accel: 2200,
		decel: 2600,
		// Solid, lasting structures that cost less to raise
		traits: { power: 1, durability: 1.4, cooldown: 1, structureCost: 0.7 },
		look: { skin: '#6e4529', hair: '#171310', hairStyle: 'cropped', mask: false }
	}
};

export function isLanternId(value: unknown): value is LanternId {
	return value === 'hal' || value === 'john';
}
