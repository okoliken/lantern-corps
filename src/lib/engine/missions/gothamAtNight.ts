// Season two, Act 2, mission 5: Gotham at Night. John, with Batman.
//
// Scarecrow has set up toxin tanks across the Narrows, venting fear gas into
// the streets. This is where John learns what fear does to a ring: the dread
// meter arrives here (dread.ts).
//
//   tanks      three toxin tanks, each guarded by Scarecrow's hired thugs.
//              Each one vents gas around it; break all three. Canisters come
//              over the rooftops at whoever is out in the open.
//   scarecrow  with his tanks gone, Crane comes down himself: a scythe, a
//              chain, and his toxin. Standing near him fills your dread.
//
// Dread weakens your constructs. Hit back and hold your shield to push it off.
// Lose: John goes down 3 times.

import { isStanding, createDummy, type Dummy } from '../dummy';
import { addDread } from '../dread';
import type { Enemy, Role } from '../enemies/enemies';
import type { Drawable, Game } from '../game';
import { seededRandom, type GameMap } from '../map';
import { buildCityMap, cityDecor } from './callToArms';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

export type GothamPhase = 'tanks' | 'scarecrow';

const LIVES = 3;
const INTRO_TIME = 3;
const TANK_HP = 650;
/** Gas around a standing tank, and from a canister: radius, dread a second inside. */
const TANK_GAS = { radius: 190, dread: 0.12 };
const CANISTER = { radius: 150, dread: 0.24, life: 8, warning: 1.3 };
/** Canisters over the rooftops: every few seconds at someone in the open (faster once Crane is down here). */
const CANISTER_EVERY = 7;
const THUG_TOUGHNESS = 3.6;
const THUG_MIGHT = 5;
const SCARECROW_HEALTH = 6;
const SCARECROW_MIGHT = 5;
/** Thugs who come running while the tanks stand. */
const REINFORCE_EVERY = 22;

const W = 3600;
const H = 2100;
const ENTRY = { x: 520, y: 1050 };
/** Where Crane makes his stand: a plaza kept clear. */
const PLAZA = { x: 2900, y: 1050 };
const TANKS = [
	{ x: 1350, y: 700 },
	{ x: 1900, y: 1450 },
	{ x: 2500, y: 650 }
];

type Wave = [Role | 'scarecrow', number, number][];
const GUARDS: Wave = [
	['gunner', -150, 120],
	['berserker', 150, -60],
	['gunner', 120, 200],
	['hunter', -120, -180]
];
const LAST_STAND: Wave = [
	['scarecrow', 0, 0],
	['berserker', -200, -220],
	['gunner', 240, -160],
	['gunner', 240, 200],
	['berserker', -180, 240]
];

interface Cloud {
	x: number;
	y: number;
	radius: number;
	dread: number;
	/** Seconds since it burst (negative: still in the air). */
	age: number;
	life: number;
}

export function buildGothamMap(): GameMap {
	return buildCityMap({ name: 'Gotham, the Narrows', ground: 'nightStreet', seed: 1939, width: W, height: H, spawn: ENTRY, clear: PLAZA });
}

export class GothamAtNight implements MissionDirector {
	state: MissionState = 'intro';
	phase: GothamPhase = 'tanks';
	timer = INTRO_TIME;
	lives = LIVES;
	elapsed = 0;
	downs = 0;
	defeated = 0;
	peakDread = 0;
	failReason: 'lantern' | null = null;
	readonly comms = new Comms();
	readonly tanks: Dummy[] = [];
	readonly clouds: Cloud[] = [];
	readonly starHint = '★ done · ★ dread never past 90% · ★ John never went down';
	scarecrow: Enemy | null = null;
	private wave: Enemy[] = [];
	private all: Enemy[] = [];
	private counted = new WeakSet<Enemy>();
	private canister = CANISTER_EVERY;
	private reinforce = REINFORCE_EVERY;
	private wasDown = false;
	private said = new Set<string>();
	private decor: Drawable[] | null = null;
	private rand: () => number;

	constructor(seed = 51) {
		this.rand = seededRandom(seed);
	}

	// ------------------------------------------------------------ reporting

	get tanksLeft(): number {
		return this.tanks.filter(isStanding).length;
	}

