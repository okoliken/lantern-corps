// Season two, Act 3, mission 15: Taken. John, with the Flash.
//
// A Sinestro Corps ship hangs over Central City, and its crew are taking
// people off the streets: only the frightened ones. They're fuel.
//
//   Carriers come down from the ship, each for someone cowering in the
//   street, wrap them in a yellow bubble and fly them up to it. Hurt a
//   carrier enough (or stun him) and he lets go; the person drops, dazed,
//   and the Flash runs them home, faster than anyone can follow. Others of
//   the Corps fight to keep John off the carriers. Every one who reaches the
//   ship is taken.
//
// Lose: four people taken, or John goes down three times.

import { isStanding } from '../dummy';
import { colonist, drawColonist } from '../draw/colony';
import type { Figure } from '../draw/lantern';
import type { Enemy, Role } from '../enemies/enemies';
import type { Drawable, Game } from '../game';
import type { GameMap } from '../map';
import { boxOverlap } from '../physics';
import { buildCityMap } from './callToArms';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

const LIVES = 3;
const INTRO_TIME = 3;
const TOUGHNESS = 3.2;
const MIGHT = 5.8;
/** Lose when this many are taken. */
export const TAKEN_LIMIT = 4;
/** A carrier: how close he grabs from, how fast he climbs to the ship, and the hurt that makes him let go. */
export const CARRY = { grab: 44, speed: 105, drop: 0.27, reach: 90, lift: 2 };
/** Carriers come down this often, a pair at a time, at most this many at once; escorts top up to this. */
const CARRIERS = { every: 18, active: 3, escorts: 4 };
/** The Flash: home is here, and he grabs someone from this close. */
const FLASH = { grab: 80 };

const W = 3600;
const H = 2100;
const ENTRY = { x: 900, y: 1100 };
/** The ship, hanging over the middle of town, and where its beam comes down. */
export const SHIP = { x: 1900, y: 820 };
/** Where the Flash runs them: police lines by the park. */
export const HOME = { x: 380, y: 1100 };
/** Where people are cowering, out in the streets. */
const PEOPLE = [
	{ x: 1250, y: 560 },
	{ x: 2600, y: 600 },
	{ x: 3150, y: 1100 },
	{ x: 2750, y: 1560 },
	{ x: 1900, y: 1600 },
	{ x: 1050, y: 1520 },
	{ x: 700, y: 760 },
	{ x: 2300, y: 1150 },
	{ x: 3300, y: 1650 },
	{ x: 1500, y: 1180 },
	{ x: 400, y: 1700 },
	{ x: 3000, y: 450 }
];

export interface Person {
	x: number;
	y: number;
	state: 'waiting' | 'grabbed' | 'dropped' | 'running' | 'home' | 'taken';
	carrier: Enemy | null;
	/** The carrier's health when he grabbed them (he lets go once he's lost enough of it). */
	grabbedAt: number;
	/** Seconds being lifted up the beam into the ship: still stoppable until it's done. */
	lifting: number;
	look: Figure;
	dazed: number;
}

/** Central City at night, the streets emptied, a ship over the middle of town. */
export function buildTakenMap(): GameMap {
	return buildCityMap({ name: 'Central City, night', ground: 'nightStreet', seed: 1961, width: W, height: H, spawn: ENTRY, clear: SHIP });
}

export class Taken implements MissionDirector {
	state: MissionState = 'intro';
	timer = INTRO_TIME;
	lives = LIVES;
	downs = 0;
	elapsed = 0;
	readonly people: Person[] = PEOPLE.map((p, i) => ({ ...p, state: 'waiting' as const, carrier: null, grabbedAt: 0, lifting: 0, look: colonist(300 + i * 3), dazed: 0 }));
	failReason: 'taken' | 'down' | null = null;
	/** Times a carrier was made to let go. */
	saves = 0;
	readonly comms = new Comms();
	readonly starHint = '★ done · ★ nobody taken · ★ John never went down';
	private carriers = new Set<Enemy>();
	private escorts: Enemy[] = [];
	private nextDrop = 2;
	private wasDown = false;
	private said = new Set<string>();
	private gameRef: Game | null = null;

	// ------------------------------------------------------------ reporting

