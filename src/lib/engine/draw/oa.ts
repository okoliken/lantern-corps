// Oa, home of the Corps, for story scenes: seen side-on at dusk. The Central
// Power Battery glows on the horizon between the Guardians' towers, and a
// landing plaza fills the foreground.
//
// Everything is drawn on a fixed stage OA_W x OA_H; the caller scales it to
// the screen.

import { GREEN } from './lantern';

export const OA_W = 1000;
export const OA_H = 560;
/** Where the plaza's surface is. */
export const OA_GROUND = 440;
export const OA_PAD_X = 380;

const TAU = Math.PI * 2;

function seeded(seed: number) {
	let s = seed;
	return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const rand = seeded(2814);
const STARS = Array.from({ length: 90 }, () => [rand() * OA_W, rand() * 260, rand() * 1.4 + 0.3, rand() * TAU]);
/** Distant spires: [x, width, height, how far (0 near .. 1 far)] */
const TOWERS = Array.from({ length: 14 }, (_, i) => [i * 78 + rand() * 40 - 20, 18 + rand() * 26, 90 + rand() * 150, rand()]);

/**
 * The sky, the battery and the towers. `alarm` (0..1) washes the sky red:
 * the moment Tomar-Re talks about the red light.
 */
export function drawOaBackdrop(ctx: CanvasRenderingContext2D, time: number, alarm: number) {
	// Dusk sky: deep teal overhead, a green haze on the horizon
	const sky = ctx.createLinearGradient(0, 0, 0, OA_GROUND);
	sky.addColorStop(0, '#03100c');
	sky.addColorStop(0.55, '#08261b');
	sky.addColorStop(1, '#1f5a3b');
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, OA_W, OA_GROUND);

	for (const [x, y, r, phase] of STARS) {
		ctx.fillStyle = `rgba(234, 255, 240, ${0.35 + 0.3 * Math.sin(time * 1.5 + phase)})`;
		ctx.fillRect(x, y, r, r);
	}

	// A huge pale moon low in the sky
	ctx.fillStyle = 'rgba(200, 240, 215, 0.12)';
	ctx.beginPath();
	ctx.arc(820, 120, 70, 0, TAU);
	ctx.fill();

	// Far towers, then the Central Power Battery, then near towers
	drawTowers(ctx, 0.5, 1, '#0d3324');
	drawBattery(ctx, 250, OA_GROUND - 40, time);
	drawTowers(ctx, 0, 0.5, '#071a13');

	// Red light on the horizon
	if (alarm > 0) {
		const red = ctx.createLinearGradient(0, OA_GROUND - 260, 0, OA_GROUND);
		red.addColorStop(0, 'rgba(255, 40, 30, 0)');
		red.addColorStop(1, `rgba(255, 40, 30, ${0.45 * alarm})`);
		ctx.fillStyle = red;
		ctx.fillRect(0, 0, OA_W, OA_GROUND);
	}

	// The plaza: dark stone with glowing green inlay lines running into the distance
	const ground = ctx.createLinearGradient(0, OA_GROUND, 0, OA_H);
	ground.addColorStop(0, '#15251e');
	ground.addColorStop(1, '#07100c');
	ctx.fillStyle = ground;
	// Runs on past the stage so a tall screen never shows a gap under it
	ctx.fillRect(0, OA_GROUND, OA_W, OA_H - OA_GROUND + 400);
	ctx.strokeStyle = 'rgba(61, 255, 110, 0.25)';
	ctx.lineWidth = 1;
	for (let i = -8; i <= 8; i++) {
		ctx.beginPath();
		ctx.moveTo(OA_W / 2 + i * 30, OA_GROUND);
		ctx.lineTo(OA_W / 2 + i * 160, OA_H);
		ctx.stroke();
	}
	ctx.strokeStyle = 'rgba(61, 255, 110, 0.5)';
	ctx.beginPath();
	ctx.moveTo(0, OA_GROUND + 0.5);
	ctx.lineTo(OA_W, OA_GROUND + 0.5);
	ctx.stroke();

	// Landing pad: rings of light on the plaza
	ctx.save();
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 12;
	for (const [rx, a] of [
		[190, 0.5],
		[140, 0.35],
		[90, 0.25]
	]) {
		ctx.strokeStyle = `rgba(61, 255, 110, ${a})`;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.ellipse(OA_PAD_X, OA_GROUND + 30, rx, rx * 0.12, 0, 0, TAU);
		ctx.stroke();
	}
	ctx.restore();
}

