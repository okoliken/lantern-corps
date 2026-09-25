// Act 2, Mission 4: The Guardians' Shame.
//
// The Guardians built the Manhunters, and buried them on a dead world when
// they went wrong. Now Atrocitus wants them. Hal, Kilowog and Razer (out of
// his cell, guiding them, and not doing it for the Corps) reach the vault
// with the Red Lanterns already cutting at the seal.
//
//   reds       Red Lanterns at the seal: fight them, with Kilowog and Razer
//   breakout   the seal fails and Manhunters pour out. They attack everyone:
//              Reds and Manhunters tear into each other as well as you. Broken
//              Manhunters rebuild round their cores unless the cores are smashed
//   reseal     three pylons round the door: charge each one (stand by it) while
//              it all goes on. Sealed, nothing more comes out
//   bleez      Bleez leads the Reds' last push, with words for the traitor
//   sealed     the vault holds, but a handful of Manhunters got away, toward
//              Earth (Sleepers). Razer has earned a little trust
//
// Lose: Hal goes down 3 times.

import { createDummy, isStanding, type Dummy } from '../dummy';
import { drawCliff, drawPylon, drawSealBeam, drawVaultDoor } from '../draw/vault';
import { ENEMIES, type Enemy, type EnemyKind, type Role } from '../enemies/enemies';
import { hitDummyWithFx } from '../constructs/system';
import type { Drawable, Game } from '../game';
import { heroFx } from '../heroes';
import { seededRandom, type GameMap, type Obstacle } from '../map';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

export type ShamePhase = 'reds' | 'breakout' | 'reseal' | 'bleez' | 'sealed';

const SHAME_LIVES = 3;
const INTRO_TIME = 3;
/** Three stars: done within this many seconds. */
const PAR_TIME = 480;
/** Red Lanterns: health and hitting power on top of their base. */
const TOUGHNESS = 3.6;
const MIGHT = 3.2;
/** Bleez. */
const BLEEZ_HEALTH = 6.5;
const BLEEZ_MIGHT = 3.2;
/** Manhunters, and how they rebuild. */
const MANHUNTER_HEALTH = 0.7;
const MANHUNTER_MIGHT = 2.8;
const CORE_HP = 320;
export const REBUILD_TIME = 7;
const REBUILT_HEALTH = 0.45;
/** Each rebuild wears the cores down: a core's health is this share of the last one's (so it can't go on for ever). */
const CORE_WEAR = 0.75;
/** Seconds between Manhunters coming out of the open vault, at most this many up at once, and the most that get away. */
const SPILL_EVERY = 16;
const SPILL_CAP = 3;
const MOST_ESCAPED = 9;
/** A pylon charges while a Lantern is within this reach, and takes this long. */
const PYLON_REACH = 130;
export const PYLON_TIME = 10;
/** Reds and Manhunters shoot each other from this far, this often, for this much. */
const FEUD_RANGE = 460;
const FEUD_EVERY = 1.1;
const FEUD_DAMAGE = 22;
/** The most one hit can take off a Lantern. */
const MAX_HIT = 36;

const W = 3000;
const H = 1900;
/** The cliff runs along the top of the map; the vault door is set into it, facing you. */
const CLIFF = 470;
const ENTRY = { x: 520, y: 1560 };
const DOOR = { x: 1500, y: CLIFF };
export const PYLONS: { x: number; y: number }[] = [
	{ x: 820, y: 860 },
	{ x: 1500, y: 1060 },
	{ x: 2180, y: 860 }
];

