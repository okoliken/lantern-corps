// Act 1, Mission 5: Razer (the act's boss).
//
// Razer's fortress on the far side of the Prison Moon. While Katma Tui and the
// freed Lanterns get the last prisoners out of the fortress cells, Hal and
// Kilowog take on Razer:
//
//   guards   Razer watches from his dais while his Red Lanterns fight
//   duel     then he comes down himself, and the fight gets harder as he does:
//              phase 1  Twin Rage Blades, Crimson Chakram, Rage Tether, Rage Mace,
//                       Rage Shield
//              phase 2  (below 60%) + Construct Shatter, Rage Brand, Rage Plasma,
//                       Blood Meteors
//              phase 3  (below 30%) berserk: faster and stronger, + Blade Storm,
//                       Crimson Nova and the Rage Beam
//   captured with almost nothing left, a Green Lantern cage closes round him;
//            he gives up the name of his master: Atrocitus
//
// Lose: Hal goes down 3 times.

import { isStanding } from '../dummy';
import { createEnemy, type Enemy, type Role } from '../enemies/enemies';
import type { AbilityId } from '../enemies/redConstructs';
import { drawLieutenant } from '../draw/lieutenants';
import { drawCage, drawDais, drawSpire } from '../draw/prison';
import type { Drawable, Game } from '../game';
import { seededRandom, type GameMap, type Obstacle } from '../map';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

export type RazerPhase = 'guards' | 'descent' | 'duel' | 'captured';

export const RAZER_LIVES = 3;
const INTRO_TIME = 3;
/** Three stars: done within this many seconds. */
const PAR_TIME = 300;
/** His Red Lanterns (like the Prison Moon's). */
const TOUGHNESS = 4;
const MIGHT = 3;
/** Razer himself: health and hitting power on top of his base. */
export const RAZER_HEALTH = 3.4;
const RAZER_MIGHT = 2.4;
/** Health left (0..1) where each phase begins, and where he's caught. */
export const PHASE_2 = 0.6;
export const PHASE_3 = 0.3;
export const CAPTURE_AT = 0.04;
/** Seconds between the guards falling and Razer coming down. */
const DESCENT_TIME = 2.5;

/** His kit in each phase: it only grows. */
const KITS: Record<1 | 2 | 3, AbilityId[]> = {
	1: ['twinBlades', 'chakram', 'chain', 'mace', 'redShield'],
	2: ['twinBlades', 'chakram', 'chain', 'mace', 'redShield', 'shatter', 'brand', 'vomit', 'meteors'],
	3: ['twinBlades', 'chakram', 'chain', 'mace', 'redShield', 'shatter', 'brand', 'vomit', 'meteors', 'razerStorm', 'crimsonNova', 'beam']
};

const W = 3200;
const H = 1800;
const ENTRY = { x: 460, y: 900 };
const DAIS = { x: 2500, y: 880 };

type Wave = [Role, number, number][];
/** Razer's guard: they come at you across the courtyard. */
const GUARDS: Wave = [
	['berserker', -500, -200],
	['berserker', -540, 220],
	['hunter', -380, -380],
	['hunter', -420, 360],
	['gunner', -260, 0]
];

/** Razer's courtyard: open ground with pillars for cover, the dais at the far end. */
export function buildRazerMap(): GameMap {
	const rand = seededRandom(666);
	const obstacles: Obstacle[] = [];
	// Two rows of great boulders down the courtyard: cover from chakrams and blasts
	for (const x of [1050, 1500, 1950]) {
		for (const y of [520, 1250]) {
			const size = 90 + rand() * 30;
			obstacles.push({ kind: 'rock', x: x - size / 2, y: y - size * 0.3, w: size, h: size * 0.6, height: 40, blocksFlying: false, seed: rand() });
		}
	}
	for (let i = 0; i < 12; i++) {
		const size = 26 + rand() * 30;
		const x = 700 + rand() * 1600;
		const y = 250 + rand() * 1300;
		const o: Obstacle = { kind: 'rock', x, y, w: size, h: size * 0.55, height: 10 + size * 0.2, blocksFlying: false, seed: rand() };
		if (!obstacles.some((b) => x < b.x + b.w + 40 && x + size + 40 > b.x && y < b.y + b.h + 40 && y + size + 40 > b.y)) obstacles.push(o);
	}
	return {
		name: "Razer's Fortress",
		environment: 'planet',
		ground: 'bloodMoon',
		width: W,
		height: H,
		spawn: ENTRY,
		battery: { x: ENTRY.x - 180, y: ENTRY.y - 40 },
		dummies: [],
		obstacles
	};
}

