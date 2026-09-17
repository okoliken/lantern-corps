// Draws the world around the Lanterns: backgrounds and obstacles.
//
// Obstacles use the same trick as the characters: the world is seen from
// above, but things have visible height. An obstacle's rectangle is its
// footprint on the ground; we draw its ROOF lifted up by `height`, and a
// FRONT FACE filling the gap. That gives a simple 3/4 look.

import type { Obstacle } from '../map';
import { GREEN } from './lantern';

/** The part of the world currently on screen, in world coordinates. */
export interface WorldRect {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

// ---------------------------------------------------------------- space

interface Star {
	x: number; // 0..1 within a repeating tile
	y: number;
	size: number;
	twinkle: number;
}

/** Star tile size in screen px. Stars repeat every tile, so there's no edge to fly off. */
const STAR_TILE = 1200;

export function makeStars(count: number, rand: () => number): Star[] {
	return Array.from({ length: count }, () => ({
		x: rand(),
		y: rand(),
		size: rand() * 1.6 + 0.3,
		twinkle: rand() * Math.PI * 2
	}));
}

/**
 * Stars drawn in SCREEN space with parallax: far layers move slower than
 * the camera, which makes space feel deep.
 */
export function drawStarfield(
	ctx: CanvasRenderingContext2D,
	layers: { stars: Star[]; parallax: number }[],
	camX: number,
	camY: number,
	width: number,
	height: number,
	time: number
) {
	ctx.fillStyle = '#03060a';
	ctx.fillRect(0, 0, width, height);
	ctx.fillStyle = '#e8fff0';

	for (const { stars, parallax } of layers) {
		const offX = mod(camX * parallax, STAR_TILE);
		const offY = mod(camY * parallax, STAR_TILE);
		for (const s of stars) {
			const glow = 0.5 + 0.5 * Math.sin(time * 2 + s.twinkle);
			ctx.globalAlpha = (0.3 + glow * 0.7) * (0.4 + parallax * 1.5);
			// Draw the star in every tile copy that lands on screen
			for (let tx = s.x * STAR_TILE - offX; tx < width; tx += STAR_TILE) {
				for (let ty = s.y * STAR_TILE - offY; ty < height; ty += STAR_TILE) {
					if (tx >= -2 && ty >= -2) ctx.fillRect(tx, ty, s.size, s.size);
				}
			}
		}
	}
	ctx.globalAlpha = 1;
}

/** A giant faint Corps emblem painted into space at a world position. */
export function drawEmblem(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, opacity: number, time: number) {
	const pulse = 0.75 + 0.25 * Math.sin(time * 3);
	ctx.save();
	ctx.strokeStyle = GREEN;
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 30 * pulse;
	ctx.globalAlpha = pulse * opacity;

	ctx.lineWidth = r * 0.14;
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI * 2);
	ctx.stroke();

	const barW = r * 1.9;
	const barGap = r * 0.42;
	ctx.lineWidth = r * 0.16;
	ctx.beginPath();
	ctx.moveTo(x - barW / 2, y - barGap);
	ctx.lineTo(x + barW / 2, y - barGap);
	ctx.moveTo(x - barW / 2, y + barGap);
	ctx.lineTo(x + barW / 2, y + barGap);
	ctx.stroke();

	ctx.lineWidth = r * 0.12;
	ctx.beginPath();
	ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
	ctx.stroke();
	ctx.restore();
}

// --------------------------------------------------------------- planet

const GROUND_TILE = 64;

/**
 * Dusty ground, drawn only for the visible area. Pebbles come from a hash
 * of each tile's position, so they stay put as the camera moves without
 * storing thousands of them.
 */
