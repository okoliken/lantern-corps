// Draws a Lantern side-on over their animated skeleton (see animation.ts).
//
// The world is seen from above, but characters are upright and face left or
// right, like project-7. Everything is drawn facing RIGHT; facing left just
// mirrors the canvas with scale(-1, 1).
//
// Draw order gives depth without any 3D: the far arm and leg first (a bit
// darker), then the torso, then the near leg, head, and ring arm on top.
//
// The origin (x, y) is the Lantern's ANCHOR: their feet when walking, the
// spot below them when flying.

import { HEAD_R, STANDING_HEIGHT, computeSkeleton, turnScale, type LanternPose, type Point, type Skeleton } from '../animation';
import type { LanternDef } from '../lanterns';

export type { LanternPose } from '../animation';

export const GREEN = '#3dff6e';

/** Size multiplier for the whole figure. */
const FIGURE_SCALE = 1.35;
/** Height from feet to top of head, in world pixels, when standing. */
export const FIGURE_HEIGHT = STANDING_HEIGHT * FIGURE_SCALE;
/** How high Lanterns float, before scaling. Over a planet they fly higher so it reads as airborne. */
export const HOVER_SPACE = 8;
export const HOVER_PLANET = 58;
/** Half the figure's width, used to keep them on screen. */
export const FIGURE_HALF_WIDTH = 10 * FIGURE_SCALE;

// ---- Suit palette ----
const BLACK = '#0d1210';
const BLACK_LIT = '#24302b';
/** Classic bottle green (the traditional comic suit shade). */
const SUIT_GREEN = '#0F4F34';
const SUIT_GREEN_LIT = '#1d7a50';
const SUIT_GREEN_DARK = '#0b3a27';
const OUTLINE = '#030504';
const WHITE = '#eafff0';

/** Where the ring is in WORLD coordinates. Beams and bolts start here. */
export function ringPosition(x: number, y: number, pose: LanternPose, time: number, scale = 1): Point {
	const s = FIGURE_SCALE * scale;
	const [hx, hy] = computeSkeleton(pose, time).front.hand;
	return [x + hx * pose.dir * turnScale(pose) * s, y + hy * s];
}

export function drawLantern(
	ctx: CanvasRenderingContext2D,
	def: LanternDef,
	x: number,
	y: number,
	pose: LanternPose,
	time: number,
	scale = 1
) {
	const s = FIGURE_SCALE * scale;
	const sk = computeSkeleton(pose, time);
	const air = pose.altitude;
	const pulse = 0.75 + 0.25 * Math.sin(time * 4);
	const cast = pose.cast ?? 0;
	const ringActive = pose.firing || cast > 0 || (pose.glow && air > 0.5);

	ctx.save();
	ctx.translate(x, y);
	ctx.scale(s, s);

	// ---- Ground shadow (not mirrored: it belongs to the floor) ----
	if (pose.shadow) {
		const k = 1 - 0.35 * air;
		const spread = pose.downed ? 1.9 : 1;
		ctx.fillStyle = `rgba(0, 0, 0, ${0.45 * k})`;
		ctx.beginPath();
		ctx.ellipse(0, 0, 12 * k * spread, 3.8 * k, 0, 0, Math.PI * 2);
		ctx.fill();
	}

	ctx.scale(pose.dir * turnScale(pose), 1);

	// ---- Aura while airborne ----
	if (pose.glow && air > 0 && !pose.downed) {
		const [cx, cy] = mid(sk.hip, sk.neck);
		const aura = ctx.createRadialGradient(cx, cy, 4, cx, cy, 40);
		aura.addColorStop(0, `rgba(61, 255, 110, ${0.26 * pulse * air})`);
		aura.addColorStop(1, 'rgba(61, 255, 110, 0)');
		ctx.fillStyle = aura;
		ctx.beginPath();
		ctx.arc(cx, cy, 40, 0, Math.PI * 2);
		ctx.fill();
	}

	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';

	// ---- Far side (shaded darker) ----
	drawArm(ctx, sk.back, true);
	drawLeg(ctx, sk.back, true);

	// ---- Body, near side on top ----
	drawTorso(ctx, sk, def);
	drawLeg(ctx, sk.front, false);
	drawHead(ctx, sk, def, ringActive, pulse);
	drawArm(ctx, sk.front, false);
	drawRing(ctx, sk.front.hand, ringActive, pulse, cast);

	ctx.restore();
}

// ------------------------------------------------------------------ parts

/**
 * A tapered limb segment: a capsule from a (radius ra) to b (radius rb),
 * outlined so it reads on any background.
 */
