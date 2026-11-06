// The places season two's story scenes happen, seen side-on on the fixed
// story stage (STAGE_W x STAGE_H, the ground at STAGE_GROUND): the
// Watchtower's deck, the sky over Vesk, the Coast City docks, a Gotham roof,
// the rift into Qward, Central City by day and by night, the Ferris Air
// field, and Sinestro's citadel on Korugar.

import { drawLampPost } from './earth';
import { drawLifter } from './dock';
import { drawEarthWindow } from './watchtower';
import { drawGreatLantern } from '../missions/sinestroFinale';
import { drawStatue } from '../missions/korugar';
import { green } from '../../theme';

export const STAGE_W = 1400;
export const STAGE_H = 784;
/** Where everyone's feet are, in every place with a floor. */
export const STAGE_GROUND = 610;

const TAU = Math.PI * 2;
/** Floors run on under the stage so a tall screen never shows a gap. */
const UNDER = 400;

function seeded(seed: number) {
	let s = seed;
	return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function stars(seed: number, count: number, height: number) {
	const r = seeded(seed);
	return Array.from({ length: count }, () => [r() * STAGE_W, r() * height, r() * 1.4 + 0.3, r() * TAU]);
}

function drawStars(ctx: CanvasRenderingContext2D, list: number[][], time: number, color = '230, 236, 255') {
	for (const [x, y, size, phase] of list) {
		ctx.fillStyle = `rgba(${color}, ${0.3 + 0.3 * Math.sin(time * 1.4 + phase)})`;
		ctx.fillRect(x, y, size, size);
	}
}

/** Skyline blocks, [x, width, height, seed], laid out once per place. */
function skyline(seed: number, from: number, to: number, minW: number, maxW: number, minH: number, maxH: number, gap: number) {
	const r = seeded(seed);
	const out: number[][] = [];
	let x = from;
	while (x < to) {
		const w = minW + r() * (maxW - minW);
		out.push([x, w, minH + r() * (maxH - minH), r()]);
		x += w + gap * r();
	}
	return out;
}

function drawWindows(ctx: CanvasRenderingContext2D, x: number, top: number, w: number, base: number, seed: number, color: string, share: number) {
	const r = seeded(Math.floor(seed * 1e6) + 3);
	ctx.fillStyle = color;
	for (let wy = top + 12; wy < base - 10; wy += 16) for (let wx = x + 8; wx < x + w - 8; wx += 14) if (r() < share) ctx.fillRect(wx, wy, 5, 7);
}

// ------------------------------------------------------------ the Watchtower

/** The training deck: Earth through the great window, steel ribs, and the deck plating. */
export function drawWatchtowerDeck(ctx: CanvasRenderingContext2D, time: number, alarm = 0) {
	ctx.fillStyle = '#0c1018';
	ctx.fillRect(0, 0, STAGE_W, STAGE_GROUND);
	drawEarthWindow(ctx, 90, 40, STAGE_W - 180, 400, time);
	// The frame: mullions across the glass and a heavy sill under it
	ctx.fillStyle = '#1b2230';
	ctx.strokeStyle = '#05070b';
	ctx.lineWidth = 4;
	for (const x of [90, 380, 700, 1020, STAGE_W - 110]) {
		ctx.fillRect(x - 10, 30, 20, 430);
		ctx.strokeRect(x - 10, 30, 20, 430);
	}
	ctx.fillRect(60, 20, STAGE_W - 120, 24);
	ctx.fillRect(60, 440, STAGE_W - 120, 40);
	ctx.strokeRect(60, 440, STAGE_W - 120, 40);
	// Wall under the sill, with a strip of running lights
	const wall = ctx.createLinearGradient(0, 480, 0, STAGE_GROUND);
	wall.addColorStop(0, '#232b3a');
	wall.addColorStop(1, '#151a24');
	ctx.fillStyle = wall;
	ctx.fillRect(0, 480, STAGE_W, STAGE_GROUND - 480);
	for (let x = 40; x < STAGE_W; x += 70) {
		const on = 0.4 + 0.4 * Math.sin(time * 2 - x * 0.01);
		ctx.fillStyle = alarm > 0 ? `rgba(255, ${Math.round(200 - alarm * 140)}, 60, ${on})` : `rgba(120, 190, 255, ${on})`;
		ctx.fillRect(x, 520, 30, 4);
	}
	// The deck: plating with seams, lit from the window
	const floor = ctx.createLinearGradient(0, STAGE_GROUND, 0, STAGE_H);
	floor.addColorStop(0, '#3a4252');
	floor.addColorStop(1, '#1c212b');
	ctx.fillStyle = floor;
	ctx.fillRect(0, STAGE_GROUND, STAGE_W, STAGE_H - STAGE_GROUND + UNDER);
	ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
	ctx.lineWidth = 2;
	for (let i = -10; i <= 10; i++) {
		ctx.beginPath();
		ctx.moveTo(STAGE_W / 2 + i * 70, STAGE_GROUND);
		ctx.lineTo(STAGE_W / 2 + i * 260, STAGE_H + UNDER);
		ctx.stroke();
	}
	ctx.strokeStyle = 'rgba(160, 200, 255, 0.25)';
	ctx.beginPath();
	ctx.moveTo(0, STAGE_GROUND + 0.5);
	ctx.lineTo(STAGE_W, STAGE_GROUND + 0.5);
	ctx.stroke();
	if (alarm > 0) {
		ctx.fillStyle = `rgba(255, 200, 40, ${0.08 * alarm * (0.6 + 0.4 * Math.sin(time * 5))})`;
		ctx.fillRect(0, 0, STAGE_W, STAGE_H + UNDER);
	}
}

/** A teleport beam setting someone down: a column of white light, fading by `k` 0..1. */
export function drawTeleport(ctx: CanvasRenderingContext2D, x: number, ground: number, k: number) {
	if (k <= 0 || k >= 1) return;
	const a = Math.sin(k * Math.PI);
	ctx.save();
	const beam = ctx.createLinearGradient(x - 50, 0, x + 50, 0);
	beam.addColorStop(0, 'rgba(200, 230, 255, 0)');
	beam.addColorStop(0.5, `rgba(230, 245, 255, ${0.85 * a})`);
	beam.addColorStop(1, 'rgba(200, 230, 255, 0)');
	ctx.fillStyle = beam;
	ctx.fillRect(x - 50, ground - 260, 100, 270);
	ctx.strokeStyle = `rgba(255, 255, 255, ${a})`;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.ellipse(x, ground, 46, 9, 0, 0, TAU);
	ctx.stroke();
	ctx.restore();
}

// ------------------------------------------------------------ space, over a world

const SPACE_STARS = stars(1414, 160, STAGE_H);

/**
 * Open space with a world below filling the bottom of the stage: Vesk's
 * green farm belts, with a smudge of smoke where raiders are burning it.
 */
export function drawSpaceOverVesk(ctx: CanvasRenderingContext2D, time: number, smoke: number) {
	ctx.fillStyle = '#03050a';
	ctx.fillRect(0, 0, STAGE_W, STAGE_H + UNDER);
	drawStars(ctx, SPACE_STARS, time);
	const r = 1500;
	const cx = STAGE_W * 0.55;
	const cy = STAGE_H + r - 260;
	ctx.save();
	// Atmosphere glow on the limb
	const air = ctx.createRadialGradient(cx, cy, r - 10, cx, cy, r + 70);
	air.addColorStop(0, 'rgba(140, 220, 160, 0.45)');
	air.addColorStop(1, 'rgba(140, 220, 160, 0)');
	ctx.fillStyle = air;
	ctx.beginPath();
	ctx.arc(cx, cy, r + 70, 0, TAU);
	ctx.fill();
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, TAU);
	ctx.clip();
	const land = ctx.createLinearGradient(0, cy - r, 0, cy - r + 400);
	land.addColorStop(0, '#5f8f55');
	land.addColorStop(1, '#2f4a2c');
	ctx.fillStyle = land;
	ctx.fillRect(0, cy - r, STAGE_W, 600);
	// Field belts and cloud bands, curving with the world
	for (let i = 0; i < 9; i++) {
		ctx.strokeStyle = i % 2 ? 'rgba(220, 200, 110, 0.25)' : 'rgba(40, 70, 40, 0.35)';
		ctx.lineWidth = 16;
		ctx.beginPath();
		ctx.arc(cx, cy, r - 30 - i * 34, Math.PI * 1.1, Math.PI * 1.9);
		ctx.stroke();
	}
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
	ctx.lineWidth = 10;
	for (let i = 0; i < 3; i++) {
		ctx.beginPath();
		ctx.arc(cx + 60 * Math.sin(time * 0.05 + i), cy, r - 70 - i * 90, Math.PI * (1.2 + i * 0.1), Math.PI * (1.45 + i * 0.12));
		ctx.stroke();
	}
	// Smoke over the colony, and the red pricks of raider fire under it
	if (smoke > 0) {
		for (let i = 0; i < 7; i++) {
			ctx.fillStyle = `rgba(30, 26, 26, ${0.35 * smoke})`;
			ctx.beginPath();
			ctx.ellipse(880 + i * 26 + Math.sin(time + i) * 8, STAGE_H - 170 - i * 6, 50 - i * 3, 16, -0.1, 0, TAU);
			ctx.fill();
		}
		for (let i = 0; i < 5; i++) {
			ctx.fillStyle = `rgba(255, 70, 40, ${(0.4 + 0.4 * Math.sin(time * 6 + i * 2)) * smoke})`;
			ctx.fillRect(870 + i * 34, STAGE_H - 165 + (i % 2) * 8, 4, 4);
		}
	}
	ctx.restore();
}