export function drawPlanetGround(ctx: CanvasRenderingContext2D, visible: WorldRect, mapW: number, mapH: number) {
	// Outside the map: dark void
	ctx.fillStyle = '#15150f';
	ctx.fillRect(visible.left, visible.top, visible.right - visible.left, visible.bottom - visible.top);

	ctx.fillStyle = '#3b3a2e';
	ctx.fillRect(0, 0, mapW, mapH);

	const c0 = Math.max(0, Math.floor(visible.left / GROUND_TILE));
	const r0 = Math.max(0, Math.floor(visible.top / GROUND_TILE));
	const c1 = Math.min(Math.ceil(mapW / GROUND_TILE), Math.ceil(visible.right / GROUND_TILE));
	const r1 = Math.min(Math.ceil(mapH / GROUND_TILE), Math.ceil(visible.bottom / GROUND_TILE));

	for (let c = c0; c < c1; c++) {
		for (let r = r0; r < r1; r++) {
			const h = hash(c, r);
			for (let i = 0; i < 3; i++) {
				const hx = hash(h, i);
				const px = c * GROUND_TILE + (hx % GROUND_TILE);
				const py = r * GROUND_TILE + ((hx >>> 8) % GROUND_TILE);
				if (px > mapW || py > mapH) continue;
				const size = 1 + ((hx >>> 16) % 4);
				ctx.fillStyle = hx & 1 ? 'rgba(20, 18, 12, 0.35)' : 'rgba(120, 112, 88, 0.3)';
				ctx.beginPath();
				ctx.ellipse(px, py, size, size * 0.6, 0, 0, Math.PI * 2);
				ctx.fill();
			}
		}
	}

	// Map edge
	ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
	ctx.lineWidth = 6;
	ctx.strokeRect(0, 0, mapW, mapH);
}

// ------------------------------------------------------------ obstacles

export function drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle) {
	switch (o.kind) {
		case 'building':
			return drawBlock(ctx, o, '#6a6d74', '#3d4047', true);
		case 'crate':
			return drawCrate(ctx, o);
		case 'rock':
			return drawRock(ctx, o);
		case 'asteroid':
			return drawAsteroid(ctx, o);
	}
}

/** Soft shadow on the ground in front of a tall thing. */
function groundShadow(ctx: CanvasRenderingContext2D, o: Obstacle) {
	ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
	ctx.fillRect(o.x + 4, o.y + o.h - 2, o.w, 8);
}

function drawBlock(ctx: CanvasRenderingContext2D, o: Obstacle, roof: string, front: string, windows: boolean) {
	const { x, y, w, h, height } = o;
	groundShadow(ctx, o);

	// Front face: from the roof's bottom edge down to the footprint's bottom edge
	ctx.fillStyle = front;
	ctx.fillRect(x, y + h - height, w, height);

	if (windows) {
		// A grid of windows; the seed decides which are lit
		const rows = Math.max(1, Math.floor((height - 14) / 22));
		const cols = Math.max(1, Math.floor((w - 12) / 22));
		let n = Math.floor(o.seed * 1e6);
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				n = hash(n, r * 31 + c);
				ctx.fillStyle = n % 5 === 0 ? 'rgba(232, 200, 106, 0.75)' : 'rgba(18, 22, 28, 0.8)';
				ctx.fillRect(x + 10 + c * 22, y + h - height + 10 + r * 22, 12, 13);
			}
		}
	}

	// Roof: the footprint, lifted up by the building's height
	ctx.fillStyle = roof;
	ctx.fillRect(x, y - height, w, h);
	ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
	ctx.lineWidth = 2;
	ctx.strokeRect(x + 1, y - height + 1, w - 2, h - 2);
	// Rooftop details: an AC unit or two
	ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
	ctx.fillRect(x + w * (0.2 + o.seed * 0.3), y - height + h * 0.3, 22, 16);
	ctx.fillRect(x + w * 0.65, y - height + h * (0.5 + o.seed * 0.2), 16, 12);
}

