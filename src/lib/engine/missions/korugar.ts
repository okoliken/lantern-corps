// Season two, Act 1, mission 4: Korugar. Hal, with Kilowog.
//
// Sinestro's home world, kept "safe" by terror: his own police, his statue
// over the square, people who look at the ground when a Lantern flies past.
// The Guardians have ordered him brought in, and they have sent Hal.
//
//   streets   through the capital to the palace. Sinestro's Enforcers hold
//             three squares on the way; each comes alive as Hal gets close.
//   palace    under his own statue, Sinestro will not come quietly. He fights
//             with everything a Green Lantern has, and his guard with him.
//   judgement beaten down to the last of his strength, the Guardians reach
//             across space and take the ring. He is exiled. He has a few words
//             for Hal before he goes.
//
// Lose: Hal goes down 3 times.

import { isStanding } from '../dummy';
import type { Enemy, Role } from '../enemies/enemies';
import { colonist, drawColonist } from '../draw/colony';
import { drawLantern, type Figure } from '../draw/lantern';
import type { Drawable, Game } from '../game';
import { seededRandom, type GameMap, type Obstacle } from '../map';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

export type KorugarPhase = 'streets' | 'palace' | 'judgement';

const LIVES = 3;
const INTRO_TIME = 3;
/** Enforcers: tougher than the lab's and they hit hard. */
const TOUGHNESS = 5.5;
const MIGHT = 2.9;
/** Sinestro here: the best Lantern in the Corps, fighting for his world. */
const SINESTRO_HEALTH = 4.2;
const SINESTRO_MIGHT = 3.2;
/** At this much health left, the Guardians step in. */
const JUDGEMENT_AT = 0.25;
const JUDGEMENT_TIME = 7;
/** How close Hal gets to a square before its Enforcers move. */
const WAKE_RANGE = 650;
/** ...or this many seconds after the square before it falls: they come looking for you. */
const WAKE_ANYWAY = 6;
/** Enforcers who pull back to regroup don't go further than this from their square (or a square could never be cleared). */
const LEASH = 650;
const LEASH_PULL = 420;

const W = 3800;
const H = 2000;
const SPAWN = { x: 350, y: 1000 };
const SQUARES = [
	{ x: 1150, y: 1000 },
	{ x: 1950, y: 700 },
	{ x: 2600, y: 1250 }
];
/** The palace plaza, under the statue. */
const PLAZA = { x: 3250, y: 1000 };
const STATUE = { x: 3550, y: 820 };

type Wave = [Role | 'sinestro', number, number][];
const SQUARE_WAVES: Wave[] = [
	[
		['berserker', 120, -160],
		['gunner', 260, 80],
		['hunter', 140, 220],
		['gunner', 320, -60]
	],
	[
		['hunter', -120, -140],
		['berserker', 160, 120],
		['gunner', 300, -80],
		['gunner', 280, 220],
		['berserker', 60, 260]
	],
	[
		['berserker', -100, -200],
		['hunter', 160, -120],
		['hunter', 160, 200],
		['gunner', 320, 0],
		['gunner', 300, -260],
		['berserker', 40, 160]
	]
];
const PALACE: Wave = [
	['sinestro', 0, 0],
	['gunner', 160, -300],
	['gunner', 160, 300],
	['hunter', 260, 0],
	['berserker', -200, -250]
];

interface Square {
	x: number;
	y: number;
	woke: boolean;
	wave: Enemy[];
}

/** A few people out in the streets, too scared to go home or to look up. */
interface Bystander {
	x: number;
	y: number;
	fig: Figure;
	dir: 1 | -1;
}

