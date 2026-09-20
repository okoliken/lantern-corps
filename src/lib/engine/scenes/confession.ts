// Start of Act 2, Mission 4: Hal makes the Guardians say it. The Manhunters
// were theirs; Sector 666 was their doing; the vault is where they buried it.
// Razer hears every word from his cell, and knows where the Red Lanterns are
// already going.

import { HOVER_SPACE, drawLantern, type LanternPose } from '../draw/lantern';
import { drawLieutenant } from '../draw/lieutenants';
import { OA_GROUND, OA_H, OA_W, drawOaBackdrop } from '../draw/oa';
import { drawCage } from '../draw/prison';
import { createEnemy } from '../enemies/enemies';
import { LANTERNS } from '../lanterns';
import { DialogueScene, type Line } from './scene';
import { drawGuardianDais } from './summoned';

const TALK_STARTS = 2.2;
const FIGURE_SCALE = 1.4;
const DAIS = { x: 330, y: OA_GROUND - 40 };
const HAL_SPOT = 640;
const KILOWOG_SPOT = 820;
const CELL = { x: 1120, y: OA_GROUND };

export class Confession extends DialogueScene {
	protected readonly stage = { width: OA_W, height: OA_H };
	protected readonly talkStarts = TALK_STARTS;
	/** How cold the Guardians have gone. */
	private chill = 0.6;
	/** The sky reddens as they tell it. */
	private shame = 0;
	private razer = createEnemy('razer', CELL.x, CELL.y);

	constructor(lines: Line[]) {
		super(lines);
		this.razer.dir = -1;
	}

	protected tick(dt: number) {
		const told = this.lines.slice(0, this.line + 1).filter((l) => l.mood === 'alarm').length;
		this.shame += (Math.min(1, told * 0.35) - this.shame) * Math.min(1, dt * 1.2);
		// Razer's rage rises with every word
		this.razer.brain.rage = 0.2 + this.shame * 0.8;
	}

	protected drawStage(ctx: CanvasRenderingContext2D, t: number) {
		drawOaBackdrop(ctx, t, this.shame * 0.6);
		const who = this.current?.who;
		drawGuardianDais(ctx, DAIS.x, DAIS.y, t, who === 'guardian', this.chill);
		const angry = who === 'hal' && this.current?.mood === 'alarm';
		drawLantern(ctx, LANTERNS.hal, HAL_SPOT, OA_GROUND, { ...basePose(-1), firing: angry, aimX: -0.9, aimY: -0.3 }, t, FIGURE_SCALE);
		const k = LANTERNS.kilowog;
		drawLantern(ctx, k, KILOWOG_SPOT, OA_GROUND, { ...basePose(-1), build: k.build, hunch: k.hunch }, t, FIGURE_SCALE * (k.figureScale ?? 1));
		// Razer in his cell, listening
		const r = this.razer;
		drawCage(ctx, CELL.x, CELL.y, 'green', () => drawLieutenant(ctx, r, CELL.x, CELL.y, true, t), 1, 0, t, who === 'razer' ? 0.5 : 0.25);
	}
}

function basePose(dir: 1 | -1): LanternPose {
	return { dir, walkPhase: 0, altitude: 0, hoverHeight: HOVER_SPACE, lean: 0, glow: false, shadow: true, firing: false, aimX: dir, aimY: 0 };
}
