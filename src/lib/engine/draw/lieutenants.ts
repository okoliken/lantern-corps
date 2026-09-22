// Atrocitus's lieutenants, as they look in the animated series (in our style):
//
//   Zilius Zox  a round, grinning ball of a Red Lantern: mostly mouth, stubby limbs
//   Skallox     a hulking horned brute; when he transforms he swells up, spikes glowing
//   Bleez       a slim Red Lantern on huge torn black wings, long dark hair
//   Razer       Act 1's boss: lean, ashen-skinned, hair tied back, a black and red
//               suit, rage blades flaring from both forearms
//
// Like everyone else they face right and get mirrored; their HAND is where
// their red constructs come from.

import { computeSkeleton, type Point } from '../animation';
import { ENEMIES, type Enemy } from '../enemies/enemies';
import { ABILITIES, SLAM_HEIGHT } from '../enemies/redConstructs';
import { isStanding } from '../dummy';
import { enemyPose } from './enemies';
import { segment } from './lantern';

const RED = '#ff2a2a';
const RED_DEEP = '#7a0b0b';
const RED_SUIT = '#9c1414';
const HOT = '#ffd0d0';
const BLACK = '#140808';
const BLACK_LIT = '#2a1414';
const OUTLINE = '#050101';
const TAU = Math.PI * 2;
const SCALE = 1.35;
const HOVER = 12;

/** Where each lieutenant's hand (or mouth) is, in its own units above its hover point. */
const HANDS: Record<'zox' | 'skallox', Point> = {
	zox: [22, -26],
	skallox: [26, -34]
};

type Lieutenant = 'zox' | 'skallox' | 'bleez' | 'razer' | 'atrocitus';

export const isLieutenantKind = (k: string): k is Lieutenant => k === 'zox' || k === 'skallox' || k === 'bleez' || k === 'razer' || k === 'atrocitus';

/** Skallox gets bigger as he transforms. */
const sizeOf = (e: Enemy) => SCALE * ENEMIES[e.kind].scale * (1 + 0.28 * e.brain.form);

export function lieutenantHand(e: Enemy, x: number, y: number): Point {
	const s = sizeOf(e);
	const air = e.brain.air * SLAM_HEIGHT;
	if (e.kind === 'bleez' || e.kind === 'razer' || e.kind === 'atrocitus') {
		const pose = enemyPose(e, true, 0);
		const [hx, hy] = computeSkeleton({ ...pose, firing: true }, 0).front.hand;
		return [x + hx * e.dir * s, y + hy * s];
	}
	const [hx, hy] = HANDS[e.kind as 'zox' | 'skallox'];
	return [x + hx * e.dir * s, y - air + (hy - HOVER) * s];
}

/** Top of the figure (for its health bar and name). */
export function lieutenantTop(e: Enemy, y: number): number {
	const tall = e.kind === 'zox' ? 58 : e.kind === 'skallox' ? 76 : e.kind === 'razer' ? 74 : e.kind === 'atrocitus' ? 80 : 70;
	return y - e.brain.air * SLAM_HEIGHT - (HOVER + tall) * sizeOf(e);
}

export function drawLieutenant(ctx: CanvasRenderingContext2D, e: Enemy, x: number, y: number, hasGround: boolean, time: number) {
	if (e.kind === 'bleez') {
		drawBleez(ctx, e, x, y, hasGround, time);
		return;
	}
	if (e.kind === 'razer') {
		drawRazer(ctx, e, x, y, hasGround, time);
		return;
	}
	if (e.kind === 'atrocitus') {
		drawAtrocitus(ctx, e, x, y, hasGround, time);
		return;
	}
	const b = e.brain;
	const s = sizeOf(e);
	const defeated = !isStanding(e);
	const fall = defeated ? 1 - Math.min(1, e.down / 0.9) : 0;
	const winding = b.state === 'windup' ? b.ability : null;
	const acting = b.state === 'act' ? b.ability : null;
	const tell = winding ? ABILITIES[winding].tell : null;
	const flash = e.flash > 0 || ((tell === 'strike' || tell === 'heavy' || tell === 'sky') && Math.sin(time * 30) > 0);
	const air = b.air * SLAM_HEIGHT;

	ctx.save();
	ctx.globalAlpha = defeated ? Math.min(1, e.down / 0.5) : 1;
	ctx.translate(x, y);
	if (hasGround) {
		const k = 1 - b.air * 0.5;
		ctx.fillStyle = `rgba(0, 0, 0, ${0.4 * k})`;
		ctx.beginPath();
		ctx.ellipse(0, 0, 20 * s * k, 5 * s * k, 0, 0, TAU);
		ctx.fill();
	}
	ctx.translate(0, -air);
	ctx.scale(s * e.dir, s);
	ctx.translate(0, -HOVER * (1 - fall) - Math.sin(time * 2 + e.homeX) * 1.5 * (1 - fall));
	if (defeated) ctx.rotate(-fall * 0.8);
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';

	if (!defeated) aura(ctx, -30, 28 + 6 * b.form, b.rage + b.form * 0.5 + (winding ? 0.4 : 0), time, x);
	const k = winding ? 1 - b.timer / ABILITIES[winding].windup : 0;
	if (e.kind === 'zox') drawZox(ctx, e, time, flash, k, winding, acting);
	else drawSkallox(ctx, e, time, flash, k, winding, acting);

	if (!defeated) {
		const [hx, hy] = HANDS[e.kind as 'zox' | 'skallox'];
		if (tell === 'aim' || tell === 'build') orb(ctx, hx, hy, 1.5 + k * 4, time);
		else if (tell === 'sky') orb(ctx, 0, -66 - k * 4, 2 + k * 5, time);
	}
	ctx.restore();
}

// ------------------------------------------------------------------ Zox

const ZOX_SKIN = '#8f9a58';
const ZOX_SKIN_DARK = '#5f6a37';

