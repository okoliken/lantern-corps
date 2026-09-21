// Act 2, Mission 5: Sleepers.
//
// The Manhunters that got out of the vault came to Earth, and the ones buried
// under it since before people are waking. Under Detroit: John's city. He gets
// there first, and the Justice League comes to him, one at a time.
//
//   wake     Manhunters claw up through the street round John; he's on his
//            own until the Flash gets there
//   league   more come up, street after street; Hawkgirl dives in, and then
//            Superman comes down in the middle of them like a meteor
//   spire    the junction splits and a signal spire rises: they're calling
//            something. Tear it down before the signal is complete. It throws
//            out a pulse (get clear or shield), more sleepers keep waking round
//            it, Wonder Woman arrives, and Batman strafes the street in the
//            Batwing. While it stands, broken Manhunters rebuild round their
//            cores
//   silence  the spire falls and every Manhunter drops where it stands
//   offer    the League asks John to stay
//
// Lose: John goes down 3 times.

import { damagePlayer } from '../combat';
import { hitDummyWithFx } from '../constructs/system';
import { drawBatwing, drawSignalSpire, drawStreetBreak } from '../draw/sleepers';
import { createDummy, isStanding, type Dummy } from '../dummy';
import type { Enemy } from '../enemies/enemies';
import type { Drawable, Game } from '../game';
import { heroFx } from '../heroes';
import { IDLE } from '../input';
import type { CrewId } from '../lanterns';
import type { GameMap } from '../map';
import type { Player } from '../player';
import { buildCityMap, cityDecor } from './callToArms';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

export type SleeperPhase = 'wake' | 'league' | 'spire' | 'silence' | 'offer';

export const SLEEPER_LIVES = 3;
const INTRO_TIME = 3;
/** Manhunters: health and might on top of their base (there are a lot of them). */
const MANHUNTER_HEALTH = 1.15;
const MANHUNTER_MIGHT = 3.5;
const TOUGHNESS = 3.6;
const DRONE_HEALTH = 2.5;
const DRONE_MIGHT = 3.3;
/** How a broken Manhunter rebuilds (while the spire stands, or before it's up). */
export const CORE_HP = 300;
export const REBUILD_TIME = 7;
const REBUILT_HEALTH = 0.45;
const CORE_WEAR = 0.75;
/** The most one hit can take off a Lantern. */
const MAX_HIT = 36;
/** The Flash gets there after this long, or as soon as John breaks his first Manhunter. */
const FLASH_AFTER = 9;
/** The spire: its health, seconds to send the whole signal, and seconds it takes to come up. */
export const SPIRE_HP = 12000;
export const SIGNAL_TIME = 130;
const RISE_TIME = 3.5;
/** Its pulse: how often, how long the warning, how far, and what it does. */
const PULSE = { every: 12, warn: 1.6, radius: 340, damage: 34, knockback: 700 };
/** Sleepers waking round the spire: one every so often, this many up at once, this many in all. */
const WAKE_EVERY = 5;
const WAKE_CAP = 7;
const WAKE_TOTAL = 24;
/** The Batwing: seconds between runs, its speed, and what each bomb does. */
const BATWING = { every: 34, first: 20, speed: 1500, bombs: 6, gap: 120, radius: 125, damage: 90, knockback: 420 };

const W = 3500;
const H = 2100;
const ENTRY = { x: 640, y: 1050 };
/** The junction the spire comes up through. */
export const SPIRE = { x: 2450, y: 1050 };

