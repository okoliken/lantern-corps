// Season two, Act 1, mission 3: Ground Level. John, with Superman.
//
// A cargo lifter loses power over a full dock in Coast City harbour. No
// villain: a weight to hold up and a crowd that won't move fast enough.
//
//   evacuate  Superman holds the far end of the container. John braces the
//             near end by staying close to it (his ring holds it up, and it
//             costs willpower). Away from it, the strain climbs. Three crews
//             are trapped around the yard: reach them and they follow John to
//             the exit. Crates shake loose and fall: the bubble shield (Shift)
//             goes over a crew under one.
//   lower     everyone's out. Superman lowers the load, and the last of it is
//             the worst: hold the brace until it's down.
//
// Lose: the strain reaches the top and the container comes down, or two crews
// are lost.

import { absorbWithShield, type Protectable } from '../constructs/system';
import { colonist, drawColonist, drawGroupBubble } from '../draw/colony';
import { drawBrace, drawExit, drawFallingCrate, drawHarbour, drawLifter } from '../draw/dock';
import type { Figure } from '../draw/lantern';
import { ringPosition } from '../draw/lantern';
import type { Drawable, Game } from '../game';
import { seededRandom, type GameMap, type Obstacle } from '../map';
import { boxOverlap } from '../physics';
import type { Player } from '../player';
import { spend } from '../willpower';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

export type GroundPhase = 'evacuate' | 'lower';

const INTRO_TIME = 3;
/** How close John has to be to hold the near end up. */
export const BRACE_RANGE = 260;
/** Willpower a second the brace costs. */
const BRACE_COST = 7;
/** Strain per second: climbing with nobody on the near end, falling while John holds it. */
const STRAIN_UP = 1 / 27;
const STRAIN_DOWN = 1 / 9;
/** While Superman lowers it, the load fights back harder. */
const LOWER_UP = 1 / 12;
const LOWER_TIME = 24;
/** Crews: how close John gets for them to come out, how fast they walk. */
const PICKUP_RADIUS = 120;
const CREW_SPEED = 165;
const FOLLOW_GAP = 90;
const CREW_HP = 100;
const EXIT_RADIUS = 150;
/** Crates come loose more often the worse the strain. */
const CRATE_EVERY = 5.5;
const CRATE_WARNING = 1.5;
const CRATE_RADIUS = 70;
const CRATE_DAMAGE = 26;

const W = 3000;
const H = 1900;
/** The pier's edge: water above it. */
const PIER = 260;
const LIFTER = { x: 1500, y: 820 };
const EXIT = { x: 330, y: 1560 };
const SPAWN = { x: 1300, y: 1050 };
const CREWS = [
	{ x: 2450, y: 640 },
	{ x: 2500, y: 1500 },
	{ x: 1050, y: 560 }
];

interface Crew {
	home: { x: number; y: number };
	x: number;
	y: number;
	vx: number;
	vy: number;
	state: 'trapped' | 'following' | 'out' | 'lost';
	hp: number;
	flash: number;
	members: Figure[];
	readonly prot: Protectable;
}

interface FallingCrate {
	x: number;
	y: number;
	t: number;
}

/** The harbour yard: water along the top, container stacks, the crane in the middle, the gate bottom left. */
export function buildGroundLevelMap(): GameMap {
	const rand = seededRandom(5252);
	const obstacles: Obstacle[] = [];
	// Container stacks, kept off the crews and the way to the gate
	const stacks: [number, number, number, number][] = [
		[700, 900, 220, 90],
		[1950, 420, 240, 90],
		[2050, 1150, 240, 90],
		[2600, 1050, 200, 90],
		[1750, 1720, 240, 90]
	];
	for (const [x, y, w, h] of stacks) obstacles.push({ kind: 'building', x, y, w, h, height: 70 + rand() * 30, blocksFlying: false, seed: rand() });
	return {
		name: 'Coast City harbour',
		environment: 'planet',
		ground: 'street',
		width: W,
		height: H,
		spawn: SPAWN,
		battery: { x: 1050, y: 1150 },
		dummies: [],
		obstacles
	};
}

