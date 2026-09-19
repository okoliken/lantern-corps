// Mission 4: The Interceptor.
//
// The Guardians won't send anyone past the frontier, and Sinestro backs them.
// Hal and Kilowog take the Interceptor, the Corps' prototype ship, and go
// anyway. It flies itself; the Lanterns fly outside and keep it in one piece.
//
//   run      the ship crosses the frontier. Red Lantern fighters attack in
//            waves and fire rage torpedoes at it: shoot them down, or shield
//            the ship (Shift). Downing fighters means fewer torpedoes.
//   reboot   halfway, Bleez ambushes it and knocks out its power. It sits dead
//            in space while its systems reboot, and the fighters keep coming.
//            The ship's AI wakes up as it boots, a few broken words at a time.
//   online   Aya is awake. The ship's cannons fire on the Red Lanterns; clear
//            them so it can jump.
//   jump     the Interceptor leaves for Sector 666's border.
//
// Lose: the ship is destroyed, or Hal goes down 3 times. The Lantern battery
// rides the ship, so staying near it keeps willpower up.

import { damagePlayer } from '../combat';
import { absorbWithShield, hitDummyWithFx, type ConstructWorld, type Protectable } from '../constructs/system';
import { isStanding, type Dummy } from '../dummy';
import type { Enemy, Role } from '../enemies/enemies';
import { drawShipShield } from '../draw/escort';
import { drawCannonShot, drawInterceptor } from '../draw/interceptor';
import type { Drawable, Game } from '../game';
import { seededRandom, type GameMap, type Obstacle } from '../map';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

export type InterceptorPhase = 'run' | 'reboot' | 'online' | 'jump';

export const INTERCEPTOR_LIVES = 3;
const INTRO_TIME = 3;
export const SHIP_HULL = 600;
const SHIP_SPEED = 28;
/** How high the ship floats above its ground point (it's drawn this far up). */
const FLOAT = 44;
/** The ship's footprint on the ground plane: half its length and half its depth. */
const SHIP_HALF_LENGTH = 110;
const SHIP_HALF_DEPTH = 30;
/** Further than this and Hal is told to get back to the ship. */
const LEASH = 700;
/** Seconds for the ship's systems to reboot after Bleez's ambush. */
export const REBOOT_TIME = 45;
/** What the ambush does to the hull. */
const AMBUSH_DAMAGE = 60;
/** Once Aya's awake: seconds between cannon shots, their reach and damage. */
const CANNON_EVERY = 0.55;
const CANNON_RANGE = 900;
const CANNON_DAMAGE = 40;
/** If the last Red Lanterns hide out this long, the ship jumps anyway. */
const ONLINE_MAX = 40;
const JUMP_TIME = 2.5;
/** Fighters fire torpedoes at the ship from within this range, every so often. */
const TORPEDO_RANGE = 1100;
const TORPEDO_EVERY: [number, number] = [3.2, 4.6];
/** Red Lanterns here are this much tougher and harder-hitting than the lab's. */
const TOUGHNESS = 3.5;
const MIGHT = 1.3;

/** A rage torpedo: small, quick, one ring-shot burst breaks it. */
export const TORPEDO = { radius: 14, hp: 18, speed: 210, shipDamage: 30, lanternDamage: 14 };
/** How far ahead (seconds) the ship watches for torpedoes on a collision course. */
const THREAT_LOOKAHEAD = 2;

const W = 5200;
const H = 1600;
const START_X = 460;
/** Where Bleez springs her ambush. */
export const AMBUSH_X = 2300;
const LANE_Y = H / 2;

/** Who comes in, when, and from where (relative to the ship): [second, who, dx, dy]. */
type Arrival = [number, 'fighter' | 'bleez' | Role, number, number];
const RUN_WAVES: Arrival[] = [
	[4, 'fighter', 900, -380],
	[5, 'fighter', 950, 380],
	[18, 'fighter', 800, -420],
	[19, 'fighter', 1000, 0],
	[20, 'fighter', 850, 420],
	[36, 'fighter', -500, -420],
	[37, 'gunner', 700, -250],
	[37, 'hunter', 750, 250],
	[38, 'fighter', 900, 380],
	[39, 'fighter', -700, 400]
];
/** Seconds into the reboot. Bleez leads it. */
const REBOOT_WAVES: Arrival[] = [
	[0, 'bleez', 380, -200],
	[1, 'fighter', 900, 300],
	[2, 'fighter', -800, -300],
	[3, 'fighter', 0, 600],
	[14, 'fighter', 850, -400],
	[15, 'fighter', -850, 400],
	[16, 'berserker', 500, 250],
	[17, 'fighter', -900, 0],
	[28, 'fighter', 900, 0],
	[29, 'fighter', 700, -420],
	[30, 'fighter', -700, 420],
	[31, 'gunner', -600, 300],
	[32, 'hunter', 600, -300]
];