function drawZox(
	ctx: CanvasRenderingContext2D,
	e: Enemy,
	time: number,
	flash: boolean,
	k: number,
	winding: string | null,
	acting: string | null
) {
	const b = e.brain;
	const skin = flash ? '#ffffff' : ZOX_SKIN;
	const dark = flash ? '#ffdddd' : ZOX_SKIN_DARK;
	// Squash and stretch: squashed before a belly slam, stretched tall in the air
	const squash = winding === 'slam' ? k * 0.25 : 0;
	const stretch = b.air > 0 ? b.air * 0.2 : 0;
	const wobble = Math.sin(time * 4 + e.homeX) * 0.03;
	const sx = 1 + squash - stretch * 0.5 + wobble;
	const sy = 1 - squash + stretch - wobble;
	const spit = winding === 'vomit' || acting === 'vomit' || winding === 'blast' || acting === 'blast';
	const laugh = Math.max(0, Math.sin(time * 1.3 + e.homeY)) > 0.9 ? Math.abs(Math.sin(time * 25)) : 0;

	// Stubby legs dangling under the ball
	const kick = Math.sin(time * 6) * 0.3;
	for (const [lx, ph] of [[-6, 0], [5, Math.PI]] as const) {
		const a = kick * Math.sin(ph + time * 3);
		ctx.strokeStyle = OUTLINE;
		ctx.lineWidth = 6;
		ctx.beginPath();
		ctx.moveTo(lx, -14);
		ctx.lineTo(lx + Math.sin(a) * 7, -14 + Math.cos(a) * 7);
		ctx.stroke();
		ctx.strokeStyle = BLACK_LIT;
		ctx.lineWidth = 4.5;
		ctx.stroke();
		ctx.fillStyle = RED_SUIT;
		ctx.beginPath();
		ctx.ellipse(lx + Math.sin(a) * 7 + 1.5, -14 + Math.cos(a) * 7 + 0.5, 3.2, 2, 0, 0, TAU);
		ctx.fill();
	}

	ctx.save();
	ctx.translate(0, -32);
	ctx.scale(sx, sy);

	// Far arm: a little stub
	stubArm(ctx, -12, -2, 2.4 + Math.sin(time * 3) * 0.2, dark);

	// The ball
	const ball = new Path2D();
	ball.ellipse(0, 0, 21, 19, 0, 0, TAU);
	const g = ctx.createRadialGradient(-6, -8, 3, 0, 0, 22);
	g.addColorStop(0, flash ? '#ffffff' : '#b3bd78');
	g.addColorStop(1, skin);
	ctx.fillStyle = g;
	ctx.fill(ball);
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 1;
	ctx.stroke(ball);
	// Warty spots
	ctx.fillStyle = dark;
	for (const [wx, wy, r] of [[-12, -8, 2], [-8, -14, 1.4], [-15, 3, 1.6], [2, -15, 1.1]] as const) {
		ctx.beginPath();
		ctx.arc(wx, wy, r, 0, TAU);
		ctx.fill();
	}
	// Red Lantern harness: a black and red band across the body with the emblem
	ctx.save();
	ctx.clip(ball);
	ctx.fillStyle = flash ? '#ffe0e0' : BLACK;
	ctx.beginPath();
	ctx.moveTo(-22, 10);
	ctx.lineTo(22, 2);
	ctx.lineTo(22, 9);
	ctx.lineTo(-22, 18);
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = flash ? '#ffffff' : RED_SUIT;
	ctx.beginPath();
	ctx.moveTo(-22, 12);
	ctx.lineTo(22, 4);
	ctx.lineTo(22, 6);
	ctx.lineTo(-22, 14);
	ctx.closePath();
	ctx.fill();
	ctx.restore();
	emblem(ctx, -6, 10.5, 3.4, -0.2);

	// Little beady eyes high on the ball, and a heavy brow
	ctx.fillStyle = dark;
	ctx.beginPath();
	ctx.ellipse(9, -11, 7, 2.2, -0.25, 0, TAU);
	ctx.fill();
	eye(ctx, 8, -8.5, 1.5, b.rage + (winding ? 0.8 : 0));
	eye(ctx, 13.5, -9.5, 1.2, b.rage + (winding ? 0.8 : 0));

	// The mouth: an enormous grin right across the front, wide open to spit
	const open = 3 + (spit ? 5 + k * 3 : 0) + laugh * 3;
	ctx.fillStyle = '#2a0006';
	ctx.beginPath();
	ctx.moveTo(-2, -1);
	ctx.quadraticCurveTo(10, 0, 21, -4);
	ctx.quadraticCurveTo(18, 2 + open, 6, 2 + open);
	ctx.quadraticCurveTo(0, 2 + open * 0.6, -2, -1);
	ctx.closePath();
	ctx.fill();
	// A red glow in the throat when he's about to spit
	if (spit) {
		ctx.save();
		ctx.shadowColor = RED;
		ctx.shadowBlur = 10;
		ctx.fillStyle = `rgba(255, 70, 40, ${0.5 + 0.5 * k})`;
		ctx.beginPath();
		ctx.ellipse(10, 1 + open * 0.4, 4, 1 + open * 0.25, 0, 0, TAU);
		ctx.fill();
		ctx.restore();
	}
	// Two rows of crooked teeth
	ctx.fillStyle = '#f2ead8';
	for (let i = 0; i < 6; i++) {
		const tx = 1 + i * 3.3;
		const top = -0.5 - (tx / 21) * 3.2;
		ctx.beginPath();
		ctx.moveTo(tx, top);
		ctx.lineTo(tx + 0.9, top + 2 + (i % 2) * 0.8);
		ctx.lineTo(tx + 1.8, top);
		ctx.fill();
		const bottom = 2 + open - (i === 0 || i === 5 ? 1.2 : 0);
		ctx.beginPath();
		ctx.moveTo(tx + 0.4, bottom);
		ctx.lineTo(tx + 1.2, bottom - 1.8);
		ctx.lineTo(tx + 2, bottom);
		ctx.fill();
	}
	drip(ctx, 16, 1 + open, time, 0.2);
	drip(ctx, 6, 2 + open, time, 0.7);

	// Near arm: waving the ring about
	const ringArm = winding || acting ? 1.9 - k * 0.3 : 0.9 + Math.sin(time * 2.5) * 0.3;
	const hand = stubArm(ctx, 13, 5, ringArm, skin);
	ring(ctx, hand[0], hand[1]);
	ctx.restore();
}

function stubArm(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string): Point {
	const end: Point = [x + Math.sin(angle) * 8, y + Math.cos(angle) * 8];
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 6;
	ctx.beginPath();
	ctx.moveTo(x, y);
	ctx.lineTo(...end);
	ctx.stroke();
	ctx.strokeStyle = color;
	ctx.lineWidth = 4.4;
	ctx.stroke();
	ctx.fillStyle = BLACK_LIT;
	ctx.beginPath();
	ctx.arc(end[0], end[1], 2.6, 0, TAU);
	ctx.fill();
	return end;
}

// ------------------------------------------------------------------ Skallox

const SKAL_HIDE = '#6b3a2c';
const SKAL_DARK = '#40211a';
const BONE = '#d8c7a4';

