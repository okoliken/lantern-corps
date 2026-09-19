// Training ground props: the glowing markers to walk to, the supply pod to
// protect, and Kilowog's practice drones and their harmless bolts.

import { GREEN } from './lantern';
import { green } from '../../theme';

const TAU = Math.PI * 2;
const PRACTICE = '#ffb347';

/** A glowing ring on the ground with a column of light: "go here". */
export function drawMarker(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, time: number) {
	const pulse = 0.6 + 0.4 * Math.sin(time * 4);
	ctx.save();
	const beam = ctx.createLinearGradient(0, y - 160, 0, y);
	beam.addColorStop(0, green(0));
	beam.addColorStop(1, green(0.25 * pulse));
	ctx.fillStyle = beam;
	ctx.fillRect(x - radius * 0.6, y - 160, radius * 1.2, 160);
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 14;
	ctx.strokeStyle = GREEN;
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.ellipse(x, y, radius, radius * 0.4, 0, 0, TAU);
	ctx.stroke();
	ctx.lineWidth = 1.5;
	ctx.globalAlpha = pulse;
	ctx.beginPath();
	ctx.ellipse(x, y, radius * (0.4 + 0.5 * ((time * 0.8) % 1)), radius * 0.16 * (1 + ((time * 0.8) % 1)), 0, 0, TAU);
	ctx.stroke();
	ctx.restore();
}

/** A Corps supply pod on its landing skids. Flashes when a practice bolt gets through. */
export function drawSupplyPod(ctx: CanvasRenderingContext2D, x: number, y: number, hit: boolean, time: number) {
	ctx.save();
	ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
	ctx.beginPath();
	ctx.ellipse(x, y, 44, 9, 0, 0, TAU);
	ctx.fill();
	ctx.translate(x, y - 18);
	ctx.strokeStyle = '#07100c';
	ctx.lineWidth = 1.5;
	ctx.fillStyle = hit ? '#ffffff' : '#dfe8e2';
	ctx.beginPath();
	ctx.roundRect(-36, -18, 72, 32, 12);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#0F4F34';
	ctx.fillRect(-36, -2, 72, 7);
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 8;
	ctx.fillStyle = GREEN;
	ctx.beginPath();
	ctx.arc(0, -6, 5 + Math.sin(time * 3) * 0.6, 0, TAU);
	ctx.fill();
	ctx.restore();
}

/** One of Kilowog's practice drones: a floating orb with an orange eye. */
export function drawPracticeDrone(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
	const bob = Math.sin(time * 2.2 + x) * 4;
	ctx.save();
	ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
	ctx.beginPath();
	ctx.ellipse(x, y, 14, 4, 0, 0, TAU);
	ctx.fill();
	ctx.translate(x, y - 50 + bob);
	ctx.fillStyle = '#3a4a44';
	ctx.strokeStyle = '#07100c';
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.arc(0, 0, 13, 0, TAU);
	ctx.fill();
	ctx.stroke();
	ctx.shadowColor = PRACTICE;
	ctx.shadowBlur = 10;
	ctx.fillStyle = PRACTICE;
	ctx.beginPath();
	ctx.arc(3, 0, 4.5, 0, TAU);
	ctx.fill();
	ctx.restore();
}

/** A harmless practice bolt, drawn `lift` px above its ground point. */
export function drawPracticeBolt(ctx: CanvasRenderingContext2D, x: number, y: number, lift: number) {
	ctx.save();
	ctx.shadowColor = PRACTICE;
	ctx.shadowBlur = 12;
	ctx.fillStyle = '#fff1d6';
	ctx.beginPath();
	ctx.arc(x, y - lift, 5, 0, TAU);
	ctx.fill();
	ctx.restore();
}