// ------------------------------------------------------------ Coast City docks

const COAST_SKYLINE = skyline(1959, 640, STAGE_W + 40, 40, 90, 80, 230, 12);

/** The harbour at sunset: the city across the water, the pier, and the dead crane with its load hanging. */
export function drawCoastHarbour(ctx: CanvasRenderingContext2D, time: number, strain: number) {
	const sky = ctx.createLinearGradient(0, 0, 0, 470);
	sky.addColorStop(0, '#2b1f45');
	sky.addColorStop(0.6, '#c2553a');
	sky.addColorStop(1, '#f2a35a');
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, STAGE_W, 470);
	ctx.fillStyle = 'rgba(255, 220, 150, 0.9)';
	ctx.beginPath();
	ctx.arc(300, 440, 60, Math.PI, TAU);
	ctx.fill();
	for (const [x, w, h, seed] of COAST_SKYLINE) {
		ctx.fillStyle = '#3a2340';
		ctx.fillRect(x, 470 - h, w, h);
		drawWindows(ctx, x, 470 - h, w, 470, seed, 'rgba(255, 210, 140, 0.45)', 0.25);
	}
	// The water, sun on it
	const sea = ctx.createLinearGradient(0, 470, 0, STAGE_GROUND - 40);
	sea.addColorStop(0, '#5b3a52');
	sea.addColorStop(1, '#1c2a3e');
	ctx.fillStyle = sea;
	ctx.fillRect(0, 470, STAGE_W, STAGE_GROUND - 510);
	ctx.fillStyle = 'rgba(255, 190, 120, 0.35)';
	for (let i = 0; i < 8; i++) ctx.fillRect(250 + Math.sin(time * 1.5 + i) * 12 - i * 3, 478 + i * 10, 100 - i * 8, 3);
	// The pier
	ctx.fillStyle = '#4a4a4e';
	ctx.fillRect(0, STAGE_GROUND - 40, STAGE_W, STAGE_H - STAGE_GROUND + 40 + UNDER);
	ctx.fillStyle = '#d9b02a';
	for (let x = 0; x < STAGE_W; x += 60) ctx.fillRect(x, STAGE_GROUND - 34, 34, 5);
	ctx.fillStyle = '#2d2d31';
	ctx.fillRect(0, STAGE_GROUND + 60, STAGE_W, 3);
	ctx.save();
	ctx.translate(560, STAGE_GROUND - 10);
	ctx.scale(0.85, 0.85);
	drawLifter(ctx, 0, 0, strain, 0, time);
	ctx.restore();
}

