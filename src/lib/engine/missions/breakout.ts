// Season two, Act 3, mission 16: Breakout. Hal and Kilowog, on Oa.
//
// Lyssa Drak, keeper of the Book of Parallax, has opened the Sciencells: every
// monster the Corps ever caged is loose in the block. Kill them and you're no
// better than the Sinestro Corps; let them go and the universe burns. So
// they go back, alive.
//
//   Prisoners can't be killed here: beat one far enough down and he's
//   subdued, reeling, for a few seconds, and every hit sends him sliding.
//   Knock him back into any open cell and the door shuts on him. Leave one
//   alone and he makes for the gate out of the block. Lyssa reads from the
//   Book on the gallery and another pair of cells opens, until she's had
//   enough of watching and comes down herself.
//
// Lose: three prisoners get out of the block, or Hal goes down three times.

import { isStanding } from '../dummy';
import { drawEnemy } from '../draw/enemies';
import { drawBlockGate, drawBlockWall, drawBook, drawCell, drawPillar } from '../draw/sciencells';
import { createEnemy, type Enemy, type EnemyKind } from '../enemies/enemies';
import type { Drawable, Game } from '../game';
import type { GameMap, Obstacle } from '../map';
import { boxOverlap } from '../physics';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

export type BreakoutPhase = 'reading' | 'lyssa';

const LIVES = 3;
const INTRO_TIME = 3;
const TOUGHNESS = 2.9;
const MIGHT = 5.2;
const LYSSA = { health: 4.6, might: 6.2 };
/** Lose when this many get out. */
export const ESCAPE_LIMIT = 3;
/** Subdued: below this share of their health; for this long; how they slide, and how fast it dies away. */
export const SUBDUE = { at: 0.35, time: 9, floor: 0.2, pull: 300, pullSpeed: 150, push: 260, perDamage: 4, maxPush: 950, friction: 1.6, recover: 0.45 };
/** A prisoner nobody's fighting heads for the gate; within this of a Lantern, he fights instead. */
const BOLT = { engaged: 480, speed: 110, gate: 110, lock: 7 };
/** Lyssa opens another pair of cells this often while she reads. */
const OPEN_EVERY = 30;
/** She won't open more while this many are loose. */
const MAX_LOOSE = 4;
/** She comes down once this many are back inside. */
const COMES_DOWN = 5;

const W = 3000;
const H = 1900;
const ENTRY = { x: 1500, y: 900 };
export const GATE = { x: 1500, y: 1780 };
const GALLERY = { x: 1500, y: 1560 };
/** The row of cells along the back wall. */
const CELL = { y: 70, w: 200, h: 240, top: 60 };
const CELL_XS = [180, 520, 860, 1200, 1600, 1940, 2280, 2620];
/** Who's in each cell, in order. They're the Corps' old enemies, as themselves. */
const INMATES: EnemyKind[] = ['rageGrunt', 'manhunter', 'weaponer', 'thunderer', 'rageGrunt', 'weaponer', 'thunderer', 'manhunter'];
/** Which cells open when: the first three at once, then pairs. */
const OPENINGS = [[1, 4, 6], [0, 7], [2, 5], [3]];

export interface Cell {
	x: number;
	/** Who's behind the door, if anyone. */
	inmate: EnemyKind | null;
	shut: boolean;
	/** Seconds of flickering before the door gives (Lyssa's reading). */
	opening: number;
	/** Still holding who was in it before the breakout (a cell you've put someone back in stays shut). */
	original: boolean;
}

interface Prisoner {
	e: Enemy;
	subdued: number;
	slideX: number;
	slideY: number;
	/** His health last tick: a drop means he was hit. */
	lastHp: number;
	/** Seconds spent forcing the gate's lock. */
	forcing: number;
}

