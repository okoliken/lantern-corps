// More of the Justice League, on the same skeleton as the other heroes
// (draw/heroes.ts has the Flash and Hawkgirl, and calls these):
//
//  - Superman: blue suit, red cape, boots and trunks, the yellow belt, the
//    shield on his chest, black hair with the curl,
//  - Wonder Woman: red and gold bodice, blue with white stars, red boots with
//    a white stripe, silver bracelets, the tiara, long black hair, a sword in
//    her hand and the golden lasso at her hip.

import { HEAD_R, type LanternPose, type Point, type Skeleton } from '../animation';
import type { Look } from '../lanterns';
import { faceShape, frame, torsoShape } from './heroes';
import { lerpP, poly, segment, shadeColor } from './lantern';

const OUTLINE = '#030504';
const TAU = Math.PI * 2;

// ---- Superman ----
const BLUE = '#1f4fb4';
const BLUE_LIT = '#3a70d8';
const BLUE_DARK = '#15357c';
const CAPE = '#c4161c';
const CAPE_DARK = '#8a0d12';
const S_YELLOW = '#ffd21e';

// ---- Wonder Woman ----
const WW_RED = '#c0171f';
const WW_RED_LIT = '#e0353c';
const WW_BLUE = '#1b3a8c';
const WW_GOLD = '#e8b93c';
const SILVER = '#c9d1da';
export const LASSO_GOLD = '#ffd766';
// Batman: grey suit, black cowl, cape and gloves, the yellow belt
const BAT_GREY = '#6f7680';
const BAT_GREY_LIT = '#8b939d';
const BAT_GREY_DARK = '#4d535b';
const BAT_BLACK = '#15171c';
const BAT_BLACK_LIT = '#2a2e36';
const BAT_YELLOW = '#e9c33b';
// Aquaman: the orange scale shirt, green below, gold at the belt, and the trident
const AQ_ORANGE = '#e8901f';
const AQ_ORANGE_LIT = '#f4b04a';
const AQ_ORANGE_DARK = '#b56a12';
const AQ_GREEN = '#1f6b3a';
const AQ_GREEN_LIT = '#2f8a4c';
const AQ_GOLD = '#f2c94c';
const AQ_BLOND = '#e9d27a';

// ------------------------------------------------------------------- Superman

export function drawSupermanBody(ctx: CanvasRenderingContext2D, sk: Skeleton, look: Look, time: number, pose: LanternPose) {
	drawCape(ctx, sk, time, pose);
	drawSuperArm(ctx, sk.back, true, look);
	drawSuperLeg(ctx, sk.back, true);
	drawSuperTorso(ctx, sk);
	drawSuperLeg(ctx, sk.front, false);
	drawSuperHead(ctx, sk, look);
	drawSuperArm(ctx, sk.front, false, look);
}

/** The cape: from the shoulders, hanging down his back on the ground, streaming out behind him in the air. */
function drawCape(ctx: CanvasRenderingContext2D, sk: Skeleton, time: number, pose: LanternPose, colors: [string, string] = [CAPE, CAPE_DARK]) {
	const at = frame(sk);
	const air = pose.downed ? 0 : pose.altitude;
	// From straight down (0) round toward straight back (PI/2)
	const sweep = 0.22 + air * 0.35 + pose.lean * 0.75 + sk.torsoAngle * 0.5;
	const length = 33;
	const top: Point = at(17.6, 1);
	const back: Point = at(16.6, -5.4);
	const dir: Point = [-Math.sin(sweep), Math.cos(sweep)];
	const across: Point = [dir[1], -dir[0]];
	const ripple = (i: number) => Math.sin(time * (5 + air * 4) + i * 1.7) * (1.2 + air * 1.6);
	const hem = (side: number, i: number): Point => [
		back[0] + dir[0] * length + across[0] * side + dir[0] * ripple(i),
		back[1] + dir[1] * length + across[1] * side + dir[1] * ripple(i)
	];
	const cape = new Path2D();
	cape.moveTo(...top);
	cape.lineTo(...back);
	const mid: Point = [back[0] + dir[0] * length * 0.5 - across[0] * (5 + ripple(3)), back[1] + dir[1] * length * 0.5 - across[1] * (5 + ripple(3))];
	cape.quadraticCurveTo(mid[0], mid[1], ...hem(-9, 0));
	cape.lineTo(...hem(-3, 1));
	cape.lineTo(...hem(3, 2));
	cape.lineTo(...hem(9, 3));
	const mid2: Point = [top[0] + dir[0] * length * 0.5 + across[0] * 3, top[1] + dir[1] * length * 0.5 + across[1] * 3];
	cape.quadraticCurveTo(mid2[0], mid2[1], ...top);
	cape.closePath();
	const shade = ctx.createLinearGradient(back[0], back[1], back[0] + dir[0] * length, back[1] + dir[1] * length);
	shade.addColorStop(0, colors[0]);
	shade.addColorStop(1, colors[1]);
	ctx.fillStyle = shade;
	ctx.fill(cape);
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.stroke(cape);
}

