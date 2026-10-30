// Season two, Act 3, mission 10: The Rings Go Out. Hal, with Kilowog.
//
// Yellow rings are out across the sectors, and the Sinestro Corps is hunting
// Green Lanterns. On Graxos IV three of them are down with drained rings,
// and hunters are closing in on each.
//
//   rescue   three Lanterns, spread over the moon, every one of them hunted.
//            The hunters wear each one down; drive them off her, then stay
//            close a few seconds to charge her ring, and she flies out. You
//            can't charge a ring with hunters on top of her. Pick who first.
//   arkillo  the hunters' sergeant comes down himself: Arkillo, the Sinestro
//            Corps' answer to Kilowog.
//
// Lose: Hal goes down 3 times, or every Lantern is lost.

import { drawWashed } from '../draw/wash';
import { isStanding } from '../dummy';
import type { Enemy, Role } from '../enemies/enemies';
import type { Drawable, Game } from '../game';
import { LANTERNS, type PrisonerId } from '../lanterns';
import { seededRandom, type GameMap, type Obstacle } from '../map';
import { drawLantern } from '../draw/lantern';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

export type RingsPhase = 'rescue' | 'arkillo';

const LIVES = 3;
const INTRO_TIME = 3;
const HUNTER_TOUGHNESS = 3;
const HUNTER_MIGHT = 4.6;
const ARKILLO_HEALTH = 3.6;
const ARKILLO_MIGHT = 4.2;
/** A stranded Lantern: how much they can take, and how fast each hunter close by wears them down. */
export const STRANDED_HP = 100;
export const HUNTER_DRAIN = { range: 320, perSecond: 0.45 };
/** Charging a drained ring: how close, and how long (it keeps what's been done if you step away). */
export const RESCUE_RANGE = 200;
export const RESCUE_TIME = 4;
/** No charging while a hunter is this close to her. */
export const CHARGE_BLOCK = 320;
/** Hunters keep coming for anyone not yet out. */
const REINFORCE_EVERY = 20;
const FLY_OUT_TIME = 2.5;

const W = 3600;
const H = 2000;
const SPAWN = { x: 420, y: 1000 };
const ARENA = { x: 2900, y: 1000 };

interface Stranded {
	id: PrisonerId;
	x: number;
	y: number;
	hp: number;
	/** Ring charged, 0..1. */
	charge: number;
	hunted: boolean;
	state: 'down' | 'out' | 'lost';
	/** Seconds since they flew out. */
	flying: number;
}

const STRANDED: Pick<Stranded, 'id' | 'x' | 'y'>[] = [
	{ id: 'katma', x: 1250, y: 620 },
	{ id: 'boodikka', x: 1750, y: 1480 },
	{ id: 'arisia', x: 2550, y: 700 }
];

type Wave = [Role | 'arkillo', number, number][];
const HUNTERS: Wave = [
	['hunter', -260, -120],
	['gunner', 260, -60],
	['berserker', 0, 240]
];
const LAST_STAND: Wave = [
	['arkillo', 0, 0],
	['gunner', -260, -200],
	['hunter', 260, -200],
	['berserker', 0, 260]
];

export function buildRingsMap(): GameMap {
	const rand = seededRandom(1014);
	const obstacles: Obstacle[] = [];
	for (let i = 0; i < 34; i++) {
		const size = 40 + rand() * 70;
		const x = 700 + rand() * (W - 1000);
		const y = 200 + rand() * (H - 400);
		const near = (p: { x: number; y: number }, r: number) => Math.hypot(x + size / 2 - p.x, y - p.y) < r;
		if (STRANDED.some((s) => near(s, 260)) || near(ARENA, 420)) continue;
		obstacles.push({ kind: 'rock', x, y, w: size, h: size * 0.55, height: 14 + size * 0.25, blocksFlying: false, seed: rand() });
	}
	return {
		name: 'Graxos IV',
		environment: 'planet',
		ground: 'ash',
		width: W,
		height: H,
		spawn: SPAWN,
		battery: { x: SPAWN.x - 120, y: SPAWN.y - 160 },
		dummies: [],
		obstacles
	};
}

