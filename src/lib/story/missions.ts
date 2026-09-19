// Missions: the story, as data. The story is told in ACTS; each act lists its
// missions in order, built ones by id and planned ones as a title and a
// teaser (shown locked in the mission list). Each mission names who you play,
// where, and the briefing shown before it starts. The rules live in its
// director (src/lib/engine/missions/).

import type { EnvironmentKind } from '$lib/engine/environment';
import type { CrewId, LanternId } from '$lib/engine/lanterns';

export interface MissionInfo {
	id: string;
	title: string;
	/** One line for the mission list. */
	tagline: string;
	/** Who you play (for now missions are single-Lantern). */
	lantern: LanternId;
	environment: EnvironmentKind;
	/** Where it happens, shown over the briefing. */
	place: string;
	/** The briefing, a paragraph per entry. */
	briefing: string[];
	/** What you have to do, short and clear. */
	objectives: string[];
	/** Who fights beside you (an AI partner). */
	partner?: CrewId;
}

export const MISSIONS: MissionInfo[] = [
	{
		id: 'safe-passage',
		title: 'Safe Passage',
		tagline: 'Clear a path for a wounded Lantern through an asteroid storm.',
		lantern: 'hal',
		environment: 'space',
		place: 'Sector 2814 · The Durvan Belt',
		briefing: [
			'A distress call on the Corps frequency: Tomar-Re of Sector 2813. His cruiser was holed crossing the Durvan Belt, and his ring is nearly spent holding the hull together. He can fly, or he can shield. Not both.',
			'"Hal, the storm is closing in behind me. I need a path. Just keep the rocks off my ship."',
			'A hundred asteroids stand between him and open space.'
		],
		objectives: [
			'Blast the asteroids before they hit Tomar-Re\'s ship',
			'Get the ship across the belt with its hull intact',
			'Stay close: his Lantern battery rides on the hull'
		]
	}
];

MISSIONS.push({
	id: 'silent-outpost',
	title: 'Silent Outpost',
	tagline: 'Kel-Aris Station went dark. Find out why, with Kilowog at your side.',
	lantern: 'hal',
	environment: 'planet',
	place: 'Sector 2814 · Kel-Aris Station',
	briefing: [
		"Tomar-Re was right. Kel-Aris Station, on the frontier of your sector, hasn't answered in two days. Its Lantern, Tolen Vex, who guards Sector 2814's far edge while you watch over Earth, went silent with it.",
		'The Guardians want to know what happened. Kilowog wants to come along. "Somebody\'s gotta keep you alive, poozer."',
		'Whatever hit Kel-Aris might still be there.'
	],
	objectives: ['Search the station', 'Find the station crew and get them to safety', 'Find out what happened to Tolen Vex'],
	partner: 'kilowog'
});

MISSIONS.push({
	id: 'colony-under-fire',
	title: 'First Patrol',
	tagline: "John Stewart's first call as a Lantern: get Mirrow's colonists out through Zilius Zox's fire.",
	lantern: 'john',
	environment: 'planet',
	place: 'Sector 2814 · Mirrow Colony',
	briefing: [
		"Two weeks ago John Stewart was an architect on a building site in Detroit. Since then he's fought beside the Justice League, been carried across the galaxy to Oa, and survived Kilowog's training. Now his first real call has come in: Mirrow, a farming colony on the frontier, is burning.",
		"Hal is on the other side of the sector, but he can be there if John calls. The colonists are hiding in their shelters. The shuttles are waiting. Something up there is laughing.",
		'Get them out.'
	],
	objectives: [
		'Reach each shelter; the colonists will follow you',
		'Get them to the shuttles. Shield them (Shift) when fire comes down',
		'Keep the last shuttle safe until it launches',
		'Need help? Press B to call Hal (twice)'
	]
});