type Spot = [x: number, y: number, kind?: 'manhunter' | 'manhunterDrone', delay?: number];
const FIRST: Spot[] = [
	[900, 960],
	[960, 1180, 'manhunter', 1.6]
];
const SECOND: Spot[] = [
	[1180, 1000, 'manhunter', 0.5],
	[760, 1240, 'manhunter', 1.5],
	[1100, 1260, 'manhunter', 2.5]
];
const STREET: Spot[] = [
	[1500, 960],
	[1620, 1160, 'manhunter', 0.8],
	[1820, 1040, 'manhunter', 1.6],
	[1750, 700, 'manhunter', 2.4],
	[1750, 1420, 'manhunter', 3.2],
	[1400, 1240, 'manhunter', 4],
	[1980, 1050, 'manhunter', 4.8],
	[1950, 900, 'manhunterDrone', 1],
	[1950, 1200, 'manhunterDrone', 2],
	[1600, 800, 'manhunterDrone', 3]
];
const FLANKS: Spot[] = [
	[1720, 420],
	[1820, 520, 'manhunter', 0.7],
	[1700, 1700, 'manhunter', 1.4],
	[1830, 1620, 'manhunter', 2.1],
	[2150, 1000, 'manhunter', 2.8],
	[2180, 1130, 'manhunter', 3.5],
	[1580, 380, 'manhunter', 4.2],
	[1600, 1740, 'manhunter', 4.9],
	[2050, 1300, 'manhunter', 5.6],
	[1900, 1050, 'manhunterDrone', 0.5],
	[1500, 500, 'manhunterDrone', 1],
	[1500, 1640, 'manhunterDrone', 2],
	[2300, 1060, 'manhunterDrone', 3]
];

/** The surge: this many come up in a ring round John himself, this far out. */
const SURGE = { count: 10, radius: 320 };
/** Seconds a Manhunter that has marked the Lantern stays on him, whoever else hits it. */
const MARKED_FOR = 18;

/** Detroit after dark: the same street grid as Central City. */
export function buildDetroitMap(): GameMap {
	return buildCityMap({ name: 'Detroit', ground: 'nightStreet', seed: 1971, width: W, height: H, spawn: ENTRY, clear: SPIRE });
}

export class Sleepers implements MissionDirector {
	state: MissionState = 'intro';
	phase: SleeperPhase = 'wake';
	timer = INTRO_TIME;
	lives = SLEEPER_LIVES;
	elapsed = 0;
	downs = 0;
	/** Manhunters put down for good (their cores smashed, or silenced with the spire). */
	destroyed = 0;
	rebuilds = 0;
	/** How much of the signal has gone out (0..1), and whether all of it did. */
	signal = 0;
	sent = false;
	failReason: 'lantern' | null = null;
	readonly comms = new Comms();
	readonly starHint = '★ the spire torn down · ★ no lives lost · ★ before the signal is complete';
	spire: Dummy | null = null;
	readonly cores: Dummy[] = [];
	/** Who has arrived so far. */
	readonly league: Player[] = [];
	private manhunters: Enemy[] = [];
	private counted = new WeakSet<Enemy>();
	/** Sleepers about to come up: where, what, and in how long. */
	private waking: { x: number; y: number; kind: 'manhunter' | 'manhunterDrone'; in: number; marked?: boolean }[] = [];
	private breaks: { x: number; y: number; seed: number }[] = [];
	/** Someone coming down out of the sky: they land when `in` runs out. */
	private landing: { who: Player; in: number; slam: boolean } | null = null;
	private batwing: { x: number; y: number; dir: 1 | -1; bombs: number[]; until: number } | null = null;
	private batwingIn = BATWING.first;
	private wave = 0;
	private wakeIn = 3;
	private woken = 0;
	private pulseIn = PULSE.every;
	private warn = 0;
	private rise = 0;
	private wasDown = false;
	private clock = 0;
	private said = new Set<string>();
	private decor: Drawable[] | null = null;

	// ------------------------------------------------------------ reporting

	get objective(): string {
		switch (this.phase) {
			case 'wake':
				return 'Manhunters, under the street: break them, and smash their cores';
			case 'league':
				return 'Hold Detroit with the League';
			case 'spire':
				return this.sent ? 'The signal is out. Tear the spire down anyway' : 'Tear down the signal spire before the signal is complete';
			case 'silence':
				return 'They have stopped';
			case 'offer':
				return 'Detroit is safe';
		}
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const list: MissionMeter[] = [];
		if (this.phase === 'spire') {
			list.push({ label: 'Signal', value: this.signal, text: `${Math.round(this.signal * 100)}%`, low: this.signal > 0.7 });
			if (this.spire) list.push({ label: 'Spire', value: Math.max(0, this.spire.hp / this.spire.maxHp), text: '' });
		}
		const core = this.cores[0];
		if (core) list.push({ label: 'Core', value: core.hp / core.maxHp, text: `${Math.ceil((1 - (core.rebuild ?? 0)) * REBUILD_TIME)}s`, low: true });
		return list;
	}

