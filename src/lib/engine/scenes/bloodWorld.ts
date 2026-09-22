// Start of Act 3, Mission 4: through the Blood Gate, down onto Ysmault. A red
// sun, black crags, and far off the glow of the Blood Altar. Atrocitus
// speaks from everywhere at once.

import { HOVER_PLANET, drawLantern, type LanternPose } from '../draw/lantern';
import { LANTERNS } from '../lanterns';
import { DialogueScene } from './scene';

const STAGE_W = 1400;
const STAGE_H = 784;
const GROUND = 600;
const TALK_STARTS = 2.4;
const FIGURE_SCALE = 1.5;
/** Crags along the horizon: [x, width, height]. */
const CRAGS = Array.from({ length: 14 }, (_, i) => [i * 110 - 40 + ((i * 37) % 50), 90 + ((i * 53) % 80), 90 + ((i * 71) % 170)]);

export class BloodWorld extends DialogueScene {
	protected readonly stage = { width: STAGE_W, height: STAGE_H };
	protected readonly talkStarts = TALK_STARTS;

	protected drawStage(ctx: CanvasRenderingContext2D, t: number) {
		const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
		sky.addColorStop(0, '#1a0204');
		sky.addColorStop(0.7, '#5a0a0c');
		sky.addColorStop(1, '#8a1a12');
		ctx.fillStyle = sky;
		ctx.fillRect(0, 0, STAGE_W, GROUND);
		// The red sun
		const sun = ctx.createRadialGradient(1060, 200, 10, 1060, 200, 170);
		sun.addColorStop(0, 'rgba(255, 150, 110, 0.95)');
		sun.addColorStop(0.35, 'rgba(230, 40, 30, 0.6)');
		sun.addColorStop(1, 'rgba(120, 0, 0, 0)');
		ctx.fillStyle = sun;
		ctx.fillRect(860, 0, 400, 400);
		// The altar's glow, far off
		const glow = ctx.createRadialGradient(420, GROUND, 10, 420, GROUND, 260);
		glow.addColorStop(0, `rgba(255, 50, 40, ${0.5 + 0.15 * Math.sin(t * 2)})`);
		glow.addColorStop(1, 'rgba(255, 50, 40, 0)');
		ctx.fillStyle = glow;
		ctx.fillRect(160, GROUND - 260, 520, 360);
		ctx.fillStyle = 'rgba(255, 60, 50, 0.35)';
		ctx.fillRect(412, GROUND - 420, 16, 420);
		// Crags
		ctx.fillStyle = '#0c0405';
		for (const [x, w, h] of CRAGS) {
			ctx.beginPath();
			ctx.moveTo(x, GROUND);
			ctx.lineTo(x + w * 0.3, GROUND - h);
			ctx.lineTo(x + w * 0.5, GROUND - h * 0.7);
			ctx.lineTo(x + w * 0.7, GROUND - h * 0.95);
			ctx.lineTo(x + w, GROUND);
			ctx.closePath();
			ctx.fill();
		}
		// The ground: dark red rock
		ctx.fillStyle = '#2a0c0c';
		ctx.fillRect(0, GROUND, STAGE_W, STAGE_H - GROUND + 400);
		// Atrocitus is speaking: the whole sky pulses
		if (this.current?.who === 'atrocitus') {
			ctx.fillStyle = `rgba(255, 20, 20, ${0.08 + 0.06 * Math.sin(t * 6)})`;
			ctx.fillRect(0, 0, STAGE_W, STAGE_H + 400);
		}
		const pose = (dir: 1 | -1, fire = false): LanternPose => ({ dir, walkPhase: 0, altitude: 0, hoverHeight: HOVER_PLANET, lean: 0, glow: false, shadow: true, firing: fire, aimX: dir, aimY: -0.2 });
		drawLantern(ctx, LANTERNS.arisia, 760, GROUND, pose(-1), t, FIGURE_SCALE);
		drawLantern(ctx, LANTERNS.hal, 880, GROUND, pose(-1), t, FIGURE_SCALE);
		drawLantern(ctx, LANTERNS.john, 1000, GROUND, pose(-1), t, FIGURE_SCALE);
	}
}
