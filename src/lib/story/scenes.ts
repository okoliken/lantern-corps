// Story scenes: what the characters say, as data. The scene code (in
// src/lib/engine/scenes/) plays the animation and shows these lines.

import { GREEN_LIGHT, THEME_GREEN } from '../theme';

export type Speaker = 'tomar' | 'hal' | 'john' | 'ring';

export interface SceneLine {
	who: Speaker;
	text: string;
	/** How the speaker acts while saying it. */
	mood?: 'salute' | 'grin' | 'alarm' | 'chosen';
}

export const SPEAKERS: Record<Speaker, { name: string; color: string }> = {
	tomar: { name: 'Tomar-Re', color: '#ffb36b' },
	hal: { name: 'Hal Jordan', color: GREEN_LIGHT },
	john: { name: 'John Stewart', color: '#9ad8ff' },
	ring: { name: 'The ring', color: THEME_GREEN }
};

/**
 * End of Mission 2: Tolen Vex's ring crosses Sector 2814 to Earth and finds
 * John Stewart. It ends on the cliffhanger: his first time in the uniform is
 * in Act 2, when the ring throws him into a fight beside the Justice League.
 */
export const JOHN_CHOSEN: SceneLine[] = [
	{ who: 'ring', text: 'John Stewart of Earth.' },
	{ who: 'john', text: '...Okay. Either I need more sleep, or that ring just said my name.' },
	{ who: 'ring', text: 'Your will is strong enough to master fear. You have been chosen.' },
	{ who: 'john', text: 'Chosen for what, exactly?' },
	{ who: 'ring', text: 'Soon, John Stewart. Soon you will be needed.' }
];

/**
 * Start of Act 2: the ring comes back to John on his roof in Detroit, and
 * this time it doesn't wait. The 'chosen' line plays the transformation.
 */
export const JOHN_CALLED: SceneLine[] = [
	{ who: 'ring', text: 'John Stewart. You are needed.' },
	{ who: 'john', text: "You again. I was starting to think I dreamed you." },
	{ who: 'ring', text: 'Central City is under attack. Its defenders are falling. There is no one closer.' },
	{ who: 'john', text: "I build buildings. I don't know the first thing about being a... whatever this is." },
	{ who: 'ring', text: 'You were a Marine. You know how to stand between people and harm. I will do the rest.' },
	{ who: 'john', text: "...Alright. Let's go.", mood: 'chosen' },
	{ who: 'ring', text: 'Welcome to the Green Lantern Corps, John Stewart.' }
];

/** End of Mission 1: Tomar-Re's ship sets down on Oa. */
export const OA_LANDING: SceneLine[] = [
	{ who: 'tomar', text: 'Oa. For a while out there, I did not think I would see her towers again.' },
	{ who: 'tomar', text: 'You flew well, Hal Jordan. My ship and I owe you our lives.', mood: 'salute' },
	{ who: 'hal', text: "All in a day's work. Next time, maybe fly around the asteroid storm?", mood: 'grin' },
	{
		who: 'tomar',
		text: 'The storm is not what holed my hull. Before the belt, something struck me from the dark. A light the color of blood.',
		mood: 'alarm'
	},
	{ who: 'tomar', text: 'Outposts along the frontier of your sector are going silent. Kel-Aris Station stopped answering this morning.' },
	{ who: 'hal', text: "Red light, dead outposts... sounds like somebody's picking a fight." },
	{ who: 'tomar', text: 'Then be careful, my friend. Whatever it is, it is angry. And it is coming this way.' }
];
