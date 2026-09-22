// Act 3, Mission 3: Into Sector 666.
//
// Ganthet is the only one who knows the way through the dead sector, the one
// the Manhunters burned, to Ysmault, where Atrocitus is going for the Book of
// the Black. Hal and John (you choose) and Arisia escort him.
//
//   crossing  Ganthet leads, slowly, and stops whenever the Red Lanterns are
//             on him: clear them, and he goes on. Rage storms drift across
//             the way: inside one, Lanterns burn and their willpower drains,
//             and Ganthet is hurt unless someone puts a bubble on him. Red
//             fighters fire torpedoes at him
//   gate      the Blood Gate into Ysmault's system, and Bleez holding it
//   open      Ganthet opens the gate
//
// Lose: Ganthet falls, or your Lantern goes down 3 times. The Lantern battery
// is Ganthet's own light: stay near him to recharge.

import { damagePlayer } from '../combat';
import { absorbWithShield, type Protectable } from '../constructs/system';
import { drawBloodGate, drawGanthetEscort, drawManhunterHusk, drawRageStorm, drawRedNebula } from '../draw/sector666';
import { isStanding, type Dummy } from '../dummy';
import type { Enemy, EnemyKind, Role } from '../enemies/enemies';
import type { Drawable, Game } from '../game';
import { seededRandom, type GameMap, type Obstacle } from '../map';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

export type CrossingPhase = 'crossing' | 'gate' | 'open';

export const CROSSING_LIVES = 3;
const INTRO_TIME = 3;
/** Ganthet: health, how fast he goes, and how close the Reds have to be to stop him. */
export const GANTHET_HP = 950;
export const GANTHET_SPEED = 46;
export const HALT_RANGE = 380;
/** Red Lanterns out here. */
const TOUGHNESS = 4;
const MIGHT = 3.9;
const BLEEZ_HEALTH = 9;
const BLEEZ_MIGHT = 4.2;
/** Rage storms: how many, how big, and what they do each second to a Lantern (health, willpower) and to Ganthet. */
const STORMS = 6;
export const STORM_RADIUS = 240;
const STORM_BURN = 10;
const STORM_DRAIN = 14;
const STORM_GANTHET = 15;
/** Torpedoes at Ganthet. */
export const TORPEDO = { radius: 14, hp: 18, speed: 210, damage: 36, lanternDamage: 14, lift: 60 };
const TORPEDO_EVERY: [number, number] = [3.5, 5.5];
/** Hunters come up behind Ganthet this often while he crosses, this many at a time. */
const HUNT_EVERY = 28;
const HUNTERS = 3;
/** Seconds for the gate to open once Bleez is down. */
const OPEN_TIME = 3;
/** The most one hit can take off a Lantern. */
const MAX_HIT = 36;

const W = 6200;
const H = 1800;
const LANE_Y = 900;
const START = { x: 480, y: LANE_Y };
export const GATE = { x: 5700, y: LANE_Y };
/** Where Ganthet waits for the gate. */
const GATE_STOP = GATE.x - 420;