/** Korugar's capital: west to east from the landing field to the palace, blocks of stone towers either side. */
export function buildKorugarMap(): GameMap {
	const rand = seededRandom(6161);
	const obstacles: Obstacle[] = [];
	const towers: [number, number, number, number][] = [
		[700, 250, 220, 160],
		[700, 1560, 220, 160],
		[1500, 300, 200, 150],
		[1450, 1450, 240, 170],
		[2250, 250, 220, 150],
		[2250, 1550, 200, 160],
		[2900, 300, 200, 150],
		[2950, 1600, 220, 150]
	];
	for (const [x, y, w, h] of towers) obstacles.push({ kind: 'building', x, y, w, h, height: 110 + rand() * 70, blocksFlying: false, seed: rand() });
	return {
		name: 'Korugar',
		environment: 'planet',
		ground: 'korugar',
		width: W,
		height: H,
		spawn: SPAWN,
		battery: { x: 520, y: 760 },
		dummies: [],
		obstacles
	};
}

export class KorugarMission implements MissionDirector {
	state: MissionState = 'intro';
	phase: KorugarPhase = 'streets';
	timer = INTRO_TIME;
	lives = LIVES;
	elapsed = 0;
	downs = 0;
	defeated = 0;
	failReason: 'lantern' | null = null;
	/** Seconds the fight with Sinestro took. */
	duel = 0;
	readonly comms = new Comms();
	readonly squares: Square[] = SQUARES.map((s) => ({ ...s, woke: false, wave: [] }));
	readonly starHint = '★ done · ★ Hal never went down · ★ Sinestro beaten in under 2 minutes';
	sinestro: Enemy | null = null;
	private guard: Enemy[] = [];
	private all: Enemy[] = [];
	private counted = new WeakSet<Enemy>();
	private judgementLeft = JUDGEMENT_TIME;
	/** Seconds since the last square fell, before the next one wakes on its own. */
	private waiting = 0;
	private wasDown = false;
	private said = new Set<string>();
	private bystanders: Bystander[] = [];

	constructor(seed = 41) {
		const rand = seededRandom(seed);
		for (let i = 0; i < 10; i++) {
			const x = 600 + rand() * 2600;
			const y = rand() < 0.5 ? 430 + rand() * 120 : 1430 + rand() * 120;
			this.bystanders.push({ x, y, fig: colonist(80 + i), dir: rand() < 0.5 ? 1 : -1 });
		}
	}

	// ------------------------------------------------------------ reporting

	get cleared(): number {
		return this.squares.filter((s) => s.woke && s.wave.every((e) => !isStanding(e))).length;
	}

	get objective(): string {
		if (this.phase === 'streets') return `Fight through to the palace (${this.cleared} / ${this.squares.length} squares)`;
		if (this.phase === 'palace') return 'Bring Sinestro in';
		return 'The Guardians are here';
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const list: MissionMeter[] = [];
		const s = this.sinestro;
		if (s && this.phase !== 'streets') list.push({ label: 'Sinestro', value: Math.max(0, s.hp) / s.maxHp, text: `${Math.round((Math.max(0, s.hp) / s.maxHp) * 100)}%` });
		const near = this.squares.find((q) => q.woke && q.wave.some(isStanding));
		if (near) {
			const left = near.wave.filter(isStanding).length;
			list.push({ label: 'Police', value: left / near.wave.length, text: `${left} left` });
		}
		return list;
	}