function drawSkallox(
	ctx: CanvasRenderingContext2D,
	e: Enemy,
	time: number,
	flash: boolean,
	k: number,
	winding: string | null,
	acting: string | null
) {
	const b = e.brain;
	const form = b.form;
	const hide = flash ? '#ffffff' : form > 0.5 ? '#7d3524' : SKAL_HIDE;
	const dark = flash ? '#ffdddd' : SKAL_DARK;
	const speed = Math.hypot(e.vx, e.vy);
	const gait = time * (3 + 5 * Math.min(1, speed / 120));
	const move = Math.min(1, speed / 120);
	const crouch = winding === 'charge' || winding === 'slam' || winding === 'roar' ? k : 0;
	const swipe = acting === 'claws' ? 1 : winding === 'claws' ? -0.5 * k : 0;
	const roar = winding === 'roar' || acting === 'roar' ? 1 : 0;
	const charge = acting === 'charge' ? 1 : 0;
	ctx.translate(charge * 3, crouch * 5);
	ctx.rotate(charge * 0.35 + crouch * 0.15);

	// Short, thick legs
	const step = (ph: number) => Math.sin(gait + ph) * 0.4 * move;
	limb(ctx, [-5, -20], step(Math.PI), 9, step(Math.PI) - 0.2, 9, 7, 6, dark);

	// Far arm: huge, knuckles near the ground
	const farArm = limb(ctx, [4, -44], 0.35 + step(0) * 0.6 - swipe * 0.6, 14, 0.1 - swipe * 0.8, 14, 7, 6.5, dark);
	fist(ctx, farArm, dark, false);

	// Torso: a massive hunched back
	const body = new Path2D();
	body.moveTo(-14, -18);
	body.quadraticCurveTo(-22, -40, -8, -54);
	body.quadraticCurveTo(8, -62, 18, -48);
	body.quadraticCurveTo(22, -34, 12, -22);
	body.quadraticCurveTo(0, -14, -14, -18);
	body.closePath();
	ctx.fillStyle = hide;
	ctx.fill(body);
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 1;
	ctx.stroke(body);
	// Red Lantern armour: a shoulder plate and a belt
	ctx.save();
	ctx.clip(body);
	ctx.fillStyle = flash ? '#ffffff' : RED_SUIT;
	ctx.beginPath();
	ctx.ellipse(8, -50, 13, 8, 0.3, 0, TAU);
	ctx.fill();
	ctx.fillStyle = flash ? '#ffe0e0' : BLACK;
	ctx.fillRect(-20, -24, 44, 6);
	ctx.restore();
	emblem(ctx, 6, -36, 3.6);
	// Bony spikes down the back, glowing once transformed
	ctx.save();
	if (form > 0) {
		ctx.shadowColor = RED;
		ctx.shadowBlur = 10 * form;
	}
	ctx.fillStyle = flash ? '#ffffff' : form > 0.5 ? '#ff6a4a' : BONE;
	for (let i = 0; i < 4; i++) {
		const t = i / 3;
		const px = -16 + t * 18;
		const py = -30 - Math.sin(t * Math.PI * 0.9) * 26;
		const len = 5 + form * 4;
		ctx.beginPath();
		ctx.moveTo(px - 2, py + 1);
		ctx.lineTo(px - 5 - len * 0.4, py - len);
		ctx.lineTo(px + 2, py - 1);
		ctx.closePath();
		ctx.fill();
	}
	ctx.restore();

	// Head: low, thrust forward between the shoulders, horns sweeping back, tusks
	ctx.save();
	ctx.translate(20, -46);
	ctx.rotate(-roar * 0.4 + charge * 0.3);
	const jaw = 1 + roar * 5 + (winding ? 1.5 : 0);
	const head = new Path2D();
	head.moveTo(-5, -5);
	head.quadraticCurveTo(3, -9, 9, -4);
	head.lineTo(10, 1);
	head.lineTo(-4, 4);
	head.closePath();
	ctx.fillStyle = hide;
	ctx.fill(head);
	ctx.strokeStyle = OUTLINE;
	ctx.stroke(head);
	ctx.fillStyle = dark;
	ctx.beginPath();
	ctx.moveTo(-3, 3);
	ctx.lineTo(9, 1);
	ctx.lineTo(8, 3 + jaw);
	ctx.lineTo(-2, 5 + jaw * 0.4);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#300000';
	ctx.beginPath();
	ctx.moveTo(-1, 3.5);
	ctx.lineTo(9, 1.3);
	ctx.lineTo(7.5, 2 + jaw * 0.8);
	ctx.closePath();
	ctx.fill();
	// Tusks
	ctx.fillStyle = BONE;
	ctx.beginPath();
	ctx.moveTo(6, 3 + jaw * 0.7);
	ctx.quadraticCurveTo(10, 0, 9, -3);
	ctx.lineTo(7.5, 2);
	ctx.closePath();
	ctx.fill();
	// Horns: big, curving back over the head
	const horn = 1 + form * 0.4;
	ctx.fillStyle = flash ? '#ffffff' : '#2a1a14';
	ctx.beginPath();
	ctx.moveTo(-2, -6);
	ctx.bezierCurveTo(-6 * horn, -18 * horn, -18 * horn, -16 * horn, -22 * horn, -8 * horn);
	ctx.bezierCurveTo(-16 * horn, -12 * horn, -8, -10, -5, -3);
	ctx.closePath();
	ctx.fill();
	eye(ctx, 5, -3, 1.6 + form * 0.4, b.rage + form + (winding ? 0.8 : 0));
	drip(ctx, 6, 3 + jaw, time, 0.4);
	ctx.restore();

	// Near leg and arm on top
	limb(ctx, [4, -20], step(0), 9, step(0) - 0.2, 9, 7.5, 6.5, hide);
	const reach = swipe > 0 ? 1.9 : roar ? 2.4 : 0.25 + step(Math.PI) * 0.6 - swipe * 0.6 + crouch * 0.4;
	const nearArm = limb(ctx, [10, -44], reach, 14, reach - (swipe > 0 ? 0.3 : 0.25), 14, 8, 7.5, hide);
	fist(ctx, nearArm, hide, swipe > 0 || winding === 'claws');
	ring(ctx, nearArm[0] - 2, nearArm[1] - 4);
}

function fist(ctx: CanvasRenderingContext2D, at: Point, color: string, clawsOut: boolean) {
	ctx.fillStyle = color;
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.arc(at[0], at[1], 4.8, 0, TAU);
	ctx.fill();
	ctx.stroke();
	ctx.save();
	if (clawsOut) {
		ctx.shadowColor = RED;
		ctx.shadowBlur = 8;
	}
	ctx.fillStyle = clawsOut ? RED : BONE;
	for (const dx of [-2.5, 0.5, 3.5]) {
		ctx.beginPath();
		ctx.moveTo(at[0] + dx - 1, at[1] + 3);
		ctx.lineTo(at[0] + dx + 1.5, at[1] + (clawsOut ? 11 : 7));
		ctx.lineTo(at[0] + dx + 1.2, at[1] + 3);
		ctx.closePath();
		ctx.fill();
	}
	ctx.restore();
}

