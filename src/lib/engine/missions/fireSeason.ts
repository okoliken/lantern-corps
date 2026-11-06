// Season two, Act 2, mission 11: Fire Season. John, with J'onn J'onzz.
//
// Firefly is setting Metropolis on fire from the air, street by street, and
// calling it art. People are trapped up the buildings he's lit.
//
//   fires    Firefly flies his circuit over the city and fire catches where
//            he passes. Fires grow, and a big one spreads. John puts them
//            out: every construct he puts into a fire beats it down. J'onn
//            goes for the trapped people, phases into the building and brings
//            them out to the ambulance. But fire is the one thing a Martian
//            fears: near any fire he freezes, and can't move until it's out.
//   firefly  Once two groups are out, Firefly stops painting and comes for
//            John himself: his flamethrower and firebombs still set fires.
//
// Lose: two groups of people are lost to the smoke, or John goes down three
// times.

import { createDummy, isStanding, type Dummy } from '../dummy';
import { civilians, drawAmbulance, drawBlaze, drawRescued, drawTrapped } from '../draw/fire';
import type { Figure } from '../draw/lantern';
import { gearOf } from '../enemies/gear';
import type { Enemy } from '../enemies/enemies';
import type { Drawable, Game } from '../game';
import type { GameMap, Obstacle } from '../map';
import { boxOverlap } from '../physics';
import type { Player } from '../player';
import { buildCityMap } from './callToArms';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

export type FirePhase = 'fires' | 'firefly';

const LIVES = 3;
const INTRO_TIME = 3;
const FIREFLY = { health: 4.4, might: 5.2 };
/** A fire at full size takes this much to put out; it grows this fast (share per second); a big one spreads this often. */
export const BLAZE = { hp: 230, grow: 1 / 48, spreadAt: 0.7, spreadEvery: 10, spreadMin: 130, spreadMax: 220, max: 14, burn: 10, reach: 60 };
/** J'onn freezes with a fire this close (and stays frozen a moment after). */
export const FEAR = { range: 150, hold: 0.4 };
/** Smoke on the trapped: from fires this near, how fast it fills, and how fast it hurts once it's thick. */
const SMOKE = { range: 380, rate: 1 / 40, clear: 1 / 40, hurt: 6 };
/** Rescue: how close J'onn has to be, how long he's inside, how they walk, how close the ambulance counts. */
const RESCUE = { reach: 80, inside: 1.8, speed: 150, gap: 60, ambulance: 190 };
/** Firefly lights a fire on his circuit this often while he's painting. */
const PAINT_EVERY = 8;
/** Firefly comes down to fight after this many groups are out, or after this long. */
const FIGHT_AFTER = { out: 2, time: 150 };

const W = 3600;
const H = 2100;
const ENTRY = { x: 700, y: 1100 };
export const AMBULANCE = { x: 520, y: 1080 };
/** Firefly's circuit while he paints the city. */
const CIRCUIT = [
	{ x: 1400, y: 600 },
	{ x: 2600, y: 650 },
	{ x: 3100, y: 1200 },
	{ x: 2200, y: 1500 },
	{ x: 1200, y: 1450 }
];

export interface Blaze {
	dummy: Dummy;
	size: number;
	spreadIn: number;
	seed: number;
}

interface Trapped {
	x: number;
	y: number;
	state: 'trapped' | 'inside' | 'following' | 'out' | 'lost';
	smoke: number;
	hp: number;
	inside: number;
	people: Figure[];
	vx: number;
}

/** Metropolis downtown: blocks of towers top and bottom, streets between. */
export function buildFireSeasonMap(): GameMap {
	return buildCityMap({ name: 'Metropolis, downtown', ground: 'street', seed: 1938, width: W, height: H, spawn: ENTRY, clear: AMBULANCE });
}

