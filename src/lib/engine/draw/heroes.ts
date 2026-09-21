// Earth's heroes, drawn on the same animated skeleton as the Lanterns
// (animation.ts), in their own costumes, and their powers' effects:
//
//  - the Flash: red suit, yellow boots and belt, the lightning emblem, a cowl
//    with lightning wings at the ears; a streak of speed behind him,
//  - Hawkgirl: gold top, green trousers, the hawk helmet over red hair, great
//    brown wings, and the Nth metal mace crackling in her hand.

import { HEAD_R, TORSO, computeSkeleton, turnScale, type LanternPose, type Point, type Skeleton } from '../animation';
import type { HeroFx } from '../heroes';
import type { HeroId, Look } from '../lanterns';
import { isStanding } from '../dummy';
import { createEnemy, type Enemy } from '../enemies/enemies';
import type { Player } from '../player';
import { drawLieutenant } from './lieutenants';
import { enemyPose } from './enemies';
import { LASSO_GOLD, drawSupermanBody, drawWonderWomanBody } from './league';
import { FIGURE_HEIGHT, lerpP, poly, segment, shadeColor } from './lantern';

const FIGURE_SCALE = 1.35;
const OUTLINE = '#030504';
const TAU = Math.PI * 2;

// ---- The Flash ----
const RED = '#c8141c';
const RED_LIT = '#e8323a';
const RED_DARK = '#8e0c12';
const YELLOW = '#ffd21e';
const YELLOW_DARK = '#c79a0a';
/** The Speed Force: lightning is yellow-white with an orange edge. */
export const SPEED_YELLOW = '#ffe45c';

// ---- Hawkgirl ----
const GOLD = '#d9a441';
const GOLD_LIT = '#f0c465';
const GREEN_TROUSERS = '#2f4a2c';
const BROWN = '#5a3a22';
const WING = '#7a5238';
const WING_LIGHT = '#a8805c';
const HELMET = '#b57a2a';
const NTH = '#a9b3bd';
/** Nth metal's crackle. */
export const NTH_GLOW = '#fff08a';

export interface HeroLook {
	/** Wings wrapped round her (Wing Guard), 0..1. */
	guard?: number;
}

/** Draw the Flash or Hawkgirl. Same contract as drawLantern: (x, y) is the anchor. */
export function drawHero(
	ctx: CanvasRenderingContext2D,
	id: HeroId,
	look: Look,
	x: number,
	y: number,
	pose: LanternPose,
	time: number,
	scale = 1,
	extra: HeroLook = {}
) {
	const s = FIGURE_SCALE * scale;
	const sk = computeSkeleton(pose, time);
	const air = pose.altitude;
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(s, s);
	if (pose.shadow) {
		const k = 1 - 0.35 * air;
		ctx.fillStyle = `rgba(0, 0, 0, ${0.45 * k})`;
		ctx.beginPath();
		ctx.ellipse(0, 0, 12 * k * (pose.downed ? 1.9 : 1), 3.8 * k, 0, 0, TAU);
		ctx.fill();
	}
	ctx.scale(pose.dir * turnScale(pose), 1);
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';

	if (id === 'flash') {
		drawSpeedsterBody(ctx, sk, look, time, FLASH_COLORS);
	} else if (id === 'superman') {
		drawSupermanBody(ctx, sk, look, time, pose);
	} else if (id === 'wonderwoman') {
		drawWonderWomanBody(ctx, sk, look, time, pose, extra.guard ?? 0);
	} else {
		const flying = air > 0.5 && !pose.downed;
		const guard = extra.guard ?? 0;
		drawWing(ctx, sk, true, flying, time, guard);
		drawHawkArm(ctx, sk.back, true, look);
		drawHawkLeg(ctx, sk.back, true);
		drawHawkTorso(ctx, sk, look);
		drawHawkLeg(ctx, sk.front, false);
		drawHawkHead(ctx, sk, look);
		drawMace(ctx, sk.front, time, pose);
		drawHawkArm(ctx, sk.front, false, look);
		drawWing(ctx, sk, false, flying, time, guard);
	}
	ctx.restore();
}

// ------------------------------------------------------------------ the Flash

/** A speedster's costume colours: the Flash's, or Reverse-Flash's (the same suit, the colours swapped). */
export interface SpeedsterColors {
	suit: string;
	lit: string;
	dark: string;
	/** Boots, belt, cuffs and the lightning at the ears. */
	trim: string;
	trimDark: string;
	/** The emblem's disc, and the bolt across it. */
	disc: string;
	bolt: string;
}
export const FLASH_COLORS: SpeedsterColors = { suit: RED, lit: RED_LIT, dark: RED_DARK, trim: YELLOW, trimDark: YELLOW_DARK, disc: '#f7f3ea', bolt: YELLOW };
export const REVERSE_FLASH_COLORS: SpeedsterColors = { suit: '#e5bd14', lit: '#ffdc4a', dark: '#a8850a', trim: '#c8141c', trimDark: '#8e0c12', disc: '#17110b', bolt: '#e0202a' };

/** A speedster on the Lantern skeleton, in the given colours (the caller has translated, scaled and mirrored). */
export function drawSpeedsterBody(ctx: CanvasRenderingContext2D, sk: Skeleton, look: Look, time: number, P: SpeedsterColors) {
	drawFlashArm(ctx, sk.back, true, P);
	drawFlashLeg(ctx, sk.back, true, P);
	drawFlashTorso(ctx, sk, P);
	drawFlashLeg(ctx, sk.front, false, P);
	drawFlashHead(ctx, sk, look, time, P);
	drawFlashArm(ctx, sk.front, false, P);
}

