// Mission 1: Safe Passage.
//
// Tomar-Re's damaged cruiser crosses the Durvan Belt from left to right.
// A storm of 100 asteroids drifts in toward its path, wave after wave.
// Hal blasts them before they reach the ship.
//
//   intro     a moment to get ready
//   playing   the ship flies; asteroids come in on a schedule
//   won       the ship made it across with hull to spare
//   lost      the ship was destroyed, or Hal went down one time too many
//
// Asteroids are ordinary targets (dummies that drift), so every ring shot,
// construct and signature works on them. The ship carries the Lantern
// battery, so staying near it keeps Hal's willpower up.

import { damagePlayer } from '../combat';
import { absorbWithShield, type ConstructWorld, type Protectable } from '../constructs/system';
import { isStanding, type Dummy } from '../dummy';
import type { Drawable, Game } from '../game';
import { seededRandom, type GameMap, type Obstacle } from '../map';
import { drawEscortShip, drawShipShield } from '../draw/escort';
import type { CommsLine, MissionDirector, MissionMeter, MissionState, MissionStat } from './mission';

export type { MissionState } from './mission';
export type RockSize = 'small' | 'medium' | 'large';

/** How each size of asteroid behaves. */
export const ROCKS: Record<RockSize, { radius: number; hp: number; speed: [number, number]; shipDamage: number; lanternDamage: number }> = {
	small: { radius: 14, hp: 20, speed: [110, 150], shipDamage: 6, lanternDamage: 8 },
	medium: { radius: 22, hp: 55, speed: [85, 115], shipDamage: 13, lanternDamage: 14 },
	large: { radius: 34, hp: 130, speed: [60, 85], shipDamage: 24, lanternDamage: 22 }
};

/** The storm: waves of [start second, how many, over how many seconds]. 100 in all. */
const WAVES: [number, number, number][] = [
	[4, 4, 6],
	[14, 6, 6],
	[26, 8, 7],
	[40, 10, 8],
	[55, 12, 8],
	[70, 12, 8],
	[86, 14, 9],
	[102, 14, 9],
	[118, 20, 12]
];
export const TOTAL_ROCKS = WAVES.reduce((n, [, count]) => n + count, 0);

export const MISSION_LIVES = 3;
const INTRO_TIME = 3;
const SHIP_HULL = 500;
const SHIP_SPEED = 25;
/** How high the ship and asteroids float above their ground point (they're drawn this far up). */
export const FLOAT = 40;
/** The ship's footprint on the ground plane: half its length and half its depth. */
const SHIP_HALF_LENGTH = 85;
const SHIP_HALF_DEPTH = 28;
/** Further than this from the ship and the asteroid has gone past. */
const LOST_DISTANCE = 1300;
/** Further than this and Hal is told to get back to the ship. */
export const LEASH = 650;

/** How far ahead (seconds) the ship watches for asteroids on a collision course. */
const THREAT_LOOKAHEAD = 2.5;

/** The ship is something a Lantern can shield (Shift puts the bubble on it when it's in danger). */
export interface EscortShip extends Protectable {
	x: number;
	y: number;
	prevX: number;
	prevY: number;
	hull: number;
	maxHull: number;
	/** Seconds of hit flash left. */
	flash: number;
}

/** The Durvan Belt: a long stretch of space, big rocks only along the far edges. */
export function buildBeltMap(): GameMap {
	const width = 4600;
	const height = 1500;
	const rand = seededRandom(7);
	const obstacles: Obstacle[] = [];
	for (let i = 0; i < 16; i++) {
		const size = 70 + rand() * 90;
		const top = i % 2 === 0;
		obstacles.push({
			kind: 'asteroid',
			x: 150 + (i / 16) * (width - 300) + rand() * 80,
			y: top ? 30 + rand() * 90 : height - 60 - size * 0.7 - rand() * 90,
			w: size,
			h: size * 0.7,
			height: size * 0.45,
			blocksFlying: true,
			seed: rand()
		});
	}
	const spawn = { x: 520, y: height / 2 + 140 };
	return { name: 'The Durvan Belt', environment: 'space', width, height, spawn, battery: { x: 420, y: height / 2 + 50 }, dummies: [], obstacles };
}

export class SafePassage implements MissionDirector {
	state: MissionState = 'intro';
	timer = INTRO_TIME;
	/** Seconds since the ship set off. */
	elapsed = 0;
	lives = MISSION_LIVES;
	readonly ship: EscortShip;
	spawned = 0;
	destroyed = 0;
	/** Asteroids that hit the ship. */
	impacts = 0;
	failReason: 'ship' | 'lantern' | null = null;

