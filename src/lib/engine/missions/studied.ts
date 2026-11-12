// Season three, Act 1, episode 1: Studied. Hal and Kilowog, on Oa.
//
// The Guardians took Sinestro's great yellow lantern home "to be studied".
// They locked it in a containment ring of four pylons in the plaza and set to
// work. It cracked. Fear is pouring out of it.
//
//   The lantern pulses: every pulse throws dread over everyone near it (your
//   constructs come out weaker) and a wave of fear spills out of the cracks:
//   Sinestro Corps grunts and Fear Hounds made of yellow light.
//
//   Some go for the pylons and claw at them. A pylon that falls lets more
//   fear out, and the lantern's containment drains faster. Stand by a damaged
//   pylon with nothing on you and Hal pours his will into it: it mends, and
//   costs him willpower.
//
//   Five waves, and the Guardians are ready to seal it. They aren't fast
//   enough: it shatters, and something streaks out of it, toward Earth.
//
// Lose: containment hits zero, or Hal goes down three times.

import { addDread } from '../dread';
import { isStanding } from '../dummy';
import { drawBattery } from '../draw/effects';
import { drawWashed } from '../draw/wash';
import type { Enemy, EnemyKind, Role } from '../enemies/enemies';
import type { Drawable, Game } from '../game';
import type { GameMap } from '../map';
import { BATTERY_MAX_CHARGE } from '../willpower';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

const LIVES = 3;
const INTRO_TIME = 3;
const TOUGHNESS = 3.6;
const MIGHT = 3.0;
const W = 3200;
const H = 2000;
/** The lantern, in the middle of the plaza, and its four pylons round it. */
export const LANTERN = { x: 1600, y: 980 };
export const PYLONS = [
	{ x: 1180, y: 760 },
	{ x: 2020, y: 760 },
	{ x: 1180, y: 1220 },
	{ x: 2020, y: 1220 }
];
const ENTRY = { x: 1600, y: 1560 };
export const PYLON_HP = 100;
/** A fear creature this close to a pylon claws it: health a second. */
export const CLAW = { range: 110, rate: 9 };
/** Hal mending a pylon: how close, how fast, and the willpower it costs a second. */
export const MEND = { range: 150, rate: 14, cost: 7 };
/** Containment drains this much a second for each pylon down (0..1). */
const LEAK = 0.012;
/** The lantern's pulse: how often, how far it reaches, and the dread it throws. */
export const PULSE = { every: 9, range: 760, dread: 0.22 };
/** The next wave comes once this one's down, or after this long regardless. */
const WAVE_AFTER = 45;
const FINALE_TIME = 4;

type Wave = { kind: EnemyKind; role: Role; clawer?: boolean }[];
const WAVES: Wave[] = [
	[{ kind: 'fearHound', role: 'berserker', clawer: true }, { kind: 'fearGrunt', role: 'gunner' }, { kind: 'fearHound', role: 'hunter' }],
	[{ kind: 'fearGrunt', role: 'berserker', clawer: true }, { kind: 'fearHound', role: 'hunter', clawer: true }, { kind: 'fearGrunt', role: 'gunner' }, { kind: 'fearHound', role: 'berserker' }],
	[{ kind: 'fearHound', role: 'berserker', clawer: true }, { kind: 'fearHound', role: 'berserker', clawer: true }, { kind: 'fearGrunt', role: 'gunner' }, { kind: 'fearGrunt', role: 'hunter' }],
	[{ kind: 'fearGrunt', role: 'berserker', clawer: true }, { kind: 'fearHound', role: 'hunter', clawer: true }, { kind: 'fearHound', role: 'berserker' }, { kind: 'fearGrunt', role: 'gunner' }, { kind: 'fearHound', role: 'hunter' }],
	[{ kind: 'fearHound', role: 'berserker', clawer: true }, { kind: 'fearHound', role: 'berserker', clawer: true }, { kind: 'fearGrunt', role: 'berserker', clawer: true }, { kind: 'fearGrunt', role: 'gunner' }, { kind: 'fearHound', role: 'hunter' }, { kind: 'fearGrunt', role: 'gunner' }],
	[{ kind: 'fearGrunt', role: 'berserker', clawer: true }, { kind: 'fearHound', role: 'berserker', clawer: true }, { kind: 'fearHound', role: 'hunter', clawer: true }, { kind: 'fearGrunt', role: 'gunner' }, { kind: 'fearGrunt', role: 'gunner' }, { kind: 'fearHound', role: 'berserker' }, { kind: 'fearHound', role: 'hunter' }]
];