function drawCrate(ctx: CanvasRenderingContext2D, o: Obstacle) {
	const { x, y, w, h, height } = o;
	groundShadow(ctx, o);
	ctx.fillStyle = '#5e4424';
	ctx.fillRect(x, y + h - height, w, height);
	ctx.fillStyle = '#8a6636';
	ctx.fillRect(x, y - height, w, h);
	// Planks
	ctx.strokeStyle = 'rgba(40, 26, 10, 0.6)';
	ctx.lineWidth = 2;
	ctx.strokeRect(x + 1, y - height + 1, w - 2, h - 2);
	ctx.beginPath();
	ctx.moveTo(x + 2, y + h - height + 2);
	ctx.lineTo(x + w - 2, y + h - 2);
	ctx.moveTo(x + w - 2, y + h - height + 2);
	ctx.lineTo(x + 2, y + h - 2);
	ctx.stroke();
}

function drawRock(ctx: CanvasRenderingContext2D, o: Obstacle) {
	const cx = o.x + o.w / 2;
	const baseY = o.y + o.h / 2;
	const rx = o.w / 2;
	const ry = o.h / 2;
	ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
	ctx.beginPath();
	ctx.ellipse(cx + 3, baseY + 3, rx, ry, 0, 0, Math.PI * 2);
	ctx.fill();
	// Side (darker), then top (lighter) raised by the rock's height
	ctx.fillStyle = '#4a4436';
	blob(ctx, cx, baseY - o.height * 0.4, rx, ry + o.height * 0.4, o.seed);
	ctx.fillStyle = '#6d6553';
	blob(ctx, cx, baseY - o.height, rx * 0.9, ry * 0.9, o.seed);
}

function drawAsteroid(ctx: CanvasRenderingContext2D, o: Obstacle) {
	const cx = o.x + o.w / 2;
	const cy = o.y + o.h / 2 - o.height * 0.5;
	const r = o.w / 2;
	// Body
	ctx.fillStyle = '#3a3531';
	blob(ctx, cx, cy + o.height * 0.25, r, r * 0.8, o.seed);
	ctx.fillStyle = '#56504a';
	blob(ctx, cx, cy, r * 0.94, r * 0.72, o.seed);
	// Craters
	const rand = mini(o.seed);
	for (let i = 0; i < 4; i++) {
		const a = rand() * Math.PI * 2;
		const d = rand() * r * 0.5;
		const cr = r * (0.08 + rand() * 0.12);
		ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
		ctx.beginPath();
		ctx.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7, cr, cr * 0.7, 0, 0, Math.PI * 2);
		ctx.fill();
	}
	// Faint rim light from a distant star
	ctx.strokeStyle = 'rgba(200, 220, 255, 0.12)';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.ellipse(cx, cy, r * 0.9, r * 0.68, 0, Math.PI * 1.05, Math.PI * 1.6);
	ctx.stroke();
}

/** A lumpy ellipse; the seed makes each lump pattern unique. */
function blob(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, seed: number) {
	const rand = mini(seed);
	const points = 11;
	ctx.beginPath();
	for (let i = 0; i <= points; i++) {
		const a = (i / points) * Math.PI * 2;
		const k = i === points ? 1 : 0.85 + rand() * 0.25;
		const px = cx + Math.cos(a) * rx * (i === points ? 1 : k);
		const py = cy + Math.sin(a) * ry * (i === points ? 1 : k);
		if (i === 0) ctx.moveTo(px, py);
		else ctx.lineTo(px, py);
	}
	ctx.closePath();
	ctx.fill();
}

// ---------------------------------------------------------------- utils

function mod(a: number, n: number) {
	return ((a % n) + n) % n;
}

/** Cheap integer hash: turns two numbers into a well-mixed unsigned int. */
function hash(a: number, b: number): number {
	let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	return (h ^ (h >>> 16)) >>> 0;
}

/** Tiny deterministic random sequence from a 0..1 seed. */
function mini(seed: number) {
	let s = Math.floor(seed * 2 ** 31) | 1;
	return () => {
		s = hash(s, 0x9e3779b9);
		return s / 4294967296;
	};
}
