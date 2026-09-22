// Act 3, Mission 1 (Siege of Oa): the Central Battery, the Red Lanterns'
// drop pods coming down on the plaza, the flagship's strikes from orbit, and
// Dex-Starr.

import { drawGuardian } from '../scenes/summoned';
import { isStanding } from '../dummy';
import type { Enemy } from '../enemies/enemies';
import { SLAM_HEIGHT } from '../enemies/redConstructs';

const OUTLINE = '#050302';
const TAU = Math.PI * 2;
const GREEN = '#3dff6e';
const RAGE = '#ff2a2a';

/**
 * The Central Battery: a great green lantern on a stepped plinth, taller than
 * a tower. `power` 1..0 dims it and cracks it; `flare` 0..1 is it blazing out
 * over the plaza at the end.
 */
export function drawCentralBattery(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, power: number, flare: number, hit: number) {
	ctx.save();
	ctx.translate(x, y);
	// Its light on the plaza
	const pool = ctx.createRadialGradient(0, 0, 20, 0, 0, 320 + flare * 900);
	pool.addColorStop(0, `rgba(61, 255, 110, ${0.14 + 0.18 * power + 0.5 * flare})`);
	pool.addColorStop(1, 'rgba(61, 255, 110, 0)');
	ctx.fillStyle = pool;
	ctx.beginPath();
	ctx.ellipse(0, 0, 320 + flare * 900, (320 + flare * 900) * 0.45, 0, 0, TAU);
	ctx.fill();

	// The plinth: three steps of dark stone
	for (let i = 0; i < 3; i++) {
		const w = 150 - i * 34;
		const top = -i * 16;
		ctx.fillStyle = i % 2 ? '#1c2a24' : '#15201b';
		ctx.strokeStyle = '#2d4a3d';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.ellipse(0, top, w, w * 0.38, 0, 0, TAU);
		ctx.fill();
		ctx.stroke();
	}

	// The lantern itself: a barrel with bands, a domed top and a ring handle
	const shake = hit > 0 ? Math.sin(time * 70) * 3 * hit : 0;
	ctx.translate(shake, -48);
	const glow = 0.35 + 0.65 * power;
	const body = new Path2D();
	body.moveTo(-54, 0);
	body.lineTo(-62, -40);
	body.lineTo(-62, -170);
	body.quadraticCurveTo(-60, -196, -40, -206);
	body.lineTo(40, -206);
	body.quadraticCurveTo(60, -196, 62, -170);
	body.lineTo(62, -40);
	body.lineTo(54, 0);
	body.closePath();
	const metal = ctx.createLinearGradient(-62, 0, 62, 0);
	metal.addColorStop(0, '#0d2a1c');
	metal.addColorStop(0.5, '#1d5a3a');
	metal.addColorStop(1, '#0a2016');
	ctx.fillStyle = metal;
	ctx.fill(body);
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 3;
	ctx.stroke(body);
	// The glass: the light inside
	const inner = ctx.createLinearGradient(0, -190, 0, -40);
	inner.addColorStop(0, `rgba(200, 255, 215, ${glow})`);
	inner.addColorStop(1, `rgba(61, 255, 110, ${glow * 0.8})`);
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 20 + 40 * glow + 60 * flare;
	ctx.fillStyle = inner;
	for (const [x0, w] of [
		[-48, 26],
		[-13, 26],
		[22, 26]
	]) {
		ctx.beginPath();
		ctx.roundRect(x0, -186, w, 136, 6);
		ctx.fill();
	}
	ctx.shadowBlur = 0;
	// Bands
	ctx.fillStyle = '#0a1a12';
	for (const by of [-196, -118, -46]) {
		ctx.fillRect(-64, by, 128, 10);
		ctx.strokeRect(-64, by, 128, 10);
	}
	// The top, and the ring handle over it
	ctx.fillStyle = '#123a27';
	ctx.beginPath();
	ctx.ellipse(0, -208, 44, 14, 0, 0, TAU);
	ctx.fill();
	ctx.stroke();
	ctx.strokeStyle = `rgba(61, 255, 110, ${0.4 + 0.6 * glow})`;
	ctx.lineWidth = 7;
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 14 * glow;
	ctx.beginPath();
	ctx.ellipse(0, -240, 26, 24, 0, 0, TAU);
	ctx.stroke();
	ctx.shadowBlur = 0;
	// Cracks as it's drained
	if (power < 0.66) {
		ctx.strokeStyle = 'rgba(255, 60, 60, 0.75)';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(-20, -186);
		ctx.lineTo(-30, -140);
		ctx.lineTo(-18, -110);
		if (power < 0.33) {
			ctx.moveTo(30, -60);
			ctx.lineTo(18, -120);
			ctx.lineTo(34, -168);
		}
		ctx.stroke();
	}
	// Blazing out: rings of light going up and away
	if (flare > 0) {
		ctx.globalCompositeOperation = 'lighter';
		for (let i = 0; i < 3; i++) {
			const k = (time * 0.7 + i / 3) % 1;
			ctx.strokeStyle = `rgba(160, 255, 190, ${0.7 * (1 - k) * flare})`;
			ctx.lineWidth = 6;
			ctx.beginPath();
			ctx.ellipse(0, -120 - k * 300, 80 + k * 500, 30 + k * 180, 0, 0, TAU);
			ctx.stroke();
		}
	}
	ctx.restore();
}