// ------------------------------------------------------------ Gotham

const GOTHAM_FAR = skyline(1939, -30, STAGE_W + 40, 50, 110, 160, 360, 6);
const GOTHAM_RAIN = Array.from({ length: 140 }, (_, i) => [(i * 571) % STAGE_W, (i * 313) % STAGE_H, 0.7 + ((i * 7) % 5) / 10]);

/** A Gotham roof at night: gothic towers, the signal on the clouds, a gargoyle on the ledge. */
export function drawGothamRoof(ctx: CanvasRenderingContext2D, time: number, toxin: number) {
	const sky = ctx.createLinearGradient(0, 0, 0, STAGE_GROUND);
	sky.addColorStop(0, '#07080c');
	sky.addColorStop(0.7, '#1a1d26');
	sky.addColorStop(1, '#262632');
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, STAGE_W, STAGE_GROUND);
	// Low cloud, lit by the signal
	for (let i = 0; i < 6; i++) {
		ctx.fillStyle = 'rgba(70, 74, 90, 0.35)';
		ctx.beginPath();
		ctx.ellipse(((i * 290 + time * 6) % (STAGE_W + 400)) - 200, 110 + (i % 3) * 30, 240, 40, 0, 0, TAU);
		ctx.fill();
	}
	// The Bat-Signal: a beam up from the right and the disc on the cloud
	ctx.save();
	const beam = ctx.createLinearGradient(1300, STAGE_GROUND - 200, 950, 130);
	beam.addColorStop(0, 'rgba(255, 240, 180, 0.4)');
	beam.addColorStop(1, 'rgba(255, 240, 180, 0.1)');
	ctx.fillStyle = beam;
	ctx.beginPath();
	ctx.moveTo(1290, STAGE_GROUND - 220);
	ctx.lineTo(1310, STAGE_GROUND - 210);
	ctx.lineTo(1040, 150);
	ctx.lineTo(880, 120);
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = 'rgba(255, 240, 180, 0.5)';
	ctx.beginPath();
	ctx.ellipse(960, 130, 90, 50, -0.2, 0, TAU);
	ctx.fill();
	ctx.fillStyle = '#121218';
	ctx.translate(960, 130);
	ctx.rotate(-0.2);
	ctx.beginPath();
	ctx.moveTo(-62, -4);
	ctx.quadraticCurveTo(-40, -22, -16, -10);
	ctx.lineTo(-8, -22);
	ctx.lineTo(-3, -12);
	ctx.lineTo(3, -12);
	ctx.lineTo(8, -22);
	ctx.lineTo(16, -10);
	ctx.quadraticCurveTo(40, -22, 62, -4);
	ctx.quadraticCurveTo(40, 0, 30, 14);
	ctx.quadraticCurveTo(14, 6, 0, 20);
	ctx.quadraticCurveTo(-14, 6, -30, 14);
	ctx.quadraticCurveTo(-40, 0, -62, -4);
	ctx.fill();
	ctx.restore();
	// Gothic towers: pointed tops and spires, a few lit windows
	for (const [x, w, h, seed] of GOTHAM_FAR) {
		const base = STAGE_GROUND - 60;
		ctx.fillStyle = '#121319';
		ctx.beginPath();
		ctx.moveTo(x, base);
		ctx.lineTo(x, base - h);
		ctx.lineTo(x + w * 0.2, base - h);
		ctx.lineTo(x + w * 0.5, base - h - 40 - seed * 50);
		ctx.lineTo(x + w * 0.8, base - h);
		ctx.lineTo(x + w, base - h);
		ctx.lineTo(x + w, base);
		ctx.closePath();
		ctx.fill();
		drawWindows(ctx, x, base - h, w, base, seed, 'rgba(255, 200, 110, 0.4)', 0.12);
	}
	// Fear toxin drifting up out of the streets
	if (toxin > 0) {
		for (let i = 0; i < 8; i++) {
			const k = (time * 0.05 + i / 8) % 1;
			ctx.fillStyle = `rgba(150, 190, 70, ${0.18 * toxin * (1 - k)})`;
			ctx.beginPath();
			ctx.ellipse(120 + i * 170, STAGE_GROUND - 40 - k * 260, 120, 40, 0, 0, TAU);
			ctx.fill();
		}
	}
	// The roof: tarred, with a stone ledge, the signal's housing on the right, a gargoyle on the left
	ctx.fillStyle = '#1b1c22';
	ctx.fillRect(0, STAGE_GROUND, STAGE_W, STAGE_H - STAGE_GROUND + UNDER);
	ctx.fillStyle = '#34343c';
	ctx.fillRect(0, STAGE_GROUND - 18, STAGE_W, 22);
	ctx.fillStyle = '#2a2a31';
	ctx.fillRect(1250, STAGE_GROUND - 210, 110, 210);
	ctx.fillStyle = '#4b4b55';
	ctx.beginPath();
	ctx.ellipse(1300, STAGE_GROUND - 210, 52, 22, -0.5, 0, TAU);
	ctx.fill();
	drawGargoyle(ctx, 170, STAGE_GROUND - 18);
}

