// Act 3, Mission 2: Dex-Starr.
//
// When the Red fleet broke off from Oa, one of its dreadnoughts didn't make
// it: it came down on the far plains. Dex-Starr went down with it, and he has
// Ganthet. Hal and John go after him (you choose; the other fights beside you).
//
//   track     follow his trail: glowing paw prints across the crash site to
//             where he's gone to ground. Keep up: the trail goes cold if you
//             fall too far behind, and if it does, he's gone
//   ambush    he's waiting, with Red Lanterns. Hurt him enough and he bolts to
//             the next hiding place, dragging Ganthet's bubble with him
//   (three hiding places, then he's cornered at the dreadnought's bow)
//   rescue    beaten down, he drops Ganthet and runs for good. Break the
//             bubble before the last of the Reds get Ganthet away
//   freed     Ganthet tells them where Atrocitus is going
//
// Lose: the trail goes cold, or your Lantern goes down 3 times.

import { createDummy, isStanding, type Dummy } from '../dummy';
import { drawDreadnoughtBow, drawHullPlate, drawPawPrints, drawRageBubble } from '../draw/wreck';
import type { Enemy, EnemyKind, Role } from '../enemies/enemies';
import type { Drawable, Game } from '../game';
import { seededRandom, type GameMap, type Obstacle } from '../map';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

export type HuntPhase = 'track' | 'ambush' | 'flee' | 'rescue' | 'freed';

export const HUNT_LIVES = 3;
const INTRO_TIME = 3;
/** Dex-Starr: health and might on top of his base. */
const DEX_HEALTH = 16;
const DEX_MIGHT = 4.4;
/** Red Lanterns with him. */
const TOUGHNESS = 3.8;
const MIGHT = 4.1;
const LIEUTENANT_HEALTH = 4;
/** His health (0..1) where he bolts from each hiding place; at the last he drops Ganthet. */
export const BOLT_AT = [0.78, 0.56, 0.34, 0.12];
/** Seconds he takes to reach the next hiding place. */
export const FLEE_TIME = 3.2;
/** Get this close to where he's hiding and he springs his ambush. */
const AMBUSH_RANGE = 520;
/** The trail (0..1): cold if you're this far behind him, warm this close; how fast it cools and warms. */
const COLD = 700;
const WARM = 480;
const COOL_RATE = 0.05;
const WARM_RATE = 0.12;
/** Ganthet's bubble, once he drops it. */
export const BUBBLE_HP = 2200;
/** The most one hit can take off a Lantern. */
const MAX_HIT = 36;

const W = 3600;
const H = 2200;
const ENTRY = { x: 380, y: 1450 };
/** Where he goes to ground, in order; the last is at the dreadnought's bow. */
export const HIDEOUTS = [
	{ x: 1050, y: 1050 },
	{ x: 1900, y: 620 },
	{ x: 2650, y: 1450 },
	{ x: 3150, y: 1000 }
];
const BOW = { x: 3200, y: 640 };

type Wave = [EnemyKind, number, number, Role?][];
const AMBUSHES: Wave[] = [
	[
		['rageGrunt', -260, 120, 'berserker'],
		['rageGrunt', 240, -140, 'hunter'],
		['rageGrunt', 180, 220, 'gunner'],
		['rageGrunt', -200, -200, 'berserker'],
		['rageGrunt', 320, 40, 'gunner']
	],
	[
		['rageGrunt', -280, 160, 'berserker'],
		['rageGrunt', 280, 140, 'hunter'],
		['rageGrunt', 0, 300, 'gunner'],
		['rageGrunt', -320, -80, 'gunner'],
		['rageGrunt', 320, -60, 'berserker'],
		['rageGrunt', 0, -320, 'hunter']
	],
	[
		['rageGrunt', -300, 0, 'berserker'],
		['rageGrunt', 300, 0, 'berserker'],
		['rageGrunt', -200, -260, 'hunter'],
		['rageGrunt', 200, -260, 'hunter'],
		['rageGrunt', 0, 280, 'gunner'],
		['zox', 0, -360]
	],
	[
		['rageGrunt', -320, 100, 'berserker'],
		['rageGrunt', 320, 100, 'hunter'],
		['rageGrunt', -240, -220, 'gunner'],
		['rageGrunt', 240, -220, 'gunner'],
		['skallox', 0, 320]
	]
];
/** The last of them, going for Ganthet once he's dropped. */
const LAST_STAND: Wave = [
	['rageGrunt', -420, 180, 'berserker'],
	['rageGrunt', 420, 180, 'berserker'],
	['rageGrunt', -380, -200, 'hunter'],
	['rageGrunt', 380, -200, 'gunner']
];