	private readonly startX: number;
	private readonly endX: number;
	private readonly laneY: number;
	private schedule: { at: number; size: RockSize }[] = [];
	private rocks = new Map<Dummy, RockSize>();
	/** Asteroids that broke on the ship or on Hal (not blasted). */
	private crashed = new WeakSet<Dummy>();
	private wasDown: boolean[] = [];
	private rand: () => number;
	private world: ConstructWorld | null = null;

	constructor(map: GameMap, seed = Math.random() * 1e6) {
		this.rand = seededRandom(Math.floor(seed));
		this.laneY = map.height / 2;
		this.startX = 420;
		this.endX = map.width - 420;
		this.ship = {
			x: this.startX,
			y: this.laneY,
			prevX: this.startX,
			prevY: this.laneY,
			hull: SHIP_HULL,
			maxHull: SHIP_HULL,
			flash: 0,
			name: "Tomar-Re's ship",
			radius: SHIP_HALF_LENGTH + 20,
			lift: FLOAT,
			threat: 0
		};
		// Early waves are mostly small rocks; later ones bring the big ones
		WAVES.forEach(([start, count, over], w) => {
			for (let i = 0; i < count; i++) {
				const roll = this.rand();
				const bigChance = 0.05 + w * 0.03;
				const size: RockSize = roll < bigChance ? 'large' : roll < bigChance + 0.3 + w * 0.02 ? 'medium' : 'small';
				this.schedule.push({ at: start + (over * i) / count + this.rand() * 0.6, size });
			}
		});
		this.schedule.sort((a, b) => a.at - b.at);
	}

	/** 0 at the start of the belt, 1 across it. */
	get progress(): number {
		return Math.min(1, Math.max(0, (this.ship.x - this.startX) / (this.endX - this.startX)));
	}

	/** Seconds until the ship is across. */
	get timeLeft(): number {
		return Math.max(0, (this.endX - this.ship.x) / SHIP_SPEED);
	}