export interface Pylon {
	x: number;
	y: number;
	hp: number;
	/** Being clawed right now (it flickers). */
	clawed: number;
	/** Hal's will going into it right now. */
	mending: number;
}

/** Oa's plaza, the yellow lantern in its containment ring. */
export function buildStudiedMap(): GameMap {
	return {
		name: 'Oa · The containment ring',
		environment: 'planet',
		ground: 'oa',
		width: W,
		height: H,
		spawn: ENTRY,
		battery: { x: ENTRY.x - 260, y: ENTRY.y + 60 },
		dummies: [],
		obstacles: [{ kind: 'building', x: LANTERN.x - 70, y: LANTERN.y - 30, w: 140, h: 60, height: 40, blocksFlying: false, seed: 0, hidden: true }]
	};
}

export class Studied implements MissionDirector {
	state: MissionState = 'intro';
	timer = INTRO_TIME;
	lives = LIVES;
	downs = 0;
	elapsed = 0;
	/** The lantern's containment, 0..1. */
	containment = 1;
	lowest = 1;
	readonly pylons: Pylon[] = PYLONS.map((p) => ({ ...p, hp: PYLON_HP, clawed: 0, mending: 0 }));
	pylonsLost = 0;
	wave = 0;
	private waveAge = 0;
	/** Seconds till the lantern pulses, and how long since the last one (for the flash). */
	pulseIn = PULSE.every;
	pulseAge = 9;
	/** At the end: the lantern shattering, and the fragment streaking away. */
	shatter = 0;
	failReason: 'containment' | 'down' | null = null;
	readonly comms = new Comms();
	readonly starHint = '★ done · ★ no pylon lost · ★ Hal never went down';
	/** Who's going for which pylon, their health last tick, and how long they'll fight back after being hit. */
	private clawers = new Map<Enemy, { pylon: number; hp: number; angry: number }>();
	private crew: Enemy[] = [];
	private wasDown = false;
	private said = new Set<string>();

	// ------------------------------------------------------------ reporting

	get objective(): string {
		if (this.state === 'won') return 'The lantern is breaking';
		const hurt = this.pylons.find((p) => p.hp > 0 && p.hp < PYLON_HP * 0.6);
		if (hurt) return 'A pylon is failing: drive them off it, then stand by it to mend it';
		return `Hold the containment ring (wave ${Math.max(1, this.wave)} of ${WAVES.length})`;
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const list: MissionMeter[] = [{ label: 'Containment', value: this.containment, text: `${Math.round(this.containment * 100)}%`, low: this.containment < 0.35 }];
		this.pylons.forEach((p, i) => list.push({ label: `Pylon ${i + 1}`, value: p.hp / PYLON_HP, text: p.hp <= 0 ? 'DOWN' : `${Math.round(p.hp)}%`, low: p.hp < PYLON_HP * 0.35 }));
		list.push({ label: 'Next pulse', value: this.pulseIn / PULSE.every, text: `${Math.ceil(this.pulseIn)}s`, low: this.pulseIn < 2 });
		return list;
	}

