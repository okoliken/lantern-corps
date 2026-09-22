// Start of Act 3, Mission 2: the morning after the siege. The Guardians are
// one short. Out on the far plains a column of smoke goes up where a Red
// dreadnought came down, and Kilowog's scanners say something small crawled
// out of it alive.

import { HOVER_SPACE, drawLantern, type LanternPose } from '../draw/lantern';
import { OA_GROUND, OA_H, OA_W, drawOaBackdrop } from '../draw/oa';
import { LANTERNS } from '../lanterns';
import { DialogueScene } from './scene';
import { drawGuardianDais } from './summoned';

const TALK_STARTS = 2;
const FIGURE_SCALE = 1.4;
const DAIS = { x: 300, y: OA_GROUND - 40 };
const SPOTS = { hal: 660, john: 800, kilowog: 960 };
const PLUME = { x: 1240, y: OA_GROUND - 120 };

export class TheTrail extends DialogueScene {
	protected readonly stage = { width: OA_W, height: OA_H };
	protected readonly talkStarts = TALK_STARTS;

	protected drawStage(ctx: CanvasRenderingContext2D, t: number) {
		drawOaBackdrop(ctx, t, 0.35);
		this.drawPlume(ctx, t);
		drawGuardianDais(ctx, DAIS.x, DAIS.y, t, this.current?.who === 'guardian', 0.5);
		drawLantern(ctx, LANTERNS.hal, SPOTS.hal, OA_GROUND, pose(1), t, FIGURE_SCALE);
		drawLantern(ctx, LANTERNS.john, SPOTS.john, OA_GROUND, pose(1), t, FIGURE_SCALE);
		const k = LANTERNS.kilowog;
		drawLantern(ctx, k, SPOTS.kilowog, OA_GROUND, { ...pose(-1), build: k.build, hunch: k.hunch }, t, FIGURE_SCALE * (k.figureScale ?? 1));
	}

	/** Smoke from the crash on the far plains, and a red glow under it. */
	private drawPlume(ctx: CanvasRenderingContext2D, t: number) {
		ctx.save();
		const glow = ctx.createRadialGradient(PLUME.x, PLUME.y + 90, 5, PLUME.x, PLUME.y + 90, 140);
		glow.addColorStop(0, 'rgba(255, 70, 50, 0.45)');
		glow.addColorStop(1, 'rgba(255, 70, 50, 0)');
		ctx.fillStyle = glow;
		ctx.fillRect(PLUME.x - 140, PLUME.y - 50, 280, 280);
		for (let i = 0; i < 9; i++) {
			const k = (t * 0.08 + i / 9) % 1;
			ctx.fillStyle = `rgba(30, 24, 26, ${0.6 * (1 - k)})`;
			ctx.beginPath();
			ctx.arc(PLUME.x + Math.sin(i * 2 + t * 0.5) * 16 + k * 60, PLUME.y + 80 - k * 380, 20 + k * 60, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.restore();
	}
}

function pose(dir: 1 | -1): LanternPose {
	return { dir, walkPhase: 0, altitude: 0, hoverHeight: HOVER_SPACE, lean: 0, glow: false, shadow: true, firing: false, aimX: dir, aimY: 0 };
}