type Wave = [EnemyKind, number, number, Role?][];
// Offsets from the vault door (down the screen is away from the cliff)
const AT_THE_SEAL: Wave = [
	['rageGrunt', -300, 180, 'berserker'],
	['rageGrunt', 300, 180, 'berserker'],
	['rageGrunt', -150, 320, 'hunter'],
	['rageGrunt', 150, 320, 'hunter'],
	['rageGrunt', -440, 430, 'gunner'],
	['rageGrunt', 440, 430, 'gunner'],
	['rageGrunt', 0, 240, 'berserker'],
	['rageGrunt', 0, 500, 'hunter']
];
/** Each pylon lit brings these down on it (as well as another Manhunter out of the vault). */
const AT_THE_PYLON: Wave = [
	['rageGrunt', -260, 380, 'berserker'],
	['rageGrunt', 260, 380, 'gunner'],
	['rageGrunt', 0, 520, 'hunter']
];
/** The first ones out don't stop to fight: they have somewhere to be. */
const FIRST_ESCAPES = 3;
const RED_REINFORCEMENTS: Wave = [
	['rageGrunt', -1250, 1200, 'berserker'],
	['rageGrunt', 1250, 1200, 'hunter'],
	['rageGrunt', -1350, 640, 'gunner'],
	['rageGrunt', 1350, 640, 'gunner']
];
/** Offsets from where Bleez comes in, at the far end from the vault. */
const BLEEZ_FROM = { x: 1500, y: 1680 };
const BLEEZ_GUARD: Wave = [
	['rageGrunt', -320, -60, 'berserker'],
	['rageGrunt', 320, -60, 'hunter'],
	['rageGrunt', 0, 120, 'gunner'],
	['rageGrunt', -560, 40, 'gunner'],
	['rageGrunt', 560, 40, 'berserker']
];

/** A dead world: broken rock across the plain, the vault set into the cliff at the far end. */
export function buildVaultMap(): GameMap {
	const rand = seededRandom(666);
	const obstacles: Obstacle[] = [];
	for (let i = 0; i < 26; i++) {
		const size = 40 + rand() * 60;
		const x = 250 + rand() * (W - 500);
		const y = CLIFF + 80 + rand() * (H - CLIFF - 260);
		// Not in the cliff, on the pylons, or in front of the door
		if (y < CLIFF + 80 || PYLONS.some((p) => Math.hypot(x - p.x, y - p.y) < 220) || Math.hypot(x - DOOR.x, y - DOOR.y) < 520) continue;
		obstacles.push({ kind: 'rock', x, y, w: size, h: size * 0.55, height: 12 + size * 0.25, blocksFlying: false, seed: rand() });
	}
	// The cliff the vault is set into: solid rock, all the way along the top
	obstacles.push({ kind: 'building', x: 0, y: 0, w: W, h: CLIFF, height: 0, blocksFlying: true, seed: 0.5, hidden: true });
	return {
		name: 'The Vault',
		environment: 'planet',
		ground: 'vault',
		width: W,
		height: H,
		spawn: ENTRY,
		battery: { x: ENTRY.x - 200, y: ENTRY.y - 60 },
		dummies: [],
		obstacles
	};
}

export class GuardiansShame implements MissionDirector {
	state: MissionState = 'intro';
	phase: ShamePhase = 'reds';
	timer = INTRO_TIME;
	lives = SHAME_LIVES;
	elapsed = 0;
	downs = 0;
	defeated = 0;
	/** Manhunters that got away out of the open vault. */
	escaped = 0;
	failReason: 'lantern' | null = null;
	readonly comms = new Comms();
	readonly starHint = '★ the vault sealed · ★ no lives lost · ★ under 8 minutes';
	/** How much of the Guardians' seal is left (1..0). */
	seal = 1;
	/** How far each pylon is charged (0..1). */
	readonly charge = PYLONS.map(() => 0);
	bleez: Enemy | null = null;
	/** Broken Manhunters, rebuilding round their cores. */
	readonly cores: Dummy[] = [];
	/** Times a Manhunter has pulled itself back together. */
	rebuilds = 0;
	private reds: Enemy[] = [];
	private manhunters: Enemy[] = [];
	private counted = new WeakSet<Enemy>();
	private wasDown = false;
	private clock = 0;
	private spill = 0;
	private feudAt = new WeakMap<Enemy, number>();
	private said = new Set<string>();
	private charging = PYLONS.map(() => false);