MISSIONS.push({
	id: 'the-interceptor',
	title: 'The Interceptor',
	tagline: 'Steal the Corps\' prototype ship with Kilowog, and get it past the frontier in one piece.',
	lantern: 'hal',
	environment: 'space',
	place: 'Sector 2814 · The Frontier',
	briefing: [
		'The Guardians have heard enough: no Lantern goes past the frontier. Sinestro agrees with them. Tolen Vex is dead, Mirrow is burning, and the Red Lanterns are still out there.',
		'In a hangar on Oa sits the Interceptor, the Corps\' prototype ship, fast enough to reach Sector 666 and never flown. Kilowog was supposed to be guarding it. "I didn\'t see nothin\', poozer. I\'m comin\' with you."',
		'The ship flies itself. Your job is to keep it in one piece.'
	],
	objectives: [
		'Shoot down rage torpedoes before they hit the ship, or shield it (Shift)',
		'Take out the fighters firing them; Kilowog will help',
		'If the ship loses power, hold on until it reboots',
		'Stay close: the Lantern battery rides on the ship'
	],
	partner: 'kilowog'
});

MISSIONS.push({
	id: 'prison-moon',
	title: 'Prison Moon',
	tagline: 'Break captured Green Lanterns out of a Red Lantern prison. Every Lantern you free fights beside you.',
	lantern: 'hal',
	environment: 'planet',
	place: 'Beyond the frontier · The Prison Moon',
	briefing: [
		'The Interceptor drops out of its jump over a moon the color of dried blood. Aya picks up Green Lantern ring signatures on the surface: weak, but alive.',
		'"Lanterns in cages," Kilowog growls. "The Reds have been taking prisoners."',
		'Three cells, three Lanterns, and a whole garrison of Red Lanterns between you and them.'
	],
	objectives: [
		'Break open the cells (any construct or ring shot works on them)',
		'Every Lantern you free fights beside you',
		'Hold off the warden and the garrison',
		'The Lantern battery by the Interceptor recharges your willpower'
	],
	partner: 'kilowog'
});

export function missionById(id: string): MissionInfo | undefined {
	return MISSIONS.find((m) => m.id === id);
}

/** A mission that's part of the story but not built yet: shown locked, with a teaser. */
export interface PlannedMission {
	title: string;
	tagline: string;
}

export interface ActInfo {
	number: number;
	title: string;
	/** What the act is about, in a line. */
	tagline: string;
	/** Its missions in order: a built mission's id, or one still to come. */
	lineup: (string | PlannedMission)[];
}

export const ACTS: ActInfo[] = [
	{
		number: 1,
		title: 'Rage at the Border',
		tagline: "The frontier is burning. Find out who's hunting Green Lanterns, and why.",
		lineup: [
			'safe-passage',
			'silent-outpost',
			'the-interceptor',
			'prison-moon',
			{ title: 'Razer', tagline: "Atrocitus's lieutenant. His Red Lanterns fight you first. Then he does." }
		]
	},
	{
		number: 2,
		title: 'The Old Machines',
		tagline: 'A new Lantern on Earth, and something ancient waking up.',
		lineup: [
			{ title: 'Call to Arms', tagline: 'The Flash and Hawkgirl are losing to Gorilla Grodd. A ring finds its new bearer in the middle of the fight.' },
			{ title: 'Summoned', tagline: 'The ring carries John Stewart across the galaxy to Oa, and to the Corps.' },
			'colony-under-fire',
			{ title: "The Guardians' Shame", tagline: 'The Guardians built the Manhunters. Now Atrocitus wants them.' },
			{ title: 'Sleepers', tagline: 'Manhunters wake up all over Earth. John stands with the Justice League.' },
			{ title: 'Manhunter Prime', tagline: 'Hal and John, together, at the heart of the vault.' }
		]
	},
	{ number: 3, title: 'Blood Oath', tagline: 'Into Sector 666, to end it at the source.', lineup: [] },
	{ number: 4, title: 'To be revealed', tagline: '', lineup: [] }
];

/** Which act a mission is in and its number within that act. */
export function placeOf(id: string): { act: ActInfo; number: number } {
	for (const act of ACTS) {
		const i = act.lineup.indexOf(id);
		if (i >= 0) return { act, number: i + 1 };
	}
	throw new Error(`Mission ${id} isn't in any act`);
}