	warning(): string | null {
		if (this.state !== 'playing') return null;
		if (this.pulseIn < 1.6) return 'The lantern is about to pulse! Get clear!';
		const clawed = this.pylons.find((p) => p.clawed > 0 && p.hp > 0);
		if (clawed) return 'They are tearing at a pylon!';
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.pylonsLost === 0 ? 1 : 0) + (this.downs === 0 ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'won') return 'The ring held long enough to save Oa. Not long enough to stop what was inside the lantern from getting out.';
		if (this.failReason === 'containment') return 'The containment ring failed, and the fear in the lantern poured out over Oa.';
		return 'Hal went down one time too many.';
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		return [
			{ label: 'Pylons lost', value: `${this.pylonsLost}` },
			{ label: 'Containment at its lowest', value: `${Math.round(this.lowest * 100)}%` },
			{ label: 'Time', value: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
		];
	}

	// ---------------------------------------------------------------- rules

	update(game: Game, dt: number) {
		this.comms.update(dt);
		this.pulseAge += dt;
		switch (this.state) {
			case 'intro':
				this.timer -= dt;
				if (this.timer <= 0) this.start(game);
				return;
			case 'won':
				this.timer += dt;
				this.shatter = Math.min(1, this.timer / FINALE_TIME);
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

		this.pulse(game, dt);
		this.claw(game, dt);
		this.mend(game, dt);
		const down = this.pylons.filter((p) => p.hp <= 0).length;
		this.containment = Math.max(0, this.containment - LEAK * down * dt);
		this.lowest = Math.min(this.lowest, this.containment);
		if (this.containment <= 0) return this.lose('containment');

		this.crew = this.crew.filter(isStanding);
		this.waveAge += dt;
		if (this.crew.length === 0) {
			if (this.wave >= WAVES.length) return this.win(game);
			this.nextWave(game);
		} else if (this.waveAge > WAVE_AFTER && this.wave < WAVES.length) this.nextWave(game);
	}

	private start(game: Game) {
		this.state = 'playing';
		this.comms.scene([
			['Guardians', 'The lantern has cracked. What is inside is coming out. Hold the ring, Lanterns.'],
			['Kilowog', "You heard 'em, poozer. Nothing gets to those pylons."],
			['Hal', 'And if something does, I patch it. Got it.']
		]);
		this.nextWave(game);
	}

	/** Out of the cracks, all round the lantern. */
	private nextWave(game: Game) {
		const plan = WAVES[this.wave];
		this.wave++;
		this.waveAge = 0;
		plan.forEach((m, i) => {
			const a = (i / plan.length) * Math.PI * 2 + this.wave;
			const e = game.spawnEnemy(m.kind, LANTERN.x + Math.cos(a) * 140, LANTERN.y + Math.sin(a) * 90, m.role);
			e.brain.grit = TOUGHNESS;
			e.brain.might = MIGHT;
			e.brain.alert = 10;
			e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * TOUGHNESS);
			this.crew.push(e);
			if (m.clawer) this.clawers.set(e, { pylon: this.nearestStanding(e.x, e.y), hp: e.hp, angry: 0 });
		});
		if (this.wave > 1) this.comms.say(...WAVE_LINES[this.wave - 2], true);
	}

	private nearestStanding(x: number, y: number): number {
		let best = 0;
		let bestD = Infinity;
		this.pylons.forEach((p, i) => {
			if (p.hp <= 0) return;
			const d = Math.hypot(p.x - x, p.y - y);
			if (d < bestD) {
				bestD = d;
				best = i;
			}
		});
		return best;
	}

	/** The lantern pulses: dread over everyone near it, and a flash you can see coming. */
	private pulse(game: Game, dt: number) {
		this.pulseIn -= dt;
		if (this.pulseIn > 0) return;
		this.pulseIn = PULSE.every;
		this.pulseAge = 0;
		for (const p of game.players) {
			if (p.downed) continue;
			const d = Math.hypot(p.x - LANTERN.x, p.y - LANTERN.y);
			if (d < PULSE.range) addDread(p, PULSE.dread * (1 - d / PULSE.range) + 0.05);
		}
		game.constructs.effects.push({ kind: 'shockwave', x: LANTERN.x, y: LANTERN.y, age: 0, life: 0.8, radius: PULSE.range } as never);
		this.once('pulse', 'Kilowog', "Feel that? That's fear. Fight through it: every hit you land pushes it back!");
	}

