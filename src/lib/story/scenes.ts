// Story scenes: what the characters say, as data. The scene code (in
// src/lib/engine/scenes/) plays the animation and shows these lines.

import { GREEN_LIGHT, THEME_GREEN } from '../theme';

export type Speaker = 'tomar' | 'hal' | 'john' | 'ring' | 'guardian' | 'kilowog' | 'razer' | 'jonn';

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
	ring: { name: 'The ring', color: THEME_GREEN },
	guardian: { name: 'The Guardians', color: '#7fb4ff' },
	kilowog: { name: 'Kilowog', color: '#e8b0b6' },
	razer: { name: 'Razer', color: '#ff6b6b' },
	jonn: { name: "J'onn J'onzz", color: '#78dcaa' }
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

/**
 * Start of Act 2, Mission 2: the ring has carried John across the galaxy to
 * Oa. The Guardians, Tomar-Re, Kilowog and Hal are waiting for him.
 */
export const SUMMONED: SceneLine[] = [
	{ who: 'ring', text: 'Destination reached. Oa: home of the Green Lantern Corps.' },
	{ who: 'john', text: 'Ten minutes ago I was fighting a gorilla in Central City. I have questions.' },
	{ who: 'guardian', text: 'John Stewart of Earth. The ring of Tolen Vex chose you. We wished to see its choice for ourselves.' },
	{ who: 'hal', text: "Hal Jordan. The other guy from Earth. Don't mind them, they do that to everybody.", mood: 'grin' },
	{ who: 'tomar', text: 'Tomar-Re, Sector 2813. Any Lantern of Earth is a friend of mine. Your people fly well.', mood: 'salute' },
	{ who: 'kilowog', text: "Kilowog. I train the rookies. A ring don't make you a Lantern, poozer. I do." },
	{ who: 'john', text: 'Marine Corps, two tours. Try me.' },
	{ who: 'kilowog', text: "Heh. I like this one. Training ground. Now." }
];

/**
 * Start of Act 2, Mission 4: after John's report, Hal makes the Guardians
 * say it. Razer hears it from his cell.
 */
export const CONFESSION: SceneLine[] = [
	{ who: 'hal', text: "A machine on Earth that rebuilds itself, and my ring has a name for it. You knew that name. I saw your faces. So let's hear it.", mood: 'alarm' },
	{ who: 'guardian', text: 'Before the Corps, there were the Manhunters. Our first peacekeepers. Machines: incorruptible, tireless, without fear.' },
	{ who: 'guardian', text: 'There was a flaw. They concluded that the surest way to end evil was to end life. In Sector 666, they did.', mood: 'alarm' },
	{ who: 'kilowog', text: 'A whole sector. And you never told the Corps. You never told ANYBODY.', mood: 'alarm' },
	{ who: 'guardian', text: 'We shut them down and sealed them in a vault on a dead world. We built the Corps so it could never happen again. We judged that enough.' },
	{ who: 'razer', text: 'Enough. ENOUGH? My world was in Sector 666. My wife was in Sector 666. You made Atrocitus. You made ME.', mood: 'alarm' },
	{ who: 'razer', text: 'And you are too late. Atrocitus knows about your vault. He sent Bleez for it days ago: an army that cannot die, turned on Oa.' },
	{ who: 'hal', text: "Then you're going to show us where it is." },
	{ who: 'razer', text: 'I will take you. Not for them. Never for them. For what is behind that door, and what it did.' },
	{ who: 'kilowog', text: "Good enough for me. Open the cell, Jordan. We're going." }
];

/**
 * Start of Act 2, Mission 5: the Manhunters that got out of the vault come
 * down over Detroit, and the Martian Manhunter introduces himself.
 */
