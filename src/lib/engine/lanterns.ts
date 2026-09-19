// Character definitions. Pure data: to tune Hal or John, change numbers here.
// Their construct loadouts live in constructs/defs.ts (LOADOUTS).

export type LanternId = 'hal' | 'john';
/** Every Lantern who can fight on your side: the two you can play, plus partners the story brings along. */
export type CrewId = LanternId | 'kilowog' | PrisonerId | HeroId;
/** Everyone who fights with a Green Lantern ring (heroes have their own powers). */
export type RingBearerId = Exclude<CrewId, HeroId>;
/** Earth's heroes who fight beside John in Act 2 (heroes.ts): their own powers, no ring. */
export type HeroId = 'flash' | 'hawkgirl';
/** Green Lanterns the Red Lanterns took prisoner (Act 1, Prison Moon): freed, they fight beside you. */
export type PrisonerId = 'arisia' | 'katma' | 'boodikka';
/** The Lanterns you can pick. */
export const PLAYABLE: readonly LanternId[] = ['hal', 'john'];

/** How a Lantern looks (drawing only). */
export interface Look {
	skin: string;
	hair: string;
	/** Hal's hair sits up with a side sweep; John's is cropped short; Sinestro's is slicked back to a widow's peak. */
	hairStyle: 'swept' | 'cropped' | 'peak';
	/** Hal wears the domino mask; John goes without one. */
	mask: boolean;
	/** A beaked, crested head instead of a human one (Tomar-Re). */
	avian?: { beak: string; crest: string };
	/** A big, bald, heavy-jawed head (Kilowog of Bolovax Vik). */
	bolovaxian?: boolean;
	/** A thin pencil mustache (Sinestro). */
	mustache?: boolean;
}

export interface LanternDef {
	id: CrewId;
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
	/** Body shape, for Lanterns who aren't built like Hal and John (see draw/lantern.ts). */
	bulk?: number;
	figureScale?: number;
	build?: { leg: number; torso: number; arm: number; neck: number };
	hunch?: number;
	/** Not a Lantern: a hero with powers of their own (heroes.ts), drawn in their costume. */
	hero?: HeroId;
}

export const LANTERNS: Record<CrewId, LanternDef> = {
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
		traits: { power: 1.1, durability: 1.4, cooldown: 1, structureCost: 0.7 },
		look: { skin: '#6e4529', hair: '#171310', hairStyle: 'cropped', mask: false }
	},
	kilowog: {
		id: 'kilowog',
		name: 'Kilowog',
		title: 'The Drill Sergeant',
		blurb: 'Huge, tough and slow. Hammers, fists and shockwaves that hit like a freighter.',
		maxSpeed: 260,
		accel: 1800,
		decel: 2400,
		// Everything he builds hits harder and lasts longer; he's just slower about it
		traits: { power: 1.35, durability: 1.3, cooldown: 1.1, structureCost: 1 },
		look: { skin: '#b89a9c', hair: '#b89a9c', hairStyle: 'cropped', mask: false, bolovaxian: true },
		bulk: 1.85,
		figureScale: 1.2,
		build: { leg: 0.88, torso: 1.22, arm: 1.12, neck: 0.3 },
		hunch: 0.05
	},

	// ---- Held on the Prison Moon ----
	arisia: {
		id: 'arisia',
		name: 'Arisia',
		title: 'Lantern of Graxos IV',
		blurb: 'Young, quick and fearless: blades and bright, fast constructs.',
		maxSpeed: 310,
		accel: 2500,
		decel: 2200,
		traits: { power: 1.05, durability: 0.9, cooldown: 0.9, structureCost: 1 },
		look: { skin: '#f1d9c4', hair: '#f0cf6a', hairStyle: 'swept', mask: false }
	},
	katma: {
		id: 'katma',
		name: 'Katma Tui',
		title: 'Lantern of Korugar',
		blurb: 'A veteran of Korugar: precise, disciplined, and hard to break.',
		maxSpeed: 290,
		accel: 2300,
		decel: 2400,
		traits: { power: 1.1, durability: 1.15, cooldown: 1, structureCost: 0.85 },
		look: { skin: '#c86a9c', hair: '#141016', hairStyle: 'peak', mask: false }
	},
	boodikka: {
		id: 'boodikka',
		name: 'Boodikka',
		title: 'Lantern of Bellatrix',
		blurb: 'A soldier first: hammers, fists and cannons, straight at the enemy.',
		maxSpeed: 290,
		accel: 2200,
		decel: 2400,
		traits: { power: 1.15, durability: 1.1, cooldown: 1.05, structureCost: 1 },
		look: { skin: '#d9a57e', hair: '#b8331f', hairStyle: 'cropped', mask: false }
	},

	// ---- Earth's heroes (Act 2) ----
	flash: {
		id: 'flash',
		name: 'The Flash',
		title: 'The Fastest Man Alive',
		blurb: 'Too fast to see: a blur of punches, lightning thrown from the Speed Force, and tornadoes run into being.',
		maxSpeed: 520,
		accel: 5200,
		decel: 5200,
		traits: { power: 1, durability: 1, cooldown: 1, structureCost: 1 },
		look: { skin: '#e8b996', hair: '#b8331f', hairStyle: 'cropped', mask: false },
		hero: 'flash'
	},
	hawkgirl: {
		id: 'hawkgirl',
		name: 'Hawkgirl',
		title: 'Warrior of Thanagar',
		blurb: 'Wings, a war cry and an Nth metal mace: she dives out of the sky and hits like a thunderclap.',
		maxSpeed: 330,
		accel: 2600,
		decel: 2200,
		traits: { power: 1, durability: 1, cooldown: 1, structureCost: 1 },
		look: { skin: '#e9c3a0', hair: '#b53a2a', hairStyle: 'swept', mask: false },
		hero: 'hawkgirl'
	}
};

export function isLanternId(value: unknown): value is LanternId {
	return value === 'hal' || value === 'john';
}
