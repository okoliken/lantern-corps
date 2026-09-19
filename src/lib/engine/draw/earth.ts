// Earth, for story scenes: Detroit at night, from the roof of a building
// going up, where John Stewart works. Drawn on a fixed stage EARTH_W x
// EARTH_H; the scene scales it to the screen.

import { green, greenCore } from '../../theme';

export const EARTH_W = 1400;
export const EARTH_H = 784;
/** The roof John stands on. */
export const ROOF = 600;

const TAU = Math.PI * 2;

function seeded(seed: number) {
	let s = seed;
	return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const rand = seeded(1967);
const STARS = Array.from({ length: 70 }, () => [rand() * EARTH_W, rand() * 300, rand() * 1.2 + 0.3, rand() * TAU]);
/** Skyline blocks: [x, width, height, far (0) or near (1)] */
const BLOCKS: number[][] = [];
for (let layer = 0; layer < 2; layer++) {
	let x = -40;
	while (x < EARTH_W + 40) {
		const w = 60 + rand() * 90;
		BLOCKS.push([x, w, (layer ? 120 : 180) + rand() * (layer ? 160 : 220), layer, rand()]);
		x += w + (layer ? 30 : 6) + rand() * 30;
	}
}

/** The night sky, the skyline with its lit windows, and the rooftop construction site. */
export function drawDetroit(ctx: CanvasRenderingContext2D, time: number, glow: number) {
	const sky = ctx.createLinearGradient(0, 0, 0, ROOF);
	sky.addColorStop(0, '#050811');
	sky.addColorStop(0.7, '#101a33');
	sky.addColorStop(1, '#2a2440');
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, EARTH_W, ROOF);

	for (const [x, y, r, phase] of STARS) {
		ctx.fillStyle = `rgba(230, 236, 255, ${0.25 + 0.25 * Math.sin(time * 1.3 + phase)})`;
		ctx.fillRect(x, y, r, r);
	}
	ctx.fillStyle = 'rgba(240, 240, 220, 0.85)';
	ctx.beginPath();
	ctx.arc(1180, 110, 34, 0, TAU);
	ctx.fill();

	// Skyline: far blocks dim and blue, near ones darker with warm windows
	for (const [x, w, h, layer, seed] of BLOCKS) {
		const base = ROOF + (layer ? 20 : -10);
		ctx.fillStyle = layer ? '#0b0e18' : '#161c30';
		ctx.fillRect(x, base - h, w, h);
		const r = seeded(Math.floor(seed * 1e6) + 1);
		ctx.fillStyle = layer ? 'rgba(255, 210, 120, 0.8)' : 'rgba(255, 220, 150, 0.35)';
		for (let wy = base - h + 12; wy < base - 10; wy += 16) {
			for (let wx = x + 8; wx < x + w - 8; wx += 14) if (r() < 0.3) ctx.fillRect(wx, wy, 5, 7);
		}
	}

	// A crane over the site, its light blinking
	ctx.strokeStyle = '#3a2f2a';
	ctx.lineWidth = 6;
	ctx.beginPath();
	ctx.moveTo(1210, ROOF);
	ctx.lineTo(1210, 190);
	ctx.lineTo(760, 190);
	ctx.moveTo(1210, 190);
	ctx.lineTo(1300, 190);
	ctx.stroke();
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.moveTo(900, 190);
	ctx.lineTo(900, 330);
	ctx.stroke();
	ctx.fillStyle = Math.sin(time * 3) > 0 ? '#ff4a3a' : '#4a1410';
	ctx.beginPath();
	ctx.arc(1210, 184, 5, 0, TAU);
	ctx.fill();

	// The roof: bare concrete, steel frame going up behind John
	ctx.fillStyle = '#26262d';
	ctx.fillRect(0, ROOF, EARTH_W, EARTH_H - ROOF + 400);
	ctx.strokeStyle = '#9c4a2c';
	ctx.lineWidth = 8;
	for (const bx of [520, 700, 880, 1060]) {
		ctx.beginPath();
		ctx.moveTo(bx, ROOF);
		ctx.lineTo(bx, ROOF - 230);
		ctx.stroke();
	}
	ctx.beginPath();
	ctx.moveTo(500, ROOF - 230);
	ctx.lineTo(1080, ROOF - 230);
	ctx.moveTo(500, ROOF - 120);
	ctx.lineTo(1080, ROOF - 120);
	ctx.stroke();
	ctx.strokeStyle = greenCore(0.08);
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(0, ROOF + 0.5);
	ctx.lineTo(EARTH_W, ROOF + 0.5);
	ctx.stroke();

	// The ring's light washing over everything as it arrives
	if (glow > 0) {
		ctx.fillStyle = green(0.12 * glow);
		ctx.fillRect(0, 0, EARTH_W, EARTH_H + 400);
	}
}

// ------------------------------------------------------ Central City (Act 2)

