// Sparring · One on One.
//
// No missions, no stakes. Just you and the best in the universe. Every fight
// is 1v1, as Hal or John, and NOTHING is locked: pick anybody, any time, in
// any order. The tiers are how the roster is grouped, not a ladder.
//
// Each opponent tests one specific thing, and each one has a Survival School
// lesson as its answer. The game never tells you which.

import { isStanding } from '../dummy';
import { beginWindup, type Enemy, type EnemyKind } from '../enemies/enemies';
import { ABILITIES, type AbilityId } from '../enemies/redConstructs';
import type { Game } from '../game';
import type { GameMap } from '../map';
import type { Player } from '../player';
import type { LessonId } from './school';

export type SparState = 'intro' | 'fighting' | 'won' | 'lost';
export type TierId = 'corps' | 'league' | 'heavy' | 'rivals';

export interface Tier {
	id: TierId;
	name: string;
	blurb: string;
}

export interface Opponent {
	id: string;
	name: string;
	tier: TierId;
	/** What this fight tests, in the roster. */
	tests: string;
	/** The Survival School lesson that is the way through. Never shown in game. */
	key: LessonId | null;
	/** Who you actually fight. Null while the figure is still being drawn. */
	kind: EnemyKind | null;
	/**
	 * How hard they hit, next to a Rage Grunt, and how much they can take next
	 * to their base figure. This is EXPERIENCE: Sinestro has worn a ring longer
	 * than anyone, Hal longer than John, and it shows.
	 */
	might: number;
	health: number;
	/** What they shout when the fight starts, and when they beat you. */
	opening: string;
	over: string;
}

export const TIERS: Tier[] = [
	{ id: 'corps', name: 'The Corps', blurb: 'Rings like yours, in hands that have had them longer.' },
	{ id: 'league', name: 'The League', blurb: "Earth's finest, and not one of them fights the way you do." },
	{ id: 'heavy', name: 'Heavy Hitters', blurb: 'Constructs that hold against anyone else do not hold here.' },
	{ id: 'rivals', name: 'The Rivals', blurb: 'The two fights that are personal.' }
];

export const OPPONENTS: Opponent[] = [
	// ---- Tier 1: The Corps ----
	{
		id: 'arisia',
		name: 'Arisia',
		tier: 'corps',
		tests: 'Fast, light, relentless. Tests whether you can keep up with pure speed of construct creation.',
		key: 'empty',
		kind: 'sparArisia',
		might: 2.0,
		health: 2.4,
		opening: 'TRY AND KEEP UP!',
		over: 'TOO SLOW!'
	},
	{
		id: 'tomar',
		name: 'Tomar-Re',
		tier: 'corps',
		tests: 'Precise and analytical. He picks apart sloppy constructs and punishes every waste of charge.',
		key: 'empty',
		kind: null,
		might: 1,
		health: 1,
		opening: '',
		over: ''
	},
	{
		id: 'guy',
		name: 'Guy Gardner',
		tier: 'corps',
		tests: 'Loud, reckless, and nearly impossible to stagger. A brawl where tactics barely matter and grit decides it.',
		key: 'take-the-hit',
		kind: null,
		might: 1,
		health: 1,
		opening: '',
		over: ''
	},
	{
		id: 'kyle',
		name: 'Kyle Rayner',
		tier: 'corps',
		tests: "The most creative ring-wielder alive. His constructs are artistic, unpredictable, and weird. You can't pattern-match him.",
		key: 'fear',
		kind: null,
		might: 1,
		health: 1,
		opening: '',
		over: ''
	},

	// ---- Tier 2: The League ----
	{
		id: 'wonderwoman',
		name: 'Wonder Woman',
		tier: 'league',
		tests: 'Close-quarters fighting. She closes distance fast, so you have to fight without room to build.',
		key: 'shields',
		kind: null,
		might: 1,
		health: 1,
		opening: '',
		over: ''
	},
	{
		id: 'flash',
		name: 'Flash',
		tier: 'league',
		tests: "Speed. Build faster than he moves or don't build at all.",
		key: 'empty',
		kind: null,
		might: 1,
		health: 1,
		opening: '',
		over: ''
	},
	{
		id: 'aquaman',
		name: 'Aquaman',
		tier: 'league',
		tests: "Underwater arena. Constructs move differently, and he's at home where you aren't.",
		key: 'fear',
		kind: null,
		might: 1,
		health: 1,
		opening: '',
		over: ''
	},
	{
		id: 'jonn',
		name: 'Martian Manhunter',
		tier: 'league',
		tests: 'Shapeshifting and phasing. Your constructs pass right through him unless you time them perfectly.',
		key: 'fear',
		kind: null,
		might: 1,
		health: 1,
		opening: '',
		over: ''
	},
	{
		id: 'batman',
		name: 'Batman',
		tier: 'league',
		tests: "No powers, all preparation. Dampeners, traps, and fear toxin. He's the only fight where you're the one being studied.",
		key: 'fear',
		kind: null,
		might: 1,
		health: 1,
		opening: '',
		over: ''
	},

	// ---- Tier 3: Heavy Hitters ----
	{
		id: 'shazam',
		name: 'Shazam',
		tier: 'heavy',
		tests: 'Magic-based power. Your constructs react strangely to it, and he hits nearly as hard as Superman.',
		key: 'shields',
		kind: null,
		might: 1,
		health: 1,
		opening: '',
		over: ''
	},
	{
		id: 'superman',
		name: 'Superman',
		tier: 'heavy',
		tests: 'Raw strength. Constructs that hold against anyone else crack against him.',
		key: 'shields',
		kind: null,
		might: 1,
		health: 1,
		opening: '',
		over: ''
	},
	{
		id: 'lobo',
		name: 'Lobo',
		tier: 'heavy',
		tests: "Doesn't die, doesn't quit, doesn't fight fair. An endurance war with the galaxy's worst sparring partner.",
		key: 'take-the-hit',
		kind: null,
		might: 1,
		health: 1,
		opening: '',
		over: ''
	},

	// ---- Tier 4: The Rivals ----
	{
		id: 'sinestro',
		name: 'Sinestro',
		tier: 'rivals',
		tests: 'The best ring-wielder the Corps ever produced, and he knows every trick Kilowog and Katma taught you, because he taught half of them.',
		key: 'take-the-hit',
		kind: 'sinestro',
		might: 3.2,
		health: 3.6,
		opening: 'LET US SEE IF THE RING CHOSE WELL.',
		over: 'THE RING CHOSE POORLY.'
	},
	{
		id: 'mirror',
		name: 'Hal vs. John',
		tier: 'rivals',
		tests: 'Earth’s two Lanterns, head to head. Play as one, fight the other. Instinct against architecture.',
		key: 'shields',
		// Set per fight: you get whichever one you are not playing. Playing John,
		// you get Hal, and Hal has done this for longer (see MIRROR_MIGHT)
		kind: 'sparJohn',
		might: 2.4,
		health: 2.9,
		opening: 'NO RANK OUT HERE. JUST RINGS.',
		over: 'AGAIN. FROM THE TOP.'
	}
];

