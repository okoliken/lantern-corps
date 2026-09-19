// Lanterns facing the viewer, for the main menu (the game draws everyone
// side-on). Same suit, faces and colours as draw/lantern.ts: Hal with his
// mask, John with glowing eyes, Kilowog big, bald, eared and tusked. The ring
// hand is raised straight up.
//
// Units: (x, y) is the spot on the ground under them, about 62 from feet to
// the top of the head; `scale` multiplies like drawLantern's. `float` lifts
// them off the ground (flying: feet pointed, a green aura, the shadow stays
// on the ground).

import type { CrewId } from '../lanterns';
import { LANTERNS } from '../lanterns';
import { GREEN_CORE, GREEN_LIGHT, SUIT_GREEN, SUIT_GREEN_DARK, SUIT_GREEN_LIT, THEME_GREEN } from '../../theme';

const FIGURE_SCALE = 1.35;
const BLACK = '#0d1210';
const BLACK_LIT = '#24302b';
const OUTLINE = '#030504';
const TAU = Math.PI * 2;

type Point = [number, number];

/** A limb: a thick rounded line with an outline. */
function limb(ctx: CanvasRenderingContext2D, points: Point[], width: number, color: string) {
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	for (const [w, c] of [
		[width + 1.6, OUTLINE],
		[width, color]
	] as const) {
		ctx.strokeStyle = c;
		ctx.lineWidth = w;
		ctx.beginPath();
		points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
		ctx.stroke();
	}
}

function shape(ctx: CanvasRenderingContext2D, points: Point[], fill: string | CanvasGradient, round = false) {
	ctx.beginPath();
	if (round) {
		const n = points.length;
		const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
		ctx.moveTo(...mid(points[n - 1], points[0]));
		points.forEach((p, i) => ctx.quadraticCurveTo(p[0], p[1], ...mid(p, points[(i + 1) % n])));
	} else points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
	ctx.closePath();
	ctx.fillStyle = fill;
	ctx.fill();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.9;
	ctx.stroke();
}

/**
 * Draw a Lantern facing the viewer at (x, y) (their feet), ring hand raised.
 * Returns where the ring is, in the canvas's coordinates.
 */