	warning(): string | null {
		if (this.warn > 0) return 'THE SPIRE IS ABOUT TO PULSE: GET CLEAR OR SHIELD';
		if (this.cores.some((c) => (c.rebuild ?? 0) > 0.6)) return 'A MANHUNTER IS REBUILDING: SMASH THE CORE';
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.downs === 0 ? 1 : 0) + (!this.sent ? 1 : 0);
	}

	get resultText(): string {
		if (this.state !== 'won') return 'John went down one time too many, and Detroit with him.';
		return this.sent
			? 'The spire is down and Detroit is standing, but the whole signal got out. Something answered it.'
			: 'The spire is down before it finished, and Detroit is standing. But part of the signal got out, and something answered it.';
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		return [
			{ label: 'Manhunters destroyed', value: `${this.destroyed}` },
			{ label: 'Signal sent', value: `${Math.round(this.signal * 100)}%` },
			{ label: 'Lives lost', value: `${this.downs}` },
			{ label: 'Time', value: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
		];
	}

	/** The spire won't fall on its own: go for it whenever there's no core to smash. */
	get goalFirst(): boolean {
		return this.phase === 'spire' && this.cores.length === 0 && this.spire !== null;
	}

	goal(): { x: number; y: number } | null {
		const core = this.cores[0];
		if (core) return core;
		if (this.phase === 'spire') return { x: SPIRE.x - 260, y: SPIRE.y };
		const up = this.manhunters.find(isStanding);
		if (up) return up;
		return this.waking[0] ?? null;
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
					this.wakeAll(FIRST);
					this.comms.scene([
						['The ring', 'Manhunter signatures. Many. Directly beneath you.'],
						['John', "Beneath me is Eight Mile. I grew up on this street. ...Here they come."]
					]);
				}
				return;
			case 'won':
				this.timer += dt;
				this.gather(game);
				return;
			case 'lost':
				for (const p of game.players) if (p.downed && p.slot === 0) p.downTimer = Math.max(p.downTimer, 1);
				return;
		}

		this.elapsed += dt;
		this.clock += dt;
		this.countDowns(game);
		if (this.state !== 'playing') return;
		this.wakeSleepers(game, dt);
		this.rebuild(game, dt);
		this.land(game, dt);
		this.chatter(game);
		// (asked afresh each time: starting a wave makes it false again)
		const clear = () => this.waking.length === 0 && this.manhunters.every((m) => !isStanding(m)) && this.cores.length === 0;

		switch (this.phase) {
			case 'wake':
				if (this.wave === 0 && (this.clock >= FLASH_AFTER || this.destroyed + this.cores.length > 0)) {
					this.wave = 1;
					this.arrive(game, 'flash', ENTRY.x - 560, ENTRY.y + 40);
					this.wakeAll(SECOND);
					this.comms.scene([
						['The Flash', "John! Got your call. Well, J'onn's call. In my head. That's never not weird."],
						["J'onn J'onzz", 'Forgive the intrusion, John Stewart. They are waking under seven cities. The League is coming to yours.'],
						['John', 'A Martian. In my head. Sure. Why not. Flash, break them and I will smash the cores!']
					]);
				}
				if (this.wave === 1 && clear()) {
					this.phase = 'league';
					this.clock = 0;
					this.wave = 2;
					this.wakeAll(STREET, true);
					this.comms.scene([
						['Batman', 'Stewart. Batman. The machines that left the vault are waking the rest. Detroit is the largest nest. Hold it.'],
						['John', "Wasn't planning on doing anything else."]
					]);
				}
				break;
			case 'league':
				if (this.wave === 2 && this.clock >= 4) this.once('hawkgirl', () => this.arrive(game, 'hawkgirl', ...this.fightNear(game, 240), 320));
				if (this.wave === 2 && clear()) {
					this.wave = 3;
					this.clock = 0;
					this.wakeAll(FLANKS, true);
					this.comms.say('Hawkgirl', 'More of them, both side streets! How many did they BURY here?');
				}
				if (this.wave === 3 && this.clock >= 6) this.once('superman', () => this.arrive(game, 'superman', ...this.fightNear(game, 260), 700, true));
				if (this.wave === 3 && clear()) {
					// They know who's holding the city together
					this.wave = 4;
					const john = game.players[0];
					for (let i = 0; i < SURGE.count; i++) {
						const a = (i / SURGE.count) * Math.PI * 2;
						const x = Math.max(200, Math.min(W - 200, john.x + Math.cos(a) * SURGE.radius));
						const y = Math.max(300, Math.min(H - 300, john.y + Math.sin(a) * SURGE.radius * 0.75));
						this.waking.push({ x, y, kind: 'manhunter', in: 1 + i * 0.25, marked: true });
					}
					this.comms.scene([
						["J'onn J'onzz", 'John! They have marked you. The Lantern is the priority target. They are under you, all round you!'],
						['Superman', 'Everybody on John. Now!']
					]);
				}
				if (this.wave === 4 && clear()) this.raiseSpire();
				break;
			case 'spire':
				this.runSpire(game, dt);
				break;
			case 'silence':
				if (this.clock >= 3.5) this.startOffer(game);
				break;
			case 'offer':
				this.gather(game);
				for (const p of game.players) p.invuln = Math.max(p.invuln, 1);
				if (!this.comms.current) this.win(game);
				break;
		}
	}

	// ------------------------------------------------------------ sleepers

	/** Wake a wave; with `hunting`, every other one comes up already after the Lantern. */
	private wakeAll(spots: Spot[], hunting = false) {
		spots.forEach(([x, y, kind = 'manhunter', delay = 0], i) => this.waking.push({ x, y, kind, in: delay, marked: hunting && i % 2 === 0 }));
	}

	/** Up through the street: a crack of thunder, slabs thrown, and a Manhunter standing in the hole. */
	private wakeSleepers(game: Game, dt: number) {
		for (const s of [...this.waking]) {
			s.in -= dt;
			if (s.in > 0) continue;
			this.waking.splice(this.waking.indexOf(s), 1);
			this.breaks.push({ x: s.x, y: s.y, seed: Math.random() });
			if (this.breaks.length > 40) this.breaks.shift();
			heroFx(game.constructs).push({ kind: 'quake', x: s.x, y: s.y, age: 0, life: 0.6, radius: 110, red: true });
			// Anyone standing on it is thrown clear
			for (const p of game.players) if (!p.hero && Math.hypot(p.x - s.x, p.y - s.y) < 90) damagePlayer(game.constructs, p, 12, s.x, s.y, 520);
			if (s.kind === 'manhunter') {
				const m = this.spawnManhunter(game, s.x, s.y);
				m.stun = 0.9;
				if (s.marked) {
					m.brain.grudge = game.players[0];
					m.brain.grudgeAgo = 3.5 - MARKED_FOR;
				}
			}
			else {
				const d = game.spawnEnemy('manhunterDrone', s.x, s.y);
				d.brain.might = DRONE_MIGHT;
				d.hp = d.maxHp = d.brain.lastHp = Math.round(d.maxHp * DRONE_HEALTH);
				d.brain.alert = 10;
			}
		}
	}

	private spawnManhunter(game: Game, x: number, y: number, health = 1): Enemy {
		const m = game.spawnEnemy('manhunter', x, y);
		m.maxHp = Math.round(m.maxHp * MANHUNTER_HEALTH);
		m.hp = m.brain.lastHp = Math.round(m.maxHp * health);
		m.brain.might = MANHUNTER_MIGHT;
		m.brain.grit = TOUGHNESS;
		m.brain.alert = 10;
		this.manhunters.push(m);
		return m;
	}

	/** Broken Manhunters fall apart round a core that rebuilds them, unless it's smashed. */
	private rebuild(game: Game, dt: number) {
		for (const m of this.manhunters) {
			if (isStanding(m) || this.counted.has(m)) continue;
			this.counted.add(m);
			const core = createDummy(m.x, m.y);
			core.kind = 'manhunterCore';
			core.hp = core.maxHp = Math.round(CORE_HP * CORE_WEAR ** Math.min(this.rebuilds, 5));
			core.respawns = false;
			core.rebuild = 0;
			game.dummies.push(core);
			this.cores.push(core);
			this.once('core', () => this.comms.say('The ring', 'It is rebuilding round its core. Destroy the core.', true));
		}
		for (const core of [...this.cores]) {
			core.x = core.prevX = core.homeX;
			core.y = core.prevY = core.homeY;
			core.vx = core.vy = 0;
			if (!isStanding(core)) {
				this.cores.splice(this.cores.indexOf(core), 1);
				this.destroyed++;
				game.constructs.effects.push({ kind: 'callout', x: core.x, y: core.y - 100, age: 0, life: 1.4, text: 'CORE SMASHED' });
				continue;
			}
			core.rebuild = Math.min(1, (core.rebuild ?? 0) + dt / REBUILD_TIME);
			if (core.rebuild >= 1) {
				const i = game.dummies.indexOf(core);
				if (i >= 0) game.dummies.splice(i, 1);
				this.cores.splice(this.cores.indexOf(core), 1);
				this.rebuilds++;
				this.spawnManhunter(game, core.x, core.y, REBUILT_HEALTH);
			}
		}
	}

	// ---------------------------------------------------------- the League

	/** A member of the League gets there: the Flash at a run, the rest down out of the sky from `height` up. */
	private arrive(game: Game, who: CrewId, x: number, y: number, height = 0, slam = false): Player {
		const p = game.addPartner(who, x, y);
		this.league.push(p);
		if (p.hero && height > 0) {
			p.hero.rise = height;
			p.invuln = 1.5;
			this.landing = { who: p, in: height / 400, slam };
		} else this.announce(game, p);
		return p;
	}

	/** Where to come down: in among the Manhunters nearest John (so he sees it), or beside him if there are none. */
	private fightNear(game: Game, beside: number): [number, number] {
		const john = game.players[0];
		const near = game.enemies.filter((e) => isStanding(e) && Math.hypot(e.x - john.x, e.y - john.y) < 520);
		if (near.length === 0) return [john.x + beside, john.y - 60];
		return [near.reduce((s, e) => s + e.x, 0) / near.length, near.reduce((s, e) => s + e.y, 0) / near.length];
	}

	private announce(game: Game, p: Player) {
		game.constructs.effects.push({ kind: 'callout', x: p.x, y: p.y, age: 0, life: 2, text: p.def.name.toUpperCase(), owner: p });
	}

	/** Whoever is coming down lands; Superman lands ON them. */
	private land(game: Game, dt: number) {
		const l = this.landing;
		if (!l) return;
		l.in -= dt;
		if (l.in > 0) return;
		this.landing = null;
		const { who } = l;
		this.announce(game, who);
		heroFx(game.constructs).push({ kind: 'quake', x: who.x, y: who.y, age: 0, life: 0.7, radius: l.slam ? 240 : 120, gold: who.def.id === 'wonderwoman' });
		if (!l.slam) return;
		for (const e of game.enemies) {
			if (!isStanding(e) || Math.hypot(e.x - who.x, e.y - who.y) > 240) continue;
			hitDummyWithFx(game.constructs, e, 160, 700, who.x, who.y, who);
			e.stun = Math.max(e.stun, 1.2);
		}
	}

	/** Things said as the fight goes. */
	private chatter(game: Game) {
		const has = (id: string) => this.league.some((p) => p.def.id === id);
		if (has('hawkgirl')) this.once('hg', () => this.comms.scene([
			['Hawkgirl', 'Lantern! You kept the ring. It suits you.'],
			['John', 'Still learning what it does. Your mace breaks those cores fastest: take them!']
		]));
		if (has('superman')) this.once('sm', () => this.comms.scene([
			['Superman', 'Sorry I am late. Metropolis had eleven of these. You must be John. Clark. I mean, Superman.'],
			['John', 'I know who you are. Everybody knows who you are.'],
			['Superman', 'Tonight it is your city. Where do you want me?']
		]));
		if (has('wonderwoman')) this.once('ww', () => this.comms.scene([
			['Wonder Woman', 'Hera, what IS that thing? Diana of Themyscira, Lantern. Point me at it.'],
			['John', 'The spire. Everything we have, on the spire!']
		]));
		const john = game.players[0];
		if (john.health < john.maxHealth * 0.35) this.once('hurt', () => this.comms.say("J'onn J'onzz", 'You are hurt, John. Fall back behind Superman; very little gets past him.'));
		if (this.destroyed >= 6) this.once('manhunter', () => this.comms.scene([
			['The Flash', "Hey J'onn, no offence, but aren't YOU the Martian Manhunter?"],
			["J'onn J'onzz", 'An unfortunate coincidence of translation. I would prefer we not dwell on it.']
		]));
	}

	// ------------------------------------------------------------ the spire

	private raiseSpire() {
		this.phase = 'spire';
		this.clock = 0;
		this.rise = 0;
		this.comms.scene([
			['Batman', 'Seismic spike, the junction east of you. Something large is coming up.'],
			["J'onn J'onzz", 'I hear them now: one thought, ten thousand times. NO MAN ESCAPES THE MANHUNTERS. They are calling to something. Something that thinks for all of them.'],
			['John', "A transmitter. Then we've got until it finishes. League: bring it down!"]
		]);
	}

	private runSpire(game: Game, dt: number) {
		// Up through the junction first; it can't be touched until it's standing
		if (!this.spire) {
			this.rise = Math.min(1, this.clock / RISE_TIME);
			if (this.rise < 1) return;
			const spire = createDummy(SPIRE.x, SPIRE.y);
			spire.kind = 'signalSpire';
			spire.hp = spire.maxHp = SPIRE_HP;
			spire.respawns = false;
			game.dummies.push(spire);
			this.spire = spire;
			game.constructs.effects.push({ kind: 'callout', x: SPIRE.x, y: SPIRE.y - 280, age: 0, life: 2.4, text: 'SIGNAL SPIRE', hurt: true });
			this.clock = 0;
			return;
		}
		const spire = this.spire;
		spire.x = spire.prevX = SPIRE.x;
		spire.y = spire.prevY = SPIRE.y;
		spire.vx = spire.vy = 0;
		spire.stun = 0;
		if (!isStanding(spire)) {
			this.silence(game);
			return;
		}

		if (!this.sent) {
			this.signal = Math.min(1, this.signal + dt / SIGNAL_TIME);
			if (this.signal >= 0.5) this.once('half', () => this.comms.say('Batman', 'Signal at half strength and climbing. Whatever you are doing, do it faster.', true));
			if (this.signal >= 1) {
				this.sent = true;
				game.constructs.effects.push({ kind: 'callout', x: SPIRE.x, y: SPIRE.y - 300, age: 0, life: 2.6, text: 'SIGNAL SENT', hurt: true });
				this.comms.say("J'onn J'onzz", 'It is done. The whole signal is out... and something has answered. Bring the spire down regardless.', true);
			}
		}
		if (this.clock >= 6) this.once('wonderwoman', () => this.arrive(game, 'wonderwoman', ...this.fightNear(game, 220), 320));

		// More sleepers, round the spire
		this.wakeIn -= dt;
		if (this.wakeIn <= 0 && this.woken < WAKE_TOTAL) {
			this.wakeIn = WAKE_EVERY;
			if (this.manhunters.filter(isStanding).length + this.waking.length < WAKE_CAP) {
				const a = Math.random() * Math.PI * 2;
				const r = 300 + Math.random() * 260;
				this.waking.push({ x: SPIRE.x + Math.cos(a) * r, y: SPIRE.y + Math.sin(a) * r * 0.7, kind: this.woken % 4 === 3 ? 'manhunterDrone' : 'manhunter', in: 0.4, marked: this.woken % 2 === 0 });
				this.woken++;
			}
		}

		this.pulse(game, dt);
		this.flyBatwing(game, dt);
	}

	/** The spire throws everyone back: a warning on the ground first, so you can get clear or shield. */
	private pulse(game: Game, dt: number) {
		this.pulseIn -= dt;
		if (this.warn === 0 && this.pulseIn <= PULSE.warn) {
			this.warn = 0.01;
			game.constructs.effects.push({ kind: 'slamMark', x: SPIRE.x, y: SPIRE.y, age: 0, life: PULSE.warn, radius: PULSE.radius });
		}
		if (this.warn > 0) this.warn = Math.min(1, 1 - this.pulseIn / PULSE.warn);
		if (this.pulseIn > 0) return;
		this.pulseIn = PULSE.every;
		this.warn = 0;
		game.constructs.effects.push({ kind: 'pulse', x: SPIRE.x, y: SPIRE.y, age: 0, life: 0.5, radius: PULSE.radius });
		for (const p of game.players) {
			if (Math.hypot(p.x - SPIRE.x, p.y - SPIRE.y) <= PULSE.radius) damagePlayer(game.constructs, p, PULSE.damage, SPIRE.x, SPIRE.y, PULSE.knockback);
		}
	}

	/** Batman's run: the Batwing crosses the street low, bombing a line through the thickest of them. */
	private flyBatwing(game: Game, dt: number) {
		const b = this.batwing;
		if (!b) {
			this.batwingIn -= dt;
			const up = game.enemies.filter(isStanding);
			if (this.batwingIn > 0 || up.length < 2) return;
			this.batwingIn = BATWING.every;
			const cx = up.reduce((s, e) => s + e.x, 0) / up.length;
			const cy = up.reduce((s, e) => s + e.y, 0) / up.length;
			const dir = Math.random() < 0.5 ? 1 : -1;
			const bombs = Array.from({ length: BATWING.bombs }, (_, i) => cx + (i - (BATWING.bombs - 1) / 2) * BATWING.gap);
			if (dir < 0) bombs.reverse();
			this.batwing = { x: cx - dir * 1500, y: cy, dir, bombs, until: cx + dir * 1700 };
			this.comms.say('Batman', this.said.has('batwing') ? 'Coming round again. Clear the street.' : 'Batwing on approach. Heads down.', true);
			this.said.add('batwing');
			return;
		}
		b.x += b.dir * BATWING.speed * dt;
		while (b.bombs.length > 0 && (b.x - b.bombs[0]) * b.dir >= 0) {
			const x = b.bombs.shift()!;
			heroFx(game.constructs).push({ kind: 'boom', x, y: b.y, age: 0, life: 0.6, radius: BATWING.radius });
			for (const e of game.enemies) {
				if (!isStanding(e) || Math.hypot(e.x - x, e.y - b.y) > BATWING.radius) continue;
				hitDummyWithFx(game.constructs, e, BATWING.damage, BATWING.knockback, x, b.y, null);
			}
		}
		if ((b.x - b.until) * b.dir >= 0) this.batwing = null;
	}

	/** The spire comes down, and every Manhunter it was thinking for drops where it stands. */
	private silence(game: Game) {
		this.phase = 'silence';
		this.clock = 0;
		this.warn = 0;
		this.waking.length = 0;
		this.batwing = null;
		const i = game.dummies.indexOf(this.spire!);
		if (i >= 0) game.dummies.splice(i, 1);
		this.spire = null;
		for (let k = 0; k < 5; k++) heroFx(game.constructs).push({ kind: 'boom', x: SPIRE.x + (k % 2 ? 40 : -40), y: SPIRE.y + 20 - k * 8, age: -k * 0.18, life: 0.8, radius: 140 + k * 35 });
		game.constructs.effects.push({ kind: 'callout', x: SPIRE.x, y: SPIRE.y - 200, age: 0, life: 2.4, text: 'SPIRE DESTROYED' });
		for (const e of game.enemies) {
			if (!isStanding(e)) continue;
			// No core to come back from this time
			this.counted.add(e);
			if (e.kind === 'manhunter') this.destroyed++;
			hitDummyWithFx(game.constructs, e, e.hp + 1, 0, e.x, e.y, null, 0);
		}
		for (const core of this.cores.splice(0)) {
			const at = game.dummies.indexOf(core);
			if (at >= 0) game.dummies.splice(at, 1);
			this.destroyed++;
		}
		this.comms.clear();
		this.comms.say('The Flash', "They just... stopped. All of them. Did we win? I think we won.");
	}

	// ------------------------------------------------------------ the offer

	private startOffer(game: Game) {
		this.phase = 'offer';
		for (const p of game.players) {
			p.invuln = 99;
			if (p.slot === 0) continue;
			p.input = { read: () => ({ ...IDLE }) };
			if (p.hero) {
				p.hero.move = null;
				p.hero.target = null;
			}
		}
		this.comms.scene([
			["J'onn J'onzz", this.sent ? 'The other six cities are quiet. But the signal went out whole, and something answered it. Something old. It is coming.' : 'The other six cities are quiet. But a part of the signal got out, and something answered it. Something old. It is coming.'],
			['Batman', "Then we have days, not weeks. Stewart: you knew what those machines were before we did. That's the Corps' mess."],
			['John', "It is. The Guardians built them. I'll tell you all of it. And I'm going to make sure they clean it up."],
			['Superman', 'You held a city tonight with people you had met once. We have been talking, John. There is a seat at the table, if you want it.'],
			['Wonder Woman', 'The League has no one who can do what you do. And few who think before they strike.'],
			['John', "I've already got a Corps. And a sector. It's... 3,600 systems, give or take."],
			['The Flash', 'So have two jobs! I have two jobs. Bats has, like, five.'],
			['Hawkgirl', 'Say yes, John. You fight like one of us already.'],
			['John', "...Earth's in my sector. Guess that makes you my business anyway. I'm in."],
			['The ring', 'Incoming from Oa. Lantern Jordan: "John. It is called Manhunter Prime, and it is awake. Get back here."']
		]);
	}

	/** The League round John, facing him. */
	private gather(game: Game) {
		const john = game.players[0];
		game.players.slice(1).forEach((p, i, all) => {
			const a = Math.PI * (0.15 + (0.7 * i) / Math.max(1, all.length - 1));
			const gx = john.x + Math.cos(a) * 210 * (i % 2 ? 1 : 1.15);
			const gy = john.y - 40 + Math.sin(a) * 120;
			const d = Math.hypot(gx - p.x, gy - p.y);
			if (p.hero) p.hero.move = null;
			if (d > 14) {
				const speed = Math.min(p.def.id === 'flash' ? 900 : 420, d * 4);
				p.vx = ((gx - p.x) / d) * speed;
				p.vy = ((gy - p.y) / d) * speed;
				p.dir = (d > 60 ? p.vx > 0 : john.x > p.x) ? 1 : -1;
			} else {
				p.vx = p.vy = 0;
				p.dir = john.x > p.x ? 1 : -1;
			}
		});
	}

	private once(key: string, run: () => void) {
		if (this.said.has(key)) return;
		this.said.add(key);
		run();
	}

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
			} else this.comms.say(this.league.length > 0 ? 'The Flash' : 'The ring', this.league.length > 0 ? "John's down! Cover him! Come on, big guy, up you get!" : 'Get up, John Stewart. This city has no one else yet.');
		}
		this.wasDown = john.downed;
	}

	private win(game: Game) {
		this.state = 'won';
		this.timer = 0;
		for (const p of game.players) p.victoryTimer = 0.4;
	}

	// -------------------------------------------------------------- drawing

	cameraPoints(): [number, number][] {
		// Look at the spire as it comes up
		if (this.phase === 'spire' && !this.spire) return [[SPIRE.x, SPIRE.y - 100]];
		return [];
	}

	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		const list: Drawable[] = [...(this.decor ??= cityDecor(ctx, W, H, 313, SPIRE))];
		for (const b of this.breaks) list.push({ baseY: b.y - 40, draw: () => drawStreetBreak(ctx, b.x, b.y, b.seed) });
		// About to come up: the street shakes and glows
		for (const s of this.waking) {
			if (s.in > 1.2) continue;
			list.push({
				baseY: s.y - 41,
				draw: () => {
					ctx.fillStyle = `rgba(255, 138, 42, ${0.18 + 0.12 * Math.sin(time * 30)})`;
					ctx.beginPath();
					ctx.ellipse(s.x, s.y, 46, 20, 0, 0, Math.PI * 2);
					ctx.fill();
				}
			});
		}
		if (this.phase === 'spire') {
			const spire = this.spire;
			list.push({ baseY: SPIRE.y, draw: () => drawSignalSpire(ctx, SPIRE.x, SPIRE.y, time, this.rise, this.signal, spire ? spire.hp / spire.maxHp : 1, this.warn) });
		} else if (this.phase === 'silence' || this.phase === 'offer') {
			list.push({ baseY: SPIRE.y - 60, draw: () => drawSignalSpire(ctx, SPIRE.x, SPIRE.y, time, 0, 0, 0, 0) });
		}
		const b = this.batwing;
		if (b) list.push({ baseY: H + 1000, draw: () => drawBatwing(ctx, b.x, b.y, b.dir) });
		return list;
	}
}
