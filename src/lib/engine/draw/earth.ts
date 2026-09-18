// Earth, for story scenes: Detroit at night, from the roof of a building
// going up, where John Stewart works. Drawn on a fixed stage EARTH_W x
// EARTH_H; the scene scales it to the screen.

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
	ctx.strokeStyle = 'rgba(234, 255, 240, 0.08)';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(0, ROOF + 0.5);
	ctx.lineTo(EARTH_W, ROOF + 0.5);
	ctx.stroke();

	// The ring's light washing over everything as it arrives
	if (glow > 0) {
		ctx.fillStyle = `rgba(61, 255, 110, ${0.12 * glow})`;
		ctx.fillRect(0, 0, EARTH_W, EARTH_H + 400);
	}
}
