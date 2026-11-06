// Season two, Act 2, mission 10: Lights Out. Hal, alone on Oa.
//
// Something came back through the gate behind Hal and Kilowog: Thunderers
// of Qward, the anti-matter universe's soldiers. They've got into the
// plaza round the Central Battery, and Oa is going dark.
//
//   In the dark you see as far as your ring's light, and it reaches as far
//   as your will: less willpower, less light. Near a Thunderer it shrinks
//   (where they walk, light dies). The Battery lights what it still can.
//   Their bolts and their charges glow, so you can find them.
//
//   They come in waves out of the dark. Some carry anti-matter charges to
//   the foot of the Battery and plant them: break a charge before its fuse
//   burns down, or it takes a chunk of the Battery's light with it. Four
//   waves, and the Guardians can relight it.
//
// Lose: the Battery goes out, or Hal goes down three times.

import { createDummy, isStanding, type Dummy } from '../dummy';
import { drawCentralBattery } from '../draw/siege';
import { drawDarkness, drawQwardCharge, type Light } from '../draw/darkness';
import { gearOf } from '../enemies/gear';
import type { Enemy, Role } from '../enemies/enemies';
import type { Drawable, Game } from '../game';
import type { GameMap } from '../map';
import { BATTERY } from './siegeOfOa';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

const LIVES = 3;
const INTRO_TIME = 3;
const TOUGHNESS = 3.8;
const MIGHT = 5.2;
/** The Battery's light: where it starts (already failing), and what a charge going off takes. */
const START_POWER = 0.6;
const CHARGE_BLAST = 0.14;
/** A charge: its health, its fuse, and how far it hurts when it goes. */
const CHARGE = { hp: 520, fuse: 20, radius: 200, damage: 30 };
/** Sappers plant their charge this close to the Battery. */
const PLANT_AT = 170;
/** The dark: how dark at full power and at none. */
const DARK = { lit: 0.55, out: 0.94 };
/** Hal's light: its reach at no willpower and at full, and how much a Thunderer near him takes off it. */
export const RING_LIGHT = { min: 150, max: 380, eaten: 0.45, eatRange: 260 };
/** The next wave comes once this one's down, or after this long regardless. */
const WAVE_AFTER = 50;

const W = 3200;
const H = 2000;
const ENTRY = { x: 1600, y: 1260 };

type Wave = { role: Role; sapper?: boolean }[];
const WAVES: Wave[] = [
	[{ role: 'gunner' }, { role: 'berserker' }, { role: 'hunter', sapper: true }],
	[{ role: 'gunner' }, { role: 'hunter' }, { role: 'berserker' }, { role: 'hunter', sapper: true }],
	[{ role: 'gunner' }, { role: 'gunner' }, { role: 'berserker' }, { role: 'hunter', sapper: true }, { role: 'berserker', sapper: true }],
	[{ role: 'gunner' }, { role: 'hunter' }, { role: 'hunter' }, { role: 'berserker' }, { role: 'berserker', sapper: true }, { role: 'gunner', sapper: true }]
];

interface Charge {
	dummy: Dummy;
	fuse: number;
}

/** Oa's plaza round the Central Battery, as in the siege, with nothing lit. */
export function buildLightsOutMap(): GameMap {
	return {
		name: 'Oa · The Central Battery, dark',
		environment: 'planet',
		ground: 'oa',
		width: W,
		height: H,
		spawn: ENTRY,
		battery: { x: BATTERY.x, y: BATTERY.y + 30 },
		dummies: [],
		obstacles: [{ kind: 'building', x: BATTERY.x - 70, y: BATTERY.y - 30, w: 140, h: 60, height: 40, blocksFlying: false, seed: 0, hidden: true }]
	};
}