type Wave = [EnemyKind, number, number, Role?][];
/** Red patrols, met as Ganthet gets this far across (offsets from him). */
const PATROLS: [atX: number, wave: Wave][] = [
	[
		900,
		[
			['rageGrunt', 620, -200, 'berserker'],
			['rageGrunt', 680, 180, 'hunter'],
			['rageGrunt', 760, 0, 'gunner'],
			['rageGrunt', 560, 320, 'berserker']
		]
	],
	[
		1700,
		[
			['redFighter', 900, -500],
			['redFighter', 950, 480],
			['redFighter', 1100, 0],
			['rageGrunt', 600, -160, 'berserker'],
			['rageGrunt', 640, 200, 'hunter']
		]
	],
	[
		2600,
		[
			['rageGrunt', 600, -260, 'berserker'],
			['rageGrunt', 620, 260, 'berserker'],
			['rageGrunt', 720, -80, 'hunter'],
			['rageGrunt', 720, 100, 'gunner'],
			['rageGrunt', -500, 300, 'hunter'],
			['rageGrunt', -520, -300, 'gunner']
		]
	],
	[
		3500,
		[
			['redFighter', 1000, -450],
			['redFighter', 1000, 450],
			['rageGrunt', 620, -240, 'berserker'],
			['rageGrunt', 640, 220, 'berserker'],
			['rageGrunt', 700, 0, 'gunner'],
			['skallox', 800, 0]
		]
	],
	[
		4400,
		[
			['redFighter', 900, -500],
			['redFighter', 900, 500],
			['redFighter', 1100, -150],
			['redFighter', 1100, 150],
			['rageGrunt', 600, -200, 'hunter'],
			['rageGrunt', 600, 200, 'hunter'],
			['rageGrunt', 680, 0, 'berserker']
		]
	]
];
/** At the gate, with Bleez. */
const GATE_GUARD: Wave = [
	['rageGrunt', -120, -300, 'berserker'],
	['rageGrunt', -120, 300, 'berserker'],
	['rageGrunt', -260, -140, 'gunner'],
	['rageGrunt', -260, 140, 'hunter']
];

/** The dead sector: red nebula, drifting Manhunter husks, the Blood Gate at the far end. */
export function buildSector666Map(): GameMap {
	const rand = seededRandom(666666);
	const obstacles: Obstacle[] = [];
	// Husks along the top and bottom of the way (solid)
	for (let i = 0; i < 16; i++) {
		const size = 90 + rand() * 70;
		const top = i % 2 === 0;
		obstacles.push({
			kind: 'asteroid',
			x: 300 + (i / 16) * (W - 900) + rand() * 120,
			y: top ? 60 + rand() * 120 : H - 60 - size * 0.8 - rand() * 120,
			w: size,
			h: size * 0.8,
			height: size,
			blocksFlying: true,
			seed: rand(),
			hidden: true
		});
	}
	return {
		name: 'Sector 666',
		environment: 'space',
		width: W,
		height: H,
		spawn: { x: START.x - 60, y: START.y + 150 },
		battery: { x: START.x, y: START.y },
		dummies: [],
		obstacles
	};
}

interface Storm {
	x: number;
	y: number;
	vy: number;
	vx: number;
	seed: number;
}

export class IntoSector666 implements MissionDirector {
	state: MissionState = 'intro';
	phase: CrossingPhase = 'crossing';
	timer = INTRO_TIME;
	lives = CROSSING_LIVES;
	elapsed = 0;
	downs = 0;
	defeated = 0;
	torpedoesDowned = 0;
	failReason: 'lantern' | 'ganthet' | null = null;
	readonly comms = new Comms();
	readonly starHint = '★ through the Blood Gate · ★ no lives lost · ★ Ganthet above half';
	/** Ganthet, leading the way (a bubble shield can go on him). */
	readonly ganthet: Protectable & { hp: number; moving: boolean; hit: number } = {
		x: START.x,
		y: START.y,
		name: 'Ganthet',
		radius: 70,
		lift: 60,
		threat: 0,
		hp: GANTHET_HP,
		moving: false,
		hit: 0
	};
	bleez: Enemy | null = null;
	readonly storms: Storm[] = [];
	private patrol = 0;
	private reds: Enemy[] = [];
	private counted = new WeakSet<Enemy>();
	private torpedoes = new Set<Dummy>();
	private burst = new WeakSet<Dummy>();
	private reloads = new WeakMap<Enemy, number>();
	private burnIn = new WeakMap<object, number>();
	private opening = 0;
	private huntIn = HUNT_EVERY;
	private wasDown = false;
	private clock = 0;
	private said = new Set<string>();
	private map: GameMap | null = null;
	private nebulae: { x: number; y: number; r: number; seed: number }[] = [];

	constructor() {
		const rand = seededRandom(66);
		for (let i = 0; i < STORMS; i++) {
			this.storms.push({ x: 1200 + i * 780 + rand() * 260, y: 300 + rand() * 1200, vy: (rand() < 0.5 ? -1 : 1) * (40 + rand() * 40), vx: -8 - rand() * 10, seed: rand() });
		}
		for (let i = 0; i < 14; i++) this.nebulae.push({ x: rand() * W, y: rand() * H, r: 400 + rand() * 500, seed: rand() });
	}

