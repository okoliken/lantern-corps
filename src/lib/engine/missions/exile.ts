// Season two, Act 1, mission 6: The Exile. Hal and Kilowog.
//
// The Guardians took Sinestro's ring and sentenced him to Qward, the
// anti-matter universe. Hal tows his cell across a dead moon to the old gate
// the Guardians built and sealed. The Weaponers of Qward want him too.
//
//   tow   Close to the cell, Hal's ring latches on and tows it (slowly: he's
//         hauling a cell). Building a construct takes all his will and the
//         tether lets go; ring shots don't. Walk back to it to pick it up.
//         Along the way, tears open and Weaponers step out. Leave the cell
//         and one of them chains it and hauls it toward his tear: if he gets
//         it there, they have Sinestro. Come close (Hal or Kilowog) and he
//         lets go.
//   gate  At the gate, the Guardians open it from Oa. Keep the cell by it
//         while it powers up; more Weaponers come for him. Then Sinestro goes
//         through on his own.
//
// Lose: the Weaponers drag Sinestro into Qward, or Hal goes down three times.

import { isStanding } from '../dummy';
import { drawExileCell, drawHaulChain, drawQwardGate, drawQwardTear, drawTether } from '../draw/exile';
import type { Enemy, Role } from '../enemies/enemies';
import type { Drawable, Game } from '../game';
import { seededRandom, type GameMap, type Obstacle } from '../map';
import { boxOverlap } from '../physics';
import type { Player } from '../player';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

export type ExilePhase = 'tow' | 'gate' | 'through';

const LIVES = 3;
const INTRO_TIME = 3;
const TOUGHNESS = 4.2;
const MIGHT = 4.6;
/** The tether: how close Hal has to be to latch on, how long it is, and how much it slows him. */
export const TETHER = { grab: 110, length: 120, burden: 0.62 };
/** A cell nobody's with: Weaponers come for it once Hal is this far away. */
const UNTENDED = 280;
/** A Weaponer chains it from this close, hauls it at this speed, and lets go when a Lantern comes this close. */
const HAUL = { reach: 60, speed: 75, chain: 70, scare: 170, look: 650 };
/** A hauled cell this close to an open tear is being pulled through it, and it's gone after this long there. */
const TAKEN = { near: 90, time: 3.5 };
/** The gate: how close the cell has to be, and how long it takes to open. */
const GATE_ZONE = 340;
const GATE_TIME = 32;
/** More of them come out of the gate tears this often while it opens. */
const GATE_REINFORCE = 9;

const W = 4600;
const H = 1600;
const START = { x: 320, y: 800 };
export const GATE = { x: 4220, y: 820 };
/** Ambushes: when Hal passes `at` (x), a tear opens at `tear` and its Weaponers step out. */
const AMBUSHES: { at: number; tear: { x: number; y: number }; wave: Wave }[] = [
	{ at: 900, tear: { x: 1650, y: 330 }, wave: [['gunner', 0, 60], ['hunter', -90, 90], ['berserker', 80, 110]] },
	{ at: 1850, tear: { x: 2650, y: 1330 }, wave: [['gunner', 0, -60], ['berserker', -100, -90], ['berserker', 90, -100], ['hunter', 0, -150]] },
	{ at: 2850, tear: { x: 3450, y: 300 }, wave: [['hunter', 0, 60], ['gunner', -110, 90], ['berserker', 100, 110], ['gunner', 40, 160]] }
];
const GATE_TEARS = [
	{ x: 3650, y: 220 },
	{ x: 3680, y: 1420 }
];
const GATE_WAVE: Wave = [
	['berserker', 0, 60],
	['hunter', -80, 90],
	['gunner', 90, 80]
];
type Wave = [Role, number, number][];

interface Tear {
	x: number;
	y: number;
	open: number;
	closing: boolean;
	crew: Enemy[];
}

