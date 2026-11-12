// The Hunger: a beast Parallax's fear made out of Coast City's panic. Black
// smoke over a body of yellow light, a great hunched back ridged with spines,
// long forelimbs it walks on like an ape, a maw that splits open to the chest,
// and a cluster of burning eyes. It swells as it feeds.

import { isStanding } from '../dummy';
import type { Enemy } from '../enemies/enemies';

const TAU = Math.PI * 2;
const OUTLINE = '#0a0703';

/** How much it has fed (0..1): the mission sets it, the art swells with it. */
export const hungerFed = new WeakMap<Enemy, number>();

/** How big it is drawn, against its feeding (0..1). */
export const hungerScale = (fed: number) => 1 + fed * 0.35;
export const hungerTop = (e: Enemy, y: number, fed = 0) => y - (isStanding(e) ? 175 : 70) * hungerScale(fed);
export const hungerMouth = (e: Enemy, x: number, y: number, fed = 0): [number, number] => [x + e.dir * 70 * hungerScale(fed), y - 95 * hungerScale(fed)];

export function drawHunger(ctx: CanvasRenderingContext2D, e: Enemy, x: number, y: number, hasGround: boolean, time: number, fed = 0) {
	const b = e.brain;
	const rearing = b.state === 'windup';
	const striking = b.state === 'act';
	const down = !isStanding(e);
	const s = hungerScale(fed);
	const walk = Math.abs(e.vx) + Math.abs(e.vy) > 20 ? time * 7 : 0;
	const breathe = Math.sin(time * 2.2);
	const flash = e.flash > 0;
	ctx.save();
	if (hasGround) {
		ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
		ctx.beginPath();
		ctx.ellipse(x, y, 80 * s, 16 * s, 0, 0, TAU);
		ctx.fill();
	}
	ctx.translate(x, y);
	ctx.scale(e.dir * s, s);
	if (down) {
		ctx.translate(0, 40);
		ctx.rotate(-0.4);
	}
	const lean = rearing ? -0.28 : striking ? 0.22 : 0;
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';

	// Smoke boiling off it, behind everything
	for (let i = 0; i < 9; i++) {
		const k = (time * 0.6 + i / 9) % 1;
		const sx = -60 + ((i * 37) % 120) - k * 30;
		const sy = -120 - k * 90 - ((i * 23) % 40);
		ctx.fillStyle = `rgba(20, 14, 6, ${0.35 * (1 - k)})`;
		ctx.beginPath();
		ctx.arc(sx, sy, 18 + k * 26, 0, TAU);
		ctx.fill();
	}

	// Far limbs, darker
	limb(ctx, -30, -70, -48 + Math.sin(walk) * 14, 0, 22, '#1b130a');
	limb(ctx, 40, -90, 62 + Math.sin(walk + 2) * 16, 0, 24, '#1b130a');

	ctx.save();
	ctx.rotate(lean);
	// The body: a hunched mass, highest at the shoulders, tail-less, heavy
	const body = new Path2D();
	body.moveTo(-70, -40);
	body.quadraticCurveTo(-90, -110, -30, -150 - breathe * 3);
	body.quadraticCurveTo(30, -185 - breathe * 4, 70, -135);
	body.quadraticCurveTo(100, -100, 88, -60);
	body.quadraticCurveTo(40, -30, -10, -36);
	body.quadraticCurveTo(-50, -30, -70, -40);
	body.closePath();
	ctx.fillStyle = flash ? '#fff2c8' : '#24190c';
	ctx.fill(body);
	// Yellow light showing through cracks in the smoke
	ctx.save();
	ctx.clip(body);
	const glow = ctx.createRadialGradient(20, -100, 10, 20, -100, 120);
	glow.addColorStop(0, `rgba(255, 200, 50, ${0.55 + 0.25 * fed + (rearing ? 0.2 : 0)})`);
	glow.addColorStop(1, 'rgba(255, 150, 0, 0)');
	ctx.fillStyle = glow;
	ctx.fillRect(-120, -200, 240, 200);
	ctx.strokeStyle = `rgba(255, 220, 90, ${0.7 + 0.3 * Math.sin(time * 5)})`;
	ctx.lineWidth = 2.5;
	ctx.beginPath();
	for (let i = 0; i < 7; i++) {
		const cx = -50 + i * 20;
		const cy = -60 - ((i * 29) % 70);
		ctx.moveTo(cx, cy);
		ctx.lineTo(cx + 9, cy - 14);
		ctx.lineTo(cx + 4, cy - 26);
		ctx.lineTo(cx + 14, cy - 38);
	}
	ctx.stroke();
	ctx.restore();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 3.5;
	ctx.stroke(body);

	// Spines along the ridge of its back
	ctx.fillStyle = '#3a2a10';
	for (let i = 0; i < 7; i++) {
		const k = i / 6;
		const bx = -60 + k * 120;
		const by = -120 - Math.sin(k * Math.PI) * 55 - breathe * 3;
		const len = 26 + Math.sin(k * Math.PI) * 22;
		ctx.beginPath();
		ctx.moveTo(bx - 7, by + 6);
		ctx.lineTo(bx - 14 + k * 4, by - len);
		ctx.lineTo(bx + 7, by + 6);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
	}

	// The head, low and forward, the maw splitting open
	const open = rearing ? 0.9 : striking ? 1 : 0.25 + 0.1 * Math.sin(time * 3);
	ctx.save();
	ctx.translate(82, -96);
	const head = new Path2D();
	head.moveTo(-20, -30);
	head.quadraticCurveTo(20, -44, 50, -16);
	head.lineTo(56, -4);
	head.lineTo(-10, 4);
	head.closePath();
	ctx.fillStyle = flash ? '#fff2c8' : '#2c1f0e';
	ctx.fill(head);
	ctx.stroke(head);
	// Lower jaw hinging down
	ctx.save();
	ctx.rotate(open * 0.7);
	const jaw = new Path2D();
	jaw.moveTo(-12, 0);
	jaw.lineTo(54, 2);
	jaw.quadraticCurveTo(40, 24, -6, 18);
	jaw.closePath();
	ctx.fillStyle = flash ? '#fff2c8' : '#24190c';
	ctx.fill(jaw);
	ctx.stroke(jaw);
	ctx.restore();
	// The inside of the mouth: a furnace of yellow light, and teeth
	ctx.save();
	ctx.globalCompositeOperation = 'lighter';
	const mg = ctx.createRadialGradient(20, 6, 0, 20, 6, 50);
	mg.addColorStop(0, `rgba(255, 245, 180, ${0.6 * open + 0.2})`);
	mg.addColorStop(1, 'rgba(255, 170, 0, 0)');
	ctx.fillStyle = mg;
	ctx.beginPath();
	ctx.arc(20, 6, 50, 0, TAU);
	ctx.fill();
	ctx.restore();
	ctx.fillStyle = '#f4e3b0';
	for (let i = 0; i < 6; i++) {
		const tx = -2 + i * 9;
		ctx.beginPath();
		ctx.moveTo(tx, -2);
		ctx.lineTo(tx + 3, 9);
		ctx.lineTo(tx + 6, -2);
		ctx.fill();
	}
	// A cluster of eyes, burning
	for (const [ex, ey, r] of [
		[18, -22, 5],
		[30, -26, 4],
		[8, -16, 3.5],
		[38, -18, 3],
		[24, -12, 3]
	]) {
		ctx.fillStyle = '#ffef9a';
		ctx.beginPath();
		ctx.arc(ex, ey, r, 0, TAU);
		ctx.fill();
		ctx.save();
		ctx.globalCompositeOperation = 'lighter';
		const eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, r * 4);
		eg.addColorStop(0, 'rgba(255, 220, 90, 0.7)');
		eg.addColorStop(1, 'rgba(255, 160, 0, 0)');
		ctx.fillStyle = eg;
		ctx.beginPath();
		ctx.arc(ex, ey, r * 4, 0, TAU);
		ctx.fill();
		ctx.restore();
	}
	ctx.restore();
	ctx.restore();

	// Near limbs: long forelimb it knuckles on, and a short hind leg
	const reach = striking ? 40 : rearing ? -30 : 0;
	limb(ctx, 60, -80, 96 + reach + Math.sin(walk + Math.PI) * 16, rearing ? -60 : 0, 26, flash ? '#fff2c8' : '#2e2010');
	limb(ctx, -40, -60, -30 + Math.sin(walk + Math.PI + 2) * 14, 0, 24, flash ? '#fff2c8' : '#2e2010');
	ctx.restore();
}

/** A thick limb in two segments, with claws at the end. */
function limb(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w: number, fill: string) {
	const mx = (x0 + x1) / 2 + 10;
	const my = (y0 + y1) / 2 - 8;
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = w + 6;
	ctx.beginPath();
	ctx.moveTo(x0, y0);
	ctx.lineTo(mx, my);
	ctx.lineTo(x1, y1 - 4);
	ctx.stroke();
	ctx.strokeStyle = fill;
	ctx.lineWidth = w;
	ctx.stroke();
	ctx.fillStyle = '#e8d9a8';
	for (let i = -1; i <= 1; i++) {
		ctx.beginPath();
		ctx.moveTo(x1 + i * 8 - 3, y1 - 6);
		ctx.lineTo(x1 + i * 9 + 6, y1 + 2);
		ctx.lineTo(x1 + i * 8 + 3, y1 - 6);
		ctx.fill();
	}
}