export class LightsOut implements MissionDirector {
	state: MissionState = 'intro';
	timer = INTRO_TIME;
	lives = LIVES;
	downs = 0;
	elapsed = 0;
	/** The Battery's light, 0..1. */
	power = START_POWER;
	lowest = START_POWER;
	/** Which wave (1..4), and how long since it came. */
	wave = 0;
	private waveAge = 0;
	readonly charges: Charge[] = [];
	chargesBroken = 0;
	chargesBlown = 0;
	/** 0..1 as the Guardians relight it, at the end. */
	relit = 0;
	failReason: 'battery' | 'down' | null = null;
	readonly comms = new Comms();
	readonly starHint = '★ done · ★ no charge went off · ★ Hal never went down';
	private sappers = new Set<Enemy>();
	private crew: Enemy[] = [];
	private hit = 0;
	private wasDown = false;
	private said = new Set<string>();
	private gameRef: Game | null = null;

	// ------------------------------------------------------------ reporting

	get objective(): string {
		if (this.relit > 0) return 'The Guardians are relighting the Battery';
		const live = this.charges.length;
		if (live > 0) return `Break the charge${live > 1 ? 's' : ''} at the Battery (${live})`;
		return `Hunt the Thunderers in the dark (wave ${Math.max(1, this.wave)} of ${WAVES.length})`;
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const list: MissionMeter[] = [{ label: 'Battery', value: this.power, text: `${Math.round(this.power * 100)}%`, low: this.power < 0.3 }];
		for (const c of this.charges) list.push({ label: 'Charge fuse', value: c.fuse / CHARGE.fuse, text: `${Math.ceil(c.fuse)}s`, low: c.fuse < 6 });
		return list;
	}

	warning(): string | null {
		if (this.state !== 'playing') return null;
		const c = this.charges.find((k) => k.fuse < 7);
		if (c) return 'A charge is about to go! Break it!';
		if (this.charges.length > 0) return 'Charge planted on the Battery!';
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.chargesBlown === 0 ? 1 : 0) + (this.downs === 0 ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'won') return 'The Central Battery burns bright again, and every ring in the Corps with it. Whatever let them through the gate, it was not an accident.';
		if (this.failReason === 'battery') return 'The Central Battery went out, and every ring in the Corps went dark with it.';
		return 'Hal went down one time too many in the dark.';
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		return [
			{ label: 'Charges broken', value: `${this.chargesBroken}` },
			{ label: 'Charges that went off', value: `${this.chargesBlown}` },
			{ label: 'Battery at its lowest', value: `${Math.round(this.lowest * 100)}%` },
			{ label: 'Time', value: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
		];
	}

	// ---------------------------------------------------------------- rules

	update(game: Game, dt: number) {
		this.gameRef = game;
		this.comms.update(dt);
		this.hit = Math.max(0, this.hit - dt);
		switch (this.state) {
			case 'intro':
				this.timer -= dt;
				if (this.timer <= 0) this.start(game);
				return;
			case 'won':
				this.timer += dt;
				this.relit = Math.min(1, this.relit + dt / 3);
				this.power = Math.min(1, this.power + dt / 3);
				return;
			case 'lost':
				return;
		}
		this.elapsed += dt;
		const hal = game.players[0];
		if (hal.downed && !this.wasDown) {
			this.lives--;
			this.downs++;
			if (this.lives <= 0) return this.lose('down');
		}
		this.wasDown = hal.downed;

		this.sap(game);
		this.fuses(game, dt);
		if (this.state !== 'playing') return;

		this.crew = this.crew.filter(isStanding);
		this.waveAge += dt;
		if (this.crew.length === 0 && this.charges.length === 0) {
			if (this.wave >= WAVES.length) return this.win(game);
			this.nextWave(game);
		} else if (this.waveAge > WAVE_AFTER && this.wave < WAVES.length) this.nextWave(game);
	}

	private start(game: Game) {
		this.state = 'playing';
		this.comms.scene([
			['Guardians', 'They are in the plaza, Hal Jordan. We cannot see them. Neither will you, beyond your ring.'],
			['Hal', 'Then I keep my will up and my light up. Got it.'],
			['Guardians', 'Watch the Battery. If they reach its foot, they will try to put it out for good.']
		]);
		this.nextWave(game);
	}