	/** 1 to 3 stars: made it; hull at least half; and 70+ asteroids blasted. */
	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.ship.hull >= this.ship.maxHull * 0.5 ? 1 : 0) + (this.destroyed >= 70 ? 1 : 0);
	}

	readonly objective = "Keep the asteroids off Tomar-Re's ship";
	readonly starHint = '★ made it · ★ hull at least 50% · ★ 70+ asteroids blasted';
	readonly line: CommsLine | null = null;

	meters(): MissionMeter[] {
		const hull = this.ship.hull / this.ship.maxHull;
		const left = Math.ceil(this.timeLeft);
		return [
			{ label: 'Hull', value: hull, text: `${Math.round(hull * 100)}%`, low: hull < 0.3 },
			{ label: 'Belt', value: this.progress, text: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, marker: '▶' }
		];
	}

	warning(game: Game): string | null {
		return this.state === 'playing' && this.farFrom(game) ? "Get back to Tomar-Re's ship!" : null;
	}

	get resultText(): string {
		if (this.state === 'won') return 'Tomar-Re made it home to Oa. But something red is moving on the frontier...';
		return this.failReason === 'ship' ? "Tomar-Re's ship broke apart in the storm." : 'Hal went down one time too many.';
	}

	tally(): string {
		return `Asteroids blasted ${this.destroyed} / ${TOTAL_ROCKS}`;
	}

	stats(): MissionStat[] {
		return [
			{ label: 'Asteroids blasted', value: `${this.destroyed} / ${TOTAL_ROCKS}` },
			{ label: 'Hull left', value: `${Math.round((this.ship.hull / this.ship.maxHull) * 100)}%` },
			{ label: 'Hits on the ship', value: `${this.impacts}` }
		];
	}

	/** Is Hal too far from the ship? */
	farFrom(game: Game): boolean {
		const p = game.players[0];
		return Math.hypot(p.x - this.ship.x, p.y - this.ship.y) > LEASH;
	}

	update(game: Game, dt: number) {
		const s = this.ship;
		this.world = game.constructs;
		if (!game.constructs.protectables.includes(s)) game.constructs.protectables.push(s);
		s.prevX = s.x;
		s.prevY = s.y;
		s.flash = Math.max(0, s.flash - dt);

		switch (this.state) {
			case 'intro':
				this.timer -= dt;
				if (this.timer <= 0) {
					this.state = 'playing';
					game.constructs.effects.push({ kind: 'callout', x: s.x, y: s.y - 80, age: 0, life: 2, text: 'ENGINES ONLINE' });
				}
				break;
			case 'playing':
				this.elapsed += dt;
				s.x = Math.min(this.endX, s.x + SHIP_SPEED * dt);
				s.y = this.laneY + Math.sin(this.elapsed * 0.22) * 70;
				this.spawnDue(game);
				if (s.x >= this.endX) this.win(game);
				break;
			case 'won':
				// Seconds since the win: the page starts the landing scene after the cheer
				this.timer += dt;
				// Tomar-Re flies on toward Oa
				s.x += SHIP_SPEED * 3 * dt;
				break;
		}

		// The Lantern battery rides on the ship
		const battery = game.batteries[0];
		if (battery) {
			battery.x = s.x - 20;
			battery.y = s.y + 60;
		}

		this.updateRocks(game);
		s.threat = this.state === 'playing' ? this.threatToShip() : 0;
		this.countDowns(game);
		if (this.state === 'playing' && s.hull <= 0) this.lose(game, 'ship');
	}

	/** Bring in every asteroid that's due. */
	private spawnDue(game: Game) {
		while (this.schedule.length > 0 && this.schedule[0].at <= this.elapsed) {
			const { size } = this.schedule.shift()!;
			this.spawnRock(game, size);
		}
	}

	private spawnRock(game: Game, size: RockSize) {
		const def = ROCKS[size];
		const s = this.ship;
		const r = this.rand;
		// From ahead, above or below: never from behind the ship
		const angle = (r() - 0.5) * (Math.PI * 1.25);
		const dist = 700 + r() * 150;
		const speed = def.speed[0] + r() * (def.speed[1] - def.speed[0]);
		// Where the ship will be when the rock gets there. Most are dead on; a
		// quarter are near misses (so not every rock is worth chasing).
		const eta = dist / speed;
		const miss = r() < 0.25 ? 1 : 0.15;
		const tx = s.x + SHIP_SPEED * eta + (r() - 0.5) * 120 * miss;
		const ty = this.laneY + Math.sin((this.elapsed + eta) * 0.22) * 70 + (r() - 0.5) * 260 * miss;
		const x = tx + Math.cos(angle) * dist;
		const y = ty + Math.sin(angle) * dist * 0.75;
		const len = Math.hypot(tx - x, ty - y) || 1;
		const rock: Dummy = {
			kind: 'spaceRock',
			x,
			y,
			prevX: x,
			prevY: y,
			vx: ((tx - x) / len) * speed,
			vy: ((ty - y) / len) * speed,
			hp: def.hp,
			maxHp: def.hp,
			homeX: x,
			homeY: y,
			caged: 0,
			flash: 0,
			stun: 0,
			down: 0,
			respawns: false,
			gone: false,
			dir: 1,
			drift: { radius: def.radius, float: FLOAT, spin: (r() - 0.5) * 2.4, seed: r() }
		};
		game.dummies.push(rock);
		this.rocks.set(rock, size);
		this.spawned++;
	}

	private updateRocks(game: Game) {
		const s = this.ship;
		for (const [rock, size] of this.rocks) {
			const def = ROCKS[size];
			// Broken: blasted by Hal (counts), or crashed into something (doesn't)
			if (!isStanding(rock)) {
				if (!this.crashed.has(rock)) this.destroyed++;
				game.constructs.effects.push({ kind: 'debris', x: rock.x, y: rock.y, age: 0, life: 0.7, radius: def.radius, lift: FLOAT });
				rock.gone = true;
				this.rocks.delete(rock);
				continue;
			}
			// Hit the ship? A bubble shield on it takes the blow and breaks the rock (that counts as blasted)
			if (this.state === 'playing' && Math.abs(rock.x - s.x) < SHIP_HALF_LENGTH + def.radius * 0.6 && Math.abs(rock.y - s.y) < SHIP_HALF_DEPTH + def.radius * 0.5) {
				const through = absorbWithShield(game.constructs, s, def.shipDamage);
				if (through === 0) {
					rock.hp = 0;
					rock.down = 0.2;
					game.constructs.effects.push({ kind: 'snap', x: rock.x, y: rock.y, age: 0, life: 0.3, radius: def.radius + 10, lift: FLOAT });
					continue;
				}
				s.hull = Math.max(0, s.hull - through);
				s.flash = 0.2;
				this.impacts++;
				this.crash(rock);
				// A flash where it struck the hull (its debris comes when it's cleared next tick)
				game.constructs.effects.push({ kind: 'redImpact', x: rock.x, y: rock.y, age: 0, life: 0.35, lift: FLOAT });
				continue;
			}
			// Hit a Lantern?
			for (const p of game.players) {
				if (p.downed || p.dash) continue;
				const touching = Math.abs(rock.x - p.x) < def.radius + 10 && Math.abs(rock.y - p.y) < def.radius * 0.6 + 12;
				if (!touching) continue;
				damagePlayer(game.constructs, p, def.lanternDamage, rock.x, rock.y, 260 + def.radius * 4);
				this.crash(rock);
				break;
			}
			// Drifted away past the ship: gone
			if (!this.crashed.has(rock) && Math.hypot(rock.x - s.x, rock.y - s.y) > LOST_DISTANCE) {
				rock.gone = true;
				this.rocks.delete(rock);
			}
		}
	}

	/**
	 * How much danger the ship is in: asteroids that will hit it within the
	 * next couple of seconds, bigger and sooner counting for more. A Lantern
	 * with an enemy winding up on them is about 1, so a couple of rocks
	 * inbound makes the ship the one to shield.
	 */
	private threatToShip(): number {
		const s = this.ship;
		let threat = 0;
		for (const [rock, size] of this.rocks) {
			if (!isStanding(rock)) continue;
			// Closest approach, relative to the moving ship
			const rx = rock.x - s.x;
			const ry = rock.y - s.y;
			const vx = rock.vx - SHIP_SPEED;
			const vy = rock.vy;
			const speed2 = vx * vx + vy * vy || 1;
			const t = Math.max(0, Math.min(THREAT_LOOKAHEAD, -(rx * vx + ry * vy) / speed2));
			const cx = rx + vx * t;
			const cy = ry + vy * t;
			const r = ROCKS[size].radius;
			if (Math.abs(cx) > SHIP_HALF_LENGTH + r || Math.abs(cy) > SHIP_HALF_DEPTH + r) continue;
			threat += (ROCKS[size].shipDamage / 12) * (1 - (t / THREAT_LOOKAHEAD) * 0.5);
		}
		if (s.hull < s.maxHull * 0.35) threat *= 1.5;
		return threat;
	}

	/** Broke on the ship or a Lantern: gone, but not counted as blasted. */
	private crash(rock: Dummy) {
		this.crashed.add(rock);
		rock.hp = 0;
		rock.down = 0.2;
	}

	/** Each time Hal goes down costs a life; the last one ends the mission. */
	private countDowns(game: Game) {
		game.players.forEach((p, i) => {
			if (p.downed && !this.wasDown[i] && this.state === 'playing') {
				this.lives--;
				if (this.lives <= 0) this.lose(game, 'lantern');
			}
			this.wasDown[i] = p.downed;
			if (this.state === 'lost' && p.downed) p.downTimer = Math.max(p.downTimer, 1);
		});
	}

	private win(game: Game) {
		this.state = 'won';
		this.timer = 0;
		for (const p of game.players) p.victoryTimer = 0.4;
		const p = game.players[0];
		game.constructs.effects.push({ kind: 'callout', x: p.x, y: p.y, age: 0, life: 2.5, text: 'SAFE PASSAGE!', owner: p });
	}

	private lose(game: Game, reason: 'ship' | 'lantern') {
		this.state = 'lost';
		this.failReason = reason;
		game.downedNotice = false;
		if (reason === 'ship') {
			// The cruiser breaks apart
			const s = this.ship;
			for (let i = 0; i < 6; i++) {
				const x = s.x + (i - 2.5) * 30;
				game.constructs.effects.push({ kind: 'debris', x, y: s.y, age: 0, life: 0.9 + i * 0.1, radius: 30 + i * 4, lift: FLOAT });
				game.constructs.effects.push({ kind: 'redImpact', x, y: s.y, age: 0, life: 0.4 + i * 0.05, lift: FLOAT });
			}
		}
	}

	/** Keep the ship in view with Hal: you need to see what's heading for it. */
	cameraPoints(): [number, number][] {
		return [[this.ship.x, this.ship.y - 40]];
	}

	drawables(ctx: CanvasRenderingContext2D, alpha: number, time: number): Drawable[] {
		const s = this.ship;
		const x = s.prevX + (s.x - s.prevX) * alpha;
		const y = s.prevY + (s.y - s.prevY) * alpha;
		const destroyed = this.failReason === 'ship';
		const shield = this.world?.shields.find((sh) => sh.target === s);
		return [
			{
				baseY: y,
				draw: () => {
					drawEscortShip(ctx, x, y, s.hull / s.maxHull, s.flash, destroyed, time);
					if (shield) drawShipShield(ctx, shield, x, y - FLOAT, s.radius, time);
				}
			}
		];
	}
}
