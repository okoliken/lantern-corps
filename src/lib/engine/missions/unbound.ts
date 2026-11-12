// Season three, Act 2, episode 4: Unbound. Hal and Kilowog, on Oa.
//
// The Central Battery breaks open and Parallax comes out of it: the fear the
// Guardians locked inside their own light ten billion years ago. It towers
// over the plaza, and it is hungry for the ones who locked it away.
//
//   The Guardians  Six of them in the plaza, pouring their will at it. It
//                  reaches down with a tendril and takes hold of one: the
//                  tendril's grip is a thing you can hit. Break it before it
//                  drains them grey.
//   Its tendrils   It slams them down on the Lanterns too (the ring on the
//                  ground is where), and fear things pour out of the Battery.
//   Sonic Boom     Hal's new construct: a supersonic run straight through
//                  everything on the line, and the shock cone hits it all
//                  again. A grip on the line is a grip cut.
//
// It can't be beaten, not yet. Hold on until it has had enough of the plaza:
// it goes up, and away, toward Earth.
//
// Lose: three Guardians drained, or Hal goes down three times.

import { addDread } from '../dread';
import { createDummy, isStanding, type Dummy } from '../dummy';
import { drawParallax } from '../draw/parallax';
import { damagePlayer } from '../combat';
import { CONSTRUCTS } from '../constructs/defs';
import type { Enemy, EnemyKind, Role } from '../enemies/enemies';
import type { Drawable, Game } from '../game';
import type { GameMap } from '../map';
import type { Player } from '../player';
import { drawGuardian } from '../scenes/summoned';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

const LIVES = 3;
const INTRO_TIME = 3;
const W = 3200;
const H = 2000;
/** The Central Battery, broken open, at the top of the plaza; Parallax over it. */
export const BATTERY = { x: 1600, y: 560 };
export const PARALLAX = { x: 1600, y: 470 };
/** How high over its spot Parallax is drawn, and how big. */
const PX_LIFT = 260;
const PX_SIZE = 0.8;
const ENTRY = { x: 1600, y: 1600 };
/** Where the six Guardians stand in the plaza. */
const GUARDIAN_SPOTS = [
	{ x: 1000, y: 980 },
	{ x: 2200, y: 980 },
	{ x: 820, y: 1360 },
	{ x: 2380, y: 1360 },
	{ x: 1300, y: 1560 },
	{ x: 1900, y: 1560 }
];
/** How long to hold out. */
export const SURVIVE = 150;
/** Its grab: a warning first, then the grip, which drains the Guardian over `drain` seconds unless it's broken. */
export const GRAB = { warn: 2, drain: 11, every: 9, fastest: 5.5, gripHp: 520 };
/** At most this many held at once, by how long it has been going. */
const HOLDS = [
	{ after: 0, most: 1 },
	{ after: 35, most: 2 },
	{ after: 100, most: 3 }
];
/** Its tendril slam on a Lantern: warned, then a hit where the ring was. */
export const SLAM = { every: 6, warn: 1.4, radius: 125, damage: 42, knockback: 600 };
/** Fear things out of the Battery. */
const SPAWN = { every: 20, first: 12 };
const TOUGHNESS = 2.6;
const MIGHT = 3.2;
export const DRAINED_LIMIT = 3;
const FINALE_TIME = 5;

export type GuardianState = 'free' | 'warned' | 'held' | 'drained';

export interface Guardian {
	x: number;
	y: number;
	state: GuardianState;
	/** Warning or drain progress, 0..1. */
	k: number;
	grip: Dummy | null;
	/** Can't be taken again until this runs out. */
	rest: number;
}

interface Slam {
	x: number;
	y: number;
	warn: number;
	age: number;
}

export function buildUnboundMap(): GameMap {
	return {
		name: 'Oa · the Central Battery',
		environment: 'planet',
		ground: 'oa',
		width: W,
		height: H,
		spawn: ENTRY,
		battery: { x: ENTRY.x - 300, y: ENTRY.y + 80 },
		dummies: [],
		obstacles: [{ kind: 'building', x: BATTERY.x - 150, y: BATTERY.y - 60, w: 300, h: 120, height: 60, blocksFlying: false, seed: 0, hidden: true }]
	};
}

