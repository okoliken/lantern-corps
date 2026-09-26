// Survival School: Kilowog keeps you alive, Katma Tui makes you dangerous.
//
// Nothing here is part of the story. Each lesson is one idea, taught by one of
// them, scored so you can see yourself getting better at it. Kilowog's yard is
// about taking what the universe throws at you; Katma's hall is about not
// being where it lands.

import { damagePlayer } from '../combat';
import { bodyAim, hitsBody, type Player } from '../player';
import { createDummy, isStanding, type Dummy } from '../dummy';
import { drawMarker, drawPracticeBolt, drawPracticeDrone } from '../draw/training';
import type { Drawable, Game } from '../game';
import type { GameMap } from '../map';
import { MAX_WILLPOWER } from '../willpower';

export type Teacher = 'kilowog' | 'katma';
export type LessonId = 'shields' | 'take-the-hit' | 'empty' | 'fear';

export interface Lesson {
	id: LessonId;
	teacher: Teacher;
	name: string;
	/** Where it happens, shown under the name. */
	place: string;
	/** What the lesson is about, in the teacher's words. */
	brief: string;
	/** What the score counts. */
	unit: string;
	seconds: number;
	/** The score that counts as passing it. */
	pass: number;
}

export const TEACHERS: Record<Teacher, { name: string; line: string }> = {
	kilowog: { name: 'Kilowog', line: 'Stay alive' },
	katma: { name: 'Katma Tui', line: 'Win smart' }
};

export const LESSONS: Lesson[] = [
	{
		id: 'shields',
		teacher: 'kilowog',
		name: 'Shields First',
		place: 'Drill yard',
		brief:
			'The ring protects you as much as you let it, poozer. Keep a bubble on yourself and break my targets while it holds. Anything that gets through does not count.',
		unit: 'targets',
		seconds: 60,
		pass: 8
	},
	{
		id: 'take-the-hit',
		teacher: 'kilowog',
		name: 'Take the Hit',
		place: 'Drill yard',
		brief:
			'I am going to hit you. Repeatedly. Brace, and the ring turns it into speed instead of putting you through a wall. Stand there soft and I will keep doing it.',
		unit: 'braced',
		seconds: 60,
		pass: 10
	},
	{
		id: 'empty',
		teacher: 'kilowog',
		name: 'Running on Empty',
		place: 'Drill yard',
		brief:
			'Every construct costs. You get a quarter of a charge and no battery. Put down what you can and learn what is worth spending on.',
		unit: 'targets',
		seconds: 60,
		pass: 6
	},
	{
		id: 'fear',
		teacher: 'kilowog',
		name: 'Fear Drill',
		place: 'Drill yard',
		brief:
			'The ring is only as solid as you are. The sim will crowd you, and what you build starts to shake. Keep it solid anyway.',
		unit: 'seconds solid',
		seconds: 60,
		pass: 40
	}
];

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);

export type SchoolState = 'intro' | 'running' | 'over';

const INTRO = 3.2;
const TARGETS_UP = 4;
const TARGET_HP = 45;
const BOLT_SPEED = 260;
/**
 * How high a bolt is drawn above the ground plane it travels on. The drill
 * yard fires at the Lantern's BODY, and a bolt that looks like it hit you did.
 */
export const BOLT_LIFT = 40;
const BOLT_DAMAGE = 14;
const BOLT_KNOCK = 160;
/** Kilowog's own swings: what they take off you, and how far they put you. */
const HEAVY_DAMAGE = 30;
const HEAVY_KNOCK = 520;
const DRONE_EVERY = 1.1;
/** Running on Empty starts you here, with nothing to recharge from. */
const EMPTY_WILL = 0.25;
/** Fear Drill: how fast the crowd shakes the ring, and how fast calm returns. */
const FEAR_RISE = 0.5;
const FEAR_FALL = 0.32;