	get taken(): number {
		return this.people.filter((p) => p.state === 'taken').length;
	}

	get home(): number {
		return this.people.filter((p) => p.state === 'home').length;
	}

	get objective(): string {
		const held = this.people.filter((p) => p.state === 'grabbed').length;
		if (held > 0) return `Stop the carrier${held > 1 ? 's' : ''} before ${held > 1 ? 'they reach' : 'he reaches'} the ship (${held})`;
		return `Stop the carriers. Home: ${this.home} · Taken: ${this.taken} / ${TAKEN_LIMIT}`;
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const list: MissionMeter[] = [{ label: 'Taken', value: this.taken / TAKEN_LIMIT, text: `${this.taken} / ${TAKEN_LIMIT}`, low: this.taken >= TAKEN_LIMIT - 1 }];
		for (const p of this.people) {
			if (p.state !== 'grabbed' || !p.carrier) continue;
			const d = Math.hypot(p.carrier.x - SHIP.x, p.carrier.y - SHIP.y);
			list.push({ label: 'To the ship', value: Math.max(0, 1 - d / 1400), text: `${Math.round(d / 10)}m`, low: d < 400 });
		}
		return list;
	}

	warning(): string | null {
		if (this.state !== 'playing') return null;
		const close = this.people.some((p) => p.state === 'grabbed' && p.carrier && Math.hypot(p.carrier.x - SHIP.x, p.carrier.y - SHIP.y) < 450);
		if (close) return "He's nearly at the ship! Hit him!";
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.taken === 0 ? 1 : 0) + (this.downs === 0 ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'won') return this.taken === 0 ? 'The ship went up empty. Everyone it came for is home.' : `The ship went up with ${this.taken} aboard. Everyone else is home, and the Corps knows where it's going.`;
		if (this.failReason === 'taken') return 'The ship filled up and climbed away with them.';
		return 'John went down one time too many, and the carriers took who they liked.';
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		return [
			{ label: 'Run home by the Flash', value: `${this.home}` },
			{ label: 'Carriers made to let go', value: `${this.saves}` },
			{ label: 'Taken', value: `${this.taken}` },
			{ label: 'Time', value: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
		];
	}

	// ---------------------------------------------------------------- rules

	update(game: Game, dt: number) {
		this.gameRef = game;
		this.comms.update(dt);
		for (const p of this.people) p.dazed = Math.max(0, p.dazed - dt);
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
		const john = game.players[0];
		if (john.downed && !this.wasDown) {
			this.lives--;
			this.downs++;
			if (this.lives <= 0) return this.lose('down');
		}
		this.wasDown = john.downed;

		this.sendCarriers(game, dt);
		this.carry(game, dt);
		this.runHome(game);
		if (this.state !== 'playing') return;

		if (this.taken >= TAKEN_LIMIT) return this.lose('taken');
		const settled = this.people.every((p) => p.state === 'home' || p.state === 'taken');
		if (settled) this.win(game);
	}

	private start(game: Game) {
		this.state = 'playing';
		this.spawnEscorts(game, CARRIERS.escorts);
		this.comms.scene([
			['Flash', "I'll take anyone they drop. You make them drop 'em."],
			['John', 'Copy. Ring, mark every carrier.'],
			['Ring', 'Marked. Each of them is carrying fear back to Korugar.']
		]);
	}

	private spawnEscorts(game: Game, n: number) {
		const roles: Role[] = ['gunner', 'hunter', 'berserker', 'hunter'];
		for (let i = 0; i < n; i++) {
			const a = (i / n) * Math.PI * 2;
			const e = this.spawn(game, roles[i % roles.length], SHIP.x + Math.cos(a) * 260, SHIP.y + Math.sin(a) * 180);
			this.escorts.push(e);
		}
	}

