// Act 3, Mission 3 (Into Sector 666): the dead sector. Red nebulae over
// everything, rage storms drifting through it, the burnt husks of Manhunters
// from the day they killed it, Ganthet leading the way, and the Blood Gate
// into Ysmault's system.

import { drawGuardian } from '../scenes/summoned';

const TAU = Math.PI * 2;
const OUTLINE = '#050101';

/** A patch of red nebula far behind everything (drawn first, so it's the backdrop). */
export function drawRedNebula(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number, time: number) {
	ctx.save();
	for (let i = 0; i < 4; i++) {
		const a = seed * 10 + i * 1.7;
		const cx = x + Math.cos(a) * r * 0.35;
		const cy = y + Math.sin(a) * r * 0.2;
		const rr = r * (0.55 + 0.15 * Math.sin(time * 0.2 + i + seed * 5));
		const g = ctx.createRadialGradient(cx, cy, rr * 0.1, cx, cy, rr);
		g.addColorStop(0, `rgba(150, 20, 30, ${0.2 - i * 0.03})`);
		g.addColorStop(1, 'rgba(90, 0, 10, 0)');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.ellipse(cx, cy, rr, rr * 0.6, a, 0, TAU);
		ctx.fill();
	}
	ctx.restore();
}

/** A rage storm: a churning red cloud with lightning in it. */
export function drawRageStorm(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, time: number, seed: number) {
	ctx.save();
	ctx.globalCompositeOperation = 'lighter';
	for (let i = 0; i < 7; i++) {
		const a = time * (0.6 + i * 0.1) * (i % 2 ? 1 : -1) + i + seed * 7;
		const cx = x + Math.cos(a) * r * 0.3;
		const cy = y + Math.sin(a) * r * 0.18;
		const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, r * 0.7);
		g.addColorStop(0, 'rgba(255, 60, 50, 0.18)');
		g.addColorStop(1, 'rgba(160, 0, 20, 0)');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.ellipse(cx, cy, r * 0.7, r * 0.45, a, 0, TAU);
		ctx.fill();
	}
	ctx.globalCompositeOperation = 'source-over';
	// Its edge, so you can see where it hurts
	ctx.strokeStyle = `rgba(255, 70, 60, ${0.35 + 0.15 * Math.sin(time * 4 + seed)})`;
	ctx.setLineDash([14, 10]);
	ctx.lineDashOffset = time * 20;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.ellipse(x, y, r, r * 0.62, 0, 0, TAU);
	ctx.stroke();
	ctx.setLineDash([]);
	// Lightning, now and then
	if (Math.sin(time * 9 + seed * 20) > 0.6) {
		ctx.strokeStyle = 'rgba(255, 200, 190, 0.85)';
		ctx.shadowColor = '#ff2a2a';
		ctx.shadowBlur = 10;
		ctx.lineWidth = 2;
		const a = Math.floor(time * 3 + seed * 11);
		let px = x + Math.cos(a) * r * 0.5;
		let py = y + Math.sin(a) * r * 0.3;
		ctx.beginPath();
		ctx.moveTo(px, py);
		for (let i = 0; i < 5; i++) {
			px += Math.cos(a * 1.7 + i) * r * 0.18;
			py += Math.sin(a * 2.3 + i) * r * 0.14;
			ctx.lineTo(px, py);
		}
		ctx.stroke();
	}
	ctx.restore();
}

/** A Manhunter that died here with the sector: a huge burnt husk, tumbling slowly. */
export function drawManhunterHusk(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, seed: number, time: number) {
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(seed * TAU + time * 0.02 * (seed > 0.5 ? 1 : -1));
	const s = size / 100;
	ctx.scale(s, s);
	// Torso, hood and one arm, charred
	ctx.fillStyle = '#2b2226';
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.moveTo(-40, 40);
	ctx.lineTo(-46, -20);
	ctx.quadraticCurveTo(-30, -48, 0, -50);
	ctx.quadraticCurveTo(30, -48, 40, -18);
	ctx.lineTo(34, 42);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#4a1c1a';
	ctx.fillRect(-30, -10, 60, 30);
	// The face plate, eyes dead
	ctx.fillStyle = '#5c5c66';
	ctx.beginPath();
	ctx.ellipse(0, -30, 18, 14, 0, 0, TAU);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#140c0c';
	ctx.fillRect(-12, -34, 24, 5);
	// A broken arm
	ctx.fillStyle = '#241c20';
	ctx.beginPath();
	ctx.moveTo(40, -10);
	ctx.lineTo(80, 10);
	ctx.lineTo(74, 22);
	ctx.lineTo(36, 8);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.restore();
}

