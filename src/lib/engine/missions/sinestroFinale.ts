// Season two, Act 3, mission 12: Sinestro. The finale. John and Hal (choose
// who you play), with Kilowog, on Korugar.
//
// Sinestro has made Korugar the home of his Corps, and lit a great yellow
// lantern in the plaza of his citadel to charge their rings.
//
//   citadel   two waves of the Sinestro Corps on the way up to the plaza.
//   sinestro  the man himself. Every so often he raises his MIRROR: for a few
//             seconds nothing you throw lands, and part of it comes straight
//             back at you. Watch for it and hold fire.
//   lantern   hurt him badly and he draws on the great yellow lantern. Its
//             three lenses keep him from falling and heal him: break them.
//   final     nothing left between you. Beat him.
//
// The lantern itself can't be put out. It is still burning when it's over.
//
// Lose: you go down 3 times.

import { isStanding, createDummy, type Dummy } from '../dummy';
import { drawBattery } from '../draw/effects';
import type { Enemy, Role } from '../enemies/enemies';
import type { Drawable, Game } from '../game';
import type { GameMap } from '../map';
import { BATTERY_MAX_CHARGE } from '../willpower';
import { buildKorugarMap } from './korugar';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

export type FinalePhase = 'citadel' | 'sinestro' | 'lantern' | 'final';

const LIVES = 3;
const INTRO_TIME = 3;
const GRUNT_TOUGHNESS = 3.4;
const GRUNT_MIGHT = 4.6;
const SINESTRO_HEALTH = 8;
const SINESTRO_MIGHT = 3.6;
/** The mirror: the tell, how long it's up, how often (faster at the end), and how much comes back. */
export const MIRROR = { tell: 1.3, time: 3, every: 11, everyFinal: 8, share: 0.6 };
/** He draws on the lantern at this much health, and can't fall below it while a lens stands. */
export const DRAW_AT = 0.5;
const LENS_HP = 900;
/** Each standing lens heals him this much a second. */
const LENS_HEAL = 10;
/** The third star: less than this much of your own power thrown back at you. */
const REFLECT_STAR = 60;

const W = 3800;
const H = 2000;
/** The great yellow lantern, at the top of the plaza, and where Sinestro waits. */
const LANTERN = { x: 3500, y: 1000 };
const THRONE = { x: 3050, y: 1000 };
const LENSES = [
	{ x: LANTERN.x - 380, y: LANTERN.y - 330 },
	{ x: LANTERN.x - 420, y: LANTERN.y + 340 },
	{ x: LANTERN.x + 160, y: LANTERN.y + 420 }
];
const STEPS = [
	{ x: 1250, y: 1000 },
	{ x: 2250, y: 1000 }
];

type Wave = [Role, number, number][];
const WAVES: Wave[] = [
	[
		['hunter', -200, -200],
		['gunner', 200, -150],
		['berserker', 0, 0],
		['gunner', 220, 200],
		['hunter', -200, 220],
		['berserker', 120, 60]
	],
	[
		['berserker', -220, -200],
		['berserker', 220, 200],
		['gunner', 0, -260],
		['gunner', 0, 260],
		['hunter', -260, 60],
		['hunter', 260, -60],
		['gunner', 0, 0]
	]
];
const GUARD: Wave = [
	['gunner', -200, -260],
	['hunter', -200, 260]
];

export function buildFinaleSinestroMap(): GameMap {
	return { ...buildKorugarMap(), name: "Korugar, Sinestro's citadel" };
}

export class SinestroFinale implements MissionDirector {
	state: MissionState = 'intro';
	phase: FinalePhase = 'citadel';
	timer = INTRO_TIME;
	lives = LIVES;
	elapsed = 0;
	downs = 0;
	defeated = 0;
	wave = 0;
	/** The mirror: seconds into the tell (negative) or up (positive), or null while it's down. */
	mirror: number | null = null;
	failReason: 'lantern' | null = null;
	readonly comms = new Comms();
	readonly lenses: Dummy[] = [];
	readonly starHint = '★ done · ★ less than 60 of your own power thrown back at you · ★ you never went down';
	sinestro: Enemy | null = null;
	private mirrorIn = MIRROR.every;
	private all: Enemy[] = [];
	private counted = new WeakSet<Enemy>();
	private wasDown = false;
	private said = new Set<string>();
	private gameRef: Game | null = null;

	// ------------------------------------------------------------ reporting