/** The Interceptor is something a Lantern can shield (Shift puts the bubble on it when it's in danger). */
export interface Interceptor extends Protectable {
	x: number;
	y: number;
	prevX: number;
	prevY: number;
	hull: number;
	maxHull: number;
	flash: number;
	/** 0 dead in space .. 1 full power. */
	power: number;
	/** 0..1 through the reboot. */
	boot: number;
}

interface CannonShot {
	x: number;
	y: number;
	age: number;
}

/** The frontier: a long stretch of empty space with drifting rocks along the edges. */
export function buildFrontierMap(): GameMap {
	const rand = seededRandom(666);
	const obstacles: Obstacle[] = [];
	for (let i = 0; i < 18; i++) {
		const size = 60 + rand() * 90;
		const top = i % 2 === 0;
		obstacles.push({
			kind: 'asteroid',
			x: 200 + (i / 18) * (W - 400) + rand() * 90,
			y: top ? 20 + rand() * 70 : H - 50 - size * 0.7 - rand() * 70,
			w: size,
			h: size * 0.7,
			height: size * 0.45,
			blocksFlying: true,
			seed: rand()
		});
	}
	return {
		name: 'The Frontier',
		environment: 'space',
		width: W,
		height: H,
		spawn: { x: START_X + 60, y: LANE_Y + 150 },
		battery: { x: START_X - 20, y: LANE_Y + 60 },
		dummies: [],
		obstacles
	};
}

export class InterceptorMission implements MissionDirector {
	state: MissionState = 'intro';
	phase: InterceptorPhase = 'run';
	timer = INTRO_TIME;
	lives = INTERCEPTOR_LIVES;
	elapsed = 0;
	/** Seconds into the current phase. */
	phaseTime = 0;
	failReason: 'ship' | 'lantern' | null = null;
	readonly comms = new Comms();
	readonly ship: Interceptor;
	readonly starHint = '★ made the jump · ★ hull at least 50% · ★ no lives lost';
	/** Red Lanterns beaten, torpedoes shot down, torpedoes that hit the ship. */
	defeated = 0;
	torpedoesDowned = 0;
	torpedoHits = 0;
	downs = 0;
	/** Everything that's come in, for the meter and the all-clear. */
	private wave: Enemy[] = [];
	private schedule: Arrival[] = [...RUN_WAVES];
	private torpedoes = new Set<Dummy>();
	/** Torpedoes that burst on the ship or a Lantern (not shot down). */
	private burst = new WeakSet<Dummy>();
	private reloads = new WeakMap<Enemy, number>();
	private counted = new WeakSet<Enemy>();
	private shots: CannonShot[] = [];
	private cannonIn = 0;
	private ayaSaid = 0;
	private wasDown = false;
	private rand: () => number;
	private world: ConstructWorld | null = null;

	constructor(seed = 4) {
		this.rand = seededRandom(seed);
		this.ship = {
			x: START_X,
			y: LANE_Y,
			prevX: START_X,
			prevY: LANE_Y,
			hull: SHIP_HULL,
			maxHull: SHIP_HULL,
			flash: 0,
			power: 1,
			boot: 0,
			name: 'the Interceptor',
			radius: SHIP_HALF_LENGTH + 20,
			lift: FLOAT,
			threat: 0
		};
	}

	// ------------------------------------------------------------ reporting

