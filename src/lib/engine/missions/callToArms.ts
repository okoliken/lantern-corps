// Act 2, Mission 1: Call to Arms.
//
// The ring brings John Stewart, minutes into his first time in the uniform,
// down into Central City, where the Flash and Hawkgirl are fighting Gorilla
// Grodd's army. Grodd has torn open the street: something is buried under it.
//
//   arrival    Grodd's soldiers, already fighting the Flash and Hawkgirl; the
//              ring talks John through his first fight
//   flank      a second squad down the side streets, from above and below;
//              and Reverse-Flash, here for the Flash: the Flash takes him on
//              while John and Hawkgirl hold off Grodd's army (you can shoot
//              him, and shield the Flash). The two of them tear round each
//              other at full speed; Reverse-Flash has the upper hand, but with
//              his friends' help the Flash puts him down and hauls him off to
//              Iron Heights. If he's still up when Grodd escapes, he goes too
//   push       the main force up out of the dig, and troopers behind them
//   grodd      Grodd himself, in three stages:
//                1  Psychic Blast, Telekinetic Throw, and a gorilla's fists
//                2  (below 60%) + Mind Control and the Debris Storm, and he
//                   calls in more soldiers
//                3  (below 25%) enraged: faster and stronger
//              With little left he gets away, and wakes what he dug up
//   manhunter  a Manhunter android, asleep under the city since before
//              people. Break it and it falls apart round its core, then pulls
//              itself back together, stronger, unless the core is smashed
//              first. Hawkgirl's Nth metal mace is made for that
//   farewell   the Flash and Hawkgirl say their piece; the ring calls John to Oa
//
// Lose: John goes down 3 times.

import { LANTERNS } from '../lanterns';
import { drawReverseFlash } from '../draw/heroes';
import { heroFx } from '../heroes';
import { IDLE } from '../input';
import { green, greenCore } from '../../theme';
import type { Dummy } from '../dummy';
import { createDummy, isStanding } from '../dummy';
import { drawDigSite, drawLampPost, drawStreetTree } from '../draw/earth';
import { drawGorilla } from '../draw/gorillas';
import { CITY_BLOCK, ROAD_OFFSET, ROAD_WIDTH } from '../draw/world';
import { beginWindup, createEnemy, type Enemy, type EnemyKind } from '../enemies/enemies';
import type { AbilityId } from '../enemies/redConstructs';
import type { Drawable, Game } from '../game';
import { seededRandom, type GameMap, type Obstacle } from '../map';
import type { Player } from '../player';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

export type CallPhase = 'arrival' | 'flank' | 'push' | 'grodd' | 'escape' | 'awakening' | 'manhunter' | 'farewell';

export const CALL_LIVES = 3;
const INTRO_TIME = 3;
/** Three stars: done within this many seconds. */
const PAR_TIME = 540;
/** Grodd's soldiers: health and hitting power on top of their base. */
const TOUGHNESS = 3.6;
const MIGHT = 3.1;
/** The most one hit can take off anyone (about a quarter of John's health): hard, but never a one-shot. */
export const MAX_HIT = 34;
/** Grodd himself. */
export const GRODD_HEALTH = 4.5;
const GRODD_MIGHT = 2.9;
/** Health left (0..1) where Grodd's stages begin, and where he gets away. */
export const GRODD_STAGE_2 = 0.6;
export const GRODD_STAGE_3 = 0.25;
export const GRODD_ESCAPE = 0.12;
/** The Manhunter: health and might, and how its rebuilding works. */
const MANHUNTER_HEALTH = 3;
const MANHUNTER_MIGHT = 2.6;
/**
 * Seconds the core takes to rebuild the Manhunter, the first time and after
 * (the first is quick: you see it happen before you know to stop it), and the
 * core's health.
 */
export const REBUILD_TIMES = [4, 6.5, 8];
export const CORE_HP = 700;
/** The core's health after each rebuild, as a share of the last. */
const CORE_WEAR = 0.8;
/** A rebuilt Manhunter comes back with this share of its health, and stronger each time. */
export const REBUILT_HEALTH = 0.5;
const REBUILT_MIGHT = 1.15;
/** He turns on someone new every so often (seconds, plus up to SWITCH_SPREAD more). */
const SWITCH_EVERY = 4.5;
const SWITCH_SPREAD = 2.5;
/** Reverse-Flash: health and might on top of his base, and where he's beaten. */
const RF_HEALTH = 4.5;
const RF_MIGHT = 1.8;
export const RF_DEFEATED = 0.08;
/** How fast the two speedsters circle each other (radians per second), and the Flash's pace while they do. */
const DUEL_SPIN = 2.6;
const DUEL_SPEED = 720;
/** Seconds Reverse-Flash lies knocked out before the Flash runs him off to Iron Heights. */
const KO_TIME = 2.5;

/** Seconds between Grodd getting away and the Manhunter standing up. */
const AWAKEN_TIME = 4;
/** Seconds John rises into the sky at the end. */
const LIFT_TIME = 2.6;

const W = 3500;
const H = 2100;
/** John comes down here. */
const ENTRY = { x: 640, y: 1050 };
/** Grodd's dig: the junction he tore open. */
export const DIG = { x: 2450, y: 1050 };

