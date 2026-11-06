// The Exile (season two): Sinestro in a Guardians' cell with his ring taken,
// the tether Hal tows it by, the small tears the Weaponers step out of, and
// the gate to Qward itself, an old ring of stone the Guardians built and
// sealed.

import { drawLantern, type Figure, type LanternPose } from './lantern';
import { drawCage } from './prison';
import { LANTERNS } from '../lanterns';
import { green, GREEN_CORE, THEME_GREEN } from '../../theme';

const TAU = Math.PI * 2;

/** Sinestro with the ring gone: no uniform's light, just Korugar's dark clothes. */
export const SINESTRO_EXILE: Figure = {
	id: 'sinestro',
	look: LANTERNS.sinestro.look,
	outfit: { top: '#2a2233', topLit: '#43384f', trousers: '#1d1824', boots: '#0f0c12' },
	bulk: LANTERNS.sinestro.bulk
};

/**
 * The cell: a green cage floating a little off the ground, Sinestro inside it
 * standing very straight. `held` brightens it while Hal has it in tow;
 * `grabbed` turns the bars' light sour while a Weaponer drags it.
 */
export function drawExileCell(ctx: CanvasRenderingContext2D, x: number, y: number, dir: 1 | -1, held: boolean, grabbed: boolean, time: number, ringed = false) {
	const float = 18 + Math.sin(time * 2) * 4;
	ctx.save();
	ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
	ctx.beginPath();
	ctx.ellipse(x, y + 4, 46, 12, 0, 0, TAU);
	ctx.fill();
	ctx.translate(0, -float);
	const pose: LanternPose = { dir, walkPhase: 0, altitude: 0, hoverHeight: 8, lean: 0, glow: false, shadow: false, firing: false, aimX: dir, aimY: 0 };
	drawCage(ctx, x, y, 'green', () => drawLantern(ctx, ringed ? LANTERNS.sinestro : SINESTRO_EXILE, x, y, pose, time, LANTERNS.sinestro.figureScale ?? 1), held ? 1 : 0.65, grabbed ? 0.6 + 0.4 * Math.sin(time * 20) : 0, time, 7);
	ctx.restore();
}

/** The tether from Hal's ring to the cell: a taut line of light, pulsing toward the cell. */
export function drawTether(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, time: number) {
	ctx.save();
	ctx.lineCap = 'round';
	ctx.shadowColor = THEME_GREEN;
	ctx.shadowBlur = 10;
	ctx.strokeStyle = green(0.45);
	ctx.lineWidth = 6;
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);
	ctx.stroke();
	ctx.strokeStyle = GREEN_CORE;
	ctx.lineWidth = 2;
	ctx.stroke();
	ctx.shadowBlur = 0;
	for (let i = 0; i < 3; i++) {
		const k = (time * 1.6 + i / 3) % 1;
		ctx.fillStyle = GREEN_CORE;
		ctx.beginPath();
		ctx.arc(x1 + (x2 - x1) * k, y1 + (y2 - y1) * k, 3, 0, TAU);
		ctx.fill();
	}
	ctx.restore();
}

/** A Weaponer hauling the cell: a chain of dark iron from his gauntlet. */
export function drawHaulChain(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
	ctx.save();
	ctx.strokeStyle = '#2b2a2c';
	ctx.lineWidth = 3;
	ctx.setLineDash([6, 3]);
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 + 20, x2, y2);
	ctx.stroke();
	ctx.restore();
}

