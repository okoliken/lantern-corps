// Draws a Lantern standing side-on, like the characters in project-7.
// The world is still seen from above (you move up/down/left/right), but
// characters stand upright and face left or right. All art is code.
//
// The origin (x, y) is the Lantern's FEET. Drawing from the feet up means:
//  - sorting by y puts people lower on screen in front, which reads as depth
//  - flying (M2) is just lifting the body while the shadow stays on the ground
//
// Everything is drawn facing RIGHT. To face left we mirror the canvas with
// scale(-1, 1), so the drawing code never has to think about direction.

import type { LanternDef } from '../lanterns';

export const GREEN = '#3dff6e';
const SUIT_BLACK = '#101412';
const SUIT_GREEN = '#2fd35c';

/** Size multiplier for the whole figure. */
const FIGURE_SCALE = 1.35;
/** Rough height of the figure from feet to top of head, in world pixels. */
export const FIGURE_HEIGHT = 50 * FIGURE_SCALE;
/** Half the figure's width, used to keep them on screen. */
export const FIGURE_HALF_WIDTH = 10 * FIGURE_SCALE;

export interface LanternPose {
	/** 1 = facing right, -1 = facing left. */
	dir: 1 | -1;
	/** Walk cycle angle. 0 when standing still. */
	walkPhase: number;
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
	const moving = pose.walkPhase !== 0;
	const legSwing = moving ? Math.sin(pose.walkPhase) * 5 : 0;
	// Idle: gentle breathing. Moving: a small bounce with each step.
	const bob = moving ? Math.abs(Math.sin(pose.walkPhase)) * -1.5 : Math.sin(time * 2) * 0.6;

	ctx.save();
	ctx.translate(x, y);
	ctx.scale(s, s);

	// Ground shadow. Not mirrored, not bobbing: it belongs to the floor.
	ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
	ctx.beginPath();
	ctx.ellipse(0, 0, 11, 3.5, 0, 0, Math.PI * 2);
	ctx.fill();

	// Aura: soft green glow behind the body
	const aura = ctx.createRadialGradient(0, -24, 4, 0, -24, 34);
	aura.addColorStop(0, `rgba(61, 255, 110, ${0.22 * pulse})`);
	aura.addColorStop(1, 'rgba(61, 255, 110, 0)');
	ctx.fillStyle = aura;
	ctx.beginPath();
	ctx.arc(0, -24, 34, 0, Math.PI * 2);
	ctx.fill();

	ctx.scale(pose.dir, 1);
	ctx.translate(0, bob);
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';

	// Back arm (behind the body), swinging opposite the front leg
	limb(ctx, SUIT_BLACK, 4, -1, -31, -3 - legSwing * 0.6, -19);
	glove(ctx, -3 - legSwing * 0.6, -19);

	// Legs: black suit, green boots
	limb(ctx, SUIT_BLACK, 5, -2, -15, -2 + legSwing, -2);
	limb(ctx, SUIT_BLACK, 5, 2, -15, 2 - legSwing, -2);
	limb(ctx, SUIT_GREEN, 5, -2 + legSwing * 0.9, -5, -2 + legSwing, -1);
	limb(ctx, SUIT_GREEN, 5, 2 - legSwing * 0.9, -5, 2 - legSwing, -1);

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

	// Domino mask across the eyes, facing forward
	ctx.fillStyle = SUIT_GREEN;
	roundRect(ctx, 1, -43, 6.5, 3, 1.5);
	ctx.fill();
	ctx.fillStyle = '#eafff0';
	ctx.fillRect(4.5, -42.2, 1.6, 1.3);

	// Front arm reaching slightly forward: the ring hand
	const armX = 6 + legSwing * 0.4;
	limb(ctx, SUIT_BLACK, 4, 2, -31, armX, -20);
	glove(ctx, armX, -20);

	// Ring glow
	ctx.save();
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 10 * pulse;
	ctx.fillStyle = '#d9ffe3';
	ctx.beginPath();
	ctx.arc(armX + 1, -20, 1.8, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();

	ctx.restore();
}

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