export function segment(ctx: CanvasRenderingContext2D, a: Point, b: Point, ra: number, rb: number, fill: string | CanvasGradient) {
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	const len = Math.hypot(dx, dy) || 1;
	const nx = -dy / len;
	const ny = dx / len;
	const angle = Math.atan2(dy, dx);
	ctx.beginPath();
	ctx.moveTo(a[0] + nx * ra, a[1] + ny * ra);
	ctx.lineTo(b[0] + nx * rb, b[1] + ny * rb);
	ctx.arc(b[0], b[1], rb, angle + Math.PI / 2, angle - Math.PI / 2, true);
	ctx.lineTo(a[0] - nx * ra, a[1] - ny * ra);
	ctx.arc(a[0], a[1], ra, angle - Math.PI / 2, angle + Math.PI / 2, true);
	ctx.closePath();
	ctx.fillStyle = fill;
	ctx.fill();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.stroke();
}

function drawLeg(ctx: CanvasRenderingContext2D, l: Skeleton['front'], far: boolean) {
	const black = far ? BLACK : BLACK_LIT;
	const green = far ? SUIT_GREEN_DARK : SUIT_GREEN;
	// Thigh, then the shin split into black suit and green boot
	segment(ctx, l.hipJoint, l.knee, 3.9, 3.0, black);
	const bootTop = lerpP(l.knee, l.foot, 0.4);
	segment(ctx, l.knee, bootTop, 3.0, 2.7, black);
	segment(ctx, bootTop, l.foot, 3.0, 2.5, green);

	// Foot points forward, square to the shin
	const shinAngle = Math.atan2(l.foot[1] - l.knee[1], l.foot[0] - l.knee[0]);
	const toeAngle = shinAngle - Math.PI / 2;
	const toe: Point = [l.foot[0] + Math.cos(toeAngle) * 4.2, l.foot[1] + Math.sin(toeAngle) * 4.2];
	segment(ctx, l.foot, toe, 2.3, 1.6, green);
}

