// Prison Moon art: the Red Lanterns' energy cells, with a captured Green
// Lantern held inside each, and the jagged red spires of the moon.

import type { LanternPose } from '../animation';
import { HOVER_PLANET, drawLantern, type Figure } from './lantern';
import { green, THEME_GREEN, THEME_GREEN_RGB } from '../../theme';

const TAU = Math.PI * 2;
const RED = '#ff2a2a';
const CELL_RX = 44;
const CELL_RY = 16;
const CELL_HEIGHT = 118;
const BARS = 9;

/** A captured Lantern: on their feet but worn down, no glow, ring dim. */
function prisonerPose(dir: 1 | -1): LanternPose {
	return {
		dir,
		walkPhase: 0,
		altitude: 0,
		hoverHeight: HOVER_PLANET,
		lean: 0,
		glow: false,
		shadow: true,
		firing: false,
		aimX: dir,
		aimY: 0,
		hurt: 0.35
	};
}

/**
 * A Red Lantern cell: a ring of jagged energy bars round a Lantern. The bars
 * flicker harder as the cell weakens (`strength` 1 = untouched, 0 = about to
 * break). Bars behind the prisoner are drawn first, then the prisoner, then
 * the bars in front.
 */
export function drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, prisoner: Figure, strength: number, flash: number, time: number, seed: number) {
	drawCage(ctx, x, y, 'red', () => drawLantern(ctx, prisoner, x, y, prisonerPose(Math.sin(seed * 7) > 0 ? 1 : -1), time), strength, flash, time, seed);
}

/**
 * A ring of energy bars round someone: red for a Red Lantern cell, green for
 * a Green Lantern's prison cage (Razer, caught). `inside` draws whoever's held,
 * between the bars behind and the bars in front.
 */
export function drawCage(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	color: 'red' | 'green',
	inside: () => void,
	strength: number,
	flash: number,
	time: number,
	seed: number
) {
	const [r, g, b] = color === 'red' ? [255, 60, 50] : THEME_GREEN_RGB;
	const glow = color === 'red' ? RED : THEME_GREEN;
	ctx.save();
	// Scorched floor plate
	ctx.fillStyle = color === 'red' ? 'rgba(60, 8, 8, 0.8)' : 'rgba(6, 40, 20, 0.7)';
	ctx.beginPath();
	ctx.ellipse(x, y, CELL_RX + 10, CELL_RY + 5, 0, 0, TAU);
	ctx.fill();
	ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.5)`;
	ctx.lineWidth = 2;
	ctx.stroke();

	const bars = (front: boolean) => {
		for (let i = 0; i < BARS; i++) {
			const a = (i / BARS) * TAU + 0.2;
			const inFront = Math.sin(a) > 0;
			if (inFront !== front) continue;
			const bx = x + Math.cos(a) * CELL_RX;
			const by = y + Math.sin(a) * CELL_RY;
			// Weak cells flicker, some bars dropping out for a moment
			const flicker = Math.sin(time * (9 + i * 3.7) + seed * 20);
			if (strength < 0.5 && flicker > 0.2 + strength) continue;
			const alpha = (front ? 0.85 : 0.55) * (0.6 + 0.4 * Math.abs(flicker));
			ctx.strokeStyle = flash > 0 ? `rgba(255, 230, 230, ${alpha})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
			ctx.shadowColor = glow;
			ctx.shadowBlur = 10;
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.moveTo(bx, by);
			// Jagged, like everything the Red Lanterns build
			for (let k = 1; k <= 4; k++) ctx.lineTo(bx + (k % 2 ? 3 : -3), by - (CELL_HEIGHT * k) / 4);
			ctx.stroke();
		}
	};
	bars(false);
	ctx.shadowBlur = 0;
	inside();
	bars(true);

	// The crown ring that holds the bars
	ctx.shadowColor = glow;
	ctx.shadowBlur = 12;
	ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.5 + 0.4 * strength})`;
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.ellipse(x, y - CELL_HEIGHT, CELL_RX, CELL_RY, 0, 0, TAU);
	ctx.stroke();
	ctx.restore();
}

/** A jagged red crystal spire growing out of the moon. Scenery only. */
export function drawSpire(ctx: CanvasRenderingContext2D, x: number, y: number, height: number, seed: number, time: number) {
	const w = 16 + (seed % 1) * 14;
	const pulse = 0.5 + 0.5 * Math.sin(time * 1.5 + seed * 9);
	ctx.save();
	ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
	ctx.beginPath();
	ctx.ellipse(x, y, w * 1.3, w * 0.45, 0, 0, TAU);
	ctx.fill();
	const g = ctx.createLinearGradient(x, y, x, y - height);
	g.addColorStop(0, '#3a0b0d');
	g.addColorStop(0.6, '#7a1418');
	g.addColorStop(1, '#d8322c');
	ctx.fillStyle = g;
	ctx.strokeStyle = '#1a0304';
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.moveTo(x - w, y);
	ctx.lineTo(x - w * 0.45, y - height * 0.55);
	ctx.lineTo(x - w * 0.7, y - height * 0.62);
	ctx.lineTo(x, y - height);
	ctx.lineTo(x + w * 0.35, y - height * 0.7);
	ctx.lineTo(x + w * 0.6, y - height * 0.72);
	ctx.lineTo(x + w, y);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	// A glowing seam up the middle
	ctx.shadowColor = RED;
	ctx.shadowBlur = 10 * pulse;
	ctx.strokeStyle = `rgba(255, 90, 70, ${0.35 + 0.4 * pulse})`;
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.moveTo(x - w * 0.2, y - 4);
	ctx.lineTo(x + w * 0.05, y - height * 0.5);
	ctx.lineTo(x, y - height * 0.92);
	ctx.stroke();
	ctx.restore();
}

/** Razer's dais: a raised platform of dark rock ringed with red crystal, where he watches his soldiers fight. */
export function drawDais(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
	ctx.save();
	// Steps down to the courtyard
	for (let i = 2; i >= 0; i--) {
		ctx.fillStyle = i === 0 ? '#2a1113' : i === 1 ? '#210d0f' : '#190a0b';
		ctx.strokeStyle = '#0a0304';
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.ellipse(x, y + i * 12, 150 + i * 24, 56 + i * 9, 0, 0, TAU);
		ctx.fill();
		ctx.stroke();
	}
	// A red sigil burned into the top
	const pulse = 0.5 + 0.5 * Math.sin(time * 2);
	ctx.shadowColor = RED;
	ctx.shadowBlur = 12 * pulse;
	ctx.strokeStyle = `rgba(255, 60, 50, ${0.35 + 0.35 * pulse})`;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.ellipse(x, y, 90, 33, 0, 0, TAU);
	ctx.stroke();
	ctx.beginPath();
	ctx.ellipse(x, y, 50, 18, 0, 0, TAU);
	ctx.stroke();
	ctx.restore();
}
