// Season two, Act 3, mission 9: Recruited. John, with Wonder Woman.
//
// The yellow rings have started looking for people, and the first one on
// Earth found Ray Doyle, a night watchman in Detroit and the most frightened
// man in the city. He is not a villain. The ring is doing this to him.
//
//   nightmares  the ring makes Ray's fears real: yellow copies of things John
//               has fought before. Two waves of them on the riverfront.
//   ray         then Ray himself, the ring lashing out for him. It won't let
//               him fall: wear him down and Wonder Woman gets her lasso on him.
//               While he's held, stay close and talk him down; the ring throws
//               nightmares at you, and every hit you take sets him back, so
//               keep your shield up. Take too long and he breaks free.
//
// Lose: John goes down 3 times.

import { addDread } from '../dread';
import { isStanding } from '../dummy';
import type { Enemy, EnemyKind, Role } from '../enemies/enemies';
import type { Drawable, Game } from '../game';
import { seededRandom, type GameMap } from '../map';
import { buildCityMap, cityDecor } from './callToArms';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

export type RecruitedPhase = 'nightmares' | 'ray';

const LIVES = 3;
const INTRO_TIME = 3;
const NIGHTMARE_TOUGHNESS = 3;
const NIGHTMARE_MIGHT = 4.5;
const RAY_HEALTH = 2.4;
const RAY_MIGHT = 3.4;
/** The ring keeps him above this share of his health: he can't be beaten, only worn down. */
const RAY_FLOOR = 0.1;
/** Worn down to this, Wonder Woman's lasso catches him. */
export const SPENT = 0.2;
/** How long the lasso holds him, and how long John has to stay close to talk him down. */
export const HOLD_TIME = 15;
export const CALM_TIME = 10;
/** How close John has to be to talk to him. */
export const CALM_RANGE = 260;
/** Talking him down slips back this fast while John is away. */
const CALM_SLIP = 0.06;
/** While he's held, the ring throws nightmares at John this often. */
const THROW_EVERY = 4;
/** No more throws while this many nightmares are already up. */
const THROWN_MAX = 6;
/** Getting hurt while you talk shakes him: calm lost per point of damage. */
const CALM_HURT = 0.006;
/** Breaking free: his strength back, and a burst of fear for anyone close. */
const BREAK_HEAL = 0.6;
const BREAK_BURST = { range: 420, dread: 0.35 };

const W = 3600;
const H = 2100;
const ENTRY = { x: 520, y: 1050 };
const RIVERFRONT = { x: 2700, y: 1050 };

type Wave = [EnemyKind, Role, number, number][];
const WAVES: Wave[] = [
	[
		['rageGrunt', 'berserker', -160, -120],
		['rageGrunt', 'gunner', 200, -180],
		['gorillaBrute', 'berserker', 120, 160],
		['rageGrunt', 'hunter', -200, 200],
		['gorillaGunner', 'gunner', 300, 60],
		['rageGrunt', 'berserker', 0, 0]
	],
	[
		['manhunter', 'gunner', -260, -160],
		['manhunter', 'gunner', 260, -160],
		['gorillaBrute', 'berserker', -120, 180],
		['gorillaBrute', 'berserker', 160, 220],
		['rageGrunt', 'hunter', 0, -260],
		['rageGrunt', 'gunner', 320, 40],
		['gorillaGunner', 'gunner', -320, 40],
		['rageGrunt', 'berserker', 0, 120]
	]
];
const THROWN: Wave = [
	['rageGrunt', 'berserker', -220, -60],
	['gorillaBrute', 'berserker', 220, 60],
	['rageGrunt', 'gunner', 0, 240]
];

export function buildRecruitedMap(): GameMap {
	return buildCityMap({ name: 'Detroit, the riverfront', ground: 'nightStreet', seed: 1959, width: W, height: H, spawn: ENTRY, clear: RIVERFRONT });
}