	/** Clawers make for a pylon and tear at it; anything of theirs near a pylon claws it. */
	private claw(game: Game, dt: number) {
		for (const p of this.pylons) p.clawed = Math.max(0, p.clawed - dt);
		for (const [e, c] of [...this.clawers]) {
			if (!isStanding(e)) {
				this.clawers.delete(e);
				continue;
			}
			let target = this.pylons[c.pylon];
			if (target.hp <= 0) {
				c.pylon = this.nearestStanding(e.x, e.y);
				target = this.pylons[c.pylon];
				if (target.hp <= 0) {
					this.clawers.delete(e);
					continue;
				}
			}
			const d = Math.hypot(e.x - target.x, e.y - target.y);
			// Hit, it turns on whoever hit it for a while (then goes back to the pylon)
			if (e.hp < c.hp) c.angry = 3;
			c.hp = e.hp;
			c.angry = Math.max(0, c.angry - dt);
			if (c.angry > 0) {
				e.brain.errand = null;
				continue;
			}
			e.brain.errand = d > CLAW.range * 0.7 ? { x: target.x + (e.x < target.x ? -60 : 60), y: target.y + 20, speed: 190 } : null;
		}
		for (const e of game.enemies) {
			if (!isStanding(e)) continue;
			for (const p of this.pylons) {
				if (p.hp <= 0 || Math.hypot(e.x - p.x, e.y - p.y) > CLAW.range) continue;
				p.hp = Math.max(0, p.hp - CLAW.rate * dt);
				p.clawed = 0.3;
				this.once(`claw${this.pylons.indexOf(p)}`, 'Guardians', 'They are tearing at a pylon! Drive them off it!');
				if (p.hp <= 0) {
					this.pylonsLost++;
					game.constructs.effects.push({ kind: 'burst', x: p.x, y: p.y - 60, age: 0, life: 0.7, radius: 160 } as never);
					this.comms.say('Guardians', 'A pylon has fallen! The containment is failing faster!', true);
				}
			}
		}
	}

	/** Hal, standing by a damaged pylon with nothing on him, pours his will into it. */
	private mend(game: Game, dt: number) {
		const hal = game.players[0];
		for (const p of this.pylons) p.mending = Math.max(0, p.mending - dt * 3);
		if (hal.downed) return;
		const p = this.pylons.find((k) => k.hp > 0 && k.hp < PYLON_HP && Math.hypot(hal.x - k.x, hal.y - k.y) < MEND.range);
		if (!p) return;
		const pressed = game.enemies.some((e) => isStanding(e) && Math.hypot(e.x - hal.x, e.y - hal.y) < 220);
		if (pressed || hal.willpower < 4) return;
		p.hp = Math.min(PYLON_HP, p.hp + MEND.rate * dt);
		p.mending = 1;
		hal.willpower = Math.max(0, hal.willpower - MEND.cost * dt);
		this.once('mend', 'Hal', "Come on, come on... it's holding. My will's going into it.");
	}

	private once(id: string, who: string, text: string) {
		if (this.said.has(id)) return;
		this.said.add(id);
		this.comms.say(who, text, true);
	}

	private win(game: Game) {
		this.state = 'won';
		this.timer = 0;
		for (const p of game.players) p.victoryTimer = 0.4;
		this.comms.scene([
			['Guardians', 'Enough. We will seal it now. Stand clear of the--'],
			['Kilowog', "It's breaking! Get DOWN!"],
			['Hal', 'Something came out of it. It went that way. Toward... Sector 2814.'],
			['Guardians', 'Toward Earth.']
		]);
	}

