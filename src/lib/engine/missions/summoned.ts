// Act 2, Mission 2: Summoned (the Trial on Oa).
//
// The ring has carried John Stewart to Oa. The Guardians want to see what it
// chose; Kilowog wants to see if he can fight.
//
//   kilowog   Kilowog tests the rookie, one on one, hammers and all
//   sinestro  Sinestro has seen enough ("Another Earthman"): he steps in and
//             comes at John for real, with Kilowog still swinging. Two on one,
//             and it's meant to be too much
//   together  Hal Jordan tags in: Earth's two Lanterns against the Corps' best
//   verdict   both yield. John reports the Manhunter he fought on Earth, and
//             the Guardians go very quiet. Kilowog sends him on his first call
//
// Lose: John goes down 3 times.

import { isStanding } from '../dummy';
import type { Enemy } from '../enemies/enemies';
import type { Game } from '../game';
import type { GameMap } from '../map';
import type { Player } from '../player';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

export type TrialPhase = 'kilowog' | 'sinestro' | 'together' | 'verdict';

const TRIAL_LIVES = 3;
const INTRO_TIME = 3;
/** Three stars: done within this many seconds. */
const PAR_TIME = 300;
/** How hard they hit, and how much they can take, on top of their base. */
const MIGHT = { kilowog: 2.4, sinestro: 3 };
const HEALTH = { kilowog: 4, sinestro: 4 };
/** Kilowog hurt this much (health left, 0..1), and Sinestro has seen enough. */
export const SINESTRO_STEPS_IN = 0.6;
/** Hal tags in after this long two on one, or sooner if John is hurt this badly (but never before MIN). */
export const HAL_AFTER = 22;
const HAL_MIN = 8;
const HAL_WHEN_HURT = 0.45;
/** The most one hit can take off a Lantern: hard, but never a one-shot. */
const MAX_HIT = 36;

const W = 2400;
const H = 1600;
const CENTER = { x: W / 2, y: H / 2 };

/** Oa's training ground: open, with the battery at the edge. */
export function buildTrialMap(): GameMap {
	return {
		name: 'Oa · The Training Ground',
		environment: 'planet',
		ground: 'oa',
		width: W,
		height: H,
		spawn: { x: CENTER.x - 320, y: CENTER.y },
		battery: { x: CENTER.x - 620, y: CENTER.y - 60 },
		dummies: [],
		obstacles: []
	};
}

export class SummonedTrial implements MissionDirector {
	state: MissionState = 'intro';
	phase: TrialPhase = 'kilowog';
	timer = INTRO_TIME;
	lives = TRIAL_LIVES;
	elapsed = 0;
	downs = 0;
	failReason: 'lantern' | null = null;
	readonly comms = new Comms();
	readonly starHint = '★ passed the trial · ★ no lives lost · ★ under 5 minutes';
	kilowog: Enemy | null = null;
	sinestro: Enemy | null = null;
	/** Hal, once he's tagged in. */
	hal: Player | null = null;
	private clock = 0;
	private wasDown = false;
	private said = new Set<string>();

	// ------------------------------------------------------------ reporting

	get objective(): string {
		switch (this.phase) {
			case 'kilowog':
				return "Show Kilowog what you've got";
			case 'sinestro':
				return 'Two on one: hold on';
			case 'together':
				return 'With Hal: make them both yield';
			case 'verdict':
				return 'The trial is over';
		}
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const list: MissionMeter[] = [];
		for (const [label, e] of [
			['Kilowog', this.kilowog],
			['Sinestro', this.sinestro]
		] as const) {
			if (e) list.push({ label, value: Math.max(0, e.hp / e.maxHp), text: isStanding(e) ? '' : 'Yields' });
		}
		return list;
	}

	warning(): string | null {
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.downs === 0 ? 1 : 0) + (this.elapsed <= PAR_TIME ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'won') return 'Kilowog passes him, Sinestro says nothing, and the Guardians will not talk about Manhunters. John has his first patrol.';
		return 'John went down one time too many. Kilowog will have him back at dawn.';
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		return [
			{ label: 'Lives lost', value: `${this.downs}` },
			{ label: 'Time', value: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
		];
	}

	goal(): { x: number; y: number } | null {
		if (this.phase === 'verdict') return null;
		// Whoever is still up, nearest first (so you can always find the fight)
		return [this.kilowog, this.sinestro].find((e) => e && isStanding(e)) ?? null;
	}

	// ---------------------------------------------------------------- rules