/** A dead moon at the edge of the sector: grey rock, outcrops, a way across, and the gate at the far end. */
export function buildExileMap(): GameMap {
	const rand = seededRandom(1417);
	const obstacles: Obstacle[] = [];
	for (let i = 0; i < 26; i++) {
		const x = 500 + rand() * (W - 1000);
		const side = rand() < 0.5;
		// Outcrops near the top and bottom, the middle left open for the cell
		const y = side ? 120 + rand() * 360 : H - 480 + rand() * 360;
		const w = 90 + rand() * 120;
		const h = 60 + rand() * 70;
		const o: Obstacle = { kind: 'rock', x, y, w, h, height: 50 + rand() * 50, blocksFlying: false, seed: rand() };
		if ([...AMBUSHES.map((a) => a.tear), ...GATE_TEARS, GATE].some((p) => Math.hypot(p.x - (x + w / 2), p.y - (y + h / 2)) < 260)) continue;
		obstacles.push(o);
	}
	// The gate's plinth is solid
	obstacles.push({ kind: 'building', x: GATE.x - 130, y: GATE.y - 40, w: 260, h: 50, height: 30, blocksFlying: false, seed: 0, hidden: true });
	return {
		name: 'The gate moon',
		environment: 'planet',
		ground: 'vault',
		width: W,
		height: H,
		spawn: START,
		battery: { x: 700, y: 520 },
		dummies: [],
		obstacles
	};
}

export class Exile implements MissionDirector {
	state: MissionState = 'intro';
	phase: ExilePhase = 'tow';
	timer = INTRO_TIME;
	lives = LIVES;
	downs = 0;
	elapsed = 0;
	/** The cell, and who has it: Hal (towing), a Weaponer (hauling), or nobody. */
	readonly cell = { x: START.x + 80, y: START.y, vx: 0, vy: 0, dir: -1 as 1 | -1 };
	towing = false;
	hauler: Enemy | null = null;
	/** Times they got a chain on him. */
	hauls = 0;
	/** 0..1: how far through a tear they've pulled the cell. */
	pulled = 0;
	/** 0..1 as the gate opens. */
	gate = 0;
	failReason: 'taken' | 'down' | null = null;
	readonly comms = new Comms();
	readonly starHint = '★ done · ★ they never got a chain on him · ★ Hal never went down';
	readonly tears: Tear[] = [];
	private sprung = new Set<number>();
	private gateReinforce = 0;
	private through = 0;
	private wasDown = false;
	private said = new Set<string>();
	private gameRef: Game | null = null;

	// ------------------------------------------------------------ reporting

	get objective(): string {
		if (this.phase === 'gate') return `Keep Sinestro at the gate while it opens (${Math.round(this.gate * 100)}%)`;
		if (this.phase === 'through') return 'The gate is open';
		if (this.hauler) return "Get to the cell! They're hauling Sinestro away";
		if (!this.towing) return 'Get back to the cell and tow it';
		return 'Tow Sinestro to the gate';
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const list: MissionMeter[] = [{ label: 'To the gate', value: Math.min(1, Math.max(0, (this.cell.x - START.x) / (GATE.x - START.x))), text: this.towing ? 'In tow' : this.hauler ? 'TAKEN' : 'Left', marker: '▶', low: !!this.hauler }];
		if (this.phase === 'gate') list.push({ label: 'Gate', value: this.gate, text: `${Math.round(this.gate * 100)}%` });
		if (this.pulled > 0) list.push({ label: 'Pulled through', value: this.pulled, text: `${Math.round(this.pulled * 100)}%`, low: true });
		return list;
	}

	warning(): string | null {
		if (this.state !== 'playing') return null;
		if (this.hauler) return "They've chained the cell! Get to Sinestro!";
		if (this.phase === 'gate' && Math.hypot(this.cell.x - GATE.x, this.cell.y - GATE.y) > GATE_ZONE) return 'Bring the cell back to the gate!';
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.hauls === 0 ? 1 : 0) + (this.downs === 0 ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'won') return 'Sinestro walked into Qward on his own, and he smiled the whole way. The gate is sealed behind him.';
		if (this.failReason === 'taken') return 'The Weaponers dragged Sinestro into Qward, on their terms instead of the Guardians.';
		return 'Hal went down one time too many, and the Weaponers took the cell.';
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		return [
			{ label: 'Times they chained the cell', value: `${this.hauls}` },
			{ label: 'Times down', value: `${this.downs}` },
			{ label: 'Time', value: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
		];
	}

	// ---------------------------------------------------------------- rules