function drawFlashLeg(ctx: CanvasRenderingContext2D, l: Skeleton['front'], far: boolean, P: SpeedsterColors) {
	const red = far ? P.dark : P.suit;
	const boot = far ? P.trimDark : P.trim;
	segment(ctx, l.hipJoint, l.knee, 3.7, 2.9, red);
	const bootTop = lerpP(l.knee, l.foot, 0.45);
	segment(ctx, l.knee, bootTop, 2.9, 2.6, red);
	segment(ctx, bootTop, l.foot, 2.8, 2.4, boot);
	const shinAngle = Math.atan2(l.foot[1] - l.knee[1], l.foot[0] - l.knee[0]);
	const toeAngle = shinAngle - Math.PI / 2;
	const toe: Point = [l.foot[0] + Math.cos(toeAngle) * 4.4, l.foot[1] + Math.sin(toeAngle) * 4.4];
	segment(ctx, l.foot, toe, 2.2, 1.5, boot);
	// The little lightning wing on the boot
	ctx.fillStyle = far ? P.trimDark : P.trim;
	ctx.beginPath();
	ctx.moveTo(bootTop[0] - 2.4, bootTop[1] + 0.5);
	ctx.lineTo(bootTop[0] - 5.5, bootTop[1] - 1.5);
	ctx.lineTo(bootTop[0] - 2.6, bootTop[1] + 2.4);
	ctx.closePath();
	ctx.fill();
}

function drawFlashArm(ctx: CanvasRenderingContext2D, l: Skeleton['front'], far: boolean, P: SpeedsterColors) {
	const red = far ? P.dark : P.lit;
	segment(ctx, l.shoulder, l.elbow, 2.9, 2.4, far ? P.dark : P.suit);
	segment(ctx, l.elbow, l.hand, 2.3, 2.0, red);
	// Yellow cuff
	const cuff = lerpP(l.elbow, l.hand, 0.7);
	segment(ctx, cuff, lerpP(l.elbow, l.hand, 0.82), 2.3, 2.2, far ? P.trimDark : P.trim);
	ctx.fillStyle = red;
	ctx.beginPath();
	ctx.arc(l.hand[0], l.hand[1], 2.3, 0, TAU);
	ctx.fill();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.stroke();
}

/** Points along the spine: `along` from the hip, `side` toward the front. */
export function frame(sk: Skeleton) {
	const { hip, neck, torsoAngle } = sk;
	const up: Point = [Math.sin(torsoAngle), -Math.cos(torsoAngle)];
	const across: Point = [Math.cos(torsoAngle), Math.sin(torsoAngle)];
	const stretch = Math.hypot(neck[0] - hip[0], neck[1] - hip[1]) / TORSO;
	return (along: number, side: number): Point => [
		hip[0] + up[0] * along * stretch + across[0] * side,
		hip[1] + up[1] * along * stretch + across[1] * side
	];
}

export function torsoShape(at: (a: number, s: number) => Point, slim = 0) {
	return poly([
		at(-1.5, -4.4 + slim),
		at(6, -4.2 + slim),
		at(14, -5.8 + slim),
		at(18.2, -4.2 + slim),
		at(18.8, 3),
		at(14.5, 7.2 - slim),
		at(8.5, 5.8 - slim),
		at(4, 5 - slim),
		at(-1.5, 4.8 - slim)
	]);
}

function drawFlashTorso(ctx: CanvasRenderingContext2D, sk: Skeleton, P: SpeedsterColors) {
	const at = frame(sk);
	const body = torsoShape(at);
	const [bx, by] = at(8, -6);
	const [fx, fy] = at(8, 7);
	const shade = ctx.createLinearGradient(bx, by, fx, fy);
	shade.addColorStop(0, P.dark);
	shade.addColorStop(1, P.lit);
	ctx.fillStyle = shade;
	ctx.fill(body);
	// Yellow belt
	ctx.strokeStyle = P.trim;
	ctx.lineWidth = 1.6;
	ctx.beginPath();
	ctx.moveTo(...at(1.3, -4.4));
	ctx.lineTo(...at(1.3, 5));
	ctx.stroke();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.9;
	ctx.stroke(body);

	// The emblem: a white circle, and the lightning bolt across it
	const [ex, ey] = at(13.2, 5);
	ctx.save();
	ctx.translate(ex, ey);
	ctx.rotate(sk.torsoAngle);
	ctx.fillStyle = P.disc;
	ctx.beginPath();
	ctx.arc(0, 0, 2.8, 0, TAU);
	ctx.fill();
	ctx.strokeStyle = P.trimDark;
	ctx.lineWidth = 0.4;
	ctx.stroke();
	ctx.fillStyle = P.bolt;
	ctx.beginPath();
	ctx.moveTo(-1, -3.2);
	ctx.lineTo(1.5, -0.8);
	ctx.lineTo(0.2, -0.5);
	ctx.lineTo(1.4, 3.2);
	ctx.lineTo(-1.5, 0.5);
	ctx.lineTo(-0.2, 0.3);
	ctx.closePath();
	ctx.fill();
	ctx.restore();

	segment(ctx, sk.neck, lerpP(sk.neck, sk.headCenter, 0.45), 1.9, 1.8, P.suit);
}

export function faceShape(): Path2D {
	const R = HEAD_R;
	const face = new Path2D();
	face.moveTo(-R * 0.95, -1);
	face.arc(0, 0, R, Math.PI * 1.05, Math.PI * 1.95);
	face.quadraticCurveTo(R + 1.2, -0.5, R + 0.9, 1.6);
	face.lineTo(R + 1.6, 2.6);
	face.lineTo(R + 0.5, 3.1);
	face.quadraticCurveTo(R + 0.7, 5.6, R - 0.6, 6.6);
	face.quadraticCurveTo(R - 3.5, 7.8, -0.5, 5.8);
	face.quadraticCurveTo(-R, 4.5, -R * 0.95, -1);
	face.closePath();
	return face;
}