type Wave = [EnemyKind, number, number][];
/** Already fighting the Flash and Hawkgirl when John arrives. */
const ARRIVAL: Wave = [
	['gorillaBrute', 1450, 900],
	['gorillaBrute', 1550, 1180],
	['gorillaBrute', 1700, 1000],
	['gorillaGunner', 1850, 1100],
	['gorillaGunner', 1800, 850]
];
/** Down the side streets, from the top and the bottom of the map. */
const FLANK: Wave = [
	['gorillaBrute', 1250, 380],
	['gorillaBrute', 1500, 350],
	['gorillaGunner', 1750, 400],
	['gorillaBrute', 1300, 1750],
	['gorillaBrute', 1550, 1780],
	['gorillaGunner', 1800, 1720],
	['gorillaGunner', 2000, 1050]
];
/** Troopers who come up behind the push once it's half beaten. */
const PUSH_REAR: Wave = [
	['gorillaGunner', 2750, 850],
	['gorillaGunner', 2800, 1250],
	['gorillaBrute', 2900, 1050],
	['gorillaGunner', 2650, 1400]
];
/** Up out of the dig. */
const PUSH: Wave = [
	['gorillaBrute', 2250, 950],
	['gorillaBrute', 2300, 1180],
	['gorillaBrute', 2600, 1150],
	['gorillaGunner', 2650, 900],
	['gorillaGunner', 2550, 1300],
	['gorillaGunner', 2700, 1050],
	['gorillaBrute', 2450, 1320]
];
/** With Grodd when he comes up. */
const GUARDS: Wave = [
	['gorillaBrute', 2300, 900],
	['gorillaBrute', 2350, 1220]
];
/** Called in when Grodd is hurt: in from the edge of the city. */
const REINFORCEMENTS: Wave = [
	['gorillaBrute', 3300, 950],
	['gorillaBrute', 3300, 1150],
	['gorillaBrute', 3250, 1350],
	['gorillaGunner', 3400, 1050],
	['gorillaGunner', 3350, 800],
	['gorillaGunner', 3350, 1300]
];

/** Grodd's kit in each stage: it only grows. */
const KITS: Record<1 | 2 | 3, AbilityId[]> = {
	1: ['tkGrip', 'mindLock', 'mindBlast', 'carThrow', 'claws', 'slam', 'charge', 'roar'],
	2: ['tkGrip', 'mindLock', 'mindBlast', 'carThrow', 'claws', 'slam', 'charge', 'roar', 'debrisStorm'],
	3: ['tkGrip', 'mindLock', 'mindBlast', 'carThrow', 'claws', 'slam', 'charge', 'roar', 'debrisStorm']
};

/** Where the roads run (the ground draws them the same way). */
const roadsAlong = (length: number) => {
	const list: number[] = [];
	for (let r = ROAD_OFFSET; r < length; r += CITY_BLOCK) list.push(r);
	return list;
};

/**
 * Central City: a grid of streets; tall buildings along the top and bottom
 * edges, open plazas in between, cars parked along the roads.
 */
export function buildCentralCityMap(): GameMap {
	const rand = seededRandom(1956);
	const obstacles: Obstacle[] = [];
	const columns = roadsAlong(W);
	const rows = roadsAlong(H);
	// The stretches of sidewalk between the roads running down the map
	const spans: [number, number][] = [];
	let from = 0;
	for (const x of columns) {
		if (x - from > 60) spans.push([from + 12, x - 18]);
		from = x + ROAD_WIDTH + 18;
	}
	if (W - from > 60) spans.push([from, W - 12]);
	// Skyscrapers along the top and bottom: the edge of the fight
	const lastRow = rows[rows.length - 1] + ROAD_WIDTH;
	for (const [a, b] of spans) {
		let x = a;
		while (b - x > 120) {
			const w = Math.min(b - x, 180 + rand() * 170);
			obstacles.push({ kind: 'building', x, y: 20, w, h: ROAD_OFFSET - 45, height: 230 + rand() * 170, blocksFlying: true, seed: rand() });
			if (lastRow + 40 < H - 60) obstacles.push({ kind: 'building', x, y: lastRow + 25, w, h: H - lastRow - 45, height: 150 + rand() * 120, blocksFlying: true, seed: rand() });
			x += w + 16;
		}
	}
	// Cars parked along the kerbs, never in the dig
	for (const y of rows) {
		for (let x = 120; x < W - 120; x += 150 + rand() * 260) {
			if (columns.some((c) => x > c - 60 && x < c + ROAD_WIDTH + 60)) continue;
			if (Math.abs(x - DIG.x) < 260 && Math.abs(y + ROAD_WIDTH / 2 - DIG.y) < 200) continue;
			const side = rand() < 0.5 ? y + 14 : y + ROAD_WIDTH - 40;
			obstacles.push({ kind: 'car', x, y: side, w: 70, h: 26, height: 34, blocksFlying: false, seed: rand(), hp: 150, maxHp: 150 });
		}
	}
	return {
		name: 'Central City',
		environment: 'planet',
		ground: 'street',
		width: W,
		height: H,
		spawn: ENTRY,
		battery: ENTRY,
		// John has no battery yet: his ring came to him on its own
		noBattery: true,
		dummies: [],
		obstacles
	};
}