	get objective(): string {
		switch (this.phase) {
			case 'citadel':
				return `Fight up to the citadel (wave ${this.wave} / ${WAVES.length})`;
			case 'lantern':
				return `Break the lantern's lenses (${LENSES.length - this.lensesLeft} / ${LENSES.length})`;
			default:
				return 'Beat Sinestro';
		}
	}

	get lensesLeft(): number {
		return this.lenses.filter(isStanding).length;
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const list: MissionMeter[] = [];
		const s = this.sinestro;
		if (s) list.push({ label: 'Sinestro', value: Math.max(0, s.hp) / s.maxHp, text: `${Math.round((Math.max(0, s.hp) / s.maxHp) * 100)}%` });
		this.lenses.forEach((l, i) => {
			if (isStanding(l)) list.push({ label: `Lens ${i + 1}`, value: l.hp / l.maxHp, text: `${Math.round((l.hp / l.maxHp) * 100)}%` });
		});
		return list;
	}

	warning(game: Game): string | null {
		if (this.state !== 'playing') return null;
		if (this.mirror !== null) return this.mirror < 0 ? 'MIRROR coming! Hold your fire!' : 'MIRROR! Your hits come back at you!';
		if (game.players[0].dread > 0.8) return 'Fear is taking over! Shield up!';
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		const me = this.gameRef?.players[0];
		return 1 + (me && me.reflected < REFLECT_STAR ? 1 : 0) + (this.downs === 0 ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'won') return 'Sinestro is on his way to the Sciencells of Oa. Behind him, in the empty plaza, the great yellow lantern is still burning.';
		return 'You went down one time too many.';
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		const me = this.gameRef?.players[0];
		return [
			{ label: 'Sinestro Corps beaten', value: `${this.defeated}` },
			{ label: 'Thrown back at you', value: `${Math.round(me?.reflected ?? 0)}` },
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
					this.nextWave(game);
					this.comms.scene([
						['Kilowog', 'Korugar. He came home and made it his.'],
						['Hal', "That light at the top of the city. That's what's charging every yellow ring out there."],
						['John', 'Then we go up and get him. All three of us.']
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

		if (this.phase === 'citadel') {
			if (this.all.every((e) => !isStanding(e))) {
				if (this.wave < WAVES.length) {
					this.nextWave(game);
					this.comms.say('Kilowog', 'More of them on the steps! Keep climbing!', true);
				} else this.startSinestro(game);
			}
			return;
		}

		const s = this.sinestro!;
		this.updateMirror(game, dt);
		switch (this.phase) {
			case 'sinestro':
				if (s.hp <= s.maxHp * DRAW_AT) this.startLantern(game);
				break;
			case 'lantern': {
				// The lenses keep him standing, and keep him topped up
				const left = this.lensesLeft;
				s.hp = Math.min(s.maxHp * 0.75, s.hp + left * LENS_HEAL * dt);
				if (s.hp < s.maxHp * DRAW_AT) s.hp = s.maxHp * DRAW_AT;
				if (!isStanding(s)) {
					s.hp = s.maxHp * DRAW_AT;
					s.down = 0;
				}
				if (left < LENSES.length) this.once(`lens${left}`, left === 0 ? 'Sinestro' : 'Hal', left === 0 ? 'You think the light was all I had? I was the greatest of you without it!' : `${left} more lens${left === 1 ? '' : 'es'}! Keep going!`);
				if (left === 0) this.phase = 'final';
				break;
			}
			case 'final':
				if (!isStanding(s)) this.win(game);
				else if (s.hp < s.maxHp * 0.2) this.once('low', 'Sinestro', 'This changes nothing. Fear is in every corner of the universe now. You cannot cage it.');
				break;
		}
	}

	/** Every so often, a tell, then a few seconds when his mirror throws your own hits back at you. */
	private updateMirror(game: Game, dt: number) {
		const s = this.sinestro!;
		if (this.mirror === null) {
			this.mirrorIn -= dt;
			if (this.mirrorIn <= 0 && isStanding(s)) {
				this.mirror = -MIRROR.tell;
				game.constructs.effects.push({ kind: 'callout', x: s.x, y: s.y - 150, age: 0, life: 1.6, text: 'MIRROR', hurt: true });
				this.once('mirror', 'John', "Careful! Whatever we hit him with, he's throwing back!");
			}
			return;
		}
		this.mirror += dt;
		s.mirror = this.mirror >= 0 ? MIRROR.share : undefined;
		if (this.mirror >= MIRROR.time) {
			this.mirror = null;
			s.mirror = undefined;
			this.mirrorIn = this.phase === 'final' ? MIRROR.everyFinal : MIRROR.every;
		}
	}

	private nextWave(game: Game) {
		const at = STEPS[this.wave];
		this.spawn(game, WAVES[this.wave++], at.x, at.y);
	}

	private startSinestro(game: Game) {
		this.phase = 'sinestro';
		const s = game.spawnEnemy('sinestroYellow', THRONE.x, THRONE.y);
		s.brain.might = SINESTRO_MIGHT;
		s.brain.alert = 10;
		s.hp = s.maxHp = s.brain.lastHp = Math.round(s.maxHp * SINESTRO_HEALTH);
		this.sinestro = s;
		this.mirrorIn = MIRROR.every * 0.6;
		this.spawn(game, GUARD, THRONE.x, THRONE.y);
		this.comms.scene([
			['Sinestro', 'Jordan. Stewart. Kilowog. Every Lantern I ever trained, come to tell me I was wrong.'],
			['Hal', "You were the best of us. That's what makes this so bad."],
			['Sinestro', 'Then let me teach you one last lesson. Everything you throw at me, I can throw back.']
		]);
	}

	private startLantern(game: Game) {
		this.phase = 'lantern';
		for (const l of LENSES) {
			const d = createDummy(l.x, l.y);
			d.kind = 'fearLens';
			d.hp = d.maxHp = LENS_HP;
			d.respawns = false;
			game.dummies.push(d);
			this.lenses.push(d);
		}
		this.spawn(game, GUARD, LANTERN.x - 300, LANTERN.y);
		this.comms.scene([
			['Sinestro', 'ENOUGH. The light answers to me.'],
			['Kilowog', "He's drawing on that lantern! It's keeping him up! Hit the lenses around it!"]
		]);
	}

	private spawn(game: Game, wave: Wave, x: number, y: number): Enemy[] {
		const out = wave.map(([role, dx, dy]) => {
			const ex = Math.max(80, Math.min(W - 80, x + dx));
			const ey = Math.max(220, Math.min(H - 220, y + dy));
			const e = game.spawnEnemy('fearGrunt', ex, ey, role);
			e.brain.grit = GRUNT_TOUGHNESS;
			e.brain.might = GRUNT_MIGHT;
			e.brain.alert = 10;
			e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * GRUNT_TOUGHNESS);
			return e;
		});
		this.all.push(...out);
		return out;
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
		const me = game.players[0];
		if (me.downed && !this.wasDown) {
			this.lives--;
			this.downs++;
			if (this.lives <= 0) this.lose(game);
			else this.comms.say('Kilowog', 'Up, poozer! We finish this together!', true);
		}
		this.wasDown = me.downed;
	}

	private win(game: Game) {
		this.state = 'won';
		this.timer = 0;
		this.mirror = null;
		for (const p of game.players) {
			p.victoryTimer = 0.4;
			p.dread = 0;
		}
		for (const e of game.enemies) {
			e.hp = 0;
			e.down = 1;
		}
		this.comms.scene([
			['Hal', "It's over, Sinestro."],
			['Sinestro', 'Look behind you, Jordan. Is it?'],
			['John', "The lantern. It's still burning."],
			['Kilowog', "Then we come back for it. Let's get him to Oa."]
		]);
	}

	private lose(game: Game) {
		this.state = 'lost';
		this.failReason = 'lantern';
		game.downedNotice = false;
	}

	// -------------------------------------------------------------- drawing

	cameraPoints(): [number, number][] {
		return this.phase === 'lantern' ? [[LANTERN.x, LANTERN.y - 120]] : [];
	}

	/** Breaking the lenses comes first: he can't fall while they stand. */
	get goalFirst(): boolean {
		return this.phase === 'lantern';
	}

	goal(): { x: number; y: number } | null {
		if (this.state !== 'playing') return null;
		const me = this.gameRef?.players[0];
		if (!me) return null;
		if (this.phase === 'citadel') {
			const standing = this.all.filter(isStanding);
			return standing.sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0] ?? null;
		}
		if (this.phase === 'lantern') {
			const left = this.lenses.filter(isStanding);
			return left.sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0] ?? null;
		}
		return this.sinestro;
	}

	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		const list: Drawable[] = [{ baseY: LANTERN.y, draw: () => drawGreatLantern(ctx, LANTERN.x, LANTERN.y, time) }];
		const s = this.sinestro;
		for (const l of this.lenses) {
			const standing = isStanding(l);
			list.push({ baseY: l.y, draw: () => drawLens(ctx, l.x, l.y, standing ? l.hp / l.maxHp : 0, standing, time) });
			if (standing && s && this.phase === 'lantern') list.push({ baseY: -1e6 + 2, draw: () => drawFeed(ctx, l.x, l.y - 150, s.x, s.y - 60, time) });
		}
		if (s && isStanding(s) && this.mirror !== null) {
			const m = this.mirror;
			list.push({ baseY: s.y + 2, draw: () => drawMirror(ctx, s.x, s.y, m, time) });
		}
		return list;
	}
}