function drawFlashHead(ctx: CanvasRenderingContext2D, sk: Skeleton, look: Look, time: number, P: SpeedsterColors) {
	const R = HEAD_R;
	ctx.save();
	ctx.translate(...sk.headCenter);
	ctx.rotate(sk.headAngle);
	const face = faceShape();
	// Skin first (the mouth and chin show), then the cowl over everything above the nose
	ctx.fillStyle = look.skin;
	ctx.fill(face);
	ctx.save();
	ctx.clip(face);
	ctx.fillStyle = P.suit;
	ctx.beginPath();
	ctx.moveTo(-R - 2, -R - 2);
	ctx.lineTo(R + 3, -R - 2);
	ctx.lineTo(R + 3, 2.2);
	ctx.quadraticCurveTo(R - 2.5, 3.6, 0.5, 6.5);
	ctx.lineTo(-R - 2, 7);
	ctx.closePath();
	ctx.fill();
	ctx.restore();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.stroke(face);

	// White eye slit
	ctx.fillStyle = '#fbf7ee';
	ctx.beginPath();
	ctx.ellipse(R - 0.9, -0.4, 1.3, 0.6, -0.1, 0, TAU);
	ctx.fill();

	// Lightning wing at the ear, swept back
	const flick = Math.sin(time * 9) * 0.3;
	ctx.fillStyle = P.trim;
	ctx.strokeStyle = P.trimDark;
	ctx.lineWidth = 0.4;
	ctx.beginPath();
	ctx.moveTo(0.4, -0.6);
	ctx.lineTo(-3.4, -3.6 - flick);
	ctx.lineTo(-2.2, -1.6);
	ctx.lineTo(-5.6, -2.6 - flick);
	ctx.lineTo(-1.4, 1.2);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();

	// Mouth
	ctx.strokeStyle = shadeColor(look.skin, -0.4);
	ctx.lineWidth = 0.5;
	ctx.beginPath();
	ctx.moveTo(R - 1.6, 4.3);
	ctx.lineTo(R + 0.4, 4.1);
	ctx.stroke();
	ctx.restore();
}

// ------------------------------------------------------------------- Hawkgirl

function drawHawkLeg(ctx: CanvasRenderingContext2D, l: Skeleton['front'], far: boolean) {
	const trousers = far ? shadeColor(GREEN_TROUSERS, -0.25) : GREEN_TROUSERS;
	const boot = far ? shadeColor(BROWN, -0.25) : BROWN;
	segment(ctx, l.hipJoint, l.knee, 3.6, 2.8, trousers);
	const bootTop = lerpP(l.knee, l.foot, 0.3);
	segment(ctx, l.knee, bootTop, 2.8, 2.6, trousers);
	segment(ctx, bootTop, l.foot, 2.8, 2.4, boot);
	const shinAngle = Math.atan2(l.foot[1] - l.knee[1], l.foot[0] - l.knee[0]);
	const toeAngle = shinAngle - Math.PI / 2;
	const toe: Point = [l.foot[0] + Math.cos(toeAngle) * 4, l.foot[1] + Math.sin(toeAngle) * 4];
	segment(ctx, l.foot, toe, 2.1, 1.5, boot);
}

function drawHawkArm(ctx: CanvasRenderingContext2D, l: Skeleton['front'], far: boolean, look: Look) {
	const skin = far ? shadeColor(look.skin, -0.2) : look.skin;
	segment(ctx, l.shoulder, l.elbow, 2.7, 2.2, skin);
	segment(ctx, l.elbow, l.hand, 2.1, 1.9, skin);
	// Leather bracer on the forearm
	segment(ctx, lerpP(l.elbow, l.hand, 0.25), lerpP(l.elbow, l.hand, 0.85), 2.4, 2.2, far ? shadeColor(BROWN, -0.2) : BROWN);
	ctx.fillStyle = skin;
	ctx.beginPath();
	ctx.arc(l.hand[0], l.hand[1], 2.1, 0, TAU);
	ctx.fill();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.stroke();
}

function drawHawkTorso(ctx: CanvasRenderingContext2D, sk: Skeleton, look: Look) {
	const at = frame(sk);
	const body = torsoShape(at, 0.6);
	const [bx, by] = at(8, -6);
	const [fx, fy] = at(8, 7);
	const shade = ctx.createLinearGradient(bx, by, fx, fy);
	shade.addColorStop(0, GOLD);
	shade.addColorStop(1, GOLD_LIT);
	ctx.fillStyle = shade;
	ctx.fill(body);
	ctx.save();
	ctx.clip(body);
	// Green trousers up to the belt
	ctx.fillStyle = GREEN_TROUSERS;
	ctx.fill(poly([at(-3, -8), at(1.6, -8), at(1.6, 9), at(-3, 9)]));
	// Bare shoulders above the top
	ctx.fillStyle = look.skin;
	ctx.fill(poly([at(16.5, -8), at(22, -8), at(22, 9), at(17.2, 9)]));
	ctx.restore();
	// Belt with a gold buckle
	ctx.strokeStyle = BROWN;
	ctx.lineWidth = 1.8;
	ctx.beginPath();
	ctx.moveTo(...at(1.6, -4));
	ctx.lineTo(...at(1.6, 4.4));
	ctx.stroke();
	ctx.fillStyle = HELMET;
	ctx.beginPath();
	ctx.arc(...at(1.6, 3.6), 1, 0, TAU);
	ctx.fill();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.9;
	ctx.stroke(body);
	segment(ctx, sk.neck, lerpP(sk.neck, sk.headCenter, 0.45), 1.7, 1.6, look.skin);
}