	update(game: Game, dt: number) {
		this.comms.update(dt);
		switch (this.state) {
			case 'intro':
				this.timer -= dt;
				if (this.timer <= 0) {
					this.state = 'playing';
					game.constructs.maxHit = MAX_HIT;
					this.kilowog = this.spawn(game, 'kilowog', CENTER.x + 300, CENTER.y);
					this.comms.scene([
						['Kilowog', "Rule one, poozer: I don't go easy. Rule two: see rule one."],
						['John', 'Wouldn\'t want you to.']
					]);
				}
				return;
			case 'won':
				this.timer += dt;
				return;
			case 'lost':
				for (const p of game.players) if (p.downed && p.slot === 0) p.downTimer = Math.max(p.downTimer, 1);
				return;
		}

		this.elapsed += dt;
		this.clock += dt;
		this.countDowns(game);
		if (this.state !== 'playing') return;
		const john = game.players[0];
		const k = this.kilowog!;
		// Whoever yields says so, over their head (the radio is for the conversation)
		const s = this.sinestro;
		if (!isStanding(k)) this.once('kdown', () => this.shout(game, k, 'OOF! ALRIGHT, YOU PASS!', 175));
		if (s && !isStanding(s)) this.once('sdown', () => this.shout(game, s, '...ADEQUATE.', 140));

		switch (this.phase) {
			case 'kilowog':
				if (k.hp <= k.maxHp * 0.8) this.once('k80', () => this.comms.say('Kilowog', "Not bad! You build 'em solid. Architect, huh?"));
				if (k.hp <= k.maxHp * SINESTRO_STEPS_IN) this.sinestroStepsIn(game);
				break;
			case 'sinestro':
				if (john.health < john.maxHealth * 0.6) this.once('taunt', () => this.comms.say('Sinestro', 'You hesitate. Fear. It will get you killed, and others with you.'));
				if (this.clock >= HAL_MIN && (this.clock >= HAL_AFTER || john.health < john.maxHealth * HAL_WHEN_HURT)) this.halTagsIn(game);
				break;
			case 'together':
				this.banter();
				if (!isStanding(k) && !isStanding(this.sinestro!)) this.verdict(game);
				break;
			case 'verdict':
				if (!this.comms.current) this.win(game);
				break;
		}
	}

	private spawn(game: Game, who: 'kilowog' | 'sinestro', x: number, y: number): Enemy {
		const e = game.spawnEnemy(who, x, y);
		e.brain.might = MIGHT[who];
		e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * HEALTH[who]);
		e.brain.alert = 10;
		return e;
	}

	/** "Enough." The greatest of the Green Lanterns has seen what he needs to, and doesn't like it. */
	private sinestroStepsIn(game: Game) {
		this.phase = 'sinestro';
		this.clock = 0;
		const john = game.players[0];
		const side = john.x < CENTER.x ? 1 : -1;
		this.sinestro = this.spawn(game, 'sinestro', john.x - side * 420, john.y - 120);
		this.comms.scene([
			['Sinestro', 'Enough, Kilowog. You are testing his constructs. I will test his will.'],
			['Sinestro', 'Another Earthman. The ring makes mistakes, Stewart. I intend to find out if you are one.'],
			['Kilowog', "Hey, this is MY drill! ...Ah, heck. Heads up, poozer, he don't pull punches!"]
		]);
	}

	/** Two on one isn't a trial, it's a beating. Hal evens it up. */
	private halTagsIn(game: Game) {
		this.phase = 'together';
		this.clock = 0;
		const john = game.players[0];
		this.hal = game.addPartner('hal', john.x - 260, john.y - 200);
		// Fresh for the fight
		john.health = Math.max(john.health, john.maxHealth * 0.7);
		game.constructs.effects.push({ kind: 'callout', x: this.hal.x, y: this.hal.y, age: 0, life: 1.8, text: 'HAL JORDAN', owner: this.hal });
		this.comms.scene([
			['Hal', 'Two on one? Not on my watch. Mind if I cut in?'],
			['Sinestro', 'Jordan. Of course. Earthmen do stick together.'],
			['John', 'I had them right where I wanted them.'],
			['Hal', "Sure you did. I'll take the angry one. You finish your drill sergeant."]
		]);
	}

	private banter() {
		const k = this.kilowog!;
		const s = this.sinestro!;
		if (s.hp <= s.maxHp * 0.5) this.once('s50', () => this.comms.say('Sinestro', 'You fight like soldiers, not Lanterns. ...It is not without merit.'));
		if (k.hp <= k.maxHp * 0.25) this.once('k25', () => this.comms.say('Kilowog', "Two Earth poozers. The universe ain't ready."));
		if (this.clock > 25) this.once('hal', () => this.comms.say('Hal', 'Nice wall. You always build like the city inspector is watching?'));
	}

	/** Both have yielded. John tells them what he fought on Earth. */
	private verdict(game: Game) {
		this.phase = 'verdict';
		for (const p of game.players) p.invuln = 99;
		this.comms.scene([
			['Kilowog', "He'll do. He'll more than do."],
			['Sinestro', 'He is undisciplined. But the ring did not choose badly. This time.'],
			['John', "Before anybody sends me anywhere: there's something you should know. On Earth, something came out of the ground. A machine. My ring called it a Manhunter."],
			['The Guardians', '...'],
			['The Guardians', 'That is not possible. This session is ended. Lantern Kilowog, see to his assignment.'],
			['Hal', "Did you see their faces? I've never seen them look like that."],
			['Kilowog', "Me neither, and I don't like it. C'mon, Stewart. Frontier's short a Lantern, and you just passed. First patrol."]
		]);
	}

	private shout(game: Game, e: Enemy, text: string, lift: number) {
		game.constructs.effects.push({ kind: 'callout', x: e.x, y: e.y - lift, age: 0, life: 2.4, text });
	}

	private once(key: string, run: () => void) {
		if (this.said.has(key)) return;
		this.said.add(key);
		run();
	}

	/** Each time John goes down costs a life; the last one ends the trial. */
	private countDowns(game: Game) {
		const john = game.players[0];
		if (john.downed && !this.wasDown) {
			this.lives--;
			this.downs++;
			if (this.lives <= 0) {
				this.state = 'lost';
				this.failReason = 'lantern';
				game.downedNotice = false;
				this.comms.clear();
			} else this.comms.say('Kilowog', 'On your feet, poozer! Out there, nobody lets you get up!');
		}
		this.wasDown = john.downed;
	}

	private win(game: Game) {
		this.state = 'won';
		this.timer = 0;
		for (const p of game.players) p.victoryTimer = 0.4;
	}
}
