// Act 3, Mission 2 (Dex-Starr): the crash site of a Red Lantern dreadnought
// on Oa's far plains. Hull plates driven into the ground, the ship's broken
// bow, Ganthet in a bubble of rage, and the glowing paw prints Dex-Starr
// leaves behind.

import { drawGuardian } from '../scenes/summoned';

const OUTLINE = '#050101';
const TAU = Math.PI * 2;
const HULL = '#3b1416';
const HULL_LIT = '#5a2124';
const HULL_DARK = '#1f0a0b';

/** A hull plate driven into the ground at an angle: dark crimson metal, rivets, a seam still glowing. */
export function drawHullPlate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, height: number, seed: number, time: number) {
	ctx.save();
	ctx.translate(x + w / 2, y + h / 2);
	// Scorched ground round it
	ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
	ctx.beginPath();
	ctx.ellipse(0, 4, w * 0.7, h * 0.9, 0, 0, TAU);
	ctx.fill();
	const lean = (seed - 0.5) * 0.5;
	const top = -height;
	const plate = new Path2D();
	plate.moveTo(-w / 2, 0);
	plate.lineTo(-w / 2 + lean * height * 0.4, top + height * 0.1 * seed);
	plate.lineTo(-w / 6 + lean * height * 0.45, top - 6);
	plate.lineTo(w / 5 + lean * height * 0.45, top + 10);
	plate.lineTo(w / 2 + lean * height * 0.4, top + height * 0.25);
	plate.lineTo(w / 2, 0);
	plate.closePath();
	const shade = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
	shade.addColorStop(0, HULL_DARK);
	shade.addColorStop(0.6, HULL_LIT);
	shade.addColorStop(1, HULL);
	ctx.fillStyle = shade;
	ctx.fill(plate);
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 2;
	ctx.stroke(plate);
	// Rivets along the edge
	ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
	for (let i = 1; i < 5; i++) {
		const k = i / 5;
		ctx.beginPath();
		ctx.arc(-w / 2 + 8 + lean * height * 0.4 * k, -height * k * 0.85, 2, 0, TAU);
		ctx.fill();
	}
	// A seam of rage still burning in it
	ctx.strokeStyle = `rgba(255, 60, 50, ${0.45 + 0.25 * Math.sin(time * 3 + seed * 10)})`;
	ctx.shadowColor = '#ff2a2a';
	ctx.shadowBlur = 8;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(-w * 0.1, -4);
	ctx.lineTo(-w * 0.02 + lean * height * 0.2, -height * 0.45);
	ctx.lineTo(w * 0.08 + lean * height * 0.3, -height * 0.7);
	ctx.stroke();
	ctx.restore();
}

/** The dreadnought's bow, nose down in the ground at the end of its furrow: huge, broken, still smoking. */
export function drawDreadnoughtBow(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
	ctx.save();
	ctx.translate(x, y);
	ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
	ctx.beginPath();
	ctx.ellipse(0, 0, 360, 90, 0, 0, TAU);
	ctx.fill();
	const bow = new Path2D();
	bow.moveTo(-340, 10);
	bow.lineTo(-300, -170);
	bow.lineTo(-120, -300);
	bow.lineTo(120, -360);
	bow.lineTo(250, -320);
	bow.lineTo(200, -250);
	bow.lineTo(290, -200);
	bow.lineTo(330, 10);
	bow.closePath();
	const shade = ctx.createLinearGradient(-340, -300, 330, 0);
	shade.addColorStop(0, HULL_LIT);
	shade.addColorStop(1, HULL_DARK);
	ctx.fillStyle = shade;
	ctx.fill(bow);
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 3;
	ctx.stroke(bow);
	// Plating lines
	ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
	ctx.lineWidth = 2;
	for (let i = 0; i < 6; i++) {
		ctx.beginPath();
		ctx.moveTo(-300 + i * 100, 0);
		ctx.lineTo(-240 + i * 90, -200 - i * 20);
		ctx.stroke();
	}
	// The Red Lanterns' emblem on its flank, flickering
	const flicker = 0.55 + 0.35 * Math.sin(time * 7) * Math.sin(time * 2.3);
	ctx.strokeStyle = `rgba(255, 50, 50, ${flicker})`;
	ctx.shadowColor = '#ff2a2a';
	ctx.shadowBlur = 16;
	ctx.lineWidth = 7;
	ctx.beginPath();
	ctx.arc(-20, -170, 44, 0, TAU);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(-64, -150);
	ctx.lineTo(24, -150);
	ctx.moveTo(-64, -190);
	ctx.lineTo(24, -190);
	ctx.stroke();
	ctx.shadowBlur = 0;
	// Smoke from the broken end
	for (let i = 0; i < 6; i++) {
		const k = (time * 0.15 + i / 6) % 1;
		ctx.fillStyle = `rgba(40, 30, 30, ${0.45 * (1 - k)})`;
		ctx.beginPath();
		ctx.arc(230 + k * 80 + Math.sin(i * 3 + time) * 10, -300 - k * 260, 26 + k * 50, 0, TAU);
		ctx.fill();
	}
	ctx.restore();
}