export function drawLanternFront(ctx: CanvasRenderingContext2D, id: CrewId, x: number, y: number, time: number, scale = 1, float = 0): Point {
	const def = LANTERNS[id];
	const big = id === 'kilowog';
	const s = FIGURE_SCALE * scale * (def.figureScale ?? 1);
	const k = big ? 1.55 : 1;
	const breathe = Math.sin(time * 1.8) * 0.3;
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(s, s);

	// Shadow on the ground, smaller the higher they are
	const shrink = 1 / (1 + float / 40);
	ctx.fillStyle = `rgba(0, 0, 0, ${0.4 * shrink})`;
	ctx.beginPath();
	ctx.ellipse(0, 0.5, 11 * k * shrink, 2.6 * shrink, 0, 0, TAU);
	ctx.fill();
	ctx.translate(0, -float);
	const flying = float > 0;
	if (flying) {
		// The aura of a Lantern in flight
		const aura = ctx.createRadialGradient(0, -30, 4, 0, -30, 34 * k);
		aura.addColorStop(0, `rgba(61, 255, 110, ${0.22 + 0.06 * Math.sin(time * 4)})`);
		aura.addColorStop(1, 'rgba(61, 255, 110, 0)');
		ctx.fillStyle = aura;
		ctx.beginPath();
		ctx.arc(0, -30, 34 * k, 0, TAU);
		ctx.fill();
	}

	// ---- Legs: black, green boots ----
	const hipY = big ? -24 : -28;
	for (const side of [-1, 1]) {
		// Flying, the legs hang together and one knee bends a little
		const footX = flying ? side * 2.6 * k + (side > 0 ? 0.8 : 0) : side * 4.6 * k;
		const footY = flying && side > 0 ? -3.5 : -2;
		limb(ctx, [[side * 3.6 * k, hipY], [side * (flying ? 3.4 : 4.2) * k, hipY / 2], [footX, footY]], 5.4 * (big ? 1.3 : 1), BLACK_LIT);
		limb(ctx, [[footX * 0.98, footY - 7], [footX, footY + 0.5]], 5.6 * (big ? 1.3 : 1), side < 0 ? SUIT_GREEN : SUIT_GREEN_DARK);
		ctx.fillStyle = side < 0 ? SUIT_GREEN : SUIT_GREEN_DARK;
		ctx.strokeStyle = OUTLINE;
		ctx.lineWidth = 0.8;
		ctx.beginPath();
		// Toes pointed down in flight, flat on the ground standing
		if (flying) ctx.ellipse(footX, footY + 1.4, 1.8 * (big ? 1.3 : 1), 2.6, 0, 0, TAU);
		else ctx.ellipse(side * 5 * k, -0.6, 3.6 * (big ? 1.3 : 1), 1.6, 0, 0, TAU);
		ctx.fill();
		ctx.stroke();
	}

	// ---- Torso ----
	const shoulderY = (big ? -44 : -46) + breathe;
	const shoulderW = big ? 15 : 10;
	const waistW = big ? 12 : 5.6;
	const body: Point[] = big
		? [[-waistW, hipY + 1], [-waistW - 4, hipY - 8], [-shoulderW, shoulderY + 4], [-shoulderW + 3, shoulderY - 2], [shoulderW - 3, shoulderY - 2], [shoulderW, shoulderY + 4], [waistW + 4, hipY - 8], [waistW, hipY + 1]]
		: [[-waistW, hipY + 1], [-waistW - 0.6, hipY - 8], [-shoulderW, shoulderY + 1.5], [-shoulderW + 1.5, shoulderY - 1], [shoulderW - 1.5, shoulderY - 1], [shoulderW, shoulderY + 1.5], [waistW + 0.6, hipY - 8], [waistW, hipY + 1]];
	const shade = ctx.createLinearGradient(-shoulderW, 0, shoulderW, 0);
	shade.addColorStop(0, BLACK_LIT);
	shade.addColorStop(1, BLACK);
	shape(ctx, body, shade, big);
	// Green: the classic green chest for Hal and Kilowog; a panel down the front for John
	ctx.save();
	ctx.beginPath();
	body.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
	ctx.closePath();
	ctx.clip();
	const green = ctx.createLinearGradient(-shoulderW, 0, shoulderW, 0);
	green.addColorStop(0, SUIT_GREEN_LIT);
	green.addColorStop(1, SUIT_GREEN_DARK);
	ctx.fillStyle = green;
	if (id === 'john') ctx.fillRect(-waistW * 0.55, shoulderY - 3, waistW * 1.1, hipY - shoulderY + 3);
	else {
		ctx.beginPath();
		ctx.moveTo(-shoulderW - 2, shoulderY - 3);
		ctx.lineTo(shoulderW + 2, shoulderY - 3);
		ctx.lineTo(shoulderW + 2, shoulderY + (big ? 12 : 9));
		ctx.lineTo(0, shoulderY + (big ? 17 : 13));
		ctx.lineTo(-shoulderW - 2, shoulderY + (big ? 12 : 9));
		ctx.closePath();
		ctx.fill();
	}
	// Belt
	ctx.fillStyle = BLACK;
	ctx.fillRect(-shoulderW - 4, hipY - 1.6, shoulderW * 2 + 8, 2);
	ctx.restore();

	// The Corps emblem
	const ex = 0;
	const ey = shoulderY + (big ? 8 : 6);
	const er = big ? 3.8 : 3;
	ctx.fillStyle = GREEN_CORE;
	ctx.beginPath();
	ctx.arc(ex, ey, er, 0, TAU);
	ctx.fill();
	ctx.fillStyle = SUIT_GREEN;
	ctx.beginPath();
	ctx.arc(ex, ey, er * 0.7, 0, TAU);
	ctx.fill();
	ctx.fillStyle = GREEN_CORE;
	ctx.fillRect(ex - er * 0.8, ey - er * 0.4, er * 1.6, er * 0.22);
	ctx.fillRect(ex - er * 0.8, ey + er * 0.18, er * 1.6, er * 0.22);
	ctx.beginPath();
	ctx.arc(ex, ey, er * 0.26, 0, TAU);
	ctx.fill();

	// ---- Arms: the ring arm (their right, our left) straight up, the other at their side ----
	const armW = big ? 5.4 : 4;
	const up: Point = [-shoulderW - 1, shoulderY - 30 - (big ? 2 : 0)];
	limb(ctx, [[-shoulderW + 1.5, shoulderY + 1.5], [-shoulderW - 1.5, shoulderY - 12], up], armW, BLACK_LIT);
	limb(ctx, [[-shoulderW - 1.2, shoulderY - 20], up], armW + 0.4, SUIT_GREEN);
	const down: Point = [shoulderW + 2.5, hipY + 1];
	limb(ctx, [[shoulderW - 1.5, shoulderY + 1.5], [shoulderW + 2, shoulderY + 12], down], armW, BLACK);
	limb(ctx, [[shoulderW + 2.3, hipY - 6], down], armW + 0.4, SUIT_GREEN_DARK);

	// ---- Neck and head ----
	const skin = def.look.skin;
	const headY = shoulderY - (big ? 7 : 8.5);
	limb(ctx, [[0, shoulderY + 1], [0, headY + 3]], big ? 7 : 3.6, skin);
	if (big) drawKilowogFace(ctx, skin, headY);
	else drawHumanFace(ctx, id, skin, def.look.hair, headY, time);

	ctx.restore();
	return [x + up[0] * s, y + (up[1] - float) * s];
}