	private spawn(game: Game, role: Role, x: number, y: number): Enemy {
		const e = game.spawnEnemy('fearGrunt', Math.max(80, Math.min(W - 80, x)), Math.max(120, Math.min(H - 120, y)), role);
		e.brain.grit = TOUGHNESS;
		e.brain.might = MIGHT;
		e.brain.alert = 10;
		e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * TOUGHNESS);
		return e;
	}

	/** A pair comes down from the ship every so often, each for someone still out there. */
	private sendCarriers(game: Game, dt: number) {
		for (const c of [...this.carriers]) if (!isStanding(c)) this.carriers.delete(c);
		this.escorts = this.escorts.filter(isStanding);
		this.nextDrop -= dt;
		const waiting = this.people.filter((p) => p.state === 'waiting' && !this.claimed(p));
		if (this.nextDrop > 0 || waiting.length === 0) return;
		this.nextDrop = CARRIERS.every;
		for (let i = 0; i < 2 && this.carriers.size < CARRIERS.active; i++) {
			const c = this.spawn(game, 'hunter', SHIP.x + (i ? 120 : -120), SHIP.y + 60);
			this.carriers.add(c);
		}
		if (this.escorts.length < CARRIERS.escorts - 1) this.spawnEscorts(game, 2);
		if (this.carriers.size > 0) this.once(`carriers${Math.floor(this.elapsed / 60)}`, 'Ring', 'More carriers coming down from the ship.');
	}

	private claimed(p: Person): boolean {
		return [...this.carriers].some((c) => c.brain.errand && Math.hypot(c.brain.errand.x - p.x, c.brain.errand.y - p.y) < 1);
	}

	/** Carriers go for someone, grab them, and climb for the ship; hurt one enough and he lets go. */
	private carry(game: Game, dt: number) {
		for (const c of this.carriers) {
			const held = this.people.find((p) => p.state === 'grabbed' && p.carrier === c);
			if (held) {
				const lost = (held.grabbedAt - c.hp) / c.maxHp;
				if (lost >= CARRY.drop || c.stun > 0 || c.caged > 0) {
					this.drop(game, held, c);
					continue;
				}
				held.x = c.x;
				held.y = c.y;
				c.brain.errand = { x: SHIP.x, y: SHIP.y, speed: CARRY.speed };
				if (Math.hypot(c.x - SHIP.x, c.y - SHIP.y) >= CARRY.reach) continue;
				// Up the beam: a few seconds when he can still be made to let go
				held.lifting += dt;
				this.once(`lift${this.people.indexOf(held)}`, 'Ring', 'They are in the beam! Stop the carrier!');
				if (held.lifting >= CARRY.lift) {
					held.state = 'taken';
					held.carrier = null;
					// Up the beam, and back down for another
					c.brain.errand = null;
					c.x = c.prevX = SHIP.x + (Math.random() - 0.5) * 200;
					this.comms.say('John', this.taken === 1 ? "They got one aboard. Not again." : 'Another one up the beam!', true);
				}
				continue;
			}
			// Going for someone
			const mine = c.brain.errand ? this.people.find((p) => p.state === 'waiting' && Math.hypot(c.brain.errand!.x - p.x, c.brain.errand!.y - p.y) < 1) : undefined;
			const target = mine ?? this.people.filter((p) => p.state === 'waiting' && !this.claimed(p)).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0];
			if (!target) {
				c.brain.errand = null;
				continue;
			}
			c.brain.errand = { x: target.x, y: target.y, speed: 210 };
			if (Math.hypot(c.x - target.x, c.y - target.y) < CARRY.grab) {
				target.state = 'grabbed';
				target.carrier = c;
				target.grabbedAt = c.hp;
				this.once('firstGrab', 'Flash', "He's got someone! John, the one with the bubble!");
			}
		}
		// A carrier who went down lets go too
		for (const p of this.people) if (p.state === 'grabbed' && p.carrier && !isStanding(p.carrier)) this.drop(game, p, p.carrier);
	}

	private drop(game: Game, p: Person, c: Enemy) {
		p.state = 'dropped';
		p.lifting = 0;
		// They come down on open ground, not on top of a parked car
		const blocked = (x: number, y: number) => game.map.obstacles.some((o) => boxOverlap(x, y, 30, 14, o));
		for (let r = 0; r < 400 && blocked(p.x, p.y); r += 20) {
			const spot = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => ({ x: p.x + Math.cos(k * 0.785) * r, y: p.y + Math.sin(k * 0.785) * r })).find((q) => !blocked(q.x, q.y));
			if (spot) {
				p.x = spot.x;
				p.y = spot.y;
			}
		}
		p.carrier = null;
		p.dazed = 1.2;
		c.brain.errand = null;
		this.saves++;
		this.comms.say('Flash', ['Got them!', "I've got this one. Going!", 'Dropped one! On it!'][this.saves % 3]);
	}

	/** The Flash runs anyone dropped all the way home, then comes back for the next. */
	private runHome(game: Game) {
		const flash = game.players.find((p) => p.hero?.id === 'flash');
		const h = flash?.hero;
		if (!flash || !h) return;
		const carrying = this.people.find((p) => p.state === 'running');
		if (carrying) {
			carrying.x = flash.x;
			carrying.y = flash.y;
			h.errand = HOME;
			if (Math.hypot(flash.x - HOME.x, flash.y - HOME.y) < 70) {
				carrying.state = 'home';
				carrying.x = HOME.x + (Math.random() - 0.5) * 120;
				carrying.y = HOME.y + (Math.random() - 0.5) * 80;
			}
			return;
		}
		const next = this.people.filter((p) => p.state === 'dropped').sort((a, b) => Math.hypot(a.x - flash.x, a.y - flash.y) - Math.hypot(b.x - flash.x, b.y - flash.y))[0];
		if (!next) {
			h.errand = null;
			return;
		}
		h.errand = { x: next.x, y: next.y };
		if (Math.hypot(flash.x - next.x, flash.y - next.y) < FLASH.grab) next.state = 'running';
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
		for (const c of this.carriers) c.brain.errand = { x: SHIP.x, y: SHIP.y - 400, speed: 300 };
		this.comms.scene([
			['Flash', "It's pulling out. Going up, fast."],
			['John', 'Fear as fuel. Sinestro is building something with it, on Korugar.'],
			['Flash', 'Then you go stop him. I have a lot of people to walk home.']
		]);
	}

	private lose(reason: 'taken' | 'down') {
		if (this.state !== 'playing') return;
		this.state = 'lost';
		this.failReason = reason;
	}

	// -------------------------------------------------------------- drawing

	cameraPoints(): [number, number][] {
		const john = this.gameRef?.players[0];
		if (!john) return [];
		const near = this.people.find((p) => p.state === 'grabbed' && p.carrier && Math.hypot(p.x - john.x, p.y - john.y) < 600);
		return near ? [[near.x, near.y]] : [];
	}

	goal(): { x: number; y: number } | null {
		if (this.state !== 'playing') return null;
		const held = this.people.filter((p) => p.state === 'grabbed' && p.carrier).sort((a, b) => Math.hypot(a.x - SHIP.x, a.y - SHIP.y) - Math.hypot(b.x - SHIP.x, b.y - SHIP.y))[0];
		return held?.carrier ?? null;
	}

	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		const list: Drawable[] = [{ baseY: SHIP.y - 300, draw: () => drawShipOverhead(ctx, SHIP.x, SHIP.y, time) }];
		list.push({ baseY: HOME.y - 60, draw: () => drawPoliceLine(ctx, HOME.x, HOME.y, time) });
		for (const p of this.people) {
			if (p.state === 'taken') continue;
			if (p.state === 'grabbed') {
				list.push({ baseY: p.y + 2, draw: () => drawHeldInBubble(ctx, p.look, p.x, p.y, time) });
				continue;
			}
			const cowering = p.state === 'waiting' || p.dazed > 0;
			list.push({
				baseY: p.y,
				draw: () => {
					ctx.save();
					if (cowering) {
						// Down on their haunches, arms over their head
						ctx.translate(p.x, p.y);
						ctx.scale(1, 0.82);
						ctx.translate(-p.x, -p.y);
					}
					drawColonist(ctx, p.look, p.x, p.y, 1, p.state === 'running', time);
					ctx.restore();
					if (p.state === 'waiting') {
						ctx.fillStyle = `rgba(255, 210, 58, ${0.5 + 0.3 * Math.sin(time * 4 + p.x)})`;
						ctx.font = '800 13px system-ui, sans-serif';
						ctx.textAlign = 'center';
						ctx.fillText('!', p.x, p.y - 80);
					}
				}
			});
		}
		return list;
	}
}