	warning(): string | null {
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.downs === 0 ? 1 : 0) + (this.duel <= 120 ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'won') return 'Sinestro of Korugar is stripped of his ring and sent into exile. Korugar does not know what to do with itself.';
		return 'Hal went down one time too many.';
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		const d = Math.round(this.duel);
		return [
			{ label: 'Enforcers beaten', value: `${this.defeated}` },
			{ label: 'Fight with Sinestro', value: `${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}` },
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
					this.comms.scene([
						['Kilowog', "Korugar. Look at 'em, Jordan. Nobody even looks up."],
						['Hal', 'His face on every wall. His police on every corner.'],
						['Guardian', 'Bring him to Oa, Lantern Jordan. By force, if he insists.']
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
			case 'streets':
				for (const [i, sq] of this.squares.entries()) {
					if (sq.woke) continue;
					// A square comes alive once the one before it is done: when Hal gets close, or after a moment anyway
					const before = i === 0 || (this.squares[i - 1].woke && this.squares[i - 1].wave.every((e) => !isStanding(e)));
					if (!before) continue;
					this.waiting += dt;
					if (Math.hypot(hal.x - sq.x, hal.y - sq.y) < WAKE_RANGE || (i > 0 && this.waiting > WAKE_ANYWAY)) {
						this.waiting = 0;
						this.wake(game, i);
					}
					break;
				}
				this.leash(dt);
				if (this.cleared === this.squares.length) this.startPalace(game);
				break;
			case 'palace': {
				this.duel += dt;
				const s = this.sinestro;
				if (s && s.hp <= s.maxHp * JUDGEMENT_AT) this.startJudgement(game);
				else if (s && s.hp < s.maxHp * 0.6) this.once('half', 'Sinestro', 'You fight like a test pilot, Jordan. All nerve, no discipline.');
				break;
			}
			case 'judgement':
				this.judgementLeft -= dt;
				if (this.sinestro) {
					this.sinestro.vx = this.sinestro.vy = 0;
					this.sinestro.stun = 1;
				}
				if (this.judgementLeft <= 0) this.win(game);
				break;
		}
	}

	/** Stragglers drift back toward their square. */
	private leash(dt: number) {
		for (const sq of this.squares) {
			for (const e of sq.wave) {
				if (!isStanding(e)) continue;
				const d = Math.hypot(sq.x - e.x, sq.y - e.y);
				if (d < LEASH) continue;
				e.vx += ((sq.x - e.x) / d) * LEASH_PULL * dt;
				e.vy += ((sq.y - e.y) / d) * LEASH_PULL * dt;
			}
		}
	}

	private wake(game: Game, i: number) {
		const sq = this.squares[i];
		sq.woke = true;
		sq.wave = this.spawn(game, SQUARE_WAVES[i], sq.x, sq.y);
		const lines: [string, string][][] = [
			[
				['Enforcer', 'Green Lanterns! Under the order of Sinestro, turn back!'],
				['Hal', "I'm here for him, not you. Stand down."]
			],
			[['Kilowog', "They don't stand down, do they? Poor poozers are more scared of him than us."]],
			[['Enforcer', 'The palace is closed! Hold the line, hold the line!']]
		];
		this.comms.scene(lines[i]);
	}

	private startPalace(game: Game) {
		this.phase = 'palace';
		const spawned = this.spawn(game, PALACE, PLAZA.x, PLAZA.y);
		this.sinestro = spawned.find((e) => e.kind === 'sinestro') ?? null;
		this.guard = spawned.filter((e) => e.kind !== 'sinestro');
		this.comms.scene([
			['Sinestro', 'Jordan. Kilowog. Have you come to admire my world?'],
			['Hal', "The Guardians want you on Oa, Sinestro. They've seen what you've done here."],
			['Sinestro', 'What I have done here is end crime, war and fear of the dark. Look around you.'],
			['Sinestro', 'No. I think not. If they want my ring, let them come and take it.']
		]);
	}

	private startJudgement(game: Game) {
		this.phase = 'judgement';
		this.judgementLeft = JUDGEMENT_TIME;
		// Everyone stops: the Guardians are here
		game.freezeEnemies = true;
		for (const e of this.guard) if (isStanding(e)) e.stun = 99;
		this.comms.scene([
			['Guardian', 'Enough. Sinestro of Korugar, you are relieved of the ring and exiled from the Corps.'],
			['Sinestro', 'You will understand one day, Jordan. Fear is the only thing that keeps people in line.'],
			['Sinestro', 'And when you do, I will be waiting.']
		]);
	}

	private spawn(game: Game, wave: Wave, x: number, y: number): Enemy[] {
		const out = wave.map(([role, dx, dy]) => {
			const ex = Math.max(80, Math.min(W - 80, x + dx));
			const ey = Math.max(120, Math.min(H - 80, y + dy));
			const sinestro = role === 'sinestro';
			const e = sinestro ? game.spawnEnemy('sinestro', ex, ey) : game.spawnEnemy('enforcer', ex, ey, role);
			e.brain.grit = sinestro ? 1 : TOUGHNESS;
			e.brain.might = sinestro ? SINESTRO_MIGHT : MIGHT;
			e.brain.alert = 10;
			e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * (sinestro ? SINESTRO_HEALTH : TOUGHNESS));
			return e;
		});
		this.all.push(...out);
		return out;
	}

