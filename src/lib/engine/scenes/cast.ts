// A story scene staged with a cast: a backdrop for the place, and the people
// in it, each drawn as who they are (a Lantern with their ring, one of the
// League in their costume, a villain in their own art). They walk, fly or
// land onto their marks on cue, by time or when a line starts, and whoever is
// talking acts it out: an alarmed Lantern raises the ring, a grin is a
// swagger, a salute is the ring held up.
//
// Season two's scenes are built on this (story/seasonTwo.ts); each one brings
// its own place (draw/stages.ts) and its own moments.

import { HOVER_SPACE, drawLantern, type LanternPose } from '../draw/lantern';
import { drawHero } from '../draw/heroes';
import { drawEnemy } from '../draw/enemies';
import { createEnemy, type Enemy, type EnemyKind } from '../enemies/enemies';
import { LANTERNS, type CrewId, type HeroId } from '../lanterns';
import type { Speaker } from '../../story/scenes';
import { DialogueScene, type Line } from './scene';
import { STAGE_H, STAGE_W } from '../draw/stages';
import { green } from '../../theme';


/** Who an actor is, which decides how they're drawn. */
export type Figure =
	| { lantern: Exclude<CrewId, HeroId> }
	| { hero: Exclude<HeroId, 'razer'> }
	| { enemy: EnemyKind }
	/** Someone drawn by the scene itself (the Guardians on their dais, J'onn in his own art). */
	| { draw: (ctx: CanvasRenderingContext2D, x: number, y: number, pose: LanternPose, t: number, speaking: boolean, scale: number) => void };

/** Where an actor goes, and when: at `at` seconds, when line `line` starts, or `wait` seconds after their last move ends. */
export interface Mark {
	at?: number;
	line?: number;
	wait?: number;
	x: number;
	y: number;
	/** Height off the ground they float at here (0 = on their feet). */
	lift?: number;
	dir?: 1 | -1;
	/** Seconds to get there (0 = they're just there). */
	time?: number;
}

export interface Actor {
	figure: Figure;
	/** The speaker whose lines this actor acts out. */
	speaker?: Speaker;
	/** Where they start (the first mark), then where they go. */
	marks: Mark[];
	scale?: number;
	/** Not on stage until their first mark is reached (they arrive from off it). */
	hidden?: boolean;
	/** Looking up-and-forward when alarmed, instead of straight ahead. */
	aimUp?: boolean;
	/** Still hurting from the last fight (0..1). */
	hurt?: number;
	/** Down on the ground, beaten. */
	downed?: boolean;
	/** Held the whole scene, over whatever their line would do (arms up under a load). */
	pose?: Partial<LanternPose>;
	/** Changes into this when line `line` starts (Hal into his uniform), in a flash of ring light. */
	changes?: { line: number; figure: Figure };
}

export interface Staging {
	/** The place, drawn behind everyone. */
	backdrop: (ctx: CanvasRenderingContext2D, t: number, scene: CastScene) => void;
	/** Anything in front of the cast (rain, smoke, a cell's bars). */
	front?: (ctx: CanvasRenderingContext2D, t: number, scene: CastScene) => void;
	cast: Actor[];
	/** When the talking starts. */
	talkStarts: number;
	/** Out in space: nobody casts a shadow. */
	space?: boolean;
}

interface Placed {
	actor: Actor;
	x: number;
	y: number;
	lift: number;
	dir: 1 | -1;
	from: { x: number; y: number; lift: number };
	to: { x: number; y: number; lift: number };
	started: number;
	duration: number;
	next: number;
	/** Moving: walking on the ground or flying. */
	moving: boolean;
	shown: boolean;
	enemy: Enemy | null;
	/** 0..1, a gesture as their line starts. */
	cue: number;
	spoke: number;
}