/** The Sinestro Corps ship, seen from above the street: a dark yellow-edged hull and the beam coming down out of it. */
function drawShipOverhead(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
	ctx.save();
	// Its shadow across the street
	ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
	ctx.beginPath();
	ctx.ellipse(x, y + 20, 420, 140, 0, 0, Math.PI * 2);
	ctx.fill();
	// The beam: a column of yellow light down to the street
	const beam = ctx.createLinearGradient(0, y - 360, 0, y + 30);
	beam.addColorStop(0, `rgba(255, 210, 58, ${0.55 + 0.1 * Math.sin(time * 4)})`);
	beam.addColorStop(1, 'rgba(255, 210, 58, 0.1)');
	ctx.fillStyle = beam;
	ctx.beginPath();
	ctx.moveTo(x - 50, y - 360);
	ctx.lineTo(x + 50, y - 360);
	ctx.lineTo(x + 110, y + 20);
	ctx.lineTo(x - 110, y + 20);
	ctx.closePath();
	ctx.fill();
	ctx.strokeStyle = 'rgba(255, 230, 140, 0.5)';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.ellipse(x, y + 10, 110, 30, 0, 0, Math.PI * 2);
	ctx.stroke();
	// The hull, high above
	const hy = y - 400;
	ctx.fillStyle = '#2a2414';
	ctx.strokeStyle = '#ffd23a';
	ctx.lineWidth = 4;
	ctx.shadowColor = '#ffd23a';
	ctx.shadowBlur = 24;
	ctx.beginPath();
	ctx.moveTo(x - 380, hy);
	ctx.lineTo(x - 160, hy - 70);
	ctx.lineTo(x + 160, hy - 70);
	ctx.lineTo(x + 380, hy);
	ctx.lineTo(x + 120, hy + 44);
	ctx.lineTo(x - 120, hy + 44);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.shadowBlur = 0;
	ctx.fillStyle = `rgba(255, 210, 58, ${0.6 + 0.3 * Math.sin(time * 3)})`;
	for (const dx of [-240, -120, 0, 120, 240]) ctx.fillRect(x + dx - 10, hy - 6, 20, 6);
	ctx.restore();
}