	get objective(): string {
		switch (this.phase) {
			case 'run':
				return 'Get the Interceptor across the frontier';
			case 'reboot':
				return 'Protect the ship while it reboots';
			case 'online':
				return 'Clear the Red Lanterns so the ship can jump';
			case 'jump':
				return 'Jump!';
		}
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	/** 0 at the start, 1 at the ambush point. */
	get progress(): number {
		return Math.min(1, Math.max(0, (this.ship.x - START_X) / (AMBUSH_X - START_X)));
	}

	meters(): MissionMeter[] {
		const s = this.ship;
		const hull = s.hull / s.maxHull;
		const list: MissionMeter[] = [{ label: 'Hull', value: hull, text: `${Math.round(hull * 100)}%`, low: hull < 0.3 }];
		if (this.phase === 'run') list.push({ label: 'Frontier', value: this.progress, text: `${Math.round(this.progress * 100)}%`, marker: '▶' });
		if (this.phase === 'reboot') list.push({ label: 'Reboot', value: s.boot, text: `${Math.floor(s.boot * 100)}%` });
		const left = this.wave.filter(isStanding).length;
		if (left > 0 && this.phase !== 'run') list.push({ label: 'Reds', value: left / Math.max(1, this.wave.length), text: `${left} left` });
		return list;
	}

	warning(game: Game): string | null {
		if (this.state !== 'playing') return null;
		if (this.farFrom(game)) return 'Get back to the Interceptor!';
		if (this.ship.threat > 1.5 && this.ship.hull < this.ship.maxHull * 0.5) return 'Torpedoes incoming! Shift to shield the ship!';
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.ship.hull >= this.ship.maxHull * 0.5 ? 1 : 0) + (this.downs === 0 ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'won') return 'The Interceptor is past the frontier, and it has a mind of its own. Next stop: the Red Lanterns.';
		return this.failReason === 'ship' ? 'The Interceptor broke apart on the frontier.' : 'Hal went down one time too many.';
	}

