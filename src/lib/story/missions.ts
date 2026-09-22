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
	/** You pick who to play from these; the other fights beside you. */
	choose?: LanternId[];
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

MISSIONS.push({
	id: 'razer',
	title: 'Razer',
	tagline: "Atrocitus's lieutenant. His Red Lanterns fight you first. Then he does.",
	lantern: 'hal',
	environment: 'planet',
	place: "Beyond the frontier · Razer's Fortress",
	briefing: [
		"The fortress on the far side of the Prison Moon belongs to Razer: Atrocitus's lieutenant, and the angriest Red Lantern of them all. Whatever he lost, he's made the whole Corps pay for it.",
		'Katma Tui and the Lanterns you freed will get the last prisoners out of his cells. Your job is to keep Razer busy.',
		"He fights with blades, and with rage that breaks what a ring builds. Don't kill him. The Corps needs to know who he answers to."
	],
	objectives: [
		"Beat Razer's guard; then he comes for you himself",
		'Watch for Construct Shatter: it breaks your walls, turrets, armor and shields',
		'A Rage Brand stops your ring building anything for a few seconds',
		'When he goes berserk and glows, get clear of the Crimson Nova or shield in time'
	],
	partner: 'kilowog'
});

MISSIONS.push({
	id: 'call-to-arms',
	title: 'Call to Arms',
	tagline: 'The ring finds John Stewart and throws him into a fight beside the Flash and Hawkgirl, against Gorilla Grodd.',
	lantern: 'john',
	environment: 'planet',
	place: 'Earth · Central City',
	briefing: [
		'Detroit, the night after. John Stewart has been telling himself he dreamed it: the green light, the ring, the voice saying he was chosen. Then it comes back.',
		"Central City is under attack. Gorilla Grodd, the telepathic genius of Gorilla City, has brought an army into the streets and torn open a junction downtown to dig for something. The Flash and Hawkgirl are holding the line, barely.",
		"John has never used the ring. The ring doesn't seem worried about that."
	],
	objectives: [
		'Help the Flash and Hawkgirl stop Grodd\'s army',
		'Defeat Grodd. His Psychic Blast goes straight through a bubble shield: get out of its way',
		'Mind Control turns your moves around: steer the other way until it wears off',
		'No battery on Earth yet: your willpower only comes back on its own'
	],
	partner: 'hawkgirl'
});

MISSIONS.push({
	id: 'summoned',
	title: 'Summoned',
	tagline: 'The ring carries John across the galaxy to Oa, where Kilowog, and then Sinestro, want to see what it chose.',
	lantern: 'john',
	environment: 'planet',
	place: 'Oa · The Training Ground',
	briefing: [
		'The ring did not ask. One moment John Stewart was standing in a wrecked street in Central City; the next, Earth was a blue marble behind him and the stars were stretching into lines.',
		'Oa: the planet at the center of the universe, home of the Guardians and the Green Lantern Corps. They want to see who the ring of Tolen Vex chose. So does the Corps\' drill sergeant.',
		'"A ring don\'t make you a Lantern, poozer. I do."'
	],
	objectives: [
		'Show Kilowog what you can do, one on one',
		'Hold on when it stops being fair',
		'Make them both yield',
		'The Lantern battery at the edge of the ground recharges your willpower'
	],
	partner: 'hal'
});

MISSIONS.push({
	id: 'the-guardians-shame',
	title: "The Guardians' Shame",
	tagline: 'The Guardians built the Manhunters, and buried them. The Red Lanterns are digging them up. Hal, Kilowog and Razer go to the vault.',
	lantern: 'hal',
	environment: 'planet',
	place: 'Sector 666 · The Vault',
	briefing: [
		'John Stewart said one word on Oa and the Guardians ended the session. Hal Jordan went back in and did not leave until they told him why.',
		'The Manhunters were theirs. When the machines turned butcher in Sector 666, the Guardians shut them down, sealed them in a vault on a dead world, and told no one. Atrocitus knows. His Red Lanterns are already cutting at the seal.',
		'Razer knows the way. He is out of his cell, he is not doing this for the Corps, and he is the best chance you have.'
	],
	objectives: [
		'Stop the Red Lanterns cutting the seal',
		'When the Manhunters come out, they attack everyone: let them and the Reds fight each other',
		'A broken Manhunter rebuilds: smash its core',
		'Reseal the vault: stand by each of the three pylons to charge it'
	],
	partner: 'kilowog'
});

