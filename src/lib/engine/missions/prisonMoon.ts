// Act 1, Mission 4: Prison Moon.
//
// The Interceptor comes out of its jump over a blood-red moon, where the Red
// Lanterns hold captured Green Lanterns. Hal and Kilowog land and break them
// out:
//
//   breakout  three cells round the prison, each guarded. Break a cell open
//             (it's a breakable object: every construct and ring shot works on
//             it) and the Lantern inside joins the fight as an AI partner.
//             Each breakout brings more Red Lanterns.
//   warden    with everyone free, Skallox, the warden, comes with the whole
//             garrison. Hold them off.
//   reveal    Katma Tui tells them whose prison this is: Razer's.
//
// Lose: Hal goes down 3 times. The Interceptor waits on the landing field; the
// Lantern battery there recharges willpower.

import { isStanding } from '../dummy';
import type { Enemy, Role } from '../enemies/enemies';
import { drawInterceptor } from '../draw/interceptor';
import { drawCell, drawSpire } from '../draw/prison';
import type { Drawable, Game } from '../game';
import { LANTERNS, type PrisonerId } from '../lanterns';
import { seededRandom, type GameMap, type Obstacle } from '../map';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

export type PrisonPhase = 'breakout' | 'warden' | 'reveal';

const PRISON_LIVES = 3;
const INTRO_TIME = 3;
/** How tough a cell is (it takes a few constructs, not one shot). */
export const CELL_HP = 420;
/** Three stars: done within this many seconds. */
const PAR_TIME = 360;
/** How much tougher and harder-hitting these Red Lanterns are than the lab's (like Silent Outpost). */
const TOUGHNESS = 4;
const MIGHT = 3;
/** Freed Lanterns come out of the cells worn down. */
const FREED_HEALTH = 0.5;
const FREED_WILLPOWER = 0.4;

const W = 4400;
const H = 2000;
const LANDING = { x: 420, y: 1000 };

interface CellSpot {
	x: number;
	y: number;
	who: PrisonerId;
	/** Who guards it before you get there: [role, dx, dy]. */
	guards: Wave;
	/** Who comes when it's broken open. */
	response: Wave;
	/** What they say when they're free. */
	freed: [string, string][];
}

type Wave = [Role | 'skallox', number, number][];

const CELLS: CellSpot[] = [
	{
		x: 1550,
		y: 640,
		who: 'arisia',
		guards: [
			['berserker', 180, -60],
			['gunner', 240, 120],
			['hunter', -160, 150]
		],
		response: [
			['hunter', 380, -160],
			['gunner', -360, 180],
			['berserker', 420, 120]
		],
		freed: [
			['Arisia', 'Hal Jordan! I knew the Corps would come. Give me a ring charge and a target!'],
			['Kilowog', "Rookie of Graxos. Stay close to me, and hit hard."]
		]
	},
	{
		x: 2500,
		y: 1400,
		who: 'boodikka',
		guards: [
			['berserker', -200, -80],
			['hunter', 220, 60],
			['gunner', 60, -220],
			['gunner', -140, 200]
		],
		response: [
			['berserker', 380, 120],
			['berserker', -380, -120],
			['gunner', 460, -200],
			['hunter', -420, 220]
		],
		freed: [
			['Boodikka', "Took you long enough. Let's make them pay for every day in that cage."],
			['Hal', "Welcome back, Boodikka. The one left's on the far side."]
		]
	},
	{
		x: 3500,
		y: 820,
		who: 'katma',
		guards: [
			['hunter', -220, -100],
			['gunner', 200, 140],
			['berserker', 260, -160],
			['berserker', -240, 180]
		],
		response: [],
		freed: [
			['Katma Tui', "Hal. Kilowog. Don't celebrate yet: the warden felt that cell break."],
			['Kilowog', 'Then let him come. Everybody form up!']
		]
	}
];