export class Unbound implements MissionDirector {
	state: MissionState = 'intro';
	timer = INTRO_TIME;
	lives = LIVES;
	downs = 0;
	elapsed = 0;
	failReason: 'drained' | 'down' | null = null;
	readonly comms = new Comms();
	readonly starHint = '★ done · ★ no Guardian drained · ★ Hal never went down';
	readonly outroAfter = FINALE_TIME + 1.5;
	readonly guardians: Guardian[] = GUARDIAN_SPOTS.map((g) => ({ ...g, state: 'free' as GuardianState, k: 0, grip: null, rest: 0 }));
	slams: Slam[] = [];
	gripsCut = 0;
	/** At the end: Parallax going up and away. */
	leaving = 0;
	private grabIn = 4;
	private slamIn = SLAM.every;
	private spawnIn = SPAWN.first;
	private crew: Enemy[] = [];
	private wasDown = false;
	private said = new Set<string>();
	/** How hard it's been hit lately (it flinches): from grips cut. */
	private flinch = 0;

	// ------------------------------------------------------------ reporting

	get drained(): number {
		return this.guardians.filter((g) => g.state === 'drained').length;
	}

	get objective(): string {
		if (this.state === 'won') return 'It is leaving Oa';
		if (this.guardians.some((g) => g.state === 'held')) return 'Break the tendril’s grip on the Guardian! (SONIC BOOM cuts straight through)';
		return 'Protect the Guardians from Parallax';
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const list: MissionMeter[] = [{ label: 'Hold out', value: Math.min(1, this.elapsed / SURVIVE), text: `${Math.max(0, Math.ceil(SURVIVE - this.elapsed))}s` }];
		this.guardians.forEach((g, i) => {
			if (g.state === 'held') list.push({ label: `Guardian ${i + 1}`, value: 1 - g.k, text: `${Math.round((1 - g.k) * 100)}%`, low: g.k > 0.6 });
		});
		list.push({ label: 'Guardians drained', value: this.drained / DRAINED_LIMIT, text: `${this.drained} / ${DRAINED_LIMIT}`, low: this.drained >= DRAINED_LIMIT - 1 });
		return list;
	}

	warning(): string | null {
		if (this.state !== 'playing') return null;
		if (this.guardians.some((g) => g.state === 'held' && g.k > 0.6)) return 'A Guardian is going grey! Break that grip!';
		if (this.guardians.some((g) => g.state === 'warned')) return 'It is reaching for a Guardian!';
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.drained === 0 ? 1 : 0) + (this.downs === 0 ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'won') return 'Parallax left Oa the way it came: up, and out, toward a small blue world in Sector 2814.';
		if (this.failReason === 'drained') return 'Parallax drained the Guardians grey, one after another.';
		return 'Hal went down one time too many.';
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		return [
			{ label: 'Grips broken', value: `${this.gripsCut}` },
			{ label: 'Guardians drained', value: `${this.drained}` },
			{ label: 'Times down', value: `${this.downs}` },
			{ label: 'Time', value: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
		];
	}

	// ---------------------------------------------------------------- rules

	update(game: Game, dt: number) {
		this.comms.update(dt);
		this.flinch = Math.max(0, this.flinch - dt);
		switch (this.state) {
			case 'intro':
				this.timer -= dt;
				if (this.timer <= 0) this.start(game);
				return;
			case 'won':
				this.timer += dt;
				this.leaving = Math.min(1, this.timer / FINALE_TIME);
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
			this.comms.say('Kilowog', 'JORDAN! On your feet, poozer!', true);
		}
		this.wasDown = hal.downed;

		this.reach(game, dt);
		this.slam(game, dt);
		this.spawn(game, dt);
		if (this.elapsed >= SURVIVE) return this.win(game);
	}

	private start(game: Game) {
		this.state = 'playing';
		// His new Sonic Boom, and the Carrier Strike, in his kit for this
		const hal = game.players[0];
		const give = (id: 'sonicBoom' | 'carrierStrike', instead: string) => {
			if (hal.loadout.some((d) => d.id === id)) return;
			const at = hal.loadout.findIndex((d) => d.id === instead);
			const slot = at >= 0 ? at : hal.loadout.length - 1;
			hal.loadout[slot] = CONSTRUCTS[id];
			hal.cooldowns[slot] = 0;
		};
		give('sonicBoom', 'chaff');
		give('carrierStrike', 'targetingLock');
		this.comms.scene([
			['Guardians', 'Lanterns. It will come for us. Keep it from us.'],
			['Kilowog', "When it grabs one of 'em, hit the grip, not the big ugly. The GRIP!"],
			['Hal', `Something new, then. Faster than it can think. (SONIC BOOM: key ${this.slotOf(hal, 'sonicBoom') + 1})`]
		]);
	}

