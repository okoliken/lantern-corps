// Season Two, Act One, Mission One: the Watchtower.
//
// A training session, not a war. The League takes John one at a time in the
// ring in the middle of their training deck, with the Earth in the window,
// and they do not pull much. Nobody is trying to put him down for good: a
// bout ends when one of them has had enough, and the other three watch.
//
//   flash        keep up. He is in, he has hit you four times, and he is gone
//   superman     hold. Every punch is pulled, and every one still goes
//                through a wall
//   wonderwoman  no room. The lasso brings you to her, and the sword does
//                the rest
//   hawkgirl     shield up. She climbs, and comes down where you were
//
// A bout is won when they yield (a third of their health left), and it is
// lost when he hits the floor (a fifth of his). Nothing here kills anybody.

import { drawHero } from '../draw/heroes';
import { drawEarthWindow, drawRing, drawStation } from '../draw/watchtower';
import { HOVER_PLANET, type LanternPose } from '../draw/lantern';
import { isStanding } from '../dummy';
import { beginWindup, type Enemy, type EnemyKind } from '../enemies/enemies';
import { ABILITIES, type AbilityId } from '../enemies/redConstructs';
import type { Drawable, Game } from '../game';
import { heroFx } from '../heroes';
import { LANTERNS, type HeroId } from '../lanterns';
import type { GameMap } from '../map';
import type { Player } from '../player';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

export type Bout = 'flash' | 'superman' | 'wonderwoman' | 'hawkgirl' | 'done';
export const BOUTS: Exclude<Bout, 'done'>[] = ['flash', 'superman', 'wonderwoman', 'hawkgirl'];
/** Who fights, as an enemy, for each bout. */
const FIGHTER: Record<Exclude<Bout, 'done'>, EnemyKind> = { flash: 'flashSpar', superman: 'supermanSpar', wonderwoman: 'wonderwomanSpar', hawkgirl: 'hawkgirlSpar' };
const NAME: Record<Exclude<Bout, 'done'>, string> = { flash: 'The Flash', superman: 'Superman', wonderwoman: 'Wonder Woman', hawkgirl: 'Hawkgirl' };

const INTRO_TIME = 4;
/** Seconds between bouts, for whoever fought to say something. */
const HANDOVER = 3.6;
/** A bout is over when they have this much left; John hits the floor at this much. */
export const YIELD_AT = 0.34;
export const FLOOR_AT = 0.2;
/** How long a bout can go before they call it. */
export const BOUT_TIME = 75;
/** Three stars: all four bouts inside this. */
const PAR_TIME = 150;
/** How often they look for an opening when they are free (seconds). A pro does not wait to be asked. */
const INTENT_EVERY = 0.3;
/** How hard they hit, next to a Rage Grunt. Pulled, but not by much. */
const MIGHT: Record<Exclude<Bout, 'done'>, number> = { flash: 2.4, superman: 3.2, wonderwoman: 2.8, hawkgirl: 2.7 };

const W = 2600;
const H = 1300;
export const CENTRE = { x: W / 2, y: 760 };
/** The ring they fight in, and where the other three stand to watch. */
const RING = { rx: 620, ry: 380 };
const STATIONS: Record<Exclude<Bout, 'done'>, { x: number; y: number }> = {
	flash: { x: CENTRE.x - 900, y: CENTRE.y - 160 },
	superman: { x: CENTRE.x + 900, y: CENTRE.y - 160 },
	wonderwoman: { x: CENTRE.x + 900, y: CENTRE.y + 320 },
	hawkgirl: { x: CENTRE.x - 900, y: CENTRE.y + 320 }
};
/** The window along the top wall. */
/** The glass runs the whole top wall, floor to ceiling: the ring is at its foot, so the Earth is over every bout. */
const WINDOW = { x: 120, y: 30, w: W - 240, h: 690 };

/** The Watchtower's training deck: a wide floor, and no battery in orbit. */
export function buildWatchtowerMap(): GameMap {
	return {
		name: 'The Watchtower · training deck',
		environment: 'planet',
		ground: 'deck',
		width: W,
		height: H,
		spawn: { x: CENTRE.x, y: CENTRE.y + 180 },
		battery: { x: CENTRE.x, y: CENTRE.y },
		noBattery: true,
		dummies: [],
		obstacles: []
	};
}

interface Result {
	/** They yielded. */
	won: boolean;
	/** He went to the floor at least once. */
	floored: boolean;
	seconds: number;
}