function drawGargoyle(ctx: CanvasRenderingContext2D, x: number, y: number) {
	ctx.save();
	ctx.fillStyle = '#3c3c45';
	ctx.strokeStyle = '#0a0a0d';
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.moveTo(x - 50, y);
	ctx.lineTo(x - 40, y - 60);
	ctx.lineTo(x - 70, y - 120);
	ctx.lineTo(x - 30, y - 90);
	ctx.lineTo(x - 10, y - 120);
	ctx.quadraticCurveTo(x + 30, y - 140, x + 50, y - 110);
	ctx.lineTo(x + 70, y - 108);
	ctx.lineTo(x + 56, y - 92);
	ctx.quadraticCurveTo(x + 40, y - 60, x + 50, y);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#1a1a1f';
	ctx.beginPath();
	ctx.arc(x + 34, y - 112, 3, 0, TAU);
	ctx.fill();
	ctx.restore();
}

/** Rain in front of everything. */
export function drawRain(ctx: CanvasRenderingContext2D, time: number, slant = 0.25) {
	ctx.save();
	ctx.strokeStyle = 'rgba(170, 185, 210, 0.3)';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	for (const [x0, y0, speed] of GOTHAM_RAIN) {
		const y = (y0 + time * 900 * speed) % (STAGE_H + 60);
		const x = (x0 + y * slant) % STAGE_W;
		ctx.moveTo(x, y);
		ctx.lineTo(x - 22 * slant, y - 22);
	}
	ctx.stroke();
	ctx.restore();
}

