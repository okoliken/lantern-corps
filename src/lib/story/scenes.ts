// Story scenes: what the characters say, as data. The scene code (in
// src/lib/engine/scenes/) plays the animation and shows these lines.

import { GREEN_LIGHT, THEME_GREEN } from '../theme';

export type Speaker =
	| 'tomar'
	| 'hal'
	| 'john'
	| 'ring'
	| 'guardian'
	| 'kilowog'
	| 'razer'
	| 'jonn'
	| 'ganthet'
	| 'arisia'
	| 'atrocitus'
	| 'katma'
	| 'boodikka'
	// Season two
	| 'sinestro'
	| 'superman'
	| 'wonderwoman'
	| 'batman'
	| 'flash'
	| 'hawkgirl'
	| 'scarecrow'
	| 'grodd'
	| 'ray';

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
	jonn: { name: "J'onn J'onzz", color: '#78dcaa' },
	ganthet: { name: 'Ganthet', color: '#9fd4ff' },
	arisia: { name: 'Arisia', color: '#ffe08a' },
	atrocitus: { name: 'Atrocitus', color: '#ff3b30' },
	katma: { name: 'Katma Tui', color: '#e58bc0' },
	boodikka: { name: 'Boodikka', color: '#ffae7a' },
	sinestro: { name: 'Sinestro', color: '#e58bc0' },
	superman: { name: 'Superman', color: '#7fb0ff' },
	wonderwoman: { name: 'Wonder Woman', color: '#ffd766' },
	batman: { name: 'Batman', color: '#aeb6c0' },
	flash: { name: 'The Flash', color: '#ff6a5c' },
	hawkgirl: { name: 'Hawkgirl', color: '#f0c465' },
	scarecrow: { name: 'Scarecrow', color: '#b9c86a' },
	grodd: { name: 'Grodd', color: '#c79bff' },
	ray: { name: 'Ray Doyle', color: '#ffd23a' }
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

/** Start of Act 3, Mission 3: the edge of the dead sector. */
export const DEAD_SECTOR: SceneLine[] = [
	{ who: 'ring', text: 'Entering Sector 666. No life signs. No life signs anywhere in the sector.', mood: 'alarm' },
	{ who: 'arisia', text: 'Nothing? Not even on the planets?' },
	{ who: 'ganthet', text: 'Nothing. The Manhunters were thorough. It is the most shameful place in the universe, and we made it.' },
	{ who: 'john', text: 'And Atrocitus is at the far end of it.' },
	{ who: 'ganthet', text: 'Ysmault, beyond the Blood Gate. The Red Lanterns will be waiting, and the storms here are made of rage. Stay close to me.' },
	{ who: 'hal', text: "Stay close, clear the way, don't touch the scary red clouds. Got it.", mood: 'grin' }
];

/** Start of Act 3, Mission 4: down onto Ysmault. */
export const BLOOD_WORLD: SceneLine[] = [
	{ who: 'ring', text: 'Ysmault. Warning: high concentrations of rage energy. Willpower drain likely.', mood: 'alarm' },
	{ who: 'atrocitus', text: 'I have felt you coming since you crossed my gate, little lights.' },
	{ who: 'atrocitus', text: 'Ten thousand years ago the Guardians’ machines burned my world. Every soul in this sector. I alone remained, and my rage kept me alive.' },
	{ who: 'john', text: "He's not wrong about the machines. We saw what's left." },
	{ who: 'hal', text: "He's also about to open a book that ends the Corps. We can feel sorry for him after.", mood: 'grin' },
	{ who: 'arisia', text: 'The glow on the horizon. That is the Blood Altar.' },
	{ who: 'atrocitus', text: 'Come to it, then. Come and bleed.', mood: 'alarm' }
];

/** Start of the finale: Atrocitus swears his oath at the dark altar. */
export const BLOOD_OATH: SceneLine[] = [
	{ who: 'atrocitus', text: 'The altar is dark. It does not matter. The Book of the Black is already mine.' },
	{ who: 'razer', text: 'Then put it down, Atrocitus. It is over.' },
	{ who: 'atrocitus', text: 'Over? Razer. Nothing is over. Ten thousand years I have waited to hear the Guardians’ children scream.', mood: 'alarm' },
	{ who: 'atrocitus', text: 'With blood and rage of crimson red, ripped from a corpse so freshly dead...', mood: 'alarm' },
	{ who: 'atrocitus', text: 'Together with our hellish hate, we’ll burn you all. That is your fate!', mood: 'alarm' },
	{ who: 'hal', text: "In brightest day, in blackest night. We've got our own words, pal." },
	{ who: 'john', text: 'And the rest of the Corps is on its way. Hold him till they get here.' }
];