	tally(): string {
		return `Torpedoes shot down ${this.torpedoesDowned}`;
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		return [
			{ label: 'Hull left', value: `${Math.round((this.ship.hull / this.ship.maxHull) * 100)}%` },
			{ label: 'Red Lanterns beaten', value: `${this.defeated}` },
			{ label: 'Torpedoes shot down', value: `${this.torpedoesDowned}` },
			{ label: 'Time', value: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
		];
	}

	farFrom(game: Game): boolean {
		const p = game.players[0];
		return Math.hypot(p.x - this.ship.x, p.y - this.ship.y) > LEASH;
	}

	// ---------------------------------------------------------------- rules

	update(game: Game, dt: number) {
		const s = this.ship;
		this.world = game.constructs;
		if (!game.constructs.protectables.includes(s)) game.constructs.protectables.push(s);
		s.prevX = s.x;
		s.prevY = s.y;
		s.flash = Math.max(0, s.flash - dt);
		this.comms.update(dt);
		this.shots = this.shots.filter((sh) => (sh.age += dt) < 0.18);
		this.countDefeats();

		switch (this.state) {
			case 'intro':
				this.timer -= dt;
				if (this.timer <= 0) {
					this.state = 'playing';
					this.comms.scene([
						['Sinestro', 'Jordan. The Guardians have forbidden this. Bring that ship back to Oa.'],
						['Hal', "Tell 'em I'll bring it back with a full tank."],
						['Kilowog', "We are in so much trouble, poozer. Let's make it worth it."]
					]);
				}
				break;
			case 'playing':
				this.elapsed += this.phase === 'jump' ? 0 : dt;
				this.phaseTime += dt;
				this.play(game, dt);
				break;
			case 'won':
				this.timer += dt;
				s.x += SHIP_SPEED * 20 * dt;
				break;
			case 'lost':
				for (const p of game.players) if (p.downed && p.slot === 0) p.downTimer = Math.max(p.downTimer, 1);
				break;
		}

		// The Lantern battery rides on the ship
		const battery = game.batteries[0];
		if (battery) {
			battery.x = s.x - 30;
			battery.y = s.y + 70;
		}

		this.updateTorpedoes(game);
		s.threat = this.state === 'playing' ? this.threatToShip() : 0;
		if (this.state === 'playing') {
			this.countDowns(game);
			if (s.hull <= 0) this.lose(game, 'ship');
		}
	}

	private play(game: Game, dt: number) {
		const s = this.ship;
		this.spawnDue(game);
		this.fireTorpedoes(game, dt);

		switch (this.phase) {
			case 'run':
				s.x = Math.min(AMBUSH_X, s.x + SHIP_SPEED * dt);
				s.y = LANE_Y + Math.sin(this.phaseTime * 0.2) * 60;
				if (this.phaseTime > 30 && this.phaseTime < 30 + dt) this.comms.say('Kilowog', "Keep those torpedoes off the hull! This thing's a prototype!");
				if (s.x >= AMBUSH_X) this.ambush(game);
				break;
			case 'reboot': {
				s.power = Math.max(0, s.power - dt * 2);
				s.boot = Math.min(1, this.phaseTime / REBOOT_TIME);
				this.ayaWakes();
				if (s.boot >= 1) this.online();
				break;
			}
			case 'online':
				s.power = Math.min(1, s.power + dt);
				this.fireCannons(game, dt);
				if (this.phaseTime > 6 && (this.cleared() || this.phaseTime > ONLINE_MAX)) {
					this.phase = 'jump';
					this.phaseTime = 0;
					this.comms.scene([
						['Aya', 'Hostiles cleared. Plotting a course for the Sector 666 border.'],
						['Kilowog', "Everybody inside! She's gonna jump!"]
					]);
				}
				break;
			case 'jump':
				// Everyone climbs aboard; engines spool up, then off it goes
				s.x += SHIP_SPEED * 2 * dt * this.phaseTime;
				if (this.phaseTime >= JUMP_TIME && !this.comms.current) this.win(game);
				break;
		}
	}

	/** Bleez strikes: the ship loses power and its systems start rebooting. */
	private ambush(game: Game) {
		const s = this.ship;
		this.phase = 'reboot';
		this.phaseTime = 0;
		this.schedule = [...REBOOT_WAVES];
		s.hull = Math.max(1, s.hull - AMBUSH_DAMAGE);
		s.flash = 0.4;
		for (let i = 0; i < 5; i++) {
			const x = s.x - 80 + i * 40;
			game.constructs.effects.push({ kind: 'redImpact', x, y: s.y, age: 0, life: 0.5 + i * 0.08, lift: FLOAT });
		}
		game.constructs.effects.push({ kind: 'callout', x: s.x, y: s.y - 100, age: 0, life: 2.2, text: 'POWER FAILURE', hurt: true });
		this.comms.scene([
			['Bleez', 'Going somewhere, Green Lanterns?'],
			['Kilowog', "Main power's out! The ship's rebooting itself. Buy it some time!"],
			['Hal', 'Guess we do this the hard way.']
		]);
	}

	/** The ship's AI comes through in pieces as it boots. */
	private ayaWakes() {
		const lines = [
			'...b-boot sequence... unauthorized... pilots... detected...',
			'...hull breach, deck two... Red Lantern signatures... counting...',
			'...Green Lantern Hal Jordan. Green Lantern Kilowog. You have stolen me.'
		];
		const due = Math.floor(this.ship.boot * 4);
		if (due > this.ayaSaid && due <= lines.length) {
			this.ayaSaid = due;
			this.comms.say('Interceptor', lines[due - 1], true);
		}
	}

	private online() {
		const s = this.ship;
		this.phase = 'online';
		this.phaseTime = 0;
		s.boot = 1;
		this.cannonIn = 1.5;
		this.world?.effects.push({ kind: 'callout', x: s.x, y: s.y - 100, age: 0, life: 2.2, text: 'SYSTEMS ONLINE' });
		this.comms.scene([
			['Interceptor', 'Systems online. I am the Interceptor\'s artificial intelligence.'],
			['Hal', 'The ship talks. Does the ship have a name?'],
			['Aya', 'Aya. Weapons are online. Engaging Red Lantern targets.'],
			['Kilowog', 'I like her already.']
		]);
	}

	/** Aya's cannons: the nearest Red Lantern or torpedo in range, a shot at a time. */
	private fireCannons(game: Game, dt: number) {
		this.cannonIn -= dt;
		if (this.cannonIn > 0) return;
		const s = this.ship;
		let best: Dummy | null = null;
		let bestD = CANNON_RANGE;
		for (const d of game.dummies) {
			if (!isStanding(d)) continue;
			// Torpedoes about to hit come first
			const d2 = Math.hypot(d.x - s.x, d.y - s.y) * (this.torpedoes.has(d) ? 0.5 : 1);
			if (d2 < bestD) {
				best = d;
				bestD = d2;
			}
		}
		if (!best) return;
		this.cannonIn = CANNON_EVERY;
		this.shots.push({ x: best.x, y: best.y, age: 0 });
		hitDummyWithFx(game.constructs, best, CANNON_DAMAGE, 120, s.x, s.y, null);
		if (!isStanding(best) && this.torpedoes.has(best)) this.torpedoesDowned++;
	}

	// ----------------------------------------------------------- the enemies

	private spawnDue(game: Game) {
		while (this.schedule.length > 0 && this.schedule[0][0] <= this.phaseTime) {
			const [, who, dx, dy] = this.schedule.shift()!;
			const x = Math.max(80, Math.min(W - 80, this.ship.x + dx));
			const y = Math.max(140, Math.min(H - 100, this.ship.y + dy));
			const e =
				who === 'fighter'
					? game.spawnEnemy('redFighter', x, y)
					: who === 'bleez'
						? game.spawnEnemy('bleez', x, y)
						: game.spawnEnemy('rageGrunt', x, y, who);
			e.brain.grit = TOUGHNESS;
			e.brain.might = MIGHT;
			const tough = who === 'bleez' ? 1.4 : TOUGHNESS;
			e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * tough);
			if (who === 'fighter') this.reloads.set(e, 2 + this.rand() * 2);
			this.wave = this.cleared() ? [e] : [...this.wave, e];
		}
	}