	get objective(): string {
		if (this.phase === 'tanks') return `Break the toxin tanks (${TANKS.length - this.tanksLeft} / ${TANKS.length})`;
		return 'Take down Scarecrow';
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const list: MissionMeter[] = [];
		const s = this.scarecrow;
		if (s) list.push({ label: 'Crane', value: Math.max(0, s.hp) / s.maxHp, text: `${Math.round((Math.max(0, s.hp) / s.maxHp) * 100)}%` });
		this.tanks.forEach((t, i) => {
			if (isStanding(t)) list.push({ label: `Tank ${i + 1}`, value: t.hp / t.maxHp, text: `${Math.round((t.hp / t.maxHp) * 100)}%` });
		});
		return list;
	}

	warning(game: Game): string | null {
		if (this.state !== 'playing') return null;
		const john = game.players[0];
		if (john.dread > 0.75) return 'The fear is taking hold! Shield up and hit back!';
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.peakDread <= 0.9 ? 1 : 0) + (this.downs === 0 ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'won') return "Crane is in cuffs and the Narrows can breathe. John has learned the ring's oldest lesson: will is what you do while you are afraid.";
		return 'John went down one time too many.';
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		return [
			{ label: 'Thugs beaten', value: `${this.defeated}` },
			{ label: 'Most dread', value: `${Math.round(this.peakDread * 100)}%` },
			{ label: 'Times down', value: `${this.downs}` },
			{ label: 'Time', value: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
		];
	}

	// ---------------------------------------------------------------- rules

