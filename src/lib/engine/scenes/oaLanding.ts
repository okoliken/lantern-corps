// End of Mission 1: Tomar-Re's ship sets down on Oa, Hal lands beside it,
// Tomar-Re climbs out, thanks him, and warns him about the red light.
//
// A scene is a timeline: the animation runs on its own clock, and once
// everyone is in place the dialogue plays one line at a time (click to go
// on). The Svelte side draws the dialogue box; this draws the world.

import { HOVER_SPACE, drawLantern, type Figure, type LanternPose } from '../draw/lantern';
import { drawEscortShip } from '../draw/escort';
import { OA_GROUND, OA_H, OA_PAD_X, OA_W, drawLandingDust, drawOaBackdrop } from '../draw/oa';
import { LANTERNS } from '../lanterns';
import type { View } from '../canvas';

export interface Line {
	who: string;
	text: string;
	mood?: 'salute' | 'grin' | 'alarm';
}

export const TOMAR_RE: Figure = {
	id: 'tomar',
	look: { skin: '#e07a3a', hair: '#b8412a', hairStyle: 'cropped', mask: false, avian: { beak: '#f2c14e', crest: '#b8412a' } }
};

// ---- The timeline, in seconds ----
const SHIP_LANDS = 4.5;
const HAL_ARRIVES = [0.8, 5.2];
const HATCH_OPENS = [5.6, 6.2];
const TOMAR_FLOATS = [6.2, 7.2];
const TOMAR_WALKS = [7.2, 8.4];
const TALK_STARTS = 8.7;
const FADE_TIME = 1;
/** Letters per second as a line types out. */
const TYPE_SPEED = 45;
/** Seconds a finished line stays up before the next one, if nobody clicks. */
const READ_TIME = 4;