/** Ganthet, leading the way: small, calm, wrapped in green light; red when hurt, a steadier glow when shielded. */
export function drawGanthetEscort(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, hurt: number, moving: boolean) {
	ctx.save();
	const bob = Math.sin(time * 1.4) * 6;
	const glow = ctx.createRadialGradient(x, y - 50 + bob, 5, x, y - 50 + bob, 110);
	glow.addColorStop(0, `rgba(61, 255, 110, ${0.28 + 0.12 * Math.sin(time * 3)})`);
	glow.addColorStop(1, 'rgba(61, 255, 110, 0)');
	ctx.fillStyle = glow;
	ctx.beginPath();
	ctx.arc(x, y - 50 + bob, 110, 0, TAU);
	ctx.fill();
	// The way ahead, a faint line of light where he's going
	if (moving) {
		ctx.strokeStyle = 'rgba(61, 255, 110, 0.18)';
		ctx.lineWidth = 3;
		ctx.setLineDash([8, 14]);
		ctx.lineDashOffset = -time * 40;
		ctx.beginPath();
		ctx.moveTo(x + 40, y - 40 + bob);
		ctx.lineTo(x + 360, y - 40 + bob);
		ctx.stroke();
		ctx.setLineDash([]);
	}
	ctx.save();
	ctx.translate(x, y + bob);
	ctx.scale(1.1, 1.1);
	drawGuardian(ctx, 0, 0, 0, 0, time);
	ctx.restore();
	if (hurt > 0) {
		ctx.globalAlpha = hurt;
		ctx.fillStyle = 'rgba(255, 60, 60, 0.5)';
		ctx.beginPath();
		ctx.arc(x, y - 45 + bob, 34, 0, TAU);
		ctx.fill();
	}
	ctx.restore();
}

/** The Blood Gate: a ring of red rock hanging in space, blood-light across it until it opens (`open` 0..1). */
export function drawBloodGate(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, open: number) {
	ctx.save();
	ctx.translate(x, y);
	const r = 260;
	// The light across it: a wall of blood, then (opening) a way through to Ysmault's red sun
	const fill = ctx.createRadialGradient(0, 0, 10, 0, 0, r);
	if (open < 1) {
		fill.addColorStop(0, `rgba(200, 20, 30, ${0.55 * (1 - open)})`);
		fill.addColorStop(1, `rgba(90, 0, 10, ${0.35 * (1 - open)})`);
	} else {
		fill.addColorStop(0, 'rgba(255, 160, 120, 0.5)');
		fill.addColorStop(1, 'rgba(120, 10, 10, 0.1)');
	}
	ctx.fillStyle = fill;
	ctx.beginPath();
	ctx.ellipse(0, 0, r * 0.5, r, 0, 0, TAU);
	ctx.fill();
	if (open > 0 && open < 1) {
		ctx.strokeStyle = `rgba(160, 255, 190, ${open})`;
		ctx.lineWidth = 4;
		ctx.beginPath();
		ctx.ellipse(0, 0, r * 0.5 * open, r * open, 0, 0, TAU);
		ctx.stroke();
	}
	// The ring itself: blocks of red stone
	for (let i = 0; i < 16; i++) {
		const a = (i / 16) * TAU;
		ctx.save();
		ctx.translate(Math.cos(a) * r * 0.55, Math.sin(a) * r * 1.05);
		ctx.rotate(a);
		ctx.fillStyle = i % 2 ? '#4a1414' : '#3a0e0f';
		ctx.strokeStyle = OUTLINE;
		ctx.lineWidth = 2;
		ctx.fillRect(-26, -18, 52, 36);
		ctx.strokeRect(-26, -18, 52, 36);
		ctx.fillStyle = `rgba(255, 50, 40, ${0.4 + 0.3 * Math.sin(time * 3 + i)})`;
		ctx.fillRect(-4, -12, 8, 24);
		ctx.restore();
	}
	ctx.restore();
}