// ------------------------------------------------------------------ Bleez

const BLEEZ_SKIN = '#9b8fa6';
const HAIR = '#15101c';
const WING = '#1c1420';
const WING_LIT = '#3a2a40';

function drawBleez(ctx: CanvasRenderingContext2D, e: Enemy, x: number, y: number, hasGround: boolean, time: number) {
	const b = e.brain;
	const s = sizeOf(e);
	const pose = enemyPose(e, hasGround, time);
	const sk = computeSkeleton(pose, time);
	const defeated = !isStanding(e);
	const winding = b.state === 'windup' ? b.ability : null;
	const acting = b.state === 'act' ? b.ability : null;
	const tell = winding ? ABILITIES[winding].tell : null;
	const flash = e.flash > 0 || ((tell === 'strike' || tell === 'heavy') && Math.sin(time * 30) > 0);
	const k = winding ? 1 - b.timer / ABILITIES[winding].windup : 0;
	const diving = acting === 'swoop';

	ctx.save();
	ctx.globalAlpha = defeated ? Math.min(1, e.down / 0.5) : 1;
	ctx.translate(x, y);
	ctx.scale(s, s);
	if (pose.shadow) {
		const shrink = 1 - b.air * 0.6;
		ctx.fillStyle = `rgba(0, 0, 0, ${0.35 * shrink})`;
		ctx.beginPath();
		ctx.ellipse(0, 0, 14 * shrink, 4 * shrink, 0, 0, TAU);
		ctx.fill();
	}
	ctx.scale(pose.dir, 1);
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';

	const back: Point = [
		(sk.neck[0] * 3 + sk.hip[0]) / 4 - 2,
		(sk.neck[1] * 3 + sk.hip[1]) / 4
	];
	if (!defeated) aura(ctx, (sk.hip[1] + sk.neck[1]) / 2, 24, b.rage + (winding ? 0.4 : 0), time, x);

	// Wings: big, torn, bat-like. They beat steadily, spread wide as she climbs, fold back in a dive.
	const beat = Math.sin(time * (diving ? 2 : 7) + e.homeX);
	const spread = diving ? -0.7 : winding === 'swoop' ? 0.5 + k * 0.4 : beat * 0.45;
	drawWing(ctx, back, spread - 0.15, true, flash);

	// Far limbs
	segment(ctx, sk.back.shoulder, sk.back.elbow, 2.2, 1.9, flash ? '#ffdddd' : BLACK);
	segment(ctx, sk.back.elbow, sk.back.hand, 1.9, 1.6, flash ? '#ffdddd' : RED_DEEP);
	segment(ctx, sk.back.hipJoint, sk.back.knee, 2.8, 2.2, flash ? '#ffdddd' : BLACK);
	segment(ctx, sk.back.knee, sk.back.foot, 2.2, 1.6, flash ? '#ffdddd' : RED_DEEP);

	// Slim torso in a red and black suit
	const up: Point = [Math.sin(sk.torsoAngle), -Math.cos(sk.torsoAngle)];
	const across: Point = [Math.cos(sk.torsoAngle), Math.sin(sk.torsoAngle)];
	const at = (along: number, side: number): Point => [
		sk.hip[0] + up[0] * along + across[0] * side,
		sk.hip[1] + up[1] * along + across[1] * side
	];
	const torso = new Path2D();
	for (const [i, p] of [at(-1, -3.6), at(9, -3), at(17, -4.2), at(18.4, 3.4), at(12, 4.5), at(6, 3), at(-1, 3.8)].entries()) {
		if (i === 0) torso.moveTo(...p);
		else torso.lineTo(...p);
	}
	torso.closePath();
	ctx.fillStyle = flash ? '#ffffff' : BLACK_LIT;
	ctx.fill(torso);
	ctx.save();
	ctx.clip(torso);
	ctx.fillStyle = flash ? '#ffffff' : RED_SUIT;
	ctx.beginPath();
	ctx.moveTo(...at(5, -4));
	ctx.lineTo(...at(18, 4));
	ctx.lineTo(...at(12, 5));
	ctx.lineTo(...at(4, 4));
	ctx.closePath();
	ctx.fill();
	ctx.restore();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.stroke(torso);
	emblem(ctx, ...at(13, 1.5), 2.2, sk.torsoAngle);

	// Near leg
	segment(ctx, sk.front.hipJoint, sk.front.knee, 3, 2.3, flash ? '#ffffff' : BLACK_LIT);
	segment(ctx, sk.front.knee, sk.front.foot, 2.3, 1.7, flash ? '#ffffff' : RED_SUIT);

	// Head: grey-violet skin, glowing eyes, long black hair streaming behind
	const [hx, hy] = sk.headCenter;
	ctx.save();
	ctx.translate(hx, hy);
	ctx.rotate(sk.headAngle);
	const flow = Math.sin(time * 5) * 1.5 + Math.min(1, Math.hypot(e.vx, e.vy) / 150) * 4;
	ctx.fillStyle = HAIR;
	ctx.beginPath();
	ctx.moveTo(1, -5.5);
	ctx.quadraticCurveTo(-8, -6, -12 - flow, 4);
	ctx.quadraticCurveTo(-14 - flow, 12, -9 - flow * 0.6, 16);
	ctx.quadraticCurveTo(-8, 8, -4, 3);
	ctx.quadraticCurveTo(-4, -1, 1, -5.5);
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = flash ? '#ffffff' : BLEEZ_SKIN;
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.beginPath();
	ctx.ellipse(0.8, 0, 4.6, 5.2, 0, 0, TAU);
	ctx.fill();
	ctx.stroke();
	// Fringe over the brow
	ctx.fillStyle = HAIR;
	ctx.beginPath();
	ctx.moveTo(-4.5, -1);
	ctx.quadraticCurveTo(-2, -7, 5, -4.5);
	ctx.quadraticCurveTo(1, -4, -1, -1);
	ctx.closePath();
	ctx.fill();
	eye(ctx, 3.6, -0.6, 1.2, b.rage + (winding ? 0.8 : 0));
	// A thin snarl
	ctx.strokeStyle = '#3a0000';
	ctx.lineWidth = 0.7;
	ctx.beginPath();
	ctx.moveTo(2.5, 3);
	ctx.lineTo(5, 2.6 + (winding || acting ? 1 : 0));
	ctx.stroke();
	ctx.restore();

	// Near wing in front, then the ring arm
	drawWing(ctx, back, spread, false, flash);
	segment(ctx, sk.front.shoulder, sk.front.elbow, 2.3, 2, flash ? '#ffffff' : BLACK_LIT);
	segment(ctx, sk.front.elbow, sk.front.hand, 2, 1.7, flash ? '#ffffff' : RED_SUIT);
	ring(ctx, sk.front.hand[0], sk.front.hand[1]);
	if (!defeated && (tell === 'aim' || tell === 'build')) orb(ctx, sk.front.hand[0], sk.front.hand[1], 1.5 + k * 3, time);
	// Claws flare on a slash
	if (!defeated && (winding === 'claws' || acting === 'claws')) {
		ctx.save();
		ctx.shadowColor = RED;
		ctx.shadowBlur = 8;
		ctx.strokeStyle = RED;
		ctx.lineWidth = 1.2;
		const [cx, cy] = sk.front.hand;
		for (const d of [-0.4, 0, 0.4]) {
			ctx.beginPath();
			ctx.moveTo(cx, cy);
			ctx.lineTo(cx + Math.cos(d) * 8, cy + Math.sin(d) * 8);
			ctx.stroke();
		}
		ctx.restore();
	}
	ctx.restore();
}