function drawHawkHead(ctx: CanvasRenderingContext2D, sk: Skeleton, look: Look) {
	const R = HEAD_R;
	ctx.save();
	ctx.translate(...sk.headCenter);
	ctx.rotate(sk.headAngle);

	// Long red hair falling out behind the helmet, past her shoulders
	ctx.fillStyle = look.hair;
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.6;
	ctx.beginPath();
	ctx.moveTo(-R + 2, -2);
	ctx.quadraticCurveTo(-R - 5, 2, -R - 4, 14);
	ctx.quadraticCurveTo(-R - 1, 12, -R + 1, 15);
	ctx.quadraticCurveTo(-R + 1.5, 8, 0, 4.5);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();

	const face = faceShape();
	ctx.fillStyle = look.skin;
	ctx.fill(face);
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.stroke(face);

	// Eye and mouth
	ctx.fillStyle = '#f2efe6';
	ctx.beginPath();
	ctx.ellipse(R - 0.9, -0.2, 1.1, 0.65, 0, 0, TAU);
	ctx.fill();
	ctx.fillStyle = '#2a4a2a';
	ctx.beginPath();
	ctx.arc(R - 0.4, -0.2, 0.5, 0, TAU);
	ctx.fill();
	ctx.strokeStyle = shadeColor(look.skin, -0.4);
	ctx.lineWidth = 0.5;
	ctx.beginPath();
	ctx.moveTo(R - 1.5, 4.3);
	ctx.lineTo(R + 0.3, 4.1);
	ctx.stroke();

	// The hawk helmet: a cap over the crown, a beak down over the brow, feathers flaring back
	const helmet = new Path2D();
	helmet.moveTo(-R - 0.6, 1.4);
	helmet.arc(0, -0.3, R + 0.7, Math.PI * 1.0, Math.PI * 1.9);
	helmet.quadraticCurveTo(R + 3.4, -2.4, R + 2.6, -0.2); // the beak
	helmet.lineTo(R - 0.4, -1.3);
	helmet.quadraticCurveTo(2, -2.4, 0.6, -0.8);
	helmet.lineTo(-0.4, 2.2);
	helmet.closePath();
	const shine = ctx.createLinearGradient(-R, -R, R, 0);
	shine.addColorStop(0, shadeColor(HELMET, -0.25));
	shine.addColorStop(1, shadeColor(HELMET, 0.25));
	ctx.fillStyle = shine;
	ctx.fill(helmet);
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.7;
	ctx.stroke(helmet);
	// The mask round her eye
	ctx.strokeStyle = shadeColor(HELMET, -0.35);
	ctx.lineWidth = 0.9;
	ctx.beginPath();
	ctx.ellipse(R - 0.9, -0.3, 1.9, 1.3, 0, Math.PI * 0.9, Math.PI * 2.1);
	ctx.stroke();
	// Feathered flare at the side
	ctx.fillStyle = shadeColor(HELMET, -0.2);
	for (let i = 0; i < 3; i++) {
		ctx.beginPath();
		ctx.moveTo(-0.5, -2.5 + i * 1.6);
		ctx.lineTo(-R - 3.5 - i, -4.5 + i * 2.2);
		ctx.lineTo(-R + 0.5, -1 + i * 1.6);
		ctx.closePath();
		ctx.fill();
	}
	ctx.restore();
}

/**
 * A great brown wing from the shoulder blade: a short bony arm, and long
 * feathers along it. Folded on the ground, the feathers hang down her back;
 * in the air the wing opens out behind her and beats; in a Wing Guard it
 * wraps round to the front.
 */
function drawWing(ctx: CanvasRenderingContext2D, sk: Skeleton, far: boolean, flying: boolean, time: number, guard: number) {
	const at = frame(sk);
	const root = at(15.5, -3.2);
	const beat = flying ? Math.sin(time * 7 + (far ? 0.6 : 0)) : 0;
	// The wing's bone (up and back from the shoulder), and which way its feathers trail
	let bone = -2.05;
	let trail = 2.2;
	let reach = 12;
	let long = 1;
	if (flying) {
		bone = -2.45 + beat * 0.45;
		trail = 2.75 + beat * 0.25;
		reach = 17;
		long = 0.8;
	}
	if (guard > 0) {
		bone = -1.1;
		trail = 1.5;
		reach = 12;
		long = 0.95;
	}
	if (far) {
		bone -= 0.12;
		trail += 0.08;
	}
	const wrist: Point = [root[0] + Math.cos(bone) * reach, root[1] + Math.sin(bone) * reach];
	const tip: Point = [wrist[0] + Math.cos(bone - 0.35) * reach * 0.7, wrist[1] + Math.sin(bone - 0.35) * reach * 0.7];
	const dark = far ? shadeColor(WING, -0.35) : WING;
	const light = far ? shadeColor(WING_LIGHT, -0.35) : WING_LIGHT;
	ctx.save();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.5;
	// Long feathers, outermost (longest) first so the inner ones lie over them
	const n = 7;
	for (let i = n - 1; i >= 0; i--) {
		const t = i / (n - 1);
		const base: Point = t < 0.5 ? lerpP(root, wrist, t * 2) : lerpP(wrist, tip, (t - 0.5) * 2);
		const len = (15 + t * 17) * long;
		const dir = trail - t * 0.35;
		const end: Point = [base[0] + Math.cos(dir) * len, base[1] + Math.sin(dir) * len];
		const nx = -Math.sin(dir);
		const ny = Math.cos(dir);
		const w = 2.4 + t * 0.8;
		ctx.fillStyle = i % 2 ? dark : shadeColor(WING, far ? -0.25 : 0.08);
		ctx.beginPath();
		ctx.moveTo(base[0] + nx * w, base[1] + ny * w);
		ctx.quadraticCurveTo(base[0] + nx * w + Math.cos(dir) * len * 0.6, base[1] + ny * w + Math.sin(dir) * len * 0.6, ...end);
		ctx.quadraticCurveTo(base[0] - nx * w * 0.6 + Math.cos(dir) * len * 0.5, base[1] - ny * w * 0.6 + Math.sin(dir) * len * 0.5, base[0] - nx * w * 0.6, base[1] - ny * w * 0.6);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
	}
	// The coverts: a band of shorter, lighter feathers along the bone
	ctx.fillStyle = light;
	ctx.beginPath();
	ctx.moveTo(...root);
	ctx.lineTo(...wrist);
	ctx.lineTo(...tip);
	ctx.lineTo(tip[0] + Math.cos(trail) * 7, tip[1] + Math.sin(trail) * 7);
	ctx.lineTo(wrist[0] + Math.cos(trail) * 8, wrist[1] + Math.sin(trail) * 8);
	ctx.lineTo(root[0] + Math.cos(trail) * 6, root[1] + Math.sin(trail) * 6);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	// The bone itself
	ctx.strokeStyle = far ? shadeColor(BROWN, -0.3) : BROWN;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(...root);
	ctx.lineTo(...wrist);
	ctx.lineTo(...tip);
	ctx.stroke();
	ctx.restore();
}

