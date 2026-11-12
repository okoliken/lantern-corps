// Hector Hammond, on the same skeleton as everyone else: a scientist in a
// tweed jacket and a loosened tie. Since the fragment found him his skull has
// swollen round a brain that won't stop growing, veins standing out on it. He
// doesn't walk any more; he floats, and his eyes burn yellow when he reaches
// out with his mind.

import { isStanding } from '../dummy';
import type { Enemy } from '../enemies/enemies';
import { FIGURE_HEIGHT, drawLantern, ringPosition, type Figure, type LanternPose } from './lantern';

const TAU = Math.PI * 2;
/** His size against Hal. */
export const HAMMOND_SCALE = 1.15;
/** How high he floats (before scaling). */
const FLOAT = 26;

/** Hammond as he is `grow` of the way (0 the man at the gala, 1 what the fragment made him), eyes at `glow`. */
export function hammondFigure(grow: number, glow: number): Figure {
	return {
		id: 'hammond',
		look: { skin: '#e3bd98', hair: '#8c8478', hairStyle: 'cropped', mask: false, cranium: grow, eyeGlow: glow },
		bulk: 1.06,
		outfit: { top: '#6a4a2e', topLit: '#8c6a46', trousers: '#4a3a2a', boots: '#1c1612', shirt: '#e8e2d4', tie: '#6a2424' }
	};
}

export function hammondPose(dir: 1 | -1, float: number, reaching: boolean, hurt: number, down: boolean, shadow: boolean): LanternPose {
	return {
		dir,
		walkPhase: 0,
		altitude: float,
		hoverHeight: FLOAT,
		lean: 0,
		glow: false,
		shadow,
		// Reaching out at you, hand open
		firing: reaching,
		aimX: dir,
		aimY: -0.15,
		hurt,
		downed: down
	};
}

/** Draws him with the telekinesis round him while he uses it. */
export function drawHammondMan(ctx: CanvasRenderingContext2D, x: number, y: number, pose: LanternPose, grow: number, glow: number, time: number, scale = HAMMOND_SCALE) {
	const reaching = pose.firing;
	if (reaching || glow > 0.6) {
		const top = y - (FIGURE_HEIGHT + pose.hoverHeight * pose.altitude * 1.35) * scale;
		ctx.save();
		ctx.globalCompositeOperation = 'lighter';
		const cy = top + 20 * scale;
		const r = 90 * scale * (0.6 + 0.4 * grow);
		const g = ctx.createRadialGradient(x, cy, 6, x, cy, r);
		g.addColorStop(0, `rgba(255, 220, 90, ${0.3 * Math.max(glow, reaching ? 1 : 0)})`);
		g.addColorStop(1, 'rgba(255, 180, 0, 0)');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.arc(x, cy, r, 0, TAU);
		ctx.fill();
		ctx.restore();
	}
	drawLantern(ctx, hammondFigure(grow, glow), x, y, pose, time, scale);
	if (reaching) {
		// The hand he reaches with, alight
		const [hx, hy] = ringPosition(x, y, pose, time, scale);
		ctx.save();
		ctx.globalCompositeOperation = 'lighter';
		const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 26);
		g.addColorStop(0, 'rgba(255, 240, 160, 0.8)');
		g.addColorStop(1, 'rgba(255, 180, 0, 0)');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.arc(hx, hy, 26, 0, TAU);
		ctx.fill();
		ctx.restore();
	}
}

function enemyPose(e: Enemy, hasGround: boolean): LanternPose {
	const b = e.brain;
	const reaching = b.state === 'windup' || b.state === 'act';
	return hammondPose(e.dir >= 0 ? 1 : -1, 1, reaching, e.flash > 0 ? 0.6 : 0, !isStanding(e), hasGround);
}

export const hammondTop = (e: Enemy, y: number) => (isStanding(e) ? y - (FIGURE_HEIGHT + FLOAT * 1.35) * HAMMOND_SCALE - 30 : y - 40);
export const hammondHand = (e: Enemy, x: number, y: number): [number, number] => ringPosition(x, y, enemyPose(e, true), 0, HAMMOND_SCALE);

export function drawHammond(ctx: CanvasRenderingContext2D, e: Enemy, x: number, y: number, hasGround: boolean, time: number) {
	const pose = enemyPose(e, hasGround);
	drawHammondMan(ctx, x, y + Math.sin(time * 2) * 3, pose, 1, pose.firing ? 1 : 0.55 + 0.15 * Math.sin(time * 4), time);
}