MISSIONS.push({
	id: 'sleepers',
	title: 'Sleepers',
	tagline: 'The Manhunters that escaped the vault are waking the ones buried under Earth. John holds Detroit, and the Justice League comes to him.',
	lantern: 'john',
	environment: 'planet',
	place: 'Earth · Detroit',
	briefing: [
		'Some Manhunters got out of the vault before Hal sealed it, and they came to Earth. They did not come to fight. They came to wake the rest: machines buried under seven cities since before there were cities.',
		"The largest nest is under Detroit. John Stewart's city. He is closest, so he is first, and for a while he is alone.",
		"The Justice League is on its way, one at a time, as fast as each can get there. J'onn J'onzz links them mind to mind. Batman is watching from above. Something under the east junction is drawing a great deal of power."
	],
	objectives: [
		'Break the Manhunters as they come up through the street, and smash their cores before they rebuild',
		'Hold on: the Flash, Hawkgirl, Superman and Wonder Woman arrive as the fight goes on',
		'Tear down the signal spire before its signal is complete',
		'When the spire is about to pulse, get clear of it or shield'
	],
	partner: 'flash'
});

MISSIONS.push({
	id: 'manhunter-prime',
	title: 'Manhunter Prime',
	tagline: 'The first Manhunter, buried under the vault, is awake, and it learns. Hal and John go down together: choose who you play.',
	lantern: 'hal',
	choose: ['hal', 'john'],
	environment: 'planet',
	place: 'Sector 666 · The Heart of the Vault',
	briefing: [
		'The signal from Detroit was answered. Under the vault, deeper than the rest, the Guardians buried the first Manhunter: the mind every other one was copied from. They could not bring themselves to destroy it. Now it is awake.',
		'It was built to learn. It watches what you build, and at each stage of the fight it takes the construct you have used most: your ring can no longer make it, and Prime can. Whatever you lean on, you lose.',
		'Hal Jordan and John Stewart go down together. Choose who you play; the other fights beside you.'
	],
	objectives: [
		'Destroy Manhunter Prime',
		'Keep changing constructs: at 70%, 40% and 15% it locks the one you have used most, and copies it',
		'The ranks along the walls wake as the fight goes on: break them and smash their cores',
		'When Prime falls, smash its core before it rebuilds. That gives every ring its light back'
	]
});

MISSIONS.push({
	id: 'siege-of-oa',
	title: 'Siege of Oa',
	tagline: 'The Manhunters were a distraction. The Red fleet is over Oa, the Corps is scattered, and three Lanterns hold the Central Battery.',
	lantern: 'hal',
	choose: ['hal', 'john'],
	environment: 'planet',
	place: 'Oa · The Central Battery',
	briefing: [
		'Manhunter Prime\'s last words gave it away: Atrocitus wanted the Corps looking at the Manhunters. While every Lantern was out chasing them, his fleet came for Oa.',
		'The Central Battery is the light every ring in the Corps draws on. The Red Lanterns will try to drink it dry, and crack it open from the air. If it goes dark, so does every Green Lantern.',
		'Hal Jordan, John Stewart and Kilowog are all the Corps has on the ground. Choose who you play. Hold until the Guardians can wake the battery.'
	],
	objectives: [
		'Keep the Red Lanterns away from the Central Battery: any near it drain its light',
		'Shoot down torpedoes aimed at the battery, or put a bubble shield on it',
		'When the flagship fires, get out of the red circles',
		'Stand at the foot of the battery to recharge your ring'
	],
	partner: 'kilowog'
});

