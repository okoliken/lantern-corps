// Drawing Red Lantern constructs: blasts, saws, barbed chains, slams and roars.
// Same energy language as the green constructs, in angry red and ragged shapes.

import type { Effect } from '../constructs/system';
import type { RedShot } from '../enemies/redConstructs';
import { drawSawShape } from './enemies';

const RED = '#ff2a2a';
const HOT = '#ffd0d0';
const TAU = Math.PI * 2;
const easeOut = (k: number) => 1 - (1 - k) ** 3;

export function drawRedShot(ctx: CanvasRenderingContext2D, s: RedShot, x: number, y: number, lift: number, time: number) {
	const dy = y - lift;
	const speed = Math.hypot(s.vx, s.vy) || 1;
	const ux = s.vx / speed;
	const uy = s.vy / speed;
	ctx.save();

	if (s.kind === 'saw') {
		drawSawShape(ctx, x, dy, 9, time * 22);
	} else if (s.kind === 'hook') {
		ctx.translate(x, dy);
		ctx.rotate(Math.atan2(uy, ux));
		ctx.shadowColor = RED;
		ctx.shadowBlur = 10;
		ctx.strokeStyle = RED;
		ctx.lineWidth = 2.5;
		ctx.lineCap = 'round';
		// A barbed hook: a point with two curved barbs
		ctx.beginPath();
		ctx.moveTo(-6, 0);
		ctx.lineTo(7, 0);
		ctx.moveTo(7, 0);
		ctx.quadraticCurveTo(1, -2, -2, -7);
		ctx.moveTo(7, 0);
		ctx.quadraticCurveTo(1, 2, -2, 7);
		ctx.stroke();
	} else {
		// Rage Blast: a ragged, flickering bolt with a smoky red wake
		ctx.translate(x, dy);
		ctx.rotate(Math.atan2(uy, ux));
		const wake = ctx.createLinearGradient(-30, 0, 0, 0);
		wake.addColorStop(0, 'rgba(255, 42, 42, 0)');
		wake.addColorStop(1, 'rgba(255, 42, 42, 0.6)');
		ctx.fillStyle = wake;
		ctx.beginPath();
		ctx.moveTo(-30, Math.sin(time * 40) * 2);
		ctx.lineTo(0, -5);
		ctx.lineTo(0, 5);
		ctx.closePath();
		ctx.fill();
		ctx.shadowColor = RED;
		ctx.shadowBlur = 14;
		ctx.fillStyle = RED;
		ctx.beginPath();
		for (let i = 0; i < 10; i++) {
			const a = (i / 10) * TAU;
			const r = (i % 2 === 0 ? 7 : 4.5) + Math.sin(time * 50 + i) * 0.8;
			ctx.lineTo(Math.cos(a) * r * 1.3, Math.sin(a) * r * 0.8);
		}
		ctx.closePath();
		ctx.fill();
		ctx.fillStyle = HOT;
		ctx.beginPath();
		ctx.ellipse(1, 0, 3.5, 2, 0, 0, TAU);
		ctx.fill();
	}
	ctx.restore();
}

/** A barbed red chain between two points, twitching with tension. */
export function drawRedChain(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, time: number) {
	const dx = x2 - x1;
	const dy = y2 - y1;
	const len = Math.hypot(dx, dy);
	if (len < 2) return;
	const nx = -dy / len;
	const ny = dx / len;
	const links = Math.max(2, Math.floor(len / 9));
	ctx.save();
	ctx.shadowColor = RED;
	ctx.shadowBlur = 8;
	ctx.strokeStyle = RED;
	ctx.lineWidth = 1.8;
	for (let i = 0; i < links; i++) {
		const k = (i + 0.5) / links;
		const jitter = Math.sin(time * 35 + i * 1.7) * 1.2;
		const cx = x1 + dx * k + nx * jitter;
		const cy = y1 + dy * k + ny * jitter;
		ctx.beginPath();
		ctx.ellipse(cx, cy, 4, 2.2, Math.atan2(dy, dx) + (i % 2 ? Math.PI / 2 : 0), 0, TAU);
		ctx.stroke();
		// Barbs on every third link
		if (i % 3 === 1) {
			ctx.beginPath();
			ctx.moveTo(cx, cy);
			ctx.lineTo(cx + nx * 5 - (dx / len) * 3, cy + ny * 5 - (dy / len) * 3);
			ctx.stroke();
		}
	}
	ctx.restore();
}