export class RazerBoss implements MissionDirector {
	state: MissionState = 'intro';
	phase: RazerPhase = 'guards';
	/** 1-3 once he's fighting. */
	stage: 1 | 2 | 3 = 1;
	timer = INTRO_TIME;
	lives = RAZER_LIVES;
	elapsed = 0;
	downs = 0;
	defeated = 0;
	failReason: 'lantern' | null = null;
	readonly comms = new Comms();
	readonly starHint = '★ Razer captured · ★ no lives lost · ★ under 5 minutes';
	/** The real Razer, once he's come down to fight. */
	razer: Enemy | null = null;
	private wave: Enemy[] = [];
	private counted = new WeakSet<Enemy>();
	private wasDown = false;
	private descent = 0;
	/** How Razer is drawn while he's only watching, and once he's caught. */
	private figure: Enemy;
	private caughtAt = { x: DAIS.x, y: DAIS.y };
	private spires: [number, number, number, number][] = [];

	constructor(seed = 9) {
		this.figure = createEnemy('razer', DAIS.x, DAIS.y);
		this.figure.dir = -1;
		const rand = seededRandom(seed);
		for (let i = 0; i < 16; i++) {
			const x = 250 + rand() * (W - 400);
			const y = rand() < 0.5 ? 170 + rand() * 120 : H - 300 + rand() * 120;
			this.spires.push([x, y, 90 + rand() * 120, rand()]);
		}
		for (const [dx, dy] of [
			[-190, -70],
			[190, -70],
			[-170, 90],
			[170, 90]
		]) {
			this.spires.push([DAIS.x + dx, DAIS.y + dy, 130, rand()]);
		}
	}

	// ------------------------------------------------------------ reporting

	get objective(): string {
		switch (this.phase) {
			case 'guards':
				return "Beat Razer's guard";
			case 'descent':
				return 'Razer is coming';
			case 'duel':
				return this.stage === 3 ? 'Razer is berserk: survive and finish it' : 'Defeat Razer';
			case 'captured':
				return 'Razer';
		}
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const r = this.razer;
		if (this.phase === 'duel' && r) {
			const hp = r.hp / r.maxHp;
			const label = this.stage === 3 ? 'Berserk' : `Phase ${this.stage}`;
			return [{ label: 'Razer', value: hp, text: label, low: this.stage === 3 }];
		}
		const left = this.wave.filter(isStanding).length;
		if (left > 0) return [{ label: 'Reds', value: left / Math.max(1, this.wave.length), text: `${left} left` }];
		return [];
	}

	warning(): string | null {
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.downs === 0 ? 1 : 0) + (this.elapsed <= PAR_TIME ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'won') return 'Razer is caught, and the Corps has a name: Atrocitus. End of Act 1.';
		return 'Hal went down one time too many.';
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		return [
			{ label: 'Red Lanterns beaten', value: `${this.defeated}` },
			{ label: 'Lives lost', value: `${this.downs}` },
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
					this.spawnGuards(game);
					this.comms.scene([
						['Katma Tui', "We'll get the prisoners out of the fortress cells. Keep Razer busy."],
						['Razer', 'Green Lanterns. You freed my prisoners. Now you will take their place.'],
						['Kilowog', "Big talk from a guy hidin' behind his soldiers, poozer."]
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

		switch (this.phase) {
			case 'guards':
				if (this.wave.every((e) => !isStanding(e))) {
					this.phase = 'descent';
					this.descent = 0;
					this.comms.say('Razer', 'Useless. Must I do everything myself?', true);
				}
				break;
			case 'descent':
				this.descent += dt;
				if (this.descent >= DESCENT_TIME) this.razerFights(game);
				break;
			case 'duel':
				this.duel(game);
				break;
			case 'captured':
				if (!this.comms.current) this.win(game);
				break;
		}
	}

	private spawnGuards(game: Game) {
		this.wave = GUARDS.map(([role, dx, dy]) => {
			const e = game.spawnEnemy('rageGrunt', DAIS.x + dx, DAIS.y + dy, role);
			e.brain.grit = TOUGHNESS;
			e.brain.might = MIGHT;
			e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * TOUGHNESS);
			return e;
		});
	}

	/** Down from the dais, and into the fight. */
	private razerFights(game: Game) {
		this.phase = 'duel';
		this.stage = 1;
		const e = game.spawnEnemy('razer', DAIS.x - 120, DAIS.y);
		e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * RAZER_HEALTH);
		e.brain.might = RAZER_MIGHT;
		e.brain.kit = [...KITS[1]];
		this.razer = e;
	}