/** Someone held in a yellow construct bubble, carried off their feet. */
function drawHeldInBubble(ctx: CanvasRenderingContext2D, look: Figure, x: number, y: number, time: number) {
	ctx.save();
	ctx.translate(0, -40);
	drawColonist(ctx, look, x, y, 1, false, time);
	ctx.strokeStyle = `rgba(255, 210, 58, ${0.8 + 0.2 * Math.sin(time * 8)})`;
	ctx.fillStyle = 'rgba(255, 210, 58, 0.18)';
	ctx.lineWidth = 3;
	ctx.shadowColor = '#ffd23a';
	ctx.shadowBlur = 12;
	ctx.beginPath();
	ctx.ellipse(x, y - 40, 34, 52, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();
	ctx.restore();
}

/** The police line where the Flash brings people: tape, a cruiser's lights, a safe spot. */
function drawPoliceLine(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
	ctx.save();
	ctx.fillStyle = 'rgba(80, 220, 120, 0.14)';
	ctx.beginPath();
	ctx.ellipse(x, y, 190, 90, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = 'rgba(80, 220, 120, 0.6)';
	ctx.setLineDash([10, 8]);
	ctx.lineWidth = 3;
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.strokeStyle = '#e8c21e';
	ctx.lineWidth = 4;
	ctx.beginPath();
	ctx.moveTo(x - 180, y - 60);
	ctx.lineTo(x + 180, y - 60);
	ctx.stroke();
	ctx.fillStyle = '#141414';
	ctx.font = '800 10px system-ui, sans-serif';
	ctx.textAlign = 'center';
	for (let k = -150; k <= 150; k += 75) ctx.fillText('POLICE LINE', x + k, y - 57);
	const on = Math.sin(time * 10) > 0;
	ctx.fillStyle = on ? '#ff3a2a' : '#3a6aff';
	ctx.beginPath();
	ctx.arc(x - 120, y - 90, 7, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = on ? '#3a6aff' : '#ff3a2a';
	ctx.beginPath();
	ctx.arc(x + 120, y - 90, 7, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}
