// Start of Act 2's boss: back on Oa after Detroit. John tells the Guardians
// something answered the signal, and they tell him what: Manhunter Prime, the
// first, buried under the vault because they couldn't bring themselves to
// scrap it. Hal and John go down after it together.

import { HOVER_SPACE, drawLantern, type LanternPose } from '../draw/lantern';
import { OA_GROUND, OA_H, OA_W, drawOaBackdrop } from '../draw/oa';
import { LANTERNS } from '../lanterns';
import { DialogueScene } from './scene';
import { drawGuardianDais } from './summoned';

const TALK_STARTS = 2;
const FIGURE_SCALE = 1.4;
const DAIS = { x: 330, y: OA_GROUND - 40 };
const SPOTS = { john: 620, hal: 780, kilowog: 960 };

export class TheFirst extends DialogueScene {
	protected readonly stage = { width: OA_W, height: OA_H };
	protected readonly talkStarts = TALK_STARTS;
	/** The sky darkens as they say what it is. */
	private dread = 0;

	protected tick(dt: number) {
		const told = this.lines.slice(0, this.line + 1).filter((l) => l.mood === 'alarm').length;
		this.dread += (Math.min(1, told * 0.4) - this.dread) * Math.min(1, dt * 1.2);
	}

	protected drawStage(ctx: CanvasRenderingContext2D, t: number) {
		drawOaBackdrop(ctx, t, this.dread * 0.5);
		const who = this.current?.who;
		drawGuardianDais(ctx, DAIS.x, DAIS.y, t, who === 'guardian', 0.5);
		drawLantern(ctx, LANTERNS.john, SPOTS.john, OA_GROUND, { ...basePose(), firing: who === 'john' && this.line === 0, aimX: -0.9, aimY: -0.2 }, t, FIGURE_SCALE);
		drawLantern(ctx, LANTERNS.hal, SPOTS.hal, OA_GROUND, basePose(), t, FIGURE_SCALE);
		const k = LANTERNS.kilowog;
		drawLantern(ctx, k, SPOTS.kilowog, OA_GROUND, { ...basePose(), build: k.build, hunch: k.hunch }, t, FIGURE_SCALE * (k.figureScale ?? 1));
	}
}

function basePose(): LanternPose {
	return { dir: -1, walkPhase: 0, altitude: 0, hoverHeight: HOVER_SPACE, lean: 0, glow: false, shadow: true, firing: false, aimX: -1, aimY: 0 };
}