/** Four towers along the top row with people stuck up them: spread out, none near the ambulance. */
function pickTowers(map: GameMap): Obstacle[] {
	const top = map.obstacles.filter((o) => o.kind === 'building' && o.y < 100 && o.w > 160).sort((a, b) => a.x - b.x);
	const picks: Obstacle[] = [];
	for (const want of [1150, 1900, 2600, 3250]) {
		const best = top.filter((o) => !picks.includes(o)).sort((a, b) => Math.abs(a.x + a.w / 2 - want) - Math.abs(b.x + b.w / 2 - want))[0];
		if (best) picks.push(best);
	}
	return picks;
}

export class FireSeason implements MissionDirector {
	state: MissionState = 'intro';
	phase: FirePhase = 'fires';
	timer = INTRO_TIME;
	lives = LIVES;
	downs = 0;
	elapsed = 0;
	readonly blazes: Blaze[] = [];
	put = 0;
	/** Seconds J'onn spent frozen. */
	frozen = 0;
	trapped: Trapped[] = [];
	firefly: Enemy | null = null;
	failReason: 'people' | 'down' | null = null;
	readonly comms = new Comms();
	readonly starHint = "★ done · ★ nobody lost to the smoke · ★ J'onn was never frozen for long";
	private stop = 0;
	private paint = 2;
	private wasDown = false;
	private said = new Set<string>();
	private gameRef: Game | null = null;

	// ------------------------------------------------------------ reporting

	get out(): number {
		return this.trapped.filter((t) => t.state === 'out').length;
	}

	get lost(): number {
		return this.trapped.filter((t) => t.state === 'lost').length;
	}

	get objective(): string {
		const jonn = this.gameRef?.players[1];
		if (jonn?.hero?.afraid) return "J'onn is frozen! Put out the fire near him";
		if (this.phase === 'firefly' && this.firefly && isStanding(this.firefly)) return `Stop Firefly. Fires: ${this.blazes.length}`;
		return `Put out the fires; J'onn gets the people out (${this.out} / ${this.trapped.length})`;
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const list: MissionMeter[] = [{ label: 'Fires', value: Math.min(1, this.blazes.length / BLAZE.max), text: `${this.blazes.length}`, low: this.blazes.length > BLAZE.max * 0.6 }];
		for (const t of this.trapped) if ((t.state === 'trapped' || t.state === 'inside') && t.smoke > 0.4) list.push({ label: 'Smoke', value: t.hp / 100, text: `${Math.round(t.hp)}%`, low: t.hp < 50 });
		return list;
	}

	warning(game: Game): string | null {
		if (this.state !== 'playing') return null;
		if (game.players[1]?.hero?.afraid) return "J'ONN IS FROZEN! PUT OUT THE FIRE NEAR HIM!";
		if (this.trapped.some((t) => (t.state === 'trapped' || t.state === 'inside') && t.hp < 50)) return 'People are choking on the smoke! Clear the fires round them!';
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.lost === 0 ? 1 : 0) + (this.frozen < 15 ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'won') return "Firefly is on his way to Stryker's Island, and the last fire in Metropolis is out.";
		if (this.failReason === 'people') return 'Two buildings filled with smoke before anyone could reach them.';
		return 'John went down one time too many, and the city burned.';
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		return [
			{ label: 'People out', value: `${this.out * 3} / ${this.trapped.length * 3}` },
			{ label: 'Fires put out', value: `${this.put}` },
			{ label: "J'onn frozen", value: `${Math.round(this.frozen)}s` },
			{ label: 'Time', value: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
		];
	}

	// ---------------------------------------------------------------- rules

	update(game: Game, dt: number) {
		this.gameRef = game;
		this.comms.update(dt);
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

		this.ignite(game);
		this.burn(game, dt);
		this.fear(game, dt);
		this.smoke(dt);
		this.rescue(game, dt);
		this.flyCircuit(game, dt);
		if (this.state !== 'playing') return;

		if (this.lost >= 2) return this.lose('people');
		if (this.phase === 'fires' && (this.out >= FIGHT_AFTER.out || this.elapsed > FIGHT_AFTER.time)) this.startFight();
		const done = this.trapped.every((t) => t.state === 'out' || t.state === 'lost');
		if (this.firefly && !isStanding(this.firefly) && done) this.win(game);
	}

