// Draws a Lantern side-on, like the characters in project-7.
// The world is still seen from above (you move up/down/left/right), but
// characters are upright and face left or right. All art is code.
//
// Two poses:
//  - WALKING (planet missions): legs swing, shadow on the ground, no glow
//  - FLYING  (space missions): hovering, leaning into the direction of
//    travel, ring arm reaching forward, green aura around the body
//
// The origin (x, y) is the Lantern's ANCHOR: their feet when walking, the
// spot below them when flying. Sorting by that y gives depth (lower on
// screen = closer = drawn on top).
//
// Everything is drawn facing RIGHT. To face left we mirror the canvas with
// scale(-1, 1), so the drawing code never has to think about direction.

import type { LanternDef } from '../lanterns';

export const GREEN = '#3dff6e';
const SUIT_BLACK = '#101412';
/** Classic bottle green: the darker, traditional comic suit shade.
 *  Ring energy (GREEN above) stays bright so it still glows. */
const SUIT_GREEN = '#0F4F34';

/** Size multiplier for the whole figure. */
const FIGURE_SCALE = 1.35;
/** How high a flying Lantern floats above their anchor, before scaling. */
const HOVER_LIFT = 8;
/** Rough height from anchor to top of head, in world pixels (flying is taller). */
export const FIGURE_HEIGHT = (50 + HOVER_LIFT) * FIGURE_SCALE;
/** Half the figure's width, used to keep them on screen. */
export const FIGURE_HALF_WIDTH = 10 * FIGURE_SCALE;

export interface LanternPose {
	/** 1 = facing right, -1 = facing left. */
	dir: 1 | -1;
	/** Walk cycle angle. 0 when standing still or flying. */
	walkPhase: number;
	flying: boolean;
	/** 0..1, how hard a flying Lantern leans forward (from horizontal speed). */
	lean: number;
	/** Green aura and glowing ring (space only). */
	glow: boolean;
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
	const pulse = 0.75 + 0.25 * Math.sin(time * 4);

	ctx.save();
	ctx.translate(x, y);
	ctx.scale(s, s);

	if (!pose.flying) {
		// Ground shadow. Not mirrored, not bobbing: it belongs to the floor.
		ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
		ctx.beginPath();
		ctx.ellipse(0, 0, 11, 3.5, 0, 0, Math.PI * 2);
		ctx.fill();
	}

	// Where the body is lifted to (flying) or bouncing (walking)
	const walking = !pose.flying && pose.walkPhase !== 0;
	const lift = pose.flying
		? -HOVER_LIFT + Math.sin(time * 2.2) * 1.6 // slow hover bob
		: walking
			? Math.abs(Math.sin(pose.walkPhase)) * -1.5 // step bounce
			: Math.sin(time * 2) * 0.6; // idle breathing

	if (pose.glow) {
		const aura = ctx.createRadialGradient(0, -24 + lift, 4, 0, -24 + lift, 36);
		aura.addColorStop(0, `rgba(61, 255, 110, ${0.26 * pulse})`);
		aura.addColorStop(1, 'rgba(61, 255, 110, 0)');
		ctx.fillStyle = aura;
		ctx.beginPath();
		ctx.arc(0, -24 + lift, 36, 0, Math.PI * 2);
		ctx.fill();
	}

	ctx.scale(pose.dir, 1);
	ctx.translate(0, lift);
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';

	if (pose.flying) {
		// Lean forward from the hips, like a superhero in flight.
		ctx.translate(0, -15);
		ctx.rotate(pose.lean * 0.9);
		ctx.translate(0, 15);
	}

	// ---- Limb positions for this pose ----
	let backArm: [number, number];
	let frontArm: [number, number];
	let backLeg: [number, number];
	let frontLeg: [number, number];

	if (pose.flying) {
		const dangle = Math.sin(time * 1.6) * 1.2 * (1 - pose.lean);
		// Idle: arms relaxed at the sides. Fast: ring arm punches forward.
		backArm = [-2.5, -19];
		frontArm = [lerp(6, 13, pose.lean), lerp(-21, -34, pose.lean)];
		// Legs together, trailing slightly behind
		backLeg = [-2.5 + dangle, -1.5];
		frontLeg = [0.5 + dangle, -1];
	} else {
		const swing = walking ? Math.sin(pose.walkPhase) * 5 : 0;
		backArm = [-3 - swing * 0.6, -19];
		frontArm = [6 + swing * 0.4, -20];
		backLeg = [-2 + swing, -2];
		frontLeg = [2 - swing, -2];
	}

	// Back arm (behind the body)
	limb(ctx, SUIT_BLACK, 4, -1, -31, backArm[0], backArm[1]);
	glove(ctx, backArm[0], backArm[1]);

