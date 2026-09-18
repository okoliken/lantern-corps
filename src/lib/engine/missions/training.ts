// Training on Oa: Kilowog teaches a new Lantern everything, one thing at a
// time, before the first mission.
//
// Each step sets up what it needs (a marker, targets, a pod under fire),
// waits until the player has actually DONE the thing, cheers, and moves on.
// The words live in src/lib/story/training.ts; this is only the rules.
//
// Nobody can get hurt here (god mode): it's practice.

import { absorbWithShield, type Protectable } from '../constructs/system';
import { createDummy, isStanding, type Dummy } from '../dummy';
import { drawLantern, HOVER_PLANET, type Figure, type LanternPose } from '../draw/lantern';
import { drawMarker, drawPracticeBolt, drawPracticeDrone, drawSupplyPod } from '../draw/training';
import { drawShipShield } from '../draw/escort';
import type { Drawable, Game } from '../game';
import { type GameMap } from '../map';
import type { Player } from '../player';
import { inBatteryRange } from '../willpower';

export const TRAINING_STEPS = [
	'welcome',
	'move',
	'fly',
	'land',
	'shoot',
	'construct',
	'shieldSelf',
	'shieldPod',
	'recharge',
	'signature',
	'done'
] as const;
export type TrainingStep = (typeof TRAINING_STEPS)[number];

export const KILOWOG: Figure = {
	id: 'kilowog',
	look: { skin: '#b89a9c', hair: '#b89a9c', hairStyle: 'cropped', mask: false, bolovaxian: true }
};

/** Seconds Kilowog talks before the first step. */
const WELCOME_TIME = 5;
/** Seconds of "nice!" between steps. */
const CHEER_TIME = 1.4;
const MARKER_RADIUS = 45;
/** Tutorial targets break fast: a couple of double taps. */
const TARGET_HP = 40;
const CONSTRUCTS_TO_MAKE = 3;
const BOLT_SPEED = 230;
const BOLT_EVERY = 1.1;

interface Bolt {
	x: number;
	y: number;
	vx: number;
	vy: number;
}

/** Oa's training grounds: a wide open field, the Lantern in the middle. */
export function buildTrainingMap(): GameMap {
	const width = 2400;
	const height = 1600;
	const spawn = { x: width / 2, y: height / 2 };
	return {
		name: 'Oa Training Grounds',
		environment: 'planet',
		ground: 'oa',
		width,
		height,
		spawn,
		battery: { x: spawn.x, y: spawn.y - 110 },
		dummies: [],
		obstacles: []
	};
}

export class Training {
	step: TrainingStep = 'welcome';
	/** Progress within the step (markers reached, targets down...). */
	count = 0;
	/** How many the step needs. */
	need = 1;
	/** Seconds left on the "nice!" after finishing a step; the next one starts when it runs out. */
	cheer = 0;
	private timer = WELCOME_TIME;
	private readonly home: { x: number; y: number };
	private readonly kilowog: { x: number; y: number };
	private markers: { x: number; y: number }[] = [];
	private targets: Dummy[] = [];
	private wasStanding = new Map<Dummy, boolean>();
	private lastCooldowns: number[] = [];
	private wasFiring = false;
	private readonly pod: Protectable;
	private drones: { x: number; y: number }[] = [];
	private bolts: Bolt[] = [];
	private boltTimer = 0;
	private podFlash = 0;
	private game: Game | null = null;

	constructor(map: GameMap) {
		this.home = map.spawn;
		this.kilowog = { x: map.spawn.x - 170, y: map.spawn.y - 30 };
		this.pod = { x: map.spawn.x - 330, y: map.spawn.y + 170, name: 'Supply pod', radius: 48, lift: 18, threat: 0 };
	}

	get index(): number {
		return TRAINING_STEPS.indexOf(this.step);
	}

	get finished(): boolean {
		return this.step === 'done';
	}

	update(game: Game, dt: number) {
		this.game = game;
		game.godMode = true;
		const p = game.players[0];
		this.podFlash = Math.max(0, this.podFlash - dt);
		this.updateBolts(game, dt);

		if (this.cheer > 0) {
			this.cheer -= dt;
			if (this.cheer <= 0) this.next(game);
			return;
		}
		if (this.check(game, p, dt)) {
			this.cheer = CHEER_TIME;
			game.constructs.effects.push({ kind: 'callout', x: p.x, y: p.y, age: 0, life: 1.2, text: 'NICE!', owner: p });
		}
	}

