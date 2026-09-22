// Start of the finale: at the dark altar, Atrocitus with the Book of the
// Black in his hand, and four Lanterns in front of him. He swears his oath.

import { HOVER_PLANET, drawLantern, type LanternPose } from '../draw/lantern';
import { drawLieutenant } from '../draw/lieutenants';
import { drawBloodAltar } from '../draw/ysmault';
import { createEnemy } from '../enemies/enemies';
import { LANTERNS } from '../lanterns';
import { DialogueScene, type Line } from './scene';
import { drawRazerAlly } from '../draw/heroes';
import { createPlayer } from '../player';
import { IDLE } from '../input';

const STAGE_W = 1400;
const STAGE_H = 784;
const GROUND = 600;
const TALK_STARTS = 2.2;
const FIGURE_SCALE = 1.45;

export class BloodOath extends DialogueScene {
	protected readonly stage = { width: STAGE_W, height: STAGE_H };
	protected readonly talkStarts = TALK_STARTS;
	private atrocitus = createEnemy('atrocitus', 300, GROUND);
	private razer = createPlayer(1, LANTERNS.razer, { read: () => IDLE }, 0, 0);

	constructor(lines: Line[]) {
		super(lines);
		this.atrocitus.dir = 1;
		this.razer.dir = -1;
	}

	protected tick(dt: number) {
		// He burns hotter the more he says
		const b = this.atrocitus.brain;
		b.rage = Math.min(1, b.rage + dt * (this.current?.who === 'atrocitus' ? 0.4 : -0.1));
	}

	protected drawStage(ctx: CanvasRenderingContext2D, t: number) {
		const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
		sky.addColorStop(0, '#0e0103');
		sky.addColorStop(1, '#4a0709');
		ctx.fillStyle = sky;
		ctx.fillRect(0, 0, STAGE_W, GROUND);
		ctx.fillStyle = '#220a0a';
		ctx.fillRect(0, GROUND, STAGE_W, STAGE_H - GROUND + 400);
		drawBloodAltar(ctx, 300, GROUND + 60, 180, t, 0);
		drawLieutenant(ctx, this.atrocitus, 300, GROUND, true, t);
		const pose = (fire: boolean): LanternPose => ({ dir: -1, walkPhase: 0, altitude: 0, hoverHeight: HOVER_PLANET, lean: 0, glow: false, shadow: true, firing: fire, aimX: -1, aimY: -0.1 });
		const who = this.current?.who;
		drawLantern(ctx, LANTERNS.arisia, 820, GROUND, pose(false), t, FIGURE_SCALE);
		drawLantern(ctx, LANTERNS.hal, 940, GROUND, pose(who === 'hal'), t, FIGURE_SCALE);
		drawLantern(ctx, LANTERNS.john, 1060, GROUND, pose(who === 'john'), t, FIGURE_SCALE);
		drawRazerAlly(ctx, this.razer, 700, GROUND, true, t);
	}
}