	private lose(reason: 'containment' | 'down') {
		if (this.state !== 'playing') return;
		this.state = 'lost';
		this.failReason = reason;
	}

	// -------------------------------------------------------------- drawing

	cameraPoints(): [number, number][] {
		return [[LANTERN.x, LANTERN.y]];
	}

	goal(): { x: number; y: number } | null {
		if (this.state !== 'playing') return null;
		return this.pylons.find((p) => p.hp > 0 && (p.clawed > 0 || p.hp < PYLON_HP * 0.5)) ?? null;
	}

	get goalFirst(): boolean {
		return this.pylons.some((p) => p.hp > 0 && p.hp < PYLON_HP * 0.3);
	}

	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		const list: Drawable[] = [{ baseY: LANTERN.y + 40, draw: () => drawStudiedLantern(ctx, LANTERN.x, LANTERN.y, time, this.containment, this.pulseIn, this.pulseAge, this.shatter) }];
		for (const p of this.pylons) list.push({ baseY: p.y, draw: () => drawPylon(ctx, p, LANTERN, time, this.shatter) });
		return list;
	}
}

/** What's said as each wave after the first comes in. */
const WAVE_LINES: [string, string][] = [
	['Guardians', 'More. The cracks are widening.'],
	['Kilowog', "They're going for the pylons, Jordan! Keep 'em off!"],
	['Hal', "It's like it knows what it's doing. Like it's thinking."],
	['Hal', 'It keeps coming. Kilowog, how much is IN that thing?'],
	['Guardians', 'The last of it, if we are fortunate. Hold, and we can seal it.']
];

// ------------------------------------------------------------- drawing helpers

/**
 * The great yellow lantern in its containment ring: cracking as containment
 * fails, flaring before it pulses, and at the end shattering, with something
 * streaking out of it.
 */
export function drawStudiedLantern(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, containment: number, pulseIn: number, pulseAge: number, shatter: number) {
	const flare = Math.max(0, 1 - pulseIn / 1.6);
	drawWashed(ctx, x, y, { side: 200, up: 360, down: 80 }, { color: '#ffcf2e', amount: 0.85 }, (c) => {
		c.translate(x, y);
		const k = 2.2 * (1 + flare * 0.08 * Math.sin(time * 30));
		c.scale(k, k);
		if (shatter < 0.35) drawBattery(c, { x: 0, y: 0, charge: BATTERY_MAX_CHARGE }, true, time);
	});
	// Cracks of yellow light across it, more as containment goes
	const cracks = Math.round((1 - containment) * 7) + 2 + (shatter > 0 ? 6 : 0);
	ctx.save();
	ctx.globalCompositeOperation = 'lighter';
	ctx.strokeStyle = `rgba(255, 220, 80, ${0.6 + 0.4 * flare})`;
	ctx.lineWidth = 3;
	ctx.beginPath();
	for (let i = 0; i < cracks; i++) {
		const a = i * 2.4 + 0.3;
		const r0 = 18;
		const r1 = 60 + ((i * 37) % 40);
		ctx.moveTo(x + Math.cos(a) * r0, y - 90 + Math.sin(a) * r0);
		ctx.lineTo(x + Math.cos(a + 0.2) * (r0 + r1) * 0.5, y - 90 + Math.sin(a + 0.2) * (r0 + r1) * 0.5);
		ctx.lineTo(x + Math.cos(a) * r1, y - 90 + Math.sin(a) * r1);
	}
	ctx.stroke();
	// The pulse coming, and going out
	if (flare > 0 || pulseAge < 0.8) {
		const g = ctx.createRadialGradient(x, y - 90, 0, x, y - 90, 260);
		const a = Math.max(flare * 0.5, pulseAge < 0.8 ? 0.6 * (1 - pulseAge / 0.8) : 0);
		g.addColorStop(0, `rgba(255, 230, 120, ${a})`);
		g.addColorStop(1, 'rgba(255, 190, 40, 0)');
		ctx.fillStyle = g;
		ctx.fillRect(x - 260, y - 350, 520, 520);
	}
	// The end: it shatters, and something streaks up and away
	if (shatter > 0) {
		const burst = Math.min(1, shatter * 3);
		const g = ctx.createRadialGradient(x, y - 90, 0, x, y - 90, 420 * burst);
		g.addColorStop(0, `rgba(255, 245, 190, ${0.9 * (1 - shatter * 0.6)})`);
		g.addColorStop(1, 'rgba(255, 190, 40, 0)');
		ctx.fillStyle = g;
		ctx.fillRect(x - 440, y - 520, 880, 880);
		const k = Math.max(0, (shatter - 0.25) / 0.75);
		if (k > 0) {
			const fx = x + k * 1400;
			const fy = y - 90 - k * 1100;
			ctx.strokeStyle = `rgba(255, 210, 60, ${1 - k * 0.5})`;
			ctx.lineWidth = 6;
			ctx.beginPath();
			ctx.moveTo(x, y - 90);
			ctx.quadraticCurveTo(x + k * 300, y - 90 - k * 700, fx, fy);
			ctx.stroke();
			ctx.fillStyle = '#fff3b0';
			ctx.beginPath();
			ctx.arc(fx, fy, 10, 0, Math.PI * 2);
			ctx.fill();
		}
	}
	ctx.restore();
}