// ------------------------------------------------------------ the rift into Qward

const RIFT_STARS = stars(666, 150, STAGE_H);

/** Deep space, torn: through the rift, Qward's sky, pale where ours is dark, with black lightning. */
export function drawQwardRift(ctx: CanvasRenderingContext2D, time: number) {
	ctx.fillStyle = '#04040a';
	ctx.fillRect(0, 0, STAGE_W, STAGE_H + UNDER);
	drawStars(ctx, RIFT_STARS, time);
	const cx = 1000;
	const cy = 330;
	ctx.save();
	// The tear: a jagged lens of light the wrong colour
	const edge = (k: number, side: number) => {
		const y = cy - 260 + k * 520;
		const w = Math.sin(k * Math.PI) * 170 + Math.sin(k * 23 + time * 2) * 10;
		return [cx + side * w + Math.sin(k * 9) * 30, y] as const;
	};
	ctx.beginPath();
	for (let i = 0; i <= 24; i++) ctx.lineTo(...edge(i / 24, -1));
	for (let i = 24; i >= 0; i--) ctx.lineTo(...edge(i / 24, 1));
	ctx.closePath();
	ctx.shadowColor = '#e8e3b0';
	ctx.shadowBlur = 40;
	const inside = ctx.createRadialGradient(cx, cy, 10, cx, cy, 260);
	inside.addColorStop(0, '#f6f1d0');
	inside.addColorStop(0.6, '#c9c08a');
	inside.addColorStop(1, '#6e6a45');
	ctx.fillStyle = inside;
	ctx.fill();
	ctx.shadowBlur = 0;
	ctx.clip();
	// Black stars and black lightning: the anti-matter universe inverts ours
	ctx.fillStyle = 'rgba(10, 10, 6, 0.7)';
	for (let i = 0; i < 40; i++) ctx.fillRect(cx - 200 + ((i * 97) % 400), cy - 260 + ((i * 53) % 520), 2, 2);
	ctx.strokeStyle = 'rgba(12, 12, 6, 0.8)';
	ctx.lineWidth = 3;
	const flash = Math.floor(time * 2.5);
	const r = seeded(flash * 31 + 7);
	ctx.beginPath();
	let x = cx - 80 + r() * 160;
	let y = cy - 260;
	ctx.moveTo(x, y);
	while (y < cy + 260) {
		x += (r() - 0.5) * 60;
		y += 30 + r() * 30;
		ctx.lineTo(x, y);
	}
	ctx.stroke();
	ctx.restore();
}

// ------------------------------------------------------------ Central City

const CENTRAL_SKYLINE = skyline(1956, -40, STAGE_W + 40, 70, 150, 150, 380, 14);