	private slotOf(p: Player, id: string): number {
		return p.loadout.findIndex((d) => d.id === id);
	}

	/** It reaches for the Guardians: warned, then held, then drained, unless the grip is broken. */
	private reach(game: Game, dt: number) {
		for (const g of this.guardians) {
			g.rest = Math.max(0, g.rest - dt);
			if (g.state === 'warned') {
				g.k += dt / GRAB.warn;
				if (g.k >= 1) this.grip(game, g);
			} else if (g.state === 'held') {
				if (!g.grip || !isStanding(g.grip)) {
					// Cut free
					g.state = 'free';
					g.k = 0;
					g.rest = 8;
					g.grip = null;
					this.gripsCut++;
					this.flinch = 1;
					game.constructs.effects.push({ kind: 'callout', x: g.x, y: g.y - 120, age: 0, life: 1.2, text: 'CUT FREE' });
					this.once('cut', 'Guardians', 'It lets go. Again, Lanterns. It will not stop reaching.');
					continue;
				}
				g.k += dt / GRAB.drain;
				g.grip.raised = heldLift(g);
				if (g.k >= 1) {
					g.state = 'drained';
					g.grip.hp = 0;
					g.grip = null;
					this.comms.say('Kilowog', this.drained >= DRAINED_LIMIT - 1 ? "Another one gone grey! One more and we've lost the plaza!" : 'It drained him... he’s gone grey!', true);
					if (this.drained >= DRAINED_LIMIT) return this.lose('drained');
				}
			}
		}
		this.grabIn -= dt;
		if (this.grabIn > 0) return;
		const most = [...HOLDS].reverse().find((h) => this.elapsed >= h.after)!.most;
		const busy = this.guardians.filter((g) => g.state === 'held' || g.state === 'warned').length;
		const pick = this.guardians.filter((g) => g.state === 'free' && g.rest <= 0);
		if (busy >= most || pick.length === 0) {
			this.grabIn = 1;
			return;
		}
		const g = pick[Math.floor(Math.random() * pick.length)];
		g.state = 'warned';
		g.k = 0;
		this.grabIn = Math.max(GRAB.fastest, GRAB.every - this.elapsed / 30);
		this.once('reach', 'Hal', 'It’s reaching for one of them! Get under it!');
	}

	private grip(game: Game, g: Guardian) {
		g.state = 'held';
		g.k = 0;
		const d = createDummy(g.x, g.y);
		d.kind = 'parallaxGrip';
		d.hp = d.maxHp = GRAB.gripHp;
		d.respawns = false;
		d.priority = true;
		d.raised = heldLift(g);
		game.dummies.push(d);
		g.grip = d;
		if (this.gripsCut === 0) this.once('grip', 'Kilowog', 'It’s got one! Hit the GRIP, where it’s wrapped round him!');
	}

	/** It brings a tendril down on a Lantern: the ring on the ground first, then the blow. */
	private slam(game: Game, dt: number) {
		this.slamIn -= dt;
		if (this.slamIn <= 0) {
			this.slamIn = SLAM.every * (this.elapsed > 90 ? 0.75 : 1);
			const targets = game.players.filter((p) => !p.downed);
			const t = targets[Math.floor(Math.random() * targets.length)];
			if (t) this.slams.push({ x: t.x, y: t.y, warn: SLAM.warn, age: 0 });
		}
		for (const s of [...this.slams]) {
			s.age += dt;
			if (s.warn > 0) {
				s.warn -= dt;
				if (s.warn <= 0) {
					for (const p of game.players) {
						if (p.downed || Math.hypot(p.x - s.x, (p.y - s.y) * 1.3) > SLAM.radius) continue;
						damagePlayer(game.constructs, p, SLAM.damage, s.x, s.y, SLAM.knockback);
						addDread(p, 0.06);
					}
					game.constructs.effects.push({ kind: 'shockwave', x: s.x, y: s.y, age: 0, life: 0.5, radius: SLAM.radius * 1.2 } as never);
					this.once('slam', 'Hal', 'Watch the ground: where the yellow ring shows, it’s coming down!');
				}
			} else if (s.age > SLAM.warn + 0.5) this.slams.splice(this.slams.indexOf(s), 1);
		}
	}