// ---------------------------------------------------------------- Razer

const RAZER_SKIN = '#8e97ab';
const RAZER_SKIN_DARK = '#6a7285';
const RAZER_HAIR = '#0d0a10';

/**
 * Razer: built on the same skeleton as a Lantern, lean and upright. Ashen
 * blue-grey skin with red rage markings under the eyes, black hair tied
 * back, a black suit with red panels and a high collar. Rage blades flare from
 * both forearms, brighter when he's about to cut.
 */
function drawRazer(ctx: CanvasRenderingContext2D, e: Enemy, x: number, y: number, hasGround: boolean, time: number) {
	const b = e.brain;
	const s = sizeOf(e);
	const pose = enemyPose(e, hasGround, time);
	const sk = computeSkeleton(pose, time);
	const defeated = !isStanding(e);
	const winding = b.state === 'windup' ? b.ability : null;
	const acting = b.state === 'act' ? b.ability : null;
	const tell = winding ? ABILITIES[winding].tell : null;
	const flash = e.flash > 0 || ((tell === 'strike' || tell === 'heavy' || tell === 'sky') && Math.sin(time * 30) > 0);
	const k = winding ? 1 - b.timer / ABILITIES[winding].windup : 0;
	const blades = winding === 'twinBlades' || acting === 'twinBlades' || acting === 'razerStorm' ? 1 : 0.35 + 0.25 * b.rage;
	const skin = flash ? '#ffffff' : RAZER_SKIN;
	const suit = (c: string) => (flash ? '#ffdddd' : c);

	ctx.save();
	ctx.globalAlpha = defeated ? Math.min(1, e.down / 0.5) : 1;
	ctx.translate(x, y);
	ctx.scale(s, s);
	if (pose.shadow) {
		const shrink = 1 - b.air * 0.6;
		ctx.fillStyle = `rgba(0, 0, 0, ${0.38 * shrink})`;
		ctx.beginPath();
		ctx.ellipse(0, 0, 15 * shrink, 4 * shrink, 0, 0, TAU);
		ctx.fill();
	}
	ctx.scale(pose.dir, 1);
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';
	if (!defeated) aura(ctx, (sk.hip[1] + sk.neck[1]) / 2, 28, b.rage + 0.4 + (winding ? 0.5 : 0), time, x);

	// Far limbs, with a blade along the far forearm
	segment(ctx, sk.back.shoulder, sk.back.elbow, 2.4, 2, suit(BLACK));
	segment(ctx, sk.back.elbow, sk.back.hand, 2, 1.7, suit(RED_DEEP));
	if (!defeated) forearmBlade(ctx, sk.back.elbow, sk.back.hand, blades * 0.7, time);
	segment(ctx, sk.back.hipJoint, sk.back.knee, 3, 2.4, suit(BLACK));
	segment(ctx, sk.back.knee, sk.back.foot, 2.4, 1.8, suit(RED_DEEP));

	// Torso: black suit, red panels down the chest, a high collar
	const up: Point = [Math.sin(sk.torsoAngle), -Math.cos(sk.torsoAngle)];
	const across: Point = [Math.cos(sk.torsoAngle), Math.sin(sk.torsoAngle)];
	const at = (along: number, side: number): Point => [
		sk.hip[0] + up[0] * along + across[0] * side,
		sk.hip[1] + up[1] * along + across[1] * side
	];
	const torso = new Path2D();
	for (const [i, p] of [at(-1, -4), at(9, -3.6), at(17.5, -4.8), at(19.5, 4), at(12, 5), at(5, 3.6), at(-1, 4.2)].entries()) {
		if (i === 0) torso.moveTo(...p);
		else torso.lineTo(...p);
	}
	torso.closePath();
	ctx.fillStyle = suit(BLACK_LIT);
	ctx.fill(torso);
	ctx.save();
	ctx.clip(torso);
	ctx.fillStyle = suit(RED_SUIT);
	for (const side of [-2.4, 2.4]) {
		ctx.beginPath();
		ctx.moveTo(...at(2, side - 0.9));
		ctx.lineTo(...at(18, side * 1.3 - 0.9));
		ctx.lineTo(...at(18, side * 1.3 + 0.9));
		ctx.lineTo(...at(2, side + 0.9));
		ctx.closePath();
		ctx.fill();
	}
	ctx.restore();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.stroke(torso);
	emblem(ctx, ...at(12.5, 0.5), 2.3, sk.torsoAngle);
	// High collar
	ctx.fillStyle = suit(RED_DEEP);
	ctx.beginPath();
	ctx.moveTo(...at(17.5, -4.2));
	ctx.lineTo(...at(21, -3));
	ctx.lineTo(...at(20, 3.6));
	ctx.lineTo(...at(18.5, 3.8));
	ctx.closePath();
	ctx.fill();

	// Near leg
	segment(ctx, sk.front.hipJoint, sk.front.knee, 3.2, 2.5, suit(BLACK_LIT));
	segment(ctx, sk.front.knee, sk.front.foot, 2.5, 1.9, suit(RED_SUIT));

	// Head: ashen skin, black hair tied back, red markings under burning eyes
	const [hx, hy] = sk.headCenter;
	ctx.save();
	ctx.translate(hx, hy);
	ctx.rotate(sk.headAngle);
	ctx.fillStyle = RAZER_HAIR;
	ctx.beginPath();
	ctx.moveTo(2, -5.4);
	ctx.quadraticCurveTo(-6, -7, -7, -1);
	ctx.quadraticCurveTo(-7, 2, -4, 3);
	ctx.closePath();
	ctx.fill();
	// The tail, swinging a little
	const swing = Math.sin(time * 4) * 1.2 + Math.min(1, Math.hypot(e.vx, e.vy) / 150) * 2.5;
	ctx.beginPath();
	ctx.moveTo(-6, -2);
	ctx.quadraticCurveTo(-11 - swing, 1, -10 - swing, 8);
	ctx.lineTo(-8 - swing * 0.5, 7.5);
	ctx.quadraticCurveTo(-8, 1, -4.5, -0.5);
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = skin;
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.beginPath();
	ctx.ellipse(0.8, 0.3, 4.4, 5.4, 0, 0, TAU);
	ctx.fill();
	ctx.stroke();
	// Jaw shadow and hairline
	ctx.fillStyle = flash ? '#ffffff' : RAZER_SKIN_DARK;
	ctx.beginPath();
	ctx.ellipse(1.6, 3.6, 3, 1.4, 0, 0, TAU);
	ctx.fill();
	ctx.fillStyle = RAZER_HAIR;
	ctx.beginPath();
	ctx.moveTo(-4, -2);
	ctx.quadraticCurveTo(-1, -6.8, 5, -4.2);
	ctx.quadraticCurveTo(1, -3.8, -2, -1.4);
	ctx.closePath();
	ctx.fill();
	// Red rage markings running down from the eyes
	ctx.strokeStyle = flash ? '#ffffff' : '#c41a1a';
	ctx.lineWidth = 0.9;
	ctx.beginPath();
	ctx.moveTo(3.4, 0.6);
	ctx.lineTo(3, 3.4);
	ctx.moveTo(4.8, 0.4);
	ctx.lineTo(4.9, 2.8);
	ctx.stroke();
	eye(ctx, 3.8, -0.8, 1.15, b.rage + 0.5 + (winding ? 0.8 : 0));
	ctx.strokeStyle = '#2a0000';
	ctx.lineWidth = 0.7;
	ctx.beginPath();
	ctx.moveTo(2.4, 3);
	ctx.lineTo(5, 2.7 + (winding || acting ? 0.9 : 0));
	ctx.stroke();
	ctx.restore();

	// The ring arm, with its blade
	segment(ctx, sk.front.shoulder, sk.front.elbow, 2.5, 2.1, suit(BLACK_LIT));
	segment(ctx, sk.front.elbow, sk.front.hand, 2.1, 1.8, suit(RED_SUIT));
	if (!defeated) forearmBlade(ctx, sk.front.elbow, sk.front.hand, blades, time);
	ring(ctx, sk.front.hand[0], sk.front.hand[1]);
	if (!defeated && (tell === 'aim' || tell === 'build')) orb(ctx, sk.front.hand[0], sk.front.hand[1], 1.5 + k * 3.5, time);
	else if (!defeated && tell === 'sky') orb(ctx, sk.headCenter[0], sk.headCenter[1] - 16 - k * 4, 2 + k * 6, time);
	ctx.restore();
}