	private countDefeats() {
		for (const e of this.all) {
			if (e.kind === 'sinestro') continue;
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
		const hal = game.players[0];
		if (hal.downed && !this.wasDown) {
			this.lives--;
			this.downs++;
			if (this.lives <= 0) this.lose(game);
			else this.comms.say('Kilowog', 'Up, Jordan! He wants you on your knees, don\'t give him that!', true);
		}
		this.wasDown = hal.downed;
	}

	private win(game: Game) {
		this.state = 'won';
		this.timer = 0;
		game.freezeEnemies = false;
		// The ring is gone: Sinestro is out of the fight
		if (this.sinestro) {
			this.sinestro.hp = 0;
			this.sinestro.down = 1;
		}
		for (const e of this.guard) {
			e.hp = 0;
			e.down = 1;
		}
		for (const p of game.players) p.victoryTimer = 0.4;
		this.comms.scene([
			['Kilowog', "It's done. Never thought I'd see that ring come off him."],
			['Hal', "He wasn't wrong about one thing. They're not scared of the dark any more."],
			['Hal', "They're scared of him."]
		]);
	}

	private lose(game: Game) {
		this.state = 'lost';
		this.failReason = 'lantern';
		game.downedNotice = false;
	}

	// -------------------------------------------------------------- drawing

	cameraPoints(): [number, number][] {
		return this.phase === 'streets' ? [] : [[STATUE.x, STATUE.y - 120]];
	}

	goal(): { x: number; y: number } | null {
		if (this.state !== 'playing') return null;
		if (this.phase !== 'streets') return this.sinestro ? { x: this.sinestro.x, y: this.sinestro.y } : PLAZA;
		const fighting = this.squares.find((q) => q.woke && q.wave.some(isStanding));
		if (fighting) return fighting.wave.find(isStanding)!;
		return this.squares.find((q) => !q.woke) ?? PLAZA;
	}

	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		const list: Drawable[] = [];
		// His statue over the plaza: grey stone, twice the height of a tower
		list.push({ baseY: STATUE.y + 40, draw: () => drawStatue(ctx, STATUE.x, STATUE.y, time) });
		for (const b of this.bystanders) list.push({ baseY: b.y, draw: () => drawColonist(ctx, b.fig, b.x, b.y, b.dir, false, time) });
		return list;
	}
}

/** Sinestro in stone on a pedestal, arms folded behind him by the look of it. */
function drawStatue(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
	ctx.save();
	// Pedestal
	ctx.fillStyle = '#3a3044';
	ctx.strokeStyle = '#0b0610';
	ctx.lineWidth = 5;
	ctx.fillRect(x - 90, y - 40, 180, 80);
	ctx.strokeRect(x - 90, y - 40, 180, 80);
	ctx.fillStyle = '#4b3f57';
	ctx.fillRect(x - 110, y + 20, 220, 26);
	ctx.strokeRect(x - 110, y + 20, 220, 26);
	// The figure, three times life size, carved in grey stone (drawn in stone colours, not filtered: cheap every frame)
	ctx.translate(x, y - 40);
	ctx.scale(2.8, 2.8);
	drawLantern(ctx, STONE_SINESTRO, 0, 0, { dir: -1, walkPhase: 0, altitude: 0, hoverHeight: 8, lean: 0, glow: false, shadow: false, firing: false, aimX: -1, aimY: 0 }, time * 0, 1.12);
	ctx.restore();
}

/** Sinestro's shape (the widow's peak, the mustache) in carved stone. */
const STONE_SINESTRO: Figure = {
	id: 'statue',
	look: { skin: '#8d8796', hair: '#6c6676', hairStyle: 'peak', mask: false, mustache: true },
	outfit: { top: '#7b7585', topLit: '#a39dad', trousers: '#6a6474', boots: '#585262' },
	bulk: 0.95
};