export class Watchtower implements MissionDirector {
	state: MissionState = 'intro';
	timer = INTRO_TIME;
	lives = 3;
	bout: Bout = 'flash';
	elapsed = 0;
	/** Seconds into the bout in hand. */
	clock = 0;
	/** How each bout went. */
	readonly results: Partial<Record<Exclude<Bout, 'done'>, Result>> = {};
	/** The one in the ring with him right now. */
	fighter: Enemy | null = null;
	/** Times he hit the floor, all bouts. */
	floors = 0;
	private handover = 0;
	private intentIn = 0;
	private started = false;
	private flooredThisBout = false;
	private readonly said = new Set<string>();
	private readonly comms = new Comms();

	readonly starHint = '★ all four bouts · ★ never on the floor · ★ the whole session inside 2:30';

	get objective(): string {
		if (this.bout === 'done') return 'Session over';
		const who = NAME[this.bout];
		if (!this.fighter) return `${who} is stepping in`;
		switch (this.bout) {
			case 'flash':
				return `Keep up with ${who}: make him yield`;
			case 'superman':
				return `Hold against ${who}: make him yield`;
			case 'wonderwoman':
				return `No room to build: make ${who} yield`;
			case 'hawkgirl':
				return `Shield before she lands: make ${who} yield`;
		}
		return '';
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const list: MissionMeter[] = [];
		const f = this.fighter;
		if (f && this.bout !== 'done') {
			const share = f.hp / f.maxHp;
			list.push({ label: NAME[this.bout], value: share, text: share <= YIELD_AT + 0.02 ? 'Yielding' : `${Math.round(share * 100)}%`, low: share <= YIELD_AT + 0.08 });
			list.push({ label: 'Bout', value: 1 - this.clock / BOUT_TIME, text: `${Math.max(0, Math.ceil(BOUT_TIME - this.clock))}s`, low: BOUT_TIME - this.clock < 10 });
		}
		return list;
	}