	/** Has the player done what this step asks? */
	private check(game: Game, p: Player, dt: number): boolean {
		switch (this.step) {
			case 'welcome':
				this.timer -= dt;
				return this.timer <= 0;
			case 'move': {
				const m = this.markers[this.count];
				if (m && Math.hypot(p.x - m.x, p.y - m.y) < MARKER_RADIUS) this.count++;
				return this.count >= this.need;
			}
			case 'fly':
				return p.flying;
			case 'land': {
				const m = this.markers[0];
				return !p.flying && Math.hypot(p.x - m.x, p.y - m.y) < MARKER_RADIUS * 1.6;
			}
			case 'shoot':
				this.countKnockdowns();
				return this.count >= this.need;
			case 'construct':
				this.countConstructs(p);
				return this.count >= this.need;
			case 'shieldSelf':
				return game.constructs.shields.some((s) => s.target === p);
			case 'shieldPod':
				return this.count >= this.need;
			case 'recharge':
				// Only the Lantern refills it here, so the lesson is the battery
				p.recoverDelay = Math.max(p.recoverDelay, 0.5);
				return p.willpower >= p.maxWillpower * 0.95 && inBatteryRange(p, game.batteries[0]);
			case 'signature':
				return p.dash !== null || game.constructs.fortresses.some((f) => f.owner === p);
			case 'done':
				return false;
		}
	}

	/** Clear the last step away and set up the next one. */
	private next(game: Game) {
		const p = game.players[0];
		this.clearTargets(game);
		this.markers = [];
		this.drones = [];
		this.bolts = [];
		game.constructs.protectables = game.constructs.protectables.filter((x) => x !== this.pod);
		this.step = TRAINING_STEPS[this.index + 1];
		this.count = 0;
		this.need = 1;
		const { x, y } = this.home;

		switch (this.step) {
			case 'move':
				this.markers = [
					{ x: x + 260, y: y + 20 },
					{ x: x + 240, y: y + 240 },
					{ x: x - 60, y: y + 250 }
				];
				this.need = this.markers.length;
				break;
			case 'land':
				this.markers = [{ x: x + 280, y: y - 200 }];
				break;
			case 'shoot':
				this.addTarget(game, p.x + 280, p.y - 70, false);
				this.addTarget(game, p.x + 300, p.y + 80, false);
				this.need = 2;
				break;
			case 'construct':
				// One up close, a bunch further off: the ring makes something different for each
				this.addTarget(game, p.x + 90, p.y);
				for (const dy of [-60, 0, 60]) this.addTarget(game, p.x + 360, p.y + dy);
				this.lastCooldowns = [...p.cooldowns];
				this.wasFiring = p.firing;
				this.need = CONSTRUCTS_TO_MAKE;
				break;
			case 'shieldSelf':
				p.shieldCooldown = 0;
				p.willpower = p.maxWillpower;
				break;
			case 'shieldPod':
				p.shieldCooldown = 0;
				p.willpower = p.maxWillpower;
				game.constructs.shields = game.constructs.shields.filter((s) => s.target !== p);
				// Close by, so it's in shield reach
				this.pod.x = p.x - 160;
				this.pod.y = p.y + 110;
				game.constructs.protectables.push(this.pod);
				this.drones = [
					{ x: this.pod.x - 260, y: this.pod.y - 200 },
					{ x: this.pod.x + 40, y: this.pod.y + 260 }
				];
				this.boltTimer = 0.3;
				break;
			case 'recharge':
				p.willpower = 10;
				break;
			case 'signature':
				p.surge = 100;
				break;
		}
	}

	private addTarget(game: Game, x: number, y: number, respawns = true) {
		const d = createDummy(x, y);
		d.hp = d.maxHp = TARGET_HP;
		d.respawns = respawns;
		game.dummies.push(d);
		this.targets.push(d);
		this.wasStanding.set(d, true);
	}

	private clearTargets(game: Game) {
		for (const d of this.targets) {
			const i = game.dummies.indexOf(d);
			if (i >= 0) game.dummies.splice(i, 1);
		}
		this.targets = [];
	}

