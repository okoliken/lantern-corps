// The end: back on Oa. Every Lantern who fought at the dark altar stands in
// front of the Guardians, and the Central Battery burns bright again.

import { HOVER_SPACE, drawLantern, type LanternPose } from '../draw/lantern';
import { drawCentralBattery } from '../draw/siege';
import { OA_GROUND, OA_H, OA_W, drawOaBackdrop } from '../draw/oa';
import { LANTERNS, type RingBearerId } from '../lanterns';
import { DialogueScene } from './scene';
import { drawGuardianDais } from './summoned';

const TALK_STARTS = 2.4;
const FIGURE_SCALE = 1.25;
const LINEUP: [RingBearerId, number][] = [
	['boodikka', 560],
	['katma', 650],
	['arisia', 740],
	['hal', 850],
	['john', 950],
	['kilowog', 1070]
];

export class LastLight extends DialogueScene {
	protected readonly stage = { width: OA_W, height: OA_H };
	protected readonly talkStarts = TALK_STARTS;

	protected drawStage(ctx: CanvasRenderingContext2D, t: number) {
		drawOaBackdrop(ctx, t, 0);
		drawCentralBattery(ctx, 1260, OA_GROUND + 40, t, 1, 0.25 + 0.1 * Math.sin(t), 0);
		drawGuardianDais(ctx, 290, OA_GROUND - 40, t, this.current?.who === 'guardian' || this.current?.who === 'ganthet', 0);
		const last = this.line >= this.lines.length - 1;
		for (const [id, x] of LINEUP) {
			const def = LANTERNS[id];
			const pose: LanternPose = { dir: -1, walkPhase: 0, altitude: 0, hoverHeight: HOVER_SPACE, lean: 0, glow: last, shadow: true, firing: last, aimX: -0.2, aimY: -1, build: def.build, hunch: def.hunch };
			drawLantern(ctx, def, x, OA_GROUND, pose, t, FIGURE_SCALE * (def.figureScale ?? 1));
		}
		// The oath at the end: every ring raised, and the light going up
		if (last) {
			ctx.save();
			ctx.globalCompositeOperation = 'lighter';
			for (const [, x] of LINEUP) {
				const beam = ctx.createLinearGradient(0, OA_GROUND - 120, 0, 0);
				beam.addColorStop(0, 'rgba(61, 255, 110, 0.4)');
				beam.addColorStop(1, 'rgba(61, 255, 110, 0)');
				ctx.fillStyle = beam;
				ctx.fillRect(x - 5, 0, 10, OA_GROUND - 110);
			}
			ctx.restore();
		}
	}
}
