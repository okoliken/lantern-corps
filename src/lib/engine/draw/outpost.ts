// Mission 2 art: Kel-Aris Station after the Red Lanterns came through.
// The comms tower, scorch marks, the station crew hiding in the wreckage,
// and the Lantern who died defending them.

import type { LanternPose } from '../animation';
import { drawLantern, GREEN, HOVER_PLANET, type Figure } from './lantern';

const TAU = Math.PI * 2;

/** Tolen Vex, who guarded Sector 2814's frontier from Kel-Aris Station. */
export const TOLEN_VEX: Figure = {
	id: 'tolen',
	look: { skin: '#6f9fd6', hair: '#e8eef5', hairStyle: 'swept', mask: false }
};

/** The comms tower: a lattice mast with a dish, its warning light still blinking. */
export function drawCommsTower(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
	ctx.save();
	ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
	ctx.beginPath();
	ctx.ellipse(x, y, 60, 14, 0, 0, TAU);
	ctx.fill();
	ctx.strokeStyle = '#8b9096';
	ctx.lineWidth = 3;
	const h = 260;
	// Legs and cross-bracing
	ctx.beginPath();
	ctx.moveTo(x - 40, y);
	ctx.lineTo(x - 8, y - h);
	ctx.moveTo(x + 40, y);
	ctx.lineTo(x + 8, y - h);
	for (let i = 0; i < 6; i++) {
		const a = i / 6;
		const b = (i + 1) / 6;
		const wa = 40 - 32 * a;
		const wb = 40 - 32 * b;
		ctx.moveTo(x - wa, y - h * a);
		ctx.lineTo(x + wb, y - h * b);
		ctx.moveTo(x + wa, y - h * a);
		ctx.lineTo(x - wb, y - h * b);
	}
	ctx.stroke();
	// Dish, knocked askew
	ctx.fillStyle = '#b8bec4';
	ctx.strokeStyle = '#3d4047';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.ellipse(x + 18, y - h + 30, 26, 12, -0.5, 0, TAU);
	ctx.fill();
	ctx.stroke();
	// Blinking warning light
	const on = Math.sin(time * 4) > 0;
	ctx.fillStyle = on ? '#ff3b3b' : '#5a1010';
	ctx.shadowColor = '#ff3b3b';
	ctx.shadowBlur = on ? 14 : 0;
	ctx.beginPath();
	ctx.arc(x, y - h - 6, 5, 0, TAU);
	ctx.fill();
	ctx.restore();
}

/** Red Lantern scorch marks on the ground: burnt splashes with a dull ember glow. */
export function drawScorch(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number) {
	ctx.save();
	ctx.fillStyle = 'rgba(14, 11, 10, 0.5)';
	ctx.beginPath();
	for (let i = 0; i < 12; i++) {
		const a = (i / 12) * TAU;
		const k = 0.6 + 0.4 * Math.abs(Math.sin(seed * 7 + i * 2.3));
		ctx.lineTo(x + Math.cos(a) * r * k, y + Math.sin(a) * r * 0.5 * k);
	}
	ctx.closePath();
	ctx.fill();
	// A few embers still glowing in the soot
	ctx.fillStyle = 'rgba(255, 110, 50, 0.35)';
	for (let i = 0; i < 4; i++) {
		const a = seed * 20 + i * 1.9;
		ctx.fillRect(x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.18, 2, 2);
	}
	ctx.restore();
}

/**
 * One of the station crew, hiding: a small grey-skinned alien in an orange
 * work suit, crouched and shaking. `found` (0..1) lifts them away in a green
 * bubble, carried back to the landing pad by a Lantern's construct.
 */
export function drawSurvivor(ctx: CanvasRenderingContext2D, x: number, y: number, found: number, time: number, seed: number) {
	ctx.save();
	const shake = found > 0 ? 0 : Math.sin(time * 30 + seed * 10) * 0.6;
	const lift = found * 50;
	ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
	ctx.beginPath();
	ctx.ellipse(x, y, 12, 4, 0, 0, TAU);
	ctx.fill();
	ctx.translate(x + shake, y - lift);
	// Crouched body
	ctx.fillStyle = '#d9772e';
	ctx.strokeStyle = '#2a1a10';
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.ellipse(0, -14, 9, 12, 0, 0, TAU);
	ctx.fill();
	ctx.stroke();
	// Big head with dark eyes
	ctx.fillStyle = '#a9b2a7';
	ctx.beginPath();
	ctx.ellipse(2, -32, 9, 10, 0, 0, TAU);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#10150f';
	ctx.beginPath();
	ctx.ellipse(6, -33, 2.2, 3, 0, 0, TAU);
	ctx.fill();
	// A distress beacon blinking in their hands until they're found
	if (found === 0) {
		const on = Math.sin(time * 6 + seed * 5) > 0;
		ctx.fillStyle = on ? GREEN : '#1a4a2a';
		ctx.shadowColor = GREEN;
		ctx.shadowBlur = on ? 10 : 0;
		ctx.beginPath();
		ctx.arc(8, -16, 3, 0, TAU);
		ctx.fill();
	} else {
		// Carried off in a bubble
		ctx.globalAlpha = Math.min(1, found * 3);
		ctx.strokeStyle = GREEN;
		ctx.shadowColor = GREEN;
		ctx.shadowBlur = 12;
		ctx.lineWidth = 2;
		ctx.fillStyle = 'rgba(61, 255, 110, 0.12)';
		ctx.beginPath();
		ctx.arc(0, -20, 26, 0, TAU);
		ctx.fill();
		ctx.stroke();
	}
	ctx.restore();
}

/** Tolen Vex, lying where she fell at the foot of the tower. */
export function drawFallenLantern(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
	const pose: LanternPose = {
		dir: -1,
		walkPhase: 0,
		altitude: 0,
		hoverHeight: HOVER_PLANET,
		lean: 0,
		glow: false,
		shadow: true,
		firing: false,
		aimX: -1,
		aimY: 0,
		downed: true
	};
	drawLantern(ctx, TOLEN_VEX, x, y, pose, time);
}

/**
 * Her ring leaving to find a new bearer: it rises glowing from her hand, hangs
 * there a moment, then streaks away into the sky. `t` is 0..1 over that.
 */
export function drawRingLeaving(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, time: number) {
	const rise = Math.min(1, t / 0.4);
	const away = Math.max(0, (t - 0.65) / 0.35);
	const rx = x + away * away * 900;
	const ry = y - 20 - rise * 70 - away * away * 700;
	ctx.save();
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 24;
	ctx.strokeStyle = '#eafff0';
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.ellipse(rx, ry, 7, 5, Math.sin(time * 5) * 0.4, 0, TAU);
	ctx.stroke();
	// Glow around it, and a trail once it goes
	const glow = ctx.createRadialGradient(rx, ry, 2, rx, ry, 40);
	glow.addColorStop(0, 'rgba(61, 255, 110, 0.6)');
	glow.addColorStop(1, 'rgba(61, 255, 110, 0)');
	ctx.fillStyle = glow;
	ctx.beginPath();
	ctx.arc(rx, ry, 40, 0, TAU);
	ctx.fill();
	if (away > 0) {
		ctx.strokeStyle = 'rgba(61, 255, 110, 0.5)';
		ctx.lineWidth = 4;
		ctx.beginPath();
		ctx.moveTo(x, y - 90);
		ctx.lineTo(rx, ry);
		ctx.stroke();
	}
	ctx.restore();
}