/** A containment pylon: a green crystal on a plinth, a beam into the lantern; flickering when clawed, dark when down. */
export function drawPylon(ctx: CanvasRenderingContext2D, p: Pylon, lantern: { x: number; y: number }, time: number, shatter: number) {
	const alive = p.hp > 0 && shatter < 0.3;
	const k = p.hp / PYLON_HP;
	ctx.save();
	ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
	ctx.beginPath();
	ctx.ellipse(p.x, p.y, 44, 13, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = '#0b0b0d';
	ctx.lineWidth = 4;
	ctx.fillStyle = '#2c3a48';
	ctx.fillRect(p.x - 24, p.y - 80, 48, 80);
	ctx.strokeRect(p.x - 24, p.y - 80, 48, 80);
	// The beam into the lantern
	if (alive) {
		const flick = p.clawed > 0 ? 0.4 + 0.6 * Math.abs(Math.sin(time * 40)) : 1;
		ctx.globalCompositeOperation = 'lighter';
		ctx.strokeStyle = `rgba(80, 255, 140, ${(0.25 + 0.5 * k) * flick})`;
		ctx.lineWidth = 4 + 6 * k;
		ctx.beginPath();
		ctx.moveTo(p.x, p.y - 150);
		ctx.lineTo(lantern.x, lantern.y - 90);
		ctx.stroke();
		ctx.globalCompositeOperation = 'source-over';
	}
	// The crystal
	ctx.fillStyle = alive ? `rgba(90, 255, 150, ${0.55 + 0.4 * k})` : '#2a3a30';
	ctx.beginPath();
	ctx.moveTo(p.x, p.y - 190);
	ctx.lineTo(p.x + 26, p.y - 130);
	ctx.lineTo(p.x, p.y - 82);
	ctx.lineTo(p.x - 26, p.y - 130);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	// Hal's will going into it: green motes rising
	if (p.mending > 0) {
		ctx.fillStyle = 'rgba(160, 255, 190, 0.9)';
		for (let i = 0; i < 6; i++) {
			const t = (time * 1.4 + i / 6) % 1;
			ctx.fillRect(p.x - 30 + ((i * 13) % 60), p.y - 20 - t * 160, 4, 4);
		}
	}
	// Its health, a bar under it
	ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
	ctx.fillRect(p.x - 40, p.y + 14, 80, 8);
	ctx.fillStyle = k > 0.5 ? '#5cff8a' : k > 0.25 ? '#ffd23a' : '#ff4a3d';
	ctx.fillRect(p.x - 40, p.y + 14, 80 * k, 8);
	ctx.restore();
}