MISSIONS.push({
	id: 'dex-starr',
	title: 'Dex-Starr',
	tagline: 'A Red Lantern cat has a Guardian. Hunt him across the wreck of a Red dreadnought before he gets off Oa.',
	lantern: 'hal',
	choose: ['hal', 'john'],
	environment: 'planet',
	place: "Oa · The Dreadnought's Crash",
	briefing: [
		"One of Atrocitus's dreadnoughts never made it off Oa: it came down on the far plains. Something small crawled out of the wreck alive, and it has Ganthet in a bubble of rage.",
		'Dex-Starr is fast, cruel and hard to pin down. He will run, and every time he runs he leaves a trail. Follow it. If you fall too far behind, the trail goes cold and he is gone.',
		'Hal Jordan and John Stewart go after him. Choose who you play.'
	],
	objectives: [
		'Follow the glowing paw prints to where Dex-Starr has gone to ground',
		'Hurt him enough and he runs: stay close, or the trail goes cold',
		'Corner him at the dreadnought, then break Ganthet out of his bubble'
	]
});

MISSIONS.push({
	id: 'into-sector-666',
	title: 'Into Sector 666',
	tagline: 'Escort Ganthet through the dead sector the Manhunters burned, past rage storms and Red patrols, to the Blood Gate.',
	lantern: 'hal',
	choose: ['hal', 'john'],
	environment: 'space',
	place: 'Sector 666 · The Dead Sector',
	briefing: [
		'Only Ganthet knows the way through Sector 666 to Ysmault, where Atrocitus is going for the Book of the Black. The sector is dead: the Manhunters burned it, long ago.',
		'What is left is rage. It drifts through the sector in storms that burn Lanterns and drain their will, and the Red Lanterns patrol the way.',
		'Ganthet leads, and he will not go on while the Reds are on him. Hal Jordan, John Stewart and Arisia escort him. Choose who you play.'
	],
	objectives: [
		'Keep Ganthet alive: clear the Red Lanterns so he can go on',
		'Stay out of the rage storms, and shield Ganthet when one reaches him',
		'Shoot down the torpedoes fighters fire at him',
		'Stay near Ganthet to recharge your ring: his light is your battery'
	],
	partner: 'arisia'
});

MISSIONS.push({
	id: 'ysmault',
	title: 'Ysmault',
	tagline: 'The Red Lanterns’ home world. Break the four conduits feeding the Blood Altar while Atrocitus’s legion pours out of the blood.',
	lantern: 'hal',
	choose: ['hal', 'john'],
	environment: 'planet',
	place: 'Sector 666 · Ysmault',
	briefing: [
		'Through the Blood Gate lies Ysmault, the world Atrocitus has ruled since the Manhunters burned his sector. At its heart is the Blood Altar, and Atrocitus is drawing on it to open the Book of the Black.',
		'Four conduits feed the altar. While any of them stand, it heals every Red Lantern near it and throws surges of blood across the plain. The Red Lanterns climb out of the blood pools at the edges, and keep coming.',
		'Hal Jordan, John Stewart and Arisia go down into the middle of it. Choose who you play.'
	],
	objectives: [
		'Break the four conduits feeding the Blood Altar',
		'While any conduit stands, Red Lanterns near the altar heal: break the conduits first',
		'When the altar swells, take to the air (or shield): the surge rolls along the ground',
		'Stay out of the blood lake'
	],
	partner: 'arisia'
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
			'razer'
		]
	},
	{
		number: 2,
		title: 'The Old Machines',
		tagline: 'A new Lantern on Earth, and something ancient waking up.',
		lineup: [
			'call-to-arms',
			'summoned',
			'colony-under-fire',
			'the-guardians-shame',
			'sleepers',
			'manhunter-prime'
		]
	},
	{
		number: 3,
		title: 'Blood Oath',
		tagline: 'Atrocitus comes for Oa, and the Corps goes after him: into Sector 666, to end it at the source.',
		lineup: [
			'siege-of-oa',
			'dex-starr',
			'into-sector-666',
			'ysmault',
			{ title: 'Boss: Atrocitus', tagline: 'It will take every Lantern you have.' }
		]
	},
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

/** Every built story mission, in the order the story plays them (the campaign unlocks them one by one). */
export function storyOrder(): string[] {
	return ACTS.flatMap((act) => act.lineup.filter((entry): entry is string => typeof entry === 'string'));
}