	// ------------------------------------------------------------ reporting

	get objective(): string {
		switch (this.phase) {
			case 'reds':
				return 'Stop the Red Lanterns cutting the seal';
			case 'breakout':
				return 'Manhunters! Break them, and smash their cores';
			case 'reseal':
				return `Charge the seal pylons (${this.charge.filter((c) => c >= 1).length}/3): stand by each one`;
			case 'bleez':
				return 'Bleez: hold the vault';
			case 'sealed':
				return 'The vault holds';
		}
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const list: MissionMeter[] = [];
		if (this.phase === 'reds') list.push({ label: 'Seal', value: this.seal, text: `${Math.round(this.seal * 100)}%`, low: this.seal < 0.35 });
		if (this.phase === 'reseal') list.push({ label: 'Pylons', value: this.charge.reduce((a, b) => a + b, 0) / 3, text: `${this.charge.filter((c) => c >= 1).length}/3` });
		if (this.bleez && isStanding(this.bleez)) list.push({ label: 'Bleez', value: this.bleez.hp / this.bleez.maxHp, text: '' });
		const core = this.cores[0];
		if (core) list.push({ label: 'Core', value: core.hp / core.maxHp, text: `${Math.ceil((1 - (core.rebuild ?? 0)) * REBUILD_TIME)}s`, low: true });
		return list;
	}

	warning(): string | null {
		if (this.cores.some((c) => (c.rebuild ?? 0) > 0.6)) return 'A MANHUNTER IS REBUILDING: SMASH THE CORE';
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.downs === 0 ? 1 : 0) + (this.elapsed <= PAR_TIME ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'won') return `The vault is sealed again. ${this.escaped} Manhunters got out before it closed, and they were heading for Earth.`;
		return 'Hal went down one time too many.';
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		return [
			{ label: 'Red Lanterns beaten', value: `${this.defeated}` },
			{ label: 'Manhunters that escaped', value: `${this.escaped}` },
			{ label: 'Lives lost', value: `${this.downs}` },
			{ label: 'Time', value: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
		];
	}

	/** The pylons won't charge themselves: go to them, fight or no fight. */
	get goalFirst(): boolean {
		return this.phase === 'reseal' && this.cores.length === 0;
	}

