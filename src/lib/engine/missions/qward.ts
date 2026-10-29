// Season two, Act 2, mission 6: Qward. Hal, with Kilowog.
//
// The exile went somewhere the Guardians can't see: Qward, the anti-matter
// universe, where everything is a shade wrong and will itself runs thin
// (willpower comes back slowly the whole mission). Its smiths, the Weaponers,
// make weapons for anyone who hates the Guardians, and they're making one now.
//
//   approach  across the ash flats toward the forge; Weaponers in the way.
//   forge     four conduits feed the forge. Break them while the Weaponers
//             defend it.
//   collapse  the forge overloads, and what it was making tears free: a yellow
//             ring, finished, flying off to find its bearer. Qward starts to
//             come apart. Get back to the portal before it closes.
//
// Lose: Hal goes down 3 times, or the portal closes with him on the wrong side.

import { damagePlayer } from '../combat';
import { createDummy, isStanding, type Dummy } from '../dummy';
import type { Enemy, Role } from '../enemies/enemies';
import type { Drawable, Game } from '../game';
import { seededRandom, type GameMap, type Obstacle } from '../map';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

export type QwardPhase = 'approach' | 'forge' | 'collapse';

const LIVES = 3;
const INTRO_TIME = 3;
/** Will runs thin in the anti-matter universe: willpower comes back this much slower. */
export const QWARD_REGEN = 0.55;
const TOUGHNESS = 4.5;
const MIGHT = 4;
const CONDUIT_HP = 800;
const REINFORCE_EVERY = 18;
/** Seconds to get back through the portal once Qward starts coming apart. */
export const COLLAPSE_TIME = 32;
const DEBRIS = { every: 1, warning: 1.2, radius: 75, damage: 26 };
const PORTAL_RADIUS = 110;
const WAKE_RANGE = 700;

const W = 3800;
const H = 2000;
export const PORTAL = { x: 330, y: 1000 };
const FORGE = { x: 2950, y: 1000 };
const CONDUITS = [
	{ x: 2650, y: 640 },
	{ x: 3250, y: 640 },
	{ x: 2650, y: 1360 },
	{ x: 3250, y: 1360 }
];
const FLATS = [
	{ x: 1250, y: 900 },
	{ x: 2000, y: 1150 }
];

type Wave = [Role, number, number][];
const FLAT_WAVES: Wave[] = [
	[
		['gunner', 200, -150],
		['berserker', 120, 120],
		['gunner', 280, 200],
		['hunter', -60, -220]
	],
	[
		['berserker', -120, -200],
		['gunner', 220, -100],
		['gunner', 240, 220],
		['hunter', 120, 300],
		['berserker', 0, 140]
	]
];
const FORGE_GUARD: Wave = [
	['gunner', -250, -200],
	['gunner', -250, 200],
	['berserker', -350, 0],
	['hunter', 0, -320],
	['hunter', 0, 320]
];
const REINFORCEMENTS: Wave = [
	['berserker', -200, -250],
	['gunner', 100, 0],
	['hunter', -200, 250]
];

interface Flat {
	x: number;
	y: number;
	woke: boolean;
	wave: Enemy[];
}

interface Debris {
	x: number;
	y: number;
	t: number;
}

/** The ash flats of Qward: the portal on the left, crooked spires, the forge on the right. */
export function buildQwardMap(): GameMap {
	const rand = seededRandom(7171);
	const obstacles: Obstacle[] = [];
	const spires: [number, number, number, number][] = [
		[800, 300, 140, 120],
		[900, 1550, 160, 120],
		[1600, 420, 150, 110],
		[1650, 1500, 140, 130],
		[2300, 300, 160, 110],
		[2350, 1620, 150, 110]
	];
	for (const [x, y, w, h] of spires) obstacles.push({ kind: 'building', x, y, w, h, height: 140 + rand() * 90, blocksFlying: false, seed: rand() });
	return {
		name: 'Qward',
		environment: 'planet',
		ground: 'qward',
		width: W,
		height: H,
		spawn: { x: 520, y: 1000 },
		battery: { x: 560, y: 760 },
		dummies: [],
		obstacles
	};
}

