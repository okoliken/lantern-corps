// J'onn J'onzz, the Martian Manhunter (season two, Fire Season): green skin,
// the heavy brow, red eyes, the red X of straps across his chest with the
// gold clasp, a deep blue cape, dark blue trunks and boots. When he's afraid
// (fire) he shrinks into himself and his eyes go dim; when he's phasing he's
// half there.

import { HEAD_R, type LanternPose, type Point, type Skeleton } from '../animation';
import type { Look } from '../lanterns';
import { frame, torsoShape } from './heroes';
import { drawCape } from './league';
import { lerpP, poly, segment } from './lantern';

const TAU = Math.PI * 2;
const OUTLINE = '#030504';
const SKIN = '#3f8a4a';
const SKIN_LIT = '#5aa863';
const SKIN_DARK = '#2c6534';
const STRAP = '#b8231c';
const STRAP_DARK = '#7d1712';
const GOLD = '#e0b13a';
const CAPE_BLUE = '#1f3f8c';
const CAPE_DEEP = '#132757';
const TRUNKS = '#1a2340';
const EYES = '#ff3a2a';

export interface JonnLook {
	/** 0..1: frozen by fire, eyes dim, hunched. */
	afraid: number;
	/** 0..1: phasing, half through the world. */
	phase: number;
}

/** J'onn on the shared skeleton (the caller has translated, scaled and mirrored). */
export function drawJonnBody(ctx: CanvasRenderingContext2D, sk: Skeleton, _look: Look, time: number, pose: LanternPose, state: JonnLook) {
	ctx.save();
	if (state.phase > 0) ctx.globalAlpha *= 1 - 0.6 * state.phase;
	drawCape(ctx, sk, time, pose, [CAPE_BLUE, CAPE_DEEP]);
	arm(ctx, sk.back, true);
	leg(ctx, sk.back, true);
	torso(ctx, sk);
	leg(ctx, sk.front, false);
	head(ctx, sk, time, state);
	arm(ctx, sk.front, false);
	// Phasing: a shimmer of his own green running down him
	if (state.phase > 0) {
		ctx.strokeStyle = `rgba(120, 220, 140, ${0.6 * state.phase})`;
		ctx.lineWidth = 0.8;
		for (let i = 0; i < 5; i++) {
			const y = sk.headCenter[1] + ((time * 30 + i * 9) % 46);
			ctx.beginPath();
			ctx.moveTo(-8, y);
			ctx.lineTo(8, y);
			ctx.stroke();
		}
	}
	ctx.restore();
}

function arm(ctx: CanvasRenderingContext2D, l: Skeleton['front'], far: boolean) {
	segment(ctx, l.shoulder, l.elbow, 3.4, 2.8, far ? SKIN_DARK : SKIN);
	segment(ctx, l.elbow, l.hand, 2.8, 2.5, far ? SKIN_DARK : SKIN_LIT);
	ctx.fillStyle = far ? SKIN_DARK : SKIN_LIT;
	ctx.beginPath();
	ctx.arc(l.hand[0], l.hand[1], 2.4, 0, TAU);
	ctx.fill();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.stroke();
}

function leg(ctx: CanvasRenderingContext2D, l: Skeleton['front'], far: boolean) {
	segment(ctx, l.hipJoint, l.knee, 4, 3.2, far ? SKIN_DARK : SKIN);
	const bootTop = lerpP(l.knee, l.foot, 0.35);
	segment(ctx, l.knee, bootTop, 3.2, 3, far ? SKIN_DARK : SKIN);
	segment(ctx, bootTop, l.foot, 3.1, 2.7, far ? '#0f1528' : TRUNKS);
	const shin = Math.atan2(l.foot[1] - l.knee[1], l.foot[0] - l.knee[0]);
	const toe: Point = [l.foot[0] + Math.cos(shin - Math.PI / 2) * 4.6, l.foot[1] + Math.sin(shin - Math.PI / 2) * 4.6];
	segment(ctx, l.foot, toe, 2.3, 1.6, far ? '#0f1528' : TRUNKS);
}