export class CallToArms implements MissionDirector {
	state: MissionState = 'intro';
	phase: CallPhase = 'arrival';
	/** 1-3 while Grodd fights. */
	stage: 1 | 2 | 3 = 1;
	timer = INTRO_TIME;
	lives = CALL_LIVES;
	elapsed = 0;
	downs = 0;
	defeated = 0;
	/** Times the Manhunter pulled itself back together. */
	rebuilds = 0;
	failReason: 'lantern' | null = null;
	readonly comms = new Comms();
	readonly starHint = '★ the Manhunter destroyed · ★ no lives lost · ★ under 9 minutes';
	grodd: Enemy | null = null;
	/** Reverse-Flash, while he's here. */
	reverseFlash: Enemy | null = null;
	/** Knocked out: where he lies, and for how long before the Flash takes him away. */
	private knockedOut: { e: Enemy; x: number; y: number; time: number } | null = null;
	manhunter: Enemy | null = null;
	/** The Manhunter's core, while it lies in pieces. */
	core: Dummy | null = null;
	private wave: Enemy[] = [];
	/** The push up out of the dig, and whether the troopers behind it have come. */
	private pushed: Enemy[] = [];
	private rearGuard = false;
	private counted = new WeakSet<Enemy>();
	private wasDown = false;
	private clock = 0;
	private switchIn = SWITCH_EVERY;
	private taunts = 0;
	private lockedFlash = false;
	private hints = { construct: false, shield: false, core: false };
	/** Grodd leaping away (drawn), from where. */
	private escapeFrom = { x: DIG.x, y: DIG.y };
	private escapeFigure = createEnemy('grodd', DIG.x, DIG.y);
	private decor: Drawable[] | null = null;
	private liftFrom = { x: 0, y: 0 };
	/** John, once the ring is calling him (for drawing his ascent). */
	private john: Player | null = null;

	// ------------------------------------------------------------ reporting

	get objective(): string {
		switch (this.phase) {
			case 'arrival':
				return 'Help the Flash and Hawkgirl';
			case 'flank':
				return "They're coming down the side streets";
			case 'push':
				return "Stop Grodd's army";
			case 'grodd':
				return this.stage === 3 ? 'Grodd is enraged: finish it' : 'Defeat Gorilla Grodd';
			case 'escape':
				return 'Grodd is getting away';
			case 'awakening':
				return 'Something is waking up';
			case 'manhunter':
				return this.core ? 'Smash the core before it rebuilds!' : 'Destroy the Manhunter';
			case 'farewell':
				return 'The ring is calling';
		}
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		if (this.phase === 'grodd' && this.grodd) {
			const g = this.grodd;
			return [{ label: 'Grodd', value: g.hp / g.maxHp, text: this.stage === 3 ? 'Enraged' : `Stage ${this.stage}`, low: this.stage === 3 }];
		}
		if (this.phase === 'manhunter') {
			if (this.core) {
				const left = Math.max(0, 1 - (this.core.rebuild ?? 0));
				return [
					{ label: 'Core', value: this.core.hp / this.core.maxHp, text: `${Math.ceil(left * this.rebuildTime)}s`, low: true },
					{ label: 'Rebuilt', value: this.core.rebuild ?? 0, text: `${Math.round((this.core.rebuild ?? 0) * 100)}%` }
				];
			}
			const m = this.manhunter;
			if (m) return [{ label: 'Manhunter', value: m.hp / m.maxHp, text: this.rebuilds ? `Rebuilt ×${this.rebuilds}` : '' }];
		}
		const left = this.wave.filter(isStanding).length;
		if (left > 0) return [{ label: 'Gorillas', value: left / Math.max(1, this.wave.length), text: `${left} left` }];
		return [];
	}

	warning(): string | null {
		if (this.core && (this.core.rebuild ?? 0) > 0.6) return 'IT’S REBUILDING: SMASH THE CORE';
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.downs === 0 ? 1 : 0) + (this.elapsed <= PAR_TIME ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'won') return 'Central City is safe, and the ring is taking John to Oa. Grodd got away, and so did whatever else is sleeping down there.';
		return 'John went down one time too many.';
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		return [
			{ label: 'Gorillas beaten', value: `${this.defeated}` },
			{ label: 'Manhunter rebuilds', value: `${this.rebuilds}` },
			{ label: 'Lives lost', value: `${this.downs}` },
			{ label: 'Time', value: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
		];
	}

	goal(): { x: number; y: number } | null {
		if (this.core) return this.core;
		if (this.phase === 'push' || this.phase === 'awakening') return DIG;
		// The big one, wherever the fight has taken him
		if (this.phase === 'grodd' && this.grodd) return this.grodd;
		if (this.phase === 'manhunter' && this.manhunter) return this.manhunter;
		return null;
	}

	// ---------------------------------------------------------------- rules