function drawTowers(ctx: CanvasRenderingContext2D, near: number, far: number, color: string) {
	ctx.fillStyle = color;
	for (const [x, w, h, depth] of TOWERS) {
		if (depth < near || depth >= far) continue;
		const s = 1 - depth * 0.4;
		const tw = w * s;
		const th = h * s;
		const base = OA_GROUND;
		// A slim spire with a bulb near the top, the way Oa's towers look
		ctx.beginPath();
		ctx.moveTo(x - tw / 2, base);
		ctx.lineTo(x - tw * 0.25, base - th * 0.8);
		ctx.quadraticCurveTo(x - tw * 0.6, base - th * 0.88, x, base - th);
		ctx.quadraticCurveTo(x + tw * 0.6, base - th * 0.88, x + tw * 0.25, base - th * 0.8);
		ctx.lineTo(x + tw / 2, base);
		ctx.closePath();
		ctx.fill();
		// Windows
		ctx.fillStyle = 'rgba(61, 255, 110, 0.35)';
		for (let k = 1; k < 5; k++) ctx.fillRect(x - 1, base - th * (k / 6), 2, 3);
		ctx.fillStyle = color;
	}
}

/** The Central Power Battery: a giant lantern standing over the city, glowing. */
function drawBattery(ctx: CanvasRenderingContext2D, x: number, base: number, time: number) {
	const pulse = 0.8 + 0.2 * Math.sin(time * 1.3);
	const glow = ctx.createRadialGradient(x, base - 170, 10, x, base - 170, 220);
	glow.addColorStop(0, `rgba(61, 255, 110, ${0.35 * pulse})`);
	glow.addColorStop(1, 'rgba(61, 255, 110, 0)');
	ctx.fillStyle = glow;
	ctx.fillRect(x - 230, base - 400, 460, 420);

	ctx.save();
	ctx.fillStyle = '#0c2a1d';
	ctx.strokeStyle = `rgba(61, 255, 110, ${0.7 * pulse})`;
	ctx.lineWidth = 2;
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 18 * pulse;
	// Base, body with its lit window, and the cap
	ctx.beginPath();
	ctx.moveTo(x - 60, base);
	ctx.lineTo(x - 40, base - 40);
	ctx.lineTo(x + 40, base - 40);
	ctx.lineTo(x + 60, base);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.beginPath();
	ctx.roundRect(x - 55, base - 250, 110, 210, 16);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = `rgba(160, 255, 190, ${0.55 * pulse})`;
	ctx.beginPath();
	ctx.roundRect(x - 38, base - 230, 76, 170, 12);
	ctx.fill();
	ctx.fillStyle = '#0c2a1d';
	ctx.fillRect(x - 40, base - 150, 80, 8);
	ctx.beginPath();
	ctx.moveTo(x - 50, base - 250);
	ctx.lineTo(x - 22, base - 290);
	ctx.lineTo(x + 22, base - 290);
	ctx.lineTo(x + 50, base - 250);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.restore();
}

/** Dust kicked up by the ship touching down: `t` 0..1 over the puff's life. */
export function drawLandingDust(ctx: CanvasRenderingContext2D, x: number, t: number) {
	if (t <= 0 || t >= 1) return;
	for (let i = 0; i < 16; i++) {
		const side = i % 2 ? 1 : -1;
		const d = 40 + t * (120 + (i % 5) * 30);
		ctx.fillStyle = `rgba(160, 200, 180, ${0.35 * (1 - t)})`;
		ctx.beginPath();
		ctx.arc(x + side * d, OA_GROUND - 4 - (i % 4) * 5 * t, 8 + t * 14, 0, TAU);
		ctx.fill();
	}
}
