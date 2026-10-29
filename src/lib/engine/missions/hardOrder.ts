// Season two, Act 1, mission 2: Hard Order. Hal, with Kilowog and Sinestro.
//
// Atrocitus is finished, but his raiders weren't told. A frontier colony on
// the edge of Sector 2814 is under attack, and Sinestro is in charge:
//
//   raid    three waves of Red Lantern raiders come in over the fields. Hal,
//           Kilowog and Sinestro beat them back.
//   order   it's over, and Sinestro decides how it stays over: he locks the
//           colonists in cages "for their safety". Hal objects. Nobody listens.
//   hold    the raiders' last push, with Skallox, goes for the cages, and the
//           people inside can't run. A Red Lantern near a cage drains it; the
//           bubble shield (Shift) goes over a cage that's being drained.
//
// Lose: Hal goes down 3 times, or a cage breaks with the people still inside.

import { absorbWithShield, type Protectable } from '../constructs/system';
import { isStanding } from '../dummy';
import type { Enemy, Role } from '../enemies/enemies';
import { colonist, drawColonist, drawField } from '../draw/colony';
import type { Figure } from '../draw/lantern';
import { drawCage } from '../draw/prison';
import { drawDrain } from '../draw/siege';
import type { Drawable, Game } from '../game';
import { CRATE_HP, seededRandom, type GameMap, type Obstacle } from '../map';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

export type HardOrderPhase = 'raid' | 'order' | 'hold';

const LIVES = 3;
const INTRO_TIME = 3;
/** Raiders are tougher and hit harder than the lab's: three Lanterns are a lot of firepower. */
const TOUGHNESS = 5;
const MIGHT = 2.3;
/** The last push: Skallox and reinforcements every few seconds for this long, all going for the cages. */
const HOLD_TIME = 75;
const REINFORCE_EVERY = 14;
/** Seconds of Sinestro building his cages. */
const ORDER_TIME = 9;
const CAGE_HP = 100;
/** A Red Lantern this close to a cage drains it, this much a second. */
const DRAIN_RANGE = 230;
const DRAIN_RATE = 3.4;
/** Raiders in the last push drift toward the nearest cage. */
const CAGE_PULL = 260;

const W = 3200;
const H = 1900;
const SPAWN = { x: 700, y: 950 };
/** The village square, where Sinestro puts his cages. */
const CAGES = [
	{ x: 1250, y: 650 },
	{ x: 1250, y: 1250 },
	{ x: 1600, y: 950 }
];

type Wave = [Role | 'skallox', number, number][];
/** In from the fields on the right. */
const RAID_WAVES: Wave[] = [
	[
		['berserker', 2500, 800],
		['berserker', 2600, 1100],
		['hunter', 2700, 500],
		['gunner', 2800, 950],
		['gunner', 2900, 1350]
	],
	[
		['hunter', 2450, 600],
		['hunter', 2450, 1300],
		['berserker', 2550, 900],
		['berserker', 2650, 1200],
		['gunner', 2850, 700],
		['gunner', 2850, 1200],
		['gunner', 2950, 950]
	],
	[
		['berserker', 2400, 500],
		['berserker', 2400, 1400],
		['berserker', 2500, 950],
		['hunter', 2700, 650],
		['hunter', 2700, 1250],
		['gunner', 2900, 450],
		['gunner', 2900, 950],
		['gunner', 2900, 1450],
		['hunter', 3000, 950]
	]
];
const LAST_PUSH: Wave = [
	['skallox', 2500, 950],
	['berserker', 2300, 500],
	['berserker', 2300, 1400],
	['hunter', 2600, 700],
	['hunter', 2600, 1200],
	['gunner', 2900, 950]
];
/** Raiders who keep coming during the last push, from the fields and round the back of the village. */
const REINFORCEMENTS: Wave[] = [
	[
		['berserker', 2700, 400],
		['hunter', 2700, 1500],
		['gunner', 3000, 950]
	],
	[
		['hunter', 300, 300],
		['berserker', 300, 1600],
		['gunner', 2900, 600],
		['berserker', 2900, 1300]
	]
];

interface Cage {
	x: number;
	y: number;
	hp: number;
	/** 0..1 as Sinestro builds it. */
	built: number;
	flash: number;
	people: Figure[];
	seed: number;
	readonly prot: Protectable;
}