	update(game: Game, dt: number) {
		this.gameRef = game;
		this.comms.update(dt);
		for (const t of this.tears) t.open = t.closing ? Math.max(0, t.open - dt) : Math.min(1, t.open + dt * 1.5);
		switch (this.state) {
			case 'intro':
				this.timer -= dt;
				if (this.timer <= 0) this.start(game);
				return;
			case 'won':
				this.timer += dt;
				return;
			case 'lost':
				return;
		}
		this.elapsed += dt;
		const hal = game.players[0];
		if (hal.downed && !this.wasDown) {
			this.lives--;
			this.downs++;
			if (this.lives <= 0) return this.lose(game, 'down');
		}
		this.wasDown = hal.downed;

		this.tow(game, hal, dt);
		this.haul(game, hal, dt);
		this.closeEmptyTears();
		if (this.state !== 'playing') return;

		if (this.phase === 'tow') {
			for (const [i, a] of AMBUSHES.entries()) {
				if (this.sprung.has(i) || hal.x < a.at) continue;
				this.sprung.add(i);
				this.openTear(game, a.tear, a.wave);
				this.comms.say(...AMBUSH_LINES[i], true);
			}
			if (Math.hypot(this.cell.x - GATE.x, this.cell.y - GATE.y) < GATE_ZONE && !this.hauler) this.startGate();
		} else if (this.phase === 'gate') this.openGate(game, dt);
		else if (this.phase === 'through') this.goThrough(game, dt);
	}

	private start(game: Game) {
		this.state = 'playing';
		// The cell beside Hal, his ring already on it
		const hal = game.players[0];
		this.cell.x = hal.x + 90;
		this.cell.y = hal.y;
		this.comms.scene([
			['Kilowog', "Cell's yours, Hal. The Guardians want you to deliver him. Personally."],
			['Sinestro', 'Such ceremony. Tow carefully, Jordan. I bruise.'],
			['Kilowog', 'Stay close to it and your ring holds the tether. Build anything and it lets go.']
		]);
	}

	/** Close enough: Hal's ring latches on and tows. A construct takes all his will, and it lets go. */
	private tow(game: Game, hal: Player, dt: number) {
		const d = Math.hypot(hal.x - this.cell.x, hal.y - this.cell.y);
		const busy = hal.actionTimer > 0 || hal.firing || hal.downed || hal.exhausted;
		if (this.towing && busy) {
			this.towing = false;
			this.once('drop', 'Sinestro', 'Dropped me already? You never could do two things at once.');
		} else if (!this.towing && !busy && !this.hauler && d < TETHER.grab && this.phase !== 'through') this.towing = true;
		hal.burden = this.towing ? TETHER.burden : 1;
		if (!this.towing) {
			this.cell.vx = this.cell.vy = 0;
			return;
		}
		this.follow(game, hal.x, hal.y, TETHER.length, dt);
	}

	/** The cell trails whoever has it, at the end of its line. */
	private follow(game: Game, x: number, y: number, length: number, dt: number) {
		const c = this.cell;
		const dx = x - c.x;
		const dy = y - c.y;
		const d = Math.hypot(dx, dy) || 1;
		const pull = Math.max(0, d - length);
		c.vx = (dx / d) * pull * 8;
		c.vy = (dy / d) * pull * 8;
		if (Math.abs(dx) > 10) c.dir = dx > 0 ? 1 : -1;
		const blocked = (bx: number, by: number) => game.map.obstacles.some((o) => boxOverlap(bx, by, 40, 16, o));
		const nx = c.x + c.vx * dt;
		const ny = c.y + c.vy * dt;
		if (!blocked(nx, ny)) {
			c.x = nx;
			c.y = ny;
		} else if (!blocked(nx, c.y)) c.x = nx;
		else if (!blocked(c.x, ny)) c.y = ny;
		c.x = Math.max(60, Math.min(W - 60, c.x));
		c.y = Math.max(120, Math.min(H - 60, c.y));
	}

