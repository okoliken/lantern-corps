// Mission 2: Silent Outpost.
//
// Kel-Aris Station on the frontier of Sector 2814 stopped answering. Hal and
// Kilowog (an AI partner) land to find out why:
//
//   search     walk up to the station gate
//   ambush     Red Lanterns drop in: it was a trap
//   survivors  find the station crew hiding in the wreckage (each one found
//              brings more Red Lanterns); a Lantern construct carries them
//              to safety
//   tower      reach the comms tower, where the station's Lantern made her stand
//   ring       her ring rises and leaves to find a new bearer in Sector 2814:
//              Earth (it chooses John Stewart, in the scene after the mission)
//   hold       the last and biggest wave
//   message    her last recording names Sector 666
//
// Hal has 3 lives; Kilowog gets back up at the Lantern on the landing pad.

import { isStanding } from '../dummy';
import type { Enemy, Role } from '../enemies/enemies';
import { drawCommsTower, drawFallenLantern, drawRingLeaving, drawScorch, drawSurvivor } from '../draw/outpost';
import { drawMarker } from '../draw/training';
import type { Drawable, Game } from '../game';
import { CRATE_HP, seededRandom, type GameMap, type Obstacle } from '../map';
import { BATTERY_MAX_CHARGE } from '../willpower';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

export type OutpostPhase = 'search' | 'ambush' | 'survivors' | 'tower' | 'ring' | 'hold' | 'message';

export const OUTPOST_LIVES = 3;
const INTRO_TIME = 3;
const MARKER_RADIUS = 60;
/** How close Hal (or Kilowog) has to get to a survivor to find them. */
const FIND_RADIUS = 70;
/** Seconds for a found survivor to be carried off. */
const CARRY_TIME = 2.5;
/** Seconds for the ring to rise, hang there while it speaks, and fly off. */
const RING_TIME = 8;
/** Three stars: finish within this many seconds. */
const PAR_TIME = 300;
/** How much tougher and harder-hitting these Red Lanterns are than the lab's (like the Ambush scene). */
const TOUGHNESS = 4;
const MIGHT = 3;

const W = 3800;
const H = 1800;
const PAD = { x: 320, y: 900 };
const GATE = { x: 1250, y: 900 };
const TOWER = { x: 3350, y: 880 };
/** Where Tolen Vex fell, at the foot of the tower. */
const FALLEN = { x: TOWER.x - 90, y: TOWER.y + 50 };
/** Where the station's own Lantern battery stands (it comes back online after the ambush). */
const STATION_BATTERY = { x: 2050, y: 1080 };

/** Who drops in, and where, relative to the spot: [role, dx, dy]. */
type Wave = [Role | 'skallox', number, number][];
const AMBUSH: Wave = [
	['berserker', 260, -140],
	['hunter', 320, 120],
	['gunner', 480, 0]
];
const SURVIVOR_WAVES: Wave[] = [
	[
		['berserker', -300, -120],
		['gunner', 280, 160],
		['hunter', 360, -200]
	],
	[
		['hunter', 300, -160],
		['berserker', -260, 180],
		['gunner', 420, 40],
		['gunner', -420, -40]
	],
	[
		['berserker', 320, 120],
		['berserker', -320, -120]
	]
];
const HOLD: Wave = [
	['skallox', -320, 0],
	['berserker', -380, -160],
	['berserker', -420, 180],
	['hunter', -200, -300],
	['gunner', -560, 40],
	['gunner', 160, 280]
];

/** The station crew, hiding around the compound. */
const SURVIVOR_SPOTS = [
	{ x: 1700, y: 560 },
	{ x: 2350, y: 1330 },
	{ x: 2750, y: 640 }
];