export class RingsGoOut implements MissionDirector {
	state: MissionState = 'intro';
	phase: RingsPhase = 'rescue';
	timer = INTRO_TIME;
	lives = LIVES;
	elapsed = 0;
	downs = 0;
	defeated = 0;
	failReason: 'lantern' | 'stranded' | null = null;
	readonly comms = new Comms();
	readonly stranded: Stranded[] = STRANDED.map((s) => ({ ...s, hp: STRANDED_HP, charge: 0, hunted: false, state: 'down', flying: 0 }));
	readonly starHint = '★ done · ★ all three Lanterns got out · ★ Hal never went down';
	arkillo: Enemy | null = null;
	private all: Enemy[] = [];
	private counted = new WeakSet<Enemy>();
	private reinforce = REINFORCE_EVERY;
	private wasDown = false;
	private said = new Set<string>();
	private gameRef: Game | null = null;

	// ------------------------------------------------------------ reporting

	get saved(): number {
		return this.stranded.filter((s) => s.state === 'out').length;
	}

	get lost(): number {
		return this.stranded.filter((s) => s.state === 'lost').length;
	}

	get objective(): string {
		if (this.phase === 'rescue') return `Get the Lanterns out (${this.saved} / ${this.stranded.length})`;
		return 'Take down Arkillo';
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const list: MissionMeter[] = [];
		if (this.phase === 'rescue') {
			for (const s of this.stranded) {
				if (s.state !== 'down') continue;
				const name = LANTERNS[s.id].name.split(' ')[0];
				list.push({ label: name, value: s.hp / STRANDED_HP, text: s.charge > 0 ? `ring ${Math.round(s.charge * 100)}%` : `${Math.round(s.hp)}%` });
			}
		}
		const a = this.arkillo;
		if (a) list.push({ label: 'Arkillo', value: Math.max(0, a.hp) / a.maxHp, text: `${Math.round((Math.max(0, a.hp) / a.maxHp) * 100)}%` });
		return list;
	}

	warning(game: Game): string | null {
		if (this.state !== 'playing' || this.phase !== 'rescue') return null;
		const low = this.stranded.find((s) => s.state === 'down' && s.hunted && s.hp < 35);
		if (low) return `${LANTERNS[low.id].name} can't hold out much longer!`;
		if (game.players[0].dread > 0.8) return 'Fear is taking over! Shield up!';
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.lost === 0 ? 1 : 0) + (this.downs === 0 ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'won') {
			if (this.lost === 0) return 'Three Lanterns home to Oa, and Arkillo off Graxos. Elsewhere the yellow rings kept going.';
			return `${this.saved} of three Lanterns made it home. Elsewhere the yellow rings kept going.`;
		}
		if (this.failReason === 'stranded') return 'The hunters got to every one of them.';
		return 'Hal went down one time too many.';
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		return [
			{ label: 'Lanterns out', value: `${this.saved} / ${this.stranded.length}` },
			{ label: 'Hunters beaten', value: `${this.defeated}` },
			{ label: 'Times down', value: `${this.downs}` },
			{ label: 'Time', value: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
		];
	}

	// ---------------------------------------------------------------- rules