// ------------------------------------------------------------ Atrocitus

const ATRO_SKIN = '#9c2f2a';
const ATRO_SKIN_DARK = '#651a17';

/**
 * Atrocitus: huge and heavy, crimson skin, bald with a ridged scalp and a
 * brow like a ledge over sunken burning eyes, black and red armour, the Red
 * Lantern emblem on his chest; the Book of the Black floats at his side,
 * its pages burning when he reads from it (b.rage).
 */
function drawAtrocitus(ctx: CanvasRenderingContext2D, e: Enemy, x: number, y: number, hasGround: boolean, time: number) {
	const b = e.brain;
	const s = sizeOf(e);
	const pose = enemyPose(e, hasGround, time);
	const sk = computeSkeleton(pose, time);
	const defeated = !isStanding(e);
	const winding = b.state === 'windup' ? b.ability : null;
	const acting = b.state === 'act' ? b.ability : null;
	const tell = winding ? ABILITIES[winding].tell : null;
	const flash = e.flash > 0 || ((tell === 'strike' || tell === 'heavy' || tell === 'sky') && Math.sin(time * 30) > 0);
	const k = winding ? 1 - b.timer / ABILITIES[winding].windup : 0;
	const skin = flash ? '#ffffff' : ATRO_SKIN;
	const suit = (c: string) => (flash ? '#ffdddd' : c);

	ctx.save();
	ctx.globalAlpha = defeated ? Math.min(1, e.down / 0.5) : 1;
	ctx.translate(x, y);
	ctx.scale(s, s);
	if (pose.shadow) {
		const shrink = 1 - b.air * 0.6;
		ctx.fillStyle = `rgba(0, 0, 0, ${0.45 * shrink})`;
		ctx.beginPath();
		ctx.ellipse(0, 0, 19 * shrink, 5 * shrink, 0, 0, TAU);
		ctx.fill();
	}
	ctx.scale(pose.dir, 1);
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';
	if (!defeated) aura(ctx, (sk.hip[1] + sk.neck[1]) / 2, 34, b.rage + 0.7 + (winding ? 0.5 : 0), time, x);

	// The Book of the Black, floating behind his far shoulder
	if (!defeated) drawBookOfTheBlack(ctx, sk.back.shoulder[0] - 10, sk.back.shoulder[1] - 6, time, b.rage);

	// Far limbs: thick, armoured
	segment(ctx, sk.back.shoulder, sk.back.elbow, 3.6, 3, suit(BLACK));
	segment(ctx, sk.back.elbow, sk.back.hand, 3, 2.7, suit(RED_DEEP));
	segment(ctx, sk.back.hipJoint, sk.back.knee, 4, 3.3, suit(BLACK));
	segment(ctx, sk.back.knee, sk.back.foot, 3.3, 2.6, suit(RED_DEEP));

	// Torso: broad, black plate with red panels, a heavy gorget
	const up: Point = [Math.sin(sk.torsoAngle), -Math.cos(sk.torsoAngle)];
	const across: Point = [Math.cos(sk.torsoAngle), Math.sin(sk.torsoAngle)];
	const at = (along: number, side: number): Point => [
		sk.hip[0] + up[0] * along + across[0] * side,
		sk.hip[1] + up[1] * along + across[1] * side
	];
	const torso = new Path2D();
	for (const [i, p] of [at(-1.5, -5.5), at(9, -5.2), at(17.5, -7), at(20.5, 5.5), at(12, 6.8), at(4, 5.2), at(-1.5, 5.6)].entries()) {
		if (i === 0) torso.moveTo(...p);
		else torso.lineTo(...p);
	}
	torso.closePath();
	ctx.fillStyle = suit(BLACK_LIT);
	ctx.fill(torso);
	ctx.save();
	ctx.clip(torso);
	ctx.fillStyle = suit(RED_SUIT);
	ctx.fill(new Path2D(`M ${at(3, -1.5).join(' ')} L ${at(18, -2.5).join(' ')} L ${at(18, 3.5).join(' ')} L ${at(3, 2.5).join(' ')} Z`));
	ctx.restore();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.9;
	ctx.stroke(torso);
	emblem(ctx, ...at(12.5, 0.8), 3, sk.torsoAngle);
	// Shoulder plates
	ctx.fillStyle = suit(RED_DEEP);
	ctx.beginPath();
	ctx.ellipse(...at(17.5, -5), 4.2, 3, sk.torsoAngle, 0, TAU);
	ctx.fill();
	ctx.stroke();

	// Near leg
	segment(ctx, sk.front.hipJoint, sk.front.knee, 4.2, 3.4, suit(BLACK_LIT));
	segment(ctx, sk.front.knee, sk.front.foot, 3.4, 2.7, suit(RED_SUIT));

	// Head: bald and ridged, the brow a ledge, eyes burning down in the dark under it
	const [hx, hy] = sk.headCenter;
	ctx.save();
	ctx.translate(hx, hy);
	ctx.rotate(sk.headAngle);
	ctx.scale(1.2, 1.2);
	ctx.fillStyle = skin;
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.beginPath();
	ctx.moveTo(-4.5, 4);
	ctx.quadraticCurveTo(-6, -4, -1, -6.4);
	ctx.quadraticCurveTo(5, -7, 6, -1.6);
	ctx.lineTo(6.4, 2.4);
	ctx.quadraticCurveTo(5.6, 6, 1.5, 6.4);
	ctx.quadraticCurveTo(-3, 6.2, -4.5, 4);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	// Scalp ridges
	ctx.strokeStyle = flash ? '#ffffff' : ATRO_SKIN_DARK;
	ctx.lineWidth = 0.7;
	for (let i = 0; i < 3; i++) {
		ctx.beginPath();
		ctx.moveTo(-3 + i * 1.8, -6);
		ctx.quadraticCurveTo(-4 + i * 1.8, -3, -4.2 + i * 1.6, 0);
		ctx.stroke();
	}
	// The brow, and the dark under it
	ctx.fillStyle = flash ? '#ffffff' : ATRO_SKIN_DARK;
	ctx.beginPath();
	ctx.moveTo(0.5, -2.6);
	ctx.lineTo(7, -2.2);
	ctx.lineTo(6.4, -0.6);
	ctx.lineTo(1, -1);
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = '#1a0405';
	ctx.beginPath();
	ctx.ellipse(4.2, 0, 2.2, 1.1, 0, 0, TAU);
	ctx.fill();
	eye(ctx, 4.6, 0, 1, b.rage + 0.8 + (winding ? 0.8 : 0));
	// A mouth full of teeth, open when he acts
	const open = winding || acting ? 1.2 : 0.4;
	ctx.fillStyle = '#1a0405';
	ctx.beginPath();
	ctx.ellipse(4, 3.8, 2, open, 0, 0, TAU);
	ctx.fill();
	ctx.fillStyle = '#e8dcc8';
	for (let i = 0; i < 3; i++) ctx.fillRect(2.6 + i * 1, 3.8 - open, 0.5, 0.8);
	ctx.restore();

	// The ring arm
	segment(ctx, sk.front.shoulder, sk.front.elbow, 3.8, 3.1, suit(BLACK_LIT));
	segment(ctx, sk.front.elbow, sk.front.hand, 3.1, 2.8, suit(RED_SUIT));
	fist(ctx, sk.front.hand, suit(RED_DEEP), false);
	ring(ctx, sk.front.hand[0], sk.front.hand[1]);
	if (!defeated && (tell === 'aim' || tell === 'build')) orb(ctx, sk.front.hand[0], sk.front.hand[1], 2 + k * 4.5, time);
	else if (!defeated && tell === 'sky') orb(ctx, sk.headCenter[0], sk.headCenter[1] - 18 - k * 5, 3 + k * 7, time);
	ctx.restore();
}