	/**
	 * Left on its own, the cell is fair game: the nearest Weaponer chains it
	 * and hauls it for his tear. A Lantern coming close makes him let go.
	 */
	private haul(game: Game, hal: Player, dt: number) {
		const lanterns = game.players.filter((p) => !p.downed);
		const guarded = lanterns.some((p) => Math.hypot(p.x - this.cell.x, p.y - this.cell.y) < HAUL.scare);
		const h = this.hauler;
		if (!h) this.pulled = Math.max(0, this.pulled - dt / TAKEN.time);
		if (h && (!isStanding(h) || h.stun > 0 || guarded)) {
			h.brain.errand = null;
			this.hauler = null;
			if (guarded) this.comms.say('Kilowog', "Hands off, poozer! He's ours to lose!");
		}
		// Nobody but the one hauling it (or walking over to) has anything but the fight on their mind
		for (const e of game.enemies) if (e.kind === 'weaponer' && e !== this.hauler && this.phase !== 'through') e.brain.errand = null;
		if (this.towing || this.phase === 'through') return;
		if (!this.hauler) {
			const far = Math.hypot(hal.x - this.cell.x, hal.y - this.cell.y) > UNTENDED;
			if (!far || guarded) return;
			const open = this.tears.filter((t) => !t.closing);
			if (open.length === 0) return;
			const near = game.enemies
				.filter((e) => e.kind === 'weaponer' && isStanding(e) && Math.hypot(e.x - this.cell.x, e.y - this.cell.y) < HAUL.look)
				.sort((a, b) => Math.hypot(a.x - this.cell.x, a.y - this.cell.y) - Math.hypot(b.x - this.cell.x, b.y - this.cell.y))[0];
			if (!near) return;
			// Walking over to it first
			if (Math.hypot(near.x - this.cell.x, near.y - this.cell.y) > HAUL.reach) {
				near.brain.errand = { x: this.cell.x, y: this.cell.y, speed: 150 };
				return;
			}
			this.hauler = near;
			this.hauls++;
			this.once('haul', 'Sinestro', 'Ah. My new friends. Do hurry, Jordan, they seem keen.');
		}
		const w = this.hauler;
		const tear = this.tears.filter((t) => !t.closing).sort((a, b) => Math.hypot(a.x - w.x, a.y - w.y) - Math.hypot(b.x - w.x, b.y - w.y))[0];
		if (!tear) {
			w.brain.errand = null;
			this.hauler = null;
			return;
		}
		w.brain.errand = { x: tear.x, y: tear.y, speed: HAUL.speed };
		this.follow(game, w.x, w.y, HAUL.chain, dt);
		if (Math.hypot(this.cell.x - tear.x, this.cell.y - tear.y) < TAKEN.near) {
			this.pulled = Math.min(1, this.pulled + dt / TAKEN.time);
			this.once('pulling', 'Kilowog', "They're pullin' him through! HAL!");
			if (this.pulled >= 1) this.lose(game, 'taken');
		}
	}