export const THE_SIGNAL: SceneLine[] = [
	{ who: 'ring', text: "Warning. Three objects entering Earth's atmosphere. Manhunter signatures.", mood: 'alarm' },
	{ who: 'john', text: "The ones that got out of Hal's vault. Where are they headed?" },
	{ who: 'ring', text: 'Here. And they are not alone. Dormant units detected beneath this city. They are waking.', mood: 'alarm' },
	{ who: 'jonn', text: "John Stewart. Do not be alarmed. I am J'onn J'onzz, of the Justice League, and I am speaking to your mind." },
	{ who: 'john', text: "A voice in my head telling me not to be alarmed. That's alarming." },
	{ who: 'jonn', text: 'They are waking beneath seven cities. Yours is the largest nest. The League is coming, but you are closest. You will be alone at first.', mood: 'alarm' },
	{ who: 'john', text: "I've been alone in worse places than Eight Mile. Ring: take us down." }
];

/**
 * Start of Act 2's boss: what answered the signal, and why the Guardians
 * never destroyed it.
 */
export const THE_FIRST: SceneLine[] = [
	{ who: 'john', text: "Detroit is standing. But that spire was calling something, and something picked up." },
	{ who: 'guardian', text: 'Manhunter Prime. The first. Every Manhunter that ever walked was a copy of its mind.', mood: 'alarm' },
	{ who: 'hal', text: "Let me guess. You couldn't bring yourselves to scrap it, so you buried it.", mood: 'grin' },
	{ who: 'guardian', text: 'Beneath the vault, deeper than the rest. It cannot be ended from afar. It must be broken, and its core unmade, by hand.' },
	{ who: 'kilowog', text: "Then I'm goin' with 'em." },
	{ who: 'guardian', text: 'No, Sergeant. The Red Lanterns are moving, and Oa will need you. Jordan and Stewart go alone.' },
	{ who: 'guardian', text: 'Be warned, both of you. It was built to learn. What you show it, it keeps.', mood: 'alarm' },
	{ who: 'john', text: "Then we don't show it the same thing twice." },
	{ who: 'hal', text: 'Two guys from Earth against the one thing the Guardians were too scared to finish. I like our odds.', mood: 'grin' },
	{ who: 'john', text: "I've seen your odds, Jordan. Let's go." }
];

/**
 * Start of Act 3: the Red fleet over Oa, with most of the Corps still
 * scattered across the sectors.
 */
export const RED_DAWN: SceneLine[] = [
	{ who: 'ring', text: 'Alert. Red Lantern fleet in orbit over Oa. Drop pods launching.', mood: 'alarm' },
	{ who: 'kilowog', text: "Every Lantern we got is out chasin' Manhunters. That was the point, wasn't it?", mood: 'alarm' },
	{ who: 'guardian', text: 'They have come for the Central Battery. Every ring in the Corps draws on its light. If it goes dark, so do they.' },
	{ who: 'john', text: 'Then it does not go dark. Three of us, one battery. We make a perimeter and we hold it.' },
	{ who: 'hal', text: "Three of us against a fleet. I've had worse Tuesdays.", mood: 'grin' },
	{ who: 'guardian', text: 'Hold until we can wake it fully. The Corps is coming home as fast as it can.' },
	{ who: 'kilowog', text: "You heard 'em, poozers. Nobody touches that battery!", mood: 'alarm' }
];

/** Start of Act 3, Mission 2: the morning after the siege, and a column of smoke on the far plains. */
export const THE_TRAIL: SceneLine[] = [
	{ who: 'guardian', text: 'Ganthet is taken. Of all of us, the one who knows the way into the Book of the Black.', mood: 'alarm' },
	{ who: 'kilowog', text: "One of their dreadnoughts didn't make it off-world. Came down on the far plains. Scanners say somethin' small crawled out of it." },
	{ who: 'hal', text: 'Small. Furry. Angry. With a Guardian in a bubble.', mood: 'grin' },
	{ who: 'john', text: "If he's still on Oa, we can still get Ganthet back. Once he's off-world, we can't." },
	{ who: 'kilowog', text: "Then go. I'll hold things here. And poozers: it's a cat. Don't let it make you look stupid." },
	{ who: 'hal', text: "Too late for that. Let's go, John." }
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
