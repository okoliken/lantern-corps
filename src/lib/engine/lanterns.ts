// Character definitions. Pure data: to tune Hal or John, change numbers here.
// Construct stats (M4) will be added to these same objects.

export type LanternId = 'hal' | 'john';

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
	look: {
		skin: string;
		hair: string;
		/** Hal's hair sits up with a side sweep; John's is cropped short. */
		hairStyle: 'swept' | 'cropped';
		/** Hal wears the domino mask; John goes without one. */
		mask: boolean;
	};
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
		look: { skin: '#6e4529', hair: '#171310', hairStyle: 'cropped', mask: false }
	}
};

export function isLanternId(value: unknown): value is LanternId {
	return value === 'hal' || value === 'john';
}