/** The extra Corps Lanterns you can call into the ring, beyond the listed roster. */
export const EXTRAS: Opponent[] = [
	{
		id: 'kilowog',
		name: 'Kilowog',
		tier: 'corps',
		tests: 'Your drill sergeant, on the other side of the ring for once. Hammers, and a great deal of shouting.',
		key: 'take-the-hit',
		kind: 'kilowog',
		might: 2.4,
		health: 3.0,
		opening: 'SHOW ME WHAT YOU GOT, POOZER!',
		over: 'GET UP! AGAIN!'
	},
	{
		id: 'katma',
		name: 'Katma Tui',
		tier: 'corps',
		tests: 'Your other teacher. She waits for you to commit, then puts a blade where you were going.',
		key: 'fear',
		kind: 'sparKatma',
		might: 2.6,
		health: 2.8,
		opening: 'SHOW ME WHAT YOU LEARNED.',
		over: 'YOU COMMITTED TOO EARLY.'
	},
	{
		id: 'boodikka',
		name: 'Boodikka',
		tier: 'corps',
		tests: 'A Bellatrix warrior who would rather hit you than out-think you.',
		key: 'take-the-hit',
		kind: 'sparBoodikka',
		might: 2.3,
		health: 2.9,
		opening: 'COME ON THEN.',
		over: 'STAY DOWN.'
	}
];

export const ROSTER = [...OPPONENTS, ...EXTRAS];
export const opponentById = (id: string) => ROSTER.find((o) => o.id === id);
/** Everyone you can actually fight today. */
export const isReady = (o: Opponent) => o.kind !== null;

const INTRO_TIME = 2.5;
/** Hal vs. John: Hal has had the ring longer, so as John you get the harder fight. */
const MIRROR_MIGHT: Record<'sparHal' | 'sparJohn', { might: number; health: number }> = { sparHal: { might: 2.8, health: 3.2 }, sparJohn: { might: 2.4, health: 2.9 } };
/** How often they look for an opening when free. A pro does not wait to be asked. */
const INTENT_EVERY = 0.3;
/** Standing on one spot this long (moving less than this far) is camping, and a pro comes and takes the spot. */
const CAMP_TIME = 3;
const CAMP_DRIFT = 90;

/** One fight, one opponent, nobody else in the ring. */
export class Sparring {
	state: SparState = 'intro';
	timer = INTRO_TIME;
	foe: Enemy | null = null;
	/** Seconds the fight took. */
	elapsed = 0;
	private said = new Set<string>();

	private intentIn = 0;
	private campAt = { x: 0, y: 0, t: 0 };
	/** Seconds they have been coming for a camper. */
	camping = 0;