export class Recruited implements MissionDirector {
	state: MissionState = 'intro';
	phase: RecruitedPhase = 'nightmares';
	timer = INTRO_TIME;
	lives = LIVES;
	elapsed = 0;
	downs = 0;
	defeated = 0;
	/** Waves of nightmares sent so far. */
	wave = 0;
	/** Seconds left in the lasso, or 0 while he's loose. */
	held = 0;
	/** Talking him down, 0..1. */
	calm = 0;
	/** Times he broke the lasso. */
	breaks = 0;
	failReason: 'lantern' | null = null;
	readonly comms = new Comms();
	readonly starHint = '★ done · ★ talked down the first time he was held · ★ John never went down';
	ray: Enemy | null = null;
	private nightmares: Enemy[] = [];
	private counted = new WeakSet<Enemy>();
	private throwIn = THROW_EVERY;
	private lastHealth = 0;
	private wasDown = false;
	private said = new Set<string>();
	private decor: Drawable[] | null = null;
	private gameRef: Game | null = null;
	private rand: () => number;

	constructor(seed = 59) {
		this.rand = seededRandom(seed);
	}

	// ------------------------------------------------------------ reporting

	get objective(): string {
		if (this.phase === 'nightmares') return `Clear the nightmares (wave ${this.wave} / ${WAVES.length})`;
		if (this.held > 0) return 'Stay close and talk him down';
		return 'Wear Ray down so Wonder Woman can catch him';
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const list: MissionMeter[] = [];
		const r = this.ray;
		if (r) {
			list.push({ label: 'Ray', value: Math.max(0, r.hp) / r.maxHp, text: `${Math.round((Math.max(0, r.hp) / r.maxHp) * 100)}%` });
			if (this.held > 0) {
				list.push({ label: 'Calm', value: this.calm, text: `${Math.round(this.calm * 100)}%` });
				list.push({ label: 'Lasso', value: this.held / HOLD_TIME, text: `${Math.ceil(this.held)}s` });
			}
		}
		return list;
	}

	warning(game: Game): string | null {
		if (this.state !== 'playing') return null;
		const john = game.players[0];
		const r = this.ray;
		if (this.held > 0 && r && Math.hypot(john.x - r.x, john.y - r.y) > CALM_RANGE) return 'Get close to him! Talk him down!';
		if (john.dread > 0.8) return 'Fear is taking over! Shield up!';
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.breaks === 0 ? 1 : 0) + (this.downs === 0 ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'won') return 'The yellow ring let Ray Doyle go and went looking for someone else. Somewhere out there, it will find them.';
		return 'John went down one time too many.';
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		return [
			{ label: 'Nightmares beaten', value: `${this.defeated}` },
			{ label: 'Times he broke free', value: `${this.breaks}` },
			{ label: 'Times down', value: `${this.downs}` },
			{ label: 'Time', value: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
		];
	}

	// ---------------------------------------------------------------- rules