/**
 * Downtown Central City from street level. By day, blue sky and glass; by
 * night (`night` 1), lit windows and a sky the colour of the street lights.
 */
export function drawCentralCity(ctx: CanvasRenderingContext2D, time: number, night: number) {
	const sky = ctx.createLinearGradient(0, 0, 0, STAGE_GROUND);
	sky.addColorStop(0, night ? '#0b0f1e' : '#5c9ad8');
	sky.addColorStop(1, night ? '#3a2f3e' : '#c9def0');
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, STAGE_W, STAGE_GROUND);
	if (!night) {
		for (let i = 0; i < 4; i++) {
			ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
			ctx.beginPath();
			ctx.ellipse(((i * 380 + time * 8) % (STAGE_W + 300)) - 150, 80 + i * 26, 110, 22, 0, 0, TAU);
			ctx.fill();
		}
	}
	for (const [x, w, h, seed] of CENTRAL_SKYLINE) {
		const base = STAGE_GROUND - 50;
		ctx.fillStyle = night ? '#141826' : seed > 0.5 ? '#7d8fa6' : '#9aa6b5';
		ctx.fillRect(x, base - h, w, h);
		if (night) drawWindows(ctx, x, base - h, w, base, seed, 'rgba(255, 220, 150, 0.7)', 0.3);
		else {
			// Glass bands catching the sky
			ctx.fillStyle = 'rgba(210, 235, 255, 0.35)';
			for (let yy = base - h + 10; yy < base - 8; yy += 18) ctx.fillRect(x + 6, yy, w - 12, 7);
		}
	}
	// Pavement, kerb and road
	ctx.fillStyle = night ? '#2a2a30' : '#8a8a8f';
	ctx.fillRect(0, STAGE_GROUND - 50, STAGE_W, 50);
	ctx.fillStyle = night ? '#1a1a1f' : '#4d4d53';
	ctx.fillRect(0, STAGE_GROUND, STAGE_W, STAGE_H - STAGE_GROUND + UNDER);
	ctx.fillStyle = night ? '#cfc9a8' : '#e9e3c2';
	for (let x = 20; x < STAGE_W; x += 120) ctx.fillRect(x, STAGE_GROUND + 80, 60, 6);
	for (const x of [160, 700, 1240]) drawLampPost(ctx, x, STAGE_GROUND - 6);
}

/** Gorilla City tech left on the street as bait: a crate with an amber light pulsing. */
export function drawGorillaCrate(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
	ctx.save();
	ctx.fillStyle = '#3d3427';
	ctx.strokeStyle = '#0d0b08';
	ctx.lineWidth = 3;
	ctx.fillRect(x - 46, y - 50, 92, 50);
	ctx.strokeRect(x - 46, y - 50, 92, 50);
	const p = 0.5 + 0.5 * Math.sin(time * 3);
	ctx.shadowColor = '#ffb020';
	ctx.shadowBlur = 16 * p;
	ctx.fillStyle = `rgba(255, 176, 32, ${0.5 + 0.5 * p})`;
	ctx.fillRect(x - 30, y - 38, 60, 8);
	ctx.restore();
}

/** The Sinestro Corps' ship hanging over the city, its hold open and a yellow beam under it. */
export function drawFearShip(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
	ctx.save();
	const beam = ctx.createLinearGradient(0, y, 0, STAGE_GROUND);
	beam.addColorStop(0, `rgba(255, 210, 58, ${0.5 + 0.1 * Math.sin(time * 4)})`);
	beam.addColorStop(1, 'rgba(255, 210, 58, 0)');
	ctx.fillStyle = beam;
	ctx.beginPath();
	ctx.moveTo(x - 30, y + 20);
	ctx.lineTo(x + 30, y + 20);
	ctx.lineTo(x + 120, STAGE_GROUND - 60);
	ctx.lineTo(x - 120, STAGE_GROUND - 60);
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = '#2a2414';
	ctx.strokeStyle = '#ffd23a';
	ctx.lineWidth = 3;
	ctx.shadowColor = '#ffd23a';
	ctx.shadowBlur = 20;
	ctx.beginPath();
	ctx.moveTo(x - 220, y);
	ctx.lineTo(x - 90, y - 50);
	ctx.lineTo(x + 90, y - 50);
	ctx.lineTo(x + 220, y);
	ctx.lineTo(x + 70, y + 26);
	ctx.lineTo(x - 70, y + 26);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.restore();
}