/** The Nth metal mace in her near hand, crackling. Raised back to swing, forward when striking. */
function drawMace(ctx: CanvasRenderingContext2D, l: Skeleton['front'], time: number, pose: LanternPose) {
	const [hx, hy] = l.hand;
	const [ex, ey] = l.elbow;
	// Along the forearm, a little beyond the fist
	const fa = Math.atan2(hy - ey, hx - ex);
	const swing = pose.cast ?? 0;
	const angle = fa - 0.9 + swing * 0.9;
	const len = 13;
	const head: Point = [hx + Math.cos(angle) * len, hy + Math.sin(angle) * len];
	ctx.save();
	ctx.strokeStyle = '#4a3a2a';
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.moveTo(hx - Math.cos(angle) * 2, hy - Math.sin(angle) * 2);
	ctx.lineTo(...head);
	ctx.stroke();
	// Flanged head
	ctx.translate(...head);
	ctx.rotate(angle);
	ctx.shadowColor = NTH_GLOW;
	ctx.shadowBlur = 5 + 3 * Math.sin(time * 20);
	ctx.fillStyle = NTH;
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.6;
	ctx.beginPath();
	for (let i = 0; i < 8; i++) {
		const a = (i / 8) * TAU;
		const r = i % 2 === 0 ? 5.4 : 3.4;
		ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
	}
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.shadowBlur = 0;
	// Little crackles of Nth energy
	if (Math.sin(time * 13) > 0.2) {
		ctx.strokeStyle = NTH_GLOW;
		ctx.lineWidth = 0.6;
		ctx.beginPath();
		const a = time * 31;
		ctx.moveTo(Math.cos(a) * 4, Math.sin(a) * 4);
		ctx.lineTo(Math.cos(a + 0.4) * 7, Math.sin(a + 0.4) * 7);
		ctx.lineTo(Math.cos(a + 0.1) * 9, Math.sin(a + 0.1) * 9);
		ctx.stroke();
	}
	ctx.restore();
}

// -------------------------------------------------------------------- effects

/** A jagged lightning path from a to b. */
function lightning(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, seed: number, jag = 10) {
	const d = Math.hypot(bx - ax, by - ay);
	const n = Math.max(3, Math.round(d / 22));
	const nx = -(by - ay) / (d || 1);
	const ny = (bx - ax) / (d || 1);
	ctx.beginPath();
	ctx.moveTo(ax, ay);
	for (let i = 1; i < n; i++) {
		const t = i / n;
		const off = Math.sin(seed * 12.9898 + i * 78.233) * jag;
		ctx.lineTo(ax + (bx - ax) * t + nx * off, ay + (by - ay) * t + ny * off);
	}
	ctx.lineTo(bx, by);
	ctx.stroke();
}

/** The Flash's trail: a fading red-and-yellow streak along where he ran. */
export function drawSpeedTrail(ctx: CanvasRenderingContext2D, trail: { x: number; y: number; age: number }[], height: number, reverse = false) {
	if (trail.length < 2) return;
	ctx.save();
	ctx.lineCap = 'round';
	for (let i = 1; i < trail.length; i++) {
		const a = trail[i - 1];
		const b = trail[i];
		const fade = 1 - b.age / 0.28;
		if (fade <= 0) continue;
		// The Flash streaks red and gold; Reverse-Flash gold and red
		const [outer, inner] = reverse ? ['rgba(240, 200, 30, ', 'rgba(230, 30, 40, '] : ['rgba(232, 50, 58, ', 'rgba(255, 228, 92, '];
		for (const [color, width, lift] of [
			[outer, 7, height * 0.55],
			[inner, 3, height * 0.7],
			[inner, 2, height * 0.35]
		] as const) {
			ctx.strokeStyle = `${color}${0.55 * fade})`;
			ctx.lineWidth = width * fade;
			ctx.beginPath();
			ctx.moveTo(a.x, a.y - lift);
			ctx.lineTo(b.x, b.y - lift);
			ctx.stroke();
		}
	}
	ctx.restore();
}

