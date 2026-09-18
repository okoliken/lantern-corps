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

import { HEAD_R, STANDING_HEIGHT, TORSO, computeSkeleton, turnScale, type LanternPose, type Point, type Skeleton } from '../animation';
import type { Look } from '../lanterns';
import { uiFont } from './fonts';

export type { LanternPose } from '../animation';

/** Anyone drawn in a Lantern's uniform: Hal, John, or a story character like Tomar-Re. */
export interface Figure {
	id: string;
	look: Look;
	/** How broad and heavy they are: 1 = Hal or John; Kilowog is far bigger around. */
	bulk?: number;
	/** Everyday clothes instead of the uniform (before the ring chooses them): no emblem, no ring. */
	outfit?: Outfit;
}

export interface Outfit {
	/** Shirt or jacket, dark and lit sides. */
	top: string;
	topLit: string;
	trousers: string;
	boots: string;
	/** A hard hat (John on the building site). */
	hardHat?: string;
}

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
	def: Figure,
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
	const bulk = def.bulk ?? 1;

	ctx.save();
	ctx.translate(x, y);
	ctx.scale(s, s);

	// ---- Ground shadow (not mirrored: it belongs to the floor) ----
	if (pose.shadow) {
		const k = 1 - 0.35 * air;
		const spread = pose.downed ? 1.9 : 1;
		ctx.fillStyle = `rgba(0, 0, 0, ${0.45 * k})`;
		ctx.beginPath();
		ctx.ellipse(0, 0, 12 * k * spread * bulk, 3.8 * k * Math.sqrt(bulk), 0, 0, Math.PI * 2);
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
	// Limbs thicken less than the body, so a big Lantern is mostly chest and gut
	const arms = 1 + (bulk - 1) * 0.55;
	const legs = 1 + (bulk - 1) * 0.7;
	drawArm(ctx, sk.back, true, arms, def);
	drawLeg(ctx, sk.back, true, legs, def.outfit);

	// ---- Body, near side on top ----
	drawTorso(ctx, sk, def, bulk);
	drawLeg(ctx, sk.front, false, legs, def.outfit);
	drawHead(ctx, sk, def, ringActive && !def.outfit, pulse);
	drawArm(ctx, sk.front, false, arms, def);
	// No ring yet in everyday clothes
	if (!def.outfit) drawRing(ctx, sk.front.hand, ringActive, pulse, cast);

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

function drawLeg(ctx: CanvasRenderingContext2D, l: Skeleton['front'], far: boolean, k: number, outfit?: Outfit) {
	// Suit: black legs, green boots. Everyday clothes: trousers and work boots.
	const black = outfit ? (far ? shadeColor(outfit.trousers, -0.25) : outfit.trousers) : far ? BLACK : BLACK_LIT;
	const green = outfit ? outfit.boots : far ? SUIT_GREEN_DARK : SUIT_GREEN;
	// Thigh, then the shin split into black suit and green boot
	segment(ctx, l.hipJoint, l.knee, 3.9 * k, 3.0 * k, black);
	const bootTop = lerpP(l.knee, l.foot, 0.4);
	segment(ctx, l.knee, bootTop, 3.0 * k, 2.7 * k, black);
	segment(ctx, bootTop, l.foot, 3.0 * k, 2.5 * k, green);

	// Foot points forward, square to the shin
	const shinAngle = Math.atan2(l.foot[1] - l.knee[1], l.foot[0] - l.knee[0]);
	const toeAngle = shinAngle - Math.PI / 2;
	const toe: Point = [l.foot[0] + Math.cos(toeAngle) * 4.2, l.foot[1] + Math.sin(toeAngle) * 4.2];
	segment(ctx, l.foot, toe, 2.3 * k, 1.6 * k, green);
}

function drawArm(ctx: CanvasRenderingContext2D, l: Skeleton['front'], far: boolean, k: number, def: Figure) {
	const o = def.outfit;
	if (o) {
		// Sleeves, and a bare hand
		const sleeve = far ? o.top : o.topLit;
		segment(ctx, l.shoulder, l.elbow, 3.1 * k, 2.6 * k, sleeve);
		segment(ctx, l.elbow, lerpP(l.elbow, l.hand, 0.8), 2.5 * k, 2.2 * k, sleeve);
		ctx.fillStyle = far ? shadeColor(def.look.skin, -0.2) : def.look.skin;
		ctx.beginPath();
		ctx.arc(l.hand[0], l.hand[1], 2.2 * k, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = OUTLINE;
		ctx.lineWidth = 0.8;
		ctx.stroke();
		return;
	}
	const black = far ? BLACK : BLACK_LIT;
	segment(ctx, l.shoulder, l.elbow, 3.1 * k, 2.5 * k, black);
	segment(ctx, l.elbow, l.hand, 2.4 * k, 2.1 * k, black);
	// Glove: green cuff and fist
	const cuff = lerpP(l.elbow, l.hand, 0.62);
	segment(ctx, cuff, l.hand, 2.5 * k, 2.2 * k, far ? SUIT_GREEN_DARK : SUIT_GREEN);
	ctx.fillStyle = far ? SUIT_GREEN_DARK : SUIT_GREEN_LIT;
	ctx.beginPath();
	ctx.arc(l.hand[0], l.hand[1], 2.5 * k, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.stroke();
}

function drawTorso(ctx: CanvasRenderingContext2D, sk: Skeleton, def: Figure, k: number) {
	const { hip, neck, torsoAngle } = sk;
	const up: Point = [Math.sin(torsoAngle), -Math.cos(torsoAngle)];
	const across: Point = [Math.cos(torsoAngle), Math.sin(torsoAngle)];
	/** A point `along` the spine from the hip, `side` toward the front (+) or back (-). */
	// Everything across the body is scaled by bulk: a big Lantern is broader, not just taller.
	// Along the spine it stretches to fit a longer torso (a build with torso > 1).
	const stretch = Math.hypot(neck[0] - hip[0], neck[1] - hip[1]) / TORSO;
	const at = (along: number, side: number): Point => [
		hip[0] + up[0] * along * stretch + across[0] * side * k,
		hip[1] + up[1] * along * stretch + across[1] * side * k
	];
	// A heavy build carries a gut out front and a hump of muscle over the shoulders
	const gut = Math.max(0, k - 1.2);

	// Silhouette: narrow waist, broad chest and shoulders; the chest pushes forward.
	// A heavy build is all curves: a barrel chest over a round gut.
	const shape = gut > 0 ? rounded : poly;
	const body = shape([
		at(-1.5, -4.6), // back of hips
		at(6, -4.4), // small of back
		at(14, -6.2 - gut * 1.5), // upper back
		at(18.2 + gut * 1.5, -4.4), // back of shoulders
		at(18.8 + gut * 1.5, 3.2), // front of shoulders
		at(14.5, 7.8), // chest
		at(8.5, 6.2 + gut * 4), // ribs
		at(4, 5.2 + gut * 6), // belly
		at(-1.5, 5 + gut * 2) // front of hips
	]);

	// Lit from the front: a gradient across the body
	const [bx, by] = at(8, -6);
	const [fx, fy] = at(8, 7);
	const shade = ctx.createLinearGradient(bx, by, fx, fy);
	const o = def.outfit;
	shade.addColorStop(0, o ? o.top : BLACK);
	shade.addColorStop(1, o ? o.topLit : BLACK_LIT);
	ctx.fillStyle = shade;
	ctx.fill(body);

	if (o) {
		// A work shirt: trousers below the belt, a button line, no emblem
		ctx.save();
		ctx.clip(body);
		ctx.fillStyle = o.trousers;
		ctx.fill(poly([at(-3, -8), at(1.2, -8), at(1.2, 9), at(-3, 9)]));
		ctx.restore();
		ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
		ctx.lineWidth = 0.6;
		ctx.beginPath();
		ctx.moveTo(...at(2, 4.6));
		ctx.lineTo(...at(17, 5.6));
		ctx.stroke();
		ctx.strokeStyle = '#1a120c';
		ctx.lineWidth = 1.4;
		ctx.beginPath();
		ctx.moveTo(...at(1.2, -4.6));
		ctx.lineTo(...at(1.2, 5.1));
		ctx.stroke();
		ctx.strokeStyle = OUTLINE;
		ctx.lineWidth = 0.9;
		ctx.stroke(body);
		segment(ctx, neck, lerpP(neck, sk.headCenter, 0.45), 1.9 * k, 1.8 * k, def.look.skin);
		return;
	}

	// Green panel. Hal and Kilowog: classic green upper body, black below the chest.
	// John: a green panel down the front of the chest, black shoulders,
	// animated-series style.
	const panel =
		def.id === 'hal' || def.id === 'kilowog'
			? shape([at(9, -5.6), at(14, -6.2 - gut * 1.5), at(18.2 + gut * 1.5, -4.4), at(18.8 + gut * 1.5, 3.2), at(14.5, 7.8), at(9.5, 6.4 + gut * 4)])
			: shape([at(3.2, 2.6), at(15.5, 2.4), at(18.6, 3.2), at(14.5, 7.8), at(8.5, 6.2 + gut * 4), at(4, 5.2 + gut * 6)]);
	const greenShade = ctx.createLinearGradient(bx, by, fx, fy);
	greenShade.addColorStop(0, SUIT_GREEN_DARK);
	greenShade.addColorStop(1, SUIT_GREEN_LIT);
	ctx.fillStyle = greenShade;
	ctx.save();
	ctx.clip(body);
	ctx.fill(panel);
	ctx.restore();

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
	ctx.scale(Math.sqrt(k), Math.sqrt(k));
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
	segment(ctx, neck, lerpP(neck, sk.headCenter, 0.45), 1.9 * k, 1.8 * k, def.look.skin);
}

function drawHead(ctx: CanvasRenderingContext2D, sk: Skeleton, def: Figure, ringActive: boolean, pulse: number) {
	const [hx, hy] = sk.headCenter;
	ctx.save();
	ctx.translate(hx, hy);
	ctx.rotate(sk.headAngle);

	const skin = def.look.skin;
	const R = HEAD_R;

	if (def.look.avian) {
		drawAvianHead(ctx, def.look.skin, def.look.avian);
		ctx.restore();
		return;
	}
	if (def.look.bolovaxian) {
		drawBolovaxianHead(ctx, def.look.skin);
		ctx.restore();
		return;
	}

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
	if (def.outfit?.hardHat) drawHardHat(ctx, def.outfit.hardHat);

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

	if (def.look.mustache) {
		ctx.strokeStyle = def.look.hair;
		ctx.lineWidth = 0.7;
		ctx.beginPath();
		ctx.moveTo(R - 2.2, 3.5);
		ctx.quadraticCurveTo(R - 0.6, 3.1, R + 0.9, 3.4);
		ctx.stroke();
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

/** A bird-like alien's head (Tomar-Re): feathered, a hooked beak, a swept-back crest, big dark eyes. */
function drawAvianHead(ctx: CanvasRenderingContext2D, skin: string, avian: { beak: string; crest: string }) {
	const R = HEAD_R;
	ctx.lineJoin = 'round';

	// Crest: three long feathers swept back from the crown
	ctx.fillStyle = avian.crest;
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.6;
	for (const [tipX, tipY, base] of [
		[-R - 7, -R - 3.5, -1.5],
		[-R - 5.5, -R + 0.5, -3],
		[-R - 3.5, 1.5, -4]
	]) {
		ctx.beginPath();
		ctx.moveTo(base + 3.5, -R + 0.6);
		ctx.quadraticCurveTo(base - 1, -R - 1.5, tipX, tipY);
		ctx.quadraticCurveTo(base, -R + 2.5, base + 1.5, -R + 3);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
	}

	// Head: rounder at the back, narrowing toward the beak
	const head = new Path2D();
	head.moveTo(-R, 1);
	head.arc(0, 0, R, Math.PI * 1.02, Math.PI * 1.9);
	head.quadraticCurveTo(R + 0.6, 0, R - 0.2, 3.4);
	head.quadraticCurveTo(R - 2.5, 6.4, -0.8, 5.6);
	head.quadraticCurveTo(-R, 4.4, -R, 1);
	head.closePath();
	ctx.fillStyle = skin;
	ctx.fill(head);
	ctx.save();
	ctx.clip(head);
	ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
	ctx.beginPath();
	ctx.ellipse(-1, R + 0.5, R, 2.2, 0, 0, Math.PI * 2);
	ctx.fill();
	// A few feather strokes on the cheek
	ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
	ctx.lineWidth = 0.5;
	for (let i = 0; i < 3; i++) {
		ctx.beginPath();
		ctx.moveTo(-1.5 + i * 1.3, 2.2 + i * 0.6);
		ctx.quadraticCurveTo(-3 + i * 1.3, 3.5 + i * 0.6, -4.2 + i * 1.3, 3 + i * 0.6);
		ctx.stroke();
	}
	ctx.restore();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.stroke(head);

	// Beak: long and hooked at the tip
	const beak = new Path2D();
	beak.moveTo(R - 1.4, -1.2);
	beak.quadraticCurveTo(R + 3.5, -1.4, R + 5.2, 1.6);
	beak.quadraticCurveTo(R + 4.2, 1.4, R + 3.6, 2.1);
	beak.quadraticCurveTo(R + 1.5, 2.9, R - 1.2, 3);
	beak.closePath();
	ctx.fillStyle = avian.beak;
	ctx.fill(beak);
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.6;
	ctx.stroke(beak);
	ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
	ctx.beginPath();
	ctx.moveTo(R - 1, 1.3);
	ctx.lineTo(R + 3.4, 1.8);
	ctx.stroke();

	// Big dark eye with a glint
	ctx.fillStyle = '#10150f';
	ctx.beginPath();
	ctx.ellipse(R - 2.8, -1.4, 1.35, 1.5, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = '#eafff0';
	ctx.beginPath();
	ctx.arc(R - 2.4, -1.9, 0.45, 0, Math.PI * 2);
	ctx.fill();
}

/** Kilowog's head: big and bald, a heavy brow over small eyes, a flat snout, a jutting jaw. */
function drawBolovaxianHead(ctx: CanvasRenderingContext2D, skin: string) {
	ctx.scale(1.3, 1.3);
	const R = HEAD_R;
	ctx.lineJoin = 'round';

	const head = new Path2D();
	head.moveTo(-R, 2);
	head.arc(0, -0.5, R, Math.PI * 1.0, Math.PI * 1.85);
	head.lineTo(R + 1, -2.4); // brow ridge juts out
	head.lineTo(R + 0.5, -0.6);
	head.quadraticCurveTo(R + 2.8, 0, R + 2.4, 2.2); // flat snout
	head.lineTo(R + 0.8, 2.8);
	head.lineTo(R + 1.8, 4.4); // underbite
	head.quadraticCurveTo(R + 1.4, 7.6, R - 2.5, 7.8);
	head.quadraticCurveTo(-1, 8.2, -R * 0.75, 5.2);
	head.quadraticCurveTo(-R - 0.4, 4, -R, 2);
	head.closePath();
	ctx.fillStyle = skin;
	ctx.fill(head);

	// Shading under the brow and along the jaw
	ctx.save();
	ctx.clip(head);
	ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
	ctx.beginPath();
	ctx.ellipse(R - 1.5, -0.6, 3.2, 1.3, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.beginPath();
	ctx.ellipse(0, 8, R, 2.4, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.stroke(head);

	// Ridges over the scalp
	ctx.strokeStyle = shadeColor(skin, -0.25);
	ctx.lineWidth = 0.6;
	for (const a of [1.25, 1.4, 1.55]) {
		ctx.beginPath();
		ctx.arc(0, -0.5, R - 1.2, Math.PI * a, Math.PI * (a + 0.08));
		ctx.stroke();
	}

	// Small eye under the brow, nostril, a stern mouth
	ctx.fillStyle = '#f2efe6';
	ctx.beginPath();
	ctx.ellipse(R - 1.4, -0.9, 0.9, 0.6, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = '#1a0f08';
	ctx.beginPath();
	ctx.arc(R - 1.1, -0.9, 0.45, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = shadeColor(skin, -0.45);
	ctx.beginPath();
	ctx.arc(R + 1.7, 1.4, 0.45, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = shadeColor(skin, -0.45);
	ctx.lineWidth = 0.6;
	ctx.beginPath();
	ctx.moveTo(R - 1.8, 4.8);
	ctx.lineTo(R + 1.2, 4.3);
	ctx.stroke();
}

/** A construction hard hat: a dome with a brim out front. */
function drawHardHat(ctx: CanvasRenderingContext2D, color: string) {
	const R = HEAD_R;
	ctx.fillStyle = color;
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.7;
	ctx.beginPath();
	ctx.arc(0, -1.2, R + 0.6, Math.PI, Math.PI * 2);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.beginPath();
	ctx.roundRect(-R - 1, -1.8, R * 2 + 4.5, 1.6, 0.6);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
	ctx.fillRect(-1, -R - 1.2, 1.4, R - 0.5);
}

function drawHair(ctx: CanvasRenderingContext2D, def: Figure) {
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
	} else if (def.look.hairStyle === 'peak') {
		// Sinestro: slicked straight back, coming to a sharp widow's peak over the brow
		hair.moveTo(-R - 0.3, 1.8);
		hair.arc(0, 0, R + 0.4, Math.PI * 0.95, Math.PI * 1.72);
		hair.lineTo(R - 0.4, -3.8);
		hair.lineTo(1.2, -3.2);
		hair.lineTo(-0.2, -1.6);
		hair.lineTo(-0.8, 1.8);
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

/** A closed shape through the midpoints of `points`, rounded at every corner (a heavy, soft body). */
function rounded(points: Point[]): Path2D {
	const p = new Path2D();
	const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
	const n = points.length;
	p.moveTo(...mid(points[n - 1], points[0]));
	points.forEach((pt, i) => p.quadraticCurveTo(pt[0], pt[1], ...mid(pt, points[(i + 1) % n])));
	p.closePath();
	return p;
}

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
	ctx.font = uiFont(600, 11);
	ctx.textAlign = 'center';
	ctx.textBaseline = 'bottom';
	ctx.fillStyle = 'rgba(216, 245, 224, 0.85)';
	ctx.fillText(label, x, y - lift - FIGURE_HEIGHT - 8);
	ctx.restore();
}