/** The crash site: the ash of Oa's far plains, hull plates everywhere, the bow at the far end. */
export function buildCrashSiteMap(): GameMap {
	const rand = seededRandom(1402);
	const obstacles: Obstacle[] = [];
	// The bow itself is solid
	obstacles.push({ kind: 'rock', x: BOW.x - 330, y: BOW.y - 80, w: 660, h: 90, height: 0, blocksFlying: false, seed: 0, hidden: true });
	for (let i = 0; i < 40 && obstacles.length < 24; i++) {
		const w = 60 + rand() * 80;
		const h = 22 + rand() * 18;
		const x = 250 + rand() * (W - 500);
		const y = 250 + rand() * (H - 450);
		const clear = [ENTRY, ...HIDEOUTS, BOW].every((p) => Math.hypot(p.x - x, p.y - y) > 300);
		if (!clear) continue;
		obstacles.push({ kind: 'rock', x, y, w, h, height: 60 + rand() * 70, blocksFlying: false, seed: rand(), hidden: true });
	}
	return {
		name: "Oa · The Dreadnought's Crash",
		environment: 'planet',
		ground: 'ash',
		width: W,
		height: H,
		spawn: ENTRY,
		battery: { x: ENTRY.x - 200, y: ENTRY.y - 60 },
		dummies: [],
		obstacles
	};
}

export class DexStarrHunt implements MissionDirector {
	state: MissionState = 'intro';
	phase: HuntPhase = 'track';
	/** Which hiding place he's at (or running to). */
	hideout = 0;
	timer = INTRO_TIME;
	lives = HUNT_LIVES;
	elapsed = 0;
	downs = 0;
	defeated = 0;
	/** How warm the trail is (1 hot .. 0 cold: he's gone), and the coldest it's been. */
	trail = 1;
	coldest = 1;
	failReason: 'lantern' | 'escaped' | null = null;
	readonly comms = new Comms();
	readonly starHint = '★ Ganthet rescued · ★ no lives lost · ★ never let the trail go below half';
	dex: Enemy | null = null;
	bubble: Dummy | null = null;
	/** Where Ganthet's bubble is, while Dex-Starr has it. */
	private carried = { ...HIDEOUTS[0] };
	private reds: Enemy[] = [];
	private counted = new WeakSet<Enemy>();
	private prints: { x: number; y: number; age: number; angle: number }[] = [];
	private flight: { from: { x: number; y: number }; to: { x: number; y: number }; hp: number } | null = null;
	private heldHp = 0;
	private wasDown = false;
	private clock = 0;
	private said = new Set<string>();
	private map: GameMap | null = null;

	// ------------------------------------------------------------ reporting

	get objective(): string {
		switch (this.phase) {
			case 'track':
				return 'Follow the paw prints: find Dex-Starr';
			case 'ambush':
				return this.hideout === HIDEOUTS.length - 1 ? 'Cornered at the bow: bring him down' : 'Dex-Starr! Hurt him and he runs: stay on him';
			case 'flee':
				return 'He is running: keep up, or the trail goes cold';
			case 'rescue':
				return "He dropped Ganthet: break the bubble";
			case 'freed':
				return 'Ganthet is free';
		}
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const list: MissionMeter[] = [];
		if (this.phase !== 'rescue' && this.phase !== 'freed') list.push({ label: 'Trail', value: this.trail, text: this.trail > 0.66 ? 'Hot' : this.trail > 0.33 ? 'Warm' : 'Going cold', low: this.trail < 0.33 });
		const d = this.dex;
		if (d && isStanding(d) && this.phase !== 'rescue') list.push({ label: 'Dex-Starr', value: d.hp / d.maxHp, text: '' });
		if (this.bubble && isStanding(this.bubble)) list.push({ label: 'Bubble', value: this.bubble.hp / this.bubble.maxHp, text: '' });
		return list;
	}