function drawSuperLeg(ctx: CanvasRenderingContext2D, l: Skeleton['front'], far: boolean) {
	const blue = far ? BLUE_DARK : BLUE;
	const boot = far ? CAPE_DARK : CAPE;
	segment(ctx, l.hipJoint, l.knee, 3.9, 3.0, blue);
	const bootTop = lerpP(l.knee, l.foot, 0.3);
	segment(ctx, l.knee, bootTop, 3.0, 2.7, blue);
	segment(ctx, bootTop, l.foot, 2.9, 2.5, boot);
	const shin = Math.atan2(l.foot[1] - l.knee[1], l.foot[0] - l.knee[0]);
	const toe: Point = [l.foot[0] + Math.cos(shin - Math.PI / 2) * 4.4, l.foot[1] + Math.sin(shin - Math.PI / 2) * 4.4];
	segment(ctx, l.foot, toe, 2.2, 1.5, boot);
}

function drawSuperArm(ctx: CanvasRenderingContext2D, l: Skeleton['front'], far: boolean, look: Look) {
	segment(ctx, l.shoulder, l.elbow, 3.2, 2.6, far ? BLUE_DARK : BLUE);
	segment(ctx, l.elbow, l.hand, 2.5, 2.1, far ? BLUE_DARK : BLUE_LIT);
	ctx.fillStyle = far ? shadeColor(look.skin, -0.2) : look.skin;
	ctx.beginPath();
	ctx.arc(l.hand[0], l.hand[1], 2.4, 0, TAU);
	ctx.fill();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.stroke();
}

function drawSuperTorso(ctx: CanvasRenderingContext2D, sk: Skeleton) {
	const at = frame(sk);
	const body = torsoShape(at, -0.5);
	const [bx, by] = at(8, -6);
	const [fx, fy] = at(8, 7);
	const shade = ctx.createLinearGradient(bx, by, fx, fy);
	shade.addColorStop(0, BLUE_DARK);
	shade.addColorStop(1, BLUE_LIT);
	ctx.fillStyle = shade;
	ctx.fill(body);
	ctx.save();
	ctx.clip(body);
	// Red trunks
	ctx.fillStyle = CAPE;
	ctx.fill(poly([at(-3, -8), at(1.8, -8), at(1.8, 9), at(-3, 9)]));
	ctx.restore();
	// Yellow belt
	ctx.strokeStyle = S_YELLOW;
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.moveTo(...at(2, -4.6));
	ctx.lineTo(...at(2, 5.2));
	ctx.stroke();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.9;
	ctx.stroke(body);

	// The shield: a red-edged diamond of yellow with the S across it
	const [ex, ey] = at(12.6, 2.4);
	ctx.save();
	ctx.translate(ex, ey);
	ctx.rotate(sk.torsoAngle);
	ctx.scale(1.2, 1.2);
	const shield = poly([
		[-3.4, -2.6],
		[3.4, -2.6],
		[4.4, -0.8],
		[0, 4.2],
		[-4.4, -0.8]
	]);
	ctx.fillStyle = S_YELLOW;
	ctx.fill(shield);
	ctx.strokeStyle = CAPE;
	ctx.lineWidth = 0.9;
	ctx.stroke(shield);
	ctx.lineWidth = 1.1;
	ctx.beginPath();
	ctx.moveTo(2.2, -1.4);
	ctx.bezierCurveTo(-3.6, -2.4, -3, 0.6, 0, 0.6);
	ctx.bezierCurveTo(2.6, 0.7, 1.6, 2.6, -1.6, 1.9);
	ctx.stroke();
	ctx.restore();

	segment(ctx, sk.neck, lerpP(sk.neck, sk.headCenter, 0.45), 2, 1.9, '#e6b892');
}

function drawSuperHead(ctx: CanvasRenderingContext2D, sk: Skeleton, look: Look) {
	const R = HEAD_R;
	ctx.save();
	ctx.translate(...sk.headCenter);
	ctx.rotate(sk.headAngle);
	const face = faceShape();
	ctx.fillStyle = look.skin;
	ctx.fill(face);
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.stroke(face);
	drawEye(ctx, '#2a5a9a');
	drawMouth(ctx, look);
	// Black hair, neat, with the curl on his forehead
	ctx.fillStyle = look.hair;
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.6;
	ctx.beginPath();
	ctx.moveTo(-R - 0.4, 2.6);
	ctx.arc(0, -0.2, R + 0.6, Math.PI * 0.95, Math.PI * 1.88);
	ctx.quadraticCurveTo(R - 0.6, -3.2, R - 2.2, -2.6);
	ctx.quadraticCurveTo(0.6, -2.2, -0.2, 0.2);
	ctx.lineTo(-1, 3);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.strokeStyle = look.hair;
	ctx.lineWidth = 0.9;
	ctx.beginPath();
	ctx.moveTo(R - 1.4, -3.4);
	ctx.quadraticCurveTo(R + 0.9, -3, R - 0.2, -1.6);
	ctx.stroke();
	ctx.restore();
}