/** The Sciencells: a long block, the cells along the back wall, the gate at the far end. */
export function buildBreakoutMap(): GameMap {
	const obstacles: Obstacle[] = [];
	// The wall above and between the cells
	obstacles.push({ kind: 'building', x: 0, y: 0, w: W, h: CELL.top, height: 90, blocksFlying: true, seed: 0, hidden: true });
	let x = 0;
	for (const cx of CELL_XS) {
		if (cx - x > 0) obstacles.push({ kind: 'building', x, y: CELL.top, w: cx - x, h: CELL.h + CELL.y - CELL.top, height: 90, blocksFlying: true, seed: 0, hidden: true });
		x = cx + CELL.w;
	}
	obstacles.push({ kind: 'building', x, y: CELL.top, w: W - x, h: CELL.h + CELL.y - CELL.top, height: 90, blocksFlying: true, seed: 0, hidden: true });
	return {
		name: 'Oa · the Sciencells',
		environment: 'planet',
		ground: 'oa',
		width: W,
		height: H,
		spawn: ENTRY,
		battery: { x: 400, y: 1500 },
		dummies: [],
		obstacles
	};
}

export class Breakout implements MissionDirector {
	state: MissionState = 'intro';
	phase: BreakoutPhase = 'reading';
	timer = INTRO_TIME;
	lives = LIVES;
	downs = 0;
	elapsed = 0;
	readonly cells: Cell[] = CELL_XS.map((x, i) => ({ x, inmate: INMATES[i], shut: true, opening: 0, original: true }));
	readonly prisoners: Prisoner[] = [];
	returned = 0;
	escaped = 0;
	lyssa: Enemy | null = null;
	failReason: 'escaped' | 'down' | null = null;
	readonly comms = new Comms();
	readonly starHint = '★ done · ★ nobody got out · ★ Hal never went down';
	private wave = 0;
	private nextOpen = 0;
	private reading = 0;
	private wasDown = false;
	private said = new Set<string>();
	private gameRef: Game | null = null;

	// ------------------------------------------------------------ reporting

	get loose(): number {
		return this.prisoners.length;
	}

	get objective(): string {
		const sub = this.prisoners.filter((p) => p.subdued > 0).length;
		if (sub > 0) return `Knock the subdued back into an open cell (${sub})`;
		if (this.phase === 'lyssa' && this.lyssa && isStanding(this.lyssa)) return `Stop Lyssa Drak. Loose: ${this.loose}`;
		return `Beat the prisoners down and put them back. Loose: ${this.loose} · Out: ${this.escaped} / ${ESCAPE_LIMIT}`;
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const list: MissionMeter[] = [{ label: 'Got out', value: this.escaped / ESCAPE_LIMIT, text: `${this.escaped} / ${ESCAPE_LIMIT}`, low: this.escaped >= ESCAPE_LIMIT - 1 }];
		for (const p of this.prisoners) if (p.subdued > 0) list.push({ label: 'Subdued', value: p.subdued / SUBDUE.time, text: `${Math.ceil(p.subdued)}s` });
		for (const p of this.prisoners) if (p.forcing > 0) list.push({ label: 'Gate lock', value: p.forcing / BOLT.lock, text: `${Math.round((p.forcing / BOLT.lock) * 100)}%`, low: true });
		return list;
	}

	warning(): string | null {
		if (this.state !== 'playing') return null;
		if (this.prisoners.some((p) => p.forcing > 0)) return "One's forcing the gate! Get on him!";
		const near = this.prisoners.some((p) => p.subdued <= 0 && Math.hypot(p.e.x - GATE.x, p.e.y - GATE.y) < 400);
		if (near) return "One's nearly at the gate! Stop him!";
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.escaped === 0 ? 1 : 0) + (this.downs === 0 ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'won') return 'Every cell is shut, every prisoner breathing, and Lyssa Drak has a cell of her own. The Book of Parallax is in the Guardians’ hands.';
		if (this.failReason === 'escaped') return 'Too many got out of the block, and into the universe.';
		return 'Hal went down one time too many, and the block emptied.';
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		return [
			{ label: 'Put back in their cells', value: `${this.returned}` },
			{ label: 'Got out', value: `${this.escaped}` },
			{ label: 'Times down', value: `${this.downs}` },
			{ label: 'Time', value: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
		];
	}

	// ---------------------------------------------------------------- rules

	update(game: Game, dt: number) {
		this.gameRef = game;
		this.comms.update(dt);
		this.reading = Math.max(0, this.reading - dt);
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
			if (this.lives <= 0) return this.lose('down');
		}
		this.wasDown = hal.downed;

