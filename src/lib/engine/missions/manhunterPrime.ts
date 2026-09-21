// Act 2, the boss: Manhunter Prime.
//
// Under the vault is the hall where the Guardians buried the first Manhunter:
// the mind the rest were copied from. The signal from Earth woke it. Hal and
// John go down together (you choose who to play; the other fights beside you).
//
// It LEARNS. It watches what each Lantern builds, and at each stage it takes
// the construct that Lantern has used most: green light is pulled out of the
// ring into its chest, that construct is locked for the rest of the fight, and
// Prime starts using a copy of it, in your own green. So keep changing what
// you use, and save what you can't do without.
//
//   stage 1   Prime alone: eye lasers, the sweeping beam, the pulse, its fists
//   stage 2   (70%) learns a construct from each of you; the ranks along the
//             walls start to wake
//   stage 3   (40%) learns another; more wake, and drones
//   stage 4   (15%) learns a third, and stops holding back: faster, stronger
//             (Broken before a stage, it comes back and learns what it missed.)
//   core      broken, it falls apart round its core and rebuilds unless the
//             core is smashed. While it lies in pieces nothing thinks for the
//             ranks: they hang where they are, and their cores go dark. Smash
//             Prime's core and every ring gets its light back
//
// Lose: your Lantern goes down 3 times.

import { CONSTRUCTS, type ConstructDef } from '../constructs/defs';
import { drawDormant, drawPrimeDais, drawSiphon } from '../draw/heart';
import { drawCliff } from '../draw/vault';
import { createDummy, isStanding, type Dummy } from '../dummy';
import type { Enemy } from '../enemies/enemies';
import type { AbilityId } from '../enemies/redConstructs';
import type { Drawable, Game } from '../game';
import { seededRandom, type GameMap, type Obstacle } from '../map';
import type { Player } from '../player';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

export type PrimePhase = 'descent' | 'fight' | 'learning' | 'core' | 'fallen';

export const PRIME_LIVES = 3;
const INTRO_TIME = 3;
/** Three stars: done within this many seconds. */
const PAR_TIME = 420;
/** Prime: health and might on top of its base. */
const PRIME_HEALTH = 9.5;
const PRIME_MIGHT = 3.8;
const TOUGHNESS = 3.6;
/** Health left (0..1) where it learns; the last one is also where it stops holding back. */
export const LEARN_AT = [0.7, 0.4, 0.15];
/** Seconds it takes to analyse a construct (it can't be hurt, and doesn't move). */
export const LEARN_TIME = 2.8;
/** Overdrive: how much faster and stronger in stage 4. */
const OVERDRIVE = { might: 1.15, speed: 1.2 };
/** The ranks it wakes: Manhunters and drones at each stage, their health and might. */
const WAKES: { manhunters: number; drones: number }[] = [
	{ manhunters: 3, drones: 2 },
	{ manhunters: 4, drones: 3 },
	{ manhunters: 4, drones: 3 }
];
const MANHUNTER_HEALTH = 0.7;
const MANHUNTER_MIGHT = 3.1;
const DRONE_HEALTH = 2.5;
const DRONE_MIGHT = 3;
/** Prime's core: health, seconds to rebuild, the health it comes back with, and how the core wears. */
export const CORE_HP = 1200;
export const REBUILD_TIME = 10;
const REBUILT_HEALTH = 0.2;
const CORE_WEAR = 0.65;
/** The ranks' cores: small, and nothing comes back from them once Prime itself is in pieces. */
const RANK_CORE_HP = 260;
const RANK_REBUILD = 8;
/** The most one hit can take off a Lantern. */
const MAX_HIT = 38;
/** It turns on the other Lantern every so often (seconds, plus up to SPREAD more). */
const SWITCH_EVERY = 5;
const SWITCH_SPREAD = 3;