const SHIP_SCALE = 2.4;
const FIGURE_SCALE = 1.4;
const HAL_SPOT = 1010;
const TOMAR_SPOT = 865;
/** Where Tomar-Re steps out: the hatch, in world units (see drawEscortShip). */
const HATCH_X = OA_PAD_X + 12 * SHIP_SCALE;
const HATCH_Y = OA_GROUND - 26 * SHIP_SCALE;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const phase = (t: number, [a, b]: number[]) => clamp01((t - a) / (b - a));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class OaLanding {
	time = 0;
	/** Index of the line being said; -1 before the talking starts. */
	line = -1;
	/** How many letters of the current line are showing. */
	shown = 0;
	/** 0..1 fading out at the end. */
	fade = 0;
	done = false;
	private alarm = 0;
	private lineAge = 0;

	constructor(
		readonly lines: Line[],
		/** 0..1, how battered the ship is (smoke and scorch marks carry over from the mission). */
		private readonly hull: number
	) {}

	get current(): Line | null {
		return this.line >= 0 && this.line < this.lines.length ? this.lines[this.line] : null;
	}

	/** Has the current line finished typing? */
	get lineComplete(): boolean {
		const l = this.current;
		return !l || this.shown >= l.text.length;
	}

	update(dt: number) {
		if (this.done) return;
		this.time += dt;
		if (this.line === -1 && this.time >= TALK_STARTS) this.startLine(0);
		const l = this.current;
		if (l) {
			this.lineAge += dt;
			this.shown = Math.min(l.text.length, this.shown + TYPE_SPEED * dt);
			// Nobody clicked: move on by itself after time to read it
			if (this.lineAge > l.text.length / TYPE_SPEED + READ_TIME) this.startLine(this.line + 1);
		}
		// The sky goes red on the warning, and a little of it stays
		const target = this.lines.slice(0, this.line + 1).some((x) => x.mood === 'alarm') ? (l?.mood === 'alarm' ? 1 : 0.45) : 0;
		this.alarm += (target - this.alarm) * Math.min(1, dt * 2);
		if (this.line >= this.lines.length) {
			this.fade = Math.min(1, this.fade + dt / FADE_TIME);
			if (this.fade >= 1) this.done = true;
		}
	}

	/** Click / Space: finish the line if it's still typing, else go to the next one. */
	advance() {
		if (this.line === -1) {
			// Skip the arrival straight to the talking
			this.time = Math.max(this.time, TALK_STARTS);
			this.startLine(0);
			return;
		}
		const l = this.current;
		if (l && !this.lineComplete) this.shown = l.text.length;
		else if (this.line < this.lines.length) this.startLine(this.line + 1);
	}

	skip() {
		this.done = true;
	}

	private startLine(i: number) {
		this.line = i;
		this.shown = 0;
		this.lineAge = 0;
	}

	draw(ctx: CanvasRenderingContext2D, view: View) {
		const t = this.time;
		// Fit the stage to the screen (cover, anchored to the ground line)
		const k = Math.max(view.width / OA_W, view.height / OA_H);
		ctx.save();
		ctx.fillStyle = '#000';
		ctx.fillRect(0, 0, view.width, view.height);
		ctx.translate((view.width - OA_W * k) / 2, (view.height - OA_H * k) * 0.2 - view.height * 0.06);
		ctx.scale(k, k);

		drawOaBackdrop(ctx, t, this.alarm);
		this.drawShip(ctx, t);
		drawLandingDust(ctx, OA_PAD_X, (t - SHIP_LANDS) / 1.2);
		this.drawTomar(ctx, t);
		this.drawHal(ctx, t);
		ctx.restore();

		// Letterbox bars slide in for the scene, and the fade to black at the end
		const bars = easeOut(clamp01(t / 0.8)) * view.height * 0.08;
		ctx.fillStyle = '#000';
		ctx.fillRect(0, 0, view.width, bars);
		ctx.fillRect(0, view.height - bars, view.width, bars);
		const black = Math.max(this.fade, 1 - clamp01(t / 0.6));
		if (black > 0) {
			ctx.fillStyle = `rgba(0, 0, 0, ${black})`;
			ctx.fillRect(0, 0, view.width, view.height);
		}
	}

	private drawShip(ctx: CanvasRenderingContext2D, t: number) {
		const p = easeOut(clamp01(t / SHIP_LANDS));
		const x = lerp(-380, OA_PAD_X, p);
		const y = lerp(140, OA_GROUND, p);
		const landed = t >= SHIP_LANDS;
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate((1 - p) * 0.18);
		ctx.scale(SHIP_SCALE, SHIP_SCALE);
		drawEscortShip(ctx, 0, 0, this.hull, 0, false, t, {
			landed,
			empty: t >= TOMAR_FLOATS[0],
			hatch: phase(t, HATCH_OPENS)
		});
		ctx.restore();
	}

	private drawHal(ctx: CanvasRenderingContext2D, t: number) {
		const p = phase(t, HAL_ARRIVES);
		if (t < HAL_ARRIVES[0]) return;
		// Flies in behind the ship, then drops onto the plaza
		const x = lerp(-200, HAL_SPOT, easeOut(p));
		const y = lerp(220, OA_GROUND, p < 0.8 ? easeOut(p / 0.8) * 0.85 : 0.85 + ((p - 0.8) / 0.2) * 0.15);
		const altitude = p < 0.85 ? 1 : 1 - (p - 0.85) / 0.15;
		const l = this.current;
		const grin = l?.who === 'hal' && l.mood === 'grin' ? 1 : 0;
		const pose: LanternPose = {
			...basePose(t >= HAL_ARRIVES[1] + 0.2 ? -1 : 1),
			altitude,
			lean: altitude * 0.8,
			glow: altitude > 0,
			shadow: altitude < 0.3,
			victory: grin
		};
		drawLantern(ctx, LANTERNS.hal, x, y, pose, t, FIGURE_SCALE);
	}

	private drawTomar(ctx: CanvasRenderingContext2D, t: number) {
		if (t < TOMAR_FLOATS[0]) return;
		const float = phase(t, TOMAR_FLOATS);
		const walk = phase(t, TOMAR_WALKS);
		const x = lerp(HATCH_X, HATCH_X + 50, float) + (TOMAR_SPOT - HATCH_X - 50) * walk;
		const y = lerp(HATCH_Y, OA_GROUND, easeOut(float));
		const walking = walk > 0 && walk < 1;
		const l = this.current;
		const salute = l?.who === 'tomar' && l.mood === 'salute';
		const pose: LanternPose = {
			...basePose(1),
			altitude: float < 1 ? 1 - float * 0.8 : 0,
			glow: float < 1,
			shadow: float > 0.6,
			walkPhase: walking ? t * 9 : 0,
			// Raises his ring to Hal: the Corps salute
			firing: salute,
			aimX: salute ? 0.35 : 1,
			aimY: salute ? -0.95 : 0
		};
		ctx.save();
		ctx.globalAlpha = clamp01((t - TOMAR_FLOATS[0]) / 0.25);
		drawLantern(ctx, TOMAR_RE, x, y, pose, t, FIGURE_SCALE);
		ctx.restore();
	}
}

function basePose(dir: 1 | -1): LanternPose {
	return {
		dir,
		walkPhase: 0,
		altitude: 0,
		hoverHeight: HOVER_SPACE,
		lean: 0,
		glow: false,
		shadow: true,
		firing: false,
		aimX: dir,
		aimY: 0
	};
}
