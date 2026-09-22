// Act 3, Mission 4: Ysmault.
//
// Through the Blood Gate: the Red Lanterns' home world, and the Blood Altar,
// where Atrocitus is drawing the power to open the Book of the Black. Four
// conduits feed it. Hal and John (you choose) and Arisia land in the middle
// of his legion.
//
//   altar     break the four conduits. While any stand, the altar heals every
//             Red Lantern near it, and every so often it throws out a surge of
//             blood across the plain (a warning first: be in the air, or
//             shielded, or far away). Its lake burns anyone who lands in it.
//             The Red Lanterns climb out of blood pools at the edges, and keep
//             coming. Zilius Zox after the first conduit; after the second,
//             Razer arrives (this is his world's shame too); Skallox after
//             the third
//   silence   the last conduit falls, and the altar goes dark... and
//             Atrocitus comes up out of it
//
// Lose: your Lantern goes down 3 times.

import { damagePlayer } from '../combat';
import { hitDummyWithFx } from '../constructs/system';
import { drawBloodAltar, drawBloodPool, drawBloodSurge, drawConduit, drawConduitStump } from '../draw/ysmault';
import { createDummy, isStanding, type Dummy } from '../dummy';
import type { Enemy, EnemyKind, Role } from '../enemies/enemies';
import type { Drawable, Game } from '../game';
import { seededRandom, type GameMap, type Obstacle } from '../map';
import type { Player } from '../player';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

export type AltarPhase = 'altar' | 'silence';

export const ALTAR_LIVES = 3;
const INTRO_TIME = 3;
/** Three stars: done within this many seconds. */
const PAR_TIME = 420;
/** The conduits' health, and the altar's reach. */
export const CONDUIT_HP = 5200;
/** A conduit nobody is near mends itself this share of its health a second. */
const MEND_RATE = 0.012;
const MEND_RANGE = 450;
export const ALTAR_RADIUS = 250;
/** While a conduit stands: Red Lanterns this near the altar heal this share of their health a second (all four standing). */
const HEAL_RANGE = 800;
const HEAL_RATE = 0.05;
/** The lake: burns anyone standing in it (not flying), this much a second. */
const LAKE_BURN = 14;
/** The surge: how often, the warning, how far and how fast it goes, and what it does. */
export const SURGE = { every: 12, warn: 1.4, reach: 1150, time: 2.2, damage: 40, knockback: 560, band: 50 };
/** Red Lanterns: health and might, how often one climbs out of a pool, and how many at most. */
const TOUGHNESS = 4;
const MIGHT = 4.8;
const LIEUTENANT_HEALTH = 5;
const POOL_EVERY = 2.6;
const POOL_CAP = 11;
/** The most one hit can take off a Lantern. */
const MAX_HIT = 36;

const W = 3400;
const H = 2400;
export const ALTAR = { x: 1700, y: 1150 };
const ENTRY = { x: 1700, y: 2150 };
export const CONDUITS = [
	{ x: 900, y: 720 },
	{ x: 2500, y: 720 },
	{ x: 820, y: 1660 },
	{ x: 2580, y: 1660 }
];
const POOLS = [
	{ x: 320, y: 1150 },
	{ x: 3080, y: 1150 },
	{ x: 1700, y: 330 },
	{ x: 420, y: 2050 },
	{ x: 2980, y: 2050 }
];

/** Ysmault: blood-red rock, the altar in the middle, black crags round the edge. */
export function buildYsmaultMap(): GameMap {
	const rand = seededRandom(1666);
	const obstacles: Obstacle[] = [];
	for (let i = 0; i < 40 && obstacles.length < 16; i++) {
		const size = 50 + rand() * 60;
		const x = 200 + rand() * (W - 400);
		const y = 200 + rand() * (H - 400);
		const clear = [ALTAR, ENTRY, ...CONDUITS, ...POOLS].every((p) => Math.hypot(p.x - x, p.y - y) > (p === ALTAR ? 520 : 240));
		if (!clear) continue;
		obstacles.push({ kind: 'rock', x: x - size / 2, y: y - size / 3, w: size, h: size * 0.65, height: size * 1.1, blocksFlying: false, seed: rand() });
	}
	return {
		name: 'Ysmault · The Blood Altar',
		environment: 'planet',
		ground: 'bloodMoon',
		width: W,
		height: H,
		spawn: ENTRY,
		battery: { x: ENTRY.x + 220, y: ENTRY.y - 40 },
		dummies: [],
		obstacles
	};
}

