// Fire Season (season two): fire on the street, burning as big as it's got;
// people at a high window with smoke coming out round them; the ambulance
// they're brought to.

import { colonist, drawColonist } from './colony';
import type { Figure } from './lantern';

const TAU = Math.PI * 2;

/** A fire on the ground, `size` 0..1: low flames to a roaring blaze, licking and leaning, smoke going up. */
export function drawBlaze(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, flash: boolean, time: number, seed: number) {
	if (size <= 0.01) return;
	const w = 30 + 60 * size;
	const h = 40 + 110 * size;
	ctx.save();
	// Scorch and glow on the ground
	const glow = ctx.createRadialGradient(x, y, 4, x, y, w * 1.6);
	glow.addColorStop(0, `rgba(255, 140, 40, ${0.35 + 0.2 * size})`);
	glow.addColorStop(1, 'rgba(255, 90, 20, 0)');
	ctx.fillStyle = glow;
	ctx.beginPath();
	ctx.ellipse(x, y, w * 1.6, w * 0.7, 0, 0, TAU);
	ctx.fill();
	ctx.fillStyle = 'rgba(20, 12, 8, 0.5)';
	ctx.beginPath();
	ctx.ellipse(x, y, w * 0.8, w * 0.3, 0, 0, TAU);
	ctx.fill();
	// Smoke going up from it
	for (let i = 0; i < 4; i++) {
		const k = (time * 0.35 + i / 4 + seed) % 1;
		ctx.fillStyle = `rgba(40, 36, 34, ${0.35 * (1 - k) * size})`;
		ctx.beginPath();
		ctx.arc(x + Math.sin(i * 3 + time) * 10 + k * 30, y - h * 0.8 - k * 160 * size, 14 + k * 40 * size, 0, TAU);
		ctx.fill();
	}
	// Tongues of flame, back ones red, front ones yellow-white
	const tongues = 5 + Math.round(4 * size);
	for (const [layer, colour] of [
		[0, '#c8321c'],
		[1, '#ff8a1e'],
		[2, '#ffd25a']
	] as const) {
		ctx.fillStyle = flash ? '#fff4d6' : colour;
		for (let i = 0; i < tongues; i++) {
			const k = (i + 0.5) / tongues - 0.5;
			const flick = Math.sin(time * (9 + i) + seed * 20 + layer) * 0.18 + 0.82;
			const th = h * (1 - Math.abs(k) * 1.3) * flick * (1 - layer * 0.28);
			const bx = x + k * w * (1.4 - layer * 0.35);
			const lean = Math.sin(time * 3 + i) * 6;
			ctx.beginPath();
			ctx.moveTo(bx - 10 * (1 - layer * 0.25), y);
			ctx.quadraticCurveTo(bx - 8, y - th * 0.5, bx + lean, y - th);
			ctx.quadraticCurveTo(bx + 8, y - th * 0.5, bx + 10 * (1 - layer * 0.25), y);
			ctx.closePath();
			ctx.fill();
		}
	}
	ctx.restore();
}

/**
 * People trapped up a building: a window high in its face with smoke rolling
 * out round it, and someone in it waving. `smoke` 0..1; `inside` lights the
 * window green while J'onn is in there for them.
 */
export function drawTrapped(ctx: CanvasRenderingContext2D, x: number, y: number, smoke: number, inside: boolean, time: number, seed: number) {
	const wy = y - 120;
	ctx.save();
	ctx.fillStyle = inside ? 'rgba(120, 220, 140, 0.85)' : '#ffd99a';
	ctx.fillRect(x - 22, wy - 26, 44, 34);
	ctx.strokeStyle = '#1a1a1d';
	ctx.lineWidth = 3;
	ctx.strokeRect(x - 22, wy - 26, 44, 34);
	if (!inside) {
		// Someone in it, an arm up waving
		ctx.fillStyle = '#2a2a2e';
		ctx.beginPath();
		ctx.arc(x - 4, wy - 10, 6, 0, TAU);
		ctx.fill();
		ctx.fillRect(x - 10, wy - 4, 12, 12);
		ctx.strokeStyle = '#2a2a2e';
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.moveTo(x + 2, wy - 2);
		ctx.lineTo(x + 10 + Math.sin(time * 9 + seed) * 4, wy - 18);
		ctx.stroke();
	}
	// Smoke rolling out over the sill and up the face
	for (let i = 0; i < 6; i++) {
		const k = (time * 0.4 + i / 6 + seed) % 1;
		ctx.fillStyle = `rgba(50, 46, 44, ${(0.25 + 0.5 * smoke) * (1 - k)})`;
		ctx.beginPath();
		ctx.arc(x + Math.sin(i * 2 + time) * 14, wy - 26 - k * 120, 10 + k * 30 * (0.5 + smoke), 0, TAU);
		ctx.fill();
	}
	// A call for help on the street below
	if (!inside) {
		ctx.fillStyle = `rgba(255, 255, 255, ${0.7 + 0.3 * Math.sin(time * 4)})`;
		ctx.font = '800 15px system-ui, sans-serif';
		ctx.textAlign = 'center';
		ctx.fillText('HELP!', x, wy - 40);
	}
	ctx.restore();
}

/** An ambulance pulled up at the kerb, lights going: where the people are brought. */
export function drawAmbulance(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
	ctx.save();
	ctx.fillStyle = 'rgba(80, 220, 120, 0.15)';
	ctx.beginPath();
	ctx.ellipse(x, y + 20, 170, 70, 0, 0, TAU);
	ctx.fill();
	ctx.strokeStyle = 'rgba(80, 220, 120, 0.6)';
	ctx.setLineDash([10, 8]);
	ctx.lineWidth = 3;
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
	ctx.fillRect(x - 74, y - 4, 150, 10);
	ctx.fillStyle = '#f2f2ee';
	ctx.strokeStyle = '#141414';
	ctx.lineWidth = 3;
	ctx.fillRect(x - 70, y - 70, 140, 70);
	ctx.strokeRect(x - 70, y - 70, 140, 70);
	ctx.fillRect(x + 70, y - 46, 34, 46);
	ctx.strokeRect(x + 70, y - 46, 34, 46);
	ctx.fillStyle = '#c8231c';
	ctx.fillRect(x - 70, y - 34, 174, 8);
	ctx.fillRect(x - 12, y - 62, 24, 8);
	ctx.fillRect(x - 4, y - 70, 8, 24);
	const on = Math.sin(time * 10) > 0;
	ctx.fillStyle = on ? '#ff3a2a' : '#3a6aff';
	ctx.fillRect(x - 60, y - 78, 16, 8);
	ctx.fillStyle = on ? '#3a6aff' : '#ff3a2a';
	ctx.fillRect(x + 44, y - 78, 16, 8);
	ctx.fillStyle = '#1a1a1d';
	for (const wx of [-44, 40, 88]) {
		ctx.beginPath();
		ctx.arc(x + wx, y + 2, 11, 0, TAU);
		ctx.fill();
	}
	ctx.restore();
}

/** A few people, following whoever's leading them out. */
export function drawRescued(ctx: CanvasRenderingContext2D, figures: readonly Figure[], x: number, y: number, dir: 1 | -1, walking: boolean, time: number) {
	const offsets = [
		[-18, -8],
		[12, -14],
		[0, 12]
	];
	figures.forEach((fig, i) => drawColonist(ctx, fig, x + offsets[i % 3][0], y + offsets[i % 3][1], dir, walking, time + i * 0.4));
}

export const civilians = (seed: number): Figure[] => [0, 1, 2].map((k) => colonist(200 + seed * 7 + k));