function torso(ctx: CanvasRenderingContext2D, sk: Skeleton) {
	const at = frame(sk);
	const body = torsoShape(at, -0.6);
	const [bx, by] = at(8, -6);
	const [fx, fy] = at(8, 7);
	const shade = ctx.createLinearGradient(bx, by, fx, fy);
	shade.addColorStop(0, SKIN_DARK);
	shade.addColorStop(1, SKIN_LIT);
	ctx.fillStyle = shade;
	ctx.fill(body);
	ctx.save();
	ctx.clip(body);
	// Trunks
	ctx.fillStyle = TRUNKS;
	ctx.fill(poly([at(3.2, -6), at(3.2, 8), at(-2, 8), at(-2, -6)]));
	// The X of straps from the shoulders to the belt, and the gold clasp where they cross
	ctx.strokeStyle = STRAP;
	ctx.lineWidth = 2.2;
	ctx.beginPath();
	ctx.moveTo(...at(18.5, -4.5));
	ctx.lineTo(...at(3, 6.5));
	ctx.moveTo(...at(18.5, 6.5));
	ctx.lineTo(...at(3, -4.5));
	ctx.stroke();
	ctx.strokeStyle = STRAP_DARK;
	ctx.lineWidth = 0.5;
	ctx.stroke();
	ctx.fillStyle = STRAP;
	ctx.fill(poly([at(3.6, -6), at(3.6, 8), at(2.2, 8), at(2.2, -6)]));
	ctx.restore();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.9;
	ctx.stroke(body);
	const [cx, cy] = at(10.8, 1);
	ctx.fillStyle = GOLD;
	ctx.beginPath();
	ctx.arc(cx, cy, 1.9, 0, TAU);
	ctx.fill();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.5;
	ctx.stroke();
	segment(ctx, sk.neck, lerpP(sk.neck, sk.headCenter, 0.45), 2.1, 2, SKIN);
}

function head(ctx: CanvasRenderingContext2D, sk: Skeleton, time: number, state: JonnLook) {
	const R = HEAD_R;
	ctx.save();
	ctx.translate(...sk.headCenter);
	ctx.rotate(sk.headAngle);
	// Bald, a high crown, a heavy ridged brow and a long jaw
	ctx.fillStyle = SKIN;
	ctx.beginPath();
	ctx.moveTo(-R * 0.95, 0);
	ctx.quadraticCurveTo(-R * 1.05, -R * 1.35, R * 0.1, -R * 1.3);
	ctx.quadraticCurveTo(R * 1.05, -R * 1.2, R * 1.15, -R * 0.15);
	ctx.lineTo(R * 1.45, R * 0.05);
	ctx.lineTo(R * 1.1, R * 0.4);
	ctx.quadraticCurveTo(R * 1.15, R * 1.3, R * 0.55, R * 1.55);
	ctx.quadraticCurveTo(-R * 0.2, R * 1.55, -R * 0.5, R * 1.0);
	ctx.quadraticCurveTo(-R * 1.05, R * 0.6, -R * 0.95, 0);
	ctx.closePath();
	ctx.fill();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.stroke();
	// The brow ridge, a dark shelf over the eyes
	ctx.fillStyle = SKIN_DARK;
	ctx.beginPath();
	ctx.moveTo(R * 0.1, -R * 0.45);
	ctx.quadraticCurveTo(R * 0.8, -R * 0.75, R * 1.3, -R * 0.2);
	ctx.lineTo(R * 1.15, -R * 0.05);
	ctx.quadraticCurveTo(R * 0.7, -R * 0.4, R * 0.15, -R * 0.25);
	ctx.closePath();
	ctx.fill();
	// The eyes: red, and glowing (dim when he's afraid)
	ctx.save();
	const glow = (1 - state.afraid * 0.8) * (0.85 + 0.15 * Math.sin(time * 3));
	ctx.shadowColor = EYES;
	ctx.shadowBlur = 5 * glow;
	ctx.fillStyle = `rgba(255, 58, 42, ${0.35 + 0.65 * glow})`;
	ctx.beginPath();
	ctx.ellipse(R * 0.85, -R * 0.02, R * 0.26, R * 0.13, -0.1, 0, TAU);
	ctx.fill();
	ctx.restore();
	// A hard mouth line
	ctx.strokeStyle = SKIN_DARK;
	ctx.lineWidth = 0.7;
	ctx.beginPath();
	ctx.moveTo(R * 0.7, R * 0.95);
	ctx.lineTo(R * 1.05, R * 0.9);
	ctx.stroke();
	ctx.restore();
}