	private countKnockdowns() {
		for (const d of this.targets) {
			const standing = isStanding(d);
			if (this.wasStanding.get(d) && !standing) this.count++;
			this.wasStanding.set(d, standing);
		}
	}

	/** A construct was made: a slot's cooldown jumped up, or the beam switched on. */
	private countConstructs(p: Player) {
		if (p.cooldowns.some((c, i) => c > (this.lastCooldowns[i] ?? 0) + 0.05) || (p.firing && !this.wasFiring)) this.count++;
		this.lastCooldowns = [...p.cooldowns];
		this.wasFiring = p.firing;
	}

	/** Practice drones fire slow bolts at the pod; a bubble on it blocks them. */
	private updateBolts(game: Game, dt: number) {
		const pod = this.pod;
		if (this.step === 'shieldPod' && this.cheer <= 0) {
			this.boltTimer -= dt;
			if (this.boltTimer <= 0) {
				this.boltTimer = BOLT_EVERY;
				const from = this.drones[this.bolts.length % this.drones.length];
				const len = Math.hypot(pod.x - from.x, pod.y - from.y) || 1;
				this.bolts.push({ x: from.x, y: from.y, vx: ((pod.x - from.x) / len) * BOLT_SPEED, vy: ((pod.y - from.y) / len) * BOLT_SPEED });
			}
		}
		for (const b of [...this.bolts]) {
			b.x += b.vx * dt;
			b.y += b.vy * dt;
			if (Math.hypot(b.x - pod.x, b.y - pod.y) > 30) continue;
			this.bolts.splice(this.bolts.indexOf(b), 1);
			const blocked = absorbWithShield(game.constructs, pod, 10) === 0;
			if (blocked) {
				if (this.step === 'shieldPod') this.count++;
				game.constructs.effects.push({ kind: 'snap', x: b.x, y: b.y, age: 0, life: 0.3, radius: 26, lift: pod.lift });
			} else {
				this.podFlash = 0.25;
				game.constructs.effects.push({ kind: 'impact', x: b.x, y: b.y, age: 0, life: 0.3, lift: pod.lift });
			}
		}
		// Danger for the smart shield: bolts in the air make the pod the one to protect
		pod.threat = this.bolts.length > 0 ? 1.5 : 0;
	}

	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		const list: Drawable[] = [];
		const p = this.game?.players[0];
		const k = this.kilowog;
		// Kilowog watches the recruit
		const dir: 1 | -1 = !p || p.x >= k.x ? 1 : -1;
		const pose: LanternPose = {
			dir,
			walkPhase: 0,
			altitude: 0,
			hoverHeight: HOVER_PLANET,
			lean: 0,
			glow: false,
			shadow: true,
			firing: false,
			aimX: dir,
			aimY: 0,
			victory: this.cheer > 0 ? 1 : 0,
			build: { leg: 1.05, torso: 1.15, arm: 1.15, neck: 0.4 },
			hunch: 0.12
		};
		list.push({ baseY: k.y, draw: () => drawLantern(ctx, KILOWOG, k.x, k.y, pose, time, 1.3) });

		const nextMarker = this.step === 'move' ? this.markers.slice(this.count, this.count + 1) : this.step === 'land' ? this.markers : [];
		for (const m of nextMarker) list.push({ baseY: m.y - 1000, draw: () => drawMarker(ctx, m.x, m.y, MARKER_RADIUS, time) });

		if (this.step === 'shieldPod') {
			const pod = this.pod;
			const shield = this.game?.constructs.shields.find((s) => s.target === pod);
			list.push({
				baseY: pod.y,
				draw: () => {
					drawSupplyPod(ctx, pod.x, pod.y, this.podFlash > 0, time);
					if (shield) drawShipShield(ctx, shield, pod.x, pod.y - pod.lift, pod.radius, time);
				}
			});
			for (const d of this.drones) list.push({ baseY: d.y, draw: () => drawPracticeDrone(ctx, d.x, d.y, time) });
			for (const b of this.bolts) list.push({ baseY: b.y, draw: () => drawPracticeBolt(ctx, b.x, b.y, 30) });
		}
		return list;
	}
}