/** Batman. No powers: a man in a grey suit and a black cowl, and the cape is most of him. */
export function drawBatmanBody(ctx: CanvasRenderingContext2D, sk: Skeleton, time: number, pose: LanternPose) {
	drawCape(ctx, sk, time, pose, [BAT_BLACK_LIT, BAT_BLACK]);
	drawBatArm(ctx, sk.back, true);
	drawBatLeg(ctx, sk.back, true);
	drawBatTorso(ctx, sk);
	drawBatLeg(ctx, sk.front, false);
	drawBatHead(ctx, sk);
	drawBatArm(ctx, sk.front, false);
}

function drawBatLeg(ctx: CanvasRenderingContext2D, l: Skeleton['front'], far: boolean) {
	const grey = far ? BAT_GREY_DARK : BAT_GREY;
	const boot = far ? BAT_BLACK : BAT_BLACK_LIT;
	segment(ctx, l.hipJoint, l.knee, 3.8, 3.0, grey);
	const bootTop = lerpP(l.knee, l.foot, 0.35);
	segment(ctx, l.knee, bootTop, 3.0, 2.7, grey);
	segment(ctx, bootTop, l.foot, 2.9, 2.5, boot);
	const shin = Math.atan2(l.foot[1] - l.knee[1], l.foot[0] - l.knee[0]);
	const toe: Point = [l.foot[0] + Math.cos(shin - Math.PI / 2) * 4.2, l.foot[1] + Math.sin(shin - Math.PI / 2) * 4.2];
	segment(ctx, l.foot, toe, 2.2, 1.5, boot);
}

function drawBatArm(ctx: CanvasRenderingContext2D, l: Skeleton['front'], far: boolean) {
	segment(ctx, l.shoulder, l.elbow, 3.1, 2.5, far ? BAT_GREY_DARK : BAT_GREY);
	// Gauntlets, with the fins
	const cuff = lerpP(l.elbow, l.hand, 0.45);
	segment(ctx, l.elbow, cuff, 2.5, 2.2, far ? BAT_GREY_DARK : BAT_GREY_LIT);
	segment(ctx, cuff, l.hand, 2.4, 2.1, far ? BAT_BLACK : BAT_BLACK_LIT);
	const ang = Math.atan2(l.hand[1] - l.elbow[1], l.hand[0] - l.elbow[0]);
	ctx.fillStyle = far ? BAT_BLACK : BAT_BLACK_LIT;
	for (let i = 0; i < 3; i++) {
		const along = lerpP(cuff, l.hand, 0.15 + i * 0.28);
		ctx.beginPath();
		ctx.moveTo(along[0] + Math.cos(ang + Math.PI / 2) * 2.2, along[1] + Math.sin(ang + Math.PI / 2) * 2.2);
		ctx.lineTo(along[0] + Math.cos(ang + Math.PI / 2) * 4.6 + Math.cos(ang) * 1.2, along[1] + Math.sin(ang + Math.PI / 2) * 4.6 + Math.sin(ang) * 1.2);
		ctx.lineTo(along[0] + Math.cos(ang + Math.PI / 2) * 2.2 + Math.cos(ang) * 1.6, along[1] + Math.sin(ang + Math.PI / 2) * 2.2 + Math.sin(ang) * 1.6);
		ctx.closePath();
		ctx.fill();
	}
	ctx.fillStyle = far ? BAT_BLACK : BAT_BLACK_LIT;
	ctx.beginPath();
	ctx.arc(l.hand[0], l.hand[1], 2.3, 0, TAU);
	ctx.fill();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.stroke();
}