	constructor(
		readonly opponent: Opponent,
		private readonly map: GameMap,
		/** The kind to spawn, if the fight picks it (Hal vs. John). */
		private readonly kind: EnemyKind
	) {
		// No battery in the ring. Sparring is you against them on the charge you walked in with:
		// standing next to a Lantern and blasting for free is not a fight
		map.noBattery = true;
	}

	/** 0..1 of the opponent's health left. */
	get health(): number {
		return this.foe ? Math.max(0, this.foe.hp / this.foe.maxHp) : 1;
	}

	get objective(): string {
		if (this.state === 'won') return `${this.opponent.name} yields.`;
		if (this.state === 'lost') return `${this.opponent.name} put you down.`;
		return `First one down loses.`;
	}

	update(game: Game, dt: number) {
		const me = game.players[0];
		const { x, y } = this.map.spawn;
		switch (this.state) {
			case 'intro':
				this.timer -= dt;
				if (this.timer <= 0) {
					this.spawn(game, x + 340, y);
					this.state = 'fighting';
					this.say(game, 'start', this.opponent.opening);
				}
				break;
			case 'fighting': {
				this.elapsed += dt;
				const foe = this.foe;
				if (foe && isStanding(foe) && !me.downed) this.intent(game, foe, me, dt);
				if (foe && !isStanding(foe)) {
					this.state = 'won';
					for (const p of game.players) p.victoryTimer = 0.4;
				} else if (me.downed) {
					this.state = 'lost';
					game.downedNotice = false;
					this.say(game, 'lost', this.opponent.over);
				}
				break;
			}
		}
		// Lost: stay down (no getting back up at the battery)
		if (this.state === 'lost') for (const p of game.players) if (p.downed) p.downTimer = Math.max(p.downTimer, 1);
	}

	private spawn(game: Game, x: number, y: number) {
		const e = game.spawnEnemy(this.kind, x, y);
		const exp = this.opponent.id === 'mirror' ? MIRROR_MIGHT[this.kind as 'sparHal' | 'sparJohn'] : this.opponent;
		e.brain.might = exp.might;
		e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * exp.health);
		e.brain.alert = 10;
		e.brain.directed = true;
		e.brain.target = game.players[0];
		this.foe = e;
		this.campAt = { x: game.players[0].x, y: game.players[0].y, t: 0 };
	}

	/**
	 * A pro does not stand about waiting for a reaction timer. Whenever they
	 * are free and something in the kit is ready and in range, they use it.
	 * And a pro who sees you parked on one spot comes and takes the spot:
	 * whatever closes the distance, first.
	 */
	private intent(game: Game, f: Enemy, me: Player, dt: number) {
		const b = f.brain;
		b.target = me;
		b.directed = true;
		// Camping: have they moved, lately?
		this.campAt.t += dt;
		if (Math.hypot(me.x - this.campAt.x, me.y - this.campAt.y) > CAMP_DRIFT) this.campAt = { x: me.x, y: me.y, t: 0 };
		const camping = this.campAt.t > CAMP_TIME;
		this.camping = camping ? this.camping + dt : 0;
		if (camping && this.camping < dt * 1.5) {
			game.constructs.effects.push({ kind: 'callout', x: f.x, y: f.y - 150, age: 0, life: 1.4, text: 'TAKE THE SPOT', hurt: true });
			b.goal = 'approach';
			b.goalTimer = 2;
		}
		this.intentIn -= dt;
		if (this.intentIn > 0 || (b.state !== 'move' && b.state !== 'idle')) return;
		this.intentIn = INTENT_EVERY;
		const d = Math.hypot(me.x - f.x, me.y - f.y);
		const ready = b.kit.filter((id) => b.cooldowns[id] <= 0 && d >= ABILITIES[id].minRange && d <= ABILITIES[id].maxRange);
		if (ready.length === 0) return;
		const pick = (ids: AbilityId[]) => ids[Math.floor(Math.random() * ids.length)];
		if (camping) {
			// Whatever reaches them and moves them: pulls, cages, charges, then the rest
			const grab = ready.filter((id) => id === 'chain' || id === 'cage' || id === 'charge' || id === 'sword' || id === 'bigFist');
			beginWindup(f, grab.length ? pick(grab) : pick(ready), me);
			return;
		}
		const close = ready.filter((id) => ABILITIES[id].band === 'close');
		beginWindup(f, d < 160 && close.length ? pick(close) : pick(ready), me);
	}

	/** A shout from them, once per moment. */
	private say(game: Game, id: string, text: string) {
		if (!text || this.said.has(id)) return;
		this.said.add(id);
		const e = this.foe;
		const x = e?.x ?? this.map.spawn.x;
		const y = e?.y ?? this.map.spawn.y;
		game.constructs.effects.push({ kind: 'callout', x, y: y - 160, age: 0, life: 2.4, text });
	}
}