/** A red line from a Red Lantern to the battery: it's drinking the light. */
export function drawDrain(ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number, time: number) {
	ctx.save();
	ctx.strokeStyle = `rgba(255, 50, 50, ${0.35 + 0.2 * Math.sin(time * 14 + fromX)})`;
	ctx.shadowColor = RAGE;
	ctx.shadowBlur = 8;
	ctx.lineWidth = 2.5;
	ctx.setLineDash([10, 8]);
	ctx.lineDashOffset = time * 60;
	ctx.beginPath();
	ctx.moveTo(fromX, fromY);
	ctx.lineTo(toX, toY);
	ctx.stroke();
	ctx.restore();
}

/** A drop pod coming down: a streak of rage from the sky onto (x, y), `k` 0..1 until it lands. */
export function drawDropPod(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, time: number) {
	ctx.save();
	// Where it's going to hit
	ctx.strokeStyle = `rgba(255, 60, 60, ${0.3 + 0.4 * k})`;
	ctx.lineWidth = 2;
	ctx.setLineDash([6, 6]);
	ctx.lineDashOffset = -time * 30;
	ctx.beginPath();
	ctx.ellipse(x, y, 50, 22, 0, 0, TAU);
	ctx.stroke();
	ctx.setLineDash([]);
	// The pod, high up and falling
	const h = (1 - k) * 900;
	const px = x + (1 - k) * 260;
	const py = y - h;
	ctx.strokeStyle = 'rgba(255, 80, 60, 0.6)';
	ctx.lineWidth = 10;
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(px + 120, py - 400);
	ctx.lineTo(px, py);
	ctx.stroke();
	ctx.fillStyle = '#3a0c0c';
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 2;
	ctx.shadowColor = RAGE;
	ctx.shadowBlur = 18;
	ctx.beginPath();
	ctx.ellipse(px, py, 16, 22, 0.5, 0, TAU);
	ctx.fill();
	ctx.stroke();
	ctx.restore();
}

/** The flagship's strike coming down: a column of red light out of the sky, `k` 0..1 through it. */
export function drawOrbitalStrike(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, k: number) {
	ctx.save();
	ctx.globalCompositeOperation = 'lighter';
	const fade = 1 - k;
	const w = radius * (0.5 + 0.5 * Math.min(1, k * 4));
	const beam = ctx.createLinearGradient(x - w, 0, x + w, 0);
	beam.addColorStop(0, 'rgba(255, 40, 40, 0)');
	beam.addColorStop(0.5, `rgba(255, 190, 170, ${0.85 * fade})`);
	beam.addColorStop(1, 'rgba(255, 40, 40, 0)');
	ctx.fillStyle = beam;
	ctx.fillRect(x - w, y - 1400, w * 2, 1400);
	ctx.restore();
}

/**
 * Dex-Starr: a small blue-grey cat in a Red Lantern's uniform, wrapped in
 * rage-red light, flying. `carrying`: a Guardian held in a bubble of rage
 * beneath him.
 */
