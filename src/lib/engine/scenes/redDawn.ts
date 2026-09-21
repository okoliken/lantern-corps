// Start of Act 3: the Red fleet comes out of the sky over Oa. The towers go
// to alarm, the sky reddens, and streaks of rage fall toward the Central
// Battery. Hal, John and Kilowog are all the Corps has on the ground.

import { HOVER_SPACE, drawLantern, type LanternPose } from '../draw/lantern';
import { OA_GROUND, OA_H, OA_W, drawOaBackdrop } from '../draw/oa';
import { LANTERNS } from '../lanterns';
import { DialogueScene } from './scene';
import { drawGuardianDais } from './summoned';

const TALK_STARTS = 2.4;
const FIGURE_SCALE = 1.4;
const DAIS = { x: 300, y: OA_GROUND - 40 };
const SPOTS = { hal: 700, john: 850, kilowog: 1010 };
/** Streaks of rage falling across the sky: [start x, start y, angle, when (s), speed]. */
const STREAKS = Array.from({ length: 22 }, (_, i) => [200 + ((i * 331) % 1100), -40 - ((i * 97) % 120), 1.9 + ((i * 0.37) % 0.4), 0.6 + i * 0.35, 380 + ((i * 53) % 200)]);

export class RedDawn extends DialogueScene {
	protected readonly stage = { width: OA_W, height: OA_H };
	protected readonly talkStarts = TALK_STARTS;

	protected drawStage(ctx: CanvasRenderingContext2D, t: number) {
		drawOaBackdrop(ctx, t, Math.min(1, t / 2));
		this.drawStreaks(ctx, t);
		drawGuardianDais(ctx, DAIS.x, DAIS.y, t, this.current?.who === 'guardian', 0.6);
		const who = this.current?.who;
		const up = (id: 'hal' | 'john' | 'kilowog') => who === id && this.current?.mood === 'alarm';
		drawLantern(ctx, LANTERNS.hal, SPOTS.hal, OA_GROUND, { ...pose(), firing: up('hal'), aimX: 0.4, aimY: -0.9 }, t, FIGURE_SCALE);
		drawLantern(ctx, LANTERNS.john, SPOTS.john, OA_GROUND, { ...pose(), firing: up('john'), aimX: 0.3, aimY: -0.9 }, t, FIGURE_SCALE);
		const k = LANTERNS.kilowog;
		drawLantern(ctx, k, SPOTS.kilowog, OA_GROUND, { ...pose(), build: k.build, hunch: k.hunch, firing: up('kilowog'), aimX: 0.2, aimY: -0.9 }, t, FIGURE_SCALE * (k.figureScale ?? 1));
	}

	private drawStreaks(ctx: CanvasRenderingContext2D, t: number) {
		ctx.save();
		ctx.lineCap = 'round';
		ctx.shadowColor = '#ff2a2a';
		ctx.shadowBlur = 12;
		for (const [x0, y0, a, when, speed] of STREAKS) {
			// Each one loops, so the sky keeps raining them
			const age = (t - when) % 4.5;
			if (t < when || age > 2.2) continue;
			const d = age * speed;
			const x = x0 + Math.cos(a) * d;
			const y = y0 + Math.sin(a) * d;
			if (y > OA_GROUND - 20) continue;
			ctx.strokeStyle = 'rgba(255, 70, 60, 0.75)';
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.moveTo(x - Math.cos(a) * 60, y - Math.sin(a) * 60);
			ctx.lineTo(x, y);
			ctx.stroke();
		}
		ctx.restore();
	}
}

function pose(): LanternPose {
	return { dir: -1, walkPhase: 0, altitude: 0, hoverHeight: HOVER_SPACE, lean: 0, glow: false, shadow: true, firing: false, aimX: -1, aimY: 0 };
}