	/** Fear things out of the broken Battery. */
	private spawn(game: Game, dt: number) {
		this.spawnIn -= dt;
		this.crew = this.crew.filter(isStanding);
		if (this.spawnIn > 0) return;
		this.spawnIn = SPAWN.every;
		const plan: { kind: EnemyKind; role: Role }[] =
			this.elapsed > 70
				? [
						{ kind: 'fearHound', role: 'berserker' },
						{ kind: 'fearGrunt', role: 'gunner' },
						{ kind: 'fearHound', role: 'hunter' }
					]
				: [
						{ kind: 'fearHound', role: 'berserker' },
						{ kind: 'fearGrunt', role: 'gunner' }
					];
		if (this.crew.length > 4) return;
		plan.forEach((m, i) => {
			const e = game.spawnEnemy(m.kind, BATTERY.x - 100 + i * 100, BATTERY.y + 140, m.role);
			e.brain.grit = TOUGHNESS;
			e.brain.might = MIGHT;
			e.brain.alert = 10;
			e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * TOUGHNESS);
			this.crew.push(e);
		});
	}

	private once(id: string, who: string, text: string) {
		if (this.said.has(id)) return;
		this.said.add(id);
		this.comms.say(who, text, true);
	}

	private win(game: Game) {
		this.state = 'won';
		this.timer = 0;
		for (const g of this.guardians) {
			if (g.grip) g.grip.hp = 0;
			if (g.state !== 'drained') g.state = 'free';
			g.grip = null;
		}
		this.slams.length = 0;
		for (const e of game.enemies) if (isStanding(e)) e.hp = 0;
		for (const p of game.players) p.victoryTimer = 0.4;
		this.comms.scene([
			['Parallax', 'ENOUGH OF YOUR LITTLE GODS. THERE IS A WORLD THAT IS SO VERY AFRAID. I CAN HEAR IT FROM HERE.'],
			['Hal', "It's going... up. Out. Kilowog, which way is it heading?"],
			['Kilowog', 'Sector 2814, poozer. Your sector.'],
			['Hal', 'Earth.']
		]);
	}

	private lose(reason: 'drained' | 'down') {
		if (this.state !== 'playing') return;
		this.state = 'lost';
		this.failReason = reason;
	}

	// -------------------------------------------------------------- drawing

	/** The top and middle of the screen, in the world: it looms over whatever is in view. */
	private view = { x: PARALLAX.x, top: PARALLAX.y - PX_LIFT - 200 };

	/** Its head, where it's drawn: high in the view, leaning toward the Battery it came out of; higher as it leaves at the end. */
	private parallaxAt(): { x: number; y: number } {
		const up = this.leaving * this.leaving * 1400;
		return { x: this.view.x + (PARALLAX.x - this.view.x) * 0.35, y: this.view.top + 115 - up };
	}

	cameraPoints(): [number, number][] {
		const pts: [number, number][] = [];
		for (const g of this.guardians) if (g.state === 'held' || g.state === 'warned') pts.push([g.x, g.y]);
		return pts;
	}

	goal(): { x: number; y: number } | null {
		if (this.state !== 'playing') return null;
		const held = this.guardians.filter((g) => g.state === 'held').sort((a, b) => b.k - a.k)[0];
		if (held?.grip) return held.grip;
		const warned = this.guardians.find((g) => g.state === 'warned');
		return warned ?? null;
	}

	get goalFirst(): boolean {
		return this.guardians.some((g) => g.state === 'held');
	}

	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		// Where the screen is, in the world (from the canvas transform)
		const m = ctx.getTransform();
		if (m.d > 0) this.view = { x: (ctx.canvas.width / 2 - m.e) / m.a, top: -m.f / m.d };
		const list: Drawable[] = [{ baseY: BATTERY.y + 60, draw: () => drawBrokenBattery(ctx, BATTERY.x, BATTERY.y, time) }];
		// Parallax over everything at the back, its tendrils down to whoever it has
		const at = this.parallaxAt();
		const grabs = this.guardians.filter((g) => g.state === 'held' || g.state === 'warned').map((g) => ({ x: g.x, y: g.y - 60, k: g.state === 'held' ? 1 : g.k * 0.85 }));
		for (const s of this.slams) if (s.warn > 0 && s.warn < 0.5) grabs.push({ x: s.x, y: s.y, k: 1 - s.warn / 0.5 });
		list.push({ baseY: -1e6 + 3, draw: () => drawParallax(ctx, at.x, at.y, PX_SIZE * (1 - this.leaving * 0.5), time, { grabs, hit: this.flinch, rage: 0.6 + 0.4 * Math.min(1, this.elapsed / SURVIVE), reach: 0.5 }) });
		for (const g of this.guardians) list.push({ baseY: g.y, draw: () => drawPlazaGuardian(ctx, g, at, time) });
		for (const s of this.slams) list.push({ baseY: -1e6 + 2, draw: () => drawSlamMark(ctx, s, time) });
		return list;
	}
}