	private start(game: Game) {
		this.state = 'playing';
		this.trapped = pickTowers(game.map).map((o, i) => ({
			x: o.x + o.w / 2,
			y: o.y + o.h + 40,
			state: 'trapped' as const,
			smoke: 0,
			hp: 100,
			inside: 0,
			people: civilians(i),
			vx: 0
		}));
		const f = game.spawnEnemy('firefly', CIRCUIT[0].x, CIRCUIT[0].y);
		f.brain.grit = 1;
		f.brain.might = FIREFLY.might;
		f.brain.alert = 10;
		f.hp = f.maxHp = f.brain.lastHp = Math.round(f.maxHp * FIREFLY.health);
		this.firefly = f;
		// The city's already burning when they get there
		for (const t of this.trapped.slice(0, 2)) this.light(game, t.x + 200, t.y + 150, 0.35);
		this.light(game, 1600, 1150, 0.35);
		this.comms.scene([
			['Firefly', 'Look at it, Lantern! Every street a brushstroke!'],
			["J'onn", 'I will go in for the people. Keep the fire away from me, John. I cannot... near it, I cannot move.'],
			['John', "Then I'll keep it off you. Go."]
		]);
	}

	/** Start a fire here (or feed the one already here). */
	light(game: Game, x: number, y: number, size: number) {
		const near = this.blazes.find((b) => Math.hypot(b.dummy.x - x, b.dummy.y - y) < 100);
		if (near) {
			near.size = Math.min(1, near.size + size * 0.5);
			near.dummy.hp = near.size * BLAZE.hp;
			return;
		}
		if (this.blazes.length >= BLAZE.max) return;
		x = Math.max(80, Math.min(W - 80, x));
		y = Math.max(160, Math.min(H - 120, y));
		if (game.map.obstacles.some((o) => boxOverlap(x, y, 30, 14, o))) return;
		const d = createDummy(x, y);
		d.kind = 'blaze';
		d.maxHp = BLAZE.hp;
		d.hp = size * BLAZE.hp;
		d.respawns = false;
		game.dummies.push(d);
		this.blazes.push({ dummy: d, size, spreadIn: BLAZE.spreadEvery * (0.7 + Math.random() * 0.6), seed: Math.random() });
	}

	/** Where Firefly's flame and firebombs ended this tick, it catches. */
	private ignite(game: Game) {
		const g = gearOf(game.constructs);
		for (const p of g.ignitions) this.light(game, p.x, p.y, 0.3);
		g.ignitions.length = 0;
	}

	/** Fires grow, the big ones spread, constructs put them out, and anyone standing in one is burned. */
	private burn(game: Game, dt: number) {
		for (const b of [...this.blazes]) {
			const d = b.dummy;
			d.x = d.prevX = d.homeX;
			d.y = d.prevY = d.homeY;
			d.vx = d.vy = 0;
			if (!isStanding(d)) {
				this.blazes.splice(this.blazes.indexOf(b), 1);
				this.put++;
				if (this.put === 1) this.comms.say('John', "That's how you fight fire with a ring. Smother it.");
				continue;
			}
			b.size = Math.min(1, d.hp / BLAZE.hp + BLAZE.grow * dt);
			d.hp = b.size * BLAZE.hp;
			b.spreadIn -= dt;
			if (b.size >= BLAZE.spreadAt && b.spreadIn <= 0) {
				b.spreadIn = BLAZE.spreadEvery * (0.7 + Math.random() * 0.6);
				const a = Math.random() * Math.PI * 2;
				const r = BLAZE.spreadMin + Math.random() * (BLAZE.spreadMax - BLAZE.spreadMin);
				this.light(game, d.x + Math.cos(a) * r, d.y + Math.sin(a) * r * 0.7, 0.25);
			}
			for (const p of game.players) {
				if (p.downed || p.flying || Math.hypot(p.x - d.x, p.y - d.y) > BLAZE.reach * (0.5 + b.size)) continue;
				p.health = Math.max(0, p.health - BLAZE.burn * b.size * dt);
			}
		}
	}