export class GroundLevel implements MissionDirector {
	state: MissionState = 'intro';
	phase: GroundPhase = 'evacuate';
	timer = INTRO_TIME;
	lives = 1;
	elapsed = 0;
	/** 0..1: how close the lifter is to dropping. */
	strain = 0.25;
	peakStrain = 0.25;
	/** 0..1 as Superman lowers it. */
	lowered = 0;
	bracing = false;
	failReason: 'dropped' | 'crews' | null = null;
	readonly comms = new Comms();
	readonly crews: Crew[];
	readonly starHint = '★ done · ★ nobody hurt · ★ the strain never passed 80%';
	readonly crates: FallingCrate[] = [];
	private crateTimer = CRATE_EVERY;
	/** The arrow sends John back under the load until it's steady. */
	private steadying = false;
	private hurt = false;
	private said = new Set<string>();
	private rand: () => number;

	constructor(seed = 31) {
		this.rand = seededRandom(seed);
		this.crews = CREWS.map((c, i) => ({
			home: c,
			x: c.x,
			y: c.y,
			vx: 0,
			vy: 0,
			state: 'trapped' as const,
			hp: CREW_HP,
			flash: 0,
			members: [0, 1, 2, 3].map((k) => colonist(60 + i * 4 + k)),
			prot: { x: c.x, y: c.y, name: 'Dock crew', radius: 58, lift: 30, threat: 0 }
		}));
	}

	// ------------------------------------------------------------ reporting

	get out(): number {
		return this.crews.filter((c) => c.state === 'out').length;
	}

	get lost(): number {
		return this.crews.filter((c) => c.state === 'lost').length;
	}

	get objective(): string {
		if (this.phase === 'lower') return 'Hold the brace while Superman lowers the load';
		return `Get the crews out (${this.out} / ${this.crews.length}), and keep the lifter up`;
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const list: MissionMeter[] = [{ label: 'Strain', value: this.strain, text: `${Math.round(this.strain * 100)}%`, low: this.strain > 0.7 }];
		if (this.phase === 'lower') list.push({ label: 'Down', value: this.lowered, text: `${Math.round(this.lowered * 100)}%`, marker: '▼' });
		for (const c of this.crews) if (c.state === 'following') list.push({ label: 'Crew', value: c.hp / CREW_HP, text: `${Math.round(c.hp)}%`, low: c.hp < 40 });
		return list;
	}

	warning(game: Game): string | null {
		if (this.state !== 'playing') return null;
		if (this.strain > 0.8) return "The lifter's slipping! Get back under it!";
		const unshielded = (p: Protectable) => !game.constructs.shields.some((s) => s.target === p);
		if (this.crews.some((c) => c.prot.threat > 0 && unshielded(c.prot))) return 'Crate coming down! Shift to shield the crew!';
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.hurt ? 0 : 1) + (this.peakStrain <= 0.8 ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'won') return 'The container settles on the dock with a thud you can feel in your teeth. Everybody walks home.';
		if (this.failReason === 'crews') return 'Two crews were caught under falling cargo.';
		return 'The lifter came down.';
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		return [
			{ label: 'Dock workers out', value: `${this.out * 4} / ${this.crews.length * 4}` },
			{ label: 'Highest strain', value: `${Math.round(this.peakStrain * 100)}%` },
			{ label: 'Time', value: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
		];
	}

	// ---------------------------------------------------------------- rules

	update(game: Game, dt: number) {
		this.gameRef = game;
		for (const c of this.crews) c.flash = Math.max(0, c.flash - dt);
		this.comms.update(dt);
		this.pinSuperman(game);

		switch (this.state) {
			case 'intro':
				this.timer -= dt;
				if (this.timer <= 0) {
					this.state = 'playing';
					game.constructs.protectables.push(...this.crews.map((c) => c.prot));
					this.comms.scene([
						['Superman', "I've got the far end, John. The near end is all yours. Get under it!"],
						['John', "And there's still people down there."],
						['Superman', 'Then we do both. Stay close to the load to hold it. Go get them when you can.']
					]);
				}
				return;
			case 'won':
				this.timer += dt;
				return;
			case 'lost':
				return;
		}

		this.elapsed += dt;
		const john = game.players[0];
		this.brace(john, dt);
		this.updateCrews(john, dt, game);
		this.updateCrates(game, dt);
		if (this.state !== 'playing') return;

		if (this.phase === 'evacuate' && this.crews.every((c) => c.state === 'out' || c.state === 'lost')) this.startLower();
		if (this.phase === 'lower') {
			this.lowered = Math.min(1, this.lowered + dt / LOWER_TIME);
			if (this.lowered >= 1) this.win(game);
		}
	}