function drawBatTorso(ctx: CanvasRenderingContext2D, sk: Skeleton) {
	const at = frame(sk);
	const body = torsoShape(at, -0.3);
	const [bx, by] = at(8, -6);
	const [fx, fy] = at(8, 7);
	const shade = ctx.createLinearGradient(bx, by, fx, fy);
	shade.addColorStop(0, BAT_GREY_DARK);
	shade.addColorStop(1, BAT_GREY_LIT);
	ctx.fillStyle = shade;
	ctx.fill(body);
	ctx.save();
	ctx.clip(body);
	// Black trunks
	ctx.fillStyle = BAT_BLACK;
	ctx.fill(poly([at(-3, -8), at(2, -8), at(2, 9), at(-3, 9)]));
	ctx.restore();
	// The utility belt
	ctx.strokeStyle = BAT_YELLOW;
	ctx.lineWidth = 1.7;
	ctx.beginPath();
	ctx.moveTo(...at(2.4, -4.8));
	ctx.lineTo(...at(2.4, 5.4));
	ctx.stroke();
	ctx.fillStyle = BAT_YELLOW;
	for (const s of [-3, -0.6, 1.8, 4.2]) {
		const [px, py] = at(2.4, s);
		ctx.fillRect(px - 0.9, py - 1.2, 1.8, 2.4);
	}
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.9;
	ctx.stroke(body);
	// The bat on the chest
	const [ex, ey] = at(12.4, 2.2);
	ctx.save();
	ctx.translate(ex, ey);
	ctx.rotate(sk.torsoAngle);
	ctx.fillStyle = BAT_BLACK;
	ctx.beginPath();
	ctx.moveTo(0, -1.2);
	ctx.quadraticCurveTo(-2.2, -3, -5.2, -1.6);
	ctx.quadraticCurveTo(-3.6, 0.2, -4.6, 2);
	ctx.quadraticCurveTo(-2, 1.2, 0, 2.6);
	ctx.quadraticCurveTo(2, 1.2, 4.6, 2);
	ctx.quadraticCurveTo(3.6, 0.2, 5.2, -1.6);
	ctx.quadraticCurveTo(2.2, -3, 0, -1.2);
	ctx.closePath();
	ctx.fill();
	ctx.restore();
	segment(ctx, sk.neck, lerpP(sk.neck, sk.headCenter, 0.45), 2, 1.9, BAT_BLACK_LIT);
}

function drawBatHead(ctx: CanvasRenderingContext2D, sk: Skeleton) {
	const R = HEAD_R;
	ctx.save();
	ctx.translate(...sk.headCenter);
	ctx.rotate(sk.headAngle);
	// The cowl: the whole head, with the ears, and a mouth left open at the front
	ctx.fillStyle = BAT_BLACK_LIT;
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.beginPath();
	ctx.arc(0, 0, R + 0.4, 0, TAU);
	ctx.fill();
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(-R * 0.55, -R * 0.75);
	ctx.lineTo(-R * 0.5, -R - 4.2);
	ctx.lineTo(-R * 0.1, -R * 0.9);
	ctx.moveTo(R * 0.15, -R * 0.95);
	ctx.lineTo(R * 0.5, -R - 4.2);
	ctx.lineTo(R * 0.6, -R * 0.7);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	// The jaw
	ctx.fillStyle = '#e2b58e';
	ctx.beginPath();
	ctx.moveTo(R * 0.15, 0.6);
	ctx.quadraticCurveTo(R + 0.2, 1.2, R * 0.6, R * 0.95);
	ctx.quadraticCurveTo(0, R + 0.2, -R * 0.3, R * 0.6);
	ctx.quadraticCurveTo(R * 0.1, R * 0.1, R * 0.15, 0.6);
	ctx.closePath();
	ctx.fill();
	// The eyes: two white slits
	ctx.fillStyle = '#f4f4f0';
	ctx.beginPath();
	ctx.moveTo(R * 0.25, -1.6);
	ctx.lineTo(R * 0.95, -1.9);
	ctx.lineTo(R * 0.85, -0.7);
	ctx.lineTo(R * 0.3, -0.5);
	ctx.closePath();
	ctx.fill();
	ctx.restore();
}

/** Aquaman. King of the sea, and he brought the trident. */
export function drawAquamanBody(ctx: CanvasRenderingContext2D, sk: Skeleton, look: Look, time: number, pose: LanternPose) {
	void time;
	void pose;
	drawAqArm(ctx, sk.back, true, look, false);
	drawAqLeg(ctx, sk.back, true);
	drawAqTorso(ctx, sk);
	drawAqLeg(ctx, sk.front, false);
	drawAqHead(ctx, sk, look);
	drawAqArm(ctx, sk.front, false, look, true);
}