	private cleared(): boolean {
		return this.wave.every((e) => !isStanding(e));
	}

	/** Fighters in range launch torpedoes at the ship, leading it a little. */
	private fireTorpedoes(game: Game, dt: number) {
		if (this.phase === 'online' || this.phase === 'jump') return;
		const s = this.ship;
		for (const e of this.wave) {
			if (!isStanding(e) || e.kind !== 'redFighter') continue;
			const left = (this.reloads.get(e) ?? 0) - dt;
			this.reloads.set(e, left);
			if (left > 0 || Math.hypot(e.x - s.x, e.y - s.y) > TORPEDO_RANGE) continue;
			this.reloads.set(e, TORPEDO_EVERY[0] + this.rand() * (TORPEDO_EVERY[1] - TORPEDO_EVERY[0]));
			this.launchTorpedo(game, e);
		}
	}

	private launchTorpedo(game: Game, from: Enemy) {
		const s = this.ship;
		const moving = this.phase === 'run' ? SHIP_SPEED : 0;
		const eta = Math.hypot(s.x - from.x, s.y - from.y) / TORPEDO.speed;
		const tx = s.x + moving * eta + (this.rand() - 0.5) * 80;
		const ty = s.y + (this.rand() - 0.5) * 30;
		const len = Math.hypot(tx - from.x, ty - from.y) || 1;
		const t: Dummy = {
			kind: 'rageTorpedo',
			x: from.x,
			y: from.y,
			prevX: from.x,
			prevY: from.y,
			vx: ((tx - from.x) / len) * TORPEDO.speed,
			vy: ((ty - from.y) / len) * TORPEDO.speed,
			hp: TORPEDO.hp,
			maxHp: TORPEDO.hp,
			homeX: from.x,
			homeY: from.y,
			caged: 0,
			flash: 0,
			stun: 0,
			down: 0,
			respawns: false,
			gone: false,
			dir: tx > from.x ? 1 : -1,
			drift: { radius: TORPEDO.radius, float: FLOAT, spin: 0, seed: this.rand() }
		};
		game.dummies.push(t);
		this.torpedoes.add(t);
	}

	private updateTorpedoes(game: Game) {
		const s = this.ship;
		for (const t of this.torpedoes) {
			if (!isStanding(t)) {
				if (!this.burst.has(t)) this.torpedoesDowned++;
				game.constructs.effects.push({ kind: 'redImpact', x: t.x, y: t.y, age: 0, life: 0.3, lift: FLOAT });
				t.gone = true;
				this.torpedoes.delete(t);
				continue;
			}
			// Hit the ship? A bubble on it takes the blow
			if (Math.abs(t.x - s.x) < SHIP_HALF_LENGTH + TORPEDO.radius && Math.abs(t.y - s.y) < SHIP_HALF_DEPTH + TORPEDO.radius) {
				const through = this.state === 'playing' ? absorbWithShield(game.constructs, s, TORPEDO.shipDamage) : 0;
				if (through > 0) {
					s.hull = Math.max(0, s.hull - through);
					s.flash = 0.2;
					this.torpedoHits++;
				}
				this.pop(t);
				continue;
			}
			// Hit a Lantern in the way?
			for (const p of game.players) {
				if (p.downed || p.dash) continue;
				if (Math.abs(t.x - p.x) < TORPEDO.radius + 12 && Math.abs(t.y - p.y) < TORPEDO.radius + 12) {
					damagePlayer(game.constructs, p, TORPEDO.lanternDamage, t.x, t.y, 240);
					this.pop(t);
					break;
				}
			}
			// Missed and flew off
			if (!this.burst.has(t) && Math.hypot(t.x - s.x, t.y - s.y) > 1400) {
				t.gone = true;
				this.torpedoes.delete(t);
			}
		}
	}