	update(game: Game, dt: number) {
		this.gameRef = game;
		this.comms.update(dt);
		this.countDefeats();

		switch (this.state) {
			case 'intro':
				this.timer -= dt;
				if (this.timer <= 0) {
					this.state = 'playing';
					this.placeTanks(game);
					this.comms.scene([
						['Batman', 'Three tanks venting into the Narrows. Crane is testing his toxin on the whole neighbourhood.'],
						['John', 'Then we shut them off.'],
						['Batman', "Careful. That gas doesn't hurt the body. It goes after the mind, and your ring runs on yours."]
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
		const john = game.players[0];

		this.updateGas(game, dt);
		this.peakDread = Math.max(this.peakDread, john.dread);
		if (john.dread > 0.3) this.once('dread', 'Batman', "That's the toxin. Fear is just a feeling, Stewart. Shield up, keep hitting, and it lets go.");
		if (john.dread > 0.85) this.once('deep', 'John', "Can't... the constructs keep falling apart. Focus, Marine!");

		switch (this.phase) {
			case 'tanks': {
				this.reinforce -= dt;
				if (this.reinforce <= 0) {
					this.reinforce = REINFORCE_EVERY;
					const t = this.tanks.find(isStanding);
					if (t) this.spawn(game, GUARDS, t.x, t.y);
				}
				for (const t of this.tanks) {
					if (!isStanding(t) && !this.said.has(`tank${this.tanks.indexOf(t)}`)) {
						this.said.add(`tank${this.tanks.indexOf(t)}`);
						const left = this.tanksLeft;
						this.comms.say(left > 0 ? 'Batman' : 'Scarecrow', left > 0 ? `Good. ${left} more.` : 'You broke my beautiful machines. Then let us do this the old-fashioned way.', true);
					}
				}
				if (this.tanksLeft === 0) this.startScarecrow(game);
				break;
			}
			case 'scarecrow':
				if (this.scarecrow && !isStanding(this.scarecrow)) this.win(game);
				else if (this.scarecrow && this.scarecrow.hp < this.scarecrow.maxHp * 0.5)
					this.once('half', 'Scarecrow', 'Do you feel it, Lantern? That little voice saying you are not enough?');
				break;
		}
	}

	private placeTanks(game: Game) {
		for (const [i, t] of TANKS.entries()) {
			const d = createDummy(t.x, t.y);
			d.kind = 'toxinTank';
			d.hp = d.maxHp = TANK_HP;
			d.respawns = false;
			game.dummies.push(d);
			this.tanks.push(d);
			// Each tank's guards
			this.spawn(game, GUARDS, t.x, t.y);
			void i;
		}
	}

	/** Gas round the standing tanks, canisters over the rooftops, and what it does to a Lantern standing in it. */
	private updateGas(game: Game, dt: number) {
		this.canister -= dt;
		if (this.canister <= 0) {
			this.canister = CANISTER_EVERY * (this.phase === 'scarecrow' ? 0.7 : 1);
			const target = game.players[0];
			if (!target.downed) {
				this.clouds.push({
					x: target.x + target.vx * CANISTER.warning + (this.rand() - 0.5) * 80,
					y: target.y + target.vy * CANISTER.warning + (this.rand() - 0.5) * 60,
					radius: CANISTER.radius,
					dread: CANISTER.dread,
					age: -CANISTER.warning,
					life: CANISTER.life
				});
				this.once('canister', 'Batman', 'Canister! Get out from under it!');
			}
		}
		for (const c of this.clouds) c.age += dt;
		this.clouds.splice(0, this.clouds.length, ...this.clouds.filter((c) => c.age < c.life));
		for (const p of game.players) {
			if (p.hero || p.downed) continue;
			let rate = 0;
			for (const t of this.tanks) if (isStanding(t) && Math.hypot(p.x - t.x, p.y - t.y) < TANK_GAS.radius) rate += TANK_GAS.dread;
			for (const c of this.clouds) if (c.age >= 0 && Math.hypot(p.x - c.x, p.y - c.y) < c.radius * this.spread(c)) rate += c.dread;
			if (rate > 0) addDread(p, rate * dt);
		}
	}

	/** A cloud spreads fast when it bursts and thins out at the end. */
	private spread(c: Cloud): number {
		return Math.min(1, 0.4 + c.age * 1.5);
	}

	private startScarecrow(game: Game) {
		this.phase = 'scarecrow';
		const spawned = this.spawn(game, LAST_STAND, PLAZA.x, PLAZA.y);
		this.scarecrow = spawned.find((e) => e.kind === 'scarecrow') ?? null;
		this.comms.scene([
			['Batman', "He's here. In the plaza."],
			['Scarecrow', 'The famous Green Lantern. A ring that runs on will. I wonder how much will you have left, after a breath of mine.']
		]);
	}

	private spawn(game: Game, wave: Wave, x: number, y: number): Enemy[] {
		const out = wave.map(([role, dx, dy]) => {
			const ex = Math.max(80, Math.min(W - 80, x + dx));
			const ey = Math.max(260, Math.min(H - 260, y + dy));
			const crane = role === 'scarecrow';
			const e = crane ? game.spawnEnemy('scarecrow', ex, ey) : game.spawnEnemy('thug', ex, ey, role);
			e.brain.grit = crane ? 1 : THUG_TOUGHNESS;
			e.brain.might = crane ? SCARECROW_MIGHT : THUG_MIGHT;
			e.brain.alert = 10;
			e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * (crane ? SCARECROW_HEALTH : THUG_TOUGHNESS));
			return e;
		});
		this.wave = [...this.wave.filter(isStanding), ...out];
		this.all.push(...out);
		return out;
	}

	private countDefeats() {
		for (const e of this.all) {
			if (e.kind === 'scarecrow') continue;
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
		const john = game.players[0];
		if (john.downed && !this.wasDown) {
			this.lives--;
			this.downs++;
			if (this.lives <= 0) this.lose(game);
			else this.comms.say('Batman', "On your feet, Lantern. He's counting on you to stay down.", true);
		}
		this.wasDown = john.downed;
	}

	private win(game: Game) {
		this.state = 'won';
		this.timer = 0;
		for (const p of game.players) {
			p.victoryTimer = 0.4;
			p.dread = 0;
		}
		this.clouds.length = 0;
		this.comms.scene([
			['Batman', "He'll be in Arkham by morning."],
			['John', 'That gas... for a minute there I could barely make a fist.'],
			['Batman', "Everyone's afraid. The ones who matter do it anyway. Remember that."]
		]);
	}

	private lose(game: Game) {
		this.state = 'lost';
		this.failReason = 'lantern';
		game.downedNotice = false;
	}

	// -------------------------------------------------------------- drawing

	cameraPoints(): [number, number][] {
		return [];
	}

	goal(): { x: number; y: number } | null {
		if (this.state !== 'playing') return null;
		if (this.phase === 'scarecrow') return this.scarecrow && isStanding(this.scarecrow) ? this.scarecrow : PLAZA;
		const john = this.gameRef?.players[0];
		const standing = this.tanks.filter(isStanding);
		if (!john || standing.length === 0) return null;
		return standing.sort((a, b) => Math.hypot(a.x - john.x, a.y - john.y) - Math.hypot(b.x - john.x, b.y - john.y))[0];
	}

	/** The game, for the goal arrow (set every update). */
	private gameRef: Game | null = null;

	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		const list: Drawable[] = [...(this.decor ??= cityDecor(ctx, W, H, 1939, PLAZA))];
		for (const t of this.tanks) {
			const standing = isStanding(t);
			list.push({ baseY: t.y, draw: () => drawToxinTank(ctx, t.x, t.y, standing ? t.hp / t.maxHp : 0, standing, time) });
			if (standing) list.push({ baseY: -1e6 + 2, draw: () => drawGas(ctx, t.x, t.y, TANK_GAS.radius, 0.5, time) });
		}
		for (const c of this.clouds) {
			if (c.age < 0) list.push({ baseY: -1e6 + 3, draw: () => drawCanisterWarning(ctx, c.x, c.y, c.radius, 1 + c.age / CANISTER.warning) });
			else list.push({ baseY: -1e6 + 3, draw: () => drawGas(ctx, c.x, c.y, c.radius * this.spread(c), Math.min(1, (c.life - c.age) / 2), time) });
		}
		return list;
	}
}

// ------------------------------------------------------------- drawing helpers

/** A tank of Crane's toxin: a squat steel drum on legs, glowing yellow-green through its window. */
function drawToxinTank(ctx: CanvasRenderingContext2D, x: number, y: number, health: number, standing: boolean, time: number) {
	ctx.save();
	ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
	ctx.beginPath();
	ctx.ellipse(x, y, 56, 16, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = '#0b0b0d';
	ctx.lineWidth = 5;
	if (!standing) {
		// Broken: a split drum on its side
		ctx.fillStyle = '#3a3d44';
		ctx.beginPath();
		ctx.ellipse(x, y - 20, 50, 24, 0.3, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();
		ctx.restore();
		return;
	}
	// Legs
	ctx.fillStyle = '#2a2c31';
	for (const dx of [-34, 34]) {
		ctx.fillRect(x + dx - 5, y - 40, 10, 40);
		ctx.strokeRect(x + dx - 5, y - 40, 10, 40);
	}
	// The drum
	ctx.fillStyle = '#4b5059';
	ctx.fillRect(x - 46, y - 140, 92, 104);
	ctx.strokeRect(x - 46, y - 140, 92, 104);
	// Hazard band and the glowing window
	ctx.fillStyle = '#d9b02a';
	ctx.fillRect(x - 46, y - 70, 92, 12);
	const glow = 0.6 + 0.3 * Math.sin(time * 5 + x);
	ctx.fillStyle = `rgba(200, 255, 80, ${glow})`;
	ctx.shadowColor = '#c8ff50';
	ctx.shadowBlur = 16;
	ctx.fillRect(x - 22, y - 126, 44, 44 * Math.max(0.15, health));
	ctx.shadowBlur = 0;
	ctx.strokeRect(x - 22, y - 126, 44, 44);
	ctx.restore();
}

/** Fear gas: a sickly yellow-green haze, drifting. */
function drawGas(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, strength: number, time: number) {
	ctx.save();
	for (let i = 0; i < 4; i++) {
		const a = time * 0.4 + i * 1.7;
		const ox = Math.cos(a) * radius * 0.25;
		const oy = Math.sin(a * 1.3) * radius * 0.12;
		const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, radius);
		g.addColorStop(0, `rgba(200, 230, 70, ${0.22 * strength})`);
		g.addColorStop(1, 'rgba(200, 230, 70, 0)');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.ellipse(x + ox, y + oy, radius, radius * 0.6, 0, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.restore();
}

/** A canister coming over the rooftops: where it will burst. */
function drawCanisterWarning(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, progress: number) {
	ctx.save();
	ctx.strokeStyle = `rgba(220, 240, 90, ${0.5 + 0.4 * progress})`;
	ctx.lineWidth = 3;
	ctx.setLineDash([10, 8]);
	ctx.beginPath();
	ctx.ellipse(x, y, radius, radius * 0.6, 0, 0, Math.PI * 2);
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.fillStyle = '#5a5f2a';
	ctx.strokeStyle = '#0b0b0d';
	ctx.lineWidth = 3;
	const h = (1 - progress) * 420;
	ctx.fillRect(x - 9, y - 26 - h, 18, 24);
	ctx.strokeRect(x - 9, y - 26 - h, 18, 24);
	ctx.restore();
}
