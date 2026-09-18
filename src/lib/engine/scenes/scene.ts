// A story scene: a timeline on its own clock. First the animation plays;
// once everyone is in place, the dialogue plays one line at a time (click
// to go on, or it moves on by itself). The Svelte side (StoryScene.svelte)
// shows the dialogue box; a scene draws the world on a fixed stage that's
// scaled to fill the screen.

import type { View } from '../canvas';

export interface Line {
	who: string;
	text: string;
	/** How the speaker acts while saying it (each scene decides what that looks like). */
	mood?: 'salute' | 'grin' | 'alarm' | 'chosen';
}

const FADE_TIME = 1;
/** Letters per second as a line types out. */
const TYPE_SPEED = 45;
/** Seconds a finished line stays up before the next one, if nobody clicks. */
const READ_TIME = 4;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (t: number) => 1 - (1 - t) ** 3;

export abstract class DialogueScene {
	time = 0;
	/** Index of the line being said; -1 before the talking starts. */
	line = -1;
	/** How many letters of the current line are showing. */
	shown = 0;
	/** 0..1 fading out at the end. */
	fade = 0;
	done = false;
	private lineAge = 0;

	/** The stage size the scene draws on, and when the talking starts. */
	protected abstract readonly stage: { width: number; height: number };
	protected abstract readonly talkStarts: number;

	constructor(readonly lines: Line[]) {}

	/** Draw the world at time `t`, on the stage. */
	protected abstract drawStage(ctx: CanvasRenderingContext2D, t: number): void;

	/** Anything else to update each frame. */
	protected tick(_dt: number) {}

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
		if (this.line === -1 && this.time >= this.talkStarts) this.startLine(0);
		const l = this.current;
		if (l) {
			this.lineAge += dt;
			this.shown = Math.min(l.text.length, this.shown + TYPE_SPEED * dt);
			// Nobody clicked: move on by itself after time to read it
			if (this.lineAge > l.text.length / TYPE_SPEED + READ_TIME) this.startLine(this.line + 1);
		}
		this.tick(dt);
		if (this.line >= this.lines.length) {
			this.fade = Math.min(1, this.fade + dt / FADE_TIME);
			if (this.fade >= 1) this.done = true;
		}
	}

	/** Click / Space: finish the line if it's still typing, else go to the next one. */
	advance() {
		if (this.line === -1) {
			// Skip the opening straight to the talking
			this.time = Math.max(this.time, this.talkStarts);
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
		const { width, height } = this.stage;
		// Fit the stage to the screen (cover), a little high so the dialogue box doesn't hide feet
		const k = Math.max(view.width / width, view.height / height);
		ctx.save();
		ctx.fillStyle = '#000';
		ctx.fillRect(0, 0, view.width, view.height);
		ctx.translate((view.width - width * k) / 2, (view.height - height * k) * 0.2 - view.height * 0.06);
		ctx.scale(k, k);
		this.drawStage(ctx, t);
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
}