	update(game: Game, dt: number) {
		this.comms.update(dt);
		this.countDefeats();

		switch (this.state) {
			case 'intro':
				this.timer -= dt;
				if (this.timer <= 0) {
					this.state = 'playing';
					game.constructs.maxHit = MAX_HIT;
					this.spawn(game, ARRIVAL);
					this.comms.scene([
						['The Flash', 'Whoa! A Green Lantern? I thought you guys only came in the one flavor!'],
						['Hawkgirl', 'Less talking, more hitting. Lantern, the big ones punch hard. Keep moving.'],
						['The ring', 'Your will becomes light, John Stewart. Aim, and it will strike.']
					]);
				}
				return;
			case 'won':
				this.timer += dt;
				this.hold(game);
				return;
			case 'lost':
				for (const p of game.players) if (p.downed && p.slot === 0) p.downTimer = Math.max(p.downTimer, 1);
				return;
		}

		this.elapsed += dt;
		this.clock += dt;
		this.countDowns(game);
		if (this.state !== 'playing') return;
		this.hint(game);
		this.rivalry(game, dt);

		switch (this.phase) {
			case 'arrival':
				if (this.wave.filter(isStanding).length <= 1) {
					this.phase = 'flank';
					this.spawn(game, FLANK, true);
					this.reverseFlashArrives(game);
				}
				break;
			case 'flank':
				if (this.wave.filter(isStanding).length <= 1) {
					this.phase = 'push';
					this.pushed = this.spawn(game, PUSH, true);
					this.comms.scene([
						['Hawkgirl', "More of them, up out of that hole. Grodd's digging for something."],
						['The Flash', "Whatever it is, I'm guessing we don't want him to find it."]
					]);
				}
				break;
			case 'push':
				// Half of them down, and the troopers behind them come up
				if (!this.rearGuard && this.pushed.filter(isStanding).length <= this.pushed.length / 2) {
					this.rearGuard = true;
					this.spawn(game, PUSH_REAR, true);
					this.comms.say('Hawkgirl', 'Troopers, behind the dig! Watch for their mortars!');
				}
				if (this.rearGuard && this.wave.every((e) => !isStanding(e))) this.groddArrives(game);
				break;
			case 'grodd':
				this.duel(game, dt);
				break;
			case 'escape':
				if (this.clock >= 2) {
					this.phase = 'awakening';
					this.clock = 0;
					this.comms.scene([
						['The ring', 'Warning. Manhunter signature detected.'],
						['Hawkgirl', "Manhunter? On Thanagar we have stories about those. None of them end well."],
						['John', "Then let's give this one a better ending."]
					]);
				}
				break;
			case 'awakening':
				if (this.clock >= AWAKEN_TIME) this.manhunterRises(game);
				break;
			case 'manhunter':
				this.fightManhunter(game, dt);
				break;
			case 'farewell':
				this.farewell(game);
				break;
		}
	}

	/** A red and gold blur down the street: he's come for the Flash. */
	private reverseFlashArrives(game: Game) {
		const flash = game.players.find((p) => p.def.id === 'flash');
		const at = flash ? { x: Math.min(W - 200, flash.x + 500), y: flash.y } : { x: 2200, y: 1050 };
		const rf = game.spawnEnemy('reverseFlash', at.x, at.y);
		rf.hp = rf.maxHp = rf.brain.lastHp = Math.round(rf.maxHp * RF_HEALTH);
		rf.brain.might = RF_MIGHT;
		rf.brain.grit = TOUGHNESS;
		rf.brain.directed = true;
		rf.brain.alert = 10;
		if (flash) {
			rf.brain.target = flash;
			// Two speedsters: the Flash runs at his real pace for this one
			flash.def = { ...flash.def, maxSpeed: DUEL_SPEED, accel: 6000, decel: 6000 };
		}
		this.reverseFlash = rf;
		this.comms.scene([
			['Reverse-Flash', 'Hello, Flash. Did you miss me?'],
			['The Flash', "Thawne. Of course Grodd brought you. Guys, he's mine."],
			['Hawkgirl', 'Then we take the apes. Lantern, cover him when you can.']
		]);
	}

	/**
	 * Reverse-Flash only wants the Flash; anyone else is just in the way. The
	 * two of them race round and round each other. Beaten, he's knocked out.
	 */
	private rivalry(game: Game, dt: number) {
		this.carryOff(game, dt);
		const rf = this.reverseFlash;
		if (!rf) return;
		if (!isStanding(rf) || rf.hp <= rf.maxHp * RF_DEFEATED) {
			this.reverseFlashBeaten(game);
			return;
		}
		const b = rf.brain;
		// Round and round at full speed, never standing still
		if (b.state === 'move' || b.state === 'idle') b.orbit += DUEL_SPIN * b.strafe * dt;
		const up = game.players.filter((p) => !p.downed && !p.boarded);
		const flash = up.find((p) => p.def.id === 'flash');
		if (flash) b.target = flash;
		else if (!b.target || b.target.downed) b.target = up.reduce<Player | null>((best, p) => (!best || Math.hypot(p.x - rf.x, p.y - rf.y) < Math.hypot(best.x - rf.x, best.y - rf.y) ? p : best), null);
	}

	/** Down and out: he lies there a moment, then the Flash runs him off to Iron Heights. */
	private reverseFlashBeaten(game: Game) {
		const rf = this.reverseFlash!;
		this.reverseFlash = null;
		const i = game.dummies.indexOf(rf);
		if (i >= 0) game.dummies.splice(i, 1);
		rf.hp = 0;
		rf.down = 99;
		this.knockedOut = { e: rf, x: rf.x, y: rf.y, time: KO_TIME };
		this.restoreFlash(game);
		game.constructs.effects.push({ kind: 'callout', x: rf.x, y: rf.y - 120, age: 0, life: 1.8, text: 'REVERSE-FLASH DEFEATED' });
		this.comms.scene([
			['Reverse-Flash', 'No... not like this. Not by you, Barry.'],
			['The Flash', "Not by me. By us. Thanks for the assist, guys. I'll run him to Iron Heights: back in a flash."]
		]);
	}

	/** The Flash runs the knocked-out Reverse-Flash off to prison (a blur, and he's gone). */
	private carryOff(game: Game, dt: number) {
		const ko = this.knockedOut;
		if (!ko) return;
		ko.time -= dt;
		if (ko.time > 0) return;
		const flash = game.players.find((p) => p.def.id === 'flash');
		heroFx(game.constructs).push({ kind: 'zip', x: flash?.x ?? ko.x, y: flash?.y ?? ko.y, x2: ko.x, y2: ko.y, age: 0, life: 0.3 });
		heroFx(game.constructs).push({ kind: 'zip', x: ko.x, y: ko.y, x2: ko.x - 1200, y2: ko.y + 200, age: 0, life: 0.4 });
		this.knockedOut = null;
	}

