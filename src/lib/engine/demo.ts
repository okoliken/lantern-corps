// Construct demos: a Lantern in a small arena with three training dummies,
// using one construct (or their ring shot, shield or signature) on a loop,
// so the Constructs page can show what each one does instead of describing
// it. Each loop is a fresh Game run by a little script of inputs.

import { CONSTRUCTS, type Behavior, type ConstructDef, type ConstructId } from './constructs/defs';
import { Game } from './game';
import { IDLE, type Intent } from './input';
import type { LanternId } from './lanterns';
import type { GameMap } from './map';
import type { View } from './canvas';

export type DemoSubject = { kind: 'construct'; id: ConstructId } | { kind: 'shot' } | { kind: 'shield' } | { kind: 'signature' };

const ME = { x: 560, y: 520 };
const TARGETS = [
	{ x: 820, y: 480 },
	{ x: 900, y: 570 },
	{ x: 980, y: 500 }
];
/** When the Lantern acts, after the loop starts. */
const GO = 0.25;
/** What the demo frames, in world px: him on the left, the dummies on the right, whatever size it's drawn. */
const FRAME = { x: 790, y: 470, width: 580 };
/** Dummies walk toward him at this speed, for constructs that wait for something to come close (mines, cages). */
const WALK_IN = 170;

const arena = (): GameMap => ({
	name: 'Demo',
	environment: 'planet',
	ground: 'deck',
	width: 1600,
	height: 1000,
	spawn: ME,
	battery: { x: 160, y: 160 },
	noBattery: true,
	dummies: TARGETS,
	obstacles: []
});

const behaviorOf = (s: DemoSubject): Behavior | null => (s.kind === 'construct' ? CONSTRUCTS[s.id].behavior : null);

/** Seconds one loop runs: long enough to see it land, short enough to watch a few. */
export function demoLength(s: DemoSubject): number {
	if (s.kind === 'signature') return 3.4;
	const b = behaviorOf(s);
	return b === 'turret' || b === 'squad' || b === 'wingman' || b === 'mine' || b === 'trap' || b === 'armor' || b === 'lock' ? 3 : 2.4;
}

/** The moment that shows it best, for a still. */
export function demoPeak(s: DemoSubject): number {
	if (s.kind === 'signature') return 1.2;
	if (s.kind === 'shot') return 0.7;
	if (s.kind === 'shield') return 0.6;
	const def: ConstructDef = CONSTRUCTS[s.id];
	switch (def.behavior) {
		case 'slash':
		case 'area':
		case 'spread':
			return GO + 0.12;
		case 'smash':
			return GO + (def.windup ?? 0.15) + 0.08;
		case 'snipe':
			return 1.45;
		case 'pillars':
			return GO + (def.charge ?? 0.5) + (def.count ? 0.35 : 0.05);
		case 'ram':
			return GO + 0.6;
		case 'turret':
		case 'squad':
		case 'wingman':
		case 'mine':
		case 'trap':
			return 1.6;
		default:
			return GO + 0.55;
	}
}

/** Mines and cages wait for something to walk in: in their demos, the dummies come to him. */
const walksIn = (s: DemoSubject) => {
	const b = behaviorOf(s);
	return b === 'mine' || b === 'trap';
};
/** Cluster bombs drop BEHIND him: he faces away from the dummies coming up behind. */
const facesAway = (s: DemoSubject) => s.kind === 'construct' && CONSTRUCTS[s.id].shape === 'cluster';

export class ConstructDemo {
	game!: Game;
	time = 0;
	readonly length: number;
	/** The screen it draws to: the game skips its updates until it has one, and every loop's new game shares it. */
	view: View = { width: 640, height: 360 };
	/** World px across the view: smaller is closer. */
	frameWidth = FRAME.width;

	constructor(
		readonly lantern: LanternId,
		readonly subject: DemoSubject
	) {
		this.length = demoLength(subject);
		this.reset();
	}

	private reset() {
		this.time = 0;
		const game = new Game({ players: [{ lantern: this.lantern, keys: 'solo' }], map: arena(), zoom: 1.2 });
		game.setView(this.view);
		game.hud = false;
		game.nameTags = false;
		game.infiniteWillpower = true;
		game.infiniteSurge = this.subject.kind === 'signature';
		const p = game.players[0];
		if (this.subject.kind === 'construct') {
			p.loadout = [CONSTRUCTS[this.subject.id]];
			p.cooldowns = [0];
			p.selected = 0;
		}
		p.input = { read: () => this.intent() };
		game.director = { update() {} };
		this.game = game;
		this.frame();
	}

	/** What the Lantern does this tick: aim at the first dummy, then use it the way it's used. */
	private intent(): Intent {
		const t = this.time;
		const p = this.game.players[0];
		const away = facesAway(this.subject);
		const aim = away ? { x: ME.x - 300, y: ME.y } : TARGETS[0];
		const intent: Intent = { ...IDLE, pointer: { x: aim.x, y: aim.y - p.ringLift } };
		const go = t >= GO;
		const first = go && t - GO < 1 / 60 + 1e-6;
		switch (this.subject.kind) {
			case 'shot':
				intent.shot = go && t < 1.9;
				return intent;
			case 'shield':
				intent.shield = first;
				return intent;
			case 'signature':
				intent.signature = first;
				return intent;
		}
		const b = CONSTRUCTS[this.subject.id].behavior;
		if (b === 'beam' || b === 'rapid' || b === 'grind') intent.construct = go && t < 1.8;
		else if (b === 'snipe') intent.construct = go && t < 1.35;
		else {
			intent.construct = first;
			intent.constructPressed = first;
		}
		// A suit or a lock is about what comes after: fire the ring through it
		if ((b === 'armor' || b === 'lock') && t > 0.9) intent.shot = true;
		return intent;
	}

	update(dt: number) {
		this.time += dt;
		if (this.time >= this.length) {
			this.reset();
			return;
		}
		// The dummies stand to his right: walking in is walking left
		if (walksIn(this.subject) && this.time > 0.5) for (const d of this.game.dummies) d.x -= WALK_IN * dt;
		this.game.update(dt);
		this.frame();
	}

	/** Hold the camera on him and the dummies, the whole scene filling the view (the game's own camera would follow him). */
	private frame() {
		const cam = this.game.camera;
		cam.zoom = this.view.width / this.frameWidth;
		cam.x = cam.prevX = FRAME.x;
		cam.y = cam.prevY = FRAME.y;
	}
}

/** Run a demo to its best moment and draw that frame: a still for a tile (browser only). */
export function demoStill(lantern: LanternId, subject: DemoSubject, width: number, height: number): string {
	const demo = new ConstructDemo(lantern, subject);
	const scale = 2;
	const canvas = document.createElement('canvas');
	canvas.width = width * scale;
	canvas.height = height * scale;
	const ctx = canvas.getContext('2d')!;
	ctx.setTransform(scale, 0, 0, scale, 0, 0);
	demo.view.width = width;
	demo.view.height = height;
	// A still is small: closer in, on the action
	demo.frameWidth = FRAME.width * 0.8;
	const peak = demoPeak(subject);
	for (let t = 0; t < peak; t += 1 / 60) demo.update(1 / 60);
	demo.game.render(ctx, 1);
	return canvas.toDataURL('image/webp', 0.8);
}