	update(game: Game, dt: number) {
		this.gameRef = game;
		this.comms.update(dt);
		this.countDefeats();

		switch (this.state) {
			case 'intro':
				this.timer -= dt;
				if (this.timer <= 0) {
					this.state = 'playing';
					this.nextWave(game);
					this.comms.scene([
						['Wonder Woman', 'Those are not real, John. Something is pulling them out of someone\'s head.'],
						['John', "That's a Red Lantern. And a Manhunter. Things I've fought."],
						['Wonder Woman', 'Then it is reading you as well. Clear them, and we find who is at the centre of this.']
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
		// Anything a nightmare builds (a Red Lantern's turret) is part of the nightmare
		for (const e of game.enemies) {
			if (e === this.ray || e.phantom) continue;
			e.phantom = true;
			this.nightmares.push(e);
		}
		this.countDowns(game);
		if (this.state !== 'playing') return;

		switch (this.phase) {
			case 'nightmares':
				if (this.nightmares.every((e) => !isStanding(e))) {
					if (this.wave < WAVES.length) {
						this.nextWave(game);
						this.comms.say('Wonder Woman', 'More of them. Whoever is doing this is terrified.', true);
					} else this.startRay(game);
				}
				break;
			case 'ray':
				this.updateRay(game, dt);
				break;
		}
	}

	private nextWave(game: Game) {
		const wave = WAVES[this.wave++];
		this.spawn(game, wave, RIVERFRONT.x - 400 * (WAVES.length - this.wave), RIVERFRONT.y);
	}

	private startRay(game: Game) {
		this.phase = 'ray';
		const r = game.spawnEnemy('frightened', RIVERFRONT.x, RIVERFRONT.y);
		r.brain.might = RAY_MIGHT;
		r.brain.alert = 10;
		r.hp = r.maxHp = r.brain.lastHp = Math.round(r.maxHp * RAY_HEALTH);
		this.ray = r;
		this.comms.scene([
			['Ray', "Stay back! Please! I don't know how to make it stop!"],
			['John', "Easy. I'm a Green Lantern. I know what that ring is doing to you."],
			['Wonder Woman', 'He cannot let go of it while he is this afraid. Tire the ring out and I will hold him.']
		]);
	}

	private updateRay(game: Game, dt: number) {
		const r = this.ray;
		if (!r) return;
		const john = game.players[0];
		// The ring won't let him fall
		if (r.hp < r.maxHp * RAY_FLOOR) r.hp = r.maxHp * RAY_FLOOR;
		if (!isStanding(r)) {
			r.hp = r.maxHp * RAY_FLOOR;
			r.down = 0;
		}

		if (this.held <= 0) {
			if (r.hp <= r.maxHp * SPENT) this.catchRay(game);
			return;
		}

		// Held: still, and John talks
		this.held -= dt;
		r.vx = r.vy = 0;
		r.stun = Math.max(r.stun, 0.3);
		const close = !john.downed && Math.hypot(john.x - r.x, john.y - r.y) < CALM_RANGE;
		const hurt = Math.max(0, this.lastHealth - john.health);
		this.lastHealth = john.health;
		this.calm = close ? Math.min(1, this.calm + dt / CALM_TIME) : Math.max(0, this.calm - CALM_SLIP * dt);
		if (hurt > 0) {
			this.calm = Math.max(0, this.calm - hurt * CALM_HURT);
			if (close) this.once(`shaken${this.breaks}`, 'Wonder Woman', 'Every blow you take, he flinches! Shield up while you talk!');
		}
		if (close) this.once(`talk${this.breaks}`, 'John', this.breaks === 0 ? "Ray. Look at me. You're not alone in this. Breathe." : "I'm still here, Ray. Same as before. You can put it down.");
		if (this.calm >= 0.5) this.once(`half${this.breaks}`, 'Ray', "It keeps telling me everyone's going to get hurt... that I'm the only one who can stop it...");
		if (this.calm >= 1) {
			this.win(game);
			return;
		}
		// The ring fights for him
		this.throwIn -= dt;
		if (this.throwIn <= 0 && this.nightmares.filter(isStanding).length < THROWN_MAX) {
			this.throwIn = THROW_EVERY;
			const flip = this.rand() < 0.5 ? -1 : 1;
			this.spawn(game, THROWN.map(([k, role, dx, dy]) => [k, role, dx * flip, dy * flip]), john.x, john.y);
			this.once('throw', 'Wonder Woman', 'The ring is fighting for him! Stay with him, John!');
		}
		if (this.held <= 0) this.breakFree(game);
	}

	private catchRay(game: Game) {
		const r = this.ray!;
		this.held = HOLD_TIME;
		this.calm = 0;
		this.throwIn = 0.8;
		this.lastHealth = game.players[0].health;
		// She's there in a heartbeat
		const ww = game.players[1];
		if (ww && !ww.downed && Math.hypot(ww.x - r.x, ww.y - r.y) > 400) {
			ww.x = ww.prevX = r.x + 180;
			ww.y = ww.prevY = r.y + 40;
		}
		this.comms.say('Wonder Woman', 'I have him! The lasso holds the truth, and so will he. Talk to him, John!', true);
	}

	private breakFree(game: Game) {
		const r = this.ray!;
		this.held = 0;
		this.calm = 0;
		this.breaks++;
		r.hp = r.maxHp * BREAK_HEAL;
		r.stun = 0;
		for (const p of game.players) if (!p.downed && Math.hypot(p.x - r.x, p.y - r.y) < BREAK_BURST.range) addDread(p, BREAK_BURST.dread);
		this.comms.scene([
			['Ray', 'NO! It says you are going to hurt me!'],
			['Wonder Woman', 'The ring tore him free! Again, John. Wear it down.']
		]);
	}

	private spawn(game: Game, wave: Wave, x: number, y: number): Enemy[] {
		const out = wave.map(([kind, role, dx, dy]) => {
			const ex = Math.max(80, Math.min(W - 80, x + dx));
			const ey = Math.max(260, Math.min(H - 260, y + dy));
			const e = game.spawnEnemy(kind, ex, ey, role);
			e.phantom = true;
			e.brain.grit = NIGHTMARE_TOUGHNESS;
			e.brain.might = NIGHTMARE_MIGHT;
			e.brain.alert = 10;
			e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * NIGHTMARE_TOUGHNESS);
			return e;
		});
		this.nightmares = [...this.nightmares.filter(isStanding), ...out];
		return out;
	}

	private countDefeats() {
		for (const e of this.nightmares) {
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
		const john = game.players[0];
		if (john.downed && !this.wasDown) {
			this.lives--;
			this.downs++;
			if (this.lives <= 0) this.lose(game);
			else this.comms.say('Wonder Woman', 'Up, Lantern! He needs you on your feet.', true);
		}
		this.wasDown = john.downed;
	}

	private win(game: Game) {
		this.state = 'won';
		this.timer = 0;
		this.held = 0;
		// The nightmares go with the fear that made them
		for (const e of game.enemies) {
			e.hp = 0;
			e.down = 1;
		}
		for (const p of game.players) {
			p.victoryTimer = 0.4;
			p.dread = 0;
		}
		this.comms.scene([
			['Ray', "It's... it's gone. It just let go of me."],
			['Wonder Woman', 'It flew away. Up, and out. It will look for someone else.'],
			['John', "Someone more afraid than he was. I need to call Oa. This wasn't one ring."]
		]);
	}

	private lose(game: Game) {
		this.state = 'lost';
		this.failReason = 'lantern';
		game.downedNotice = false;
	}

	// -------------------------------------------------------------- drawing

	cameraPoints(): [number, number][] {
		const r = this.ray;
		return r && this.held > 0 ? [[r.x, r.y - 60]] : [];
	}

	/** While he's held, getting to him matters more than the nightmares. */
	get goalFirst(): boolean {
		return this.held > 0;
	}

	goal(): { x: number; y: number } | null {
		if (this.state !== 'playing') return null;
		if (this.phase === 'ray') return this.ray;
		const john = this.gameRef?.players[0];
		const standing = this.nightmares.filter(isStanding);
		if (!john || standing.length === 0) return null;
		return standing.sort((a, b) => Math.hypot(a.x - john.x, a.y - john.y) - Math.hypot(b.x - john.x, b.y - john.y))[0];
	}

	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		const list: Drawable[] = [...(this.decor ??= cityDecor(ctx, W, H, 1959, RIVERFRONT))];
		const r = this.ray;
		const ww = this.gameRef?.players[1];
		if (r && this.held > 0) {
			list.push({ baseY: -1e6 + 2, draw: () => drawCalmRing(ctx, r.x, r.y, this.calm, time) });
			if (ww) list.push({ baseY: Math.max(r.y, ww.y) + 1, draw: () => drawLasso(ctx, ww.x, ww.y - 70, r.x, r.y - 55, time) });
		}
		return list;
	}
}

// ------------------------------------------------------------- drawing helpers

/** The golden lasso: a glowing rope from Wonder Woman's hand, looped round him. */
function drawLasso(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, time: number) {
	ctx.save();
	ctx.strokeStyle = '#ffd84a';
	ctx.shadowColor = '#ffe680';
	ctx.shadowBlur = 14;
	ctx.lineWidth = 4;
	const sag = 40 + Math.sin(time * 3) * 6;
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.quadraticCurveTo((x1 + x2) / 2, Math.max(y1, y2) + sag, x2, y2);
	ctx.stroke();
	for (const dy of [-14, 6]) {
		ctx.beginPath();
		ctx.ellipse(x2, y2 + dy, 26, 9, 0, 0, Math.PI * 2);
		ctx.stroke();
	}
	ctx.restore();
}

/** How far John has to be to talk him down, filling green as he calms. */
function drawCalmRing(ctx: CanvasRenderingContext2D, x: number, y: number, calm: number, time: number) {
	ctx.save();
	ctx.strokeStyle = 'rgba(125, 255, 158, 0.55)';
	ctx.lineWidth = 3;
	ctx.setLineDash([12, 10]);
	ctx.lineDashOffset = -time * 20;
	ctx.beginPath();
	ctx.ellipse(x, y, CALM_RANGE, CALM_RANGE * 0.6, 0, 0, Math.PI * 2);
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.fillStyle = `rgba(61, 255, 110, ${0.08 + 0.14 * calm})`;
	ctx.beginPath();
	ctx.ellipse(x, y, CALM_RANGE * calm, CALM_RANGE * 0.6 * calm, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}