/** Vesk: a farming colony. Homes around the square, fields out east where the raiders come in. */
export function buildHardOrderMap(): GameMap {
	const rand = seededRandom(4141);
	const obstacles: Obstacle[] = [];
	const homes: [number, number, number, number][] = [
		[900, 330, 170, 110],
		[1500, 300, 200, 110],
		[880, 1480, 180, 120],
		[1550, 1500, 190, 110],
		[2050, 380, 160, 110],
		[2050, 1450, 170, 110]
	];
	for (const [x, y, w, h] of homes) obstacles.push({ kind: 'building', x, y, w, h, height: 60 + rand() * 40, blocksFlying: false, seed: rand() });
	for (let i = 0; i < 12; i++) {
		const x = 1900 + rand() * 1100;
		const y = 250 + rand() * 1400;
		const blocked = obstacles.some((b) => x < b.x + b.w + 40 && x + 78 > b.x && y < b.y + b.h + 40 && y + 67 > b.y);
		if (!blocked) obstacles.push({ kind: 'crate', x, y, w: 38, h: 27, height: 28, blocksFlying: false, seed: rand(), hp: CRATE_HP, maxHp: CRATE_HP, movable: true });
	}
	return {
		name: 'Vesk Colony',
		environment: 'planet',
		ground: 'meadow',
		width: W,
		height: H,
		spawn: SPAWN,
		battery: { x: 500, y: 700 },
		dummies: [],
		obstacles
	};
}

export class HardOrder implements MissionDirector {
	state: MissionState = 'intro';
	phase: HardOrderPhase = 'raid';
	timer = INTRO_TIME;
	lives = LIVES;
	elapsed = 0;
	downs = 0;
	defeated = 0;
	failReason: 'lantern' | 'cage' | null = null;
	readonly comms = new Comms();
	readonly cages: Cage[];
	readonly starHint = '★ done · ★ no cage below half · ★ Hal never went down';
	/** Which raid wave is in (0-based); the last push comes after. */
	waveIndex = 0;
	private orderLeft = ORDER_TIME;
	private holdLeft = HOLD_TIME;
	private reinforce = REINFORCE_EVERY;
	private reinforcements = 0;
	private wave: Enemy[] = [];
	private all: Enemy[] = [];
	private counted = new WeakSet<Enemy>();
	private draining: [Enemy, Cage][] = [];
	private lowestCage = 1;
	private wasDown = false;
	private fields: [number, number, number, number, number][] = [];
	private said = new Set<string>();

	constructor(seed = 21) {
		const rand = seededRandom(seed);
		this.cages = CAGES.map((c, i) => ({
			...c,
			hp: CAGE_HP,
			built: 0,
			flash: 0,
			people: [0, 1, 2].map((k) => colonist(i * 3 + k + 40)),
			seed: rand(),
			prot: { x: c.x, y: c.y, name: 'Caged colonists', radius: 70, lift: 34, threat: 0 }
		}));
		for (let i = 0; i < 8; i++) this.fields.push([1950 + rand() * 1000, 150 + rand() * 1500, 180 + rand() * 160, 110 + rand() * 90, rand()]);
	}

	// ------------------------------------------------------------ reporting

	get objective(): string {
		if (this.phase === 'raid') return `Drive off the raiders (wave ${this.waveIndex + 1} of ${RAID_WAVES.length})`;
		if (this.phase === 'order') return 'Sinestro is taking charge';
		return this.holdLeft > 0 ? `Keep the raiders off the cages until they break (${Math.ceil(this.holdLeft)}s)` : 'Finish off the last raiders';
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const list: MissionMeter[] = [];
		if (this.phase === 'hold') {
			this.cages.forEach((c, i) => list.push({ label: `Cage ${i + 1}`, value: c.hp / CAGE_HP, text: `${Math.round(c.hp)}%`, low: c.hp < 40 }));
		}
		const reds = this.wave.filter(isStanding).length;
		if (reds > 0) list.push({ label: 'Raiders', value: reds / Math.max(1, this.wave.length), text: `${reds} left` });
		return list;
	}

	warning(game: Game): string | null {
		if (this.state !== 'playing' || this.phase !== 'hold') return null;
		const shielded = (c: Cage) => game.constructs.shields.some((s) => s.target === c.prot);
		if (this.draining.some(([, c]) => !shielded(c))) return 'They are draining a cage! Shift to shield it!';
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.lowestCage >= 0.5 ? 1 : 0) + (this.downs === 0 ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'won') return 'Vesk is safe. The colonists are still in their cages, and Sinestro sees no reason to let them out yet.';
		if (this.failReason === 'cage') return 'A cage broke, with the people still inside it.';
		return 'Hal went down one time too many.';
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		return [
			{ label: 'Raiders beaten', value: `${this.defeated}` },
			{ label: 'Weakest cage', value: `${Math.round(this.lowestCage * 100)}%` },
			{ label: 'Times down', value: `${this.downs}` },
			{ label: 'Time', value: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
		];
	}