const W = 2800;
const H = 1800;
const ENTRY = { x: 560, y: 1000 };
export const DAIS = { x: 1500, y: 880 };
/** The hall's back wall runs along the top of the map; the alcoves are cut into the foot of it, left to right. */
const WALL = 300;
const ALCOVES = Array.from({ length: 16 }, (_, i) => ({ x: 260 + i * 152, y: WALL + 4 }));

/** What Prime can do with what it has learned, by the kind of construct. */
const COPIES: Record<string, AbilityId[]> = {
	smash: ['bigFist'],
	ram: ['bigFist'],
	dash: ['bigFist'],
	slash: ['sword', 'bladeFan'],
	grind: ['sword'],
	boomerang: ['bladeFan'],
	heavy: ['cannon'],
	volley: ['meteors'],
	spread: ['cannon'],
	pillars: ['meteors'],
	mine: ['meteors'],
	rapid: ['beam'],
	snipe: ['beam'],
	lances: ['bladeFan'],
	beam: ['beam'],
	barrier: ['redWall'],
	trap: ['cage'],
	grab: ['cage'],
	turret: ['redTurret'],
	squad: ['redTurret'],
	area: ['hammerSpin']
};
/** Anything else it learns comes out as this. */
const DEFAULT_COPY: AbilityId[] = ['hammerSpin'];

const defOf = (id: string): ConstructDef | undefined => (CONSTRUCTS as Record<string, ConstructDef>)[id];

/** The Heart of the Vault: a long hall of dead rock, the ranks along the back wall, broken pillars to fight round. */
export function buildHeartMap(): GameMap {
	const rand = seededRandom(3600);
	const obstacles: Obstacle[] = [];
	// The back wall, with the alcoves in it
	obstacles.push({ kind: 'rock', x: 0, y: 0, w: W, h: WALL - 20, height: 0, blocksFlying: true, seed: 0, hidden: true });
	for (let i = 0; i < 10; i++) {
		const size = 46 + rand() * 50;
		const x = 300 + rand() * (W - 600);
		const y = 480 + rand() * (H - 760);
		if (Math.hypot(x - DAIS.x, y - DAIS.y) < 420 || Math.hypot(x - ENTRY.x, y - ENTRY.y) < 300) continue;
		obstacles.push({ kind: 'rock', x: x - size / 2, y: y - size / 3, w: size, h: size * 0.65, height: size * 1.2, blocksFlying: false, seed: rand() });
	}
	return {
		name: 'The Heart of the Vault',
		environment: 'planet',
		ground: 'vault',
		width: W,
		height: H,
		spawn: ENTRY,
		battery: { x: ENTRY.x - 220, y: ENTRY.y - 40 },
		dummies: [],
		obstacles
	};
}

/** The construct a Lantern has used most that Prime hasn't already taken (null if they've used nothing else). */
export function mostUsed(p: Player): string | null {
	let best: string | null = null;
	for (const def of p.loadout) {
		if (p.locked.has(def.id)) continue;
		const used = p.usage[def.id] ?? 0;
		if (used > 0 && (best === null || used > (p.usage[best] ?? 0))) best = def.id;
	}
	return best;
}

export class ManhunterPrimeBoss implements MissionDirector {
	state: MissionState = 'intro';
	phase: PrimePhase = 'descent';
	/** 1-4 while it fights. */
	stage: 1 | 2 | 3 | 4 = 1;
	timer = INTRO_TIME;
	lives = PRIME_LIVES;
	elapsed = 0;
	downs = 0;
	/** Times Prime has pulled itself back together. */
	rebuilds = 0;
	failReason: 'lantern' | null = null;
	readonly comms = new Comms();
	readonly starHint = '★ Manhunter Prime destroyed · ★ no lives lost · ★ under 7 minutes';
	prime: Enemy | null = null;
	/** Prime's core, while it lies in pieces. */
	core: Dummy | null = null;
	/** Everything it has taken: whose, what, and what it made of it. */
	readonly learned: { from: string; construct: string; copies: AbilityId[] }[] = [];
	/** Who it's pulling light from right now. */
	private siphons: Player[] = [];
	private heldHp = 0;
	private ranks: Enemy[] = [];
	private rankCores: Dummy[] = [];
	private counted = new WeakSet<Enemy>();
	/** Which alcoves have emptied. */
	private woken = 0;
	private wasDown = false;
	private clock = 0;
	private switchIn = SWITCH_EVERY;
	private said = new Set<string>();