	/** Back to his usual pace once the duel's over. */
	private restoreFlash(game: Game) {
		const flash = game.players.find((p) => p.def.id === 'flash');
		if (flash) flash.def = LANTERNS.flash;
	}

	/** Gone in a streak of red lightning. */
	private reverseFlashRuns(game: Game, line: string | null) {
		const rf = this.reverseFlash;
		if (!rf) return;
		this.reverseFlash = null;
		this.restoreFlash(game);
		const i = game.dummies.indexOf(rf);
		if (i >= 0) game.dummies.splice(i, 1);
		heroFx(game.constructs).push({ kind: 'zip', x: rf.x, y: rf.y, x2: rf.x + 900, y2: rf.y - 300, age: 0, life: 0.5, red: true });
		game.constructs.effects.push({ kind: 'callout', x: rf.x, y: rf.y - 120, age: 0, life: 1.6, text: 'REVERSE-FLASH FLEES', hurt: true });
		if (line)
			this.comms.scene([
				['Reverse-Flash', line],
				['The Flash', 'Yeah, yeah. Run.']
			]);
	}

	private spawn(game: Game, wave: Wave, fromDig = false) {
		const list = wave.map(([kind, x, y]) => {
			const e = game.spawnEnemy(kind, x, y);
			e.brain.grit = TOUGHNESS;
			e.brain.might = MIGHT;
			e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * TOUGHNESS);
			// Up out of the dig: they come straight for the fight
			if (fromDig) e.brain.alert = 10;
			return e;
		});
		this.wave = [...this.wave.filter(isStanding), ...list];
		return list;
	}

	/** Up out of the dig, with his guards. */
	private groddArrives(game: Game) {
		this.phase = 'grodd';
		this.stage = 1;
		this.clock = 0;
		this.spawn(game, GUARDS, true);
		const g = game.spawnEnemy('grodd', DIG.x + 60, DIG.y - 20);
		g.hp = g.maxHp = g.brain.lastHp = Math.round(g.maxHp * GRODD_HEALTH);
		g.brain.might = GRODD_MIGHT;
		g.brain.grit = TOUGHNESS;
		g.brain.kit = [...KITS[1]];
		g.brain.directed = true;
		g.brain.alert = 10;
		this.grodd = g;
		this.comms.scene([
			['Grodd', 'The Flash, the bird, and... a new pet. How quaint.'],
			['The Flash', "Grodd. Heads up, rookie: he's a telepath. Don't let him in your head."],
			['Grodd', 'Too late for that, little man.']
		]);
	}

	private duel(game: Game, dt: number) {
		const g = this.grodd!;
		const hp = g.hp / g.maxHp;
		// Beaten, but not caught: he gets away through the dig
		if (hp <= GRODD_ESCAPE || !isStanding(g)) {
			this.escape(game, g);
			return;
		}
		this.intent(game, g, dt);
		if (this.stage === 1 && hp <= GRODD_STAGE_2) {
			this.stage = 2;
			g.brain.kit = [...KITS[2]];
			for (const id of KITS[2]) g.brain.cooldowns[id] = Math.min(g.brain.cooldowns[id], 0.8);
			this.spawn(game, REINFORCEMENTS, true);
			game.constructs.effects.push({ kind: 'callout', x: g.x, y: g.y - 180, age: 0, life: 1.8, text: 'TO ME!', hurt: true });
			this.comms.scene([
				['Grodd', 'Enough. Gorilla City, to me!'],
				['Hawkgirl', "Reinforcements! Lantern, don't let him get behind your eyes. When he glows, move."]
			]);
		}
		if (this.stage === 2 && hp <= GRODD_STAGE_3) {
			this.stage = 3;
			g.brain.kit = [...KITS[3]];
			g.brain.might *= 1.2;
			g.brain.speedMul *= 1.2;
			for (const id of KITS[3]) g.brain.cooldowns[id] = Math.min(g.brain.cooldowns[id], 0.6);
			game.constructs.effects.push({ kind: 'callout', x: g.x, y: g.y - 180, age: 0, life: 2, text: 'ENRAGED', hurt: true });
			this.comms.say('Grodd', 'You DARE? I will pull your minds out through your ears!', true);
		}
	}

	/**
	 * Grodd fights with intent, like Razer: he picks on everyone in turn (the
	 * Flash and Hawkgirl too), opens with a psychic blast or a thrown car, and
	 * blasts anyone who crowds him. Once in stage 2, he takes the Flash's mind.
	 */
	private intent(game: Game, g: Enemy, dt: number) {
		const b = g.brain;
		const up = game.players.filter((p) => !p.downed && !p.boarded);
		if (up.length === 0 || !isStanding(g)) return;
		const free = b.state === 'move' || b.state === 'idle';
		const ready = (id: AbilityId) => b.kit.includes(id) && b.cooldowns[id] <= 0;
		const dist = (p: { x: number; y: number }) => Math.hypot(p.x - g.x, p.y - g.y);

		// Crowded: blast them all back
		const close = up.filter((p) => dist(p) < 200);
		if (free && close.length >= 2 && ready('mindBlast')) {
			beginWindup(g, 'mindBlast', close[0]);
			return;
		}

		// The Flash is too fast to hit, so Grodd goes for his mind instead (again, if he's knocked out of it)
		const flash = up.find((p) => p.def.id === 'flash');
		if (flash && flash.confused > 0 && !this.lockedFlash) {
			this.lockedFlash = true;
			if (!b.kit.includes('mindLock')) b.kit.push('mindLock');
			this.comms.scene([
				['Grodd', 'All that speed, Flash, and your mind is still so slow.'],
				['Hawkgirl', "He's got the Flash! Keep Grodd busy till he shakes it off!"]
			]);
		}
		if (free && this.stage >= 2 && !this.lockedFlash && flash && b.cooldowns.mindLock <= 0 && dist(flash) < 600) {
			b.target = flash;
			beginWindup(g, 'mindLock', flash);
			return;
		}

		this.switchIn -= dt;
		if (this.switchIn <= 0 && free && up.length > 1) {
			this.switchIn = SWITCH_EVERY + Math.random() * SWITCH_SPREAD;
			const others = up.filter((p) => p !== b.target);
			// Mostly John (the new one interests him), sometimes the others
			const next = others.find((p) => p.slot === 0 && Math.random() < 0.6) ?? others[Math.floor(Math.random() * others.length)] ?? up[0];
			b.target = next;
			b.engaged = false;
			b.focusTime = 0;
			const d = dist(next);
			// His mind first: grab them, get in their head, or throw something at them
			const opener: AbilityId | null =
				ready('tkGrip') && d < 600 ? 'tkGrip' : ready('mindLock') && d < 580 ? 'mindLock' : ready('carThrow') && d > 180 ? 'carThrow' : ready('mindBlast') && d < 420 ? 'mindBlast' : null;
			if (opener) beginWindup(g, opener, next);
			if (this.taunts++ % 2 === 0) this.comms.say('Grodd', TAUNTS[next.def.id] ?? 'Next.', true);
		}
	}

	/** He gets away: a great leap out of the fight, and the relic he leaves behind wakes. */
	private escape(game: Game, g: Enemy) {
		this.phase = 'escape';
		this.clock = 0;
		this.escapeFrom = { x: g.x, y: g.y };
		const i = game.dummies.indexOf(g);
		if (i >= 0) game.dummies.splice(i, 1);
		game.constructs.red.shots = game.constructs.red.shots.filter((s) => s.owner !== g);
		game.constructs.red.strikes = [];
		for (const e of this.wave) {
			// His soldiers go with him
			if (!isStanding(e)) continue;
			const j = game.dummies.indexOf(e);
			if (j >= 0) game.dummies.splice(j, 1);
			game.constructs.effects.push({ kind: 'fizzle', x: e.x, y: e.y - 30, age: 0, life: 0.5 });
		}
		this.wave = [];
		game.constructs.effects.push({ kind: 'callout', x: g.x, y: g.y - 180, age: 0, life: 2, text: 'GRODD ESCAPES', hurt: true });
		// If Reverse-Flash is still here, he goes too
		const rfLeaves = this.reverseFlash !== null;
		if (rfLeaves) this.reverseFlashRuns(game, null);
		this.comms.scene([
			['Grodd', "Keep the city. I have what I came for: I've woken it. Let's see how you like it."],
			...(rfLeaves ? [['Reverse-Flash', 'Another time, Flash. I have all the time in the world.'] as [string, string]] : []),
			['The Flash', 'He\'s gone. What did he mean, "woken it"?']
		]);
	}

	/** Up out of the dig: a Manhunter. */
	private manhunterRises(game: Game) {
		this.phase = 'manhunter';
		this.clock = 0;
		this.manhunter = this.spawnManhunter(game, DIG.x, DIG.y + 20, 1, 1);
	}

	private get rebuildTime(): number {
		return REBUILD_TIMES[Math.min(this.rebuilds, REBUILD_TIMES.length - 1)];
	}

	private spawnManhunter(game: Game, x: number, y: number, health: number, might: number): Enemy {
		const m = game.spawnEnemy('manhunter', x, y);
		m.maxHp = m.brain.lastHp = Math.round(m.maxHp * MANHUNTER_HEALTH);
		m.hp = Math.round(m.maxHp * health);
		m.brain.lastHp = m.hp;
		m.brain.might = MANHUNTER_MIGHT * might;
		m.brain.grit = TOUGHNESS;
		m.brain.alert = 10;
		return m;
	}

	private fightManhunter(game: Game, dt: number) {
		const m = this.manhunter;
		if (m && !isStanding(m) && !this.core) {
			// Broken: it falls apart round its core, which starts pulling it back together
			const core = createDummy(m.x, m.y);
			core.kind = 'manhunterCore';
			// Each rebuild wears it out a little: the core gets easier to smash
			core.hp = core.maxHp = Math.round(CORE_HP * CORE_WEAR ** this.rebuilds);
			core.respawns = false;
			core.rebuild = 0;
			game.dummies.push(core);
			this.core = core;
			this.manhunter = null;
			game.constructs.effects.push({ kind: 'burst', x: m.x, y: m.y - 40, age: 0, life: 0.8 });
			if (!this.hints.core) {
				this.hints.core = true;
				this.comms.scene([
					['The Flash', 'Got it! It is down, right? Tell me it is down.'],
					['The ring', 'The Manhunter is rebuilding. Destroy its core.'],
					['Hawkgirl', "Out of my way. Nth metal: this is what it's for!"]
				]);
			} else this.comms.say('Hawkgirl', 'The core! Hit it before it gets up again!', true);
		}
		const core = this.core;
		if (!core) return;
		// The core stays where it fell
		core.x = core.prevX = core.homeX;
		core.y = core.prevY = core.homeY;
		core.vx = core.vy = 0;
		if (!isStanding(core)) {
			// Smashed: it's over, and anything it called up shuts down with it
			this.core = null;
			for (const e of game.enemies) e.hp = 0;
			game.constructs.effects.push({ kind: 'callout', x: core.x, y: core.y - 120, age: 0, life: 2, text: 'MANHUNTER DESTROYED' });
			this.startFarewell(game);
			return;
		}
		core.rebuild = Math.min(1, (core.rebuild ?? 0) + dt / this.rebuildTime);
		if (core.rebuild >= 1) {
			// It's back, and angrier
			const i = game.dummies.indexOf(core);
			if (i >= 0) game.dummies.splice(i, 1);
			this.core = null;
			this.rebuilds++;
			this.manhunter = this.spawnManhunter(game, core.x, core.y, REBUILT_HEALTH, REBUILT_MIGHT ** Math.min(this.rebuilds, 3));
			// It calls up drones to cover it next time (two at most)
			const drones = game.enemies.filter((e) => e.kind === 'manhunterDrone' && isStanding(e)).length;
			for (const dx of [-160, 160].slice(0, Math.max(0, 2 - drones))) {
				const d = game.spawnEnemy('manhunterDrone', core.x + dx, core.y - 120);
				d.brain.might = MIGHT;
				d.hp = d.maxHp = d.brain.lastHp = Math.round(d.maxHp * TOUGHNESS);
			}
			this.comms.say('John', 'It put itself back together. Next time we hit that core, fast.', true);
		}
	}

	private startFarewell(game: Game) {
		this.phase = 'farewell';
		this.clock = 0;
		const john = game.players[0];
		john.invuln = 99;
		this.john = john;
		// The Flash and Hawkgirl stop where they are: they're here to see him off, not follow him
		for (const p of game.players.slice(1)) {
			p.input = { read: () => ({ ...IDLE }) };
			if (p.hero) {
				p.hero.move = null;
				p.hero.target = null;
			}
		}
		this.comms.scene([
			['The Flash', 'Okay. That was new. Nice work, Lantern.'],
			['Hawkgirl', 'You fight like a soldier. Where did you learn that?'],
			['John', "Marines. The ring I've had for about ten minutes."],
			['The Flash', "There's a few of us who team up for this stuff. The Justice League. We could use a guy who builds tanks out of thin air."],
			['The ring', 'John Stewart. The Guardians summon you. Oa is waiting.'],
			['John', "Guess that's a \"not yet.\" Hold that thought."]
		]);
	}

	/** The others turn to watch John. */
	private watchJohn(game: Game) {
		const john = game.players[0];
		for (const p of game.players.slice(1)) {
			p.dir = john.x > p.x ? 1 : -1;
			p.vx = p.vy = 0;
			if (p.hero) p.hero.move = null;
		}
	}

	private farewell(game: Game) {
		this.watchJohn(game);
		for (const p of game.players) p.invuln = Math.max(p.invuln, 1);
		// Once everyone has had their say, the ring takes him up into the sky
		if (!this.comms.current) this.lift(game, game.players[0]);
	}

	/** Up and away: the ring carries John off toward Oa. */
	private lift(game: Game, john: Player) {
		this.state = 'won';
		this.timer = 0;
		this.liftFrom = { x: john.x, y: john.y };
		john.flying = true;
		for (const p of game.players) p.victoryTimer = 0.4;
	}

	/** While the mission is won: John keeps rising, the others watch him go. */
	private hold(game: Game) {
		const john = game.players[0];
		if (!john || john.boarded) return;
		this.watchJohn(game);
		const k = Math.min(1, this.timer / LIFT_TIME);
		// Rings of the ring's light pulsing out from him as he rises
		if (Math.floor(this.timer / 0.22) !== Math.floor((this.timer - 1 / 60) / 0.22)) {
			game.constructs.effects.push({ kind: 'snap', x: john.x, y: john.y - john.bodyTop / 2 - 20, age: 0, life: 0.55, radius: 55 + k * 40 });
		}
		john.x = john.prevX = this.liftFrom.x;
		john.y = john.prevY = this.liftFrom.y - k * k * 900;
		john.vx = 0;
		john.vy = -400;
		john.flying = true;
		if (k >= 1) {
			john.boarded = true;
			game.constructs.effects.push({ kind: 'snap', x: john.x, y: john.y - 60, age: 0, life: 0.8, radius: 120 });
		}
	}

	/** The ring talks John through his first fight, a little at a time. */
	private hint(game: Game) {
		const john = game.players[0];
		if (!this.hints.construct && this.clock > 9) {
			this.hints.construct = true;
			this.comms.say('The ring', 'Imagine a weapon, John Stewart. I will build it. Construct, and I choose what the moment needs.');
		}
		if (!this.hints.shield && john.health < john.maxHealth * 0.7) {
			this.hints.shield = true;
			this.comms.say('The ring', 'You are hurt. Will a shield around yourself.', true);
		}
	}

	private countDefeats() {
		for (const e of this.wave) {
			if (!isStanding(e) && !this.counted.has(e)) {
				this.counted.add(e);
				this.defeated++;
			}
		}
	}

	/** Each time John goes down costs a life; the last one ends the mission. */
	private countDowns(game: Game) {
		const john = game.players[0];
		if (john.downed && !this.wasDown) {
			this.lives--;
			this.downs++;
			if (this.lives <= 0) this.lose(game);
			else this.comms.say('Hawkgirl', 'Get up, Lantern! We need you on your feet!');
		}
		this.wasDown = john.downed;
	}

	private lose(game: Game) {
		this.state = 'lost';
		this.failReason = 'lantern';
		game.downedNotice = false;
		this.comms.clear();
	}

	// -------------------------------------------------------------- drawing

	cameraPoints(): [number, number][] {
		if (this.phase === 'escape' || this.phase === 'awakening') return [[DIG.x, DIG.y - 60]];
		if (this.core) return [[this.core.x, this.core.y - 40]];
		return [];
	}

	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		const list: Drawable[] = [...this.decorations(ctx)];
		const ko = this.knockedOut;
		if (ko) list.push({ baseY: ko.y, draw: () => drawReverseFlash(ctx, ko.e, ko.x, ko.y, true, time) });
		const john = this.john;
		if (this.state === 'won' && john && !john.boarded) list.push({ baseY: this.liftFrom.y + 1, draw: () => drawAscent(ctx, this.liftFrom, john, this.timer / LIFT_TIME, time) });
		const wake = this.phase === 'awakening' ? Math.min(1, this.clock / AWAKEN_TIME) : this.phase === 'escape' ? 0.15 : this.phase === 'manhunter' ? 0.3 : 0;
		list.push({ baseY: DIG.y - 80, draw: () => drawDigSite(ctx, DIG.x, DIG.y, time, wake) });
		if (this.phase === 'escape') {
			// One great leap up and off the top of the screen
			const k = Math.min(1, this.clock / 1.2);
			const f = this.escapeFigure;
			// Mid-leap (air is 0..1); the climb up the screen is in y below
			f.brain.air = Math.sin(Math.min(1, k) * Math.PI * 0.5);
			f.dir = 1;
			const x = this.escapeFrom.x + k * 500;
			const y = this.escapeFrom.y - k * 420;
			if (k < 1) list.push({ baseY: y, draw: () => drawGorilla(ctx, f, x, y, true, time) });
		}
		return list;
	}

	/** Street lamps along the kerbs and trees on the plazas (drawn only, nothing to bump into). */
	private decorations(ctx: CanvasRenderingContext2D): Drawable[] {
		if (this.decor) return this.decor;
		const rand = seededRandom(77);
		const list: Drawable[] = [];
		for (const y of roadsAlong(H)) {
			for (let x = 150; x < W - 100; x += 320) {
				if (roadsAlong(W).some((c) => x > c - 30 && x < c + ROAD_WIDTH + 30)) continue;
				list.push({ baseY: y - 12, draw: () => drawLampPost(ctx, x, y - 12) });
			}
		}
		for (let i = 0; i < 14; i++) {
			const x = 300 + rand() * (W - 600);
			const y = ROAD_OFFSET + ROAD_WIDTH + 60 + rand() * (H - 2 * (ROAD_OFFSET + ROAD_WIDTH) - 120);
			const onRoad = roadsAlong(W).some((c) => x > c - 40 && x < c + ROAD_WIDTH + 40) || roadsAlong(H).some((r) => y > r - 40 && y < r + ROAD_WIDTH + 40);
			if (onRoad || Math.hypot(x - DIG.x, y - DIG.y) < 300) continue;
			const seed = rand();
			list.push({ baseY: y, draw: () => drawStreetTree(ctx, x, y, seed) });
		}
		this.decor = list;
		return list;
	}
}