/** A small tear into Qward, where Weaponers step through: pale where it should be dark, edged in black. `open` 0..1. */
export function drawQwardTear(ctx: CanvasRenderingContext2D, x: number, y: number, open: number, time: number) {
	if (open <= 0.01) return;
	const h = 150 * open;
	const w = 46 * open;
	ctx.save();
	ctx.translate(x, y - 10);
	ctx.beginPath();
	for (let i = 0; i <= 16; i++) {
		const k = i / 16;
		const yy = -h + k * h;
		const xx = Math.sin(k * Math.PI) * w + Math.sin(k * 19 + time * 3) * 4;
		if (i === 0) ctx.moveTo(xx, yy);
		else ctx.lineTo(xx, yy);
	}
	for (let i = 16; i >= 0; i--) {
		const k = i / 16;
		ctx.lineTo(-Math.sin(k * Math.PI) * w + Math.sin(k * 23 + time * 3) * 4, -h + k * h);
	}
	ctx.closePath();
	ctx.shadowColor = '#e8e3b0';
	ctx.shadowBlur = 24;
	ctx.fillStyle = '#ece6c2';
	ctx.fill();
	ctx.shadowBlur = 0;
	ctx.strokeStyle = '#0a0a06';
	ctx.lineWidth = 3;
	ctx.stroke();
	ctx.fillStyle = 'rgba(10, 10, 6, 0.65)';
	for (let i = 0; i < 6; i++) ctx.fillRect(Math.sin(i * 2.3) * w * 0.4, -h * (0.2 + i * 0.12), 2, 2);
	ctx.restore();
}

/**
 * The gate to Qward: a great ring of grey stone standing on its edge, runes
 * cut round it, sealed. `power` (0..1) lights the runes green as the
 * Guardians open it from Oa; `open` (0..1) tears Qward's pale light into the
 * middle.
 */
export function drawQwardGate(ctx: CanvasRenderingContext2D, x: number, y: number, power: number, open: number, time: number) {
	const R = 190;
	const cy = y - R - 20;
	ctx.save();
	ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
	ctx.beginPath();
	ctx.ellipse(x, y, R + 30, 36, 0, 0, TAU);
	ctx.fill();
	// The plinth
	ctx.fillStyle = '#2f3644';
	ctx.strokeStyle = '#0a0c10';
	ctx.lineWidth = 3;
	ctx.fillRect(x - R * 0.7, y - 30, R * 1.4, 34);
	ctx.strokeRect(x - R * 0.7, y - 30, R * 1.4, 34);
	// Inside: dead stars until it opens, then Qward's pale sky
	ctx.save();
	ctx.beginPath();
	ctx.arc(x, cy, R - 26, 0, TAU);
	ctx.clip();
	ctx.fillStyle = '#05070b';
	ctx.fillRect(x - R, cy - R, R * 2, R * 2);
	if (open > 0) {
		const g = ctx.createRadialGradient(x, cy, 10, x, cy, R);
		g.addColorStop(0, `rgba(246, 241, 208, ${open})`);
		g.addColorStop(0.7, `rgba(201, 192, 138, ${open})`);
		g.addColorStop(1, `rgba(110, 106, 69, ${open})`);
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.arc(x, cy, (R - 26) * Math.min(1, open * 1.2), 0, TAU);
		ctx.fill();
		ctx.strokeStyle = `rgba(12, 12, 6, ${0.7 * open})`;
		ctx.lineWidth = 3;
		for (let i = 0; i < 3; i++) {
			const a = time * (0.6 + i * 0.3) + i * 2;
			ctx.beginPath();
			ctx.arc(x, cy, (R - 60) * (0.4 + i * 0.25), a, a + 2.2);
			ctx.stroke();
		}
	}
	ctx.restore();
	// The ring of stone, and the runes round it
	ctx.strokeStyle = '#4b5466';
	ctx.lineWidth = 40;
	ctx.beginPath();
	ctx.arc(x, cy, R - 6, 0, TAU);
	ctx.stroke();
	ctx.strokeStyle = '#0a0c10';
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.arc(x, cy, R + 14, 0, TAU);
	ctx.arc(x, cy, R - 26, 0, TAU, true);
	ctx.stroke();
	ctx.save();
	if (power > 0) {
		ctx.shadowColor = THEME_GREEN;
		ctx.shadowBlur = 12 * power;
	}
	for (let i = 0; i < 24; i++) {
		const a = (i / 24) * TAU + 0.1;
		const lit = power * 24 > i;
		ctx.fillStyle = lit ? green(0.6 + 0.4 * Math.sin(time * 4 + i)) : '#2c3240';
		ctx.save();
		ctx.translate(x + Math.cos(a) * (R - 6), cy + Math.sin(a) * (R - 6));
		ctx.rotate(a + Math.PI / 2);
		ctx.fillRect(-5, -8, 10, 4);
		ctx.fillRect(-2, -8, 4, 14);
		ctx.restore();
	}
	ctx.restore();
	ctx.restore();
}