	// ------------------------------------------------------------ reporting

	get objective(): string {
		switch (this.phase) {
			case 'descent':
				return 'The Heart of the Vault';
			case 'fight':
				return this.stage === 4 ? 'It has stopped holding back: finish it' : 'Destroy Manhunter Prime. Keep changing constructs: it is learning';
			case 'learning':
				return 'It is taking your light';
			case 'core':
				return 'Smash the core before it rebuilds!';
			case 'fallen':
				return 'It is over';
		}
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const list: MissionMeter[] = [];
		const p = this.prime;
		if (p && isStanding(p)) list.push({ label: 'Prime', value: Math.max(0, p.hp / p.maxHp), text: `Stage ${this.stage}` });
		if (this.core) list.push({ label: 'Core', value: this.core.hp / this.core.maxHp, text: `${Math.ceil((1 - (this.core.rebuild ?? 0)) * REBUILD_TIME)}s`, low: true });
		return list;
	}

	warning(): string | null {
		if (this.phase === 'learning') return 'ANALYSING YOUR CONSTRUCTS';
		if (this.core && (this.core.rebuild ?? 0) > 0.55) return 'PRIME IS REBUILDING: SMASH THE CORE';
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.downs === 0 ? 1 : 0) + (this.elapsed <= PAR_TIME ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'won') return 'Manhunter Prime is scrap, and every Manhunter it thought for is scrap with it. The rings have their light back.';
		return 'Prime learned everything it needed. The Lanterns did not come back up.';
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		return [
			{ label: 'Constructs it learned', value: this.learned.map((l) => defOf(l.construct)?.name ?? l.construct).join(', ') || 'none' },
			{ label: 'Times it rebuilt', value: `${this.rebuilds}` },
			{ label: 'Lives lost', value: `${this.downs}` },
			{ label: 'Time', value: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
		];
	}

