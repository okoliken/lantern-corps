// What every mission tells the mission page, so one page runs them all:
// the objective, a few meters, radio chatter, warnings, and the results.
// Each mission's rules live in its own director (safePassage.ts, ...).

import type { Director, Game } from '../game';

export type MissionState = 'intro' | 'playing' | 'won' | 'lost';

export interface MissionMeter {
	label: string;
	/** 0..1 */
	value: number;
	/** Shown at the end of the bar ("72%", "2:10"). */
	text: string;
	/** Turn it warning-coloured. */
	low?: boolean;
	/** Draw a marker riding the end of the fill (the ship crossing the belt). */
	marker?: string;
}

export interface MissionStat {
	label: string;
	value: string;
}

export interface MissionDirector extends Director {
	state: MissionState;
	/** Intro: seconds until it starts. Won: seconds since the win. */
	timer: number;
	lives: number;
	/** What to do right now, in a few words. */
	readonly objective: string;
	meters(): MissionMeter[];
	/** Something urgent to say across the middle of the screen, or null. */
	warning(game: Game): string | null;
	/** Radio chatter: who's talking and what they say, or null. */
	readonly line: CommsLine | null;
	/** 1 to 3 once won. */
	readonly stars: number;
	/** What each star is for. */
	readonly starHint: string;
	/** One line under the result: why it was won or lost. */
	readonly resultText: string;
	stats(): MissionStat[];
	/** A running count shown under the meters ("Asteroids blasted 12 / 100"). */
	tally?(): string;
}

/** Lines that can wait their turn before old ones get dropped. */
const MAX_WAITING = 2;

export interface CommsLine {
	who: string;
	text: string;
}

/**
 * Radio chatter during a mission: lines queue up and each shows long enough
 * to read. Directors call say(); the page shows `current`.
 */
export class Comms {
	current: CommsLine | null = null;
	private queue: CommsLine[] = [];
	private left = 0;

	/** Queue a line. `urgent` cuts in right away and drops anything still waiting ("It's a trap!"). */
	say(who: string, text: string, urgent = false) {
		if (urgent) {
			this.queue = [{ who, text }];
			this.next();
			return;
		}
		this.queue.push({ who, text });
		// Don't let chatter fall far behind what's happening
		if (this.queue.length > MAX_WAITING) this.queue.shift();
		if (!this.current) this.next();
	}

	update(dt: number) {
		if (!this.current) return;
		this.left -= dt;
		if (this.left <= 0) this.next();
	}

	/** A scripted conversation: replaces whatever's waiting, and every line gets its turn. */
	scene(lines: [who: string, text: string][]) {
		this.queue = lines.map(([who, text]) => ({ who, text }));
		this.next();
	}

	/** Drop anything still waiting (the mission ended). */
	clear() {
		this.queue = [];
		this.current = null;
	}

	private next() {
		this.current = this.queue.shift() ?? null;
		// Long enough to read: a couple of seconds plus a bit per word
		if (this.current) this.left = 2 + this.current.text.split(' ').length * 0.28;
	}
}