export function drawDexStarr(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, dir: 1 | -1, carrying: boolean) {
	ctx.save();
	ctx.translate(x, y);
	if (carrying) {
		// The Guardian, in a red bubble, dangling below
		ctx.save();
		ctx.translate(0, 70);
		ctx.scale(0.7, 0.7);
		drawGuardian(ctx, 0, 0, 0, 1, time);
		ctx.restore();
		ctx.strokeStyle = 'rgba(255, 60, 60, 0.8)';
		ctx.fillStyle = 'rgba(255, 40, 40, 0.14)';
		ctx.shadowColor = RAGE;
		ctx.shadowBlur = 12;
		ctx.lineWidth = 2.5;
		ctx.beginPath();
		ctx.arc(0, 48, 42, 0, TAU);
		ctx.fill();
		ctx.stroke();
		ctx.shadowBlur = 0;
	}
	ctx.scale(dir * 1.6, 1.6);
	// Aura
	const aura = ctx.createRadialGradient(0, -6, 2, 0, -6, 26);
	aura.addColorStop(0, 'rgba(255, 40, 40, 0.45)');
	aura.addColorStop(1, 'rgba(255, 40, 40, 0)');
	ctx.fillStyle = aura;
	ctx.beginPath();
	ctx.arc(0, -6, 26, 0, TAU);
	ctx.fill();
	// Tail, streaming
	ctx.strokeStyle = '#5d6f86';
	ctx.lineWidth = 3;
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(-9, -4);
	ctx.quadraticCurveTo(-18, -8 + Math.sin(time * 8) * 3, -24, -2);
	ctx.stroke();
	// Body, flying flat out
	ctx.fillStyle = '#6b7f99';
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.ellipse(0, -4, 11, 5.5, 0, 0, TAU);
	ctx.fill();
	ctx.stroke();
	// The uniform: black, and the red emblem
	ctx.fillStyle = '#16090a';
	ctx.beginPath();
	ctx.ellipse(1, -3, 7, 4.4, 0, 0, TAU);
	ctx.fill();
	ctx.fillStyle = RAGE;
	ctx.beginPath();
	ctx.arc(3, -3, 1.6, 0, TAU);
	ctx.fill();
	// Legs out in front and behind
	ctx.strokeStyle = '#5d6f86';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(7, -1);
	ctx.lineTo(13, 1);
	ctx.moveTo(-7, -1);
	ctx.lineTo(-13, 2);
	ctx.stroke();
	// Head, ears, and eyes glowing red
	ctx.fillStyle = '#6b7f99';
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.arc(12, -8, 4.6, 0, TAU);
	ctx.fill();
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(10, -11.5);
	ctx.lineTo(10.6, -15.5);
	ctx.lineTo(12.6, -12.4);
	ctx.moveTo(13.4, -12.4);
	ctx.lineTo(15.2, -15.6);
	ctx.lineTo(15.6, -11);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = RAGE;
	ctx.shadowColor = RAGE;
	ctx.shadowBlur = 6;
	ctx.fillRect(13.6, -9.2, 1.8, 1.2);
	ctx.restore();
}

/** How high Dex-Starr flies (px above his ground point). */
const DEX_HOVER = 56;

/** Dex-Starr as an enemy: flying at head height over his shadow, flashing white when hit. */
export function drawDexStarrEnemy(ctx: CanvasRenderingContext2D, e: Enemy, x: number, y: number, hasGround: boolean, time: number) {
	const defeated = !isStanding(e);
	const air = e.brain.air * SLAM_HEIGHT;
	const bob = defeated ? 0 : Math.sin(time * 5 + e.homeX) * 4;
	ctx.save();
	ctx.globalAlpha = defeated ? Math.min(1, e.down / 0.5) : 1;
	if (hasGround) {
		ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
		ctx.beginPath();
		ctx.ellipse(x, y, 16, 5, 0, 0, TAU);
		ctx.fill();
	}
	const lift = defeated ? 12 : DEX_HOVER + air;
	drawDexStarr(ctx, x, y - lift + bob, time, e.dir, false);
	if (e.flash > 0) {
		ctx.globalCompositeOperation = 'lighter';
		ctx.globalAlpha = Math.min(1, e.flash * 6) * 0.6;
		drawDexStarr(ctx, x, y - lift + bob, time, e.dir, false);
	}
	ctx.restore();
}

export const dexStarrHand = (e: Enemy, x: number, y: number): [number, number] => [x + e.dir * 22, y - DEX_HOVER - e.brain.air * SLAM_HEIGHT - 12];
export const dexStarrTop = (e: Enemy, y: number) => y - DEX_HOVER - e.brain.air * SLAM_HEIGHT - 44;