	/** Burst on something: gone, but not counted as shot down. */
	private pop(t: Dummy) {
		this.burst.add(t);
		t.hp = 0;
		t.down = 0.2;
	}

	/**
	 * How much danger the ship is in from torpedoes about to hit it (see
	 * Mission 1's asteroids): a couple inbound makes it the one to shield.
	 */
	private threatToShip(): number {
		const s = this.ship;
		const moving = this.phase === 'run' ? SHIP_SPEED : 0;
		let threat = 0;
		for (const t of this.torpedoes) {
			if (!isStanding(t)) continue;
			const rx = t.x - s.x;
			const ry = t.y - s.y;
			const vx = t.vx - moving;
			const vy = t.vy;
			const speed2 = vx * vx + vy * vy || 1;
			const time = Math.max(0, Math.min(THREAT_LOOKAHEAD, -(rx * vx + ry * vy) / speed2));
			if (Math.abs(rx + vx * time) > SHIP_HALF_LENGTH + TORPEDO.radius || Math.abs(ry + vy * time) > SHIP_HALF_DEPTH + TORPEDO.radius) continue;
			threat += 1.2 * (1 - (time / THREAT_LOOKAHEAD) * 0.5);
		}
		if (s.hull < s.maxHull * 0.35) threat *= 1.5;
		return threat;
	}

	private countDefeats() {
		for (const e of this.wave) {
			if (!isStanding(e) && !this.counted.has(e)) {
				this.counted.add(e);
				this.defeated++;
			}
		}
	}

	/** Each time Hal goes down costs a life; the last one ends the mission. */
	private countDowns(game: Game) {
		const hal = game.players[0];
		if (hal.downed && !this.wasDown) {
			this.lives--;
			this.downs++;
			if (this.lives <= 0) this.lose(game, 'lantern');
			else this.comms.say('Kilowog', "Up, poozer! The ship won't guard itself!");
		}
		this.wasDown = hal.downed;
	}

	private win(game: Game) {
		this.state = 'won';
		this.timer = 0;
		for (const p of game.players) p.victoryTimer = 0.4;
		const p = game.players[0];
		game.constructs.effects.push({ kind: 'callout', x: p.x, y: p.y, age: 0, life: 2.5, text: 'JUMP!', owner: p });
	}

	private lose(game: Game, reason: 'ship' | 'lantern') {
		this.state = 'lost';
		this.failReason = reason;
		game.downedNotice = false;
		this.comms.clear();
		if (reason === 'ship') {
			const s = this.ship;
			for (let i = 0; i < 7; i++) {
				const x = s.x + (i - 3) * 32;
				game.constructs.effects.push({ kind: 'debris', x, y: s.y, age: 0, life: 0.9 + i * 0.1, radius: 30 + i * 4, lift: FLOAT });
				game.constructs.effects.push({ kind: 'redImpact', x, y: s.y, age: 0, life: 0.4 + i * 0.05, lift: FLOAT });
			}
		}
	}

	// -------------------------------------------------------------- drawing

	cameraPoints(): [number, number][] {
		return [[this.ship.x, this.ship.y - 40]];
	}

	goal(): { x: number; y: number } | null {
		return this.state === 'playing' && this.world ? this.ship : null;
	}

	drawables(ctx: CanvasRenderingContext2D, alpha: number, time: number): Drawable[] {
		const s = this.ship;
		const x = s.prevX + (s.x - s.prevX) * alpha;
		const y = s.prevY + (s.y - s.prevY) * alpha;
		const shield = this.world?.shields.find((sh) => sh.target === s);
		const list: Drawable[] = [
			{
				baseY: y,
				draw: () => {
					const boot = this.phase === 'reboot' ? s.boot : 0;
					drawInterceptor(ctx, x, y, { hull: s.hull / s.maxHull, flash: s.flash, power: s.power, boot, destroyed: this.failReason === 'ship', time });
					if (shield) drawShipShield(ctx, shield, x, y - FLOAT, s.radius, time);
				}
			}
		];
		// Aya's cannon shots, from the ship's nose to what they hit
		for (const sh of this.shots) {
			list.push({ baseY: 1e6, draw: () => drawCannonShot(ctx, x + 80, y - FLOAT - 4, sh.x, sh.y - FLOAT, 1 - sh.age / 0.18) });
		}
		return list;
	}
}