	warning(game: Game): string | null {
		const me = game.players[0];
		if (this.fighter && me.health < me.maxHealth * (FLOOR_AT + 0.12)) return 'YOU ARE NEARLY ON THE FLOOR';
		if (this.bout === 'hawkgirl' && this.fighter?.brain.ability === 'maceDive' && this.fighter.brain.state !== 'recover') return 'SHE IS COMING DOWN: SHIELD';
		if (this.bout === 'superman' && this.fighter?.brain.ability === 'haymaker' && this.fighter.brain.state === 'windup') return 'HAYMAKER: GET OFF THE LINE';
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.floors === 0 ? 1 : 0) + (this.elapsed <= PAR_TIME ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'lost') return 'The session ran out. They will run it again: nobody on this deck is going anywhere.';
		if (this.floors === 0) return 'Four bouts, never on the floor. The League has seen enough.';
		return `Four bouts, and the floor ${this.floors === 1 ? 'once' : `${this.floors} times`}. Good enough for a first day.`;
	}

	stats(): MissionStat[] {
		const won = BOUTS.filter((b) => this.results[b]?.won).length;
		return [
			{ label: 'Made them yield', value: `${won} / ${BOUTS.length}` },
			{ label: 'On the floor', value: `${this.floors}` },
			{ label: 'Time', value: `${Math.floor(this.elapsed / 60)}:${String(Math.floor(this.elapsed % 60)).padStart(2, '0')}` }
		];
	}

	tally(): string {
		const won = BOUTS.filter((b) => this.results[b]?.won).length;
		return `Yielded ${won} · floor ${this.floors}`;
	}

	goal(): { x: number; y: number } | null {
		return this.fighter && isStanding(this.fighter) ? this.fighter : null;
	}

	update(game: Game, dt: number) {
		this.comms.update(dt);
		const me = game.players[0];

		if (this.state === 'intro') {
			if (!this.started) this.begin(game);
			this.timer -= dt;
			if (this.timer <= 0) {
				this.state = 'playing';
				this.startBout(game, 'flash');
			}
			return;
		}
		if (this.state !== 'playing') {
			this.timer += dt;
			me.invuln = Math.max(me.invuln, 0.5);
			return;
		}
		this.elapsed += dt;

		if (this.handover > 0) {
			this.handover -= dt;
			me.invuln = Math.max(me.invuln, 0.5);
			if (this.handover <= 0) {
				const next = BOUTS[BOUTS.indexOf(this.bout as Exclude<Bout, 'done'>) + 1];
				if (next) this.startBout(game, next);
				else this.finish();
			}
			return;
		}

		const f = this.fighter;
		if (!f || this.bout === 'done') return;
		const bout = this.bout;
		this.clock += dt;
		// They fight him, and nobody else
		f.brain.target = me;
		f.brain.directed = true;
		f.brain.alert = 10;
		this.intent(f, me, dt);

		// Nobody goes down on this deck. He hits the floor, and they let him up
		if (me.downed || me.health <= me.maxHealth * FLOOR_AT) {
			me.downed = false;
			me.downTimer = 0;
			me.health = Math.max(me.health, me.maxHealth * 0.5);
			me.invuln = 1.2;
			this.floors += 1;
			this.flooredThisBout = true;
			game.constructs.effects.push({ kind: 'callout', x: me.x, y: me.y - 120, age: 0, life: 1.6, text: 'FLOOR', hurt: true });
			this.once(`floor:${bout}`, () => this.comms.say(NAME[bout], FLOOR_LINE[bout], true));
		}
		// They yield with a third left; they do not go down either
		if (f.hp <= f.maxHp * YIELD_AT || !isStanding(f)) {
			this.endBout(game, true);
			return;
		}
		if (this.clock >= BOUT_TIME) {
			this.endBout(game, false);
			return;
		}
		if (f.hp <= f.maxHp * 0.62) this.once(`half:${bout}`, () => this.comms.say(NAME[bout], HALF_LINE[bout]));
	}

	/**
	 * A pro does not stand about waiting for a reaction timer. Whenever they
	 * are free and something in the kit is ready and in range, they use it,
	 * closing first when everything they have is a close move.
	 */
	private intent(f: Enemy, me: Player, dt: number) {
		const b = f.brain;
		this.intentIn -= dt;
		if (this.intentIn > 0 || (b.state !== 'move' && b.state !== 'idle') || me.downed) return;
		this.intentIn = INTENT_EVERY;
		const d = Math.hypot(me.x - f.x, me.y - f.y);
		const ready = b.kit.filter((id) => b.cooldowns[id] <= 0 && d >= ABILITIES[id].minRange && d <= ABILITIES[id].maxRange);
		if (ready.length === 0) return;
		// Prefer the move that fits the distance best: close moves up close, ranged ones from range
		const pick = (ids: AbilityId[]) => ids[Math.floor(Math.random() * ids.length)];
		const close = ready.filter((id) => ABILITIES[id].band === 'close');
		const chosen = d < 160 && close.length ? pick(close) : pick(ready);
		beginWindup(f, chosen, me);
	}

	/** The League is already on the deck, each at their station, when he arrives. */
	private begin(game: Game) {
		void game;
		this.started = true;
		this.comms.scene([
			['Superman', 'John. Welcome up. You have fought a war out there, so we are not going to insult you with target practice.'],
			['Wonder Woman', 'We are going to find out what you do when the thing in front of you is one of us.'],
			['The Flash', 'Starting with whether you can keep up. Which, no offence, nobody can.']
		]);
	}

	private startBout(game: Game, bout: Exclude<Bout, 'done'>) {
		this.bout = bout;
		this.clock = 0;
		this.flooredThisBout = false;
		const from = STATIONS[bout];
		const e = game.spawnEnemy(FIGHTER[bout], from.x, from.y);
		e.brain.might = MIGHT[bout];
		e.brain.directed = true;
		e.brain.target = game.players[0];
		e.brain.alert = 10;
		this.fighter = e;
		heroFx(game.constructs).push({ kind: 'zip', x: from.x, y: from.y, x2: CENTRE.x + (from.x < CENTRE.x ? -260 : 260), y2: CENTRE.y, age: 0, life: 0.4 });
		this.comms.scene(OPENING[bout]);
	}

	private endBout(game: Game, yielded: boolean) {
		const bout = this.bout as Exclude<Bout, 'done'>;
		const f = this.fighter;
		this.results[bout] = { won: yielded, floored: this.flooredThisBout, seconds: this.clock };
		if (f) {
			// Back to full and back to their station: nobody is hurt here
			f.hp = f.maxHp;
			f.brain.lastHp = f.hp;
			const at = game.dummies.indexOf(f);
			if (at >= 0) game.dummies.splice(at, 1);
			heroFx(game.constructs).push({ kind: 'zip', x: f.x, y: f.y, x2: STATIONS[bout].x, y2: STATIONS[bout].y, age: 0, life: 0.4 });
		}
		this.fighter = null;
		this.handover = HANDOVER;
		this.comms.scene(yielded ? YIELD_LINE[bout] : TIME_LINE[bout]);
	}

	private finish() {
		this.bout = 'done';
		this.state = 'won';
		this.timer = 0;
		this.comms.scene([
			['Superman', 'You did not ask us once what the enemy was. That is why we called you.'],
			['Wonder Woman', 'The ring is yours and the sector is yours. This is ours, and we would like you in it.'],
			['Superman', 'Take the comm. Use it when you want to, not when you are told to.']
		]);
	}

	private once(key: string, run: () => void) {
		if (this.said.has(key)) return;
		this.said.add(key);
		run();
	}

	// ---------------------------------------------------------------- drawing

	cameraPoints(): [number, number][] {
		const f = this.fighter;
		return f && isStanding(f) ? [[f.x, f.y]] : [];
	}

	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		const list: Drawable[] = [];
		// The window is the far wall: behind everything on the floor
		list.push({ baseY: -1e9, draw: () => drawEarthWindow(ctx, WINDOW.x, WINDOW.y, WINDOW.w, WINDOW.h, time) });
		list.push({ baseY: -1e8, draw: () => drawRing(ctx, CENTRE.x, CENTRE.y, RING.rx, RING.ry, this.fighter ? 1 : 0, time) });
		for (const who of BOUTS) {
			const s = STATIONS[who];
			const fighting = this.bout === who && this.fighter !== null;
			list.push({ baseY: s.y - 1, draw: () => drawStation(ctx, s.x, s.y, this.bout === who, time) });
			// The three not fighting watch from their stations
			if (fighting) continue;
			list.push({
				baseY: s.y,
				draw: () => {
					const bob = Math.sin(time * 1.4 + s.x) * 3;
					const dir = s.x < CENTRE.x ? 1 : -1;
					const flies = who !== 'flash';
					const pose: LanternPose = { dir, walkPhase: 0, altitude: flies ? 1 : 0, hoverHeight: flies ? HOVER_PLANET * 0.6 : 0, lean: 0, glow: false, shadow: true, firing: false, aimX: dir, aimY: 0 };
					drawHero(ctx, who as HeroId, LANTERNS[who].look, s.x, s.y + bob, pose, time);
				}
			});
		}
		return list;
	}
}