	// ---------------------------------------------------------------- rules

	update(game: Game, dt: number) {
		for (const c of this.cages) c.flash = Math.max(0, c.flash - dt);
		this.comms.update(dt);
		this.countDefeats();

		switch (this.state) {
			case 'intro':
				this.timer -= dt;
				if (this.timer <= 0) {
					this.state = 'playing';
					this.comms.scene([
						['Sinestro', 'Raiders, Jordan. Atrocitus is gone and nobody told his dogs. We end this quickly.'],
						['Kilowog', "Three Lanterns against a pack of strays? Poozers don't stand a chance."],
						['Hal', 'Keep them out of the village. The colonists are hiding in their homes.']
					]);
					this.spawnWave(game, RAID_WAVES[0]);
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
		this.countDowns(game);
		if (this.state !== 'playing') return;

		switch (this.phase) {
			case 'raid':
				if (this.wave.every((e) => !isStanding(e))) {
					this.waveIndex++;
					if (this.waveIndex < RAID_WAVES.length) {
						const lines = [
							['Kilowog', "More of 'em coming over the fields!"],
							['Sinestro', 'The last of them. Do not let a single one reach the houses.']
						] as [string, string][];
						this.comms.say(...lines[this.waveIndex - 1]);
						this.spawnWave(game, RAID_WAVES[this.waveIndex]);
					} else this.startOrder();
				}
				break;
			case 'order':
				this.orderLeft -= dt;
				// The cages go up one after another
				this.cages.forEach((c, i) => {
					const start = 1.5 + i * 1.6;
					if (ORDER_TIME - this.orderLeft > start) c.built = Math.min(1, c.built + dt / 1.2);
				});
				if (this.orderLeft <= 0) this.startHold(game);
				break;
			case 'hold':
				this.holdLeft = Math.max(0, this.holdLeft - dt);
				this.reinforce -= dt;
				if (this.holdLeft > 0 && this.reinforce <= 0) {
					this.reinforce = REINFORCE_EVERY;
					this.addWave(game, REINFORCEMENTS[this.reinforcements++ % REINFORCEMENTS.length]);
					if (this.reinforcements === 1) this.comms.say('Kilowog', "There's more of 'em! Coming round the back!");
				}
				this.pullToCages(dt);
				this.drain(game, dt);
				if (this.state !== 'playing') return;
				if (this.holdLeft <= 0 && this.wave.every((e) => !isStanding(e))) this.win(game);
				break;
		}
	}

	private startOrder() {
		this.phase = 'order';
		this.orderLeft = ORDER_TIME;
		this.comms.scene([
			['Sinestro', 'Everyone out. Into the square. Now.'],
			['Colonist', "Lantern? What... what are those? We didn't do anything!"],
			['Sinestro', 'They will not come out until I say so. Safe people are people who stay where they are put.'],
			['Hal', "Sinestro, they're not prisoners. Let them go home."],
			['Sinestro', 'You are young, Jordan. Fear keeps them alive. Order keeps them alive.']
		]);
	}

	private startHold(game: Game) {
		this.phase = 'hold';
		for (const c of this.cages) c.built = 1;
		// The bubble shield can go over a cage
		game.constructs.protectables.push(...this.cages.map((c) => c.prot));
		this.comms.scene([
			['Kilowog', "Incoming! And that's Skallox leading 'em!"],
			['Skallox', 'Look at that. He has wrapped them up for us. Take the cages!'],
			['Hal', "They can't run in there. Keep them off the cages!"]
		]);
		this.spawnWave(game, LAST_PUSH);
	}

	/** In the last push, raiders who aren't busy with a Lantern drift toward the nearest cage. */
	private pullToCages(dt: number) {
		for (const e of this.wave) {
			if (!isStanding(e) || e.stun > 0 || e.kind === 'skallox') continue;
			const c = this.nearestCage(e);
			const d = Math.hypot(c.x - e.x, c.y - e.y);
			if (d < DRAIN_RANGE * 0.6) continue;
			e.vx += ((c.x - e.x) / d) * CAGE_PULL * dt;
			e.vy += ((c.y - e.y) / d) * CAGE_PULL * dt;
		}
	}

	/** Every raider near a cage drains it; a bubble over the cage takes it first. */
	private drain(game: Game, dt: number) {
		const w = game.constructs;
		this.draining = [];
		for (const c of this.cages) c.prot.threat = 0;
		for (const e of this.wave) {
			if (!isStanding(e)) continue;
			const c = this.nearestCage(e);
			if (Math.hypot(c.x - e.x, c.y - e.y) >= DRAIN_RANGE) continue;
			this.draining.push([e, c]);
			c.prot.threat += 1.5;
			const through = absorbWithShield(w, c.prot, DRAIN_RATE * dt);
			if (through <= 0) continue;
			c.hp -= through;
			c.flash = 0.15;
			this.lowestCage = Math.min(this.lowestCage, Math.max(0, c.hp) / CAGE_HP);
			if (c.hp <= 0) {
				this.lose(game, 'cage');
				return;
			}
		}
		if (this.draining.length > 0) this.once('drain', 'Hal', "They're tearing at the cages! Get them off!");
	}

	private nearestCage(e: { x: number; y: number }): Cage {
		return this.cages.reduce((best, c) => (Math.hypot(c.x - e.x, c.y - e.y) < Math.hypot(best.x - e.x, best.y - e.y) ? c : best));
	}

	/** More raiders on top of the ones still standing. */
	private addWave(game: Game, wave: Wave) {
		const standing = this.wave.filter(isStanding);
		this.spawnWave(game, wave);
		this.wave = [...standing, ...this.wave];
	}

	private spawnWave(game: Game, wave: Wave) {
		this.wave = wave.map(([role, x, y]) => {
			const e = role === 'skallox' ? game.spawnEnemy('skallox', x, y) : game.spawnEnemy('rageGrunt', x, y, role);
			e.brain.grit = TOUGHNESS;
			e.brain.might = MIGHT;
			e.brain.alert = 10;
			const tough = role === 'skallox' ? 3.5 : TOUGHNESS;
			e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * tough);
			return e;
		});
		this.all.push(...this.wave);
	}

	private countDefeats() {
		for (const e of this.all) {
			if (!isStanding(e) && !this.counted.has(e)) {
				this.counted.add(e);
				this.defeated++;
			}
		}
	}

	private once(id: string, who: string, text: string) {
		if (this.said.has(id)) return;
		this.said.add(id);
		this.comms.say(who, text, true);
	}

	private countDowns(game: Game) {
		const hal = game.players[0];
		if (hal.downed && !this.wasDown) {
			this.lives--;
			this.downs++;
			if (this.lives <= 0) this.lose(game, 'lantern');
			else this.comms.say('Kilowog', 'Get up, Jordan! Up!', true);
		}
		this.wasDown = hal.downed;
	}

	private win(game: Game) {
		this.state = 'won';
		this.timer = 0;
		for (const p of game.players) p.victoryTimer = 0.4;
		this.comms.scene([
			['Hal', "It's over. Open the cages, Sinestro."],
			['Sinestro', 'In the morning. When they have learned to be grateful.'],
			['Kilowog', "Don't look at me like that, Jordan. That's just Sinestro."],
			['Hal', '...Yeah. That\'s what worries me.']
		]);
	}

	private lose(game: Game, reason: 'lantern' | 'cage') {
		this.state = 'lost';
		this.failReason = reason;
		game.downedNotice = false;
	}

	// -------------------------------------------------------------- drawing

	cameraPoints(): [number, number][] {
		return this.phase === 'raid' ? [] : this.cages.map((c): [number, number] => [c.x, c.y - 40]);
	}

	goal(): { x: number; y: number } | null {
		if (this.state !== 'playing') return null;
		const draining = this.draining[0];
		if (draining) return draining[1];
		const next = this.wave.find(isStanding);
		return next ? { x: next.x, y: next.y } : null;
	}

	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		const list: Drawable[] = [];
		list.push({ baseY: -1e6, draw: () => this.fields.forEach(([x, y, fw, fh, seed]) => drawField(ctx, x, y, fw, fh, seed)) });
		for (const c of this.cages) {
			if (c.built <= 0) continue;
			const inside = () =>
				c.people.forEach((fig, i) => drawColonist(ctx, fig, c.x - 24 + i * 24, c.y + (i === 1 ? -6 : 4), i === 0 ? 1 : -1, false, time + i * 0.4));
			list.push({ baseY: c.y + 10, draw: () => drawCage(ctx, c.x, c.y, 'green', inside, c.built * (0.35 + 0.65 * (c.hp / CAGE_HP)), c.flash, time, c.seed) });
		}
		for (const [e, c] of this.draining) list.push({ baseY: c.y + 40, draw: () => drawDrain(ctx, e.x, e.y - 50, c.x, c.y - 40, time) });
		return list;
	}
}