	/** Superman stays under the far end, whatever his instincts say. */
	private pinSuperman(game: Game) {
		const sup = game.players[1];
		if (!sup) return;
		sup.x = LIFTER.x + 110;
		sup.y = LIFTER.y + 30;
		sup.vx = sup.vy = 0;
		sup.facing = -1;
	}

	/** Close to the load, John holds it up, and it costs him. */
	private brace(john: Player, dt: number) {
		this.bracing = !john.downed && !john.exhausted && Math.hypot(john.x - LIFTER.x, john.y - LIFTER.y) < BRACE_RANGE;
		if (this.bracing) {
			spend(john, BRACE_COST * dt);
			this.strain = Math.max(0, this.strain - STRAIN_DOWN * dt);
		} else {
			// A gust now and then makes it worse
			const gust = Math.sin(this.elapsed * 0.7) > 0.8 ? 1.8 : 1;
			this.strain += (this.phase === 'lower' ? LOWER_UP : STRAIN_UP) * gust * dt;
		}
		if (john.exhausted) this.once('tired', 'John', "I'm running dry. Need the battery!");
		this.peakStrain = Math.max(this.peakStrain, this.strain);
		if (this.strain > 0.7) this.once('slip', 'Superman', "John! It's slipping!");
		if (this.strain >= 1) this.lose('dropped');
	}

	private updateCrews(john: Player, dt: number, game: Game) {
		for (const c of this.crews) {
			c.prot.x = c.x;
			c.prot.y = c.y;
			switch (c.state) {
				case 'trapped':
					if (!john.downed && Math.hypot(john.x - c.x, john.y - c.y) < PICKUP_RADIUS) {
						c.state = 'following';
						const n = this.crews.filter((o) => o.state !== 'trapped').length;
						const lines = ["Thank God. We couldn't get past the stacks!", 'Is that thing going to fall on us?', "We're the last ones. Lead the way!"];
						this.comms.say('Dock worker', lines[n - 1] ?? lines[0]);
					}
					break;
				case 'following': {
					if (Math.hypot(c.x - EXIT.x, c.y - EXIT.y) < EXIT_RADIUS) {
						c.state = 'out';
						this.comms.say('John', this.crews.some((o) => o.state === 'trapped') ? "They're clear. Going back under." : "That's everyone off the dock.");
						break;
					}
					const dx = john.x - c.x;
					const dy = john.y - c.y;
					const d = Math.hypot(dx, dy) || 1;
					const want = d > FOLLOW_GAP ? CREW_SPEED : 0;
					c.vx = (dx / d) * want;
					c.vy = (dy / d) * want;
					this.moveCrew(game, c, dt);
					break;
				}
			}
		}
	}

	private moveCrew(game: Game, c: Crew, dt: number) {
		const blocked = (x: number, y: number) => game.map.obstacles.some((o) => o.kind !== 'wall' && boxOverlap(x, y, 30, 12, o));
		const nx = c.x + c.vx * dt;
		const ny = c.y + c.vy * dt;
		if (!blocked(nx, ny)) {
			c.x = nx;
			c.y = ny;
		} else if (!blocked(nx, c.y)) c.x = nx;
		else if (!blocked(c.x, ny)) c.y = ny;
		c.x = Math.max(40, Math.min(W - 40, c.x));
		c.y = Math.max(PIER + 60, Math.min(H - 40, c.y));
	}

	/** Crates shake loose: aimed at the crews, more often the worse the strain. */
	private updateCrates(game: Game, dt: number) {
		const w = game.constructs;
		this.crateTimer -= dt * (0.6 + this.strain);
		// Only the crews out in the open with John: the ones still hiding are behind the stacks
		const exposed = this.crews.filter((c) => c.state === 'following');
		if (this.crateTimer <= 0 && exposed.length > 0) {
			this.crateTimer = CRATE_EVERY;
			const c = exposed[Math.floor(this.rand() * exposed.length)];
			this.crates.push({ x: c.x + c.vx * CRATE_WARNING + (this.rand() - 0.5) * 60, y: c.y + c.vy * CRATE_WARNING + (this.rand() - 0.5) * 40, t: 0 });
			this.once('crate', 'Superman', "Cargo's coming loose! Watch the crews!");
		}
		for (const c of this.crews) c.prot.threat = 0;
		for (const k of [...this.crates]) {
			k.t += dt;
			for (const c of this.crews) if (c.state === 'following' && Math.hypot(c.x - k.x, c.y - k.y) < CRATE_RADIUS + 30) c.prot.threat += 3;
			if (k.t < CRATE_WARNING) continue;
			this.crates.splice(this.crates.indexOf(k), 1);
			for (const c of this.crews) {
				if (c.state !== 'following' || Math.hypot(c.x - k.x, c.y - k.y) > CRATE_RADIUS + 30) continue;
				const through = absorbWithShield(w, c.prot, CRATE_DAMAGE);
				if (through <= 0) continue;
				c.hp -= through;
				c.flash = 0.3;
				this.hurt = true;
				if (c.hp <= 0) {
					c.state = 'lost';
					this.comms.say('John', "No! ...They're down. I couldn't reach them.", true);
					if (this.lost >= 2) this.lose('crews');
				}
			}
		}
	}