/** The warden and the garrison: the last big fight, round the third cell. */
const WARDEN_WAVE: Wave = [
	['skallox', 420, 0],
	['berserker', 380, -220],
	['berserker', 360, 240],
	['berserker', -380, 60],
	['hunter', -300, -260],
	['hunter', 520, 180],
	['gunner', 600, -80],
	['gunner', -420, 220],
	['gunner', 200, 320]
];
/** Hitting a cell sets off the alarm: these drop in (once per cell). */
const ALARM: Wave = [
	['hunter', 340, -200],
	['gunner', -340, 200]
];

/** The prison moon: a landing field on the left, three cell blocks among the prison buildings, red spires everywhere. */
export function buildPrisonMap(): GameMap {
	const rand = seededRandom(1616);
	const obstacles: Obstacle[] = [];
	// Prison blocks: long, low, dark buildings
	const blocks: [number, number, number, number][] = [
		[1250, 300, 220, 120],
		[1850, 420, 200, 140],
		[2150, 1600, 260, 120],
		[2850, 1250, 180, 150],
		[3000, 420, 240, 120],
		[3800, 1150, 200, 130],
		[1300, 1350, 180, 120]
	];
	for (const [x, y, w, h] of blocks) obstacles.push({ kind: 'building', x, y, w, h, height: 90 + rand() * 40, blocksFlying: false, seed: rand() });
	// Rubble and rocks
	for (let i = 0; i < 24; i++) {
		const size = 30 + rand() * 40;
		const x = 950 + rand() * 3300;
		const y = 220 + rand() * 1550;
		const o: Obstacle = { kind: 'rock', x, y, w: size, h: size * 0.55, height: 12 + size * 0.2, blocksFlying: false, seed: rand() };
		const blocked = obstacles.some((b) => x < b.x + b.w + 40 && x + size + 40 > b.x && y < b.y + b.h + 40 && y + size + 40 > b.y);
		const nearCell = CELLS.some((c) => Math.hypot(x - c.x, y - c.y) < 220);
		if (!blocked && !nearCell) obstacles.push(o);
	}
	// The cells themselves: breakable, drawn by the mission
	for (const c of CELLS) {
		obstacles.push({
			kind: 'cell',
			x: c.x - 44,
			y: c.y - 16,
			w: 88,
			h: 32,
			height: 118,
			blocksFlying: false,
			seed: rand(),
			hp: CELL_HP,
			maxHp: CELL_HP,
			hidden: true
		});
	}
	return {
		name: 'The Prison Moon',
		environment: 'planet',
		ground: 'bloodMoon',
		width: W,
		height: H,
		spawn: { x: LANDING.x + 120, y: LANDING.y + 120 },
		battery: { x: LANDING.x + 20, y: LANDING.y + 160 },
		dummies: [],
		obstacles
	};
}

interface Cell {
	spot: CellSpot;
	obstacle: Obstacle;
	freed: boolean;
	flash: number;
	lastHp: number;
	/** Hitting it has set off the alarm. */
	alarmed: boolean;
}

export class PrisonMoon implements MissionDirector {
	state: MissionState = 'intro';
	phase: PrisonPhase = 'breakout';
	timer = INTRO_TIME;
	lives = PRISON_LIVES;
	elapsed = 0;
	downs = 0;
	defeated = 0;
	failReason: 'lantern' | null = null;
	readonly comms = new Comms();
	readonly starHint = '★ everyone free · ★ no lives lost · ★ under 6 minutes';
	readonly cells: Cell[];
	private wave: Enemy[] = [];
	private counted = new WeakSet<Enemy>();
	private wasDown = false;
	private spires: [number, number, number, number][] = [];
	private guardsPosted = false;

	constructor(map: GameMap, seed = 5) {
		const cellObstacles = map.obstacles.filter((o) => o.kind === 'cell');
		this.cells = CELLS.map((spot, i) => ({ spot, obstacle: cellObstacles[i], freed: false, flash: 0, lastHp: CELL_HP, alarmed: false }));
		const rand = seededRandom(seed);
		for (let i = 0; i < 30; i++) {
			const x = 200 + rand() * (W - 300);
			const y = 120 + rand() * (H - 200);
			if (Math.hypot(x - LANDING.x, y - LANDING.y) < 360) continue;
			if (CELLS.some((c) => Math.hypot(x - c.x, y - c.y) < 200)) continue;
			this.spires.push([x, y, 70 + rand() * 110, rand()]);
		}
	}