/** A street lamp on the kerb, its light pooled on the ground. */
export function drawLampPost(ctx: CanvasRenderingContext2D, x: number, y: number) {
	ctx.save();
	ctx.fillStyle = 'rgba(255, 226, 160, 0.07)';
	ctx.beginPath();
	ctx.ellipse(x + 14, y + 4, 46, 16, 0, 0, TAU);
	ctx.fill();
	ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
	ctx.beginPath();
	ctx.ellipse(x, y, 5, 2, 0, 0, TAU);
	ctx.fill();
	ctx.strokeStyle = '#2b2e34';
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.moveTo(x, y);
	ctx.lineTo(x, y - 92);
	ctx.quadraticCurveTo(x, y - 100, x + 12, y - 100);
	ctx.stroke();
	ctx.fillStyle = '#ffe4a0';
	ctx.shadowColor = '#ffd27a';
	ctx.shadowBlur = 12;
	ctx.fillRect(x + 9, y - 99, 9, 3);
	ctx.restore();
}

/** A street tree in a square planter. */
export function drawStreetTree(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number) {
	ctx.save();
	ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
	ctx.beginPath();
	ctx.ellipse(x, y, 26, 8, 0, 0, TAU);
	ctx.fill();
	ctx.fillStyle = '#3a3027';
	ctx.fillRect(x - 12, y - 4, 24, 8);
	ctx.strokeStyle = '#4a3622';
	ctx.lineWidth = 4;
	ctx.beginPath();
	ctx.moveTo(x, y);
	ctx.lineTo(x, y - 34);
	ctx.stroke();
	const r = seeded(Math.floor(seed * 1e6) + 7);
	for (let i = 0; i < 6; i++) {
		const cx = x + (r() - 0.5) * 34;
		const cy = y - 46 - r() * 26;
		ctx.fillStyle = i % 2 ? '#2f5a2c' : '#3d6e36';
		ctx.beginPath();
		ctx.arc(cx, cy, 13 + r() * 8, 0, TAU);
		ctx.fill();
	}
	ctx.restore();
}

/**
 * Grodd's dig: the street torn open, slabs of asphalt heaved up round a
 * shaft, work lights, and at the bottom the thing he came for. `wake` (0..1)
 * is the Manhunter relic coming alive: orange light pulsing up out of the hole.
 */
export function drawDigSite(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, wake: number) {
	ctx.save();
	// The hole
	const g = ctx.createRadialGradient(x, y, 10, x, y, 150);
	g.addColorStop(0, '#050505');
	g.addColorStop(0.6, '#15130f');
	g.addColorStop(1, 'rgba(21, 19, 15, 0)');
	ctx.fillStyle = g;
	ctx.beginPath();
	ctx.ellipse(x, y, 150, 70, 0, 0, TAU);
	ctx.fill();
	if (wake > 0) {
		const pulse = 0.6 + 0.4 * Math.sin(time * (4 + wake * 10));
		const glow = ctx.createRadialGradient(x, y, 4, x, y, 130);
		glow.addColorStop(0, `rgba(255, 180, 90, ${0.8 * wake * pulse})`);
		glow.addColorStop(0.5, `rgba(255, 110, 30, ${0.4 * wake * pulse})`);
		glow.addColorStop(1, 'rgba(255, 90, 20, 0)');
		ctx.fillStyle = glow;
		ctx.beginPath();
		ctx.ellipse(x, y, 130, 62, 0, 0, TAU);
		ctx.fill();
		// A shaft of light up out of the hole
		ctx.fillStyle = `rgba(255, 150, 60, ${0.18 * wake * pulse})`;
		ctx.beginPath();
		ctx.moveTo(x - 40, y);
		ctx.lineTo(x - 70, y - 500);
		ctx.lineTo(x + 70, y - 500);
		ctx.lineTo(x + 40, y);
		ctx.closePath();
		ctx.fill();
	}
	// Heaved-up slabs of road round the rim
	const r = seeded(4471);
	for (let i = 0; i < 14; i++) {
		const a = (i / 14) * TAU + r() * 0.3;
		const sx = x + Math.cos(a) * (140 + r() * 20);
		const sy = y + Math.sin(a) * (64 + r() * 10);
		const w = 30 + r() * 26;
		ctx.save();
		ctx.translate(sx, sy);
		ctx.rotate(a + Math.PI / 2 + (r() - 0.5) * 0.6);
		ctx.fillStyle = '#2b2c30';
		ctx.strokeStyle = '#0a0a0b';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(-w / 2, 4);
		ctx.lineTo(-w / 2 + 4, -10 - r() * 8);
		ctx.lineTo(w / 2 - 3, -8 - r() * 8);
		ctx.lineTo(w / 2, 4);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
		ctx.restore();
	}
	// Gorilla City work lights on stands
	for (const [lx, ly] of [
		[x - 170, y - 40],
		[x + 175, y - 30]
	]) {
		ctx.strokeStyle = '#3b3f46';
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.moveTo(lx, ly);
		ctx.lineTo(lx, ly - 70);
		ctx.stroke();
		ctx.fillStyle = '#ffb020';
		ctx.shadowColor = '#ffb020';
		ctx.shadowBlur = 14;
		ctx.fillRect(lx - 7, ly - 76, 14, 7);
		ctx.shadowBlur = 0;
	}
	ctx.restore();
}