	// ------------------------------------------------------------ reporting

	get objective(): string {
		switch (this.phase) {
			case 'crossing':
				return this.ganthet.moving ? 'Escort Ganthet through the dead sector' : 'The Reds are on Ganthet: clear them so he can go on';
			case 'gate':
				return 'Bleez holds the Blood Gate: bring her down';
			case 'open':
				return 'Ganthet opens the gate';
		}
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const g = this.ganthet;
		const list: MissionMeter[] = [
			{ label: 'Ganthet', value: g.hp / GANTHET_HP, text: `${Math.round((g.hp / GANTHET_HP) * 100)}%`, low: g.hp < GANTHET_HP * 0.3 },
			{ label: 'The way', value: Math.min(1, (g.x - START.x) / (GATE_STOP - START.x)), text: '', marker: '✦' }
		];
		if (this.bleez && isStanding(this.bleez)) list.push({ label: 'Bleez', value: this.bleez.hp / this.bleez.maxHp, text: '' });
		return list;
	}

	warning(): string | null {
		if (this.inStorm(this.ganthet)) return 'GANTHET IS IN A RAGE STORM: SHIELD HIM';
		if ([...this.torpedoes].filter(isStanding).length >= 2) return 'TORPEDOES INBOUND ON GANTHET';
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.downs === 0 ? 1 : 0) + (this.ganthet.hp >= GANTHET_HP / 2 ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'won') return 'Through the Blood Gate. Ahead: Ysmault, the Blood Altar, and Atrocitus.';
		if (this.failReason === 'ganthet') return 'Ganthet fell in the dead sector, and the way to Ysmault fell with him.';
		return 'Your Lantern went down one time too many.';
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		return [
			{ label: 'Red Lanterns beaten', value: `${this.defeated}` },
			{ label: 'Torpedoes shot down', value: `${this.torpedoesDowned}` },
			{ label: 'Ganthet', value: `${Math.round((this.ganthet.hp / GANTHET_HP) * 100)}%` },
			{ label: 'Lives lost', value: `${this.downs}` },
			{ label: 'Time', value: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
		];
	}

	goal(): { x: number; y: number } | null {
		if (this.bleez && isStanding(this.bleez)) return this.bleez;
		const near = this.reds.find((e) => isStanding(e) && Math.hypot(e.x - this.ganthet.x, e.y - this.ganthet.y) < HALT_RANGE + 200);
		return near ?? { x: this.ganthet.x + 120, y: this.ganthet.y };
	}

	// ---------------------------------------------------------------- rules