export class YsmaultMission implements MissionDirector {
	state: MissionState = 'intro';
	phase: AltarPhase = 'altar';
	timer = INTRO_TIME;
	lives = ALTAR_LIVES;
	elapsed = 0;
	downs = 0;
	defeated = 0;
	failReason: 'lantern' | null = null;
	readonly comms = new Comms();
	readonly starHint = '★ the altar broken · ★ no lives lost · ★ under 7 minutes';
	readonly conduits: Dummy[] = [];
	razer: Player | null = null;
	/** The surge rolling out: its radius now, and who it has already hit. */
	surge: { r: number; hit: Set<Player> } | null = null;
	private surgeIn = SURGE.every;
	private warn = 0;
	private poolIn = 2;
	private reds: Enemy[] = [];
	private counted = new WeakSet<Enemy>();
	private burnIn = new WeakMap<Player, number>();
	private broken = 0;
	private fallen = new WeakSet<Dummy>();
	private wasDown = false;
	private clock = 0;
	private said = new Set<string>();

	// ------------------------------------------------------------ reporting

	/** How many conduits are still feeding the altar (0..1). */
	get power(): number {
		return this.conduits.length === 0 ? 1 : this.conduits.filter(isStanding).length / CONDUITS.length;
	}

	get objective(): string {
		if (this.phase === 'silence') return 'The altar is dark';
		return `Break the conduits feeding the Blood Altar (${this.broken} / ${CONDUITS.length})`;
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		if (this.phase === 'silence') return [];
		return [{ label: 'Altar', value: this.power, text: `${CONDUITS.length - this.broken} conduits`, low: this.power <= 0.25 }];
	}

	warning(): string | null {
		if (this.warn > 0) return 'BLOOD SURGE: TAKE TO THE AIR OR SHIELD';
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.downs === 0 ? 1 : 0) + (this.elapsed <= PAR_TIME ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'won') return 'The Blood Altar is dark. And out of it, at last, came Atrocitus.';
		return 'Your Lantern went down one time too many, on the Red Lanterns’ own world.';
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		return [
			{ label: 'Red Lanterns beaten', value: `${this.defeated}` },
			{ label: 'Conduits broken', value: `${this.broken} / ${CONDUITS.length}` },
			{ label: 'Lives lost', value: `${this.downs}` },
			{ label: 'Time', value: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
		];
	}

