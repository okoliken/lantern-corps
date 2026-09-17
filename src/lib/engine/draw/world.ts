// Draws the world around the Lanterns: backgrounds and obstacles.
//
// Obstacles use the same trick as the characters: the world is seen from
// above, but things have visible height. An obstacle's rectangle is its
// footprint on the ground; we draw its ROOF lifted up by `height`, and a
// FRONT FACE filling the gap. That gives a simple 3/4 look.

import type { Obstacle } from '../map';

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

export function drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle, time = 0, space = false) {
	switch (o.kind) {
		case 'building':
			return drawBlock(ctx, o, '#6a6d74', '#3d4047', true);
		case 'crate':
			return drawCrate(ctx, o);
		case 'rock':
			return drawRock(ctx, o);
		case 'asteroid':
			return drawAsteroid(ctx, o);
		case 'wall':
			return space ? drawForceField(ctx, o, time) : drawEnergyWall(ctx, o, time);
	}
}

/**
 * The Energy Wall's SPACE form: a Force Field. There's no ground to stand on,
 * so it's a floating sheet of energy stretched between two glowing emitter
 * nodes, rippling. It blocks exactly like the wall.
 */
function drawForceField(ctx: CanvasRenderingContext2D, o: Obstacle, time: number) {
	const health = o.hp !== undefined && o.maxHp ? o.hp / o.maxHp : 1;
	const age = (o.maxLife ?? 0) - (o.life ?? 0);
	const grow = Math.min(1, age / 0.25);
	const fading = (o.life ?? 99) < 2;
	const flicker = fading && Math.sin(time * 30) > 0 ? 0.35 : 1;
	const bob = Math.sin(time * 2 + o.seed * 10) * 2;

	// The sheet runs along the footprint's long side, floating above it.
	// Running left-right it's seen face-on (a wide panel). Running up-down the
	// screen it's seen edge-on, so it's drawn as a narrower panel tilted in depth.
	const across = o.h > o.w;
	const cx = o.x + o.w / 2;
	const cy = o.y + o.h / 2 - 30 + bob;
	const tall = 44;
	const steps = 10;
	const sheet = new Path2D();
	let ends: [number, number][];

	if (!across) {
		const half = (o.w / 2) * grow;
		const [ax, bx] = [cx - half, cx + half];
		ends = [
			[ax, cy],
			[bx, cy]
		];
		sheet.moveTo(ax, cy - tall / 2);
		// Rippling top and bottom edges
		for (let i = 1; i <= steps; i++) {
			const k = i / steps;
			sheet.lineTo(ax + (bx - ax) * k, cy - tall / 2 + Math.sin(k * Math.PI * 3 - time * 6) * 2.5);
		}
		for (let i = steps; i >= 0; i--) {
			const k = i / steps;
			sheet.lineTo(ax + (bx - ax) * k, cy + tall / 2 + Math.sin(k * Math.PI * 3 - time * 6 + 1) * 2.5);
		}
	} else {
		const half = (o.h / 2) * grow;
		const depth = 14; // how wide the edge-on panel looks
		const [ay, by] = [cy - half * 0.6, cy + half * 0.6];
		ends = [
			[cx - depth, ay],
			[cx + depth, by]
		];
		// A parallelogram leaning back into the screen, rippling along its long edges
		sheet.moveTo(cx - depth, ay - tall / 2);
		for (let i = 1; i <= steps; i++) {
			const k = i / steps;
			sheet.lineTo(cx - depth + 2 * depth * k + Math.sin(k * Math.PI * 3 - time * 6) * 2, ay + (by - ay) * k - tall / 2);
		}
		for (let i = steps; i >= 0; i--) {
			const k = i / steps;
			sheet.lineTo(cx - depth + 2 * depth * k + Math.sin(k * Math.PI * 3 - time * 6 + 1) * 2, ay + (by - ay) * k + tall / 2);
		}
	}
	sheet.closePath();

	ctx.save();
	ctx.globalAlpha = flicker;

	ctx.fillStyle = `rgba(61, 255, 110, ${0.12 + 0.14 * health})`;
	ctx.fill(sheet);

	// Hex lattice inside the sheet
	ctx.save();
	ctx.clip(sheet);
	ctx.strokeStyle = `rgba(234, 255, 240, ${0.15 + 0.15 * health})`;
	ctx.lineWidth = 1;
	const hex = 7;
	const minX = Math.min(ends[0][0], ends[1][0]) - tall;
	const maxX = Math.max(ends[0][0], ends[1][0]) + tall;
	const minY = Math.min(ends[0][1], ends[1][1]) - tall;
	const maxY = Math.max(ends[0][1], ends[1][1]) + tall;
	for (let hx = minX; hx < maxX; hx += hex * 1.5) {
		const col = Math.round((hx - minX) / (hex * 1.5));
		for (let hy = minY; hy < maxY; hy += hex * 1.732) {
			const yy = hy + (col % 2 ? hex * 0.866 : 0);
			ctx.beginPath();
			for (let k = 0; k < 6; k++) {
				const a = (k / 6) * Math.PI * 2;
				ctx.lineTo(hx + Math.cos(a) * hex * 0.9, yy + Math.sin(a) * hex * 0.9);
			}
			ctx.closePath();
			ctx.stroke();
		}
	}
	ctx.restore();

	ctx.shadowColor = '#3dff6e';
	ctx.shadowBlur = 14;
	ctx.strokeStyle = '#3dff6e';
	ctx.lineWidth = 2;
	ctx.stroke(sheet);

	// Emitter nodes at both ends
	for (const [nx, ny] of ends) {
		ctx.fillStyle = '#eafff0';
		ctx.beginPath();
		ctx.arc(nx, ny - tall / 2, 3.5, 0, Math.PI * 2);
		ctx.arc(nx, ny + tall / 2, 3.5, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.restore();
}

/**
 * An Energy Wall construct: a glassy green slab with a hex lattice, bright
 * top rail, and a shimmer. It grows up out of the ground when placed,
 * cracks as it takes damage, and flickers just before it fades.
 */
function drawEnergyWall(ctx: CanvasRenderingContext2D, o: Obstacle, time: number) {
	const { x, y, w, h } = o;
	const health = o.hp !== undefined && o.maxHp ? o.hp / o.maxHp : 1;
	const age = (o.maxLife ?? 0) - (o.life ?? 0);
	const grow = Math.min(1, age / 0.25);
	const height = o.height * (1 - (1 - grow) ** 3);
	const fading = (o.life ?? 99) < 2;
	const flicker = fading && Math.sin(time * 30) > 0 ? 0.35 : 1;

	const faceTop = y + h - height;
	ctx.save();
	ctx.globalAlpha = flicker;

	// Glow on the ground where it stands
	ctx.fillStyle = 'rgba(61, 255, 110, 0.18)';
	ctx.beginPath();
	ctx.ellipse(x + w / 2, y + h, w / 2 + 10, 8, 0, 0, Math.PI * 2);
	ctx.fill();

	// Front face and roof as one shape
	const slab = new Path2D();
	slab.rect(x, faceTop, w, height);
	slab.rect(x, y - height, w, h);

	ctx.fillStyle = `rgba(61, 255, 110, ${0.16 + 0.12 * health})`;
	ctx.fill(slab);

	// Hex lattice + shimmer, clipped inside
	ctx.save();
	ctx.clip(slab);
	ctx.strokeStyle = `rgba(234, 255, 240, ${0.18 + 0.12 * health})`;
	ctx.lineWidth = 1;
	const r = 7;
	for (let hx = x - r; hx < x + w + r; hx += r * 1.5) {
		const col = Math.round((hx - x) / (r * 1.5));
		for (let hy = y - height - r; hy < y + h + r; hy += r * 1.732) {
			const cy = hy + (col % 2 ? r * 0.866 : 0);
			ctx.beginPath();
			for (let k = 0; k < 6; k++) {
				const a = (k / 6) * Math.PI * 2;
				ctx.lineTo(hx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9);
			}
			ctx.closePath();
			ctx.stroke();
		}
	}
	const sweep = y + h - ((time * 60) % (height + h + 40));
	const band = ctx.createLinearGradient(0, sweep - 14, 0, sweep + 14);
	band.addColorStop(0, 'rgba(234, 255, 240, 0)');
	band.addColorStop(0.5, 'rgba(234, 255, 240, 0.35)');
	band.addColorStop(1, 'rgba(234, 255, 240, 0)');
	ctx.fillStyle = band;
	ctx.fillRect(x, y - height, w, height + h);
	ctx.restore();

	// Edges: glowing outline, brighter top rail
	ctx.shadowColor = '#3dff6e';
	ctx.shadowBlur = 14;
	ctx.strokeStyle = '#3dff6e';
	ctx.lineWidth = 2;
	ctx.stroke(slab);
	ctx.strokeStyle = '#eafff0';
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.moveTo(x, y - height);
	ctx.lineTo(x + w, y - height);
	ctx.stroke();
	ctx.shadowBlur = 0;

	// Cracks once it's taken real damage
	if (health < 0.6) {
		ctx.strokeStyle = 'rgba(3, 6, 10, 0.55)';
		ctx.lineWidth = 1.5;
		const cracks = health < 0.3 ? 3 : 1;
		for (let i = 0; i < cracks; i++) {
			const sx = x + w * (0.25 + 0.25 * i + o.seed * 0.1);
			ctx.beginPath();
			ctx.moveTo(sx, faceTop + 3);
			ctx.lineTo(sx + 5, faceTop + height * 0.35);
			ctx.lineTo(sx - 3, faceTop + height * 0.6);
			ctx.lineTo(sx + 4, y + h - 3);
			ctx.stroke();
		}
	}
	ctx.restore();
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