function drawAqLeg(ctx: CanvasRenderingContext2D, l: Skeleton['front'], far: boolean) {
	const green = far ? AQ_GREEN : AQ_GREEN_LIT;
	segment(ctx, l.hipJoint, l.knee, 3.9, 3.0, green);
	segment(ctx, l.knee, l.foot, 3.0, 2.6, green);
	const shin = Math.atan2(l.foot[1] - l.knee[1], l.foot[0] - l.knee[0]);
	const toe: Point = [l.foot[0] + Math.cos(shin - Math.PI / 2) * 4.4, l.foot[1] + Math.sin(shin - Math.PI / 2) * 4.4];
	segment(ctx, l.foot, toe, 2.2, 1.5, green);
	// The fins at the calf
	ctx.fillStyle = AQ_GOLD;
	const calf = lerpP(l.knee, l.foot, 0.5);
	ctx.beginPath();
	ctx.moveTo(calf[0] + Math.cos(shin + Math.PI / 2) * 2.6, calf[1] + Math.sin(shin + Math.PI / 2) * 2.6);
	ctx.lineTo(calf[0] + Math.cos(shin + Math.PI / 2) * 5.6 + Math.cos(shin) * 3, calf[1] + Math.sin(shin + Math.PI / 2) * 5.6 + Math.sin(shin) * 3);
	ctx.lineTo(calf[0] + Math.cos(shin + Math.PI / 2) * 2.6 + Math.cos(shin) * 4.5, calf[1] + Math.sin(shin + Math.PI / 2) * 2.6 + Math.sin(shin) * 4.5);
	ctx.closePath();
	ctx.fill();
}

function drawAqArm(ctx: CanvasRenderingContext2D, l: Skeleton['front'], far: boolean, look: Look, trident: boolean) {
	segment(ctx, l.shoulder, l.elbow, 3.3, 2.7, far ? AQ_ORANGE_DARK : AQ_ORANGE);
	segment(ctx, l.elbow, l.hand, 2.6, 2.2, far ? shadeColor(look.skin, -0.2) : look.skin);
	// Green gloves
	const cuff = lerpP(l.elbow, l.hand, 0.6);
	segment(ctx, cuff, l.hand, 2.5, 2.2, far ? AQ_GREEN : AQ_GREEN_LIT);
	if (trident) {
		// Held upright in the hand: the shaft down past the hip, the three tines up over the shoulder
		const [hx, hy] = l.hand;
		ctx.save();
		ctx.translate(hx, hy);
		ctx.rotate(-0.15);
		ctx.strokeStyle = AQ_GOLD;
		ctx.lineWidth = 1.6;
		ctx.beginPath();
		ctx.moveTo(0, 22);
		ctx.lineTo(0, -26);
		ctx.stroke();
		ctx.lineWidth = 1.3;
		ctx.beginPath();
		ctx.moveTo(-5, -22);
		ctx.lineTo(-5, -34);
		ctx.moveTo(0, -26);
		ctx.lineTo(0, -38);
		ctx.moveTo(5, -22);
		ctx.lineTo(5, -34);
		ctx.moveTo(-5, -24);
		ctx.quadraticCurveTo(0, -20, 5, -24);
		ctx.stroke();
		ctx.restore();
	}
	ctx.fillStyle = far ? AQ_GREEN : AQ_GREEN_LIT;
	ctx.beginPath();
	ctx.arc(l.hand[0], l.hand[1], 2.4, 0, TAU);
	ctx.fill();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.stroke();
}

function drawAqTorso(ctx: CanvasRenderingContext2D, sk: Skeleton) {
	const at = frame(sk);
	const body = torsoShape(at, -0.4);
	const [bx, by] = at(8, -6);
	const [fx, fy] = at(8, 7);
	const shade = ctx.createLinearGradient(bx, by, fx, fy);
	shade.addColorStop(0, AQ_ORANGE_DARK);
	shade.addColorStop(1, AQ_ORANGE_LIT);
	ctx.fillStyle = shade;
	ctx.fill(body);
	ctx.save();
	ctx.clip(body);
	// The scales: rows of little arcs
	ctx.strokeStyle = 'rgba(120, 70, 10, 0.45)';
	ctx.lineWidth = 0.7;
	for (let row = 4; row < 17; row += 2.2) {
		for (let col = -5; col < 7; col += 2.4) {
			const [cx, cy] = at(row, col + (row % 4.4 < 2.2 ? 1.2 : 0));
			ctx.beginPath();
			ctx.arc(cx, cy, 1.3, Math.PI, 0);
			ctx.stroke();
		}
	}
	// Green below the belt
	ctx.fillStyle = AQ_GREEN;
	ctx.fill(poly([at(-3, -8), at(2.2, -8), at(2.2, 9), at(-3, 9)]));
	ctx.restore();
	// The gold belt
	ctx.strokeStyle = AQ_GOLD;
	ctx.lineWidth = 1.8;
	ctx.beginPath();
	ctx.moveTo(...at(2.4, -4.8));
	ctx.lineTo(...at(2.4, 5.4));
	ctx.stroke();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.9;
	ctx.stroke(body);
	segment(ctx, sk.neck, lerpP(sk.neck, sk.headCenter, 0.45), 2, 1.9, '#e6b892');
}