	goal(): { x: number; y: number } | null {
		return this.conduits.find(isStanding) ?? null;
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
					game.constructs.maxHit = MAX_HIT;
					for (const c of CONDUITS) {
						const d = createDummy(c.x, c.y);
						d.kind = 'bloodConduit';
						d.hp = d.maxHp = CONDUIT_HP;
						d.respawns = false;
						game.dummies.push(d);
						this.conduits.push(d);
					}
					this.comms.scene([
						['Atrocitus', 'Green Lanterns. On Ysmault. You bring your little lights to the one place in the universe where they mean nothing.'],
						['John', 'Four spires feeding that lake. Break them and the altar dies.'],
						['Arisia', 'And every Red Lantern on this world is coming to stop us.'],
						['Hal', "Then let's not keep them waiting."]
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
		this.clock += dt;
		this.countDowns(game);
		if (this.state !== 'playing') return;

		if (this.phase === 'silence') {
			for (const p of game.players) p.invuln = Math.max(p.invuln, 1);
			if (!this.comms.current) this.win(game);
			return;
		}
		this.holdConduits(game, dt);
		this.checkConduits(game);
		if (this.phase !== 'altar') return;
		this.heal(dt);
		this.burnLake(game, dt);
		this.surgeTick(game, dt);
		this.climbOut(game, dt);
		if (this.clock > 20) this.once('heal', () => this.comms.say('John', 'The altar is healing them while those spires stand! Break the spires first!', true));
	}

	/** The conduits don't get knocked about, and one left alone mends itself. */
	private holdConduits(game: Game, dt: number) {
		for (const c of this.conduits) {
			c.x = c.prevX = c.homeX;
			c.y = c.prevY = c.homeY;
			c.vx = c.vy = 0;
			c.stun = 0;
			if (!isStanding(c)) continue;
			const near = game.players.some((p) => !p.downed && Math.hypot(p.x - c.x, p.y - c.y) < MEND_RANGE);
			if (!near) c.hp = Math.min(c.maxHp, c.hp + c.maxHp * MEND_RATE * dt);
		}
	}

	private checkConduits(game: Game) {
		const broken = this.conduits.filter((c) => !isStanding(c)).length;
		while (this.broken < broken) {
			this.broken++;
			const c = this.conduits.find((d) => !isStanding(d) && !this.fallen.has(d));
			if (c) {
				this.fallen.add(c);
				game.constructs.effects.push({ kind: 'callout', x: c.x, y: c.y - 240, age: 0, life: 1.8, text: 'CONDUIT BROKEN' });
			}
			this.onBroken(game);
		}
	}

	private onBroken(game: Game) {
		switch (this.broken) {
			case 1:
				this.spawn(game, 'zox', POOLS[2].x, POOLS[2].y + 80);
				this.comms.scene([
					['Atrocitus', 'Zox. Go and remind them where they are.'],
					['Zox', 'ZOX REMEMBERS YOU! ZOX NEVER FORGETS A SNACK!']
				]);
				break;
			case 2: {
				const me = game.players[0];
				this.razer = game.addPartner('razer', me.x - 200, me.y - 240);
				game.constructs.effects.push({ kind: 'callout', x: this.razer.x, y: this.razer.y, age: 0, life: 2, text: 'RAZER', owner: this.razer, hurt: true });
				this.comms.scene([
					['Razer', 'You came to Ysmault without me? This world is my shame too, Lanterns.'],
					['Atrocitus', 'Razer. My prodigal. You will die on the world that made you.'],
					['Razer', 'You made me, Atrocitus. And I am here to unmake you.']
				]);
				break;
			}
			case 3:
				this.spawn(game, 'skallox', POOLS[1].x - 80, POOLS[1].y);
				this.comms.say('Atrocitus', 'Skallox. Break them.', true);
				break;
			case 4:
				this.silence(game);
				break;
		}
	}

	/** The last conduit falls: the altar goes dark, every Red Lantern on the plain drops, and he comes. */
	private silence(game: Game) {
		this.phase = 'silence';
		this.clock = 0;
		this.surge = null;
		this.warn = 0;
		for (const e of game.enemies) {
			if (!isStanding(e)) continue;
			this.counted.add(e);
			hitDummyWithFx(game.constructs, e, e.hp + 1, 600, ALTAR.x, ALTAR.y, null, 0);
		}
		game.constructs.effects.push({ kind: 'callout', x: ALTAR.x, y: ALTAR.y - 200, age: 0, life: 2.6, text: 'THE ALTAR IS DARK' });
		this.comms.clear();
		this.comms.scene([
			['Hal', "That's all four. It's done."],
			['Razer', 'No. Listen.'],
			['Atrocitus', 'You broke my altar. So be it. I needed its blood only to reach the Book, and the Book is already in my hand.'],
			['Atrocitus', 'Come, then. All of you. Every Lantern the Guardians can spare. I have waited ten thousand years to spill your light.'],
			['John', 'He wants all of us.'],
			['Hal', 'Then he gets all of us. Call Oa. Call everyone.']
		]);
	}

	/** Every Red Lantern near the altar heals, faster the more conduits stand. */
	private heal(dt: number) {
		const power = this.power;
		if (power <= 0) return;
		for (const e of this.reds) {
			if (!isStanding(e) || Math.hypot(e.x - ALTAR.x, e.y - ALTAR.y) > HEAL_RANGE) continue;
			e.hp = Math.min(e.maxHp, e.hp + e.maxHp * HEAL_RATE * power * dt);
		}
	}

	/** Land in the lake and it burns. */
	private burnLake(game: Game, dt: number) {
		for (const p of game.players) {
			if (p.downed || p.flying || p.hero) continue;
			if (Math.hypot(p.x - ALTAR.x, (p.y - ALTAR.y) / 0.45) > ALTAR_RADIUS) continue;
			const next = (this.burnIn.get(p) ?? 0) - dt;
			this.burnIn.set(p, next);
			if (next > 0) continue;
			this.burnIn.set(p, 0.5);
			damagePlayer(game.constructs, p, LAKE_BURN * 0.5, ALTAR.x, ALTAR.y, 120);
			this.once('lake', () => this.comms.say('Arisia', 'Out of the blood! Stay in the air!', true));
		}
	}

	/** The altar throws out a surge: a wave rolling across the plain. In the air, it passes under you. */
	private surgeTick(game: Game, dt: number) {
		if (this.surge) {
			this.surge.r += ((SURGE.reach - ALTAR_RADIUS) / SURGE.time) * dt;
			for (const p of game.players) {
				if (p.downed || this.surge.hit.has(p) || p.flying) continue;
				const d = Math.hypot(p.x - ALTAR.x, (p.y - ALTAR.y) / 0.45);
				if (Math.abs(d - this.surge.r) > SURGE.band) continue;
				this.surge.hit.add(p);
				damagePlayer(game.constructs, p, SURGE.damage * (0.5 + this.power), ALTAR.x, ALTAR.y, SURGE.knockback);
			}
			if (this.surge.r >= SURGE.reach) this.surge = null;
			return;
		}
		this.surgeIn -= dt;
		if (this.warn === 0 && this.surgeIn <= SURGE.warn) {
			this.warn = 0.01;
			game.constructs.effects.push({ kind: 'callout', x: ALTAR.x, y: ALTAR.y - 180, age: 0, life: SURGE.warn, text: 'SURGE', hurt: true });
			this.once('surge', () => this.comms.say('Razer', 'The altar! When it swells, get off the ground!', true));
		}
		if (this.surgeIn > 0) return;
		this.surgeIn = SURGE.every;
		this.warn = 0;
		this.surge = { r: ALTAR_RADIUS, hit: new Set() };
	}

	/** Red Lanterns climb out of the pools at the edges, as long as the altar stands. */
	private climbOut(game: Game, dt: number) {
		this.poolIn -= dt;
		if (this.poolIn > 0) return;
		this.poolIn = POOL_EVERY;
		if (this.reds.filter(isStanding).length >= POOL_CAP) return;
		const pool = POOLS[Math.floor(Math.random() * POOLS.length)];
		const roles: Role[] = ['berserker', 'hunter', 'gunner'];
		this.spawn(game, 'rageGrunt', pool.x + (Math.random() - 0.5) * 60, pool.y + (Math.random() - 0.5) * 30, roles[Math.floor(Math.random() * 3)]);
	}

	private spawn(game: Game, kind: EnemyKind, x: number, y: number, role: Role = 'berserker'): Enemy {
		const e = game.spawnEnemy(kind, x, y, role);
		const lieutenant = kind === 'zox' || kind === 'skallox';
		e.brain.grit = TOUGHNESS;
		e.brain.might = MIGHT;
		e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * (lieutenant ? LIEUTENANT_HEALTH : TOUGHNESS));
		e.brain.alert = 10;
		this.reds.push(e);
		return e;
	}

	private once(key: string, run: () => void) {
		if (this.said.has(key)) return;
		this.said.add(key);
		run();
	}

	private countDefeats() {
		for (const e of this.reds) {
			if (!isStanding(e) && !this.counted.has(e)) {
				this.counted.add(e);
				this.defeated++;
			}
		}
	}

	private countDowns(game: Game) {
		const me = game.players[0];
		if (me.downed && !this.wasDown) {
			this.lives--;
			this.downs++;
			if (this.lives <= 0) {
				this.state = 'lost';
				this.failReason = 'lantern';
				game.downedNotice = false;
				this.comms.clear();
			} else this.comms.say('Arisia', 'Get up! Not here, not on this world!');
		}
		this.wasDown = me.downed;
	}

	private win(game: Game) {
		this.state = 'won';
		this.timer = 0;
		for (const p of game.players) p.victoryTimer = 0.4;
	}

	// -------------------------------------------------------------- drawing

	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		const power = this.phase === 'silence' ? 0 : this.power;
		const list: Drawable[] = [{ baseY: ALTAR.y - 60, draw: () => drawBloodAltar(ctx, ALTAR.x, ALTAR.y, ALTAR_RADIUS, time, power) }];
		POOLS.forEach((p, i) => list.push({ baseY: p.y - 30, draw: () => drawBloodPool(ctx, p.x, p.y, time, i * 0.37) }));
		// Before the fight starts the conduits aren't targets yet, but they're there
		const spots = this.conduits.length ? this.conduits : CONDUITS.map((c) => ({ ...c, hp: CONDUIT_HP, maxHp: CONDUIT_HP, down: 0, gone: false }) as unknown as Dummy);
		for (const c of spots) {
			const up = isStanding(c);
			list.push({ baseY: c.y, draw: () => (up ? drawConduit(ctx, c.x, c.y, ALTAR.x, ALTAR.y, time, c.hp / c.maxHp) : drawConduitStump(ctx, c.x, c.y)) });
		}
		const s = this.surge;
		if (s) list.push({ baseY: ALTAR.y + 1, draw: () => drawBloodSurge(ctx, ALTAR.x, ALTAR.y, s.r, (s.r - ALTAR_RADIUS) / (SURGE.reach - ALTAR_RADIUS)) });
		return list;
	}
}