// ------------------------------------------------------------ Ferris Air

const DESERT_STARS = stars(1959, 180, 420);

/** The Ferris Air field at three in the morning: desert stars, a hangar with its doors open, a jet on the apron. */
export function drawFerrisAirfield(ctx: CanvasRenderingContext2D, time: number, call: number) {
	const sky = ctx.createLinearGradient(0, 0, 0, STAGE_GROUND);
	sky.addColorStop(0, '#04060f');
	sky.addColorStop(0.8, '#141a33');
	sky.addColorStop(1, '#2a2d44');
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, STAGE_W, STAGE_GROUND);
	drawStars(ctx, DESERT_STARS, time);
	// Mountains along the horizon
	ctx.fillStyle = '#0d0f1c';
	ctx.beginPath();
	ctx.moveTo(0, STAGE_GROUND - 90);
	for (let x = 0; x <= STAGE_W; x += 70) ctx.lineTo(x, STAGE_GROUND - 90 - Math.abs(Math.sin(x * 0.013)) * 70 - (x % 140 ? 0 : 20));
	ctx.lineTo(STAGE_W, STAGE_GROUND);
	ctx.lineTo(0, STAGE_GROUND);
	ctx.fill();
	// The hangar: corrugated, doors open, the light inside spilling out
	const hx = 60;
	const hw = 520;
	const top = STAGE_GROUND - 300;
	ctx.fillStyle = '#2e3138';
	ctx.beginPath();
	ctx.moveTo(hx, STAGE_GROUND);
	ctx.lineTo(hx, top + 60);
	ctx.quadraticCurveTo(hx + hw / 2, top - 40, hx + hw, top + 60);
	ctx.lineTo(hx + hw, STAGE_GROUND);
	ctx.fill();
	ctx.fillStyle = '#e8d9a8';
	ctx.fillRect(hx + 60, top + 110, hw - 120, STAGE_GROUND - top - 110);
	ctx.fillStyle = 'rgba(232, 217, 168, 0.15)';
	ctx.beginPath();
	ctx.moveTo(hx + 60, STAGE_GROUND);
	ctx.lineTo(hx + hw - 60, STAGE_GROUND);
	ctx.lineTo(hx + hw + 120, STAGE_H);
	ctx.lineTo(hx - 60, STAGE_H);
	ctx.fill();
	ctx.fillStyle = '#c8333a';
	ctx.font = '900 34px system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.fillText('FERRIS AIR', hx + hw / 2, top + 80);
	// The apron
	ctx.fillStyle = '#26272c';
	ctx.fillRect(0, STAGE_GROUND, STAGE_W, STAGE_H - STAGE_GROUND + UNDER);
	for (let x = 640; x < STAGE_W; x += 90) {
		ctx.fillStyle = `rgba(120, 180, 255, ${0.5 + 0.4 * Math.sin(time * 3 - x * 0.02)})`;
		ctx.beginPath();
		ctx.arc(x, STAGE_GROUND + 14, 3, 0, TAU);
		ctx.fill();
	}
	drawJet(ctx, 1010, STAGE_GROUND - 6);
	// The ring's call: a green wash pulsing as it speaks
	if (call > 0) {
		ctx.fillStyle = green(0.06 * call * (0.6 + 0.4 * Math.sin(time * 4)));
		ctx.fillRect(0, 0, STAGE_W, STAGE_H + UNDER);
	}
}

/** A test jet, side-on, on its gear. */
function drawJet(ctx: CanvasRenderingContext2D, x: number, y: number) {
	ctx.save();
	ctx.translate(x, y);
	ctx.strokeStyle = '#0b0c10';
	ctx.lineWidth = 3;
	ctx.fillStyle = '#20232a';
	for (const gx of [-110, 70]) ctx.fillRect(gx, -44, 6, 40);
	ctx.fillStyle = '#9aa1ad';
	ctx.beginPath();
	ctx.moveTo(-230, -64);
	ctx.lineTo(-170, -82);
	ctx.lineTo(120, -86);
	ctx.quadraticCurveTo(220, -80, 250, -62);
	ctx.quadraticCurveTo(200, -48, 120, -46);
	ctx.lineTo(-170, -44);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	// Canopy, tail, wing
	ctx.fillStyle = '#2b4258';
	ctx.beginPath();
	ctx.ellipse(110, -86, 50, 13, 0, Math.PI, TAU);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#7c838f';
	ctx.beginPath();
	ctx.moveTo(-200, -80);
	ctx.lineTo(-240, -150);
	ctx.lineTo(-200, -150);
	ctx.lineTo(-140, -84);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(-60, -56);
	ctx.lineTo(40, -56);
	ctx.lineTo(-10, -20);
	ctx.lineTo(-90, -20);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.restore();
}