function drawAqHead(ctx: CanvasRenderingContext2D, sk: Skeleton, look: Look) {
	const R = HEAD_R;
	ctx.save();
	ctx.translate(...sk.headCenter);
	ctx.rotate(sk.headAngle);
	const face = faceShape();
	ctx.fillStyle = look.skin;
	ctx.fill(face);
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.stroke(face);
	drawEye(ctx, '#2f7a9a');
	// The beard along the jaw
	ctx.fillStyle = AQ_BLOND;
	ctx.beginPath();
	ctx.moveTo(R * 0.2, 1.4);
	ctx.quadraticCurveTo(R + 0.4, 1.6, R * 0.55, R + 0.6);
	ctx.quadraticCurveTo(-R * 0.1, R + 1.4, -R * 0.4, R * 0.4);
	ctx.quadraticCurveTo(R * 0.1, R * 0.3, R * 0.2, 1.4);
	ctx.closePath();
	ctx.fill();
	// Long blond hair, swept back
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.6;
	ctx.beginPath();
	ctx.moveTo(-R - 0.6, 3.2);
	ctx.arc(0, -0.2, R + 0.7, Math.PI * 0.9, Math.PI * 1.9);
	ctx.quadraticCurveTo(R - 1, -3.4, R * 0.3, -2.2);
	ctx.quadraticCurveTo(-1, -2.4, -2, 0);
	ctx.quadraticCurveTo(-R - 2, 3, -R - 2.6, 7);
	ctx.quadraticCurveTo(-R - 1, 6, -R - 0.6, 3.2);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.restore();
}

/** An eye and a brow on a face drawn with faceShape. */
function drawEye(ctx: CanvasRenderingContext2D, iris: string) {
	const R = HEAD_R;
	ctx.fillStyle = '#f2efe6';
	ctx.beginPath();
	ctx.ellipse(R - 0.9, -0.2, 1.1, 0.65, 0, 0, TAU);
	ctx.fill();
	ctx.fillStyle = iris;
	ctx.beginPath();
	ctx.arc(R - 0.4, -0.2, 0.5, 0, TAU);
	ctx.fill();
	ctx.strokeStyle = '#0e0f16';
	ctx.lineWidth = 0.6;
	ctx.beginPath();
	ctx.moveTo(R - 2.2, -1.5);
	ctx.lineTo(R + 0.2, -1.3);
	ctx.stroke();
}

function drawMouth(ctx: CanvasRenderingContext2D, look: Look) {
	const R = HEAD_R;
	ctx.strokeStyle = shadeColor(look.skin, -0.4);
	ctx.lineWidth = 0.5;
	ctx.beginPath();
	ctx.moveTo(R - 1.5, 4.3);
	ctx.lineTo(R + 0.3, 4.1);
	ctx.stroke();
}

// --------------------------------------------------------------- Wonder Woman

export function drawWonderWomanBody(ctx: CanvasRenderingContext2D, sk: Skeleton, look: Look, time: number, pose: LanternPose, guard: number) {
	drawWonderHair(ctx, sk, look, time, pose);
	drawWonderArm(ctx, sk.back, true, look);
	drawWonderLeg(ctx, sk.back, true, look);
	drawWonderTorso(ctx, sk, look);
	drawWonderLeg(ctx, sk.front, false, look);
	drawWonderHead(ctx, sk, look);
	drawSword(ctx, sk.front, pose);
	drawWonderArm(ctx, sk.front, false, look);
	if (guard > 0) drawBraceletFlash(ctx, sk, time, Math.min(1, guard * 3));
}

/** Long black hair down her back, lifting when she flies. */
function drawWonderHair(ctx: CanvasRenderingContext2D, sk: Skeleton, look: Look, time: number, pose: LanternPose) {
	const R = HEAD_R;
	const lift = (pose.downed ? 0 : pose.altitude) * 0.25 + pose.lean * 0.5;
	ctx.save();
	ctx.translate(...sk.headCenter);
	ctx.rotate(sk.headAngle - lift);
	const sway = Math.sin(time * 3) * 0.8;
	ctx.fillStyle = look.hair;
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.6;
	ctx.beginPath();
	ctx.moveTo(-R + 3, -R + 0.5);
	ctx.quadraticCurveTo(-R - 5, -1, -R - 5 + sway, 12);
	ctx.quadraticCurveTo(-R - 3 + sway, 20, -R + 1 + sway, 22);
	ctx.quadraticCurveTo(-R + 3, 14, 1, 5);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.restore();
}