function drawHumanFace(ctx: CanvasRenderingContext2D, id: CrewId, skin: string, hair: string, cy: number, time: number) {
	// Ears, then the face
	ctx.fillStyle = skin;
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.7;
	for (const side of [-1, 1]) {
		ctx.beginPath();
		ctx.ellipse(side * 5, cy + 0.5, 1.2, 1.8, 0, 0, TAU);
		ctx.fill();
		ctx.stroke();
	}
	ctx.beginPath();
	ctx.moveTo(-4.9, cy - 2);
	ctx.quadraticCurveTo(-5.2, cy + 4.5, -2.4, cy + 6.6);
	ctx.quadraticCurveTo(0, cy + 7.8, 2.4, cy + 6.6);
	ctx.quadraticCurveTo(5.2, cy + 4.5, 4.9, cy - 2);
	ctx.quadraticCurveTo(4.8, cy - 7, 0, cy - 7.2);
	ctx.quadraticCurveTo(-4.8, cy - 7, -4.9, cy - 2);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();

	// Hair
	ctx.fillStyle = hair;
	ctx.beginPath();
	if (id === 'hal') {
		// Swept up and to the side
		ctx.moveTo(-5.1, cy - 1.5);
		ctx.quadraticCurveTo(-5.8, cy - 8.5, 0, cy - 9.2);
		ctx.quadraticCurveTo(5.4, cy - 9.6, 5.8, cy - 5.5);
		ctx.lineTo(5.1, cy - 1.8);
		ctx.quadraticCurveTo(3.5, cy - 5.6, -1, cy - 5.4);
		ctx.quadraticCurveTo(-3.8, cy - 5, -5.1, cy - 1.5);
	} else {
		// Cropped close
		ctx.moveTo(-5, cy - 2.4);
		ctx.quadraticCurveTo(-5, cy - 7.8, 0, cy - 7.9);
		ctx.quadraticCurveTo(5, cy - 7.8, 5, cy - 2.4);
		ctx.quadraticCurveTo(2.5, cy - 5.6, 0, cy - 5.6);
		ctx.quadraticCurveTo(-2.5, cy - 5.6, -5, cy - 2.4);
	}
	ctx.closePath();
	ctx.fill();

	const eyeY = cy - 0.4;
	if (id === 'hal') {
		// The domino mask, white eyes
		ctx.fillStyle = SUIT_GREEN;
		ctx.beginPath();
		ctx.moveTo(-4.7, eyeY - 1.4);
		ctx.quadraticCurveTo(0, eyeY - 2.8, 4.7, eyeY - 1.4);
		ctx.lineTo(4.4, eyeY + 1.5);
		ctx.quadraticCurveTo(2.2, eyeY + 2.2, 0.4, eyeY + 1.2);
		ctx.lineTo(-0.4, eyeY + 1.2);
		ctx.quadraticCurveTo(-2.2, eyeY + 2.2, -4.4, eyeY + 1.5);
		ctx.closePath();
		ctx.fill();
		ctx.strokeStyle = OUTLINE;
		ctx.lineWidth = 0.5;
		ctx.stroke();
		ctx.fillStyle = GREEN_CORE;
		for (const side of [-1, 1]) {
			ctx.beginPath();
			ctx.ellipse(side * 2.3, eyeY, 1.15, 0.75, 0, 0, TAU);
			ctx.fill();
		}
	} else {
		// John: the ring lights his eyes
		ctx.save();
		ctx.shadowColor = THEME_GREEN;
		ctx.shadowBlur = 4 + Math.sin(time * 3);
		ctx.fillStyle = GREEN_LIGHT;
		for (const side of [-1, 1]) {
			ctx.beginPath();
			ctx.ellipse(side * 2.1, eyeY, 1.05, 0.65, 0, 0, TAU);
			ctx.fill();
		}
		ctx.restore();
		ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
		for (const side of [-1, 1]) ctx.fillRect(side * 2.1 - 1.4, eyeY - 1.9, 2.8, 0.6);
	}
	// Nose and mouth
	ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
	ctx.lineWidth = 0.5;
	ctx.beginPath();
	ctx.moveTo(0, eyeY + 1.4);
	ctx.lineTo(-0.5, eyeY + 3);
	ctx.lineTo(0.4, eyeY + 3.2);
	ctx.moveTo(-1.4, eyeY + 4.7);
	ctx.quadraticCurveTo(0, eyeY + 5.1, 1.4, eyeY + 4.7);
	ctx.stroke();
}