export class QwardMission implements MissionDirector {
	state: MissionState = 'intro';
	phase: QwardPhase = 'approach';
	timer = INTRO_TIME;
	lives = LIVES;
	elapsed = 0;
	downs = 0;
	defeated = 0;
	/** Seconds left before the portal closes. */
	collapseLeft = COLLAPSE_TIME;
	failReason: 'lantern' | 'portal' | null = null;
	readonly comms = new Comms();
	readonly conduits: Dummy[] = [];
	readonly flats: Flat[] = FLATS.map((f) => ({ ...f, woke: false, wave: [] }));
	readonly debris: Debris[] = [];
	readonly starHint = '★ done · ★ Hal never went down · ★ through the portal with 15 seconds to spare';
	/** Where the yellow ring is, flying off to find Sinestro (collapse phase). */
	ring: { x: number; y: number } | null = null;
	private all: Enemy[] = [];
	private forgeWave: Enemy[] = [];
	private counted = new WeakSet<Enemy>();
	private reinforce = REINFORCE_EVERY;
	private debrisTimer = DEBRIS.every;
	private waiting = 0;
	private wasDown = false;
	private said = new Set<string>();
	private rand: () => number;

	constructor(seed = 61) {
		this.rand = seededRandom(seed);
	}

	// ------------------------------------------------------------ reporting

	get conduitsLeft(): number {
		return this.conduits.filter(isStanding).length;
	}

	get objective(): string {
		if (this.phase === 'approach') return 'Cross the ash flats to the forge';
		if (this.phase === 'forge') return `Break the forge's conduits (${CONDUITS.length - this.conduitsLeft} / ${CONDUITS.length})`;
		return 'Back through the portal before it closes!';
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const list: MissionMeter[] = [];
		if (this.phase === 'collapse') {
			const left = Math.ceil(this.collapseLeft);
			list.push({ label: 'Portal', value: this.collapseLeft / COLLAPSE_TIME, text: `0:${String(left).padStart(2, '0')}`, low: this.collapseLeft < 12 });
		}
		this.conduits.forEach((c, i) => {
			if (isStanding(c)) list.push({ label: `Conduit ${i + 1}`, value: c.hp / c.maxHp, text: `${Math.round((c.hp / c.maxHp) * 100)}%` });
		});
		return list;
	}