	update(game: Game, dt: number) {
		this.gameRef = game;
		this.comms.update(dt);
		this.countDefeats();
		for (const s of this.stranded) if (s.state === 'out') s.flying += dt;

		switch (this.state) {
			case 'intro':
				this.timer -= dt;
				if (this.timer <= 0) {
					this.state = 'playing';
					this.comms.scene([
						['Kilowog', 'Three of ours down on this rock, poozer. Rings drained dry, and the yellow ones are hunting them.'],
						['Hal', 'Then we get there first. Charge their rings and get them off this moon.'],
						['Kilowog', "They're on all three. Katma's closest, Arisia's furthest. Pick, and move!"]
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
			case 'rescue':
				this.updateRescue(game, dt);
				break;
			case 'arkillo':
				if (this.arkillo && !isStanding(this.arkillo)) this.win(game);
				else if (this.arkillo && this.arkillo.hp < this.arkillo.maxHp * 0.5)
					this.once('half', 'Kilowog', "That's it, Arkillo! You never could take a hit!");
				break;
		}
	}

	private updateRescue(game: Game, dt: number) {
		const hunters = game.enemies;
		for (const s of this.stranded) {
			if (s.state !== 'down') continue;
			if (!s.hunted) {
				s.hunted = true;
				this.spawn(game, HUNTERS, s.x, s.y);
			}
			const near = hunters.filter((e) => Math.hypot(e.x - s.x, e.y - s.y) < HUNTER_DRAIN.range).length;
			s.hp = Math.max(0, s.hp - near * HUNTER_DRAIN.perSecond * dt);
			if (s.hp <= 0) {
				s.state = 'lost';
				this.comms.say('Kilowog', `No... ${LANTERNS[s.id].name}! We lost her.`, true);
				continue;
			}
			const rescuer = game.players.some((p) => !p.downed && !p.hero && Math.hypot(p.x - s.x, p.y - s.y) < RESCUE_RANGE);
			const blocked = hunters.some((e) => Math.hypot(e.x - s.x, e.y - s.y) < CHARGE_BLOCK);
			if (rescuer && blocked) this.once('blocked', 'Kilowog', "Can't charge her with them on top of her! Clear them off first!");
			if (rescuer && !blocked) {
				s.charge = Math.min(1, s.charge + dt / RESCUE_TIME);
				this.once(`charge-${s.id}`, 'Hal', `Hang on, ${LANTERNS[s.id].name.split(' ')[0]}. Sharing my charge.`);
			}
			if (s.charge >= 1) {
				s.state = 'out';
				s.flying = 0;
				this.comms.say(LANTERNS[s.id].name.split(' ')[0], 'Ring at full. Thank you, Jordan. Heading for Oa!', true);
			}
		}
		// Hunters keep coming for anyone still down
		this.reinforce -= dt;
		if (this.reinforce <= 0) {
			this.reinforce = REINFORCE_EVERY;
			const s = this.stranded.find((t) => t.state === 'down' && t.hunted);
			if (s) this.spawn(game, HUNTERS.slice(0, 2), s.x, s.y);
		}
		if (this.stranded.every((s) => s.state !== 'down')) {
			if (this.lost === this.stranded.length) this.lose(game, 'stranded');
			else this.startArkillo(game);
		}
	}

	private startArkillo(game: Game) {
		this.phase = 'arkillo';
		const spawned = this.spawn(game, LAST_STAND, ARENA.x, ARENA.y);
		this.arkillo = spawned.find((e) => e.kind === 'arkillo') ?? null;
		this.comms.scene([
			['Arkillo', 'KILOWOG! I wondered if they would send you.'],
			['Kilowog', 'Arkillo. They give a ring to anything these days.'],
			['Arkillo', 'The yellow ring wanted the most frightening thing on Vorn. Come and find out why.']
		]);
	}

	private spawn(game: Game, wave: Wave, x: number, y: number): Enemy[] {
		const out = wave.map(([role, dx, dy]) => {
			const ex = Math.max(80, Math.min(W - 80, x + dx));
			const ey = Math.max(220, Math.min(H - 220, y + dy));
			const boss = role === 'arkillo';
			const e = boss ? game.spawnEnemy('arkillo', ex, ey) : game.spawnEnemy('fearGrunt', ex, ey, role);
			e.brain.grit = boss ? 1 : HUNTER_TOUGHNESS;
			e.brain.might = boss ? ARKILLO_MIGHT : HUNTER_MIGHT;
			e.brain.alert = 10;
			e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * (boss ? ARKILLO_HEALTH : HUNTER_TOUGHNESS));
			return e;
		});
		this.all.push(...out);
		return out;
	}

	private countDefeats() {
		for (const e of this.all) {
			if (e.kind === 'arkillo') continue;
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
			if (this.lives <= 0) this.lose(game, 'lantern');
			else this.comms.say('Kilowog', 'On your feet, Jordan! They need you standing!', true);
		}
		this.wasDown = hal.downed;
	}

	private win(game: Game) {
		this.state = 'won';
		this.timer = 0;
		for (const p of game.players) {
			p.victoryTimer = 0.4;
			p.dread = 0;
		}
		this.comms.scene([
			['Kilowog', 'Stay down this time, you overgrown poozer.'],
			['Hal', 'Oa says it is the same in a dozen sectors. Rings drained, Lanterns hunted.'],
			['Kilowog', "He's not building an army, Hal. He's already got one."]
		]);
	}

	private lose(game: Game, why: 'lantern' | 'stranded') {
		this.state = 'lost';
		this.failReason = why;
		game.downedNotice = false;
	}

	// -------------------------------------------------------------- drawing

	cameraPoints(): [number, number][] {
		return [];
	}

	/** Getting to them is the job; the hunters are already there. */
	get goalFirst(): boolean {
		return this.phase === 'rescue';
	}

	goal(): { x: number; y: number } | null {
		if (this.state !== 'playing') return null;
		if (this.phase === 'arkillo') return this.arkillo && isStanding(this.arkillo) ? this.arkillo : ARENA;
		const hal = this.gameRef?.players[0];
		const waiting = this.stranded.filter((s) => s.state === 'down');
		if (!hal || waiting.length === 0) return null;
		// Whoever's in the most trouble, then whoever's closest
		const hunted = waiting.filter((s) => s.hunted);
		const pool = hunted.length ? hunted : waiting;
		return pool.sort((a, b) => a.hp - b.hp || Math.hypot(a.x - hal.x, a.y - hal.y) - Math.hypot(b.x - hal.x, b.y - hal.y))[0];
	}

	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		const list: Drawable[] = [];
		for (const s of this.stranded) {
			if (s.state === 'lost') {
				list.push({ baseY: s.y, draw: () => drawStranded(ctx, s, time) });
				continue;
			}
			if (s.state === 'out' && s.flying > FLY_OUT_TIME) continue;
			if (s.state === 'down') list.push({ baseY: -1e6 + 2, draw: () => drawChargeRing(ctx, s, time) });
			list.push({ baseY: s.y, draw: () => drawStranded(ctx, s, time) });
		}
		return list;
	}
}

// ------------------------------------------------------------- drawing helpers

/** A Lantern down with a drained ring; charged, they rise and streak away. Lost ones stay where they fell, grey. */
function drawStranded(ctx: CanvasRenderingContext2D, s: Stranded, time: number) {
	const def = LANTERNS[s.id];
	const k = def.figureScale ?? 1;
	ctx.save();
	if (s.state === 'lost') {
		drawWashed(ctx, s.x, s.y, { side: 120 * k, up: 120 * k, down: 50 * k }, { color: '#55595c', amount: 0.85 }, (c) =>
			drawLantern(c, def, s.x, s.y, { dir: 1, walkPhase: 0, altitude: 0, hoverHeight: 8, lean: 0, glow: false, shadow: true, firing: false, aimX: 1, aimY: 0, downed: true }, time, k)
		);
	} else if (s.state === 'down') {
		drawLantern(ctx, def, s.x, s.y, { dir: 1, walkPhase: 0, altitude: 0, hoverHeight: 8, lean: 0, glow: s.charge > 0, shadow: true, firing: false, aimX: 1, aimY: 0, downed: true }, time, k);
	} else {
		const t = s.flying / FLY_OUT_TIME;
		ctx.globalAlpha = Math.max(0, 1 - t * t);
		drawLantern(ctx, def, s.x + t * t * 300, s.y - t * t * 900, { dir: 1, walkPhase: 0, altitude: 1, hoverHeight: 30, lean: 1, glow: true, shadow: false, firing: false, aimX: 1, aimY: -1 }, time, k);
	}
	ctx.restore();
}

/** Where to stand to charge their ring: a ring on the ground filling green. */
function drawChargeRing(ctx: CanvasRenderingContext2D, s: Stranded, time: number) {
	ctx.save();
	ctx.strokeStyle = s.hunted ? 'rgba(255, 216, 74, 0.7)' : 'rgba(125, 255, 158, 0.55)';
	ctx.lineWidth = 3;
	ctx.setLineDash([12, 10]);
	ctx.lineDashOffset = -time * 20;
	ctx.beginPath();
	ctx.ellipse(s.x, s.y, RESCUE_RANGE, RESCUE_RANGE * 0.6, 0, 0, Math.PI * 2);
	ctx.stroke();
	ctx.setLineDash([]);
	if (s.charge > 0) {
		ctx.strokeStyle = '#3dff6e';
		ctx.shadowColor = '#3dff6e';
		ctx.shadowBlur = 12;
		ctx.lineWidth = 6;
		ctx.beginPath();
		ctx.ellipse(s.x, s.y, RESCUE_RANGE * 0.45, RESCUE_RANGE * 0.27, 0, -Math.PI / 2, -Math.PI / 2 + s.charge * Math.PI * 2);
		ctx.stroke();
	}
	ctx.restore();
}
