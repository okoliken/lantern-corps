// Hector Hammond after the fragment found him: a scientist in a tweed suit,
// his skull swollen huge round a brain that won't stop growing, veins standing
// out on it. He doesn't walk any more; he floats, and his eyes burn yellow
// when he reaches out with his mind.

import { isStanding } from '../dummy';
import type { Enemy } from '../enemies/enemies';

const TAU = Math.PI * 2;
const OUTLINE = '#120c06';
/** How far off the ground he floats. */
const FLOAT = 34;

export const hammondTop = (e: Enemy, y: number) => y - FLOAT - 168 + (isStanding(e) ? 0 : 120);
export const hammondHand = (e: Enemy, x: number, y: number): [number, number] => [x + e.dir * 46, y - FLOAT - 86];

export function drawHammond(ctx: CanvasRenderingContext2D, e: Enemy, x: number, y: number, hasGround: boolean, time: number) {
	const b = e.brain;
	const reaching = b.state === 'windup' || b.state === 'act';
	const down = !isStanding(e);
	ctx.save();
	if (hasGround) {
		ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
		ctx.beginPath();
		ctx.ellipse(x, y, 30, 8, 0, 0, TAU);
		ctx.fill();
	}
	ctx.translate(x, y);
	if (down) {
		// Slumped on the ground, holding his head
		ctx.rotate(-e.dir * 1.35);
		ctx.translate(0, 20);
	} else ctx.translate(0, -FLOAT - Math.sin(time * 2) * 5);
	ctx.scale(e.dir, 1);
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 3;
	const flash = e.flash > 0;

	// Telekinesis round him while he's using it
	if (reaching && !down) {
		ctx.save();
		ctx.globalCompositeOperation = 'lighter';
		const g = ctx.createRadialGradient(0, -120, 10, 0, -120, 110);
		g.addColorStop(0, 'rgba(255, 220, 90, 0.35)');
		g.addColorStop(1, 'rgba(255, 180, 0, 0)');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.arc(0, -120, 110, 0, TAU);
		ctx.fill();
		ctx.restore();
	}

	// Legs hanging, shoes dangling
	const sway = Math.sin(time * 1.6) * 0.15;
	for (const [hx, ph] of [
		[-6, 0],
		[7, 1.4]
	]) {
		ctx.fillStyle = '#4a3a2a';
		ctx.save();
		ctx.translate(hx, -46);
		ctx.rotate(sway * Math.sin(ph + time));
		ctx.beginPath();
		ctx.rect(-6, 0, 12, 44);
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = '#1c1612';
		ctx.beginPath();
		ctx.ellipse(4, 46, 10, 5, 0, 0, TAU);
		ctx.fill();
		ctx.stroke();
		ctx.restore();
	}

	// Tweed jacket over a shirt and a loosened tie; a slight paunch
	ctx.fillStyle = flash ? '#fff4d8' : '#7a5a3a';
	ctx.beginPath();
	ctx.moveTo(-18, -44);
	ctx.quadraticCurveTo(-24, -70, -16, -96);
	ctx.lineTo(16, -96);
	ctx.quadraticCurveTo(26, -70, 20, -44);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#e8e2d4';
	ctx.beginPath();
	ctx.moveTo(-5, -96);
	ctx.lineTo(5, -96);
	ctx.lineTo(4, -60);
	ctx.lineTo(-4, -60);
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = '#5a2424';
	ctx.beginPath();
	ctx.moveTo(-2, -92);
	ctx.lineTo(3, -92);
	ctx.lineTo(4, -66);
	ctx.lineTo(0, -62);
	ctx.lineTo(-3, -66);
	ctx.closePath();
	ctx.fill();
	// Tweed flecks
	ctx.fillStyle = 'rgba(40, 26, 12, 0.35)';
	for (let i = 0; i < 10; i++) ctx.fillRect(-14 + ((i * 7) % 26), -90 + ((i * 11) % 40), 2, 2);

	// Arms: the far one reaching out at you when he uses his mind, the near one at his temple
	ctx.fillStyle = flash ? '#fff4d8' : '#6e5034';
	const out = reaching ? 1 : 0.35 + 0.1 * Math.sin(time * 2);
	arm(ctx, 14, -90, 14 + 34 * out, -90 + 6 - 30 * out * 0.4, 10);
	if (reaching) arm(ctx, -14, -90, -2, -128, 10);
	else arm(ctx, -14, -90, -18, -56, 10);

	// Neck, thin under the weight
	ctx.fillStyle = '#d9b48f';
	ctx.fillRect(-4, -106, 8, 12);
	ctx.strokeRect(-4, -106, 8, 12);

	// The head: a face of normal size under a cranium swollen twice too big
	const pulse = 1 + 0.02 * Math.sin(time * (reaching ? 9 : 3));
	ctx.fillStyle = flash ? '#fff4d8' : '#dcb592';
	ctx.beginPath();
	ctx.ellipse(-4, -142, 38 * pulse, 40 * pulse, -0.15, 0, TAU);
	ctx.fill();
	ctx.stroke();
	ctx.beginPath();
	ctx.ellipse(6, -116, 15, 15, 0, 0, TAU);
	ctx.fill();
	ctx.stroke();
	// Veins standing out on the skull
	ctx.strokeStyle = reaching ? 'rgba(170, 70, 90, 0.9)' : 'rgba(150, 80, 100, 0.6)';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(-26, -160);
	ctx.quadraticCurveTo(-14, -150, -18, -134);
	ctx.moveTo(-8, -176);
	ctx.quadraticCurveTo(0, -160, -6, -146);
	ctx.moveTo(12, -170);
	ctx.quadraticCurveTo(20, -156, 14, -140);
	ctx.stroke();
	// Thin grey hair left at the sides
	ctx.strokeStyle = '#8c8478';
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.moveTo(-38, -134);
	ctx.quadraticCurveTo(-42, -122, -34, -112);
	ctx.stroke();
	// Face: heavy brow, a thin mouth
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 2.5;
	ctx.beginPath();
	ctx.moveTo(2, -124);
	ctx.lineTo(18, -122);
	ctx.moveTo(6, -106);
	ctx.lineTo(16, -107);
	ctx.stroke();
	// Eyes, yellow and burning when he reaches out
	const glow = reaching ? 1 : 0.35 + 0.15 * Math.sin(time * 4);
	ctx.fillStyle = `rgba(255, ${200 + 50 * glow}, ${80 * (1 - glow)}, 1)`;
	ctx.beginPath();
	ctx.arc(12, -117, 3.2, 0, TAU);
	ctx.fill();
	ctx.globalCompositeOperation = 'lighter';
	const eg = ctx.createRadialGradient(12, -117, 0, 12, -117, 20);
	eg.addColorStop(0, `rgba(255, 230, 120, ${0.7 * glow})`);
	eg.addColorStop(1, 'rgba(255, 180, 0, 0)');
	ctx.fillStyle = eg;
	ctx.beginPath();
	ctx.arc(12, -117, 20, 0, TAU);
	ctx.fill();
	ctx.restore();
}

function arm(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w: number) {
	ctx.save();
	ctx.lineWidth = w + 5;
	ctx.strokeStyle = OUTLINE;
	ctx.beginPath();
	ctx.moveTo(x0, y0);
	ctx.lineTo(x1, y1);
	ctx.stroke();
	ctx.lineWidth = w;
	ctx.strokeStyle = ctx.fillStyle as string;
	ctx.stroke();
	ctx.fillStyle = '#dcb592';
	ctx.beginPath();
	ctx.arc(x1, y1, 5.5, 0, TAU);
	ctx.fill();
	ctx.lineWidth = 2;
	ctx.strokeStyle = OUTLINE;
	ctx.stroke();
	ctx.restore();
}