/** Kilowog from the front: big and bald, ears either side, a heavy brow, two tusks up from the jaw. */
function drawKilowogFace(ctx: CanvasRenderingContext2D, skin: string, cy: number) {
	const dark = '#8f7577';
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.7;
	// Ears: thick and pointed, swept up
	ctx.fillStyle = dark;
	for (const side of [-1, 1]) {
		ctx.beginPath();
		ctx.moveTo(side * 6, cy - 1);
		ctx.quadraticCurveTo(side * 11, cy - 4, side * 10.5, cy - 8.5);
		ctx.quadraticCurveTo(side * 8, cy - 5, side * 6.2, cy + 2.5);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
	}
	// Head: wide, with a heavy jaw
	ctx.fillStyle = skin;
	ctx.beginPath();
	ctx.moveTo(-6.6, cy - 2);
	ctx.quadraticCurveTo(-7, cy - 9.5, 0, cy - 9.8);
	ctx.quadraticCurveTo(7, cy - 9.5, 6.6, cy - 2);
	ctx.quadraticCurveTo(7.6, cy + 5, 4.6, cy + 7.8);
	ctx.quadraticCurveTo(0, cy + 9.4, -4.6, cy + 7.8);
	ctx.quadraticCurveTo(-7.6, cy + 5, -6.6, cy - 2);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	// Ridges over the scalp
	ctx.strokeStyle = dark;
	ctx.lineWidth = 0.6;
	for (const dx of [-2.2, 0, 2.2]) {
		ctx.beginPath();
		ctx.moveTo(dx, cy - 9.2);
		ctx.lineTo(dx * 1.1, cy - 6.2);
		ctx.stroke();
	}
	// Brow, small eyes under it
	ctx.fillStyle = dark;
	ctx.beginPath();
	ctx.moveTo(-5.4, cy - 3.2);
	ctx.quadraticCurveTo(0, cy - 5.2, 5.4, cy - 3.2);
	ctx.lineTo(5, cy - 1.8);
	ctx.quadraticCurveTo(0, cy - 3.4, -5, cy - 1.8);
	ctx.closePath();
	ctx.fill();
	for (const side of [-1, 1]) {
		ctx.fillStyle = '#f2efe6';
		ctx.beginPath();
		ctx.ellipse(side * 2.4, cy - 1, 1, 0.65, 0, 0, TAU);
		ctx.fill();
		ctx.fillStyle = '#1a0f08';
		ctx.beginPath();
		ctx.arc(side * 2.3, cy - 1, 0.45, 0, TAU);
		ctx.fill();
	}
	// Flat snout
	ctx.fillStyle = dark;
	ctx.beginPath();
	ctx.ellipse(0, cy + 2, 2, 1.2, 0, 0, TAU);
	ctx.fill();
	// Mouth and the two tusks up from the lower jaw
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.7;
	ctx.beginPath();
	ctx.moveTo(-3.6, cy + 5);
	ctx.quadraticCurveTo(0, cy + 6, 3.6, cy + 5);
	ctx.stroke();
	ctx.fillStyle = '#f4efe0';
	for (const side of [-1, 1]) {
		ctx.beginPath();
		ctx.moveTo(side * 2.2, cy + 5.6);
		ctx.lineTo(side * 2.6, cy + 3.4);
		ctx.lineTo(side * 3.2, cy + 5.6);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
	}
}