	// ------------------------------------------------------------ reporting

	get freed(): number {
		return this.cells.filter((c) => c.freed).length;
	}

	get objective(): string {
		switch (this.phase) {
			case 'breakout':
				return `Break the prisoners out (${this.freed} / ${this.cells.length})`;
			case 'warden':
				return 'Hold off the warden and the garrison';
			case 'reveal':
				return 'The Prison Moon';
		}
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const list: MissionMeter[] = [];
		// The cell you're working on
		const cell = this.cells.find((c) => !c.freed && c.obstacle.hp! < CELL_HP);
		if (cell) list.push({ label: 'Cell', value: Math.max(0, cell.obstacle.hp!) / CELL_HP, text: `${Math.round((Math.max(0, cell.obstacle.hp!) / CELL_HP) * 100)}%` });
		const left = this.wave.filter(isStanding).length;
		if (left > 0) list.push({ label: 'Reds', value: left / Math.max(1, this.wave.length), text: `${left} left` });
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
		if (this.state === 'won') return "Three Lanterns free, and a name: Razer. His fortress is on the far side of this moon.";
		return 'Hal went down one time too many.';
	}

	tally(): string {
		return `Lanterns freed ${this.freed} / ${this.cells.length}`;
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		return [
			{ label: 'Lanterns freed', value: `${this.freed} / ${this.cells.length}` },
			{ label: 'Red Lanterns beaten', value: `${this.defeated}` },
			{ label: 'Time', value: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
		];
	}

	// ---------------------------------------------------------------- rules

	update(game: Game, dt: number) {
		this.comms.update(dt);
		this.countDefeats();
		for (const c of this.cells) {
			c.flash = Math.max(0, c.flash - dt);
			if (c.obstacle.hp! < c.lastHp) c.flash = 0.12;
			c.lastHp = c.obstacle.hp!;
		}

		switch (this.state) {
			case 'intro':
				this.timer -= dt;
				if (!this.guardsPosted) this.postGuards(game);
				if (this.timer <= 0) {
					this.state = 'playing';
					this.comms.scene([
						['Kilowog', "A prison. Built for Lanterns. I've seen a lotta things, poozer, but this..."],
						['Hal', 'Then we empty it. Three cells, three Lanterns. Stay together.']
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
		this.countDowns(game);
		if (this.state !== 'playing') return;

		switch (this.phase) {
			case 'breakout':
				for (const c of this.cells) {
					// The first hit on a cell sets off the alarm
					if (!c.alarmed && c.obstacle.hp! < CELL_HP) {
						c.alarmed = true;
						this.comms.say('Red Lantern', 'The cells! They are at the cells!', true);
						game.constructs.effects.push({ kind: 'callout', x: c.spot.x, y: c.spot.y - 160, age: 0, life: 1.6, text: 'ALARM', hurt: true });
						this.spawnWave(game, ALARM, c.spot.x, c.spot.y);
					}
					// Broken open: the cell's gone from the map
					if (!c.freed && !game.map.obstacles.includes(c.obstacle)) this.free(game, c);
				}
				if (this.freed === this.cells.length) {
					this.phase = 'warden';
					const last = this.cells[this.cells.length - 1].spot;
					this.comms.say('Skallox', 'You come to MY prison and open MY cells? Warden Skallox will put you back in them!', true);
					this.spawnWave(game, WARDEN_WAVE, last.x, last.y);
				}
				break;
			case 'warden':
				if (this.waveCleared()) {
					this.phase = 'reveal';
					this.comms.scene([
						['Katma Tui', "This prison isn't Skallox's. It belongs to Razer. Atrocitus's right hand."],
						['Katma Tui', "He took the others to his fortress on the far side of this moon. They won't last long there."],
						['Hal', "Then that's where we're going."],
						['Kilowog', 'All of us, poozer. All of us.']
					]);
				}
				break;
			case 'reveal':
				if (!this.comms.current) this.win(game);
				break;
		}
	}

	/** Each cell has its guards waiting when you arrive. */
	private postGuards(game: Game) {
		this.guardsPosted = true;
		for (const c of this.cells) this.spawnWave(game, c.spot.guards, c.spot.x, c.spot.y);
	}

	/** A cell broke open: its Lantern joins the fight, and the prison answers. */
	private free(game: Game, c: Cell) {
		c.freed = true;
		const p = game.addPartner(c.spot.who, c.spot.x, c.spot.y + 10);
		p.health = p.maxHealth * FREED_HEALTH;
		p.willpower = p.maxWillpower * FREED_WILLPOWER;
		game.constructs.effects.push({ kind: 'callout', x: c.spot.x, y: c.spot.y - 150, age: 0, life: 2, text: `${LANTERNS[c.spot.who].name.toUpperCase()} FREED` });
		game.constructs.effects.push({ kind: 'snap', x: c.spot.x, y: c.spot.y, age: 0, life: 0.5, radius: 60 });
		this.comms.scene(c.spot.freed);
		this.spawnWave(game, c.spot.response, c.spot.x, c.spot.y);
	}

	private spawnWave(game: Game, wave: Wave, x: number, y: number) {
		if (wave.length === 0) return;
		const spawned = wave.map(([role, dx, dy]) => {
			const ex = Math.max(80, Math.min(W - 80, x + dx));
			const ey = Math.max(120, Math.min(H - 80, y + dy));
			const e = role === 'skallox' ? game.spawnEnemy('skallox', ex, ey) : game.spawnEnemy('rageGrunt', ex, ey, role);
			e.brain.grit = TOUGHNESS;
			e.brain.might = MIGHT;
			const tough = role === 'skallox' ? 1.6 : TOUGHNESS;
			e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * tough);
			return e;
		});
		this.wave = this.waveCleared() ? spawned : [...this.wave, ...spawned];
	}

	private waveCleared(): boolean {
		return this.wave.every((e) => !isStanding(e));
	}

	private countDefeats() {
		for (const e of this.wave) {
			if (!isStanding(e) && !this.counted.has(e)) {
				this.counted.add(e);
				this.defeated++;
			}
		}
	}

	/** Each time Hal goes down costs a life; the last one ends the mission. */
	private countDowns(game: Game) {
		const hal = game.players[0];
		if (hal.downed && !this.wasDown) {
			this.lives--;
			this.downs++;
			if (this.lives <= 0) this.lose(game);
			else this.comms.say('Kilowog', "Up, poozer! They're counting on us!");
		}
		this.wasDown = hal.downed;
	}

	private win(game: Game) {
		this.state = 'won';
		this.timer = 0;
		for (const p of game.players) p.victoryTimer = 0.4;
	}

	private lose(game: Game) {
		this.state = 'lost';
		this.failReason = 'lantern';
		game.downedNotice = false;
		this.comms.clear();
	}

	// -------------------------------------------------------------- drawing

	/** The next cell to break open (the on-screen arrow points there). */
	goal(): { x: number; y: number } | null {
		if (this.state !== 'playing' || this.phase !== 'breakout') return null;
		// Deal with whoever's still standing first
		if (this.wave.some(isStanding)) return null;
		const next = this.cells.find((c) => !c.freed);
		return next ? next.spot : null;
	}

	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		const list: Drawable[] = [];
		for (const [x, y, h, seed] of this.spires) list.push({ baseY: y, draw: () => drawSpire(ctx, x, y, h, seed, time) });
		// The Interceptor, parked on the landing field
		list.push({
			baseY: LANDING.y,
			draw: () => drawInterceptor(ctx, LANDING.x, LANDING.y, { hull: 0.9, flash: 0, power: 0.35, boot: 0, destroyed: false, time })
		});
		for (const c of this.cells) {
			if (c.freed) continue;
			const strength = Math.max(0, c.obstacle.hp!) / CELL_HP;
			list.push({ baseY: c.spot.y, draw: () => drawCell(ctx, c.spot.x, c.spot.y, LANTERNS[c.spot.who], strength, c.flash, time, c.obstacle.seed) });
		}
		return list;
	}
}