	warning(): string | null {
		if (this.trail < 0.25 && (this.phase === 'track' || this.phase === 'flee')) return 'THE TRAIL IS GOING COLD';
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.downs === 0 ? 1 : 0) + (this.coldest >= 0.5 ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'won') return 'Ganthet is free. Dex-Starr got away, but Ganthet knows where Atrocitus is going: Ysmault, and the Book of the Black.';
		if (this.failReason === 'escaped') return 'The trail went cold. Dex-Starr is gone, and Ganthet with him.';
		return 'Your Lantern went down one time too many.';
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		return [
			{ label: 'Red Lanterns beaten', value: `${this.defeated}` },
			{ label: 'Coldest the trail got', value: `${Math.round(this.coldest * 100)}%` },
			{ label: 'Lives lost', value: `${this.downs}` },
			{ label: 'Time', value: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
		];
	}

	/** Chasing, the bot follows him even through a fight. */
	get goalFirst(): boolean {
		return this.phase === 'flee' || (this.phase === 'track' && this.clock > 2);
	}

	goal(): { x: number; y: number } | null {
		if (this.bubble && isStanding(this.bubble)) return this.bubble;
		if (this.phase === 'freed') return null;
		return this.dex ?? HIDEOUTS[this.hideout];
	}

	// ---------------------------------------------------------------- rules