// ------------------------------------------------------------- drawing helpers

/** The great yellow lantern: a Power Battery three times a Lantern's height, burning yellow. */
function drawGreatLantern(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(3.2, 3.2);
	ctx.filter = 'hue-rotate(-82deg) saturate(1.6) brightness(1.25)';
	drawBattery(ctx, { x: 0, y: 0, charge: BATTERY_MAX_CHARGE }, true, time);
	ctx.restore();
}

/** A lens on a stone plinth, focusing the lantern's light into Sinestro. */
function drawLens(ctx: CanvasRenderingContext2D, x: number, y: number, health: number, standing: boolean, time: number) {
	ctx.save();
	ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
	ctx.beginPath();
	ctx.ellipse(x, y, 40, 12, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = '#0b0b0d';
	ctx.lineWidth = 5;
	// Plinth
	ctx.fillStyle = '#4a2a3d';
	ctx.fillRect(x - 22, y - 90, 44, 90);
	ctx.strokeRect(x - 22, y - 90, 44, 90);
	if (!standing) {
		ctx.fillStyle = '#6b5a2a';
		for (const [dx, dy, r] of [[-18, -96, 10], [10, -100, 8], [2, -92, 6]]) {
			ctx.beginPath();
			ctx.moveTo(x + dx, y + dy - r);
			ctx.lineTo(x + dx + r, y + dy);
			ctx.lineTo(x + dx - r, y + dy);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
		}
		ctx.restore();
		return;
	}
	// The lens: a yellow crystal, cracking as it takes damage
	const glow = 0.7 + 0.3 * Math.sin(time * 4 + x);
	ctx.fillStyle = `rgba(255, 216, 58, ${glow})`;
	ctx.shadowColor = '#ffd23a';
	ctx.shadowBlur = 22;
	ctx.beginPath();
	ctx.moveTo(x, y - 170);
	ctx.lineTo(x + 26, y - 128);
	ctx.lineTo(x, y - 92);
	ctx.lineTo(x - 26, y - 128);
	ctx.closePath();
	ctx.fill();
	ctx.shadowBlur = 0;
	ctx.stroke();
	if (health < 0.66) {
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(x - 10, y - 150);
		ctx.lineTo(x + 4, y - 128);
		ctx.lineTo(x - 6, y - 108);
		if (health < 0.33) {
			ctx.moveTo(x + 14, y - 140);
			ctx.lineTo(x + 2, y - 120);
		}
		ctx.stroke();
	}
	ctx.restore();
}

/** Light from a lens into Sinestro. */
function drawFeed(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, time: number) {
	ctx.save();
	ctx.strokeStyle = `rgba(255, 216, 58, ${0.45 + 0.25 * Math.sin(time * 9)})`;
	ctx.shadowColor = '#ffd23a';
	ctx.shadowBlur = 16;
	ctx.lineWidth = 6;
	ctx.setLineDash([24, 12]);
	ctx.lineDashOffset = -time * 120;
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);
	ctx.stroke();
	ctx.restore();
}

/** His mirror: a ring of yellow panes round him. Faint and flickering during the tell, solid once it's up. */
function drawMirror(ctx: CanvasRenderingContext2D, x: number, y: number, m: number, time: number) {
	ctx.save();
	const up = m >= 0;
	const k = up ? 1 : 1 + m / MIRROR.tell;
	ctx.globalAlpha = up ? 0.9 : 0.3 + 0.5 * k * (0.5 + 0.5 * Math.sin(time * 30));
	ctx.strokeStyle = '#ffd84a';
	ctx.fillStyle = 'rgba(255, 236, 140, 0.25)';
	ctx.shadowColor = '#ffd23a';
	ctx.shadowBlur = 18;
	ctx.lineWidth = 4;
	const panes = 8;
	for (let i = 0; i < panes; i++) {
		const a = (i / panes) * Math.PI * 2 + time * 0.8;
		const px = x + Math.cos(a) * 70;
		const py = y - 60 + Math.sin(a) * 42;
		ctx.save();
		ctx.translate(px, py);
		ctx.rotate(a + Math.PI / 2);
		ctx.beginPath();
		ctx.rect(-16, -30, 32, 60);
		ctx.fill();
		ctx.stroke();
		ctx.restore();
	}
	ctx.restore();
}