	private duel(game: Game) {
		const e = this.razer!;
		const hp = e.hp / e.maxHp;
		// Beaten, not killed: a Green Lantern cage closes round him
		if (hp <= CAPTURE_AT || !isStanding(e)) {
			this.capture(game, e);
			return;
		}
		if (this.stage === 1 && hp <= PHASE_2) {
			this.stage = 2;
			e.brain.kit = [...KITS[2]];
			// A moment to steady himself: his cooldowns come back fresh
			for (const id of KITS[2]) e.brain.cooldowns[id] = Math.min(e.brain.cooldowns[id], 0.6);
			game.constructs.effects.push({ kind: 'callout', x: e.x, y: e.y - 150, age: 0, life: 1.8, text: 'ENOUGH!', hurt: true });
			this.comms.say('Razer', 'Your rings are nothing. Let me show you what rage can break.', true);
		}
		if (this.stage === 2 && hp <= PHASE_3) {
			this.stage = 3;
			e.brain.kit = [...KITS[3]];
			e.brain.might *= 1.25;
			e.brain.speedMul *= 1.25;
			for (const id of KITS[3]) e.brain.cooldowns[id] = Math.min(e.brain.cooldowns[id], 0.6);
			game.constructs.effects.push({ kind: 'callout', x: e.x, y: e.y - 150, age: 0, life: 2, text: 'BERSERK', hurt: true });
			this.comms.scene([
				['Razer', 'For HER! For everything they took!'],
				['Kilowog', "He's gone berserk! Watch for the big one, poozer: when he glows, get clear or shield!"]
			]);
		}
	}

	/** Caught: he's lifted out of the fight into a cage, and he talks. */
	private capture(game: Game, e: Enemy) {
		this.phase = 'captured';
		this.caughtAt = { x: e.x, y: e.y };
		// Out of the fight for good (drawn in his cage from here)
		const i = game.dummies.indexOf(e);
		if (i >= 0) game.dummies.splice(i, 1);
		for (const s of [...game.constructs.red.shots]) if (s.owner === e) game.constructs.red.shots.splice(game.constructs.red.shots.indexOf(s), 1);
		game.constructs.red.chains = game.constructs.red.chains.filter((c) => c.owner !== e);
		game.constructs.red.strikes = [];
		game.constructs.effects.push({ kind: 'snap', x: e.x, y: e.y, age: 0, life: 0.6, radius: 70 });
		game.constructs.effects.push({ kind: 'callout', x: e.x, y: e.y - 160, age: 0, life: 2, text: 'RAZER CAPTURED' });
		for (const p of game.players) p.victoryTimer = 0.4;
		this.comms.scene([
			['Razer', 'Finish it, Lantern. Or are you too weak?'],
			['Hal', "We don't kill prisoners. That's the difference between us."],
			['Kilowog', "Who sent you, Razer? Who's givin' the orders?"],
			['Razer', 'Atrocitus. Lord of the Red Lanterns. He remembers what your Guardians did to Sector 666...'],
			['Razer', '...and he will burn Oa to the ground for it.'],
			['Hal', 'Then we get to him first.']
		]);
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
			if (this.lives <= 0) this.lose(game);
			else this.comms.say('Kilowog', "Get up, poozer! He's not done with us yet!");
		}
		this.wasDown = hal.downed;
	}

	private win(game: Game) {
		this.state = 'won';
		this.timer = 0;
		for (const p of game.players) p.victoryTimer = 0.4;
	}

	private lose(game: Game) {
		this.state = 'lost';
		this.failReason = 'lantern';
		game.downedNotice = false;
		this.comms.clear();
	}

	// -------------------------------------------------------------- drawing

	cameraPoints(): [number, number][] {
		// Keep him in view while he watches, and while he comes down
		if (this.phase === 'guards' || this.phase === 'descent') return [[DAIS.x, DAIS.y - 60]];
		return [];
	}

	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		const list: Drawable[] = [];
		list.push({ baseY: DAIS.y - 60, draw: () => drawDais(ctx, DAIS.x, DAIS.y, time) });
		for (const [x, y, h, seed] of this.spires) list.push({ baseY: y, draw: () => drawSpire(ctx, x, y, h, seed, time) });
		const f = this.figure;
		if (this.phase === 'guards' || this.phase === 'descent') {
			// On the dais, watching; he rises as he gets ready to come down
			const rise = this.phase === 'descent' ? Math.min(1, this.descent / DESCENT_TIME) : 0;
			f.brain.air = rise * 0.6;
			f.brain.rage = 0.3 + rise;
			list.push({ baseY: DAIS.y, draw: () => drawLieutenant(ctx, f, DAIS.x, DAIS.y, true, time) });
		} else if (this.phase === 'captured') {
			const { x, y } = this.caughtAt;
			f.brain.air = 0;
			f.brain.rage = 0.2;
			f.hp = f.maxHp;
			list.push({ baseY: y, draw: () => drawCage(ctx, x, y, 'green', () => drawLieutenant(ctx, f, x, y, true, time), 1, 0, time, 0.3) });
		}
		return list;
	}
}
