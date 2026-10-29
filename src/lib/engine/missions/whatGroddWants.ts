// Season two, Act 2, mission 7: What Grodd Wants. John, with the Flash and Hawkgirl.
//
// Gorilla City tech is loose in Central City, and this time Grodd isn't after
// the city. He wants the ring, and he has found a way into John's head.
//
//   streets     two waves of Grodd's soldiers in the streets.
//   amplifiers  Grodd comes down with three mind amplifiers. While they stand
//               they heal him, and they let him reach into John's mind: his
//               Mind Grip locks two of John's constructs for a few seconds.
//               Break the amplifiers.
//   grodd       then it's Grodd himself.
//
// Lose: John goes down 3 times.

import { createDummy, isStanding, type Dummy } from '../dummy';
import type { Enemy, Role } from '../enemies/enemies';
import type { Drawable, Game } from '../game';
import { seededRandom } from '../map';
import type { Player } from '../player';
import { buildCentralCityMap, cityDecor } from './callToArms';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

export type GroddPhase = 'streets' | 'amplifiers' | 'grodd';

const LIVES = 3;
const INTRO_TIME = 3;
const TOUGHNESS = 3.4;
const MIGHT = 3.6;
const GRODD_HEALTH = 2.3;
const GRODD_MIGHT = 3.2;
const AMP_HP = 360;
/** Each amplifier still standing heals Grodd this much a second. */
export const AMP_HEAL = 22;
/** Mind Grip: how often (amplifiers up / down), how many constructs, how long. */
export const GRIP = { every: 9, everyAlone: 16, locks: 2, time: 6 };
/** Amplifiers still up after this long: the Flash starts vibrating them apart (this much a second each). */
export const FLASH_HELP = { after: 90, dps: 7 };

const W = 3500;
const H = 2100;
const DIG = { x: 2450, y: 1050 };
const AMPS = [
	{ x: 2150, y: 700 },
	{ x: 2150, y: 1400 },
	{ x: 2850, y: 1050 }
];

type Wave = [Role | 'brute' | 'gunner2' | 'grodd', number, number][];
const STREET_WAVES: Wave[] = [
	[
		['brute', 1300, 800],
		['brute', 1350, 1300],
		['gunner2', 1550, 950],
		['gunner2', 1500, 1150]
	],
	[
		['brute', 1800, 700],
		['brute', 1850, 1400],
		['brute', 1900, 1050],
		['gunner2', 2100, 850],
		['gunner2', 2100, 1250]
	]
];
const AMP_WAVE: Wave = [
	['grodd', DIG.x + 150, DIG.y],
	['brute', DIG.x - 250, DIG.y - 300],
	['brute', DIG.x - 250, DIG.y + 300],
	['gunner2', DIG.x + 300, DIG.y - 250],
	['gunner2', DIG.x + 300, DIG.y + 250]
];

export class WhatGroddWants implements MissionDirector {
	state: MissionState = 'intro';
	phase: GroddPhase = 'streets';
	timer = INTRO_TIME;
	lives = LIVES;
	elapsed = 0;
	downs = 0;
	defeated = 0;
	grips = 0;
	failReason: 'lantern' | null = null;
	readonly comms = new Comms();
	readonly amps: Dummy[] = [];
	readonly starHint = '★ done · ★ John never went down · ★ done in under 5 minutes';
	grodd: Enemy | null = null;
	waveIndex = 0;
	private wave: Enemy[] = [];
	private all: Enemy[] = [];
	private counted = new WeakSet<Enemy>();
	private grip = GRIP.every;
	/** Seconds into the amplifier fight. */
	private ampTime = 0;
	/** Constructs Grodd is holding, and for how much longer. */
	private held: { id: string; left: number }[] = [];
	private wasDown = false;
	private said = new Set<string>();
	private decor: Drawable[] | null = null;
	private rand: () => number;

	constructor(seed = 71) {
		this.rand = seededRandom(seed);
	}

	// ------------------------------------------------------------ reporting

	get ampsLeft(): number {
		return this.amps.filter(isStanding).length;
	}

	get objective(): string {
		if (this.phase === 'streets') return `Clear the streets (wave ${this.waveIndex + 1} of ${STREET_WAVES.length})`;
		if (this.phase === 'amplifiers') return `Break the mind amplifiers (${AMPS.length - this.ampsLeft} / ${AMPS.length})`;
		return 'Take down Grodd';
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const list: MissionMeter[] = [];
		const g = this.grodd;
		if (g) list.push({ label: 'Grodd', value: Math.max(0, g.hp) / g.maxHp, text: `${Math.round((Math.max(0, g.hp) / g.maxHp) * 100)}%` });
		this.amps.forEach((a, i) => {
			if (isStanding(a)) list.push({ label: `Amp ${i + 1}`, value: a.hp / a.maxHp, text: `${Math.round((a.hp / a.maxHp) * 100)}%` });
		});
		return list;
	}