function drawWonderLeg(ctx: CanvasRenderingContext2D, l: Skeleton['front'], far: boolean, look: Look) {
	const skin = far ? shadeColor(look.skin, -0.2) : look.skin;
	const boot = far ? shadeColor(WW_RED, -0.3) : WW_RED;
	segment(ctx, l.hipJoint, lerpP(l.hipJoint, l.knee, 0.85), 3.6, 2.8, skin);
	// Red boots to the knee, a white stripe down the front and white round the top
	segment(ctx, lerpP(l.hipJoint, l.knee, 0.8), l.knee, 2.9, 2.8, boot);
	segment(ctx, l.knee, l.foot, 2.8, 2.3, boot);
	const shin = Math.atan2(l.foot[1] - l.knee[1], l.foot[0] - l.knee[0]);
	const front: Point = [Math.cos(shin - Math.PI / 2), Math.sin(shin - Math.PI / 2)];
	const toe: Point = [l.foot[0] + front[0] * 4.2, l.foot[1] + front[1] * 4.2];
	segment(ctx, l.foot, toe, 2.1, 1.5, boot);
	ctx.strokeStyle = far ? '#b9bcc2' : '#f4f4f0';
	ctx.lineWidth = 0.9;
	ctx.beginPath();
	const top = lerpP(l.hipJoint, l.knee, 0.8);
	ctx.moveTo(top[0] + front[0] * 1.8, top[1] + front[1] * 1.8);
	ctx.lineTo(l.knee[0] + front[0] * 1.8, l.knee[1] + front[1] * 1.8);
	ctx.lineTo(l.foot[0] + front[0] * 1.6, l.foot[1] + front[1] * 1.6);
	ctx.stroke();
}

function drawWonderArm(ctx: CanvasRenderingContext2D, l: Skeleton['front'], far: boolean, look: Look) {
	const skin = far ? shadeColor(look.skin, -0.2) : look.skin;
	segment(ctx, l.shoulder, l.elbow, 2.6, 2.1, skin);
	segment(ctx, l.elbow, l.hand, 2.0, 1.8, skin);
	// The bracelets
	segment(ctx, lerpP(l.elbow, l.hand, 0.35), lerpP(l.elbow, l.hand, 0.9), 2.4, 2.2, far ? shadeColor(SILVER, -0.25) : SILVER);
	ctx.fillStyle = skin;
	ctx.beginPath();
	ctx.arc(l.hand[0], l.hand[1], 2, 0, TAU);
	ctx.fill();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.stroke();
}

function drawWonderTorso(ctx: CanvasRenderingContext2D, sk: Skeleton, look: Look) {
	const at = frame(sk);
	const body = torsoShape(at, 0.7);
	const [bx, by] = at(8, -6);
	const [fx, fy] = at(8, 7);
	const shade = ctx.createLinearGradient(bx, by, fx, fy);
	shade.addColorStop(0, WW_RED);
	shade.addColorStop(1, WW_RED_LIT);
	ctx.fillStyle = shade;
	ctx.fill(body);
	ctx.save();
	ctx.clip(body);
	// Blue, with white stars
	ctx.fillStyle = WW_BLUE;
	ctx.fill(poly([at(-3, -8), at(3, -8), at(3, 9), at(-3, 9)]));
	ctx.fillStyle = '#f4f4f0';
	for (const [a, s] of [
		[0.6, -2.2],
		[1.2, 1],
		[0.2, 3.4]
	]) {
		ctx.beginPath();
		ctx.arc(...at(a, s), 0.55, 0, TAU);
		ctx.fill();
	}
	// Bare shoulders above the bodice
	ctx.fillStyle = look.skin;
	ctx.fill(poly([at(16, -8), at(22, -8), at(22, 9), at(16.8, 9)]));
	// The golden eagle across the top of it
	ctx.fillStyle = WW_GOLD;
	ctx.fill(poly([at(16.2, -8), at(16.9, 9), at(14.2, 9), at(12.6, 3.4), at(14.4, -2), at(14.6, -8)]));
	ctx.restore();
	// Golden belt
	ctx.strokeStyle = WW_GOLD;
	ctx.lineWidth = 1.8;
	ctx.beginPath();
	ctx.moveTo(...at(3.2, -3.8));
	ctx.lineTo(...at(3.2, 4.6));
	ctx.stroke();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.9;
	ctx.stroke(body);
	// The lasso, coiled at her hip
	ctx.strokeStyle = LASSO_GOLD;
	ctx.lineWidth = 0.9;
	ctx.shadowColor = LASSO_GOLD;
	ctx.shadowBlur = 3;
	ctx.beginPath();
	ctx.ellipse(...at(1, -2.6), 2.2, 2.8, sk.torsoAngle, 0, TAU);
	ctx.stroke();
	ctx.shadowBlur = 0;
	segment(ctx, sk.neck, lerpP(sk.neck, sk.headCenter, 0.45), 1.7, 1.6, look.skin);
}

