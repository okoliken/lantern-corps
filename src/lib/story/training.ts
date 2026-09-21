// Kilowog's training: what he says at each step and what the player has to
// do. {action} in `how` shows that action's current key (see /training).
// The rules for each step are in src/lib/engine/missions/training.ts.

import type { TrainingStep } from '$lib/engine/missions/training';

export interface TrainingText {
	/** Short name for the progress list. */
	title: string;
	/** Kilowog, in character. */
	kilowog: string;
	/** Exactly what to do. */
	how: string;
	/** The same, for the on-screen touch controls, where it reads differently. */
	touchHow?: string;
	/** Optional extra, smaller. */
	tip?: string;
}

export const TRAINING_TEXT: Record<TrainingStep, TrainingText> = {
	welcome: {
		title: 'Welcome',
		kilowog: "So you're Oa's newest recruit. Name's Kilowog. I've trained every Lantern worth the ring, and now I'm training you. Let's see what you've got, poozer.",
		how: 'Watch and listen. Training starts in a moment.'
	},
	move: {
		title: 'Move',
		kilowog: 'First things first. Walk. Every glowing marker, go!',
		how: 'Move with {move}. Walk onto each glowing marker.',
		touchHow: 'Put your {move} down on the left of the screen and push. Walk onto each glowing marker.'
	},
	fly: {
		title: 'Take off',
		kilowog: "Lanterns don't walk everywhere. Get in the air!",
		how: 'Press {fly} to take off.',
		tip: 'In space you are always flying.'
	},
	land: {
		title: 'Land',
		kilowog: 'Now bring it down. Nice and easy, right on the marker.',
		how: 'Fly to the marker, then press {fly} to land on it.'
	},
	shoot: {
		title: 'Ring shot',
		kilowog: "Your ring fires on its own. Point, shoot, and those targets go down. Doesn't cost you a thing.",
		how: 'Aim with the mouse and {shot} to fire. Knock down both targets.',
		touchHow: 'Hold {shot} to fire: the ring aims itself (or aim with your right thumb). Knock down both targets.',
		tip: 'Ring shots are free: use them all the time.'
	},
	construct: {
		title: 'Constructs',
		kilowog: "Here's the real power. You don't memorize anything: think it, and the ring builds what the fight needs.",
		how: '{construct} to make a construct. The ring picks: close up, far off, a crowd. Make 3.',
		tip: 'Hold it to keep going. Keys 1–0 pick one yourself if you ever want to.'
	},
	shieldSelf: {
		title: 'Shield',
		kilowog: "Can't win a fight flat on your back. Throw up a shield!",
		how: 'Press {shield} for a bubble shield.'
	},
	shieldPod: {
		title: 'Protect',
		kilowog: 'A Lantern protects others too. My drones are shooting at that supply pod. Same button: the ring puts the shield where it\'s needed.',
		how: 'Press {shield} while the drones fire. The bubble goes on the pod. Block a shot.',
		tip: 'It works on your partner and on things you escort, like a ship.'
	},
	recharge: {
		title: 'Recharge',
		kilowog: 'Constructs run on willpower, and yours is empty. Get to the Lantern and charge up!',
		how: 'Stand by the green Lantern until your willpower bar is full.',
		tip: 'The green bar is willpower. Ring shots never use it.'
	},
	signature: {
		title: 'Signature',
		kilowog: 'Fight hard and your surge fills up. Yours is full. Let it rip!',
		how: 'Press {signature} for {signatureName}.'
	},
	done: {
		title: 'Done',
		kilowog: "Not bad, poozer. Not bad at all. Now get out there. Tomar-Re's waiting on you.",
		how: 'Training complete!'
	}
};