	private startLower() {
		this.phase = 'lower';
		this.comms.scene([
			['Superman', "Everybody's clear. Now we bring it down. Slowly."],
			['Superman', "This is the hard part. Don't let go, John."]
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
			['Superman', 'Nice work. Most people think the hard part is lifting.'],
			['John', "It's the letting go slowly."],
			['Superman', "You'd fit in with us, you know."]
		]);
	}

	private lose(reason: 'dropped' | 'crews') {
		if (this.state !== 'playing') return;
		this.state = 'lost';
		this.failReason = reason;
	}

	// -------------------------------------------------------------- drawing

	cameraPoints(): [number, number][] {
		return this.crews.filter((c) => c.state === 'following').map((c): [number, number] => [c.x, c.y - 30]);
	}

	goal(): { x: number; y: number } | null {
		if (this.state !== 'playing') return null;
		// Slipping: back under the load until it's steady again, not just until it stops slipping
		if (this.strain > 0.7) this.steadying = true;
		else if (this.strain < 0.15) this.steadying = false;
		if (this.steadying || this.phase === 'lower') return LIFTER;
		if (this.crews.some((c) => c.state === 'following')) return EXIT;
		const next = this.crews.find((c) => c.state === 'trapped');
		return next ?? LIFTER;
	}

	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		const list: Drawable[] = [];
		const game = this.gameRef;
		list.push({ baseY: -1e6, draw: () => drawHarbour(ctx, W, PIER, time) });
		list.push({ baseY: -1e6 + 1, draw: () => drawExit(ctx, EXIT.x, EXIT.y, time) });
		list.push({ baseY: LIFTER.y + 20, draw: () => drawLifter(ctx, LIFTER.x, LIFTER.y, this.strain, this.lowered, time) });
		const john = game?.players[0];
		if (john && this.bracing) {
			const [rx, ry] = ringPosition(john.x, john.y, { ...game!.poseFor(john), firing: true }, time);
			list.push({ baseY: LIFTER.y + 25, draw: () => drawBrace(ctx, rx, ry, LIFTER.x, LIFTER.y + 190 * this.lowered, Math.min(1, john.willpower / 40), time) });
		}
		for (const k of this.crates) list.push({ baseY: k.y, draw: () => drawFallingCrate(ctx, k.x, k.y, k.t / CRATE_WARNING, CRATE_RADIUS) });
		const offsets = [
			[-26, -10],
			[10, -20],
			[-8, 14],
			[26, 6]
		];
		const w = game?.constructs;
		for (const c of this.crews) {
			if (c.state === 'out' || c.state === 'lost') continue;
			const walking = Math.hypot(c.vx, c.vy) > 5;
			const dir: 1 | -1 = c.vx < -1 ? -1 : 1;
			c.members.forEach((fig, i) => {
				const [ox, oy] = offsets[i];
				list.push({
					baseY: c.y + oy,
					draw: () => {
						ctx.save();
						if (c.flash > 0) ctx.filter = 'brightness(1.8) sepia(1) hue-rotate(-30deg)';
						drawColonist(ctx, fig, c.x + ox, c.y + oy, dir, walking, time + i * 0.37);
						ctx.restore();
					}
				});
			});
			const shield = w?.shields.find((s) => s.target === c.prot);
			if (shield) list.push({ baseY: c.y + 30, draw: () => drawGroupBubble(ctx, c.x, c.y, 62, shield.hp / shield.maxHp, time) });
		}
		return list;
	}

	/** The game, for drawing John's brace from his ring (set every update). */
	private gameRef: Game | null = null;
}