	/** J'onn near any fire freezes, and stays that way until it's out or he's away from it. */
	private fear(game: Game, dt: number) {
		const jonn = game.players[1];
		if (!jonn?.hero || jonn.downed) return;
		const near = this.blazes.some((b) => Math.hypot(b.dummy.x - jonn.x, b.dummy.y - jonn.y) < FEAR.range * (0.6 + 0.4 * b.size));
		if (!near) return;
		jonn.hero.afraid = Math.max(jonn.hero.afraid, FEAR.hold);
		jonn.hero.move = null;
		this.frozen += dt;
		this.once('frozen', "J'onn", 'John... the fire. I... cannot...');
		if (this.frozen > 6) this.once('frozen2', 'John', "Hang on, J'onn. I've got it. Just breathe.");
	}

	/** Fires near a trapped group fill their floor with smoke; thick smoke hurts. */
	private smoke(dt: number) {
		for (const t of this.trapped) {
			if (t.state !== 'trapped' && t.state !== 'inside') continue;
			const heat = this.blazes.filter((b) => Math.hypot(b.dummy.x - t.x, b.dummy.y - t.y) < SMOKE.range).reduce((s, b) => s + b.size, 0);
			t.smoke = Math.max(0, Math.min(1, t.smoke + (heat > 0.2 ? SMOKE.rate * Math.min(2, heat) : -SMOKE.clear) * dt));
			if (t.smoke >= 0.6) t.hp -= SMOKE.hurt * ((t.smoke - 0.6) / 0.4 + 0.2) * dt;
			if (t.hp <= 0) {
				t.hp = 0;
				t.state = 'lost';
				this.comms.say("J'onn", 'Their minds have gone quiet. I was too late.', true);
			}
		}
	}

	/** J'onn goes to the group in the thickest smoke, phases in, and leads them to the ambulance. */
	private rescue(game: Game, dt: number) {
		const jonn = game.players[1];
		const h = jonn?.hero;
		if (!jonn || !h) return;
		const leading = this.trapped.find((t) => t.state === 'following');
		if (leading) {
			if (Math.hypot(leading.x - AMBULANCE.x, leading.y - AMBULANCE.y) < RESCUE.ambulance) {
				leading.state = 'out';
				this.comms.say("J'onn", this.trapped.some((t) => t.state === 'trapped') ? 'They are safe. I am going back.' : 'That is everyone.');
			} else {
				const far = Math.hypot(leading.x - jonn.x, leading.y - jonn.y) > 240;
				h.errand = far ? { x: leading.x, y: leading.y } : AMBULANCE;
				this.walk(leading, jonn, dt);
				return;
			}
		}
		const inside = this.trapped.find((t) => t.state === 'inside');
		if (inside) {
			h.errand = { x: inside.x, y: inside.y };
			if (h.afraid > 0) return;
			inside.inside += dt;
			if (inside.inside >= RESCUE.inside) {
				inside.state = 'following';
				this.comms.say('Survivor', ['A green man came through the wall!', "We couldn't see the stairs!", 'Is it over? Is he gone?', 'Thank you, thank you...'][this.trapped.indexOf(inside)]);
			}
			return;
		}
		const next = this.trapped.filter((t) => t.state === 'trapped').sort((a, b) => b.smoke - a.smoke || Math.hypot(a.x - jonn.x, a.y - jonn.y) - Math.hypot(b.x - jonn.x, b.y - jonn.y))[0];
		if (!next) {
			h.errand = null;
			return;
		}
		h.errand = { x: next.x, y: next.y };
		if (Math.hypot(jonn.x - next.x, jonn.y - next.y) < RESCUE.reach && h.afraid <= 0) next.state = 'inside';
	}

	private walk(t: Trapped, jonn: Player, dt: number) {
		const dx = jonn.x - t.x;
		const dy = jonn.y - t.y;
		const d = Math.hypot(dx, dy) || 1;
		const v = d > RESCUE.gap ? RESCUE.speed : 0;
		t.vx = (dx / d) * v;
		t.x += t.vx * dt;
		t.y += (dy / d) * v * dt;
	}