	private openTear(game: Game, at: { x: number; y: number }, wave: Wave) {
		const crew = wave.map(([role, dx, dy]) => {
			const e = game.spawnEnemy('weaponer', Math.max(80, Math.min(W - 80, at.x + dx)), Math.max(140, Math.min(H - 80, at.y + dy)), role);
			e.brain.grit = TOUGHNESS;
			e.brain.might = MIGHT;
			e.brain.alert = 10;
			e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * TOUGHNESS);
			return e;
		});
		const existing = this.tears.find((t) => t.x === at.x && t.y === at.y);
		if (existing) {
			existing.crew.push(...crew);
			existing.closing = false;
		} else this.tears.push({ x: at.x, y: at.y, open: 0, closing: false, crew });
	}

	/** A tear stays open while any of its Weaponers stand (it's their way home). */
	private closeEmptyTears() {
		for (const t of this.tears) if (!t.closing && t.crew.every((e) => !isStanding(e)) && this.phase !== 'gate') t.closing = true;
	}

	private startGate() {
		this.phase = 'gate';
		this.gateReinforce = 2;
		this.comms.scene([
			['Guardians', 'We see you, Lanterns. The gate will open. Hold him there.'],
			['Sinestro', 'They need a whole minute to open a door. And they call me the dangerous one.'],
			['Kilowog', "Here they come, out of the walls! Keep 'em off the cell!"]
		]);
	}

	private openGate(game: Game, dt: number) {
		const there = Math.hypot(this.cell.x - GATE.x, this.cell.y - GATE.y) < GATE_ZONE;
		if (there && !this.hauler) this.gate = Math.min(1, this.gate + dt / GATE_TIME);
		this.gateReinforce -= dt;
		if (this.gateReinforce <= 0) {
			this.gateReinforce = GATE_REINFORCE;
			const standing = game.enemies.filter((e) => e.kind === 'weaponer' && isStanding(e)).length;
			if (standing < 8) this.openTear(game, GATE_TEARS[Math.floor(this.elapsed) % GATE_TEARS.length], GATE_WAVE);
		}
		if (this.gate > 0.5) this.once('half', 'Sinestro', 'Do you know what they forge in Qward, Jordan? You will.');
		if (this.gate >= 1) {
			this.phase = 'through';
			this.towing = false;
			game.players[0].burden = 1;
			if (this.hauler) this.hauler.brain.errand = null;
			this.hauler = null;
			for (const t of this.tears) t.closing = true;
			// The ones still here go back the way they came
			for (const e of game.enemies) if (e.kind === 'weaponer' && isStanding(e)) e.brain.errand = { x: GATE.x, y: GATE.y - 40, speed: 160 };
			this.comms.scene([
				['Sinestro', 'Open the cell, Jordan. I will walk.'],
				['Hal', '...You want to go in there.'],
				['Sinestro', "I have always wanted to go where the Guardians can't see. Thank you for the escort."]
			]);
		}
	}

	/** The cell opens and Sinestro walks into the gate, and so do the Weaponers. */
	private goThrough(game: Game, dt: number) {
		this.through += dt;
		const c = this.cell;
		if (this.through > 2.5) {
			const dx = GATE.x - c.x;
			const dy = GATE.y - 30 - c.y;
			const d = Math.hypot(dx, dy) || 1;
			c.x += (dx / d) * Math.min(d, 90 * dt);
			c.y += (dy / d) * Math.min(d, 90 * dt);
		}
		for (const e of game.enemies) {
			if (e.kind !== 'weaponer' || !isStanding(e) || Math.hypot(e.x - GATE.x, e.y - GATE.y) > 70) continue;
			e.gone = true;
		}
		if (this.through > 9) this.win(game);
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
			['Kilowog', "He went in smilin', Hal. Nobody goes into exile smilin'."],
			['Hal', 'Then we find out why.']
		]);
	}

	private lose(game: Game, reason: 'taken' | 'down') {
		if (this.state !== 'playing') return;
		this.state = 'lost';
		this.failReason = reason;
		game.players[0].burden = 1;
	}

	// -------------------------------------------------------------- drawing

	/** Sinestro walking into the gate: how far in (0 before, 1 gone). */
	private get gone(): number {
		return this.phase === 'through' ? Math.min(1, Math.max(0, (this.through - 2.5) / 5)) : 0;
	}

	cameraPoints(): [number, number][] {
		const pts: [number, number][] = [[this.cell.x, this.cell.y - 40]];
		if (this.hauler) pts.push([this.hauler.x, this.hauler.y]);
		if (this.phase !== 'tow') pts.push([GATE.x, GATE.y - 200]);
		return pts;
	}

	/** The cell in someone else's hands, or left behind: that comes before the fight. */
	get goalFirst(): boolean {
		return this.state === 'playing' && (!!this.hauler || (!this.towing && this.phase === 'tow'));
	}

	goal(): { x: number; y: number } | null {
		if (this.state !== 'playing') return null;
		if (this.towing && this.phase === 'tow') return GATE;
		return this.cell;
	}

	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		const list: Drawable[] = [];
		const open = this.phase === 'through' ? 1 : this.gate > 0.97 ? 1 : 0;
		list.push({ baseY: GATE.y, draw: () => drawQwardGate(ctx, GATE.x, GATE.y, this.gate, open * Math.min(1, this.through / 1.5 + (this.phase === 'through' ? 0.2 : 0)), time) });
		for (const t of this.tears) list.push({ baseY: t.y, draw: () => drawQwardTear(ctx, t.x, t.y, t.open, time) });
		const c = this.cell;
		const fade = 1 - this.gone;
		if (fade > 0) {
			list.push({
				baseY: c.y,
				draw: () => {
					ctx.save();
					ctx.globalAlpha = fade;
					drawExileCell(ctx, c.x, c.y, c.dir, this.towing, !!this.hauler, time);
					ctx.restore();
				}
			});
		}
		const hal = this.gameRef?.players[0];
		if (hal && this.towing) {
			const rx = hal.x + hal.ringDX;
			const ry = hal.y - hal.ringLift;
			list.push({ baseY: Math.max(hal.y, c.y) + 1, draw: () => drawTether(ctx, rx, ry, c.x, c.y - 70, time) });
		}
		const h = this.hauler;
		if (h) list.push({ baseY: Math.max(h.y, c.y) + 1, draw: () => drawHaulChain(ctx, h.x + h.dir * 14, h.y - 50, c.x, c.y - 50) });
		return list;
	}
}

/** What's said as each ambush springs. */
const AMBUSH_LINES: [string, string][] = [
	['Kilowog', "Somethin's tearin' through the air up there! Weaponers!"],
	['Sinestro', 'They seem to want me rather badly. Flattering.'],
	['Hal', "Another one! Kilowog, keep them off the cell, I've got my hands full."]
];