// ------------------------------------------------------------- drawing helpers

/** A Guardian in the plaza: pouring will up at it; with a tendril wrapped round them, lifted and draining; or grey on the ground. */
/** How high a held Guardian is lifted: higher as they drain. */
const heldLift = (g: Guardian) => 30 + g.k * 50;

function drawPlazaGuardian(ctx: CanvasRenderingContext2D, g: Guardian, px: { x: number; y: number }, time: number) {
	const S = 1.45;
	ctx.save();
	if (g.state === 'drained') {
		ctx.translate(g.x, g.y);
		ctx.rotate(-1.3);
		ctx.globalAlpha = 0.85;
		ctx.scale(S, S);
		drawGuardian(ctx, 0, 0, 0, 1, time);
		ctx.restore();
		// Grey, still
		ctx.save();
		ctx.fillStyle = 'rgba(120, 120, 120, 0.55)';
		ctx.beginPath();
		ctx.ellipse(g.x - 40, g.y - 8, 60, 22, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
		return;
	}
	const lift = g.state === 'held' ? heldLift(g) + Math.sin(time * 9) * 3 : 0;
	ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
	ctx.beginPath();
	ctx.ellipse(g.x, g.y, 26, 8, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.translate(g.x, g.y - lift);
	ctx.scale(S, S);
	drawGuardian(ctx, 0, 0, g.state === 'free' ? 1 : 0, g.state === 'held' ? g.k : 0, time + g.x);
	ctx.restore();
	if (g.state === 'free') {
		// Their will, a thin beam up at it
		ctx.save();
		ctx.globalCompositeOperation = 'lighter';
		ctx.strokeStyle = `rgba(80, 255, 130, ${0.25 + 0.1 * Math.sin(time * 6 + g.x)})`;
		ctx.lineWidth = 5;
		ctx.beginPath();
		ctx.moveTo(g.x, g.y - 110);
		ctx.lineTo(px.x + (g.x - px.x) * 0.15, px.y + 40);
		ctx.stroke();
		ctx.restore();
	}
	if (g.state === 'warned') {
		// Where it's coming down: a yellow ring tightening on them
		ctx.save();
		ctx.strokeStyle = `rgba(255, 200, 50, ${0.6 + 0.4 * Math.sin(time * 14)})`;
		ctx.lineWidth = 4;
		const r = 140 - g.k * 90;
		ctx.beginPath();
		ctx.ellipse(g.x, g.y, r, r * 0.42, 0, 0, Math.PI * 2);
		ctx.stroke();
		ctx.fillStyle = '#ffd23a';
		ctx.font = 'bold 34px system-ui, sans-serif';
		ctx.textAlign = 'center';
		ctx.fillText('!', g.x, g.y - 150);
		ctx.restore();
	}
	if (g.state === 'held') {
		// The grip: coils of yellow round them, the thing to hit, with its health
		const hp = g.grip ? g.grip.hp / g.grip.maxHp : 0;
		// Centred on the grip's body (BODY.parallaxGrip, raised with them), so shots go where the coils are
		const cy = g.y - lift - 60;
		ctx.save();
		ctx.lineCap = 'round';
		for (let i = 0; i < 4; i++) {
			const a = time * 3 + i * 1.6;
			ctx.strokeStyle = 'rgba(90, 50, 6, 0.95)';
			ctx.lineWidth = 16;
			ctx.beginPath();
			ctx.ellipse(g.x, cy - 30 + i * 22, 34, 11, Math.sin(a) * 0.3, 0, Math.PI * 2);
			ctx.stroke();
			ctx.strokeStyle = 'rgba(245, 190, 50, 0.95)';
			ctx.lineWidth = 8;
			ctx.stroke();
		}
		ctx.globalCompositeOperation = 'lighter';
		const glow = ctx.createRadialGradient(g.x, cy, 0, g.x, cy, 110);
		glow.addColorStop(0, `rgba(255, 220, 90, ${0.25 + 0.35 * g.k})`);
		glow.addColorStop(1, 'rgba(255, 180, 0, 0)');
		ctx.fillStyle = glow;
		ctx.beginPath();
		ctx.arc(g.x, cy, 110, 0, Math.PI * 2);
		ctx.fill();
		ctx.globalCompositeOperation = 'source-over';
		// Grip health
		ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
		ctx.fillRect(g.x - 50, cy - 110, 100, 10);
		ctx.fillStyle = '#ffcf2e';
		ctx.fillRect(g.x - 49, cy - 109, 98 * hp, 8);
		ctx.fillStyle = '#fff4c8';
		ctx.font = 'bold 13px system-ui, sans-serif';
		ctx.textAlign = 'center';
		ctx.fillText('BREAK THE GRIP', g.x, cy - 118);
		ctx.restore();
	}
}

function drawSlamMark(ctx: CanvasRenderingContext2D, s: Slam, time: number) {
	ctx.save();
	if (s.warn > 0) {
		const k = 1 - s.warn / SLAM.warn;
		ctx.fillStyle = `rgba(255, 190, 40, ${0.12 + 0.2 * k})`;
		ctx.beginPath();
		ctx.ellipse(s.x, s.y, SLAM.radius, SLAM.radius * 0.42, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = `rgba(255, 210, 70, ${0.6 + 0.4 * Math.sin(time * 16)})`;
		ctx.lineWidth = 4;
		ctx.stroke();
		ctx.beginPath();
		ctx.ellipse(s.x, s.y, SLAM.radius * k, SLAM.radius * 0.42 * k, 0, 0, Math.PI * 2);
		ctx.stroke();
	} else {
		// Cracks where it hit
		const k = (s.age - SLAM.warn) / 0.5;
		ctx.strokeStyle = `rgba(255, 210, 90, ${0.8 * (1 - k)})`;
		ctx.lineWidth = 3;
		ctx.beginPath();
		for (let i = 0; i < 7; i++) {
			const a = (i / 7) * Math.PI * 2;
			ctx.moveTo(s.x, s.y);
			ctx.lineTo(s.x + Math.cos(a) * SLAM.radius, s.y + Math.sin(a) * SLAM.radius * 0.42);
		}
		ctx.stroke();
	}
	ctx.restore();
}

/** The Central Battery broken open: the shell split, shards of it round the base, yellow pouring out of the top. */
function drawBrokenBattery(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
	ctx.save();
	// Yellow light boiling up out of it
	ctx.globalCompositeOperation = 'lighter';
	const g = ctx.createRadialGradient(x, y - 300, 20, x, y - 300, 380);
	g.addColorStop(0, 'rgba(255, 210, 60, 0.4)');
	g.addColorStop(1, 'rgba(255, 160, 0, 0)');
	ctx.fillStyle = g;
	ctx.fillRect(x - 400, y - 700, 800, 760);
	ctx.globalCompositeOperation = 'source-over';
	// The base, then the two broken halves of the body leaning apart
	ctx.fillStyle = '#0c2a1d';
	ctx.strokeStyle = 'rgba(120, 255, 170, 0.5)';
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.moveTo(x - 150, y);
	ctx.lineTo(x - 110, y - 80);
	ctx.lineTo(x + 110, y - 80);
	ctx.lineTo(x + 150, y);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	for (const side of [-1, 1]) {
		ctx.save();
		ctx.translate(x + side * 20, y - 80);
		ctx.rotate(side * 0.16);
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(side * 120, 0);
		ctx.lineTo(side * 120, -380);
		ctx.lineTo(side * 40, -330);
		ctx.lineTo(side * 70, -250);
		ctx.lineTo(0, -280);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
		// What's left of its green window, flickering yellow
		ctx.fillStyle = `rgba(${200 + 55 * Math.sin(time * 9 + side) ** 2}, 230, 90, 0.45)`;
		ctx.fillRect(side > 0 ? 30 : -100, -320, 70, 220);
		ctx.fillStyle = '#0c2a1d';
		ctx.restore();
	}
	// Shards round the base
	ctx.fillStyle = '#123a28';
	for (let i = 0; i < 9; i++) {
		const sx = x - 260 + ((i * 67) % 520);
		const sy = y + 20 + ((i * 29) % 60);
		ctx.beginPath();
		ctx.moveTo(sx, sy);
		ctx.lineTo(sx + 26, sy - 34 - (i % 3) * 10);
		ctx.lineTo(sx + 40, sy);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
	}
	ctx.restore();
}