// ------------------------------------------------------------------- lines

const OPENING: Record<Exclude<Bout, 'done'>, [string, string][]> = {
	flash: [
		['The Flash', 'Rules. I hit you, you try to hit me back. That is the whole rule.'],
		['The Flash', 'Ready? You are not. Go.']
	],
	superman: [
		['Superman', 'I am going to pull every punch. Every one of them is still going to go through whatever you put up.'],
		['Superman', 'Get off the line when you see it coming. You will see it coming.']
	],
	wonderwoman: [
		['Wonder Woman', 'You build things at a distance. I am going to take the distance away.'],
		['Wonder Woman', 'If the lasso has you, it has you. Fight from where you land.']
	],
	hawkgirl: [
		['Hawkgirl', 'I am not throwing anything. I am coming down on you, and the mace does not care what you built.'],
		['Hawkgirl', 'Shield goes up BEFORE I land. After is a funeral.']
	]
};

const HALF_LINE: Record<Exclude<Bout, 'done'>, string> = {
	flash: 'Okay. Okay! You are actually landing some of those.',
	superman: 'Good. That one would have gone through a Manhunter.',
	wonderwoman: 'Better. You stopped looking for room and started using what you had.',
	hawkgirl: 'There it is. Shield first, then the answer.'
};

const FLOOR_LINE: Record<Exclude<Bout, 'done'>, string> = {
	flash: 'Up you get. I was going easy, for the record.',
	superman: "On your feet. That is why they are pulled.",
	wonderwoman: 'Up. The lasso does not let go because you fell.',
	hawkgirl: 'Get up. Shield BEFORE, not after.'
};

const YIELD_LINE: Record<Exclude<Bout, 'done'>, [string, string][]> = {
	flash: [
		['The Flash', 'Fine! Fine. I yield. Nobody keeps up with me and you did not either, but you kept close.'],
		['Superman', 'My turn.']
	],
	superman: [
		['Superman', 'That will do. You held against me longer than most of this League did on their first day.'],
		['Wonder Woman', 'Mine now.']
	],
	wonderwoman: [
		['Wonder Woman', 'Enough. You fought without room. That is the only kind of fight that matters.'],
		['Hawkgirl', 'My turn, and I am the one you have to watch.']
	],
	hawkgirl: [
		['Hawkgirl', 'Every landing. You have done this before.'],
		['Superman', 'That is the course.']
	]
};

const TIME_LINE: Record<Exclude<Bout, 'done'>, [string, string][]> = {
	flash: [
		['The Flash', 'Time. Do not take it personally, everyone is slow.'],
		['Superman', 'My turn.']
	],
	superman: [
		['Superman', 'Time. You held. That is the whole of what I wanted to see.'],
		['Wonder Woman', 'Mine now.']
	],
	wonderwoman: [
		['Wonder Woman', 'Time. You stayed standing with no room. That is the lesson.'],
		['Hawkgirl', 'My turn, and I am the one you have to watch.']
	],
	hawkgirl: [
		['Hawkgirl', 'Time. Most of them. Up here, most is a funeral.'],
		['Superman', 'That is the course.']
	]
};
