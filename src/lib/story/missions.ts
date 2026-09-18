// Missions: the story, as data. Each mission names who you play, where, and
// the briefing shown before it starts. The rules live in its director
// (src/lib/engine/missions/).

import type { EnvironmentKind } from '$lib/engine/environment';
import type { CrewId, LanternId } from '$lib/engine/lanterns';

export interface MissionInfo {
	id: string;
	number: number;
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
		number: 1,
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
	number: 2,
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
	number: 3,
	title: 'Colony Under Fire',
	tagline: "John Stewart's first mission: get Mirrow's colonists out through Zilius Zox's fire.",
	lantern: 'john',
	environment: 'planet',
	place: 'Sector 2814 · Mirrow Colony',
	briefing: [
		'Three days ago John Stewart was an architect on a building site in Detroit. Now he wears the ring of Sector 2814, and his first call has come in: Mirrow, a farming colony on the frontier, is burning.',
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

export function missionById(id: string): MissionInfo | undefined {
	return MISSIONS.find((m) => m.id === id);
}
