// Start of Act 2, Mission 5: John is back on his roof in Detroit, in the
// uniform this time, when three lights come down out of the sky: the
// Manhunters that got out of the vault. Under the city, eyes start opening in
// the dark. And a Martian speaks to him, politely, inside his head.

import type { LanternPose } from '../animation';
import { EARTH_H, EARTH_W, ROOF, drawDetroit } from '../draw/earth';
import { HOVER_PLANET, drawLantern } from '../draw/lantern';
import { LANTERNS } from '../lanterns';
import { DialogueScene } from './scene';

const TALK_STARTS = 3.2;
const FIGURE_SCALE = 1.6;
const JOHN = { x: 820, y: ROOF };
/** The three that fell: where each comes from, and where it goes down behind the skyline. */
const FALLING = [
	{ from: [1300, -40], to: [420, 470], at: 0.3 },
	{ from: [1380, 40], to: [250, 500], at: 0.9 },
	{ from: [1150, -60], to: [560, 440], at: 1.5 }
];
const FALL_TIME = 1.5;
/** Eyes opening down in the streets between the buildings: [x, y, when (0..1 of the dread)]. */
const EYES = Array.from({ length: 30 }, (_, i) => [40 + ((i * 397) % 1320), ROOF - 8 - ((i * 131) % 44), (i * 0.618) % 1]);

export class TheSignal extends DialogueScene {
	protected readonly stage = { width: EARTH_W, height: EARTH_H };
	protected readonly talkStarts = TALK_STARTS;
	/** How much of the city under him has woken (0..1): rises with every alarming line. */
	private dread = 0;

	protected tick(dt: number) {
		const told = this.lines.slice(0, this.line + 1).filter((l) => l.mood === 'alarm').length;
		this.dread += (Math.min(1, told * 0.4) - this.dread) * Math.min(1, dt * 1.5);
	}

	protected drawStage(ctx: CanvasRenderingContext2D, t: number) {
		drawDetroit(ctx, t, 0);
		this.drawFalling(ctx, t);
		this.drawEyes(ctx, t);
		const mind = this.current?.who === 'jonn';
		const pose: LanternPose = {
			dir: -1,
			walkPhase: 0,
			altitude: 0,
			hoverHeight: HOVER_PLANET,
			lean: 0,
			glow: false,
			shadow: true,
			firing: false,
			aimX: -1,
			aimY: t < TALK_STARTS ? -0.5 : 0
		};
		drawLantern(ctx, LANTERNS.john, JOHN.x, JOHN.y, pose, t, FIGURE_SCALE);
		if (mind) this.drawMindVoice(ctx, t);
	}

	/** Three lights down out of the sky, red-orange, gone behind the skyline. */
	private drawFalling(ctx: CanvasRenderingContext2D, t: number) {
		ctx.save();
		ctx.lineCap = 'round';
		for (const f of FALLING) {
			const k = (t - f.at) / FALL_TIME;
			if (k < 0 || k > 1.25) continue;
			const head = Math.min(1, k);
			const tail = Math.max(0, k - 0.25);
			const at = (p: number): [number, number] => [f.from[0] + (f.to[0] - f.from[0]) * p, f.from[1] + (f.to[1] - f.from[1]) * p];
			const [hx, hy] = at(head);
			const [tx, ty] = at(tail);
			ctx.strokeStyle = 'rgba(255, 138, 42, 0.8)';
			ctx.shadowColor = '#ff8a2a';
			ctx.shadowBlur = 16;
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.moveTo(tx, ty);
			ctx.lineTo(hx, hy);
			ctx.stroke();
			if (k >= 1) {
				// Where it came down: a flare behind the buildings
				const glow = ctx.createRadialGradient(f.to[0], f.to[1], 2, f.to[0], f.to[1], 90);
				glow.addColorStop(0, `rgba(255, 170, 90, ${0.7 * (1.25 - k) * 4})`);
				glow.addColorStop(1, 'rgba(255, 170, 90, 0)');
				ctx.fillStyle = glow;
				ctx.fillRect(f.to[0] - 90, f.to[1] - 90, 180, 180);
			}
		}
		ctx.restore();
	}

	/** In the dark below the roofline, pairs of orange eyes open, a few at first and then everywhere. */
	private drawEyes(ctx: CanvasRenderingContext2D, t: number) {
		if (this.dread <= 0.02) return;
		ctx.save();
		// The streets below start to glow
		const haze = ctx.createLinearGradient(0, ROOF - 120, 0, ROOF);
		haze.addColorStop(0, 'rgba(255, 138, 42, 0)');
		haze.addColorStop(1, `rgba(255, 138, 42, ${0.28 * this.dread})`);
		ctx.fillStyle = haze;
		ctx.fillRect(0, ROOF - 120, EARTH_W, 120);
		ctx.fillStyle = '#ff8a2a';
		ctx.shadowColor = '#ff8a2a';
		ctx.shadowBlur = 8;
		for (const [x, y, when] of EYES) {
			if (when > this.dread) continue;
			ctx.globalAlpha = Math.min(1, (this.dread - when) * 6) * (0.7 + 0.3 * Math.sin(t * 3 + x));
			ctx.fillRect(x, y, 5, 2);
			ctx.fillRect(x + 9, y, 5, 2);
		}
		ctx.restore();
	}

	/** J'onn is a voice in his head: rings of thought round John's head. */
	private drawMindVoice(ctx: CanvasRenderingContext2D, t: number) {
		ctx.save();
		for (let i = 0; i < 3; i++) {
			const k = (t * 0.7 + i / 3) % 1;
			ctx.strokeStyle = `rgba(120, 220, 170, ${0.5 * (1 - k)})`;
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.ellipse(JOHN.x, JOHN.y - 118, 18 + k * 46, 10 + k * 24, 0, 0, Math.PI * 2);
			ctx.stroke();
		}
		ctx.restore();
	}
}