/** Ganthet in a bubble of rage, floating; `hurt` 0..1 as it cracks. */
export function drawRageBubble(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, hurt: number) {
	const bob = Math.sin(time * 1.6) * 5;
	ctx.save();
	ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
	ctx.beginPath();
	ctx.ellipse(x, y, 34, 10, 0, 0, TAU);
	ctx.fill();
	ctx.translate(x, y - 70 + bob);
	ctx.save();
	ctx.scale(0.8, 0.8);
	drawGuardian(ctx, 0, 30, 0, 1, time);
	ctx.restore();
	const r = 52;
	ctx.fillStyle = 'rgba(255, 40, 40, 0.14)';
	ctx.strokeStyle = `rgba(255, 70, 70, ${0.75 + 0.2 * Math.sin(time * 5)})`;
	ctx.shadowColor = '#ff2a2a';
	ctx.shadowBlur = 14;
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.arc(0, 0, r, 0, TAU);
	ctx.fill();
	ctx.stroke();
	ctx.shadowBlur = 0;
	// Cracks as it's broken
	if (hurt > 0.2) {
		ctx.strokeStyle = 'rgba(255, 220, 220, 0.8)';
		ctx.lineWidth = 1.5;
		const cracks = Math.ceil(hurt * 6);
		for (let i = 0; i < cracks; i++) {
			const a = i * 2.1 + 0.4;
			ctx.beginPath();
			ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
			ctx.lineTo(Math.cos(a + 0.25) * r * 0.6, Math.sin(a + 0.25) * r * 0.6);
			ctx.lineTo(Math.cos(a - 0.1) * r * 0.35, Math.sin(a - 0.1) * r * 0.35);
			ctx.stroke();
		}
	}
	ctx.restore();
}

/** Glowing red paw prints along where Dex-Starr went, the newest brightest. */
export function drawPawPrints(ctx: CanvasRenderingContext2D, prints: { x: number; y: number; age: number; angle: number }[], time: number) {
	ctx.save();
	ctx.shadowColor = '#ff2a2a';
	ctx.shadowBlur = 6;
	for (const p of prints) {
		const fade = Math.max(0, 1 - p.age / 14) * (0.7 + 0.3 * Math.sin(time * 4 + p.x));
		if (fade <= 0) continue;
		ctx.fillStyle = `rgba(255, 70, 60, ${0.75 * fade})`;
		ctx.save();
		ctx.translate(p.x, p.y);
		ctx.rotate(p.angle);
		ctx.beginPath();
		ctx.ellipse(0, 0, 5, 4, 0, 0, TAU);
		ctx.fill();
		for (let i = -1; i <= 1; i++) {
			ctx.beginPath();
			ctx.arc(6, i * 4, 1.8, 0, TAU);
			ctx.fill();
		}
		ctx.restore();
	}
	ctx.restore();
}