/** The Book of the Black: a black book hanging in the air, its pages glowing red, burning as he reads (`reading` 0..1). */
function drawBookOfTheBlack(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, reading: number) {
	ctx.save();
	ctx.translate(x, y + Math.sin(time * 1.8) * 1.5);
	ctx.rotate(-0.2 + Math.sin(time * 0.9) * 0.08);
	const glow = 0.4 + 0.6 * Math.min(1, reading);
	ctx.shadowColor = RED;
	ctx.shadowBlur = 6 + 8 * glow;
	// Covers
	ctx.fillStyle = '#0a0506';
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.6;
	ctx.fillRect(-6, -4.5, 12, 9);
	ctx.strokeRect(-6, -4.5, 12, 9);
	ctx.shadowBlur = 0;
	// Open pages, glowing
	ctx.fillStyle = `rgba(255, 70, 60, ${0.5 + 0.4 * glow})`;
	ctx.beginPath();
	ctx.moveTo(0, -4);
	ctx.quadraticCurveTo(-3, -5, -5.4, -3.6);
	ctx.lineTo(-5.4, 3.6);
	ctx.quadraticCurveTo(-3, 2.6, 0, 3.8);
	ctx.quadraticCurveTo(3, 2.6, 5.4, 3.6);
	ctx.lineTo(5.4, -3.6);
	ctx.quadraticCurveTo(3, -5, 0, -4);
	ctx.closePath();
	ctx.fill();
	// A page turning
	const turn = (time * (0.6 + reading * 2)) % 1;
	ctx.strokeStyle = `rgba(255, 190, 170, ${0.6 * (1 - turn)})`;
	ctx.beginPath();
	ctx.moveTo(0, -4);
	ctx.quadraticCurveTo(4 - turn * 8, -6, 5 - turn * 10, -3);
	ctx.stroke();
	ctx.restore();
}

/** A rage blade along the forearm, sweeping past the hand: faint at rest, blazing in a fight. */
function forearmBlade(ctx: CanvasRenderingContext2D, elbow: Point, hand: Point, heat: number, time: number) {
	const [ex, ey] = elbow;
	const [hx, hy] = hand;
	const a = Math.atan2(hy - ey, hx - ex);
	const len = Math.hypot(hx - ex, hy - ey);
	ctx.save();
	ctx.translate(ex, ey);
	ctx.rotate(a);
	ctx.globalAlpha *= 0.45 + 0.55 * Math.min(1, heat);
	ctx.shadowColor = RED;
	ctx.shadowBlur = 6 + 10 * heat;
	ctx.fillStyle = heat > 0.8 && Math.sin(time * 40) > 0 ? HOT : RED;
	ctx.beginPath();
	ctx.moveTo(2, -1.2);
	ctx.lineTo(len + 9 + heat * 5, -3.2);
	ctx.lineTo(len + 13 + heat * 7, -0.5);
	ctx.lineTo(len + 4, 1.1);
	ctx.lineTo(2, 1.2);
	ctx.closePath();
	ctx.fill();
	ctx.restore();
}