/** Kel-Aris: a landing pad on the left, the station compound in the middle, the comms tower on the right. */
export function buildOutpostMap(): GameMap {
	const rand = seededRandom(2815);
	const obstacles: Obstacle[] = [];
	// Station modules around the central yard
	const modules: [number, number, number, number][] = [
		[1450, 420, 220, 130],
		[1850, 380, 180, 150],
		[2250, 440, 240, 120],
		[1500, 1180, 200, 140],
		[1950, 1250, 260, 120],
		[2450, 1150, 200, 160],
		[2800, 420, 160, 120],
		[2800, 1250, 180, 130]
	];
	for (const [x, y, w, h] of modules) {
		obstacles.push({ kind: 'building', x, y, w, h, height: 80 + rand() * 50, blocksFlying: false, seed: rand() });
	}
	// Wreckage: crates and rubble scattered where the fighting was
	for (let i = 0; i < 26; i++) {
		const crate = rand() < 0.55;
		const size = crate ? 34 + rand() * 10 : 30 + rand() * 40;
		const x = 1100 + rand() * 2300;
		const y = 250 + rand() * 1300;
		const o: Obstacle = {
			kind: crate ? 'crate' : 'rock',
			x,
			y,
			w: size,
			h: size * (crate ? 0.7 : 0.55),
			height: crate ? 28 : 12 + size * 0.2,
			blocksFlying: false,
			seed: rand(),
			hp: crate ? CRATE_HP : undefined,
			maxHp: crate ? CRATE_HP : undefined,
			movable: crate || undefined
		};
		const clear = (p: { x: number; y: number }, r: number) => Math.hypot(x + size / 2 - p.x, y - p.y) > r;
		const blocked = obstacles.some((b) => x < b.x + b.w + 30 && x + size + 30 > b.x && y < b.y + b.h + 30 && y + size + 30 > b.y);
		if (!blocked && clear(GATE, 180) && clear(TOWER, 220) && SURVIVOR_SPOTS.every((s) => clear(s, 120))) obstacles.push(o);
	}
	// The tower's footprint
	obstacles.push({ kind: 'building', x: TOWER.x - 40, y: TOWER.y - 16, w: 80, h: 28, height: 0, blocksFlying: false, seed: 0.5, hidden: true });
	return {
		name: 'Kel-Aris Station',
		environment: 'planet',
		ground: 'ash',
		width: W,
		height: H,
		spawn: PAD,
		battery: { x: PAD.x - 10, y: PAD.y - 110 },
		dummies: [],
		obstacles
	};
}

interface Survivor {
	x: number;
	y: number;
	/** 0 hiding, then 0..1 while being carried off. */
	found: number;
	seed: number;
}

export class SilentOutpost implements MissionDirector {
	state: MissionState = 'intro';
	phase: OutpostPhase = 'search';
	timer = INTRO_TIME;
	lives = OUTPOST_LIVES;
	elapsed = 0;
	failReason: 'lantern' | null = null;
	/** Red Lanterns beaten. */
	defeated = 0;
	/** Lives lost so far. */
	downs = 0;
	readonly comms = new Comms();
	readonly survivors: Survivor[] = SURVIVOR_SPOTS.map((s, i) => ({ ...s, found: 0, seed: i * 1.7 + 0.3 }));
	readonly starHint = '★ done · ★ no lives lost · ★ under 5 minutes';
	private wave: Enemy[] = [];
	private ringTime = 0;
	private wasDown: boolean[] = [];
	private scorches: [number, number, number, number][] = [];
	private game: Game | null = null;

	constructor(seed = 7) {
		const rand = seededRandom(seed);
		for (let i = 0; i < 22; i++) this.scorches.push([1100 + rand() * 2400, 250 + rand() * 1300, 30 + rand() * 50, rand()]);
	}

	// ------------------------------------------------------------ reporting

	get objective(): string {
		switch (this.phase) {
			case 'search':
				return 'Search Kel-Aris Station';
			case 'ambush':
				return 'Fight off the ambush';
			case 'survivors':
				return `Find the station crew (${this.found} / ${this.survivors.length})`;
			case 'tower':
				return 'Get to the comms tower';
			case 'ring':
				return 'Tolen Vex';
			case 'hold':
				return 'Hold the tower';
			case 'message':
				return 'Kel-Aris Station';
		}
	}

	get found(): number {
		return this.survivors.filter((s) => s.found > 0).length;
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const left = this.wave.filter(isStanding).length;
		if (left === 0) return [];
		return [{ label: 'Reds', value: left / Math.max(1, this.wave.length), text: `${left} left`, low: false }];
	}