function drawWonderHead(ctx: CanvasRenderingContext2D, sk: Skeleton, look: Look) {
	const R = HEAD_R;
	ctx.save();
	ctx.translate(...sk.headCenter);
	ctx.rotate(sk.headAngle);
	const face = faceShape();
	ctx.fillStyle = look.skin;
	ctx.fill(face);
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.stroke(face);
	drawEye(ctx, '#2a4a8a');
	// Red lips
	ctx.strokeStyle = '#a8222c';
	ctx.lineWidth = 0.7;
	ctx.beginPath();
	ctx.moveTo(R - 1.5, 4.3);
	ctx.lineTo(R + 0.3, 4.1);
	ctx.stroke();
	// Hair over the crown
	ctx.fillStyle = look.hair;
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.6;
	ctx.beginPath();
	ctx.moveTo(-R - 0.5, 3);
	ctx.arc(0, -0.2, R + 0.7, Math.PI * 0.95, Math.PI * 1.85);
	ctx.quadraticCurveTo(R - 1.6, -3, R - 3, -1.8);
	ctx.quadraticCurveTo(0.4, -1.4, -0.4, 1.6);
	ctx.lineTo(-1.2, 4);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	// The tiara, with its red star
	ctx.strokeStyle = WW_GOLD;
	ctx.lineWidth = 1.3;
	ctx.beginPath();
	ctx.moveTo(-1.4, -2.4);
	ctx.quadraticCurveTo(R - 2.6, -3.6, R + 0.4, -2.3);
	ctx.stroke();
	ctx.fillStyle = WW_GOLD;
	ctx.beginPath();
	ctx.moveTo(R - 0.4, -4.6);
	ctx.lineTo(R + 0.8, -2.2);
	ctx.lineTo(R - 1.8, -2.6);
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = WW_RED_LIT;
	ctx.beginPath();
	ctx.arc(R - 0.4, -3.1, 0.6, 0, TAU);
	ctx.fill();
	ctx.restore();
}

/** The sword in her front hand: up and ready, swung forward when she cuts. */
function drawSword(ctx: CanvasRenderingContext2D, l: Skeleton['front'], pose: LanternPose) {
	const [hx, hy] = l.hand;
	const [ex, ey] = l.elbow;
	const forearm = Math.atan2(hy - ey, hx - ex);
	const swing = pose.cast ?? 0;
	const angle = forearm - 1.0 + swing * 1.1;
	const tip: Point = [hx + Math.cos(angle) * 19, hy + Math.sin(angle) * 19];
	ctx.save();
	// Blade
	const nx = -Math.sin(angle);
	const ny = Math.cos(angle);
	ctx.fillStyle = '#dfe6ee';
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.6;
	ctx.beginPath();
	ctx.moveTo(hx + nx * 1.1, hy + ny * 1.1);
	ctx.lineTo(tip[0] - Math.cos(angle) * 3 + nx * 1.1, tip[1] - Math.sin(angle) * 3 + ny * 1.1);
	ctx.lineTo(...tip);
	ctx.lineTo(tip[0] - Math.cos(angle) * 3 - nx * 1.1, tip[1] - Math.sin(angle) * 3 - ny * 1.1);
	ctx.lineTo(hx - nx * 1.1, hy - ny * 1.1);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	// Golden guard and grip
	ctx.strokeStyle = WW_GOLD;
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.moveTo(hx + Math.cos(angle) * 2 + nx * 3, hy + Math.sin(angle) * 2 + ny * 3);
	ctx.lineTo(hx + Math.cos(angle) * 2 - nx * 3, hy + Math.sin(angle) * 2 - ny * 3);
	ctx.moveTo(hx, hy);
	ctx.lineTo(hx - Math.cos(angle) * 3.4, hy - Math.sin(angle) * 3.4);
	ctx.stroke();
	ctx.restore();
}

/** Bracelets up: a flare of gold in front of her where the hit lands. */
function drawBraceletFlash(ctx: CanvasRenderingContext2D, sk: Skeleton, time: number, k: number) {
	const at = frame(sk);
	const [x, y] = at(13, 12);
	ctx.save();
	ctx.globalAlpha = k;
	ctx.strokeStyle = LASSO_GOLD;
	ctx.shadowColor = LASSO_GOLD;
	ctx.shadowBlur = 8;
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.ellipse(x, y, 4, 11, 0, -1.3, 1.3);
	ctx.stroke();
	ctx.lineWidth = 0.8;
	for (let i = 0; i < 5; i++) {
		const a = -1.1 + i * 0.55 + Math.sin(time * 30 + i * 2) * 0.2;
		ctx.beginPath();
		ctx.moveTo(x + Math.cos(a) * 4, y + Math.sin(a) * 11);
		ctx.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 15);
		ctx.stroke();
	}
	ctx.restore();
}