	goal(): { x: number; y: number } | null {
		if (this.core) return this.core;
		const rankCore = this.rankCores[0];
		if (rankCore) return rankCore;
		return this.prime && isStanding(this.prime) ? this.prime : null;
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
					this.comms.scene([
						['Hal', 'There must be ten thousand of them down here. Tell me they are all switched off.'],
						['John', 'All but one. On the dais. It has been watching us since we came in.']
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
		this.rebuildRanks(game, dt);

		switch (this.phase) {
			case 'descent':
				if (this.clock >= 5) this.awaken(game);
				break;
			case 'fight':
				this.fight(game, dt);
				break;
			case 'learning':
				this.learning(game);
				break;
			case 'core':
				this.rebuildPrime(game, dt);
				break;
			case 'fallen':
				for (const p of game.players) p.invuln = Math.max(p.invuln, 1);
				if (!this.comms.current) this.win(game);
				break;
		}
	}

	private awaken(game: Game) {
		this.phase = 'fight';
		this.clock = 0;
		this.prime = this.spawnPrime(game, 1);
		this.comms.scene([
			['Manhunter Prime', 'GREEN LANTERNS. THE REPLACEMENTS. I HAVE WAITED TO SEE WHAT WAS DEEMED BETTER THAN US.'],
			['Hal', "Better looking, for a start. John, left side. Let's take it apart."],
			['Manhunter Prime', 'SHOW ME WHAT YOU BUILD. I WILL KEEP WHAT IS USEFUL.']
		]);
	}

	private spawnPrime(game: Game, health: number): Enemy {
		const e = game.spawnEnemy('manhunterPrime', DAIS.x, DAIS.y);
		e.maxHp = Math.round(e.maxHp * PRIME_HEALTH);
		e.hp = e.brain.lastHp = Math.round(e.maxHp * health);
		e.brain.might = PRIME_MIGHT * (this.stage === 4 ? OVERDRIVE.might : 1);
		if (this.stage === 4) e.brain.speedMul *= OVERDRIVE.speed;
		e.brain.grit = TOUGHNESS;
		e.brain.directed = true;
		e.brain.alert = 10;
		e.brain.rage = this.learned.length > 0 ? Math.min(1, this.stage / 4) : 0;
		// It keeps everything it has learned
		for (const l of this.learned) for (const id of l.copies) if (!e.brain.kit.includes(id)) e.brain.kit.push(id);
		return e;
	}

	private fight(game: Game, dt: number) {
		const prime = this.prime!;
		if (!isStanding(prime)) {
			this.breakPrime(game, prime);
			return;
		}
		const hp = prime.hp / prime.maxHp;
		const next = LEARN_AT[this.stage - 1];
		if (next !== undefined && hp <= next) {
			this.startLearning(game, prime);
			return;
		}
		this.intent(game, prime, dt);
		if (hp < 0.85) this.once('hint', () => this.comms.say('John', 'It is tracking everything we build. Hal, mix it up. Do not give it a pattern.'));
	}

	/** Prime picks on each Lantern in turn, so neither gets to stand back and shoot. */
	private intent(game: Game, prime: Enemy, dt: number) {
		const b = prime.brain;
		const up = game.players.filter((p) => !p.downed);
		if (up.length === 0) return;
		if (!b.target || (b.target as Player).downed) b.target = up[0];
		this.switchIn -= dt;
		if (this.switchIn > 0 || up.length < 2 || (b.state !== 'move' && b.state !== 'idle')) return;
		this.switchIn = SWITCH_EVERY + Math.random() * SWITCH_SPREAD;
		b.target = up.find((p) => p !== b.target) ?? up[0];
		b.engaged = false;
		b.focusTime = 0;
	}

	// ------------------------------------------------------------ learning

	/** It stops, and pulls the light of each Lantern's favourite construct out of their ring. */
	private startLearning(game: Game, prime: Enemy) {
		this.phase = 'learning';
		this.clock = 0;
		this.heldHp = prime.hp;
		this.siphons = game.players.filter((p) => !p.hero && mostUsed(p) !== null);
		game.constructs.effects.push({ kind: 'callout', x: prime.x, y: prime.y - 330, age: 0, life: LEARN_TIME, text: 'ANALYSING', hurt: true });
		this.comms.say('Manhunter Prime', this.stage === 1 ? 'SUFFICIENT DATA. ANALYSING.' : 'FURTHER DATA. ANALYSING.', true);
	}

	private learning(game: Game) {
		const prime = this.prime!;
		// It can't be hurt or moved while it does it
		prime.hp = prime.brain.lastHp = this.heldHp;
		prime.stun = Math.max(prime.stun, 0.2);
		prime.vx = prime.vy = 0;
		if (this.clock < LEARN_TIME) return;

		const names: string[] = [];
		for (const p of this.siphons) {
			const id = mostUsed(p);
			if (!id) continue;
			const def = defOf(id);
			if (!def) continue;
			p.locked.add(id);
			// Drop it if it's in hand
			if (p.loadout[p.selected]?.id === id) {
				const free = p.loadout.findIndex((d) => !p.locked.has(d.id));
				if (free >= 0) p.selected = free;
				p.firing = false;
				p.charge = 0;
			}
			const copies = COPIES[def.behavior] ?? DEFAULT_COPY;
			this.learned.push({ from: p.def.id, construct: id, copies });
			for (const c of copies) {
				if (!prime.brain.kit.includes(c)) prime.brain.kit.push(c);
				prime.brain.cooldowns[c] = Math.min(prime.brain.cooldowns[c] ?? 0, 1);
			}
			names.push(def.name.toUpperCase());
			game.constructs.effects.push({ kind: 'callout', x: p.x, y: p.y, age: 0, life: 2.2, text: `${def.short ?? def.name} LOCKED`.toUpperCase(), owner: p, hurt: true });
		}
		this.siphons = [];
		this.stage = (this.stage + 1) as 2 | 3 | 4;
		prime.brain.rage = Math.min(1, (this.stage - 1) / 3);
		game.constructs.effects.push({ kind: 'callout', x: prime.x, y: prime.y - 330, age: 0, life: 2.4, text: names.length > 0 ? `LEARNED: ${names.join(' + ')}` : 'NOTHING TO LEARN', hurt: true });
		this.wakeRanks(game, WAKES[this.stage - 2]);
		if (this.stage === 4) {
			prime.brain.might *= OVERDRIVE.might;
			prime.brain.speedMul *= OVERDRIVE.speed;
		}
		this.phase = 'fight';
		this.clock = 0;
		this.talkAboutIt(names);
	}

	private talkAboutIt(names: string[]) {
		const taken = names.join(' and ').toLowerCase();
		if (this.stage === 2) {
			this.comms.scene([
				['Manhunter Prime', 'CONSTRUCTS ACQUIRED. YOUR RINGS WILL NOT MAKE THEM AGAIN.'],
				['Hal', names.length > 0 ? `My ring just forgot the ${taken}. And that thing is glowing GREEN.` : 'It tried to take something and came up empty. Keep it that way.'],
				['John', 'It runs on the same light we do: the Guardians built it that way. Whatever we lean on, it takes. So lean on nothing.']
			]);
		} else if (this.stage === 3) {
			this.comms.scene([
				['Manhunter Prime', 'YOU REPEAT YOURSELVES. THAT IS WHY YOU WERE NOT BETTER. ONLY NEWER.'],
				['John', 'The ranks are waking faster. Hal, I will hold them off you. Hit it with something it has not seen!']
			]);
		} else {
			this.comms.scene([
				['Manhunter Prime', 'ANALYSIS COMPLETE. NO MAN ESCAPES THE MANHUNTERS.'],
				['Hal', "It's done studying. That means it's scared. Everything we've got left, John!"]
			]);
		}
	}

	// ------------------------------------------------------------ the ranks

	/** The alcoves nearest the fight empty first. */
	private wakeRanks(game: Game, wave: { manhunters: number; drones: number }) {
		for (let i = 0; i < wave.manhunters + wave.drones; i++) {
			const alcove = ALCOVES[(this.woken * 5 + 3) % ALCOVES.length];
			this.woken++;
			const x = alcove.x;
			const y = alcove.y + 90;
			if (i < wave.manhunters) {
				const m = game.spawnEnemy('manhunter', x, y);
				m.maxHp = Math.round(m.maxHp * MANHUNTER_HEALTH);
				m.hp = m.brain.lastHp = m.maxHp;
				m.brain.might = MANHUNTER_MIGHT;
				m.brain.grit = TOUGHNESS;
				m.brain.alert = 10;
				this.ranks.push(m);
			} else {
				const d = game.spawnEnemy('manhunterDrone', x, y);
				d.brain.might = DRONE_MIGHT;
				d.hp = d.maxHp = d.brain.lastHp = Math.round(d.maxHp * DRONE_HEALTH);
				d.brain.alert = 10;
			}
		}
	}

	/** Broken rank and file rebuild round their cores while Prime still thinks for them. */
	private rebuildRanks(game: Game, dt: number) {
		// With Prime in pieces, nothing is thinking for them: they hang there, and nothing rebuilds
		const thinking = this.phase !== 'fallen' && this.phase !== 'core';
		if (this.phase === 'core') for (const e of game.enemies) if (isStanding(e)) e.stun = Math.max(e.stun, 0.3);
		for (const m of this.ranks) {
			if (isStanding(m) || this.counted.has(m)) continue;
			this.counted.add(m);
			if (!thinking) continue;
			const core = createDummy(m.x, m.y);
			core.kind = 'manhunterCore';
			core.hp = core.maxHp = RANK_CORE_HP;
			core.respawns = false;
			core.rebuild = 0;
			game.dummies.push(core);
			this.rankCores.push(core);
		}
		for (const core of [...this.rankCores]) {
			core.x = core.prevX = core.homeX;
			core.y = core.prevY = core.homeY;
			core.vx = core.vy = 0;
			const remove = () => {
				this.rankCores.splice(this.rankCores.indexOf(core), 1);
				const i = game.dummies.indexOf(core);
				if (i >= 0) game.dummies.splice(i, 1);
			};
			if (!isStanding(core) || this.phase === 'fallen') {
				remove();
				continue;
			}
			if (!thinking) continue;
			core.rebuild = Math.min(1, (core.rebuild ?? 0) + dt / RANK_REBUILD);
			if (core.rebuild < 1) continue;
			remove();
			const m = game.spawnEnemy('manhunter', core.x, core.y);
			m.maxHp = Math.round(m.maxHp * MANHUNTER_HEALTH);
			m.hp = m.brain.lastHp = Math.round(m.maxHp * 0.45);
			m.brain.might = MANHUNTER_MIGHT;
			m.brain.grit = TOUGHNESS;
			m.brain.alert = 10;
			this.ranks.push(m);
		}
	}

	// -------------------------------------------------------------- the core

	private breakPrime(game: Game, prime: Enemy) {
		this.phase = 'core';
		this.clock = 0;
		const core = createDummy(prime.x, prime.y);
		core.kind = 'manhunterCore';
		core.hp = core.maxHp = Math.round(CORE_HP * CORE_WEAR ** this.rebuilds);
		core.respawns = false;
		core.rebuild = 0;
		core.scale = 2;
		game.dummies.push(core);
		this.core = core;
		this.comms.say(this.rebuilds === 0 ? 'John' : 'Hal', this.rebuilds === 0 ? 'It is down, but it is a Manhunter: the core, Hal! Before it pulls itself together!' : 'Again?! The core, the core, THE CORE!', true);
	}

	private rebuildPrime(game: Game, dt: number) {
		const core = this.core!;
		core.x = core.prevX = core.homeX;
		core.y = core.prevY = core.homeY;
		core.vx = core.vy = 0;
		const remove = () => {
			const i = game.dummies.indexOf(core);
			if (i >= 0) game.dummies.splice(i, 1);
			this.core = null;
		};
		if (!isStanding(core)) {
			remove();
			this.fall(game, core);
			return;
		}
		core.rebuild = Math.min(1, (core.rebuild ?? 0) + dt / REBUILD_TIME);
		if (core.rebuild < 1) return;
		remove();
		this.rebuilds++;
		this.prime = this.spawnPrime(game, REBUILT_HEALTH);
		this.prime.x = this.prime.prevX = core.x;
		this.prime.y = this.prime.prevY = core.y;
		this.phase = 'fight';
		this.clock = 0;
		this.comms.say('Manhunter Prime', 'I WAS BUILT TO OUTLAST STARS. YOU ARE NOT EVEN A DELAY.', true);
	}

	/** The core goes, and with it the mind of every Manhunter. The rings get their light back. */
	private fall(game: Game, core: Dummy) {
		this.phase = 'fallen';
		this.clock = 0;
		game.constructs.effects.push({ kind: 'callout', x: core.x, y: core.y - 140, age: 0, life: 2.6, text: 'MANHUNTER PRIME DESTROYED' });
		game.constructs.effects.push({ kind: 'snap', x: core.x, y: core.y - 40, age: 0, life: 0.9, radius: 220 });
		for (const e of game.enemies) {
			if (!isStanding(e)) continue;
			this.counted.add(e);
			e.hp = 0;
			e.down = 1;
		}
		for (const p of game.players) {
			if (p.locked.size > 0) game.constructs.effects.push({ kind: 'snap', x: p.x, y: p.y - 50, age: 0, life: 0.7, radius: 70 });
			p.locked.clear();
			p.invuln = 99;
		}
		this.comms.clear();
		this.comms.scene([
			['Manhunter Prime', 'THE RED ONE... SAID YOU WOULD COME. HE SAID... YOU ALWAYS CLEAN UP... AFTER THEM.'],
			['Hal', "The red one. Atrocitus. He didn't want an army, John. He wanted us down here, looking the other way."],
			['John', 'Then where was he looking?'],
			['The ring', 'Priority alert, all sectors. Red Lantern fleet massing in Sector 666. Heading: Oa.'],
			['Hal', "...There. My ring's got its light back. Yours?"],
			['John', 'All of it. Good. We are going to need everything.']
		]);
	}

	private once(key: string, run: () => void) {
		if (this.said.has(key)) return;
		this.said.add(key);
		run();
	}

	private countDowns(game: Game) {
		const me = game.players[0];
		if (me.downed && !this.wasDown) {
			this.lives--;
			this.downs++;
			if (this.lives <= 0) {
				this.state = 'lost';
				this.failReason = 'lantern';
				game.downedNotice = false;
				this.comms.clear();
			} else this.comms.say(me.def.id === 'hal' ? 'John' : 'Hal', me.def.id === 'hal' ? 'Jordan! On your feet, Marine rules: nobody stays down!' : "John! Up! I can't do this one on my own!");
		}
		this.wasDown = me.downed;
	}

	private win(game: Game) {
		this.state = 'won';
		this.timer = 0;
		for (const p of game.players) p.victoryTimer = 0.4;
	}

	// -------------------------------------------------------------- drawing

	cameraPoints(): [number, number][] {
		const p = this.prime;
		if (this.phase === 'descent') return [[DAIS.x, DAIS.y - 120]];
		if (this.phase === 'learning' && p) return [[p.x, p.y - 150]];
		return [];
	}

	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		const power = this.phase === 'fallen' ? 0 : this.phase === 'descent' ? Math.min(1, this.clock / 5) : 1;
		const list: Drawable[] = [
			{ baseY: 0, draw: () => drawCliff(ctx, 0, W, WALL) },
			{ baseY: 2, draw: () => drawPrimeDais(ctx, DAIS.x, DAIS.y, time, power) }
		];
		// The ranks along the back wall; the ones that have walked out leave their alcoves dark
		const empty = new Set(Array.from({ length: Math.min(this.woken, ALCOVES.length) }, (_, i) => (i * 5 + 3) % ALCOVES.length));
		ALCOVES.forEach((a, i) => {
			if (empty.has(i)) return;
			const awake = this.phase === 'fallen' ? 0 : 0.15 + 0.2 * (this.stage - 1);
			list.push({ baseY: a.y, draw: () => drawDormant(ctx, a.x, a.y, awake, time) });
		});
		// Before it wakes: Prime stands on the dais like the rest of them, only bigger
		if (this.phase === 'descent') list.push({ baseY: DAIS.y, draw: () => drawWaiting(ctx, time, this.clock / 5) });
		const prime = this.prime;
		if (this.phase === 'learning' && prime) {
			const k = Math.min(1, this.clock / LEARN_TIME);
			for (const p of this.siphons) list.push({ baseY: H + 500, draw: () => drawSiphon(ctx, p.x + p.dir * 14, p.y - p.ringLift, prime.x, prime.y - 165, k, time) });
		}
		return list;
	}
}

/** Prime before it moves: a dormant giant on the dais, its eyes coming up. */
function drawWaiting(ctx: CanvasRenderingContext2D, time: number, k: number) {
	ctx.save();
	ctx.translate(DAIS.x, DAIS.y);
	ctx.scale(2.1, 2.1);
	ctx.translate(-DAIS.x, -DAIS.y);
	drawDormant(ctx, DAIS.x, DAIS.y, Math.min(1, k * 1.2), time);
	ctx.restore();
}