interface Bolt {
	x: number;
	y: number;
	vx: number;
	vy: number;
	/** Kilowog's own swings hit harder and count as a brace when blocked. */
	heavy: boolean;
}

export class School {
	state: SchoolState = 'intro';
	timer = INTRO;
	score = 0;
	elapsed = 0;
	/** Fear Drill: 0 calm, 1 shaking. */
	fear = 0;
	/** Shields First: whether the bubble was up for the last target. */
	shielded = false;
	private targets: Dummy[] = [];
	private drones: { x: number; y: number }[] = [];
	private bolts: Bolt[] = [];
	private boltIn = DRONE_EVERY;
	private solid = 0;

	constructor(
		readonly lesson: Lesson,
		private readonly map: GameMap
	) {}

	get clock(): number {
		return Math.max(0, this.lesson.seconds - this.elapsed);
	}

	get passed(): boolean {
		return this.score >= this.lesson.pass;
	}

	get objective(): string {
		switch (this.lesson.id) {
			case 'shields':
				return `Broken while shielded: ${this.score} · bubble ${this.shielded ? 'up' : 'down'}`;
			case 'take-the-hit':
				return `Braced: ${this.score}`;
			case 'empty':
				return `Broken on what is left: ${this.score}`;
			case 'fear':
				return `Held solid: ${this.score}s · fear ${Math.round(this.fear * 100)}%`;
		}
	}

	update(game: Game, dt: number) {
		if (this.state === 'intro') {
			this.timer -= dt;
			if (this.timer <= 0) {
				this.state = 'running';
				this.begin(game);
			}
			return;
		}
		if (this.state === 'over') return;
		this.elapsed += dt;
		const me = game.players[0];

		switch (this.lesson.id) {
			case 'shields':
			case 'empty':
				this.targetsUp(game);
				this.fire(game, dt, me);
				this.flyBolts(game, dt);
				break;
			case 'take-the-hit':
				this.fire(game, dt, me, 0.75, true);
				this.flyBolts(game, dt);
				break;
			case 'fear': {
				// The crowd presses in, and what the ring makes starts to shake
				const near = game.enemies.filter((e) => isStanding(e) && Math.hypot(e.x - me.x, e.y - me.y) < 320).length;
				this.fear = Math.max(0, Math.min(1, this.fear + (near > 0 ? FEAR_RISE * near * 0.4 : -FEAR_FALL) * dt));
				if (this.fear < 0.5) this.solid += dt;
				this.score = Math.round(this.solid);
				break;
			}
		}

		if (this.elapsed >= this.lesson.seconds) this.state = 'over';
	}

	private begin(game: Game) {
		const { x, y } = this.map.spawn;
		const ring = (count: number, radius: number) =>
			Array.from({ length: count }, (_, i) => {
				const a = (i / count) * Math.PI * 2;
				return { x: x + Math.cos(a) * radius, y: y + Math.sin(a) * radius * 0.7 };
			});
		switch (this.lesson.id) {
			case 'shields':
				this.drones = ring(4, 520);
				for (let i = 0; i < TARGETS_UP; i++) this.addTarget(game, i);
				break;
			case 'take-the-hit':
				this.drones = ring(3, 460);
				break;
			case 'empty':
				// A quarter of a charge, and the battery is switched off
				game.players[0].willpower = MAX_WILLPOWER * EMPTY_WILL;
				this.map.noBattery = true;
				this.drones = ring(2, 560);
				for (let i = 0; i < TARGETS_UP; i++) this.addTarget(game, i);
				break;
			case 'fear':
				for (let i = 0; i < 5; i++) {
					const a = (i / 5) * Math.PI * 2;
					game.spawnEnemy('rageGrunt', x + Math.cos(a) * 520, y + Math.sin(a) * 340, 'hunter');
				}
				break;
		}
	}

