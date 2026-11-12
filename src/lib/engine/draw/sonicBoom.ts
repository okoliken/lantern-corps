// Hal's Sonic Boom: the vapour cone round him as he goes through the sound
// barrier, and the shock cone that follows him down the line (constructs/system.ts).

import type { Effect } from '../constructs/system';
import { green, greenCore } from '../../theme';

const TAU = Math.PI * 2;

/** The cone of vapour wrapped round him, opening out behind, green at its edge. */
export function drawSonicCone(ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, time: number) {
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(Math.atan2(dy * 0.7, dx));
	const flick = 1 + 0.06 * Math.sin(time * 60);
	// The cone: a bell opening backwards from just ahead of him
	const cone = new Path2D();
	cone.moveTo(34, 0);
	cone.quadraticCurveTo(10, -40 * flick, -70, -62 * flick);
	cone.quadraticCurveTo(-58, 0, -70, 62 * flick);
	cone.quadraticCurveTo(10, 40 * flick, 34, 0);
	const g = ctx.createLinearGradient(34, 0, -70, 0);
	g.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
	g.addColorStop(0.5, 'rgba(230, 255, 240, 0.35)');
	g.addColorStop(1, 'rgba(200, 255, 220, 0)');
	ctx.fillStyle = g;
	ctx.fill(cone);
	ctx.strokeStyle = green(0.8);
	ctx.lineWidth = 2.5;
	ctx.stroke(cone);
	// Rings of shock running back along it
	for (let i = 0; i < 3; i++) {
		const k = (time * 6 + i / 3) % 1;
		ctx.strokeStyle = greenCore(0.6 * (1 - k));
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.ellipse(20 - k * 90, 0, 6 + k * 6, 30 + k * 34, 0, 0, TAU);
		ctx.stroke();
	}
	ctx.restore();
}

/** The shock cone down the line he went: a wedge of rippling air, widest at the far end, fading. */
export function drawSonicBoom(ctx: CanvasRenderingContext2D, e: Effect) {
	const end = e.mark ?? { x: e.x, y: e.y };
	const t = e.age / e.life;
	const r = (e.radius ?? 120) * (0.6 + 0.6 * Math.min(1, t * 3));
	const ang = Math.atan2(end.y - e.y, end.x - e.x);
	const len = Math.hypot(end.x - e.x, end.y - e.y);
	ctx.save();
	ctx.translate(e.x, e.y - 40);
	ctx.rotate(ang);
	ctx.globalAlpha *= 1 - t;
	const wedge = new Path2D();
	wedge.moveTo(0, -r * 0.35);
	wedge.lineTo(len, -r);
	wedge.quadraticCurveTo(len + r * 0.6, 0, len, r);
	wedge.lineTo(0, r * 0.35);
	wedge.closePath();
	const g = ctx.createLinearGradient(0, 0, len, 0);
	g.addColorStop(0, green(0.05));
	g.addColorStop(1, greenCore(0.4));
	ctx.fillStyle = g;
	ctx.fill(wedge);
	ctx.strokeStyle = greenCore(0.8);
	ctx.lineWidth = 3;
	ctx.stroke(wedge);
	// Ripples travelling out along it
	for (let i = 0; i < 6; i++) {
		const k = (i + 1) / 7;
		const w = r * (0.35 + 0.65 * k) * (1 + t * 0.4);
		ctx.strokeStyle = greenCore(0.5 * (1 - t));
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.ellipse(len * k + t * 40, 0, 8, w, 0, -Math.PI / 2, Math.PI / 2);
		ctx.stroke();
	}
	// The boom itself at the far end
	const b = ctx.createRadialGradient(len, 0, 0, len, 0, r * 1.3);
	b.addColorStop(0, `rgba(255, 255, 255, ${0.7 * (1 - t)})`);
	b.addColorStop(1, 'rgba(120, 255, 170, 0)');
	ctx.fillStyle = b;
	ctx.beginPath();
	ctx.arc(len, 0, r * 1.3, 0, TAU);
	ctx.fill();
	ctx.restore();
}