	warning(): string | null {
		if (this.state !== 'playing') return null;
		if (this.held.length > 0) return 'Grodd is in your head! Some constructs are locked!';
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.downs === 0 ? 1 : 0) + (this.elapsed <= 300 ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'won') return "Grodd goes back to Gorilla City in chains, and John's head is his own again.";
		return 'John went down one time too many.';
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		return [
			{ label: 'Gorillas beaten', value: `${this.defeated}` },
			{ label: 'Mind Grips', value: `${this.grips}` },
			{ label: 'Times down', value: `${this.downs}` },
			{ label: 'Time', value: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
		];
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
					this.wave = this.spawn(game, STREET_WAVES[0]);
					this.comms.scene([
						['Flash', "Gorilla City tech all over downtown, and Grodd's soldiers guarding it. Feels like a setup."],
						['Hawkgirl', 'It is a setup. He wanted the League here. He wanted you here, John.'],
						['John', 'Then let\'s not keep him waiting.']
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
		this.release(john, dt);

		switch (this.phase) {
			case 'streets':
				if (this.wave.every((e) => !isStanding(e))) {
					this.waveIndex++;
					if (this.waveIndex < STREET_WAVES.length) {
						this.comms.say('Flash', 'Here come more of them! Big ones!');
						this.wave = this.spawn(game, STREET_WAVES[this.waveIndex]);
					} else this.startAmps(game);
				}
				break;
			case 'amplifiers':
			case 'grodd': {
				const g = this.grodd;
				if (!g || !isStanding(g)) {
					this.win(game);
					break;
				}
				// The amplifiers keep him whole
				const up = this.ampsLeft;
				if (up > 0) g.hp = Math.min(g.maxHp, g.hp + AMP_HEAL * up * dt);
				// And let him into John's head
				this.grip -= dt;
				if (this.grip <= 0) {
					this.grip = up > 0 ? GRIP.every : GRIP.everyAlone;
					this.mindGrip(game, john);
				}
				// Taking too long: the Flash goes to work on them himself
				if (this.phase === 'amplifiers') {
					this.ampTime += dt;
					if (this.ampTime > FLASH_HELP.after && up > 0) {
						for (const a of this.amps) {
							if (!isStanding(a)) continue;
							a.hp -= FLASH_HELP.dps * dt;
							if (a.hp <= 0) {
								a.hp = 0;
								a.down = 1;
							}
						}
						this.once('vibrate', 'Flash', "I'm vibrating these towers apart! Keep Grodd busy!");
					}
				}
				if (this.phase === 'amplifiers' && up === 0) {
					this.phase = 'grodd';
					this.comms.scene([
						['Grodd', 'You broke my toys. No matter. I do not need machines to be in your head.'],
						['Hawkgirl', "He's open! Everything you've got, John!"]
					]);
				}
				break;
			}
		}
	}

	private startAmps(game: Game) {
		this.phase = 'amplifiers';
		for (const a of AMPS) {
			const d = createDummy(a.x, a.y);
			d.kind = 'mindAmp';
			d.hp = d.maxHp = AMP_HP;
			d.respawns = false;
			game.dummies.push(d);
			this.amps.push(d);
		}
		const spawned = this.spawn(game, AMP_WAVE);
		this.grodd = spawned.find((e) => e.kind === 'grodd') ?? null;
		this.wave = spawned;
		this.comms.scene([
			['Grodd', 'Green Lantern. Such a simple thing, your ring: it does whatever your mind tells it.'],
			['Grodd', 'So I will tell your mind.'],
			['Flash', 'Those towers are amplifying him! Break them and he loses his edge!']
		]);
	}

	/** Grodd reaches into John's head: two of his constructs won't come. */
	private mindGrip(game: Game, john: Player) {
		if (john.downed) return;
		const free = john.loadout.filter((d) => !john.locked.has(d.id));
		for (let i = 0; i < GRIP.locks && free.length > 0; i++) {
			const def = free.splice(Math.floor(this.rand() * free.length), 1)[0];
			john.locked.add(def.id);
			this.held.push({ id: def.id, left: GRIP.time });
			if (john.loadout[john.selected]?.id === def.id) {
				const next = john.loadout.findIndex((d) => !john.locked.has(d.id));
				if (next >= 0) john.selected = next;
				john.firing = false;
				john.charge = 0;
			}
		}
		this.grips++;
		game.constructs.effects.push({ kind: 'callout', x: john.x, y: john.y - 60, age: 0, life: 1.2, text: 'MIND GRIP', owner: john, hurt: true });
		const lines = ['Your ring answers to me now.', 'Feel that? That is me, behind your eyes.', 'Reach for it, Lantern. It is not there.'];
		this.comms.say('Grodd', lines[(this.grips - 1) % lines.length], true);
	}

	/** Constructs come back when the grip lets go. */
	private release(john: Player, dt: number) {
		for (const h of [...this.held]) {
			h.left -= dt;
			if (h.left > 0) continue;
			john.locked.delete(h.id);
			this.held.splice(this.held.indexOf(h), 1);
		}
	}

	private once(id: string, who: string, text: string) {
		if (this.said.has(id)) return;
		this.said.add(id);
		this.comms.say(who, text, true);
	}

	private spawn(game: Game, wave: Wave): Enemy[] {
		const out = wave.map(([role, x, y]) => {
			const ex = Math.max(80, Math.min(W - 80, x));
			const ey = Math.max(260, Math.min(H - 260, y));
			const grodd = role === 'grodd';
			const e = grodd
				? game.spawnEnemy('grodd', ex, ey)
				: role === 'brute'
					? game.spawnEnemy('gorillaBrute', ex, ey)
					: game.spawnEnemy('gorillaGunner', ex, ey);
			e.brain.grit = grodd ? 1 : TOUGHNESS;
			e.brain.might = grodd ? GRODD_MIGHT : MIGHT;
			e.brain.alert = 10;
			e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * (grodd ? GRODD_HEALTH : TOUGHNESS));
			return e;
		});
		this.all.push(...out);
		return out;
	}

	private countDefeats() {
		for (const e of this.all) {
			if (e.kind === 'grodd') continue;
			if (!isStanding(e) && !this.counted.has(e)) {
				this.counted.add(e);
				this.defeated++;
			}
		}
	}

	private countDowns(game: Game) {
		const john = game.players[0];
		if (john.downed && !this.wasDown) {
			this.lives--;
			this.downs++;
			if (this.lives <= 0) this.lose(game);
			else this.comms.say('Flash', 'John! Up, up, up! I can only be in three places at once!', true);
		}
		this.wasDown = john.downed;
	}

	private win(game: Game) {
		this.state = 'won';
		this.timer = 0;
		const john = game.players[0];
		for (const h of this.held) john.locked.delete(h.id);
		this.held.length = 0;
		for (const p of game.players) p.victoryTimer = 0.4;
		this.comms.scene([
			['Flash', 'Is he out of your head? Like, all the way out?'],
			['John', "All the way. That was the strangest fight of my life. I couldn't trust my own ring."],
			['Hawkgirl', 'Then you know how it feels for the rest of us. Welcome to the League, John.']
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
		if (this.phase === 'amplifiers') return this.amps.find(isStanding) ?? null;
		if (this.phase === 'grodd') return this.grodd;
		return this.wave.find(isStanding) ?? null;
	}

	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		const list: Drawable[] = [...(this.decor ??= cityDecor(ctx, W, H, 1956, DIG))];
		const g = this.grodd;
		for (const a of this.amps) {
			const standing = isStanding(a);
			list.push({ baseY: a.y, draw: () => drawAmp(ctx, a.x, a.y, standing ? a.hp / a.maxHp : 0, standing, time) });
			if (standing && g && isStanding(g)) list.push({ baseY: -1e6 + 2, draw: () => drawLink(ctx, a.x, a.y - 140, g.x, g.y - 70, time) });
		}
		return list;
	}
}

/** A Gorilla City mind amplifier: a stone-and-steel pylon with a purple crystal throbbing on top. */
function drawAmp(ctx: CanvasRenderingContext2D, x: number, y: number, health: number, standing: boolean, time: number) {
	ctx.save();
	ctx.strokeStyle = '#0b0710';
	ctx.lineWidth = 5;
	ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
	ctx.beginPath();
	ctx.ellipse(x, y, 40, 12, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = '#4b4a52';
	const h = standing ? 120 : 50;
	ctx.fillRect(x - 20, y - h, 40, h);
	ctx.strokeRect(x - 20, y - h, 40, h);
	if (standing) {
		const pulse = 0.6 + 0.4 * Math.sin(time * 6 + x);
		ctx.fillStyle = `rgba(179, 107, 255, ${0.7 + 0.3 * pulse})`;
		ctx.shadowColor = '#b36bff';
		ctx.shadowBlur = 20 * pulse;
		ctx.beginPath();
		ctx.moveTo(x, y - h - 40);
		ctx.lineTo(x + 18, y - h - 12);
		ctx.lineTo(x, y - h + 4);
		ctx.lineTo(x - 18, y - h - 12);
		ctx.closePath();
		ctx.fill();
		ctx.shadowBlur = 0;
		ctx.stroke();
		ctx.fillStyle = '#d9b0ff';
		ctx.fillRect(x - 14, y - 30, 28 * health, 6);
	}
	ctx.restore();
}

/** The psychic link from an amplifier to Grodd. */
function drawLink(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, time: number) {
	ctx.save();
	ctx.strokeStyle = `rgba(179, 107, 255, ${0.35 + 0.2 * Math.sin(time * 9 + x1)})`;
	ctx.shadowColor = '#b36bff';
	ctx.shadowBlur = 12;
	ctx.lineWidth = 3;
	ctx.setLineDash([14, 10]);
	ctx.lineDashOffset = -time * 60;
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);
	ctx.stroke();
	ctx.restore();
}
