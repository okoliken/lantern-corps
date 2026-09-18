// End of Mission 2: Tolen Vex's ring crosses Sector 2814 and finds its new
// bearer on Earth. Detroit, night, the roof of a building going up: John
// Stewart, Marine and architect, still in his work clothes and hard hat,
// looks up as a green star falls out of the sky and stops right in front of
// him. When the ring says "Welcome to the
// Green Lantern Corps" it slides onto his finger, there's a flash, and he's
// in the uniform.

import type { LanternPose } from '../animation';
import { EARTH_H, EARTH_W, ROOF, drawDetroit } from '../draw/earth';
import { GREEN, HOVER_PLANET, drawLantern, ringPosition, type Figure } from '../draw/lantern';
import { LANTERNS } from '../lanterns';
import { DialogueScene, type Line } from './scene';

const TAU = Math.PI * 2;
// ---- The timeline, in seconds ----
const RING_APPEARS = 2.2;
const RING_ARRIVES = 5;
const TALK_STARTS = 5.5;
/** From the "welcome" line: the ring flies onto his hand, then the flash. */
const ONTO_HAND = 0.6;
const FLASH = 0.5;

const FIGURE_SCALE = 1.6;
/** John before the ring: an architect on his building site, after hours. */
const JOHN_AT_WORK: Figure = {
	...LANTERNS.john,
	outfit: { top: '#5e4e3b', topLit: '#86704f', trousers: '#2b3954', boots: '#4a3222', hardHat: '#ece6d4' }
};
const JOHN = { x: 820, y: ROOF };
/** Where the ring hovers in front of him while it talks. */
const HOVER = { x: 690, y: ROOF - 110 };

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export class JohnChosen extends DialogueScene {
	protected readonly stage = { width: EARTH_W, height: EARTH_H };
	protected readonly talkStarts = TALK_STARTS;
	/** Scene time when the ring said "welcome" (the transformation starts). */
	private chosenAt: number | null = null;

	constructor(lines: Line[]) {
		super(lines);
	}

	protected tick() {
		if (this.chosenAt === null && this.current?.mood === 'chosen') this.chosenAt = this.time;
	}

	/** 0 before the transformation, 1 once he's in the uniform. */
	private get suited(): number {
		if (this.chosenAt === null) return 0;
		return clamp01((this.time - this.chosenAt - ONTO_HAND) / 0.1);
	}

	protected drawStage(ctx: CanvasRenderingContext2D, t: number) {
		const arriving = clamp01((t - RING_APPEARS) / (RING_ARRIVES - RING_APPEARS));
		drawDetroit(ctx, t, arriving);
		this.drawJohn(ctx, t);
		this.drawRing(ctx, t, arriving);
		this.drawFlash(ctx, t);
	}

	private pose(t: number): LanternPose {
		const suited = this.suited;
		const lookUp = clamp01((t - RING_APPEARS) / 1.5);
		const since = this.chosenAt === null ? 0 : t - this.chosenAt;
		return {
			dir: -1,
			walkPhase: 0,
			// Once chosen, the ring lifts him off the roof
			altitude: suited ? Math.min(0.35, (since - ONTO_HAND) * 0.4) : 0,
			hoverHeight: HOVER_PLANET,
			lean: 0,
			glow: suited > 0,
			shadow: true,
			// Arms at his sides; he only holds out his hand when the ring comes to him
			firing: this.chosenAt !== null,
			aimX: -0.9,
			aimY: -0.45 * lookUp
		};
	}

	private drawJohn(ctx: CanvasRenderingContext2D, t: number) {
		const pose = this.pose(t);
		ctx.save();
		// In his work clothes until the flash, a little dim in the night air
		if (!this.suited) ctx.filter = 'brightness(0.8)';
		drawLantern(ctx, this.suited ? LANTERNS.john : JOHN_AT_WORK, JOHN.x, JOHN.y, pose, t, FIGURE_SCALE);
		ctx.restore();
	}

	private drawRing(ctx: CanvasRenderingContext2D, t: number, arriving: number) {
		if (t < RING_APPEARS || this.suited) return;
		// A green star far off, swinging down across the sky to stop in front of him
		const k = easeInOut(arriving);
		let x = 80 + (HOVER.x - 80) * k;
		let y = 40 + (HOVER.y - 40) * k - Math.sin(k * Math.PI) * 60;
		const bob = arriving >= 1 ? Math.sin(t * 2.5) * 6 : 0;
		y += bob;
		// Onto his finger
		if (this.chosenAt !== null) {
			const [hx, hy] = ringPosition(JOHN.x, JOHN.y, this.pose(t), t, FIGURE_SCALE);
			const m = easeInOut(clamp01((t - this.chosenAt) / ONTO_HAND));
			x += (hx - x) * m;
			y += (hy - y) * m;
		}
		const size = 3 + 5 * k;
		ctx.save();
		const glow = ctx.createRadialGradient(x, y, 1, x, y, 60 * (0.4 + k));
		glow.addColorStop(0, 'rgba(61, 255, 110, 0.7)');
		glow.addColorStop(1, 'rgba(61, 255, 110, 0)');
		ctx.fillStyle = glow;
		ctx.beginPath();
		ctx.arc(x, y, 60 * (0.4 + k), 0, TAU);
		ctx.fill();
		ctx.shadowColor = GREEN;
		ctx.shadowBlur = 20;
		ctx.strokeStyle = '#eafff0';
		ctx.lineWidth = 2.5;
		ctx.beginPath();
		ctx.ellipse(x, y, size, size * 0.7, Math.sin(t * 3) * 0.5, 0, TAU);
		ctx.stroke();
		// A streak behind it while it falls
		if (arriving < 1) {
			ctx.strokeStyle = `rgba(61, 255, 110, ${0.5 * (1 - arriving)})`;
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.moveTo(x - 90, y - 50);
			ctx.lineTo(x, y);
			ctx.stroke();
		}
		ctx.restore();
	}

	/** The flash of green light as the uniform forms. */
	private drawFlash(ctx: CanvasRenderingContext2D, t: number) {
		if (this.chosenAt === null) return;
		const k = (t - this.chosenAt - ONTO_HAND + 0.1) / FLASH;
		if (k < 0 || k > 1) return;
		const a = k < 0.3 ? k / 0.3 : 1 - (k - 0.3) / 0.7;
		ctx.save();
		const g = ctx.createRadialGradient(JOHN.x, JOHN.y - 90, 10, JOHN.x, JOHN.y - 90, 700);
		g.addColorStop(0, `rgba(234, 255, 240, ${a})`);
		g.addColorStop(0.3, `rgba(61, 255, 110, ${0.7 * a})`);
		g.addColorStop(1, 'rgba(61, 255, 110, 0)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, EARTH_W, EARTH_H + 400);
		ctx.restore();
	}
}