function drawArm(ctx: CanvasRenderingContext2D, l: Skeleton['front'], far: boolean) {
	const black = far ? BLACK : BLACK_LIT;
	segment(ctx, l.shoulder, l.elbow, 3.1, 2.5, black);
	segment(ctx, l.elbow, l.hand, 2.4, 2.1, black);
	// Glove: green cuff and fist
	const cuff = lerpP(l.elbow, l.hand, 0.62);
	segment(ctx, cuff, l.hand, 2.5, 2.2, far ? SUIT_GREEN_DARK : SUIT_GREEN);
	ctx.fillStyle = far ? SUIT_GREEN_DARK : SUIT_GREEN_LIT;
	ctx.beginPath();
	ctx.arc(l.hand[0], l.hand[1], 2.5, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.stroke();
}

function drawTorso(ctx: CanvasRenderingContext2D, sk: Skeleton, def: LanternDef) {
	const { hip, neck, torsoAngle } = sk;
	const up: Point = [Math.sin(torsoAngle), -Math.cos(torsoAngle)];
	const across: Point = [Math.cos(torsoAngle), Math.sin(torsoAngle)];
	/** A point `along` the spine from the hip, `side` toward the front (+) or back (-). */
	const at = (along: number, side: number): Point => [
		hip[0] + up[0] * along + across[0] * side,
		hip[1] + up[1] * along + across[1] * side
	];

	// Silhouette: narrow waist, broad chest and shoulders; the chest pushes forward
	const body = poly([
		at(-1.5, -4.6), // back of hips
		at(6, -4.4), // small of back
		at(14, -6.2), // upper back
		at(18.2, -4.4), // back of shoulders
		at(18.8, 3.2), // front of shoulders
		at(14.5, 7.8), // chest
		at(8.5, 6.2), // ribs
		at(3, 5.2), // belly
		at(-1.5, 5) // front of hips
	]);

	// Lit from the front: a gradient across the body
	const [bx, by] = at(8, -6);
	const [fx, fy] = at(8, 7);
	const shade = ctx.createLinearGradient(bx, by, fx, fy);
	shade.addColorStop(0, BLACK);
	shade.addColorStop(1, BLACK_LIT);
	ctx.fillStyle = shade;
	ctx.fill(body);

	// Green panel. Hal: classic green upper body, black below the chest.
	// John: a green panel down the front of the chest, black shoulders,
	// animated-series style.
	const panel =
		def.id === 'hal'
			? poly([at(9, -5.6), at(14, -6.2), at(18.2, -4.4), at(18.8, 3.2), at(14.5, 7.8), at(9.5, 6.4)])
			: poly([at(3.2, 2.6), at(15.5, 2.4), at(18.6, 3.2), at(14.5, 7.8), at(8.5, 6.2), at(3, 5.2)]);
	const greenShade = ctx.createLinearGradient(bx, by, fx, fy);
	greenShade.addColorStop(0, SUIT_GREEN_DARK);
	greenShade.addColorStop(1, SUIT_GREEN_LIT);
	ctx.fillStyle = greenShade;
	ctx.fill(panel);

	// Belt
	ctx.strokeStyle = '#050706';
	ctx.lineWidth = 1.6;
	ctx.beginPath();
	ctx.moveTo(...at(1.2, -4.6));
	ctx.lineTo(...at(1.2, 5.1));
	ctx.stroke();

	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.9;
	ctx.stroke(body);

	// Chest emblem: the Corps symbol, on the front of the chest where it shows past the arm
	const [ex, ey] = at(13.2, 5.4);
	ctx.save();
	ctx.translate(ex, ey);
	ctx.rotate(torsoAngle);
	ctx.fillStyle = WHITE;
	ctx.beginPath();
	ctx.arc(0, 0, 2.7, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = SUIT_GREEN;
	ctx.beginPath();
	ctx.arc(0, 0, 1.9, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = WHITE;
	ctx.fillRect(-2.2, -1.05, 4.4, 0.6);
	ctx.fillRect(-2.2, 0.45, 4.4, 0.6);
	ctx.beginPath();
	ctx.arc(0, 0, 0.75, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();

	// Neck
	segment(ctx, neck, lerpP(neck, sk.headCenter, 0.45), 1.9, 1.8, def.look.skin);
}

function drawHead(ctx: CanvasRenderingContext2D, sk: Skeleton, def: LanternDef, ringActive: boolean, pulse: number) {
	const [hx, hy] = sk.headCenter;
	ctx.save();
	ctx.translate(hx, hy);
	ctx.rotate(sk.headAngle);

	const skin = def.look.skin;
	const R = HEAD_R;

	// Skull and jaw as one shape: round at the back, brow, nose, lips, firm chin
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
	ctx.fillStyle = skin;
	ctx.fill(face);

	// Soft shade along the underside of the jaw
	ctx.save();
	ctx.clip(face);
	ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
	ctx.beginPath();
	ctx.ellipse(0, R + 1.6, R, 1.8, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();

	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.stroke(face);

	// Ear
	ctx.fillStyle = shadeColor(skin, -0.18);
	ctx.beginPath();
	ctx.ellipse(-1.2, 0.8, 1.4, 2, 0, 0, Math.PI * 2);
	ctx.fill();

	drawHair(ctx, def);

	if (def.look.mask) {
		// Hal's domino mask with the white eye
		const mask = new Path2D();
		mask.moveTo(1.2, -1.2);
		mask.quadraticCurveTo(4.5, -2.8, R + 1.1, -1.2);
		mask.lineTo(R + 1, 1.4);
		mask.quadraticCurveTo(4.5, 2, 1.5, 1.2);
		mask.closePath();
		ctx.fillStyle = SUIT_GREEN;
		ctx.fill(mask);
		ctx.strokeStyle = OUTLINE;
		ctx.lineWidth = 0.6;
		ctx.stroke(mask);
		ctx.fillStyle = WHITE;
		ctx.beginPath();
		ctx.ellipse(R - 0.6, -0.1, 1.1, 0.75, -0.15, 0, Math.PI * 2);
		ctx.fill();
	} else {
		// John: no mask. His eyes glow green while the ring is active, like the animated series.
		ctx.fillStyle = shadeColor(skin, -0.35);
		ctx.fillRect(R - 3.1, -2.3, 3.4, 0.9); // brow
		if (ringActive) {
			ctx.save();
			ctx.shadowColor = GREEN;
			ctx.shadowBlur = 6 * pulse;
			ctx.fillStyle = '#b8ffcf';
			ctx.beginPath();
			ctx.ellipse(R - 0.9, -0.2, 1.2, 0.7, 0, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();
		} else {
			ctx.fillStyle = '#f2efe6';
			ctx.beginPath();
			ctx.ellipse(R - 0.9, -0.2, 1.1, 0.65, 0, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = '#1a0f08';
			ctx.beginPath();
			ctx.arc(R - 0.4, -0.2, 0.5, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	// Mouth
	ctx.strokeStyle = shadeColor(skin, -0.4);
	ctx.lineWidth = 0.5;
	ctx.beginPath();
	ctx.moveTo(R - 1.6, 4.3);
	ctx.lineTo(R + 0.4, 4.1);
	ctx.stroke();

	ctx.restore();
}

function drawHair(ctx: CanvasRenderingContext2D, def: LanternDef) {
	const R = HEAD_R;
	const hair = new Path2D();
	if (def.look.hairStyle === 'swept') {
		// Hal: short at the back and sides, a swept wave up at the front
		hair.moveTo(-R - 0.2, 1.4);
		hair.quadraticCurveTo(-R - 0.9, -3.5, -2.5, -R - 0.4);
		hair.quadraticCurveTo(1.5, -R - 1.4, R - 0.2, -R - 1.6);
		hair.quadraticCurveTo(R + 1.6, -R - 0.9, R + 0.6, -R + 1.6);
		hair.quadraticCurveTo(3.2, -3.3, 0.8, -2.2);
		hair.quadraticCurveTo(-1.6, -1.2, -1.4, 2.2);
		hair.closePath();
	} else {
		// John: close-cropped, tight to the skull with a sharp line-up
		hair.moveTo(-R - 0.2, 1.2);
		hair.arc(0, 0, R + 0.35, Math.PI * 0.93, Math.PI * 1.78);
		hair.lineTo(R - 0.8, -3.2);
		hair.quadraticCurveTo(1.5, -3.8, 0.2, -2.2);
		hair.lineTo(-0.4, 1.4);
		hair.closePath();
	}
	ctx.fillStyle = def.look.hair;
	ctx.fill(hair);
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.6;
	ctx.stroke(hair);
	// A little shine so dark hair still reads
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
	ctx.lineWidth = 0.8;
	ctx.beginPath();
	ctx.arc(0, 0, R - 0.6, Math.PI * 1.25, Math.PI * 1.55);
	ctx.stroke();
}

function drawRing(ctx: CanvasRenderingContext2D, hand: Point, active: boolean, pulse: number, cast: number) {
	ctx.save();
	if (active) {
		ctx.shadowColor = GREEN;
		ctx.shadowBlur = 10 * pulse;
	}
	ctx.fillStyle = active ? '#d9ffe3' : '#8fdca8';
	ctx.beginPath();
	ctx.arc(hand[0] + 0.6, hand[1] - 0.4, active ? 1.9 : 1.3, 0, Math.PI * 2);
	ctx.fill();

	// Casting a construct: rays of light burst from the ring
	if (cast > 0) {
		ctx.shadowBlur = 16;
		ctx.strokeStyle = `rgba(234, 255, 240, ${0.8 * cast})`;
		ctx.lineWidth = 1;
		for (let i = 0; i < 8; i++) {
			const a = (i / 8) * Math.PI * 2;
			ctx.beginPath();
			ctx.moveTo(hand[0] + Math.cos(a) * 3, hand[1] + Math.sin(a) * 3);
			ctx.lineTo(hand[0] + Math.cos(a) * (3 + 7 * cast), hand[1] + Math.sin(a) * (3 + 7 * cast));
			ctx.stroke();
		}
	}
	ctx.restore();
}

/** Draw the bones and joints over a Lantern (animation lab). */
export function drawSkeletonDebug(ctx: CanvasRenderingContext2D, pose: LanternPose, x: number, y: number, time: number, scale = 1) {
	const sk = computeSkeleton(pose, time);
	const s = FIGURE_SCALE * scale;
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(s * pose.dir, s);
	ctx.strokeStyle = 'rgba(255, 200, 60, 0.9)';
	ctx.fillStyle = 'rgba(255, 90, 60, 0.95)';
	ctx.lineWidth = 0.6;
	const bone = (a: Point, b: Point) => {
		ctx.beginPath();
		ctx.moveTo(...a);
		ctx.lineTo(...b);
		ctx.stroke();
	};
	for (const l of [sk.back, sk.front]) {
		bone(l.shoulder, l.elbow);
		bone(l.elbow, l.hand);
		bone(l.hipJoint, l.knee);
		bone(l.knee, l.foot);
	}
	bone(sk.hip, sk.neck);
	bone(sk.neck, sk.headCenter);
	const joints = [sk.hip, sk.neck, sk.headCenter, ...[sk.back, sk.front].flatMap((l) => [l.shoulder, l.elbow, l.hand, l.knee, l.foot])];
	for (const p of joints) {
		ctx.beginPath();
		ctx.arc(p[0], p[1], 0.9, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.restore();
}

// ---------------------------------------------------------------- helpers

const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const lerpP = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

export function poly(points: Point[]): Path2D {
	const p = new Path2D();
	points.forEach(([x, y], i) => (i === 0 ? p.moveTo(x, y) : p.lineTo(x, y)));
	p.closePath();
	return p;
}

/** Lighten (amount > 0) or darken (amount < 0) a #rrggbb color. */
function shadeColor(hex: string, amount: number): string {
	const n = parseInt(hex.slice(1), 16);
	const channel = (shift: number) => {
		const c = (n >> shift) & 255;
		const v = amount < 0 ? c * (1 + amount) : c + (255 - c) * amount;
		return Math.round(Math.min(255, Math.max(0, v)));
	};
	return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

/** Name tag above a Lantern's head. `lift` is how high they're floating (world px). */
export function drawNameTag(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, lift = 0) {
	ctx.save();
	ctx.font = '600 11px system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'bottom';
	ctx.fillStyle = 'rgba(216, 245, 224, 0.85)';
	ctx.fillText(label, x, y - lift - FIGURE_HEIGHT - 8);
	ctx.restore();
}