/** People on the story stage are drawn this much bigger than in play, as season one's scenes are. */
const FIGURE_SCALE = 1.4;

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export class CastScene extends DialogueScene {
	protected readonly stage = { width: STAGE_W, height: STAGE_H };
	protected readonly talkStarts: number;
	readonly placed: Placed[];

	constructor(
		lines: Line[],
		readonly staging: Staging
	) {
		super(lines);
		this.talkStarts = staging.talkStarts;
		this.placed = staging.cast.map((actor) => {
			const m = actor.marks[0];
			const lift = m.lift ?? 0;
			const at = { x: m.x, y: m.y, lift };
			const enemy = 'enemy' in actor.figure ? createEnemy(actor.figure.enemy, m.x, m.y) : null;
			return { actor, x: m.x, y: m.y, lift, dir: m.dir ?? 1, from: at, to: at, started: 0, duration: 0, next: 1, moving: false, shown: !actor.hidden, enemy, cue: 0, spoke: -1 };
		});
	}

	/** Who's saying the current line (the speaker id). */
	get speaking(): Speaker | null {
		return (this.current?.who as Speaker | undefined) ?? null;
	}

	protected tick(dt: number) {
		for (const p of this.placed) {
			const marks = p.actor.marks;
			while (p.next < marks.length) {
				const m = marks[p.next];
				const due =
					m.wait !== undefined
						? this.time >= p.started + p.duration + m.wait
						: m.line !== undefined
							? this.line >= m.line
							: this.time >= (m.at ?? 0);
				if (!due) break;
				p.from = { x: p.x, y: p.y, lift: p.lift };
				p.to = { x: m.x, y: m.y, lift: m.lift ?? 0 };
				p.started = this.time;
				p.duration = m.time ?? 0;
				if (m.dir) p.dir = m.dir;
				else if (Math.abs(m.x - p.x) > 4) p.dir = m.x > p.x ? 1 : -1;
				p.next++;
				p.shown = true;
			}
			const k = p.duration > 0 ? Math.min(1, (this.time - p.started) / p.duration) : 1;
			const e = ease(k);
			p.x = p.from.x + (p.to.x - p.from.x) * e;
			p.y = p.from.y + (p.to.y - p.from.y) * e;
			p.lift = p.from.lift + (p.to.lift - p.from.lift) * e;
			p.moving = k < 1;
			// Face back to whoever's talking once they've arrived
			if (k >= 1 && p.next >= marks.length && marks[marks.length - 1].dir === undefined) {
				const talker = this.placed.find((o) => o !== p && o.actor.speaker && o.actor.speaker === this.speaking);
				if (talker && Math.abs(talker.x - p.x) > 30) p.dir = talker.x > p.x ? 1 : -1;
			}
			if (p.actor.speaker && p.actor.speaker === this.speaking && p.spoke !== this.line) {
				p.spoke = this.line;
				p.cue = 1;
			}
			p.cue = Math.max(0, p.cue - dt * 1.4);
		}
	}

	protected drawStage(ctx: CanvasRenderingContext2D, t: number) {
		this.staging.backdrop(ctx, t, this);
		const order = this.placed.filter((p) => p.shown).sort((a, b) => a.y - b.y);
		for (const p of order) this.drawActor(ctx, p, t);
		this.staging.front?.(ctx, t, this);
	}

	private drawActor(ctx: CanvasRenderingContext2D, p: Placed, t: number) {
		const { actor } = p;
		const talking = !!actor.speaker && actor.speaker === this.speaking;
		const mood = talking ? this.current?.mood : undefined;
		const flying = p.lift > 4;
		const pose: LanternPose = {
			dir: p.dir,
			walkPhase: p.moving && !flying ? t * 9 : 0,
			altitude: flying ? 1 : 0,
			hoverHeight: flying ? p.lift / ((actor.scale ?? FIGURE_SCALE) * 1.35) : HOVER_SPACE,
			lean: p.moving && flying ? 0.5 : 0,
			glow: flying,
			shadow: !this.staging.space,
			firing: mood === 'alarm' || mood === 'salute',
			aimX: mood === 'salute' ? p.dir * 0.3 : p.dir * (actor.aimUp ? 0.6 : 0.9),
			aimY: mood === 'salute' ? -0.95 : actor.aimUp ? -0.8 : -0.25,
			cast: mood === 'chosen' ? 0.6 + 0.4 * Math.sin(t * 6) : talking ? p.cue * 0.35 : 0,
			victory: mood === 'grin' ? 0.6 : 0,
			hurt: actor.hurt ?? 0,
			downed: actor.downed,
			...actor.pose
		};
		const scale = actor.scale ?? FIGURE_SCALE;
		const changed = actor.changes && this.line >= actor.changes.line;
		const f = changed ? actor.changes!.figure : actor.figure;
		if (changed && p.cue > 0.4) drawChangeFlash(ctx, p.x, p.y - p.lift - 60, (p.cue - 0.4) / 0.6);
		if ('lantern' in f) {
			const def = LANTERNS[f.lantern];
			drawLantern(ctx, def, p.x, p.y, { ...pose, build: def.build, hunch: def.hunch }, t, scale * (def.figureScale ?? 1));
		} else if ('hero' in f) {
			drawHero(ctx, f.hero, LANTERNS[f.hero].look, p.x, p.y, pose, t, scale);
		} else if ('enemy' in f && p.enemy) {
			const e = p.enemy;
			e.x = p.x;
			e.y = p.y;
			e.dir = p.dir;
			e.brain.aimX = p.dir;
			e.brain.aimY = 0;
			e.brain.air = 0;
			e.vx = p.moving ? p.dir * 120 : 0;
			if (actor.downed) e.down = 99;
			// Floating: drawn up off the ground (enemy art measures its own air in a different way), its shadow left below
			if (p.lift > 0 && !this.staging.space) {
				ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
				ctx.beginPath();
				ctx.ellipse(p.x, p.y, 16 * scale, 5 * scale, 0, 0, Math.PI * 2);
				ctx.fill();
			}
			const y = p.y - p.lift;
			ctx.save();
			if (scale !== 1) {
				ctx.translate(p.x, y);
				ctx.scale(scale, scale);
				ctx.translate(-p.x, -y);
			}
			drawEnemy(ctx, e, p.x, y, !this.staging.space && p.lift === 0, t, false);
			ctx.restore();
		} else if ('draw' in f) {
			f.draw(ctx, p.x, p.y, pose, t, talking, scale);
		}
	}
}

/** The ring's light flaring as someone changes into the uniform: `k` 1 at the start, fading to 0. */
function drawChangeFlash(ctx: CanvasRenderingContext2D, x: number, y: number, k: number) {
	ctx.save();
	const r = 40 + (1 - k) * 120;
	const g = ctx.createRadialGradient(x, y, 4, x, y, r);
	g.addColorStop(0, `rgba(230, 255, 235, ${0.9 * k})`);
	g.addColorStop(0.4, green(0.5 * k));
	g.addColorStop(1, green(0));
	ctx.fillStyle = g;
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}