	// Legs: black suit, bottle-green boots
	for (const [hipX, foot] of [[-2, backLeg], [2, frontLeg]] as const) {
		limb(ctx, SUIT_BLACK, 5, hipX, -15, foot[0], foot[1]);
		const bootX = lerp(hipX, foot[0], 0.72);
		const bootY = lerp(-15, foot[1], 0.72);
		limb(ctx, SUIT_GREEN, 5, bootX, bootY, foot[0], foot[1] + 1);
	}

	// Torso: green chest, black flanks
	ctx.fillStyle = SUIT_BLACK;
	roundRect(ctx, -6.5, -34, 13, 21, 4);
	ctx.fill();
	ctx.fillStyle = SUIT_GREEN;
	roundRect(ctx, -3.5, -33, 9, 13, 3);
	ctx.fill();
	// Belt
	ctx.fillStyle = SUIT_BLACK;
	ctx.fillRect(-6.5, -17, 13, 2);

	// Chest emblem: small white circle with a green bar
	ctx.fillStyle = '#eafff0';
	ctx.beginPath();
	ctx.arc(1, -28, 2.6, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = SUIT_GREEN;
	ctx.fillRect(-1, -28.6, 4, 1.2);

	// Head
	ctx.fillStyle = def.look.skin;
	ctx.beginPath();
	ctx.arc(1, -40.5, 6, 0, Math.PI * 2);
	ctx.fill();
	drawHair(ctx, def);

	if (def.look.mask) {
		// Domino mask across the eyes, facing forward
		ctx.fillStyle = SUIT_GREEN;
		roundRect(ctx, 1, -43, 6.5, 3, 1.5);
		ctx.fill();
		ctx.fillStyle = '#eafff0';
		ctx.fillRect(4.5, -42.2, 1.6, 1.3);
	} else {
		// No mask: just a plain eye and brow
		ctx.fillStyle = '#1a0f08';
		ctx.fillRect(4.4, -42.4, 1.5, 1.6);
		ctx.fillRect(3.8, -44.2, 2.6, 0.8);
	}

	// Front arm: the ring hand
	limb(ctx, SUIT_BLACK, 4, 2, -31, frontArm[0], frontArm[1]);
	glove(ctx, frontArm[0], frontArm[1]);

	// The ring. Glows in space; just a small light on a planet.
	ctx.save();
	if (pose.glow) {
		ctx.shadowColor = GREEN;
		ctx.shadowBlur = 10 * pulse;
	}
	ctx.fillStyle = pose.glow ? '#d9ffe3' : '#8fdca8';
	ctx.beginPath();
	ctx.arc(frontArm[0] + 1, frontArm[1], pose.glow ? 1.8 : 1.4, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();

	ctx.restore();
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function drawHair(ctx: CanvasRenderingContext2D, def: LanternDef) {
	ctx.fillStyle = def.look.hair;
	ctx.beginPath();
	if (def.look.hairStyle === 'swept') {
		// Hal: fuller hair with a sweep up at the front
		ctx.moveTo(-5.5, -39);
		ctx.quadraticCurveTo(-7, -48, 1, -48.5);
		ctx.quadraticCurveTo(8, -49, 7.5, -44);
		ctx.quadraticCurveTo(3, -45.5, -1, -43.5);
		ctx.lineTo(-3, -38);
		ctx.closePath();
	} else {
		// John: close-cropped, following the skull
		ctx.arc(1, -40.5, 6.2, Math.PI * 0.95, Math.PI * 1.85);
		ctx.lineTo(-2, -41);
		ctx.closePath();
	}
	ctx.fill();
}

function limb(
	ctx: CanvasRenderingContext2D,
	color: string,
	width: number,
	x1: number,
	y1: number,
	x2: number,
	y2: number
) {
	ctx.strokeStyle = color;
	ctx.lineWidth = width;
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);
	ctx.stroke();
}

function glove(ctx: CanvasRenderingContext2D, x: number, y: number) {
	ctx.fillStyle = SUIT_GREEN;
	ctx.beginPath();
	ctx.arc(x, y, 2.3, 0, Math.PI * 2);
	ctx.fill();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	ctx.beginPath();
	ctx.roundRect(x, y, w, h, r);
}

/** Name tag above a Lantern's head. */
export function drawNameTag(ctx: CanvasRenderingContext2D, label: string, x: number, y: number) {
	ctx.save();
	ctx.font = '600 11px system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'bottom';
	ctx.fillStyle = 'rgba(216, 245, 224, 0.85)';
	ctx.fillText(label, x, y - FIGURE_HEIGHT - 8);
	ctx.restore();
}
