// What each of Hal's and John's constructs does, in a line, for the
// Constructs page. Numbers live in defs.ts; this is the words.

import type { Behavior, ConstructId } from './defs';

export const ABOUT: Partial<Record<ConstructId, string>> = {
	// ---- Hal: the test pilot ----
	glove: 'A giant boxing glove. Close range, huge knockback.',
	sidewinder: 'A heat-seeking missile that curls round to find its target.',
	strafingRun: 'Dive forward as a fighter jet, guns blazing at everything under you.',
	wingman: 'A small jet that flies on your wing for a while and fires at whatever you are fighting.',
	flakBurst: 'An anti-air shell that bursts wide: good when they are spread out.',
	vulcanCannon: "A fighter jet's rotary cannon. Hold to fire a storm of rounds.",
	missileBarrage: 'Six heat-seeking missiles at once, each one finding its own target.',
	bombingRun: 'A jet streaks along your aim and lays a line of bombs down it.',
	clusterBombs: 'Drop three bombs behind you for whatever is giving chase.',
	energySword: 'A quick, light blade. Fast swings, close in.',
	chaff: 'Flares that pull enemy shots away from you for a few seconds.',
	targetingLock: 'Paint a target: everything you fire hits harder while the lock holds.',
	// ---- John: the Marine and architect ----
	precisionRifle: 'Hold to charge, let go to fire: a round that goes through a whole line of them.',
	rifle: 'A working assault rifle, down to the bolt. Hold to fire.',
	fireteam: 'Three construct Marines who follow you and shoot what you shoot.',
	heavyCannon: 'One slow, heavy shell with a big blast. Knocks them flat.',
	powerArmor: 'A suit of armour for a while: you take far less damage and gain an arm cannon.',
	ironFist: 'A plated, braced fist. Hits like a truck and breaks shields.',
	wreckingBall: 'A wrecking ball on a chain, swung through whatever is in front of you.',
	missilePods: 'A volley of homing missiles from shoulder pods.',
	ibeams: 'A fan of steel girders that punch through everything in their path.',
	cutter: 'A spinning industrial blade held out front. Hold it on them; it eats shields.',
	// ---- John's Armory ----
	tank: 'A battle tank rolls out along your aim, crushing everything in its path, then fires its main gun.',
	mortar: 'Mark a spot and four shells come whistling down on it, one after another.',
	gunship: 'An attack helicopter hovers on your wing, its chin gun on whatever you are fighting.',
	claymores: 'Lay three directional mines in a line ahead. Whatever walks in gets the blast.',
	sentry: 'A machine gun behind sandbags. Tougher than a turret, fires faster, holds a lane.'
};

/** How you use it, in a word or two, from what it does. */
export function howToUse(behavior: Behavior): string {
	switch (behavior) {
		case 'beam':
		case 'rapid':
		case 'grind':
			return 'Hold';
		case 'snipe':
			return 'Charge';
		case 'turret':
		case 'squad':
		case 'wingman':
			return 'Calls in';
		case 'mine':
		case 'trap':
		case 'barrier':
		case 'heal':
			return 'Places';
		case 'armor':
		case 'chaff':
		case 'lock':
			return 'Power-up';
		default:
			return 'Tap';
	}
}