/** Red construct effects. `lift` is the effect's own height above the ground. */
export function drawRedEffect(ctx: CanvasRenderingContext2D, e: Effect, lift: number, time: number) {
	const t = e.age / e.life;
	const r = e.radius ?? 60;
	switch (e.kind) {
		case 'slamMark': {
			// Where the Rage Slam will land: a ring that fills in as it falls
			ctx.globalAlpha = 0.9;
			ctx.strokeStyle = RED;
			ctx.lineWidth = 2;
			ctx.setLineDash([8, 6]);
			ctx.lineDashOffset = -time * 30;
			ctx.beginPath();
			ctx.ellipse(e.x, e.y, r, r * 0.55, 0, 0, TAU);
			ctx.stroke();
			ctx.setLineDash([]);
			ctx.fillStyle = `rgba(255, 42, 42, ${0.12 + 0.25 * t})`;
			ctx.beginPath();
			ctx.ellipse(e.x, e.y, r * t, r * 0.55 * t, 0, 0, TAU);
			ctx.fill();
			break;
		}
		case 'redBlast': {
			// Slam impact: a cracked red shockwave on the ground
			const k = easeOut(t);
			ctx.globalAlpha = 1 - t;
			ctx.shadowColor = RED;
			ctx.shadowBlur = 16;
			ctx.strokeStyle = t < 0.2 ? HOT : RED;
			ctx.lineWidth = 5 * (1 - t) + 1;
			ctx.beginPath();
			ctx.ellipse(e.x, e.y, r * (0.4 + 0.8 * k), r * 0.55 * (0.4 + 0.8 * k), 0, 0, TAU);
			ctx.stroke();
			ctx.lineWidth = 2;
			for (let i = 0; i < 8; i++) {
				const a = (i / 8) * TAU + 0.3;
				ctx.beginPath();
				ctx.moveTo(e.x + Math.cos(a) * r * 0.2, e.y + Math.sin(a) * r * 0.11);
				ctx.lineTo(e.x + Math.cos(a) * r * k, e.y + Math.sin(a) * r * 0.55 * k);
				ctx.stroke();
			}
			break;
		}
		case 'roar': {
			// Jagged rings of fury bursting outward
			const k = easeOut(t);
			const cy = e.y - lift;
			ctx.shadowColor = RED;
			ctx.shadowBlur = 18;
			for (let ring = 0; ring < 2; ring++) {
				const rk = Math.max(0, k - ring * 0.18);
				ctx.globalAlpha = (1 - t) * (ring === 0 ? 1 : 0.6);
				ctx.strokeStyle = ring === 0 && t < 0.25 ? HOT : RED;
				ctx.lineWidth = 4 * (1 - t) + 1;
				ctx.beginPath();
				for (let i = 0; i <= 24; i++) {
					const a = (i / 24) * TAU;
					const jag = i % 2 === 0 ? 1 : 0.88;
					ctx.lineTo(e.x + Math.cos(a) * r * rk * jag, cy + Math.sin(a) * r * 0.55 * rk * jag);
				}
				ctx.stroke();
			}
			break;
		}
		case 'redImpact': {
			ctx.globalAlpha = 1 - t;
			ctx.shadowColor = RED;
			ctx.shadowBlur = 12;
			ctx.fillStyle = t < 0.3 ? HOT : RED;
			const size = 4 + 10 * easeOut(t);
			ctx.beginPath();
			for (let i = 0; i < 10; i++) {
				const a = (i / 10) * TAU;
				const rr = i % 2 === 0 ? size : size * 0.4;
				ctx.lineTo(e.x + Math.cos(a) * rr, e.y - lift + Math.sin(a) * rr);
			}
			ctx.closePath();
			ctx.fill();
			break;
		}
	}
}