	private addTarget(game: Game, seed = 0) {
		const angle = Math.random() * Math.PI * 2 + seed;
		const spread = 220 + Math.random() * 340;
		const d = createDummy(
			Math.min(Math.max(this.map.spawn.x + Math.cos(angle) * spread, 120), this.map.width - 120),
			Math.min(Math.max(this.map.spawn.y + Math.sin(angle) * spread, 120), this.map.height - 120)
		);
		d.hp = d.maxHp = TARGET_HP;
		game.dummies.push(d);
		this.targets.push(d);
	}

	/** Break one and another lights up. Shields First only counts the shielded ones. */
	private targetsUp(game: Game) {
		const me = game.players[0];
		this.shielded = game.constructs.shields.some((s) => s.target === me);
		for (const d of [...this.targets]) {
			if (isStanding(d)) continue;
			this.targets.splice(this.targets.indexOf(d), 1);
			const at = game.dummies.indexOf(d);
			if (at >= 0) game.dummies.splice(at, 1);
			if (this.lesson.id === 'empty' || this.shielded) this.score += 1;
			this.addTarget(game);
		}
	}

	/** Fire at the Lantern. Kilowog's heavy swings are the ones worth bracing. */
	private fire(game: Game, dt: number, at: Player, rate = 1, heavy = false) {
		void game;
		this.boltIn -= dt;
		if (this.boltIn > 0) return;
		this.boltIn = Math.max(0.35, DRONE_EVERY * rate - this.elapsed * 0.005);
		const drone = this.drones[Math.floor(Math.random() * this.drones.length)];
		if (!drone) return;
		// Lead it at the middle of the body, the way a Red Lantern's shot is aimed
		const aim = bodyAim(at, BOLT_LIFT);
		const dx = aim.x - drone.x;
		const dy = aim.y - drone.y;
		const len = Math.hypot(dx, dy) || 1;
		this.bolts.push({ x: drone.x, y: drone.y, vx: (dx / len) * BOLT_SPEED, vy: (dy / len) * BOLT_SPEED, heavy });
	}

	private flyBolts(game: Game, dt: number) {
		const me = game.players[0];
		for (const bolt of [...this.bolts]) {
			bolt.x += bolt.vx * dt;
			bolt.y += bolt.vy * dt;
			const hit = hitsBody(me, bolt.x, bolt.y, BOLT_LIFT);
			const gone = bolt.x < 0 || bolt.y < 0 || bolt.x > this.map.width || bolt.y > this.map.height;
			if (!hit && !gone) continue;
			if (hit) {
				// The bubble takes it first; whatever is left of it comes off the
				// Lantern. Was a bubble actually up? A hit that lands during the
				// moment of mercy after the last one is not a block.
				const bubble = game.constructs.shields.some((s) => s.target === me);
				const damage = bolt.heavy ? HEAVY_DAMAGE : BOLT_DAMAGE;
				const knock = bolt.heavy ? HEAVY_KNOCK : BOLT_KNOCK;
				const through = damagePlayer(game.constructs, me, damage, bolt.x, bolt.y, knock);
				// Taking it on the bubble is the whole lesson
				if (bolt.heavy && bubble && through <= 0) this.score += 1;
			}
			this.bolts.splice(this.bolts.indexOf(bolt), 1);
		}
	}

	drawables(ctx: CanvasRenderingContext2D, time: number): Drawable[] {
		const list: Drawable[] = [];
		for (const d of this.targets) {
			if (!isStanding(d)) continue;
			list.push({ baseY: d.y - 1, draw: () => drawMarker(ctx, d.x, d.y, 42, time) });
		}
		for (const drone of this.drones) {
			list.push({ baseY: drone.y, draw: () => drawPracticeDrone(ctx, drone.x, drone.y, time) });
		}
		for (const bolt of this.bolts) {
			list.push({ baseY: bolt.y + 1, draw: () => drawPracticeBolt(ctx, bolt.x, bolt.y, 40) });
		}
		return list;
	}
}