	goal(): { x: number; y: number } | null {
		const core = this.cores[0];
		if (core) return core;
		if (this.phase === 'reseal') {
			const i = this.charge.findIndex((c) => c < 1);
			return i >= 0 ? PYLONS[i] : null;
		}
		if (this.phase === 'bleez' && this.bleez && isStanding(this.bleez)) return this.bleez;
		if (this.phase === 'reds') return DOOR;
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
					this.spawn(game, AT_THE_SEAL, DOOR);
					this.comms.scene([
						['Razer', "There. Atrocitus's vanguard, cutting the seal. Bleez leads them. She will not be far."],
						['Kilowog', "Your old friends, Razer. You gonna be alright with this?"],
						['Razer', 'They are not my friends. They are what I was. Kill the seal-cutters first, or nothing else matters.']
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
		this.feud(game, dt);
		this.rebuild(game, dt);
		this.razerTalks(game);

		switch (this.phase) {
			case 'reds': {
				// Every Red still up is cutting at the seal; it fails on its own if you're slow
				const cutters = this.reds.filter((e) => isStanding(e) && Math.hypot(e.x - DOOR.x, e.y - DOOR.y) < 700).length;
				this.seal = Math.max(0, this.seal - cutters * 0.004 * dt);
				if (this.reds.every((e) => !isStanding(e)) || this.seal <= 0) this.breakout(game);
				break;
			}
			case 'breakout':
				this.spillManhunters(game, dt);
				if (this.clock >= 6) {
					this.phase = 'reseal';
					this.comms.scene([
						['Razer', 'The pylons. The seal came from them; it can again. Stand by each one and pour your light into it.'],
						['Hal', "While being shot at by everybody. Great. Kilowog, keep 'em off me!"]
					]);
				}
				break;
			case 'reseal':
				this.spillManhunters(game, dt);
				this.chargePylons(game, dt);
				if (this.charge.every((c) => c >= 1)) this.bleezArrives(game);
				break;
			case 'bleez':
				if (this.bleez && !isStanding(this.bleez) && game.enemies.every((e) => !isStanding(e)) && this.cores.length === 0) this.sealed(game);
				break;
			case 'sealed':
				if (!this.comms.current) this.win(game);
				break;
		}
	}

	private spawn(game: Game, wave: Wave, at: { x: number; y: number }): Enemy[] {
		const list = wave.map(([kind, dx, dy, role]) => {
			const e = game.spawnEnemy(kind, at.x + dx, at.y + dy, role);
			e.brain.grit = TOUGHNESS;
			e.brain.might = MIGHT;
			e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * TOUGHNESS);
			e.brain.alert = 10;
			return e;
		});
		this.reds = [...this.reds.filter(isStanding), ...list];
		return list;
	}

	/** The seal fails: the vault opens and the Manhunters come out. */
	private breakout(game: Game) {
		this.phase = 'breakout';
		this.clock = 0;
		this.seal = 0;
		for (const dx of [-130, 130]) this.spawnManhunter(game, DOOR.x + dx, DOOR.y + 140);
		for (const dx of [-260, 0, 260]) this.spawnDrone(game, DOOR.x + dx, DOOR.y + 260);
		this.spawn(game, RED_REINFORCEMENTS, DOOR);
		game.constructs.effects.push({ kind: 'callout', x: DOOR.x, y: DOOR.y + 60, age: 0, life: 2.2, text: 'THE VAULT OPENS', hurt: true });
		// The first ones out streak straight off into the sky
		this.escaped += FIRST_ESCAPES;
		for (let i = 0; i < FIRST_ESCAPES; i++) {
			heroFx(game.constructs).push({ kind: 'zip', x: DOOR.x, y: DOOR.y - 150, x2: DOOR.x - 900 + i * 900, y2: -500, age: -i * 0.25, life: 0.9 });
		}
		this.comms.scene([
			['Razer', 'Too late. They are awake.'],
			['Kilowog', "Manhunters! Hal, they'll go for the Reds same as us. Let 'em!"],
			['Hal', 'And the Reds will go for them. Fine by me. Those three that just took off: where are THEY going?']
		]);
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

	private spawnDrone(game: Game, x: number, y: number) {
		const d = game.spawnEnemy('manhunterDrone', x, y);
		d.brain.might = MIGHT;
		d.hp = d.maxHp = d.brain.lastHp = Math.round(d.maxHp * 2.5);
		d.brain.alert = 10;
	}

	/** While the vault is open, more keep coming; some fly straight off, away from the fight. */
	private spillManhunters(game: Game, dt: number) {
		this.spill += dt;
		if (this.spill < SPILL_EVERY) return;
		this.spill = 0;
		const up = this.manhunters.filter(isStanding).length;
		if (up < SPILL_CAP) this.spawnManhunter(game, DOOR.x, DOOR.y + 140);
		else if (this.escaped < MOST_ESCAPED) {
			// The vault is crowded: this one doesn't stop to fight
			this.escaped++;
			heroFx(game.constructs).push({ kind: 'zip', x: DOOR.x, y: DOOR.y - 150, x2: DOOR.x + 700, y2: -500, age: 0, life: 0.8 });
			game.constructs.effects.push({ kind: 'callout', x: DOOR.x, y: DOOR.y - 60, age: 0, life: 1.8, text: 'ONE GOT AWAY', hurt: true });
			this.once('escaped', () => this.comms.say('Kilowog', "That one ain't stopping! Where's it going?!", true));
		}
	}

	/** Stand by a pylon to charge it (any Lantern, but a hero can't). */
	private chargePylons(game: Game, dt: number) {
		PYLONS.forEach((pylon, i) => {
			if (this.charge[i] >= 1) {
				this.charging[i] = false;
				return;
			}
			const near = game.players.some((p) => !p.hero && !p.downed && Math.hypot(p.x - pylon.x, p.y - pylon.y) < PYLON_REACH);
			this.charging[i] = near;
			if (!near) return;
			this.charge[i] = Math.min(1, this.charge[i] + dt / PYLON_TIME);
			if (this.charge[i] >= 1) {
				game.constructs.effects.push({ kind: 'snap', x: pylon.x, y: pylon.y - 160, age: 0, life: 0.7, radius: 70 });
				const left = this.charge.filter((c) => c < 1).length;
				if (left > 0) {
					this.comms.say('Razer', left === 2 ? 'One. The seal feels it, and so do they. Two more.' : 'One more. Hurry.', true);
					// Both sides know what a lit pylon means
					this.spawn(game, AT_THE_PYLON, pylon);
					if (this.manhunters.filter(isStanding).length < SPILL_CAP + 1) this.spawnManhunter(game, DOOR.x, DOOR.y + 140);
				}
			}
		});
	}

	/** Three pylons lit: the seal closes. Bleez arrives too late to stop it, and in a rage. */
	private bleezArrives(game: Game) {
		this.phase = 'bleez';
		this.clock = 0;
		// Nothing more comes out
		this.bleez = game.spawnEnemy('bleez', BLEEZ_FROM.x, BLEEZ_FROM.y - 120);
		this.bleez.hp = this.bleez.maxHp = this.bleez.brain.lastHp = Math.round(this.bleez.maxHp * BLEEZ_HEALTH);
		this.bleez.brain.might = BLEEZ_MIGHT;
		this.bleez.brain.grit = TOUGHNESS;
		this.bleez.brain.alert = 10;
		this.spawn(game, BLEEZ_GUARD, BLEEZ_FROM);
		game.constructs.effects.push({ kind: 'callout', x: DOOR.x, y: DOOR.y + 60, age: 0, life: 2, text: 'SEALED' });
		this.comms.scene([
			['Bleez', 'Razer. Atrocitus said you were dead. I told him you were worse: you were theirs.'],
			['Razer', 'I am nobody\'s, Bleez. I am here because of what is behind that door. So are you, if you remember.'],
			['Bleez', 'I remember. I remember you begging. Lanterns, whichever colour: you die here.']
		]);
	}

	/** The vault holds. */
	private sealed(game: Game) {
		this.phase = 'sealed';
		for (const p of game.players) p.invuln = 99;
		this.comms.scene([
			['Kilowog', "It's holding. Sealed, for real this time."],
			['Hal', `Not before ${this.escaped === 0 ? 'nothing' : this.escaped === 1 ? 'one of them' : `${this.escaped} of them`} got out. They weren't running from us, Kilowog. They were going somewhere.`],
			['Razer', 'Earth. Your ring came from there; the machine on Earth woke when they did. They are going to it.'],
			['Kilowog', "...Thanks, Razer. For real."],
			['Razer', "Don't. I did not do it for you."],
			['Hal', 'Get the Guardians on the line. And John. Earth is about to have a very bad night.']
		]);
	}

	// ------------------------------------------------------ the three sides

	/** Reds and Manhunters hate each other: near enough, they shoot each other, not just you. */
	private feud(game: Game, dt: number) {
		void dt;
		const up = game.enemies.filter(isStanding);
		const reds = up.filter((e) => ENEMIES[e.kind].faction === 'red');
		const machines = up.filter((e) => ENEMIES[e.kind].faction === 'manhunter');
		if (reds.length === 0 || machines.length === 0) return;
		const now = this.elapsed;
		for (const [side, others] of [
			[reds, machines],
			[machines, reds]
		] as const) {
			for (const e of side) {
				if ((this.feudAt.get(e) ?? -99) + FEUD_EVERY > now) continue;
				let target: Enemy | null = null;
				let best = FEUD_RANGE;
				for (const o of others) {
					const d = Math.hypot(o.x - e.x, o.y - e.y);
					if (d < best) {
						best = d;
						target = o;
					}
				}
				if (!target) continue;
				this.feudAt.set(e, now + Math.random() * 0.5);
				const red = ENEMIES[e.kind].faction === 'red';
				hitDummyWithFx(game.constructs, target, FEUD_DAMAGE * (red ? MIGHT : MANHUNTER_MIGHT) * 0.5, 80, e.x, e.y, null, FEUD_DAMAGE, false);
				heroFx(game.constructs).push({ kind: 'bolt', x: e.x, y: e.y, x2: target.x, y2: target.y, age: 0, life: 0.25, lift: 46, red });
			}
		}
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
			this.once('core', () => this.comms.say('Kilowog', "It's in pieces but it ain't dead! Smash the core before it gets back up!", true));
		}
		for (const core of [...this.cores]) {
			core.x = core.prevX = core.homeX;
			core.y = core.prevY = core.homeY;
			core.vx = core.vy = 0;
			if (!isStanding(core)) {
				this.cores.splice(this.cores.indexOf(core), 1);
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

	/** Razer, fighting his old side, has things to say. */
	private razerTalks(game: Game) {
		const razer = game.players.find((p) => p.def.id === 'razer');
		if (!razer) return;
		if (this.defeated >= 3) this.once('r3', () => this.comms.say('Razer', 'They were promised the Reds would burn Oa. Atrocitus promises a great deal.'));
		if (razer.health < razer.maxHealth * 0.4) this.once('rhurt', () => this.comms.say('Razer', 'Rage keeps me standing, Lantern. It always has. Keep fighting.'));
		if (this.phase === 'breakout') this.once('rmh', () => this.comms.say('Razer', 'Look at them. THIS is what your Guardians made. This is what killed my world.'));
	}

	private once(key: string, run: () => void) {
		if (this.said.has(key)) return;
		this.said.add(key);
		run();
	}

	private countDefeats() {
		for (const e of this.reds) {
			if (!isStanding(e) && !this.counted.has(e)) {
				this.counted.add(e);
				this.defeated++;
			}
		}
	}

	private countDowns(game: Game) {
		const hal = game.players[0];
		if (hal.downed && !this.wasDown) {
			this.lives--;
			this.downs++;
			if (this.lives <= 0) {
				this.state = 'lost';
				this.failReason = 'lantern';
				game.downedNotice = false;
				this.comms.clear();
			} else this.comms.say('Kilowog', 'Jordan! Up! They don\'t stop, so we don\'t!');
		}
		this.wasDown = hal.downed;
	}

	private win(game: Game) {
		this.state = 'won';
		this.timer = 0;
		for (const p of game.players) p.victoryTimer = 0.4;
	}

	// -------------------------------------------------------------- drawing

	cameraPoints(): [number, number][] {
		if (this.phase === 'breakout') return [[DOOR.x, DOOR.y - 100]];
		return [];
	}

	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		const open = this.phase === 'reds' ? 0 : this.phase === 'breakout' || this.phase === 'reseal' ? Math.min(1, this.clock / 3 + (this.phase === 'reseal' ? 1 : 0)) : 0.15;
		const resealed = this.phase === 'bleez' || this.phase === 'sealed' ? 1 : 0;
		const list: Drawable[] = [
			{ baseY: 0, draw: () => drawCliff(ctx, 0, W, CLIFF) },
			{ baseY: 1, draw: () => drawVaultDoor(ctx, DOOR.x, DOOR.y, time, this.seal, open, resealed) }
		];
		PYLONS.forEach((p, i) => {
			list.push({ baseY: p.y, draw: () => drawPylon(ctx, p.x, p.y, this.charge[i], this.charging[i], time) });
			if (this.charge[i] >= 1) list.push({ baseY: DOOR.y + 1, draw: () => drawSealBeam(ctx, p.x, p.y, DOOR.x, DOOR.y, time) });
		});
		return list;
	}
}
