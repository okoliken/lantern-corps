// Start of Act 3, Mission 3: the edge of Sector 666. Red nebulae, no stars
// worth the name, and nothing alive. Ganthet leads; Hal, John and Arisia fly
// with him.

import { HOVER_SPACE, drawLantern, type LanternPose } from '../draw/lantern';
import { drawGanthetEscort, drawManhunterHusk, drawRedNebula } from '../draw/sector666';
import { LANTERNS } from '../lanterns';
import { DialogueScene } from './scene';

const STAGE_W = 1400;
const STAGE_H = 784;
const TALK_STARTS = 2;
const FIGURE_SCALE = 1.35;
const STARS = Array.from({ length: 90 }, (_, i) => [(i * 733) % STAGE_W, (i * 419) % STAGE_H, 0.4 + ((i * 7) % 10) / 10]);

export class DeadSector extends DialogueScene {
	protected readonly stage = { width: STAGE_W, height: STAGE_H };
	protected readonly talkStarts = TALK_STARTS;

	protected drawStage(ctx: CanvasRenderingContext2D, t: number) {
		ctx.fillStyle = '#0a0306';
		ctx.fillRect(0, 0, STAGE_W, STAGE_H);
		for (const [x, y, r] of STARS) {
			ctx.fillStyle = `rgba(255, 210, 210, ${0.25 + 0.2 * Math.sin(t + x)})`;
			ctx.fillRect(x, y, r, r);
		}
		drawRedNebula(ctx, 300, 200, 520, 0.2, t);
		drawRedNebula(ctx, 1100, 560, 600, 0.7, t);
		drawManhunterHusk(ctx, 1120, 200, 150, 0.3, t);
		drawManhunterHusk(ctx, 230, 620, 110, 0.8, t);
		const drift = Math.sin(t * 0.8) * 6;
		drawGanthetEscort(ctx, 540, 470 + drift, t, 0, false);
		const pose = (lean: number): LanternPose => ({ dir: 1, walkPhase: 0, altitude: 1, hoverHeight: HOVER_SPACE, lean, glow: true, shadow: false, firing: false, aimX: 1, aimY: 0 });
		drawLantern(ctx, LANTERNS.hal, 760, 440 + drift * 0.6, pose(0.3), t, FIGURE_SCALE);
		drawLantern(ctx, LANTERNS.john, 880, 520 + drift * 0.8, pose(0.3), t, FIGURE_SCALE);
		drawLantern(ctx, LANTERNS.arisia, 700, 600 + drift, pose(0.3), t, FIGURE_SCALE);
	}
}