/**
 * The ring carrying John up: a column of green light from where he stood into
 * the sky, a glow on the ground under it, and a blaze round John himself.
 */
function drawAscent(ctx: CanvasRenderingContext2D, from: { x: number; y: number }, john: Player, k: number, time: number) {
	const grow = Math.min(1, k * 3);
	const pulse = 0.85 + 0.15 * Math.sin(time * 14);
	ctx.save();
	ctx.globalCompositeOperation = 'lighter';
	// On the ground where he stood
	const pool = ctx.createRadialGradient(from.x, from.y, 4, from.x, from.y, 130);
	pool.addColorStop(0, green(0.55 * grow));
	pool.addColorStop(1, green(0));
	ctx.fillStyle = pool;
	ctx.beginPath();
	ctx.ellipse(from.x, from.y, 130, 45, 0, 0, Math.PI * 2);
	ctx.fill();
	// The column of light, up past the top of the screen
	const top = john.y - 1400;
	const width = 60 * grow;
	const column = ctx.createLinearGradient(from.x - width, 0, from.x + width, 0);
	column.addColorStop(0, green(0));
	column.addColorStop(0.5, greenCore(0.45 * pulse * grow));
	column.addColorStop(1, green(0));
	ctx.fillStyle = column;
	ctx.fillRect(from.x - width, top, width * 2, from.y - top);
	// A blaze round John
	const jy = john.y - (john.bodyBottom + john.bodyTop) / 2;
	const blaze = ctx.createRadialGradient(john.x, jy, 6, john.x, jy, 110);
	blaze.addColorStop(0, greenCore(0.8 * pulse));
	blaze.addColorStop(0.35, green(0.45));
	blaze.addColorStop(1, green(0));
	ctx.fillStyle = blaze;
	ctx.beginPath();
	ctx.arc(john.x, jy, 110, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

/** What Grodd says when he turns on someone. */
const TAUNTS: Partial<Record<string, string>> = {
	john: 'You, Lantern. Your mind is loud. Let me quiet it.',
	flash: 'Run all you like, Flash. You always end up where I want you.',
	hawkgirl: 'The bird again. I will pluck you.'
};