	warning(): string | null {
		if (this.state !== 'playing') return null;
		if (this.phase === 'collapse' && this.collapseLeft < 12) return 'The portal is closing!';
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.downs === 0 ? 1 : 0) + (this.collapseLeft >= 15 ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'won') return 'Out of Qward with the forge in ruins. But the ring it was making got away, and everyone knows whose hand it is looking for.';
		if (this.failReason === 'portal') return 'The portal closed, and Qward kept them.';
		return 'Hal went down one time too many.';
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		return [
			{ label: 'Weaponers beaten', value: `${this.defeated}` },
			{ label: 'Portal time left', value: this.phase === 'collapse' || this.state === 'won' ? `${Math.max(0, Math.round(this.collapseLeft))}s` : '-' },
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
					// Will runs thin here
					for (const p of game.players) if (!p.hero) p.regenMultiplier *= QWARD_REGEN;
					this.comms.scene([
						['Kilowog', "I hate this place. Everything's backwards. Even the ring feels heavy."],
						['Hal', "That's anti-matter. Willpower runs thin here. Make every shot count."],
						['Hal', 'The trail ends at their forge. Whatever Sinestro came here for, they are making it.']
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
		const hal = game.players[0];

		switch (this.phase) {
			case 'approach':
				for (const [i, f] of this.flats.entries()) {
					if (f.woke) continue;
					const before = i === 0 || (this.flats[i - 1].woke && this.flats[i - 1].wave.every((e) => !isStanding(e)));
					if (!before) continue;
					this.waiting += dt;
					if (Math.hypot(hal.x - f.x, hal.y - f.y) < WAKE_RANGE || (i > 0 && this.waiting > 6)) {
						this.waiting = 0;
						f.woke = true;
						f.wave = this.spawn(game, FLAT_WAVES[i], f.x, f.y);
						this.comms.say(...((i === 0 ? ['Weaponer', 'Lanterns! In Qward! Arm yourselves!'] : ['Kilowog', "More of 'em. Don't these poozers ever run out?"]) as [string, string]));
					}
					break;
				}
				// Both flats clear: the forge's guard comes out to meet them
				if (this.flats.every((f) => f.woke && f.wave.every((e) => !isStanding(e)))) this.startForge(game);
				break;
			case 'forge':
				this.reinforce -= dt;
				if (this.reinforce <= 0) {
					this.reinforce = REINFORCE_EVERY;
					this.forgeWave = [...this.forgeWave.filter(isStanding), ...this.spawn(game, REINFORCEMENTS, FORGE.x, FORGE.y)];
				}
				for (const [i, c] of this.conduits.entries()) {
					if (!isStanding(c) && !this.said.has(`c${i}`)) {
						this.said.add(`c${i}`);
						if (this.conduitsLeft > 0) this.comms.say('Hal', `Conduit's down. ${this.conduitsLeft} to go.`);
					}
				}
				if (this.conduitsLeft === 0) this.startCollapse();
				break;
			case 'collapse':
				this.collapseLeft -= dt;
				this.updateDebris(game, dt);
				if (this.ring) {
					// The ring away to the top right, out of the forge and out of Qward
					this.ring.x += 240 * dt;
					this.ring.y -= 150 * dt;
					if (this.ring.y < -200) this.ring = null;
				}
				if (this.state !== 'playing') return;
				if (!hal.downed && Math.hypot(hal.x - PORTAL.x, hal.y - PORTAL.y) < PORTAL_RADIUS) this.win(game);
				else if (this.collapseLeft <= 0) this.lose(game, 'portal');
				break;
		}
	}

	private startForge(game: Game) {
		if (this.phase !== 'approach') return;
		this.phase = 'forge';
		for (const c of CONDUITS) {
			const d = createDummy(c.x, c.y);
			d.kind = 'forgeConduit';
			d.hp = d.maxHp = CONDUIT_HP;
			d.respawns = false;
			game.dummies.push(d);
			this.conduits.push(d);
		}
		this.forgeWave = this.spawn(game, FORGE_GUARD, FORGE.x, FORGE.y);
		this.comms.scene([
			['Weaponer', 'The Guardians\' dogs, at our forge. You are too late. It is nearly done.'],
			['Kilowog', "Four pylons feeding that thing. Bust 'em and it goes cold."],
			['Hal', 'Then we bust them.']
		]);
	}

	private startCollapse() {
		this.phase = 'collapse';
		this.collapseLeft = COLLAPSE_TIME;
		this.ring = { x: FORGE.x, y: FORGE.y - 120 };
		this.comms.scene([
			['Kilowog', "The forge is blowing! And what's that coming out of it?"],
			['Hal', 'A ring. A yellow ring. And it knows exactly where it\'s going.'],
			['Kilowog', "Qward's coming apart! Back to the portal, Jordan, MOVE!"]
		]);
	}

	/** Qward coming apart: rubble comes down around whoever is still here. */
	private updateDebris(game: Game, dt: number) {
		this.debrisTimer -= dt;
		if (this.debrisTimer <= 0) {
			this.debrisTimer = DEBRIS.every;
			for (const p of game.players) {
				if (p.downed || p.hero) continue;
				this.debris.push({ x: p.x + p.vx * DEBRIS.warning + (this.rand() - 0.5) * 140, y: p.y + p.vy * DEBRIS.warning + (this.rand() - 0.5) * 90, t: 0 });
			}
		}
		for (const d of [...this.debris]) {
			d.t += dt;
			if (d.t < DEBRIS.warning) continue;
			this.debris.splice(this.debris.indexOf(d), 1);
			for (const p of game.players) {
				if (Math.hypot(p.x - d.x, p.y - d.y) > DEBRIS.radius + 20) continue;
				damagePlayer(game.constructs, p, DEBRIS.damage, d.x, d.y, 260);
			}
		}
	}

	private spawn(game: Game, wave: Wave, x: number, y: number): Enemy[] {
		const out = wave.map(([role, dx, dy]) => {
			const e = game.spawnEnemy('weaponer', Math.max(80, Math.min(W - 80, x + dx)), Math.max(120, Math.min(H - 80, y + dy)), role);
			e.brain.grit = TOUGHNESS;
			e.brain.might = MIGHT;
			e.brain.alert = 10;
			e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * TOUGHNESS);
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

	private countDowns(game: Game) {
		const hal = game.players[0];
		if (hal.downed && !this.wasDown) {
			this.lives--;
			this.downs++;
			if (this.lives <= 0) this.lose(game, 'lantern');
			else this.comms.say('Kilowog', 'Jordan! Get up, this place eats the weak!', true);
		}
		this.wasDown = hal.downed;
	}

	private win(game: Game) {
		this.state = 'won';
		this.timer = 0;
		this.debris.length = 0;
		for (const p of game.players) p.victoryTimer = 0.4;
		this.comms.scene([
			['Kilowog', 'We made it. Barely.'],
			['Hal', "We broke their forge. But that ring's out there now, and we both know who it's flying to."]
		]);
	}

	private lose(game: Game, reason: 'lantern' | 'portal') {
		this.state = 'lost';
		this.failReason = reason;
		game.downedNotice = false;
	}

	// -------------------------------------------------------------- drawing

	cameraPoints(): [number, number][] {
		return this.phase === 'forge' ? [[FORGE.x, FORGE.y - 80]] : [];
	}

	goal(): { x: number; y: number } | null {
		if (this.state !== 'playing') return null;
		if (this.phase === 'collapse') return PORTAL;
		if (this.phase === 'forge') {
			const c = this.conduits.find(isStanding);
			return c ?? FORGE;
		}
		const fighting = this.flats.find((f) => f.woke && f.wave.some(isStanding));
		if (fighting) return fighting.wave.find(isStanding)!;
		return this.flats.find((f) => !f.woke) ?? FORGE;
	}

	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		const list: Drawable[] = [];
		list.push({ baseY: PORTAL.y - 10, draw: () => drawPortal(ctx, PORTAL.x, PORTAL.y, this.phase === 'collapse' ? this.collapseLeft / COLLAPSE_TIME : 1, time) });
		const hot = this.phase === 'collapse' ? 0 : this.phase === 'forge' ? this.conduitsLeft / CONDUITS.length : 1;
		list.push({ baseY: FORGE.y + 30, draw: () => drawForge(ctx, FORGE.x, FORGE.y, hot, this.phase === 'collapse', time) });
		for (const c of this.conduits) {
			const standing = isStanding(c);
			list.push({ baseY: c.y, draw: () => drawConduit(ctx, c.x, c.y, FORGE.x, FORGE.y - 90, standing ? c.hp / c.maxHp : 0, standing, time) });
		}
		for (const d of this.debris) list.push({ baseY: d.y, draw: () => drawRubble(ctx, d.x, d.y, d.t / DEBRIS.warning, DEBRIS.radius) });
		const ring = this.ring;
		if (ring) list.push({ baseY: 1e6, draw: () => drawYellowRing(ctx, ring.x, ring.y, time) });
		return list;
	}
}

// ------------------------------------------------------------- drawing helpers

/** The way home: a ring of green light standing on its edge, shrinking as it closes. */
function drawPortal(ctx: CanvasRenderingContext2D, x: number, y: number, open: number, time: number) {
	ctx.save();
	const r = 70 + 40 * open;
	ctx.translate(x, y - 90);
	ctx.shadowColor = '#3dff6e';
	ctx.shadowBlur = 24;
	for (let i = 0; i < 3; i++) {
		ctx.strokeStyle = `rgba(61, 255, 110, ${0.35 + 0.2 * i})`;
		ctx.lineWidth = 6 - i * 1.5;
		ctx.beginPath();
		ctx.ellipse(0, 0, r * 0.55 + i * 6, r + i * 8, Math.sin(time * 2 + i) * 0.1, 0, Math.PI * 2);
		ctx.stroke();
	}
	ctx.fillStyle = `rgba(61, 255, 110, ${0.12 + 0.06 * Math.sin(time * 4)})`;
	ctx.beginPath();
	ctx.ellipse(0, 0, r * 0.55, r, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

/** The Weaponers' forge: a huge anvil over a pit of yellow fire. */
function drawForge(ctx: CanvasRenderingContext2D, x: number, y: number, heat: number, broken: boolean, time: number) {
	ctx.save();
	ctx.strokeStyle = '#0a0a06';
	ctx.lineWidth = 6;
	// The fire pit
	const glow = broken ? 0.15 : 0.35 + 0.45 * heat + 0.1 * Math.sin(time * 6);
	ctx.fillStyle = `rgba(255, 200, 40, ${glow})`;
	ctx.shadowColor = '#ffd23a';
	ctx.shadowBlur = broken ? 0 : 40;
	ctx.beginPath();
	ctx.ellipse(x, y, 170, 60, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.shadowBlur = 0;
	ctx.fillStyle = '#26241c';
	ctx.beginPath();
	ctx.ellipse(x, y, 170, 60, 0, 0, Math.PI * 2);
	ctx.stroke();
	// The anvil
	ctx.fillStyle = broken ? '#3a362c' : '#4a463a';
	ctx.beginPath();
	ctx.moveTo(x - 110, y - 120);
	ctx.lineTo(x + 140, y - 120);
	ctx.lineTo(x + 80, y - 80);
	ctx.lineTo(x + 50, y - 80);
	ctx.lineTo(x + 50, y - 30);
	ctx.lineTo(x - 50, y - 30);
	ctx.lineTo(x - 50, y - 80);
	ctx.lineTo(x - 80, y - 80);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	if (broken) {
		ctx.strokeStyle = '#ffd23a';
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.moveTo(x - 20, y - 120);
		ctx.lineTo(x + 5, y - 90);
		ctx.lineTo(x - 10, y - 60);
		ctx.stroke();
	}
	ctx.restore();
}

/** A conduit: a black pylon pouring yellow light into the forge. */
function drawConduit(ctx: CanvasRenderingContext2D, x: number, y: number, fx: number, fy: number, health: number, standing: boolean, time: number) {
	ctx.save();
	ctx.strokeStyle = '#0a0a06';
	ctx.lineWidth = 5;
	if (standing) {
		ctx.strokeStyle = `rgba(255, 210, 58, ${0.4 + 0.3 * Math.sin(time * 10 + x)})`;
		ctx.lineWidth = 5;
		ctx.shadowColor = '#ffd23a';
		ctx.shadowBlur = 14;
		ctx.beginPath();
		ctx.moveTo(x, y - 180);
		ctx.lineTo(fx, fy);
		ctx.stroke();
		ctx.shadowBlur = 0;
		ctx.strokeStyle = '#0a0a06';
	}
	ctx.fillStyle = standing ? '#2c2a22' : '#1c1b16';
	const h = standing ? 190 : 70;
	ctx.beginPath();
	ctx.moveTo(x - 30, y);
	ctx.lineTo(x - 16, y - h);
	ctx.lineTo(x + 16, y - h);
	ctx.lineTo(x + 30, y);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	if (standing) {
		ctx.fillStyle = `rgba(255, 210, 58, ${0.5 + 0.4 * health})`;
		ctx.beginPath();
		ctx.arc(x, y - h + 10, 12, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.restore();
}

function drawRubble(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number, radius: number) {
	ctx.save();
	ctx.strokeStyle = `rgba(255, 220, 120, ${0.4 + 0.5 * progress})`;
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.ellipse(x, y, radius, radius * 0.45, 0, 0, Math.PI * 2);
	ctx.stroke();
	const h = (1 - progress) * 480;
	ctx.fillStyle = '#3a372c';
	ctx.strokeStyle = '#0a0a06';
	ctx.beginPath();
	ctx.moveTo(x - 28, y - 10 - h);
	ctx.lineTo(x - 8, y - 46 - h);
	ctx.lineTo(x + 26, y - 30 - h);
	ctx.lineTo(x + 18, y - 4 - h);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.restore();
}

/** The new ring, flying off to its bearer: a hard yellow point with a trail. */
function drawYellowRing(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
	ctx.save();
	ctx.shadowColor = '#ffd23a';
	ctx.shadowBlur = 30;
	ctx.strokeStyle = 'rgba(255, 210, 58, 0.35)';
	ctx.lineWidth = 6;
	ctx.beginPath();
	ctx.moveTo(x, y);
	ctx.lineTo(x - 160, y + 100);
	ctx.stroke();
	ctx.strokeStyle = '#ffe57a';
	ctx.lineWidth = 5;
	ctx.beginPath();
	ctx.ellipse(x, y, 12, 9, time * 6, 0, Math.PI * 2);
	ctx.stroke();
	ctx.restore();
}