// ------------------------------------------------------------ Korugar

const KORUGAR_SPIRES = skyline(1417, -40, STAGE_W + 40, 30, 70, 120, 330, 30);

/**
 * Sinestro's citadel: a violet sky over needle spires, the steps, his statue,
 * and the great yellow lantern burning in the plaza (`burn` 0..1 how bright).
 */
export function drawKorugarCitadel(ctx: CanvasRenderingContext2D, time: number, burn: number) {
	const sky = ctx.createLinearGradient(0, 0, 0, STAGE_GROUND);
	sky.addColorStop(0, '#120818');
	sky.addColorStop(0.6, '#3b1a44');
	sky.addColorStop(1, '#7a3d5c');
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, STAGE_W, STAGE_GROUND);
	// Korugar's twin moons
	ctx.fillStyle = 'rgba(255, 220, 240, 0.5)';
	ctx.beginPath();
	ctx.arc(1180, 120, 46, 0, TAU);
	ctx.fill();
	ctx.fillStyle = 'rgba(255, 220, 240, 0.3)';
	ctx.beginPath();
	ctx.arc(1260, 170, 18, 0, TAU);
	ctx.fill();
	for (const [x, w, h, seed] of KORUGAR_SPIRES) {
		const base = STAGE_GROUND - 70;
		ctx.fillStyle = seed > 0.5 ? '#24142c' : '#2e1a38';
		ctx.beginPath();
		ctx.moveTo(x, base);
		ctx.lineTo(x + w * 0.35, base - h);
		ctx.lineTo(x + w * 0.5, base - h - 60);
		ctx.lineTo(x + w * 0.65, base - h);
		ctx.lineTo(x + w, base);
		ctx.closePath();
		ctx.fill();
		ctx.fillStyle = 'rgba(210, 110, 200, 0.35)';
		for (let k = 1; k < 5; k++) ctx.fillRect(x + w / 2 - 1, base - h * (k / 5), 2, 4);
	}
	// The steps up to the plaza
	for (let i = 0; i < 4; i++) {
		ctx.fillStyle = i % 2 ? '#3a2d44' : '#33283d';
		ctx.fillRect(0, STAGE_GROUND - 70 + i * 18, STAGE_W, 18);
	}
	ctx.fillStyle = '#2b2233';
	ctx.fillRect(0, STAGE_GROUND, STAGE_W, STAGE_H - STAGE_GROUND + UNDER);
	ctx.strokeStyle = 'rgba(210, 110, 200, 0.18)';
	ctx.lineWidth = 2;
	for (let i = -8; i <= 8; i++) {
		ctx.beginPath();
		ctx.moveTo(STAGE_W / 2 + i * 40, STAGE_GROUND);
		ctx.lineTo(STAGE_W / 2 + i * 200, STAGE_H + UNDER);
		ctx.stroke();
	}
	ctx.save();
	ctx.translate(230, STAGE_GROUND - 70);
	ctx.scale(0.6, 0.6);
	drawStatue(ctx, 0, 0, time);
	ctx.restore();
	if (burn > 0) {
		const glow = ctx.createRadialGradient(1080, STAGE_GROUND - 220, 20, 1080, STAGE_GROUND - 220, 520);
		glow.addColorStop(0, `rgba(255, 210, 58, ${0.4 * burn})`);
		glow.addColorStop(1, 'rgba(255, 210, 58, 0)');
		ctx.fillStyle = glow;
		ctx.fillRect(0, 0, STAGE_W, STAGE_H + UNDER);
		ctx.save();
		ctx.globalAlpha = Math.min(1, 0.3 + burn);
		drawGreatLantern(ctx, 1080, STAGE_GROUND - 30, time);
		ctx.restore();
	}
}