	/** They come in out of the dark, from wherever Hal isn't looking. */
	private nextWave(game: Game) {
		const plan = WAVES[this.wave];
		this.wave++;
		this.waveAge = 0;
		const hal = game.players[0];
		const away = Math.atan2(BATTERY.y - hal.y, BATTERY.x - hal.x) + (Math.random() - 0.5) * 1.6;
		const cx = Math.max(200, Math.min(W - 200, BATTERY.x + Math.cos(away) * 900));
		const cy = Math.max(200, Math.min(H - 200, BATTERY.y + Math.sin(away) * 700));
		plan.forEach((m, i) => {
			const a = (i / plan.length) * Math.PI * 2;
			const e = game.spawnEnemy('thunderer', cx + Math.cos(a) * 120, cy + Math.sin(a) * 90, m.role);
			e.brain.grit = TOUGHNESS;
			e.brain.might = MIGHT;
			e.brain.alert = 10;
			e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * TOUGHNESS);
			this.crew.push(e);
			if (m.sapper) this.sappers.add(e);
		});
		if (this.wave > 1) this.comms.say(...WAVE_LINES[this.wave - 2], true);
	}

	/** Sappers make for the foot of the Battery, plant, and then fight. */
	private sap(game: Game) {
		for (const e of [...this.sappers]) {
			if (!isStanding(e)) {
				this.sappers.delete(e);
				continue;
			}
			const d = Math.hypot(e.x - BATTERY.x, e.y - BATTERY.y - 40);
			if (d > PLANT_AT) {
				e.brain.errand = { x: BATTERY.x + (e.x < BATTERY.x ? -120 : 120), y: BATTERY.y + 60, speed: 170 };
				continue;
			}
			e.brain.errand = null;
			this.sappers.delete(e);
			const c = createDummy(e.x + (BATTERY.x - e.x) * 0.3, e.y + 20);
			c.kind = 'qwardCharge';
			c.hp = c.maxHp = CHARGE.hp;
			c.respawns = false;
			game.dummies.push(c);
			this.charges.push({ dummy: c, fuse: CHARGE.fuse });
			this.once(`plant${this.charges.length}`, 'Guardians', 'A charge, at the foot of the Battery! Break it, Hal Jordan!');
		}
	}

	private fuses(game: Game, dt: number) {
		for (const c of [...this.charges]) {
			const d = c.dummy;
			d.x = d.prevX = d.homeX;
			d.y = d.prevY = d.homeY;
			d.vx = d.vy = 0;
			if (!isStanding(d)) {
				this.charges.splice(this.charges.indexOf(c), 1);
				this.chargesBroken++;
				this.comms.say('Hal', this.charges.length ? 'One down. Where is the other?' : "Charge is scrap. Battery's still burning.");
				continue;
			}
			c.fuse -= dt;
			if (c.fuse > 0) continue;
			// It goes off: a hole in the light, and anyone near is thrown
			this.charges.splice(this.charges.indexOf(c), 1);
			d.gone = true;
			this.chargesBlown++;
			this.power = Math.max(0, this.power - CHARGE_BLAST);
			this.lowest = Math.min(this.lowest, this.power);
			this.hit = 0.6;
			game.constructs.effects.push({ kind: 'redBlast', x: d.x, y: d.y, age: 0, life: 0.7, radius: CHARGE.radius });
			for (const p of game.players) {
				if (p.downed || Math.hypot(p.x - d.x, p.y - d.y) > CHARGE.radius) continue;
				p.health = Math.max(0, p.health - CHARGE.damage);
			}
			this.comms.say('Guardians', this.power < 0.25 ? 'The Battery is failing! One more and it is gone!' : 'The Battery is dimming! Every ring in the Corps feels that!', true);
			if (this.power <= 0) this.lose('battery');
		}
	}

	private once(id: string, who: string, text: string) {
		if (this.said.has(id)) return;
		this.said.add(id);
		this.comms.say(who, text, true);
	}

	private win(game: Game) {
		this.state = 'won';
		this.timer = 0;
		game.players[0].victoryTimer = 0.4;
		this.comms.scene([
			['Guardians', 'It is done. We are relighting the Battery.'],
			['Hal', "They came through the gate behind us. Somebody opened the door for them from the other side."],
			['Guardians', 'Yes. And we know who is on the other side.']
		]);
	}

	private lose(reason: 'battery' | 'down') {
		if (this.state !== 'playing') return;
		this.state = 'lost';
		this.failReason = reason;
	}

	// -------------------------------------------------------------- drawing

	/** How dark it is away from any light. */
	get darkness(): number {
		return (DARK.out - (DARK.out - DARK.lit) * this.power) * (1 - this.relit);
	}

	/** How far Hal's light reaches right now: his will, less what the Thunderers near him eat. */
	ringLight(game: Game): number {
		const hal = game.players[0];
		const will = hal.downed ? 0 : hal.willpower / hal.maxWillpower;
		const r = RING_LIGHT.min + (RING_LIGHT.max - RING_LIGHT.min) * will;
		const near = game.enemies.some((e) => e.kind === 'thunderer' && isStanding(e) && Math.hypot(e.x - hal.x, e.y - hal.y) < RING_LIGHT.eatRange);
		return near ? r * (1 - RING_LIGHT.eaten) : r;
	}

	cameraPoints(): [number, number][] {
		return this.charges.map((c): [number, number] => [c.dummy.x, c.dummy.y]);
	}

	goal(): { x: number; y: number } | null {
		if (this.state !== 'playing') return null;
		return this.charges[0]?.dummy ?? null;
	}

	get goalFirst(): boolean {
		return this.charges.some((c) => c.fuse < 10);
	}

	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		const list: Drawable[] = [{ baseY: BATTERY.y + 31, draw: () => drawCentralBattery(ctx, BATTERY.x, BATTERY.y, time, this.power, this.relit, this.hit) }];
		for (const c of this.charges) list.push({ baseY: c.dummy.y, draw: () => drawQwardCharge(ctx, c.dummy.x, c.dummy.y, Math.max(0, c.fuse / CHARGE.fuse), c.dummy.flash > 0, time) });
		return list;
	}

	drawOver(ctx: CanvasRenderingContext2D): void {
		const game = this.gameRef;
		if (!game || this.state === 'intro') return;
		const lights: Light[] = [];
		const hal = game.players[0];
		lights.push({ x: hal.x, y: hal.y - 50, r: this.ringLight(game) });
		// The Battery lights round itself, as far as its power goes
		lights.push({ x: BATTERY.x, y: BATTERY.y - 60, r: 160 + 420 * this.power, strength: 0.9 });
		// Charges glow; so do their bolts in the air, and the flash where one's thrown
		for (const c of this.charges) lights.push({ x: c.dummy.x, y: c.dummy.y - 24, r: 120, strength: 0.7 });
		for (const s of game.constructs.red.shots) if (s.look === 'qwa') lights.push({ x: s.x, y: s.y - 50, r: 110, strength: 0.6 });
		for (const f of gearOf(game.constructs).fx) if (f.kind === 'muzzle' && f.weapon === 'qwaBolt') lights.push({ x: f.x, y: f.y - 60, r: 180, strength: 0.7 * (1 - f.age / f.life) });
		// Your constructs light their own way
		for (const e of game.constructs.effects) if (e.kind === 'impact' || e.kind === 'burst') lights.push({ x: e.x, y: e.y - 30, r: 90, strength: 0.5 });
		drawDarkness(ctx, lights, this.darkness);
	}
}

/** What's said as each wave after the first comes in. */
const WAVE_LINES: [string, string][] = [
	['Guardians', 'More of them, out of the dark. They are carrying something.'],
	['Hal', "They're everywhere I'm not. Ring, more light!"],
	['Guardians', 'The last of them, Hal Jordan. Hold the Battery and we can relight it.']
];