	update(game: Game, dt: number) {
		const g = this.ganthet;
		this.map ??= game.map;
		this.comms.update(dt);
		if (!game.constructs.protectables.includes(g)) game.constructs.protectables.push(g);
		g.hit = Math.max(0, g.hit - dt * 2);
		this.countDefeats();
		this.moveStorms(dt);
		// His light is the battery
		const battery = game.batteries[0];
		if (battery) {
			// (just below him, so the two don't draw over each other)
			battery.x = g.x - 20;
			battery.y = g.y + 120;
		}
		switch (this.state) {
			case 'intro':
				this.timer -= dt;
				if (this.timer <= 0) {
					this.state = 'playing';
					game.constructs.maxHit = MAX_HIT;
					this.comms.scene([
						['Ganthet', 'Stay close. The storms here are made of rage: what is left of everything that died in this sector.'],
						['Arisia', 'If I shield you, the storm cannot touch you?'],
						['Ganthet', 'It cannot. And I will not go on while the Red Lanterns are on me. Clear the way, and follow.']
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
		this.stormDamage(game, dt);
		this.fireTorpedoes(game, dt);
		this.updateTorpedoes(game);
		g.threat = this.threat();
		if (g.hp <= 0) {
			g.hp = 0;
			this.state = 'lost';
			this.failReason = 'ganthet';
			game.downedNotice = false;
			this.comms.clear();
			return;
		}

		switch (this.phase) {
			case 'crossing':
				this.lead(game, dt);
				while (this.patrol < PATROLS.length && g.x >= PATROLS[this.patrol][0]) this.meetPatrol(game);
				// Hunters, up from behind
				this.huntIn -= dt;
				if (this.huntIn <= 0) {
					this.huntIn = HUNT_EVERY;
					const roles: Role[] = ['berserker', 'hunter', 'gunner'];
					for (let i = 0; i < HUNTERS; i++) this.spawn(game, 'rageGrunt', g.x - 900 - i * 60, g.y + (i - 1) * 260, roles[i % 3]);
					this.once('hunters', () => this.comms.say('Arisia', 'Behind us! They followed us in!', true));
				}
				if (g.x >= GATE_STOP) this.atTheGate(game);
				this.chatter();
				break;
			case 'gate':
				if (this.bleez && !isStanding(this.bleez) && this.reds.every((e) => !isStanding(e))) {
					this.phase = 'open';
					this.clock = 0;
					this.comms.scene([
						['Ganthet', 'Stand back. This gate was sealed by my people, long ago. It will know me.'],
						['Hal', 'Ysmault. Atrocitus. The Book of the Black. Nice and easy.']
					]);
				}
				break;
			case 'open':
				this.opening = Math.min(1, this.clock / OPEN_TIME);
				for (const p of game.players) p.invuln = Math.max(p.invuln, 1);
				if (this.opening >= 1 && !this.comms.current) this.win(game);
				break;
		}
	}

	/** Ganthet goes on unless the Reds are on him. */
	private lead(game: Game, dt: number) {
		const g = this.ganthet;
		const onHim = game.enemies.some((e) => isStanding(e) && e.kind !== 'redFighter' && Math.hypot(e.x - g.x, e.y - g.y) < HALT_RANGE);
		g.moving = !onHim;
		if (g.moving) g.x = Math.min(GATE_STOP, g.x + GANTHET_SPEED * dt);
		// Back to the middle of the way
		g.y += (LANE_Y - g.y) * Math.min(1, dt);
	}

	private meetPatrol(game: Game) {
		const [, wave] = PATROLS[this.patrol];
		this.patrol++;
		for (const [kind, dx, dy, role] of wave) this.spawn(game, kind, this.ganthet.x + dx, this.ganthet.y + dy, role);
		const lines: [string, string][] = [
			['Arisia', 'Red Lanterns ahead! Guarding the way!'],
			['Hal', "Fighters! They're going for Ganthet: shoot the torpedoes!"],
			['John', 'Ambush. Front and behind. Keep Ganthet between us!'],
			['Arisia', 'Skallox! And more fighters behind him!'],
			['John', 'This is the last of them before the gate. Everything we have!']
		];
		const [who, text] = lines[this.patrol - 1];
		this.comms.say(who, text, true);
	}

	private atTheGate(game: Game) {
		this.phase = 'gate';
		this.clock = 0;
		const b = this.spawn(game, 'bleez', GATE.x - 120, GATE.y);
		b.hp = b.maxHp = b.brain.lastHp = Math.round(b.maxHp / TOUGHNESS * BLEEZ_HEALTH);
		b.brain.might = BLEEZ_MIGHT;
		this.bleez = b;
		for (const [kind, dx, dy, role] of GATE_GUARD) this.spawn(game, kind, GATE.x + dx, GATE.y + dy, role);
		this.comms.scene([
			['Bleez', 'The Blood Gate. You will never pass it, Lanterns. Atrocitus has already begun.'],
			['Hal', 'We beat you at the vault, Bleez.'],
			['Bleez', 'Razer beat me at the vault. And Razer is not here.']
		]);
	}

	private spawn(game: Game, kind: EnemyKind, x: number, y: number, role: Role = 'berserker'): Enemy {
		const e = game.spawnEnemy(kind, Math.max(80, Math.min(W - 80, x)), Math.max(140, Math.min(H - 140, y)), role);
		const tough = kind === 'skallox' ? 4 : TOUGHNESS;
		e.brain.grit = TOUGHNESS;
		e.brain.might = MIGHT;
		e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * tough);
		e.brain.alert = 10;
		if (kind === 'redFighter') this.reloads.set(e, 2 + Math.random() * 2);
		this.reds.push(e);
		return e;
	}

	// ------------------------------------------------------------ storms

	private moveStorms(dt: number) {
		for (const s of this.storms) {
			s.y += s.vy * dt;
			s.x += s.vx * dt;
			if (s.y < 260 || s.y > H - 260) s.vy = -s.vy;
			s.y = Math.max(260, Math.min(H - 260, s.y));
		}
	}

	private inStorm(p: { x: number; y: number }): boolean {
		return this.storms.some((s) => Math.hypot(p.x - s.x, (p.y - s.y) / 0.62) < STORM_RADIUS);
	}

	/** Inside a storm: Lanterns burn and their willpower drains; Ganthet is hurt unless he's shielded. */
	private stormDamage(game: Game, dt: number) {
		for (const p of game.players) {
			if (p.downed || !this.inStorm(p)) continue;
			p.willpower = Math.max(0, p.willpower - STORM_DRAIN * dt);
			const next = (this.burnIn.get(p) ?? 0) - dt;
			this.burnIn.set(p, next);
			if (next <= 0) {
				this.burnIn.set(p, 0.5);
				damagePlayer(game.constructs, p, STORM_BURN * 0.5, p.x, p.y, 0);
			}
			this.once('storm', () => this.comms.say('Ganthet', 'Out of the storm! It feeds on your will!', true));
		}
		if (this.inStorm(this.ganthet)) {
			const next = (this.burnIn.get(this.ganthet) ?? 0) - dt;
			this.burnIn.set(this.ganthet, next);
			if (next <= 0) {
				this.burnIn.set(this.ganthet, 0.5);
				this.hurtGanthet(game, STORM_GANTHET * 0.5);
			}
		}
	}

	private hurtGanthet(game: Game, amount: number) {
		const through = absorbWithShield(game.constructs, this.ganthet, amount);
		if (through <= 0) return;
		this.ganthet.hp = Math.max(0, this.ganthet.hp - through);
		this.ganthet.hit = 1;
	}

	// ------------------------------------------------------------ torpedoes

	private fireTorpedoes(game: Game, dt: number) {
		const g = this.ganthet;
		for (const e of this.reds) {
			if (!isStanding(e) || e.kind !== 'redFighter') continue;
			const left = (this.reloads.get(e) ?? 0) - dt;
			this.reloads.set(e, left);
			if (left > 0 || Math.hypot(e.x - g.x, e.y - g.y) > 1100) continue;
			this.reloads.set(e, TORPEDO_EVERY[0] + Math.random() * (TORPEDO_EVERY[1] - TORPEDO_EVERY[0]));
			const lead = g.moving ? GANTHET_SPEED * (Math.hypot(g.x - e.x, g.y - e.y) / TORPEDO.speed) : 0;
			const tx = g.x + lead;
			const ty = g.y;
			const len = Math.hypot(tx - e.x, ty - e.y) || 1;
			const t: Dummy = {
				kind: 'rageTorpedo',
				x: e.x,
				y: e.y,
				prevX: e.x,
				prevY: e.y,
				vx: ((tx - e.x) / len) * TORPEDO.speed,
				vy: ((ty - e.y) / len) * TORPEDO.speed,
				hp: TORPEDO.hp,
				maxHp: TORPEDO.hp,
				homeX: e.x,
				homeY: e.y,
				caged: 0,
				flash: 0,
				stun: 0,
				down: 0,
				respawns: false,
				gone: false,
				dir: tx > e.x ? 1 : -1,
				drift: { radius: TORPEDO.radius, float: TORPEDO.lift, spin: 0, seed: Math.random() }
			};
			game.dummies.push(t);
			this.torpedoes.add(t);
		}
	}

	private updateTorpedoes(game: Game) {
		const g = this.ganthet;
		for (const t of this.torpedoes) {
			if (!isStanding(t)) {
				if (!this.burst.has(t)) this.torpedoesDowned++;
				game.constructs.effects.push({ kind: 'redImpact', x: t.x, y: t.y, age: 0, life: 0.3, lift: TORPEDO.lift });
				t.gone = true;
				this.torpedoes.delete(t);
				continue;
			}
			if (Math.hypot(t.x - g.x, t.y - g.y) < g.radius * 0.6 + TORPEDO.radius) {
				this.hurtGanthet(game, TORPEDO.damage);
				this.pop(t);
				continue;
			}
			for (const p of game.players) {
				if (p.downed || p.dash) continue;
				if (Math.abs(t.x - p.x) < TORPEDO.radius + 12 && Math.abs(t.y - p.y) < TORPEDO.radius + 12) {
					damagePlayer(game.constructs, p, TORPEDO.lanternDamage, t.x, t.y, 240);
					this.pop(t);
					break;
				}
			}
			if (!this.burst.has(t) && Math.hypot(t.x - g.x, t.y - g.y) > 1800) {
				t.gone = true;
				this.torpedoes.delete(t);
			}
		}
	}

	private pop(t: Dummy) {
		this.burst.add(t);
		t.hp = 0;
		t.down = 0.2;
	}

	/** How much Ganthet needs a bubble: a storm on him or coming, torpedoes closing, Reds on him. */
	private threat(): number {
		const g = this.ganthet;
		let threat = 0;
		if (this.inStorm(g)) threat += 1.6;
		else if (this.inStorm({ x: g.x + 90, y: g.y })) threat += 0.8;
		for (const t of this.torpedoes) {
			if (!isStanding(t)) continue;
			const d = Math.hypot(t.x - g.x, t.y - g.y);
			if (d < 420) threat += 1.2 * (1 - d / 560);
		}
		if (g.hp < GANTHET_HP * 0.35) threat *= 1.5;
		return threat;
	}

	private chatter() {
		const g = this.ganthet;
		if (g.x > 2000) this.once('husks', () => this.comms.scene([
			['John', 'Those wrecks. They are Manhunters.'],
			['Ganthet', 'They are what is left of the ones that did this. They killed everything here, and then there was nothing left to kill.']
		]));
		if (g.hp < GANTHET_HP * 0.4) this.once('hurt', () => this.comms.say('Ganthet', 'I am... not built for this. Keep them from me, Lanterns.', true));
		if (g.x > 4000) this.once('razer', () => this.comms.say('Hal', 'Razer said his world was out here somewhere.', false));
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
		const me = game.players[0];
		if (me.downed && !this.wasDown) {
			this.lives--;
			this.downs++;
			if (this.lives <= 0) {
				this.state = 'lost';
				this.failReason = 'lantern';
				game.downedNotice = false;
				this.comms.clear();
			} else this.comms.say('Arisia', 'I have Ganthet! Get back up!');
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
		return [[this.ganthet.x, this.ganthet.y - 40]];
	}

	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		const list: Drawable[] = [];
		for (const n of this.nebulae) list.push({ baseY: -2000, draw: () => drawRedNebula(ctx, n.x, n.y, n.r, n.seed, time) });
		for (const o of this.map?.obstacles ?? []) list.push({ baseY: o.y + o.h, draw: () => drawManhunterHusk(ctx, o.x + o.w / 2, o.y + o.h / 2, o.w, o.seed, time) });
		for (const s of this.storms) list.push({ baseY: s.y + 1, draw: () => drawRageStorm(ctx, s.x, s.y, STORM_RADIUS, time, s.seed) });
		list.push({ baseY: GATE.y - 300, draw: () => drawBloodGate(ctx, GATE.x, GATE.y, time, this.opening) });
		const g = this.ganthet;
		list.push({ baseY: g.y, draw: () => drawGanthetEscort(ctx, g.x, g.y, time, g.hit, g.moving && this.phase === 'crossing') });
		return list;
	}
}
