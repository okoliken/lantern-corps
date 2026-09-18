// Missions: the story, as data. Each mission names who you play, where, and
// the briefing shown before it starts. The rules live in its director
// (src/lib/engine/missions/).

import type { EnvironmentKind } from '$lib/engine/environment';
import type { LanternId } from '$lib/engine/lanterns';

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

export function missionById(id: string): MissionInfo | undefined {
	return MISSIONS.find((m) => m.id === id);
}