/** One torn, bat-like wing from the shoulder blades. `spread` > 0 lifts it, < 0 folds it back. */
function drawWing(ctx: CanvasRenderingContext2D, root: Point, spread: number, far: boolean, flash: boolean) {
	ctx.save();
	ctx.translate(root[0], root[1]);
	ctx.rotate(-0.5 - spread + (far ? -0.25 : 0));
	const L = far ? 36 : 42;
	// Arm of the wing, then fingers fanning down, with ragged membrane between
	const wrist: Point = [-L * 0.55, -L * 0.45];
	const tips: Point[] = [
		[-L * 1.05, -L * 0.3],
		[-L * 0.95, 0],
		[-L * 0.7, L * 0.28],
		[-L * 0.35, L * 0.4]
	];
	ctx.fillStyle = flash ? '#ffdddd' : far ? WING : WING_LIT;
	ctx.globalAlpha *= far ? 0.85 : 0.95;
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.lineTo(...wrist);
	ctx.lineTo(...tips[0]);
	for (let i = 1; i < tips.length; i++) {
		const [px, py] = tips[i - 1];
		const [qx, qy] = tips[i];
		// Torn edge: a ragged notch between each finger
		ctx.lineTo((px + qx) / 2 + 3, (py + qy) / 2 - 2);
		ctx.lineTo(qx, qy);
	}
	ctx.lineTo(0, 4);
	ctx.closePath();
	ctx.fill();
	ctx.strokeStyle = far ? '#0a060c' : RED_DEEP;
	ctx.lineWidth = 0.9;
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.lineTo(...wrist);
	for (const t of tips) {
		ctx.moveTo(...wrist);
		ctx.lineTo(...t);
	}
	ctx.stroke();
	// A hook claw at the wrist
	ctx.fillStyle = '#d8c7a4';
	ctx.beginPath();
	ctx.moveTo(wrist[0], wrist[1]);
	ctx.lineTo(wrist[0] - 1, wrist[1] - 4);
	ctx.lineTo(wrist[0] + 1.5, wrist[1] - 0.5);
	ctx.fill();
	ctx.restore();
}

// ------------------------------------------------------------------ shared

function aura(ctx: CanvasRenderingContext2D, cy: number, r0: number, heat: number, time: number, seed: number) {
	const alpha = 0.18 + 0.25 * Math.min(1.5, heat);
	const flicker = 0.8 + 0.2 * Math.sin(time * 23 + seed);
	const g = ctx.createRadialGradient(0, cy, 3, 0, cy, r0 + 8);
	g.addColorStop(0, `rgba(255, 42, 42, ${alpha * flicker})`);
	g.addColorStop(1, 'rgba(255, 42, 42, 0)');
	ctx.fillStyle = g;
	ctx.beginPath();
	for (let i = 0; i < 18; i++) {
		const a = (i / 18) * TAU;
		const r = r0 * (i % 2 === 0 ? 1.12 : 0.86) + Math.sin(time * 9 + i) * 2;
		ctx.lineTo(Math.cos(a) * r * 1.1, cy + Math.sin(a) * r);
	}
	ctx.closePath();
	ctx.fill();
}

function emblem(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, angle = 0) {
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(angle);
	ctx.fillStyle = '#120404';
	ctx.beginPath();
	ctx.arc(0, 0, r, 0, TAU);
	ctx.fill();
	ctx.shadowColor = RED;
	ctx.shadowBlur = 4;
	ctx.strokeStyle = RED;
	ctx.lineWidth = r * 0.3;
	ctx.beginPath();
	ctx.arc(0, 0, r * 0.72, 0, TAU);
	ctx.stroke();
	ctx.restore();
}

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, intensity: number) {
	ctx.save();
	ctx.shadowColor = RED;
	ctx.shadowBlur = 5 + 6 * Math.min(1.5, intensity);
	ctx.fillStyle = '#ff6a6a';
	ctx.beginPath();
	ctx.ellipse(x, y, r, r * 0.75, -0.2, 0, TAU);
	ctx.fill();
	ctx.fillStyle = HOT;
	ctx.beginPath();
	ctx.arc(x + r * 0.2, y - r * 0.1, r * 0.4, 0, TAU);
	ctx.fill();
	ctx.restore();
}

/** The Red Lantern ring on a hand. */
function ring(ctx: CanvasRenderingContext2D, x: number, y: number) {
	ctx.save();
	ctx.shadowColor = RED;
	ctx.shadowBlur = 6;
	ctx.strokeStyle = RED;
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.arc(x, y, 1.6, 0, TAU);
	ctx.stroke();
	ctx.restore();
}

function drip(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, seed: number) {
	const k = (time * 1.4 + seed) % 1;
	ctx.save();
	ctx.fillStyle = RED;
	ctx.globalAlpha *= 1 - k * 0.6;
	ctx.beginPath();
	ctx.ellipse(x, y + k * 7, 0.9, 0.9 + k * 1.5, 0, 0, TAU);
	ctx.fill();
	ctx.restore();
}

function orb(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, time: number) {
	ctx.save();
	ctx.shadowColor = RED;
	ctx.shadowBlur = 10;
	ctx.fillStyle = RED;
	ctx.beginPath();
	ctx.arc(x, y, r * (1 + 0.12 * Math.sin(time * 25)), 0, TAU);
	ctx.fill();
	ctx.fillStyle = HOT;
	ctx.beginPath();
	ctx.arc(x, y, r * 0.45, 0, TAU);
	ctx.fill();
	ctx.restore();
}

function limb(
	ctx: CanvasRenderingContext2D,
	hip: Point,
	a1: number,
	len1: number,
	a2: number,
	len2: number,
	w1: number,
	w2: number,
	color: string
): Point {
	const knee: Point = [hip[0] + Math.sin(a1) * len1, hip[1] + Math.cos(a1) * len1];
	const foot: Point = [knee[0] + Math.sin(a2) * len2, knee[1] + Math.cos(a2) * len2];
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = w1 + 1.4;
	ctx.beginPath();
	ctx.moveTo(...hip);
	ctx.lineTo(...knee);
	ctx.lineTo(...foot);
	ctx.stroke();
	ctx.strokeStyle = color;
	ctx.lineWidth = w1;
	ctx.beginPath();
	ctx.moveTo(...hip);
	ctx.lineTo(...knee);
	ctx.stroke();
	ctx.lineWidth = w2;
	ctx.beginPath();
	ctx.moveTo(...knee);
	ctx.lineTo(...foot);
	ctx.stroke();
	return foot;
}