/** Lightning, tornadoes, shockwaves and mace arcs. */
export function drawHeroFx(ctx: CanvasRenderingContext2D, list: readonly HeroFx[], time: number) {
	for (const f of list) {
		// Not started yet (one of a staggered set)
		if (f.age < 0) continue;
		const k = f.age / f.life;
		const fade = 1 - k;
		ctx.save();
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		switch (f.kind) {
			case 'bolt': {
				const lift = f.lift ?? 36;
				ctx.shadowColor = f.red ? '#ff2a2a' : SPEED_YELLOW;
				ctx.shadowBlur = 14;
				ctx.strokeStyle = f.red ? `rgba(230, 30, 40, ${0.85 * fade})` : `rgba(255, 150, 40, ${0.8 * fade})`;
				ctx.lineWidth = 5;
				lightning(ctx, f.x, f.y - lift, f.x2!, f.y2! - lift, Math.floor(time * 30));
				ctx.strokeStyle = `rgba(255, 250, 210, ${fade})`;
				ctx.lineWidth = 2;
				lightning(ctx, f.x, f.y - lift, f.x2!, f.y2! - lift, Math.floor(time * 30));
				break;
			}
			case 'zip': {
				// A blur where he went: red with a yellow core
				const lift = FIGURE_HEIGHT * 0.5;
				ctx.strokeStyle = f.red ? `rgba(240, 200, 30, ${0.5 * fade})` : `rgba(232, 50, 58, ${0.5 * fade})`;
				ctx.lineWidth = 14 * fade;
				ctx.beginPath();
				ctx.moveTo(f.x, f.y - lift);
				ctx.lineTo(f.x2!, f.y2! - lift);
				ctx.stroke();
				ctx.strokeStyle = f.red ? `rgba(230, 30, 40, ${0.85 * fade})` : `rgba(255, 228, 92, ${0.8 * fade})`;
				ctx.lineWidth = 2;
				lightning(ctx, f.x, f.y - lift, f.x2!, f.y2! - lift, f.x, 6);
				break;
			}
			case 'tornado': {
				// A spinning column of wind and lightning
				const r = f.radius ?? 150;
				const grow = Math.min(1, f.age / 0.3) * (k > 0.85 ? (1 - k) / 0.15 : 1);
				for (let ring = 0; ring < 7; ring++) {
					const h = ring * 22;
					const rr = r * (0.45 + ring * 0.1) * grow;
					ctx.strokeStyle = `rgba(230, 236, 245, ${0.28 * grow})`;
					ctx.lineWidth = 3;
					ctx.beginPath();
					const spin = time * 14 + ring;
					ctx.ellipse(f.x, f.y - h, rr, rr * 0.35, 0, spin, spin + 4.2);
					ctx.stroke();
				}
				if (Math.sin(time * 40) > 0) {
					ctx.strokeStyle = `rgba(255, 228, 92, ${0.7 * grow})`;
					ctx.lineWidth = 1.5;
					const a = time * 17;
					lightning(ctx, f.x + Math.cos(a) * r * 0.5, f.y - 20, f.x - Math.cos(a) * r * 0.4, f.y - 130, time, 8);
				}
				break;
			}
			case 'quake':
			case 'thunder': {
				// A ring of force where she landed, lightning forking out along the ground
				const r = (f.radius ?? 120) * (0.3 + 0.7 * Math.min(1, k * 2.5));
				ctx.strokeStyle = f.gold ? `rgba(255, 215, 102, ${0.9 * fade})` : `rgba(255, 240, 138, ${0.8 * fade})`;
				ctx.shadowColor = f.gold ? LASSO_GOLD : NTH_GLOW;
				ctx.shadowBlur = 12;
				ctx.lineWidth = 4 * fade + 1;
				ctx.beginPath();
				ctx.ellipse(f.x, f.y, r, r * 0.45, 0, 0, TAU);
				ctx.stroke();
				ctx.lineWidth = 1.6;
				const forks = f.kind === 'thunder' ? 8 : 5;
				for (let i = 0; i < forks; i++) {
					const a = (i / forks) * TAU + f.x;
					lightning(ctx, f.x, f.y - 10, f.x + Math.cos(a) * r, f.y + Math.sin(a) * r * 0.45, i + Math.floor(time * 20), 7);
				}
				if (f.kind === 'thunder' && k < 0.4) {
					// A bolt down from the sky onto the mace
					ctx.lineWidth = 3;
					lightning(ctx, f.x + 10, f.y - 420, f.x, f.y - 30, Math.floor(time * 25), 16);
				}
				break;
			}
			case 'cut': {
				// A rage blade's arc
				const r = f.radius ?? 70;
				const a = f.angle ?? 0;
				ctx.strokeStyle = f.gold ? `rgba(240, 244, 250, ${0.9 * fade})` : `rgba(255, 60, 60, ${0.9 * fade})`;
				ctx.shadowColor = f.gold ? LASSO_GOLD : '#ff2a2a';
				ctx.shadowBlur = 10;
				ctx.lineWidth = 6 * fade + 1;
				ctx.beginPath();
				ctx.ellipse(f.x, f.y - (f.lift ?? 60), r, r * 0.6, 0, a - 0.9, a + 0.9);
				ctx.stroke();
				break;
			}
			case 'chakram': {
				// A crescent of rage, spinning along a curve to its target
				const lift = f.lift ?? 60;
				const t = Math.min(1, k * 1.4);
				const mx = (f.x + f.x2!) / 2 + (f.y2! - f.y) * 0.25;
				const my = (f.y + f.y2!) / 2 - (f.x2! - f.x) * 0.25 - lift;
				const bx = (1 - t) ** 2 * f.x + 2 * (1 - t) * t * mx + t * t * f.x2!;
				const by = (1 - t) ** 2 * (f.y - lift) + 2 * (1 - t) * t * my + t * t * (f.y2! - 40);
				ctx.strokeStyle = `rgba(255, 70, 70, ${0.4 * fade})`;
				ctx.lineWidth = 3;
				ctx.beginPath();
				ctx.moveTo(f.x, f.y - lift);
				ctx.quadraticCurveTo(mx, my, bx, by);
				ctx.stroke();
				ctx.translate(bx, by);
				ctx.rotate(time * 30);
				ctx.shadowColor = '#ff2a2a';
				ctx.shadowBlur = 12;
				ctx.strokeStyle = `rgba(255, 120, 120, ${fade})`;
				ctx.lineWidth = 4;
				ctx.beginPath();
				ctx.arc(0, 0, 12, 0.4, Math.PI + 0.9);
				ctx.stroke();
				break;
			}
			case 'nova': {
				// A ring of rage bursting out from him
				const r = (f.radius ?? 170) * (0.2 + 0.8 * Math.min(1, k * 2));
				const glow = ctx.createRadialGradient(f.x, f.y - 30, r * 0.2, f.x, f.y - 30, r);
				glow.addColorStop(0, `rgba(255, 40, 40, ${0.35 * fade})`);
				glow.addColorStop(1, 'rgba(255, 40, 40, 0)');
				ctx.fillStyle = glow;
				ctx.beginPath();
				ctx.ellipse(f.x, f.y - 30, r, r * 0.6, 0, 0, TAU);
				ctx.fill();
				ctx.strokeStyle = `rgba(255, 90, 90, ${0.9 * fade})`;
				ctx.shadowColor = '#ff2a2a';
				ctx.shadowBlur = 14;
				ctx.lineWidth = 5 * fade + 1;
				ctx.beginPath();
				ctx.ellipse(f.x, f.y, r, r * 0.45, 0, 0, TAU);
				ctx.stroke();
				break;
			}
			case 'heat': {
				// Twin beams from his eyes
				const lift = f.lift ?? 90;
				const ty = f.y2! - 70;
				ctx.shadowColor = '#ff3b1e';
				ctx.shadowBlur = 12;
				for (const off of [-2.5, 2.5]) {
					ctx.strokeStyle = `rgba(255, 60, 30, ${0.85 * Math.min(1, fade * 2)})`;
					ctx.lineWidth = 3.5;
					ctx.beginPath();
					ctx.moveTo(f.x, f.y - lift + off);
					ctx.lineTo(f.x2!, ty + off);
					ctx.stroke();
					ctx.strokeStyle = `rgba(255, 235, 200, ${Math.min(1, fade * 2)})`;
					ctx.lineWidth = 1.2;
					ctx.stroke();
				}
				// Where it burns
				ctx.fillStyle = `rgba(255, 190, 90, ${0.8 * Math.min(1, fade * 2)})`;
				ctx.beginPath();
				ctx.arc(f.x2!, ty, 7 + Math.sin(time * 40) * 2, 0, TAU);
				ctx.fill();
				break;
			}
			case 'frost': {
				// A cone of cold from his mouth, spreading and thinning
				const r = (f.radius ?? 300) * Math.min(1, 0.25 + k * 2.2);
				const a = f.angle ?? 0;
				const lift = f.lift ?? 80;
				const spread = 0.55;
				ctx.translate(f.x, f.y - lift);
				const cold = ctx.createRadialGradient(0, 0, 8, 0, 0, r);
				cold.addColorStop(0, `rgba(235, 248, 255, ${0.7 * fade})`);
				cold.addColorStop(1, 'rgba(170, 215, 255, 0)');
				ctx.fillStyle = cold;
				ctx.beginPath();
				ctx.moveTo(0, 0);
				// Flattened like everything on the ground plane, and sinking to it
				for (let i = 0; i <= 10; i++) {
					const b = a - spread + (i / 10) * spread * 2;
					ctx.lineTo(Math.cos(b) * r, Math.sin(b) * r * 0.7 + (lift - 30) * (r / (f.radius ?? 300)));
				}
				ctx.closePath();
				ctx.fill();
				ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * fade})`;
				for (let i = 0; i < 14; i++) {
					const b = a - spread + ((i * 0.37 + f.x * 0.01) % 1) * spread * 2;
					const d = r * (0.2 + ((i * 0.61 + k) % 1) * 0.8);
					ctx.fillRect(Math.cos(b) * d, Math.sin(b) * d * 0.7 + (lift - 30) * (d / (f.radius ?? 300)), 2.5, 2.5);
				}
				break;
			}
			case 'lasso': {
				// The golden lasso: a glowing rope from her hand to a loop round them
				const [a, b] = f.track ?? [{ x: f.x, y: f.y }, { x: f.x2!, y: f.y2! }];
				const lift = f.lift ?? 60;
				const reach = Math.min(1, f.age / 0.12);
				const bx = a.x + (b.x - a.x) * reach;
				const by = a.y - lift + (b.y - 60 - (a.y - lift)) * reach;
				ctx.strokeStyle = `rgba(255, 215, 102, ${Math.min(1, fade * 3)})`;
				ctx.shadowColor = LASSO_GOLD;
				ctx.shadowBlur = 10;
				ctx.lineWidth = 2.5;
				ctx.beginPath();
				ctx.moveTo(a.x, a.y - lift);
				ctx.quadraticCurveTo((a.x + bx) / 2, Math.min(a.y - lift, by) - 26 + Math.sin(time * 18) * 5, bx, by);
				ctx.stroke();
				if (reach >= 1) {
					ctx.beginPath();
					ctx.ellipse(b.x, b.y - 60, 24, 9, 0, 0, TAU);
					ctx.stroke();
				}
				break;
			}
			case 'boom': {
				// An explosion: a fireball swelling and thinning, a ring of fire along the ground
				const r = (f.radius ?? 120) * (0.35 + 0.65 * Math.min(1, k * 2));
				const cy = f.y - 30 - 40 * k;
				const fire = ctx.createRadialGradient(f.x, cy, 0, f.x, cy, r);
				fire.addColorStop(0, `rgba(255, 250, 220, ${fade})`);
				fire.addColorStop(0.35, `rgba(255, 170, 50, ${0.85 * fade})`);
				fire.addColorStop(0.75, `rgba(200, 60, 20, ${0.45 * fade})`);
				fire.addColorStop(1, 'rgba(60, 30, 20, 0)');
				ctx.fillStyle = fire;
				ctx.beginPath();
				ctx.arc(f.x, cy, r, 0, TAU);
				ctx.fill();
				ctx.strokeStyle = `rgba(255, 190, 90, ${0.8 * fade})`;
				ctx.lineWidth = 4 * fade + 1;
				ctx.beginPath();
				ctx.ellipse(f.x, f.y, r * 1.1, r * 0.48, 0, 0, TAU);
				ctx.stroke();
				break;
			}
			case 'spark': {
				// A shot bursting on her bracelets
				const lift = f.lift ?? 40;
				ctx.strokeStyle = `rgba(255, 225, 140, ${fade})`;
				ctx.shadowColor = LASSO_GOLD;
				ctx.shadowBlur = 8;
				ctx.lineWidth = 1.6;
				for (let i = 0; i < 6; i++) {
					const a = (i / 6) * TAU + f.x;
					ctx.beginPath();
					ctx.moveTo(f.x + Math.cos(a) * 4, f.y - lift + Math.sin(a) * 4);
					ctx.lineTo(f.x + Math.cos(a) * (8 + 16 * k), f.y - lift + Math.sin(a) * (8 + 16 * k));
					ctx.stroke();
				}
				break;
			}
			case 'mace': {
				// The swing's arc, crackling
				const r = f.radius ?? 80;
				const lift = f.lift ?? 60;
				const a = f.angle ?? 0;
				ctx.strokeStyle = `rgba(255, 240, 138, ${0.85 * fade})`;
				ctx.shadowColor = NTH_GLOW;
				ctx.shadowBlur = 10;
				ctx.lineWidth = 5 * fade + 1;
				ctx.beginPath();
				ctx.ellipse(f.x, f.y - lift, r, r * 0.6, 0, a - 1 + k * 0.4, a + 0.9 * Math.min(1, k * 4));
				ctx.stroke();
				break;
			}
		}
		ctx.restore();
	}
}

// -------------------------------------------------------------- Reverse-Flash

const RF_TRAIL = new WeakMap<Enemy, { x: number; y: number; t: number }[]>();
const RF_LOOK: Look = { skin: '#e2b48e', hair: '#e2b48e', hairStyle: 'cropped', mask: false };

/** Reverse-Flash: the Flash's suit in reverse, running on his feet, a red and gold streak behind him. */
export function drawReverseFlash(ctx: CanvasRenderingContext2D, e: Enemy, x: number, y: number, hasGround: boolean, time: number) {
	const speed = Math.hypot(e.vx, e.vy);
	const base = enemyPose(e, hasGround, time);
	const pose: LanternPose = {
		...base,
		altitude: 0,
		hoverHeight: 0,
		lean: 0,
		walkPhase: speed > 14 ? time * Math.min(speed, 600) * 0.05 + e.homeX : 0,
		glow: false
	};
	// The streak: where he's been in the last quarter second
	const trail = RF_TRAIL.get(e) ?? [];
	RF_TRAIL.set(e, trail);
	if (speed > 280 && isStanding(e)) trail.push({ x, y, t: time });
	while (trail.length && time - trail[0].t > 0.25) trail.shift();
	if (trail.length > 1) drawSpeedTrail(ctx, trail.map((p) => ({ x: p.x, y: p.y, age: Math.max(0, time - p.t) })), FIGURE_HEIGHT, true);

	const defeated = !isStanding(e);
	const s = FIGURE_SCALE;
	const sk = computeSkeleton(pose, time);
	ctx.save();
	ctx.globalAlpha = defeated ? Math.min(1, e.down / 0.5) : 1;
	ctx.translate(x, y);
	ctx.scale(s, s);
	if (hasGround) {
		ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
		ctx.beginPath();
		ctx.ellipse(0, 0, 12, 3.8, 0, 0, TAU);
		ctx.fill();
	}
	ctx.scale(pose.dir * turnScale(pose), 1);
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';
	// A hit makes him flicker
	if (e.flash > 0) ctx.globalAlpha *= 0.55;
	drawSpeedsterBody(ctx, sk, RF_LOOK, time, REVERSE_FLASH_COLORS);
	ctx.restore();
}

/** Where Reverse-Flash's hand is, and the top of his head (for his tells and name). */
export function reverseFlashHand(e: Enemy, x: number, y: number): [number, number] {
	return [x + e.dir * 16, y - 52];
}
export const reverseFlashTop = (y: number) => y - FIGURE_HEIGHT - 6;

// ---------------------------------------------------------------------- Razer

const RAZER_FIGURES = new WeakMap<Player, Enemy>();

/**
 * Razer fighting on your side: the same figure as the boss (drawLieutenant),
 * posed from the player he is now. His blades flare while he's cutting.
 */
export function drawRazerAlly(ctx: CanvasRenderingContext2D, p: Player, x: number, y: number, hasGround: boolean, time: number) {
	let e = RAZER_FIGURES.get(p);
	if (!e) RAZER_FIGURES.set(p, (e = createEnemy('razer', x, y)));
	const move = p.hero?.move?.power;
	e.x = x;
	e.y = y;
	e.dir = p.dir;
	e.vx = p.vx;
	e.vy = p.vy;
	e.flash = p.hurtTimer > 0.2 ? 0.1 : 0;
	e.hp = p.downed ? 0 : e.maxHp;
	e.down = p.downed ? 0.45 : 0;
	e.brain.aimX = p.aimX;
	e.brain.aimY = p.aimY;
	e.brain.rage = 0.4;
	// The blades blaze while he cuts; an orb gathers for a chakram or the nova
	e.brain.state = move === 'blades' ? 'act' : move === 'chakram' || move === 'nova' ? 'windup' : 'move';
	e.brain.ability = move === 'blades' ? 'twinBlades' : move === 'chakram' ? 'chakram' : move === 'nova' ? 'crimsonNova' : null;
	e.brain.timer = 0.2;
	// Enemies hover low; he flies at a Lantern's height, where his hitbox is
	const lift = Math.max(0, p.bodyBottom - 16);
	if (hasGround && lift > 0) {
		ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
		ctx.beginPath();
		ctx.ellipse(x, y, 13, 4, 0, 0, TAU);
		ctx.fill();
	}
	drawLieutenant(ctx, e, x, y - lift, hasGround && lift === 0, time);
}