		this.openCells(game, dt);
		this.handlePrisoners(game, dt);
		this.handleLyssa();
		if (this.state !== 'playing') return;
		if (this.escaped >= ESCAPE_LIMIT) return this.lose('escaped');
		const allOpened = this.wave >= OPENINGS.length && this.cells.every((c) => c.opening <= 0);
		if (allOpened && this.prisoners.length === 0 && this.lyssa && !isStanding(this.lyssa)) this.win(game);
	}

	private start(game: Game) {
		this.state = 'playing';

		this.nextOpen = 0;
		this.comms.scene([
			['Kilowog', 'Beat ’em down, knock ’em back in a cell. The door shuts on its own.'],
			['Hal', 'Alive. Even the ugly ones.'],
			['Lyssa Drak', 'Chapter one. Let us see who wants out first.']
		]);
	}

	/** Lyssa reads, and a set of doors flickers and gives. */
	private openCells(game: Game, dt: number) {
		for (const c of this.cells) {
			if (c.opening <= 0) continue;
			c.opening -= dt;
			if (c.opening > 0) continue;
			c.opening = 0;
			c.shut = false;
			if (c.inmate) this.release(game, c);
		}
		if (this.phase !== 'reading') return;
		this.nextOpen -= dt;
		// She waits for the block to quieten before she turns the page
		if (this.nextOpen > 0 || (this.wave > 0 && this.prisoners.length > MAX_LOOSE)) return;
		// Every page read: she comes down herself
		if (this.wave >= OPENINGS.length) return this.comesDown(game);
		this.nextOpen = OPEN_EVERY;
		for (const i of OPENINGS[this.wave]) if (this.cells[i].original) this.cells[i].opening = 1.5;
		this.wave++;
		this.reading = 2;
		if (this.wave > 1) this.comms.say('Lyssa Drak', ['Chapter two. The Manhunters were always my favourites.', 'Turn the page.', 'The last of them. Shall I read it to you?'][this.wave - 2] ?? 'Turn the page.', true);
	}

	private release(game: Game, c: Cell) {
		const kind = c.inmate!;
		c.inmate = null;
		c.original = false;
		const e = game.spawnEnemy(kind, c.x + CELL.w / 2, CELL.y + CELL.h - 40, (['berserker', 'hunter', 'gunner'] as const)[this.prisoners.length % 3]);
		e.brain.grit = TOUGHNESS;
		e.brain.might = MIGHT;
		e.brain.alert = 10;
		e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * TOUGHNESS);
		this.prisoners.push({ e, subdued: 0, slideX: 0, slideY: 0, lastHp: e.hp, forcing: 0 });
	}

	/** Beaten down, they reel; hit, they slide; into an open cell, the door shuts; left alone, they run for the gate. */
	private handlePrisoners(game: Game, dt: number) {
		const lanterns = game.players.filter((p) => !p.downed);
		for (const p of [...this.prisoners]) {
			const e = p.e;
			// Never killed: a blow that would finish him leaves him subdued instead
			if (!isStanding(e) && !e.gone) {
				e.down = 0;
				e.hp = Math.max(1, e.hp);
			}
			if (p.subdued <= 0 && e.hp <= e.maxHp * SUBDUE.at) {
				p.subdued = SUBDUE.time;
				p.slideX = p.slideY = 0;
				e.hp = Math.max(e.hp, e.maxHp * SUBDUE.floor);
				p.lastHp = e.hp;
				this.once('subdued', 'Kilowog', "He's reeling! Knock him into a cell before he shakes it off!");
			}
			if (p.subdued > 0) {
				p.subdued -= dt;
				e.stun = Math.max(e.stun, 0.2);
				e.brain.errand = null;
				// Hit while he's reeling: he goes sliding away from whoever hit him (the nearest Lantern), the harder the hit the further
				const took = p.lastHp - e.hp;
				if (took > 0) {
					const by = lanterns.slice().sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y))[0];
					const dx = by ? e.x - by.x : 0;
					const dy = by ? e.y - by.y : 1;
					const d = Math.hypot(dx, dy) || 1;
					const push = Math.min(SUBDUE.maxPush, SUBDUE.push + took * SUBDUE.perDamage);
					p.slideX = (dx / d) * push;
					p.slideY = (dy / d) * push;
				}
				// He can't be finished, only kept down
				e.hp = Math.max(e.hp, e.maxHp * SUBDUE.floor);
				p.lastHp = e.hp;
				e.vx = e.vy = 0;
				// An open cell's door draws in anyone reeling near it
				const into = this.cellFor(e);
				if (into) {
					const dx = into.x - e.x;
					const dy = into.y - e.y;
					const d = Math.hypot(dx, dy);
					if (d < SUBDUE.pull && d > 1) {
						p.slideX += (dx / d) * SUBDUE.pullSpeed * dt * 6;
						p.slideY += (dy / d) * SUBDUE.pullSpeed * dt * 6;
					}
				}
				this.slide(game, p, dt);
				const cell = this.cells.find((c) => !c.shut && !c.inmate && e.x > c.x + 10 && e.x < c.x + CELL.w - 10 && e.y < CELL.y + CELL.h - 10);
				if (cell) {
					this.lockUp(game, cell, p);
					continue;
				}
				if (p.subdued <= 0) {
					// He shakes it off, a little healed
					e.hp = Math.max(e.hp, e.maxHp * SUBDUE.recover);
					e.brain.lastHp = e.hp;
				}
				continue;
			}
			p.lastHp = e.hp;
			// Nobody on him: he makes for the gate
			const engaged = lanterns.some((l) => Math.hypot(l.x - e.x, l.y - e.y) < BOLT.engaged);
			e.brain.errand = engaged ? null : { x: GATE.x, y: GATE.y, speed: BOLT.speed };
			// At the gate he has to force the lock, and anyone coming at him stops that
			if (!engaged && Math.hypot(e.x - GATE.x, e.y - GATE.y) < BOLT.gate) p.forcing += dt;
			else p.forcing = Math.max(0, p.forcing - dt);
			if (p.forcing > 0) this.once('forcing', 'Kilowog', "One's at the gate, workin' the lock!");
			if (p.forcing >= BOLT.lock) {
				e.gone = true;
				this.prisoners.splice(this.prisoners.indexOf(p), 1);
				this.escaped++;
				this.comms.say('Kilowog', this.escaped < ESCAPE_LIMIT ? "One's out of the block! Don't let another through!" : "They're through the gate!", true);
			}
		}
	}

	/** A subdued prisoner sliding across the floor, slowing, and stopped (and turned) by the walls. */
	private slide(game: Game, p: Prisoner, dt: number) {
		const e = p.e;
		const k = Math.exp(-SUBDUE.friction * dt);
		p.slideX *= k;
		p.slideY *= k;
		const nx = e.x + p.slideX * dt;
		const ny = e.y + p.slideY * dt;
		// The cell doorways are open; walls aren't
		const blocked = (x: number, y: number) => game.map.obstacles.some((o) => boxOverlap(x, y, 18, 10, o));
		if (!blocked(nx, ny)) {
			e.x = nx;
			e.y = ny;
		} else if (!blocked(nx, e.y)) {
			e.x = nx;
			p.slideY *= -0.5;
		} else if (!blocked(e.x, ny)) {
			e.y = ny;
			p.slideX *= -0.5;
		} else {
			p.slideX *= -0.5;
			p.slideY *= -0.5;
		}
		e.x = Math.max(40, Math.min(W - 40, e.x));
		e.y = Math.max(CELL.y + 30, Math.min(H - 40, e.y));
		e.prevX = e.x;
		e.prevY = e.y;
	}

	private lockUp(game: Game, cell: Cell, p: Prisoner) {
		cell.inmate = p.e.kind;
		cell.shut = true;
		cell.original = false;
		p.e.gone = true;
		p.e.brain.errand = null;
		this.prisoners.splice(this.prisoners.indexOf(p), 1);
		this.returned++;
		this.comms.say(this.returned % 2 ? 'Hal' : 'Kilowog', ['Back you go.', "That's one more where he belongs.", "In, poozer. And stay in.", 'Door shut. Next!'][this.returned % 4]);
		if (this.returned >= COMES_DOWN && this.phase === 'reading') this.comesDown(game);
	}

	private comesDown(game: Game) {
		this.phase = 'lyssa';
		// Down off the gallery, and into the fight
		const l = game.spawnEnemy('lyssaDrak', GALLERY.x, GALLERY.y);
		l.brain.grit = 1;
		l.brain.might = LYSSA.might;
		l.brain.alert = 10;
		l.hp = l.maxHp = l.brain.lastHp = Math.round(l.maxHp * LYSSA.health);
		this.lyssa = l;
		// Whatever's still shut, she opens as she comes
		for (const c of this.cells) if (c.original && c.opening <= 0) c.opening = 1.5;
		this.wave = OPENINGS.length;
		this.comms.scene([
			['Lyssa Drak', 'You put them back. How very Green Lantern of you. Then I will write the ending myself.'],
			['Hal', "Kilowog, keep the block. She's mine."]
		]);
	}

	/** Beaten, she doesn't get a gate: she gets a cell. */
	private handleLyssa() {
		const l = this.lyssa;
		if (!l || isStanding(l)) return;
		this.once('lyssaDown', 'Kilowog', 'And the librarian goes in a cell too. Somebody bag that book.');
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
			['Kilowog', 'Every cell shut, and every one of ’em still breathin’.'],
			['Hal', 'That was the job. The Sinestro Corps would have killed them.'],
			['Kilowog', "That's the difference, rookie. Don't ever forget it."]
		]);
	}

	private lose(reason: 'escaped' | 'down') {
		if (this.state !== 'playing') return;
		this.state = 'lost';
		this.failReason = reason;
	}

	// -------------------------------------------------------------- drawing

	cameraPoints(): [number, number][] {
		const hal = this.gameRef?.players[0];
		const sub = this.prisoners.find((p) => p.subdued > 0 && hal && Math.hypot(p.e.x - hal.x, p.e.y - hal.y) < 700);
		if (!sub) return [];
		// The subdued one and the nearest open cell, so you can see where to knock him
		const cell = this.cells.filter((c) => !c.shut && !c.inmate).sort((a, b) => Math.abs(a.x + CELL.w / 2 - sub.e.x) - Math.abs(b.x + CELL.w / 2 - sub.e.x))[0];
		return cell ? [[sub.e.x, sub.e.y], [cell.x + CELL.w / 2, CELL.y + CELL.h]] : [[sub.e.x, sub.e.y]];
	}

	goal(): { x: number; y: number } | null {
		if (this.state !== 'playing') return null;
		const running = this.prisoners.filter((p) => p.subdued <= 0).sort((a, b) => Math.hypot(a.e.x - GATE.x, a.e.y - GATE.y) - Math.hypot(b.e.x - GATE.x, b.e.y - GATE.y))[0];
		if (running && Math.hypot(running.e.x - GATE.x, running.e.y - GATE.y) < 600) return running.e;
		const sub = this.prisoners.find((p) => p.subdued > 0);
		if (sub) {
			// Where to hit him from: behind him, on the far side from the cell he should go into
			const cell = this.cellFor(sub.e);
			if (!cell) return sub.e;
			const dx = sub.e.x - cell.x;
			const dy = sub.e.y - cell.y;
			const d = Math.hypot(dx, dy) || 1;
			return { x: Math.max(60, Math.min(W - 60, sub.e.x + (dx / d) * 150)), y: Math.max(CELL.y + CELL.h + 60, Math.min(H - 60, sub.e.y + (dy / d) * 150)) };
		}
		if (this.phase === 'lyssa' && this.lyssa && isStanding(this.lyssa)) return this.lyssa;
		return running?.e ?? null;
	}

	/** One at the gate (or nearly) comes before anything else. */
	get goalFirst(): boolean {
		if (this.state !== 'playing') return false;
		// One at the gate, or one reeling who could be put away right now
		return this.prisoners.some((p) => (p.subdued <= 0 && (p.forcing > 0 || Math.hypot(p.e.x - GATE.x, p.e.y - GATE.y) < 450)) || p.subdued > 2);
	}

	/** The nearest open, empty cell's doorway to a prisoner (the door draws in anyone subdued within reach of it). */
	cellFor(e: Enemy): { x: number; y: number } | null {
		const c = this.cells.filter((k) => !k.shut && !k.inmate).sort((a, b) => Math.hypot(a.x + CELL.w / 2 - e.x, CELL.y + CELL.h - e.y) - Math.hypot(b.x + CELL.w / 2 - e.x, CELL.y + CELL.h - e.y))[0];
		return c ? { x: c.x + CELL.w / 2, y: CELL.y + CELL.h - 60 } : null;
	}

	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		const list: Drawable[] = [{ baseY: -1e6, draw: () => drawBlockWall(ctx, W, CELL.top + 10, time) }];
		for (const c of this.cells) {
			const inmate = c.inmate;
			list.push({
				baseY: CELL.y + CELL.h - 1,
				draw: () => drawCell(ctx, c.x, CELL.y, CELL.w, CELL.h, c.shut, c.opening > 0 ? 1 : 0, inmate ? () => drawInmate(ctx, inmate, c.x + CELL.w / 2, CELL.y + CELL.h - 50, time) : null, time)
			});
		}
		for (const o of this.gameRef?.map.obstacles ?? []) if (o.y >= CELL.top) list.push({ baseY: o.y + o.h, draw: () => drawPillar(ctx, o.x, o.y, o.w, o.h, 90, time) });
		list.push({ baseY: GATE.y - 40, draw: () => drawBlockGate(ctx, GATE.x, GATE.y, time) });
		const l = this.lyssa;
		if (l && isStanding(l)) list.push({ baseY: l.y + 1, draw: () => drawBook(ctx, l.x + l.dir * -34, l.y - 60, l.x, l.y - 50, this.reading > 0 ? 1 : 0, time) });
		// Before she comes down: up on the gallery over the gate, reading, out of reach
		if (this.phase === 'reading') {
			list.push({
				baseY: GALLERY.y + 200,
				draw: () => {
					ctx.save();
					ctx.fillStyle = '#16281f';
					ctx.fillRect(GALLERY.x - 160, GALLERY.y + 10, 320, 22);
					ctx.strokeStyle = '#04100b';
					ctx.lineWidth = 2;
					ctx.strokeRect(GALLERY.x - 160, GALLERY.y + 10, 320, 22);
					const art = (lyssaArt ??= createEnemy('lyssaDrak', GALLERY.x, GALLERY.y));
					art.dir = -1;
					drawEnemy(ctx, art, GALLERY.x, GALLERY.y, false, time, false);
					drawBook(ctx, GALLERY.x + 40, GALLERY.y - 70, GALLERY.x + 10, GALLERY.y - 60, this.reading > 0 ? 1 : 0, time);
					ctx.restore();
				}
			});
		}
		// A ring on the floor under each subdued prisoner, running down as he comes round
		for (const p of this.prisoners) {
			if (p.subdued <= 0) continue;
			list.push({
				baseY: p.e.y - 1,
				draw: () => {
					ctx.save();
					ctx.strokeStyle = 'rgba(120, 255, 160, 0.8)';
					ctx.lineWidth = 3;
					ctx.beginPath();
					ctx.ellipse(p.e.x, p.e.y, 34, 12, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (p.subdued / SUBDUE.time));
					ctx.stroke();
					ctx.fillStyle = 'rgba(232, 255, 236, 0.9)';
					ctx.font = '800 12px system-ui, sans-serif';
					ctx.textAlign = 'center';
					ctx.fillText('SUBDUED', p.e.x, p.e.y + 26);
					// Which way to knock him: a line to the nearest open cell
					const cell = this.cellFor(p.e);
					if (cell) {
						ctx.strokeStyle = 'rgba(120, 255, 160, 0.55)';
						ctx.setLineDash([14, 10]);
						ctx.lineDashOffset = -time * 40;
						ctx.lineWidth = 3;
						ctx.beginPath();
						ctx.moveTo(p.e.x, p.e.y);
						ctx.lineTo(cell.x, cell.y);
						ctx.stroke();
						ctx.setLineDash([]);
					}
					ctx.restore();
				}
			});
		}
		return list;
	}
}

/** Lyssa on the gallery, before she's a fighter: drawn, not in the fight. */
let lyssaArt: Enemy | null = null;

/** Whoever is locked in a cell, standing still behind the door. */
const inmates = new Map<EnemyKind, Enemy>();
function drawInmate(ctx: CanvasRenderingContext2D, kind: EnemyKind, x: number, y: number, time: number) {
	let e = inmates.get(kind);
	if (!e) {
		e = createEnemy(kind, x, y, 'gunner', () => 0.5);
		inmates.set(kind, e);
	}
	e.x = x;
	e.y = y;
	ctx.save();
	ctx.globalAlpha *= 0.85;
	drawEnemy(ctx, e, x, y, true, time, false);
	ctx.restore();
}