/** The end: home on Oa, everyone who fought, the battery bright again. */
export const LAST_LIGHT: SceneLine[] = [
	{ who: 'guardian', text: 'Lanterns. You went where we would not, and you ended what we began ten thousand years ago.' },
	{ who: 'ganthet', text: 'The Manhunters were our shame. Atrocitus was our shame. We hid them both. We will not hide again.' },
	{ who: 'kilowog', text: "First time I ever heard a Guardian say sorry. Took a whole sector to get it." },
	{ who: 'arisia', text: 'Razer stayed on Ysmault. He said somebody has to watch over the dead, and he owes them.' },
	{ who: 'john', text: "I'm going back to Earth. The League kept my seat warm, and Earth's in my sector." },
	{ who: 'hal', text: "And I'll be out on the frontier. Somebody has to fly into things headfirst.", mood: 'grin' },
	{ who: 'john', text: "Somebody has to pull you back out. You know where to find me, Jordan." },
	{ who: 'katma', text: 'The Corps is whole again. More Lanterns came home tonight than we lost.' },
	{ who: 'guardian', text: 'Then say it, all of you. Say it so the whole universe can hear.' },
	{ who: 'hal', text: 'In brightest day, in blackest night, no evil shall escape our sight. Let those who worship evil’s might beware our power: Green Lantern’s light!', mood: 'chosen' }
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

// ---------------------------------------------------------------- Season Two
// A scene before every episode: who's there, what's happened since the last
// one, and why they're going in.

/** Before The Watchtower: John is beamed up to meet the League. */
export const LEAGUE_INVITE: SceneLine[] = [
	{ who: 'ring', text: 'Teleport complete. Earth orbit: the Justice League Watchtower.' },
	{ who: 'john', text: 'First Oa, now this. Somebody could warn a guy before they beam him into space.' },
	{ who: 'superman', text: "Sorry about that. Welcome aboard, John. We've heard a lot about Detroit." },
	{ who: 'flash', text: 'Mostly from me. I may have told it with more gorillas.', mood: 'grin' },
	{ who: 'wonderwoman', text: 'You have fought a war, Lantern. We want to see what you do when the thing in front of you is not an enemy.' },
	{ who: 'john', text: 'Then what is it?' },
	{ who: 'hawkgirl', text: "People. Falling, panicking, in the way. The things you can't hit." },
	{ who: 'superman', text: "Four drills. Take your time. Nobody's keeping score." },
	{ who: 'flash', text: "I'm keeping score.", mood: 'grin' }
];

/** Before Hard Order: Hal and Kilowog fly under Sinestro to Vesk. */
export const UNDER_SINESTRO: SceneLine[] = [
	{ who: 'ring', text: 'Approaching Vesk Colony. Raider signatures in the fields.', mood: 'alarm' },
	{ who: 'sinestro', text: 'Atrocitus is finished and his dogs still bite. Jordan, Kilowog: you will follow my lead, and you will not improvise.' },
	{ who: 'hal', text: "Improvising's kind of my thing.", mood: 'grin' },
	{ who: 'sinestro', text: 'I know. It is why you need me.' },
	{ who: 'kilowog', text: 'He trained half the Corps, Hal. Me included. Do what he says and we all go home.' },
	{ who: 'sinestro', text: 'A world is kept safe by order. Remember that when you see what order costs.' },
	{ who: 'hal', text: "...What's that supposed to mean?" },
	{ who: 'sinestro', text: 'Down. Now.', mood: 'alarm' }
];

/** Before Ground Level: Superman already has the far end of the load. */
export const DEAD_CRANE: SceneLine[] = [
	{ who: 'superman', text: "John! Glad you could make it. I've got the far end." },
	{ who: 'john', text: "That's a full container on a dead crane. What happened?" },
	{ who: 'superman', text: "The lifter lost power mid-swing. There are three crews in the yard under it, and they're not moving fast enough.", mood: 'alarm' },
	{ who: 'john', text: 'Then I take the near end and you get them out.' },
	{ who: 'superman', text: "I can't get them out and hold it. Neither can you. You hold it and shield them, I lower it. Slowly." },
	{ who: 'john', text: 'Slowly. Right. Everything the ring has done for me so far has been fast.' },
	{ who: 'superman', text: 'Then today you learn the other half. The ring holds things up too.' }
];

/** Before Korugar: Hal tells the Guardians what he saw on Vesk, and they already knew. */
export const SINESTROS_WORLD: SceneLine[] = [
	{ who: 'hal', text: "He saved Vesk. Then he put the whole colony under curfew. Kids afraid to step outside. That's not the Corps.", mood: 'alarm' },
	{ who: 'guardian', text: "We know. Korugar has lived that way for years. Sinestro's laws, Sinestro's police, his face on every wall." },
	{ who: 'kilowog', text: 'You knew? And you let him?', mood: 'alarm' },
	{ who: 'guardian', text: 'Korugar was the safest world in its sector. We told ourselves that was enough. It was not.' },
	{ who: 'guardian', text: 'Sinestro is to be brought to Oa. You trained under him, Hal Jordan. You will bring him.' },
	{ who: 'hal', text: 'Me. Of course me.' },
	{ who: 'kilowog', text: "I'm comin' too. He won't come quiet, and you know it." },
	{ who: 'hal', text: 'He taught me everything I know. Here\'s hoping he forgot something.' }
];

/** Before Gotham at Night: Batman asked for a Lantern, and for John. */
export const THE_NARROWS: SceneLine[] = [
	{ who: 'batman', text: 'You came alone. Good.' },
	{ who: 'john', text: "You asked for a Lantern. I'm the one who lives here. What's going on?" },
	{ who: 'batman', text: 'Crane. The Scarecrow. Three tanks of fear toxin venting into the Narrows. People down there are reliving their worst nights.' },
	{ who: 'john', text: 'And you need a ring for that?' },
	{ who: 'batman', text: 'Your ring runs on will. His toxin eats will. I need to know what happens when they meet, before he finds out for himself.' },
	{ who: 'john', text: "So I'm the experiment." },
	{ who: 'batman', text: "You're the only one who'll feel it working. If your constructs start to shrink, hit back. Don't back off." },
	{ who: 'scarecrow', text: "Welcome to the Narrows, Lantern. Let's find out what frightens you.", mood: 'alarm' }
];

/** Before Qward: the exile's trail ends at a tear in space. */
export const THE_OTHER_SIDE: SceneLine[] = [
	{ who: 'ring', text: "Sinestro's trace ends here. Anti-matter readings off the scale." },
	{ who: 'kilowog', text: 'He went through smilin\', Hal. Nobody smiles goin\' into exile.' },
	{ who: 'hal', text: "The Weaponers wanted him. You don't come for a guy unless you've got something waiting for him." },
	{ who: 'guardian', text: 'Qward is beyond our sight. Your willpower will come back slowly there. Do not stay.' },
	{ who: 'hal', text: 'In and out. Find out what they are making for him, break it, come home.' },
	{ who: 'kilowog', text: "I hate this place already, and I ain't even in it.", mood: 'grin' },
	{ who: 'hal', text: 'After you, Sarge.' }
];

/** Before What Grodd Wants: Gorilla City tech on every corner of Central City. */
export const BAIT: SceneLine[] = [
	{ who: 'flash', text: "Gorilla tech on every corner, John. Nobody's guarding it like they want to keep it." },
	{ who: 'hawkgirl', text: "Because it's bait. Grodd doesn't lose things. He leaves them where he wants us." },
	{ who: 'john', text: 'Bait for what?' },
	{ who: 'flash', text: "Last time, you put him through a bank. I'm guessing bait for you.", mood: 'grin' },
	{ who: 'grodd', text: 'Not for you, Lantern. For the ring. A weapon that does whatever its bearer\'s mind tells it. Imagine it with a better mind.', mood: 'alarm' },
	{ who: 'john', text: "He's in my head. I can hear him." },
	{ who: 'hawkgirl', text: 'Then keep him out. Break his amplifiers and we break his reach.' }
];

/** Before First Light of Fear: Hal on Earth, and a call from Vesk. */
export const A_LANTERN_IN_YELLOW: SceneLine[] = [
	{ who: 'hal', text: 'Ferris Air, three in the morning, and the coffee is still terrible.' },
	{ who: 'ring', text: 'Distress call. Vesk Colony, Sector 2814.', mood: 'alarm' },
	{ who: 'hal', text: 'Vesk? We cleared Vesk.' },
	{ who: 'ring', text: 'The colonists report a Lantern. A Lantern in yellow.' },
	{ who: 'hal', text: 'Ring, get me Kilowog.' },
	{ who: 'ring', text: 'Kilowog is three sectors away. The Guardians advise that it is probably nothing.' },
	{ who: 'hal', text: "It's never nothing. Okay. Just me, then.", mood: 'chosen' }
];

/** Before Recruited: Wonder Woman finds John on his roof. */
export const DREAMS_WITH_TEETH: SceneLine[] = [
	{ who: 'wonderwoman', text: 'Lantern. Your city is dreaming, and its dreams have teeth.' },
	{ who: 'john', text: 'Red Lanterns on the riverfront. In yellow. I put those away.' },
	{ who: 'wonderwoman', text: 'They are not real. A yellow ring is pulling them out of frightened minds, and it has found its bearer. A night watchman.' },
	{ who: 'john', text: "Ray Doyle. I know him. He works the lot by my old site. He's never hurt anyone." },
	{ who: 'wonderwoman', text: 'Which is why we will not hurt him. Wear the ring down. My lasso will do the rest.' },
	{ who: 'john', text: 'And then?' },
	{ who: 'wonderwoman', text: 'Then you talk to him, as a friend. The truth sets people free, John. That is what the lasso is for.' },
	{ who: 'ray', text: "Stay back! Please... I can't make it stop!", mood: 'alarm' }
];

/** Before The Rings Go Out: Hal, beaten, and yellow rings flying out across the sectors. */
export const YELLOW_RINGS: SceneLine[] = [
	{ who: 'kilowog', text: "He beat you, Hal. One on one. I ain't never seen anybody do that." },
	{ who: 'hal', text: 'It was like the ring knew I was scared before I did. Every construct came out smaller.' },
	{ who: 'guardian', text: 'Yellow rings are flying across the sectors. Hundreds. Each one seeks someone who can instill great fear.', mood: 'alarm' },
	{ who: 'guardian', text: 'On Graxos IV, three of ours are down with drained rings, and the new Corps is hunting them.' },
	{ who: 'hal', text: 'Katma. Boodikka. Arisia.' },
	{ who: 'kilowog', text: "Then get up, Jordan. You lost one fight. Don't lose the next three." },
	{ who: 'hal', text: "...Right. Let's go get our friends." }
];

/** Before Two Lanterns: Hal comes to the Watchtower to warn John. */
export const SIDE_BY_SIDE: SceneLine[] = [
	{ who: 'john', text: "Hal Jordan, on the Watchtower. The League's going to want your autograph." },
	{ who: 'hal', text: 'No time. I came to warn you. The Sinestro Corps is coming here.' },
	{ who: 'john', text: 'Here? Why the Watchtower?' },
	{ who: 'hal', text: "Because it's where Earth's heroes sleep. Scare them, and Earth is next." },
	{ who: 'ring', text: 'Multiple yellow signatures approaching. Contact in sixty seconds.', mood: 'alarm' },
	{ who: 'superman', text: "We're holding the lower decks. The training deck is yours, Lanterns." },
	{ who: 'hal', text: 'Two Lanterns from Earth, together. Try to keep up, Stewart.', mood: 'grin' },
	{ who: 'john', text: "Stay close, Jordan. Fear can't get a grip on either of us that way." }
];

/** Before the finale: up the steps of Sinestro's citadel. */
export const THE_CITADEL: SceneLine[] = [
	{ who: 'kilowog', text: 'Korugar. Last time we were here, he was one of us.' },
	{ who: 'john', text: "That's his lantern. The great yellow one. It's charging every ring in his Corps." },
	{ who: 'sinestro', text: 'Jordan. Stewart. Sergeant. You came all the way to my home to be afraid together.' },
	{ who: 'hal', text: 'We came to finish it, Sinestro.', mood: 'alarm' },
	{ who: 'sinestro', text: 'Finish it? I taught you everything you know, Jordan. Every move you make, I have already seen.', mood: 'alarm' },
	{ who: 'hal', text: 'Not everything. You never taught me how to lose and get back up.' },
	{ who: 'john', text: 'Up the steps. All three of us.' }
];

/** The end of season two: Sinestro beaten, and his lantern still burning. */
export const STILL_BURNING: SceneLine[] = [
	{ who: 'kilowog', text: "He's down. Sinestro's finally down." },
	{ who: 'john', text: "The Guardians can have him. Let's see them hold him this time." },
	{ who: 'hal', text: "John. The lantern. It's still burning.", mood: 'alarm' },
	{ who: 'sinestro', text: 'Of course it is, Jordan. You beat a man. You cannot beat fear. Fear was here before your light, and it will be here after.' },
	{ who: 'guardian', text: 'Bring him home, Lanterns. The yellow lantern will be... studied.' },
	{ who: 'kilowog', text: "Studied. Sure. That's how it started with the Manhunters." },
	{ who: 'john', text: 'Then we watch it. Both of us.' },
	{ who: 'hal', text: 'In brightest day, in blackest night, no evil shall escape our sight.', mood: 'chosen' }
];