	warning(): string | null {
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.downs === 0 ? 1 : 0) + (this.elapsed <= PAR_TIME ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'won') return "Tolen Vex is gone, but her crew is safe and her ring has found someone new. And now there's a name: Sector 666.";
		return 'Hal went down one time too many.';
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		return [
			{ label: 'Crew rescued', value: `${this.found} / ${this.survivors.length}` },
			{ label: 'Red Lanterns beaten', value: `${this.defeated}` },
			{ label: 'Time', value: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
		];
	}

	// ---------------------------------------------------------------- rules

	update(game: Game, dt: number) {
		this.game = game;
		this.comms.update(dt);
		for (const s of this.survivors) if (s.found > 0 && s.found < 1) s.found = Math.min(1, s.found + dt / CARRY_TIME);
		this.countDefeats();

		switch (this.state) {
			case 'intro':
				this.timer -= dt;
				if (this.timer <= 0) {
					this.state = 'playing';
					this.comms.say('Kilowog', "Kel-Aris Station. Dead quiet. I don't like it, poozer.");
					this.comms.say('Hal', 'Maybe everybody took the day off.');
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
		const hal = game.players[0];
		const nearAny = (p: { x: number; y: number }, r: number) => game.players.some((pl) => !pl.downed && Math.hypot(pl.x - p.x, pl.y - p.y) < r);

		switch (this.phase) {
			case 'search':
				if (Math.hypot(hal.x - GATE.x, hal.y - GATE.y) < MARKER_RADIUS * 2) {
					this.comms.say('Kilowog', "HEADS UP! It's a trap!", true);
					this.spawnWave(game, AMBUSH, GATE.x, GATE.y);
					this.phase = 'ambush';
				}
				break;
			case 'ambush':
				if (this.waveCleared()) {
					this.phase = 'survivors';
					// The station's own Lantern still works
					game.batteries.push({ ...STATION_BATTERY, charge: BATTERY_MAX_CHARGE });
					this.comms.say('Hal', 'Red Lanterns. Out here?');
					this.comms.say('Kilowog', 'Somebody might still be alive. Look for distress beacons!');
				}
				break;
			case 'survivors':
				for (const s of this.survivors) {
					if (s.found > 0 || !nearAny(s, FIND_RADIUS)) continue;
					s.found = 0.001;
					this.onFound(game, s);
				}
				if (this.found === this.survivors.length && this.waveCleared()) {
					this.phase = 'tower';
					this.comms.say('Hal', "That's everyone. Now let's find out what happened to their Lantern.");
				}
				break;
			case 'tower':
				// Reaching her body: her ring rises and leaves to find a new bearer in her sector
				if (Math.hypot(hal.x - FALLEN.x, hal.y - FALLEN.y) < MARKER_RADIUS * 2.5) {
					this.phase = 'ring';
					this.ringTime = 0;
					// The ring speaks as it rises, and it's gone by the time Hal works it out
					this.comms.scene([
						['Ring', 'Lantern Tolen Vex of Sector 2814 has fallen. Seeking a replacement in Sector 2814.'],
						['Kilowog', "She held 'em off right here, all alone..."],
						['Hal', "Sector 2814... that's my sector. That ring's headed for Earth."],
						['Kilowog', "It's pickin' somebody new, poozer."]
					]);
				}
				break;
			case 'ring':
				this.ringTime += dt;
				// The ring's gone; the Red Lanterns didn't leave
				if (this.ringTime >= RING_TIME && !this.comms.current) {
					this.phase = 'hold';
					this.comms.say('Kilowog', 'Company! Skallox! Stand your ground!', true);
					this.spawnWave(game, HOLD, TOWER.x, TOWER.y);
				}
				break;
			case 'hold':
				if (this.waveCleared()) {
					this.phase = 'message';
					this.comms.scene([
						['Kilowog', 'Her last message is still on the tower...'],
						['Tolen Vex (recording)', 'Kel-Aris... they came out of a red light. Hunting Lanterns. Their leader said the Guardians will burn for Sector 666—'],
						['Hal', 'Sector 666?'],
						['Kilowog', "The Lost Sector. Nothin' out there but ghosts. And bad memories."]
					]);
				}
				break;
			case 'message':
				// Win once the last line has been said
				if (!this.comms.current) this.win(game);
				break;
		}
	}

	private onFound(game: Game, s: Survivor) {
		const n = this.found;
		const lines = [
			'Lanterns! Thank the Guardians... they came out of the sky, screaming...',
			'Our Lantern, Tolen Vex, she went to the comms tower to call for help. She never came back.',
			"I heard them laughing. Red light everywhere. Please, get us out of here."
		];
		this.comms.scene([
			['Station crew', lines[n - 1] ?? lines[0]],
			...(n === 1 ? [['Kilowog', "I've got 'em! Construct's carrying 'em to the pad. Keep looking!"] as [string, string]] : [])
		]);
		// Every rescue draws more of them in
		this.spawnWave(game, SURVIVOR_WAVES[n - 1] ?? [], s.x, s.y);
	}

	private spawnWave(game: Game, wave: Wave, x: number, y: number) {
		const spawned = wave.map(([role, dx, dy]) => {
			const ex = Math.max(80, Math.min(W - 80, x + dx));
			const ey = Math.max(120, Math.min(H - 80, y + dy));
			const e = role === 'skallox' ? game.spawnEnemy('skallox', ex, ey) : game.spawnEnemy('rageGrunt', ex, ey, role);
			e.brain.grit = TOUGHNESS;
			e.brain.might = MIGHT;
			// Skallox leads the last wave: tough already, only a little tougher
			const tough = role === 'skallox' ? 1.3 : TOUGHNESS;
			e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * tough);
			return e;
		});
		// The meter counts what's left of everything that's come in since the last all-clear
		this.wave = this.waveCleared() ? spawned : [...this.wave, ...spawned];
	}

	private waveCleared(): boolean {
		return this.wave.every((e) => !isStanding(e));
	}

	private counted = new WeakSet<Enemy>();
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
		if (hal.downed && !this.wasDown[0]) {
			this.lives--;
			this.downs++;
			if (this.lives <= 0) this.lose(game);
			else this.comms.say('Kilowog', 'Get up, poozer! I got your back!');
		}
		this.wasDown[0] = hal.downed;
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

	cameraPoints(): [number, number][] {
		// While the ring leaves, keep her and the tower in view
		return this.phase === 'ring' ? [[TOWER.x - 60, TOWER.y - 60]] : [];
	}

	/** Where to head next (an arrow points there when it's off screen). */
	goal(): { x: number; y: number } | null {
		if (this.state !== 'playing' || this.wave.some(isStanding)) return null;
		if (this.phase === 'search') return GATE;
		if (this.phase === 'tower') return FALLEN;
		if (this.phase === 'survivors') return this.survivors.find((s) => s.found === 0) ?? null;
		return null;
	}

	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		const list: Drawable[] = [];
		// Scorch marks lie on the ground under everything
		list.push({ baseY: -1e6, draw: () => this.scorches.forEach(([x, y, r, seed]) => drawScorch(ctx, x, y, r, seed)) });
		list.push({ baseY: TOWER.y, draw: () => drawCommsTower(ctx, TOWER.x, TOWER.y, time) });
		const fallen = FALLEN;
		list.push({ baseY: fallen.y, draw: () => drawFallenLantern(ctx, fallen.x, fallen.y, time) });
		if (this.phase === 'ring') {
			const t = Math.min(1, this.ringTime / RING_TIME);
			if (t < 1) list.push({ baseY: 1e6, draw: () => drawRingLeaving(ctx, fallen.x + 10, fallen.y - 10, t, time) });
		}
		for (const s of this.survivors) {
			if (s.found >= 1) continue;
			// Carried from where they hid back toward the landing pad
			const k = s.found;
			const x = s.x + (PAD.x + 60 - s.x) * k;
			const y = s.y + (PAD.y + 80 - s.y) * k;
			list.push({ baseY: y, draw: () => drawSurvivor(ctx, x, y, k, time, s.seed) });
		}
		// Where to go next
		const goal = this.state !== 'playing' ? null : this.phase === 'search' ? GATE : this.phase === 'tower' ? FALLEN : null;
		if (goal) list.push({ baseY: -1e5, draw: () => drawMarker(ctx, goal.x, goal.y, MARKER_RADIUS, time) });
		return list;
	}
}