	/** While he paints, Firefly flies his circuit and fire catches where he passes. */
	private flyCircuit(game: Game, dt: number) {
		const f = this.firefly;
		if (!f || !isStanding(f)) return;
		if (this.phase !== 'fires') {
			f.brain.errand = null;
			return;
		}
		const to = CIRCUIT[this.stop];
		if (Math.hypot(f.x - to.x, f.y - to.y) < 80) this.stop = (this.stop + 1) % CIRCUIT.length;
		f.brain.errand = { x: CIRCUIT[this.stop].x, y: CIRCUIT[this.stop].y, speed: 190 };
		this.paint -= dt;
		if (this.paint <= 0) {
			this.paint = PAINT_EVERY;
			this.light(game, f.x + (Math.random() - 0.5) * 120, f.y + 40, 0.35);
			gearOf(game.constructs).fx.push({ kind: 'burst', x: f.x, y: f.y + 40, angle: 0, dir: 1, radius: 90, age: 0, life: 0.5 });
		}
		// Hurt him enough and he stops painting and turns on you
		if (f.hp < f.maxHp * 0.8) this.startFight();
	}

	private startFight() {
		if (this.phase === 'firefly') return;
		this.phase = 'firefly';
		this.comms.scene([
			['Firefly', "You keep ruining my work, Lantern. Let's see how you burn."],
			['John', "J'onn, keep them moving. He's mine."]
		]);
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
			["J'onn", 'You stood between me and the thing I fear most, and you did not make me say it.'],
			['John', "Everybody's scared of something. Marines carry each other."],
			["J'onn", 'Then I am in your debt, Lantern. The League will hear of it.']
		]);
	}

	private lose(reason: 'people' | 'down') {
		if (this.state !== 'playing') return;
		this.state = 'lost';
		this.failReason = reason;
	}

	// -------------------------------------------------------------- drawing

	cameraPoints(): [number, number][] {
		const jonn = this.gameRef?.players[1];
		return jonn?.hero?.afraid ? [[jonn.x, jonn.y]] : [];
	}

	goal(): { x: number; y: number } | null {
		if (this.state !== 'playing') return null;
		const jonn = this.gameRef?.players[1];
		if (jonn?.hero?.afraid) {
			const near = this.blazes.slice().sort((a, b) => Math.hypot(a.dummy.x - jonn.x, a.dummy.y - jonn.y) - Math.hypot(b.dummy.x - jonn.x, b.dummy.y - jonn.y))[0];
			if (near) return near.dummy;
		}
		const smoky = this.trapped.filter((t) => t.state === 'trapped' || t.state === 'inside').sort((a, b) => b.smoke - a.smoke)[0];
		if (smoky && smoky.smoke > 0.3) {
			const fire = this.blazes.slice().sort((a, b) => Math.hypot(a.dummy.x - smoky.x, a.dummy.y - smoky.y) - Math.hypot(b.dummy.x - smoky.x, b.dummy.y - smoky.y))[0];
			if (fire) return fire.dummy;
		}
		if (this.phase === 'firefly' && this.firefly && isStanding(this.firefly)) return this.firefly;
		return this.blazes[0]?.dummy ?? null;
	}

	get goalFirst(): boolean {
		return !!this.gameRef?.players[1]?.hero?.afraid;
	}

	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		const list: Drawable[] = [{ baseY: AMBULANCE.y, draw: () => drawAmbulance(ctx, AMBULANCE.x, AMBULANCE.y, time) }];
		for (const t of this.trapped) {
			if (t.state === 'trapped' || t.state === 'inside') list.push({ baseY: t.y - 50, draw: () => drawTrapped(ctx, t.x, t.y - 20, t.smoke, t.state === 'inside', time, t.x * 0.001) });
			if (t.state === 'following') list.push({ baseY: t.y, draw: () => drawRescued(ctx, t.people, t.x, t.y, t.vx < 0 ? -1 : 1, Math.abs(t.vx) > 4, time) });
		}
		for (const b of this.blazes) list.push({ baseY: b.dummy.y, draw: () => drawBlaze(ctx, b.dummy.x, b.dummy.y, b.size, b.dummy.flash > 0, time, b.seed) });
		return list;
	}
}