	update(game: Game, dt: number) {
		this.comms.update(dt);
		this.map ??= game.map;
		for (const p of this.prints) p.age += dt;
		if (this.prints.length > 0 && this.prints[0].age > 14) this.prints = this.prints.filter((p) => p.age <= 14);
		this.countDefeats();
		switch (this.state) {
			case 'intro':
				this.timer -= dt;
				if (this.timer <= 0) {
					this.state = 'playing';
					game.constructs.maxHit = MAX_HIT;
					this.spawnDex(game);
					this.comms.scene([
						['Dex-Starr', 'Blue-light men follow Dex-Starr? Dex-Starr is not scared. Dex-Starr is GOOD KITTY.'],
						['John', "Paw prints. Glowing red paw prints. There's a sentence I never thought I'd say."],
						['Hal', "Stay on him. If he gets off this rock with Ganthet, we're not getting him back."]
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
		this.followTrail(game, dt);
		if (this.state !== 'playing') return;

		switch (this.phase) {
			case 'track':
				this.hold(this.dex!, HIDEOUTS[this.hideout]);
				if (this.nearest(game, HIDEOUTS[this.hideout]) < AMBUSH_RANGE) this.ambush(game);
				break;
			case 'ambush': {
				const dex = this.dex!;
				this.carried = { ...HIDEOUTS[this.hideout] };
				if (dex.hp <= dex.maxHp * BOLT_AT[this.hideout]) {
					if (this.hideout === HIDEOUTS.length - 1) this.dropGanthet(game);
					else this.bolt(game);
				}
				break;
			}
			case 'flee':
				this.flee();
				break;
			case 'rescue':
				if (this.bubble && !isStanding(this.bubble)) this.free(game);
				break;
			case 'freed':
				for (const p of game.players) p.invuln = Math.max(p.invuln, 1);
				if (!this.comms.current) this.win(game);
				break;
		}
	}

	private spawnDex(game: Game) {
		const at = HIDEOUTS[0];
		const d = game.spawnEnemy('dexStarr', at.x, at.y);
		d.hp = d.maxHp = d.brain.lastHp = Math.round(d.maxHp * DEX_HEALTH);
		d.brain.might = DEX_MIGHT;
		d.brain.grit = TOUGHNESS;
		d.brain.alert = 10;
		this.dex = d;
		this.heldHp = d.hp;
	}

	/** Waiting for you (or running): he can't be hurt, and doesn't fight. */
	private hold(dex: Enemy, at: { x: number; y: number }) {
		dex.hp = dex.brain.lastHp = this.heldHp;
		dex.x = dex.prevX = at.x + 40;
		dex.y = dex.prevY = at.y - 20;
		dex.vx = dex.vy = 0;
		dex.stun = Math.max(dex.stun, 0.2);
		dex.dir = -1;
	}

	private nearest(game: Game, to: { x: number; y: number }): number {
		let best = Infinity;
		for (const p of game.players) if (!p.downed) best = Math.min(best, Math.hypot(p.x - to.x, p.y - to.y));
		return best;
	}

	/** The trail cools while you're far behind him, and warms when you're close. Cold: he's gone. */
	private followTrail(game: Game, dt: number) {
		if (this.phase === 'rescue' || this.phase === 'freed' || !this.dex) return;
		const d = this.nearest(game, this.dex);
		if (d > COLD) this.trail = Math.max(0, this.trail - COOL_RATE * dt);
		else if (d < WARM || this.phase === 'ambush') this.trail = Math.min(1, this.trail + WARM_RATE * dt);
		this.coldest = Math.min(this.coldest, this.trail);
		if (this.trail < 0.5) this.once('cooling', () => this.comms.say('John', "We're losing him! Move!", true));
		if (this.trail <= 0) {
			this.state = 'lost';
			this.failReason = 'escaped';
			game.downedNotice = false;
			this.comms.clear();
		}
	}

	private ambush(game: Game) {
		this.phase = 'ambush';
		this.clock = 0;
		const at = HIDEOUTS[this.hideout];
		for (const [kind, dx, dy, role] of AMBUSHES[this.hideout]) this.spawn(game, kind, at.x + dx, at.y + dy, role);
		this.dex!.stun = 0;
		const lines: [string, string][][] = [
			[['Dex-Starr', 'SURPRISE! Dex-Starr has friends! Bad Lanterns get SCRATCHED!']],
			[['Dex-Starr', 'Dex-Starr is not tired. Dex-Starr is NEVER tired. Get them!']],
			[
				['Dex-Starr', 'Big mouth, eat the blue-light men!'],
				['Zox', 'ZOX WILL EAT THEM FOR THE KITTY!']
			],
			[
				['Dex-Starr', 'No more running. Dex-Starr is angry now. VERY angry.'],
				['Hal', "He's cornered. That's when cats are worst. Watch the claws, John!"]
			]
		];
		this.comms.scene(lines[this.hideout]);
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

	/** Hurt enough: he bolts for the next hiding place, dragging Ganthet with him, leaving a trail. */
	private bolt(game: Game) {
		const dex = this.dex!;
		this.phase = 'flee';
		this.clock = 0;
		this.heldHp = dex.hp;
		const from = { x: dex.x, y: dex.y };
		this.hideout++;
		this.flight = { from, to: HIDEOUTS[this.hideout], hp: dex.hp };
		game.constructs.effects.push({ kind: 'callout', x: dex.x, y: dex.y - 120, age: 0, life: 1.6, text: 'HE RUNS!', hurt: true });
		const taunts = ['Dex-Starr is going now. Bye bye, stupid Lanterns!', 'You cannot catch Dex-Starr! Nobody catches Dex-Starr!', 'Dex-Starr knows a place. A GOOD place.'];
		this.comms.say('Dex-Starr', taunts[Math.min(taunts.length - 1, this.hideout - 1)], true);
	}

	private flee() {
		const dex = this.dex!;
		const f = this.flight!;
		const k = Math.min(1, this.clock / FLEE_TIME);
		// Out and round, not a straight line
		const ease = k * k * (3 - 2 * k);
		const bend = Math.sin(k * Math.PI) * 220;
		const dx = f.to.x - f.from.x;
		const dy = f.to.y - f.from.y;
		const len = Math.hypot(dx, dy) || 1;
		const x = f.from.x + dx * ease + (-dy / len) * bend;
		const y = f.from.y + dy * ease + (dx / len) * bend;
		dex.dir = dx > 0 ? 1 : -1;
		const last = this.prints[this.prints.length - 1];
		if (!last || Math.hypot(last.x - x, last.y - y) > 42) this.prints.push({ x, y: y + 6, age: 0, angle: Math.atan2(dy, dx) });
		dex.hp = dex.brain.lastHp = this.heldHp;
		dex.x = dex.prevX = x;
		dex.y = dex.prevY = y;
		dex.vx = dex.vy = 0;
		dex.stun = 0.2;
		this.carried = { x, y };
		if (k >= 1) {
			this.phase = 'track';
			this.clock = 0;
			this.flight = null;
		}
	}

	/** Beaten down at the bow: he drops Ganthet and runs for good. The last of them go for the bubble. */
	private dropGanthet(game: Game) {
		const dex = this.dex!;
		this.phase = 'rescue';
		this.clock = 0;
		const at = HIDEOUTS[this.hideout];
		const b = createDummy(at.x, at.y + 60);
		b.kind = 'rageBubble';
		b.hp = b.maxHp = BUBBLE_HP;
		b.respawns = false;
		game.dummies.push(b);
		this.bubble = b;
		// Gone: up over the bow and away
		dex.hp = 0;
		dex.down = 0.6;
		this.counted.add(dex);
		game.constructs.effects.push({ kind: 'callout', x: dex.x, y: dex.y - 120, age: 0, life: 2, text: 'DEX-STARR ESCAPES', hurt: true });
		for (const [kind, dx, dy, role] of LAST_STAND) this.spawn(game, kind, at.x + dx, at.y + dy, role);
		this.comms.scene([
			['Dex-Starr', 'NO! Dex-Starr is NOT beaten! Dex-Starr will be BACK! Atrocitus will make you all sorry!'],
			['John', "He dropped Ganthet! Get that bubble open before the rest of them carry him off!"]
		]);
	}

	private free(game: Game) {
		this.phase = 'freed';
		this.clock = 0;
		const b = this.bubble!;
		const i = game.dummies.indexOf(b);
		if (i >= 0) game.dummies.splice(i, 1);
		this.bubble = null;
		game.constructs.effects.push({ kind: 'snap', x: b.x, y: b.y - 70, age: 0, life: 0.9, radius: 120 });
		for (const e of game.enemies) {
			if (!isStanding(e)) continue;
			e.hp = 0;
			e.down = 1;
		}
		for (const p of game.players) p.invuln = 99;
		this.comms.clear();
		this.comms.scene([
			['Ganthet', 'Jordan. Stewart. You came for me. The others would have called me a necessary loss.'],
			['Hal', "We don't do necessary losses. Are you alright?"],
			['Ganthet', 'The creature is a messenger; I heard what he was told. Atrocitus has gone home to Ysmault, to the Blood Altar.'],
			['Ganthet', 'He wants what we hid at the heart of Sector 666: the Book of the Black. With it, he can end the Corps in a single night.'],
			['John', 'Then we go into Sector 666.'],
			['Ganthet', 'And I go with you. I am the only one who knows the way.']
		]);
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
			} else this.comms.say(me.def.id === 'hal' ? 'John' : 'Hal', 'Up! He is getting away!');
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
		const list: Drawable[] = [{ baseY: 1, draw: () => drawPawPrints(ctx, this.prints, time) }];
		list.push({ baseY: BOW.y, draw: () => drawDreadnoughtBow(ctx, BOW.x, BOW.y, time) });
		for (const o of this.map?.obstacles ?? []) {
			if (o.height === 0) continue;
			list.push({ baseY: o.y + o.h, draw: () => drawHullPlate(ctx, o.x, o.y, o.w, o.h, o.height, o.seed, time) });
		}
		// Ganthet: with him while he has him, on the ground once dropped
		const b = this.bubble;
		if (b && isStanding(b)) list.push({ baseY: b.y, draw: () => drawRageBubble(ctx, b.x, b.y, time, 1 - b.hp / b.maxHp) });
		else if (this.phase !== 'rescue' && this.phase !== 'freed' && this.state !== 'won') {
			const c = this.carried;
			list.push({ baseY: c.y + 30, draw: () => drawRageBubble(ctx, c.x - 60, c.y + 30, time, 0) });
		}
		return list;
	}
}
