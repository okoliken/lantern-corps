// Red Lantern creatures. A red ring picks its bearer for rage, not for having
// two arms and two legs, so the rank and file of Atrocitus's army are all
// kinds of alien beasts:
//
//   Rage Beast   (Berserker)  a hulking, horned four-legged brute
//   Rage Stalker (Hunter)     a mantis-like insect with scythe arms and buzzing wings
//   Rage Maw     (Gunner)     a floating, tentacled thing that is mostly mouth
//
// Each is drawn procedurally, facing right, from a handful of animation
// values worked out from the brain (moving, winding up, attacking, hurt,
// defeated), so they need no stored animation state. Every one wears the
// Red Lantern emblem, glows with the rage aura, and has a HAND: the point
// where its red constructs form (a mouth, a claw, the tips of its scythes).

import { ENEMIES, type Enemy, type Role } from '../enemies/enemies';
import { ABILITIES, SLAM_HEIGHT } from '../enemies/redConstructs';
import { isStanding } from '../dummy';

const RED = '#ff2a2a';
const RED_DEEP = '#7a0b0b';
const HOT = '#ffd0d0';
const OUTLINE = '#050101';
const TAU = Math.PI * 2;
/** Same size multiplier as the Lanterns. */
const SCALE = 1.35;
/** They hover a little off the ground. */
const HOVER = 12;

type Point = [number, number];

/** Where each species' HAND is, in its own units (facing right, above its hover point). */
const HANDS: Record<Role, Point> = {
	berserker: [25, -27],
	hunter: [20, -30],
	gunner: [16, -28]
};

/** Everything the drawing needs to know, worked out once per frame. */
interface Anim {
	time: number;
	/** 0..1 how fast it's moving. */
	move: number;
	/** Gait cycle angle. */
	gait: number;
	/** 0..1 through a windup. */
	windup: number;
	/** The construct being wound up / used. */
	winding: string | null;
	acting: string | null;
	/** Body flashing white (hit, or the "!" tell). */
	flash: boolean;
	/** 0..1 rage. */
	rage: number;
	/** Defeated: 0 just fell .. 1 gone. */
	fall: number;
	/** Opening its mouth: snarling, roaring, spitting. */
	snarl: number;
}

/** Where a grunt's hand is in world coordinates (chains, beams and aim lines start here). */
export function creatureHand(e: Enemy, x: number, y: number): Point {
	const s = SCALE * ENEMIES[e.kind].scale;
	const [hx, hy] = HANDS[e.brain.role];
	return [x + hx * e.dir * s, y + (hy - HOVER - e.brain.air * SLAM_HEIGHT / s) * s];
}

export function drawCreature(ctx: CanvasRenderingContext2D, e: Enemy, x: number, y: number, hasGround: boolean, time: number) {
	const b = e.brain;
	const s = SCALE * ENEMIES[e.kind].scale;
	const defeated = !isStanding(e);
	const fall = defeated ? 1 - Math.min(1, e.down / 0.9) : 0;
	const winding = b.state === 'windup' ? b.ability : null;
	const acting = b.state === 'act' ? b.ability : null;
	const tell = winding ? ABILITIES[winding].tell : null;
	const bodyTell = (tell === 'strike' || tell === 'heavy' || tell === 'sky') && Math.sin(time * 30) > 0;
	const speed = Math.hypot(e.vx, e.vy);
	const a: Anim = {
		time,
		move: Math.min(1, speed / 150),
		gait: time * (3 + 7 * Math.min(1, speed / 150)) + e.homeX * 0.01,
		windup: winding ? 1 - b.timer / ABILITIES[winding].windup : 0,
		winding,
		acting,
		flash: e.flash > 0 || bodyTell,
		rage: b.rage,
		fall,
		snarl: winding || acting ? 1 : 0.15 + 0.1 * Math.sin(time * 3 + e.homeY)
	};
	const air = b.air * SLAM_HEIGHT;

	ctx.save();
	ctx.globalAlpha = defeated ? Math.min(1, e.down / 0.5) : 1;
	ctx.translate(x, y);

	if (hasGround) {
		const k = 1 - b.air * 0.5;
		ctx.fillStyle = `rgba(0, 0, 0, ${0.38 * k})`;
		ctx.beginPath();
		ctx.ellipse(0, 0, 17 * s * k, 4.5 * s * k, 0, 0, TAU);
		ctx.fill();
	}

	ctx.translate(0, -air);
	ctx.scale(s * e.dir, s);
	// Defeated: sinks to the ground and tips over
	const hover = HOVER * (1 - fall) + Math.sin(time * 2.2 + e.homeX) * 1.5 * (1 - fall);
	ctx.translate(0, -hover);
	if (defeated) ctx.rotate(-fall * 0.9);

	if (!defeated) drawAura(ctx, b.role, a, x);
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';
	if (b.role === 'berserker') drawBeast(ctx, a);
	else if (b.role === 'hunter') drawStalker(ctx, a);
	else drawMaw(ctx, a);

	// Constructs forming at the hand
	if (!defeated) {
		const [hx, hy] = HANDS[b.role];
		const k = a.windup;
		if (winding === 'saw') drawSaw(ctx, hx, hy, 2 + k * 5, time * 20);
		else if (tell === 'aim' || tell === 'build') drawOrb(ctx, hx, hy, 1.5 + k * 3.5, time);
		else if (tell === 'sky') drawOrb(ctx, 0, -58 - k * 4, 2 + k * 5, time);
	}
	ctx.restore();
}

// ------------------------------------------------------------------ pieces

/** The flickering, jagged red halo that grows with rage and flares on a windup. */
function drawAura(ctx: CanvasRenderingContext2D, role: Role, a: Anim, seed: number) {
	const cy = role === 'gunner' ? -36 : -30;
	const r0 = role === 'gunner' ? 22 : 24;
	const heat = 0.16 + 0.25 * a.rage + (a.winding ? 0.25 : 0);
	const flicker = 0.8 + 0.2 * Math.sin(a.time * 23 + seed);
	const g = ctx.createRadialGradient(0, cy, 3, 0, cy, r0 + 6 + 4 * a.rage);
	g.addColorStop(0, `rgba(255, 42, 42, ${heat * flicker})`);
	g.addColorStop(1, 'rgba(255, 42, 42, 0)');
	ctx.fillStyle = g;
	ctx.beginPath();
	for (let i = 0; i < 16; i++) {
		const ang = (i / 16) * TAU;
		const r = (r0 + 4 * a.rage) * (i % 2 === 0 ? 1.12 : 0.86) + Math.sin(a.time * 9 + i) * 2;
		ctx.lineTo(Math.cos(ang) * r * 1.2, cy + Math.sin(ang) * r);
	}
	ctx.closePath();
	ctx.fill();
}

/** The Red Lantern emblem: a dark disc, a red ring, two drips. */
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
	ctx.lineWidth = r * 0.25;
	ctx.beginPath();
	ctx.moveTo(-r * 0.4, r * 0.9);
	ctx.lineTo(-r * 0.4, r * 1.6);
	ctx.moveTo(r * 0.3, r * 0.95);
	ctx.lineTo(r * 0.3, r * 1.9);
	ctx.stroke();
	ctx.restore();
}

function glowEye(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, intensity = 1) {
	ctx.save();
	ctx.shadowColor = RED;
	ctx.shadowBlur = 6 + 6 * intensity;
	ctx.fillStyle = '#ff6a6a';
	ctx.beginPath();
	ctx.ellipse(x, y, rx, ry, -0.2, 0, TAU);
	ctx.fill();
	ctx.fillStyle = HOT;
	ctx.beginPath();
	ctx.ellipse(x + rx * 0.2, y - ry * 0.1, rx * 0.4, ry * 0.4, 0, 0, TAU);
	ctx.fill();
	ctx.restore();
}

/** Rage plasma dripping from a jaw, on a loop. */
function drip(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, seed: number) {
	const k = (time * 1.4 + seed) % 1;
	ctx.fillStyle = RED;
	ctx.globalAlpha *= 1 - k * 0.6;
	ctx.beginPath();
	ctx.ellipse(x, y + k * 7, 0.8, 0.8 + k * 1.4, 0, 0, TAU);
	ctx.fill();
	ctx.globalAlpha /= 1 - k * 0.6;
}

/** A leg (or arm) from `hip` with two bones; angles are from straight down, positive = forward. */
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

function claws(ctx: CanvasRenderingContext2D, at: Point, angle: number, len: number, glow: boolean) {
	ctx.save();
	if (glow) {
		ctx.shadowColor = RED;
		ctx.shadowBlur = 8;
	}
	ctx.fillStyle = glow ? RED : '#d9cbb6';
	for (const spread of [-0.5, 0, 0.5]) {
		const ang = angle + spread;
		ctx.beginPath();
		ctx.moveTo(at[0] + Math.cos(ang + 1.5) * 1.2, at[1] + Math.sin(ang + 1.5) * 1.2);
		ctx.quadraticCurveTo(
			at[0] + Math.cos(ang) * len * 0.6 + Math.cos(ang - 1.5) * 1.6,
			at[1] + Math.sin(ang) * len * 0.6 + Math.sin(ang - 1.5) * 1.6,
			at[0] + Math.cos(ang) * len,
			at[1] + Math.sin(ang) * len
		);
		ctx.lineTo(at[0] + Math.cos(ang - 1.5) * 1.2, at[1] + Math.sin(ang - 1.5) * 1.2);
		ctx.closePath();
		ctx.fill();
	}
	ctx.restore();
}

// ------------------------------------------------------------ Rage Beast

const BEAST_HIDE = '#5b4768';
const BEAST_HIDE_DARK = '#3a2c46';
const BEAST_BELLY = '#7d6a86';
const HORN = '#2b1c16';
const PLATE = '#8e1515';

function drawBeast(ctx: CanvasRenderingContext2D, a: Anim) {
	const { time } = a;
	const hide = a.flash ? '#ffffff' : BEAST_HIDE;
	const dark = a.flash ? '#ffdddd' : BEAST_HIDE_DARK;
	// Crouch before a heavy attack, lunge forward on the claws
	const crouch = a.winding === 'slam' || a.winding === 'roar' || a.winding === 'charge' ? a.windup : 0;
	const lunge = a.acting === 'claws' || a.acting === 'scythe' ? 1 : 0;
	const roar = a.winding === 'roar' || a.acting === 'roar' ? 1 : 0;
	const bob = Math.sin(a.gait * 2) * 1.2 * a.move;
	ctx.translate(lunge * 4, crouch * 4 + bob);

	// Galloping legs (paddling in the air while it hovers): far pair first
	const swing = (phase: number) => Math.sin(a.gait + phase) * (0.25 + 0.55 * a.move);
	const frontSwipe = lunge ? -1.7 : a.winding === 'claws' ? 0.6 * a.windup : 0;
	limb(ctx, [-12, -22], swing(Math.PI) + 0.1, 9, swing(Math.PI) - 0.3, 9, 5, 4, dark);
	const farFront = limb(ctx, [10, -24], swing(0) - 0.1 + frontSwipe * 0.7, 9, swing(0) + 0.3 + frontSwipe * 0.6, 9, 5, 4, dark);
	claws(ctx, farFront, Math.PI / 2 - frontSwipe * 0.8, 4, lunge > 0);

	// Tail: short, spiked, whipping
	const tail = Math.sin(time * 4) * 0.3 + a.move * 0.2;
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 4.4;
	ctx.beginPath();
	ctx.moveTo(-18, -28);
	ctx.quadraticCurveTo(-26, -30 + tail * 6, -30, -24 + tail * 10);
	ctx.stroke();
	ctx.strokeStyle = dark;
	ctx.lineWidth = 3;
	ctx.stroke();

	// Body: heavy haunches, a huge humped front
	const body = new Path2D();
	body.moveTo(-20, -24);
	body.quadraticCurveTo(-22, -36, -10, -36);
	body.quadraticCurveTo(0, -46 + crouch * 3, 12, -42);
	body.quadraticCurveTo(22, -38, 20, -26);
	body.quadraticCurveTo(12, -16, 0, -18);
	body.quadraticCurveTo(-14, -15, -20, -24);
	body.closePath();
	ctx.fillStyle = hide;
	ctx.fill(body);
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 1;
	ctx.stroke(body);
	// Lighter belly
	ctx.save();
	ctx.clip(body);
	ctx.fillStyle = a.flash ? '#ffffff' : BEAST_BELLY;
	ctx.beginPath();
	ctx.ellipse(2, -16, 18, 5, 0, 0, TAU);
	ctx.fill();
	// Red armour plates along the spine
	ctx.fillStyle = a.flash ? '#ffe0e0' : PLATE;
	for (let i = 0; i < 4; i++) {
		const px = -12 + i * 7;
		const py = -38 - Math.sin((i / 3) * Math.PI) * 5 + crouch * 2;
		ctx.beginPath();
		ctx.moveTo(px - 3.5, py + 3);
		ctx.lineTo(px, py - 3);
		ctx.lineTo(px + 3.5, py + 3);
		ctx.closePath();
		ctx.fill();
	}
	ctx.restore();
	// Spikes poking out of the hump
	ctx.fillStyle = a.flash ? '#ffffff' : HORN;
	for (let i = 0; i < 3; i++) {
		const px = -2 + i * 6;
		const py = -44 + (i === 1 ? -1 : 1) + crouch * 3;
		ctx.beginPath();
		ctx.moveTo(px - 1.5, py + 2);
		ctx.lineTo(px - 2.5, py - 4);
		ctx.lineTo(px + 1.5, py + 1.5);
		ctx.closePath();
		ctx.fill();
	}
	emblem(ctx, 4, -30, 3.2);

	// Head: low and forward, heavy brow, jaw dropping open to roar
	ctx.save();
	ctx.translate(20, -32 + crouch * 2);
	ctx.rotate(-roar * 0.35 + lunge * 0.15);
	const jaw = 1 + a.snarl * 3 + roar * 3;
	const head = new Path2D();
	head.moveTo(-4, -6);
	head.quadraticCurveTo(4, -9, 10, -4);
	head.lineTo(12, 0);
	head.lineTo(8, 1);
	head.lineTo(-3, 3);
	head.closePath();
	ctx.fillStyle = hide;
	ctx.fill(head);
	ctx.strokeStyle = OUTLINE;
	ctx.stroke(head);
	// Lower jaw
	const lower = new Path2D();
	lower.moveTo(-2, 3);
	lower.lineTo(10, 1 + jaw * 0.5);
	lower.lineTo(9, 3 + jaw);
	lower.quadraticCurveTo(2, 5 + jaw, -2, 4);
	lower.closePath();
	ctx.fillStyle = dark;
	ctx.fill(lower);
	ctx.stroke(lower);
	// Mouth glow and fangs
	ctx.fillStyle = '#3a0000';
	ctx.beginPath();
	ctx.moveTo(0, 2.5);
	ctx.lineTo(10.5, 0.8);
	ctx.lineTo(9, 1.5 + jaw * 0.8);
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = '#f2ead8';
	for (const fx of [4, 7.5]) {
		ctx.beginPath();
		ctx.moveTo(fx, 1.2);
		ctx.lineTo(fx + 0.6, 1.2 + 1.6 + jaw * 0.2);
		ctx.lineTo(fx + 1.2, 1.1);
		ctx.fill();
	}
	drip(ctx, 9, 2 + jaw, time, 0.3);
	// Horns: curling forward from behind the brow
	ctx.fillStyle = a.flash ? '#ffffff' : HORN;
	ctx.beginPath();
	ctx.moveTo(-3, -5);
	ctx.quadraticCurveTo(-4, -16, 6, -17);
	ctx.quadraticCurveTo(0, -13, 1, -6);
	ctx.closePath();
	ctx.fill();
	glowEye(ctx, 6.5, -4, 1.7, 1, a.rage + (a.winding ? 0.8 : 0));
	ctx.restore();

	// Near legs on top
	limb(ctx, [-10, -21], swing(0) + 0.05, 9, swing(0) - 0.35, 9.5, 5.5, 4.5, hide);
	const nearFront = limb(ctx, [12, -23], swing(Math.PI) - 0.05 + frontSwipe, 9, swing(Math.PI) + 0.35 + frontSwipe * 0.8, 9, 5.5, 4.5, hide);
	claws(ctx, nearFront, Math.PI / 2 - frontSwipe, 5, lunge > 0 || a.winding === 'claws' || a.winding === 'scythe');
	// Its ring, on the near foreleg
	ctx.save();
	ctx.shadowColor = RED;
	ctx.shadowBlur = 6;
	ctx.strokeStyle = RED;
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.arc(nearFront[0] - 0.5, nearFront[1] - 3, 2, 0, TAU);
	ctx.stroke();
	ctx.restore();
}

// ------------------------------------------------------------ Rage Stalker

const CHITIN = '#27343a';
const CHITIN_LIT = '#3f5560';
const WING = 'rgba(255, 110, 110, 0.22)';

function drawStalker(ctx: CanvasRenderingContext2D, a: Anim) {
	const { time } = a;
	const shell = a.flash ? '#ffffff' : CHITIN_LIT;
	const dark = a.flash ? '#ffdddd' : CHITIN;
	const raise = a.winding ? a.windup : a.acting ? 1 : 0;
	const slash = a.acting === 'claws' || a.acting === 'scythe' ? 1 : 0;
	ctx.translate(0, Math.sin(time * 5) * 1);

	// Wings: a fast buzz, blurred
	const buzz = Math.sin(time * 70) * 0.35;
	ctx.fillStyle = WING;
	ctx.strokeStyle = 'rgba(255, 140, 140, 0.35)';
	ctx.lineWidth = 0.6;
	for (const [k, off] of [[1, 0], [0.8, 0.5]] as const) {
		ctx.save();
		ctx.translate(-2, -40);
		ctx.rotate(-1.9 + buzz * k + off * 0.2);
		ctx.beginPath();
		ctx.ellipse(12 * k, 0, 13 * k, 4, 0, 0, TAU);
		ctx.fill();
		ctx.stroke();
		ctx.restore();
	}

	// Thin legs: a skittering, tippy-toe gait, far side first
	const step = (phase: number) => Math.sin(a.gait * 1.4 + phase) * (0.15 + 0.4 * a.move);
	for (const [hx, ph] of [[-6, 0], [3, Math.PI]] as const) {
		limb(ctx, [hx, -31], -0.7 + step(ph), 10, 0.35 + step(ph) * 0.5, 13, 1.6, 1.2, dark);
	}

	// Abdomen: long, segmented, hanging back
	ctx.save();
	ctx.translate(-8, -32);
	ctx.rotate(0.35 + Math.sin(time * 2) * 0.05);
	const abdomen = new Path2D();
	abdomen.ellipse(-10, 0, 13, 6.5, 0, 0, TAU);
	ctx.fillStyle = dark;
	ctx.fill(abdomen);
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 1;
	ctx.stroke(abdomen);
	ctx.strokeStyle = a.flash ? '#ffffff' : RED_DEEP;
	ctx.lineWidth = 1.2;
	for (let i = 0; i < 4; i++) {
		ctx.beginPath();
		ctx.ellipse(-4 - i * 4.5, 0, 1.2, 5.8 - i * 0.6, 0, 0, TAU);
		ctx.stroke();
	}
	// Stinger
	ctx.fillStyle = RED;
	ctx.beginPath();
	ctx.moveTo(-22, -1);
	ctx.lineTo(-27, 1);
	ctx.lineTo(-22, 2);
	ctx.closePath();
	ctx.fill();
	ctx.restore();

	// Thorax and neck
	const thorax = new Path2D();
	thorax.ellipse(0, -35, 7, 5.5, -0.5, 0, TAU);
	ctx.fillStyle = shell;
	ctx.fill(thorax);
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 1;
	ctx.stroke(thorax);
	emblem(ctx, -1, -35, 2.4, -0.5);
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 3.6;
	ctx.beginPath();
	ctx.moveTo(3, -38);
	ctx.lineTo(8, -46);
	ctx.stroke();
	ctx.strokeStyle = shell;
	ctx.lineWidth = 2.4;
	ctx.stroke();

	// Head: a wedge with big compound eyes and working mandibles
	ctx.save();
	ctx.translate(9, -48);
	ctx.rotate(0.35 - raise * 0.2);
	const head = new Path2D();
	head.moveTo(-3, -3);
	head.lineTo(6, -2);
	head.lineTo(9, 2);
	head.lineTo(-2, 3);
	head.closePath();
	ctx.fillStyle = shell;
	ctx.fill(head);
	ctx.strokeStyle = OUTLINE;
	ctx.stroke(head);
	// Antennae
	ctx.strokeStyle = dark;
	ctx.lineWidth = 0.7;
	ctx.beginPath();
	ctx.moveTo(1, -3);
	ctx.quadraticCurveTo(-2, -12, -8, -13 + Math.sin(time * 6) * 1.5);
	ctx.moveTo(3, -3);
	ctx.quadraticCurveTo(2, -11, -3, -14 + Math.sin(time * 6 + 1) * 1.5);
	ctx.stroke();
	glowEye(ctx, 3, -0.5, 2.6, 2, a.rage + (a.winding ? 0.8 : 0));
	const nip = (a.snarl * 0.6 + Math.sin(time * 12) * 0.15) * 0.7;
	ctx.strokeStyle = a.flash ? '#ffffff' : '#d9cbb6';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(8, 1.5);
	ctx.quadraticCurveTo(11, 2 - nip * 3, 10, 4);
	ctx.moveTo(7, 2.5);
	ctx.quadraticCurveTo(10, 4 + nip * 3, 8, 6);
	ctx.stroke();
	ctx.restore();

	// Scythe arms, like a mantis: the upper arm reaches up and forward, the blade
	// folds down from the elbow. Raised high on the windup, swung forward to strike.
	for (const far of [true, false]) {
		const shoulder: Point = far ? [3, -37] : [5, -36];
		const up = 2.3 + raise * 0.5 - slash * 0.9 - (far ? 0.12 : 0);
		const elbow: Point = [shoulder[0] + Math.sin(up) * 10, shoulder[1] + Math.cos(up) * 10];
		const bladeAngle = 0.25 + raise * 1.3 + slash * 0.6 + (far ? 0.15 : 0);
		const tip: Point = [elbow[0] + Math.sin(bladeAngle) * 17, elbow[1] + Math.cos(bladeAngle) * 17];
		ctx.strokeStyle = OUTLINE;
		ctx.lineWidth = 3.4;
		ctx.beginPath();
		ctx.moveTo(...shoulder);
		ctx.lineTo(...elbow);
		ctx.stroke();
		ctx.strokeStyle = far ? dark : shell;
		ctx.lineWidth = 2.2;
		ctx.stroke();
		// The blade: a curved, glowing-edged hook
		ctx.save();
		if (raise > 0 || slash > 0) {
			ctx.shadowColor = RED;
			ctx.shadowBlur = 8;
		}
		ctx.fillStyle = a.flash ? '#ffffff' : far ? RED_DEEP : RED;
		ctx.beginPath();
		ctx.moveTo(elbow[0], elbow[1]);
		// Bulge on the front edge, so the blade curves like a sickle
		ctx.quadraticCurveTo(
			(elbow[0] + tip[0]) / 2 + Math.cos(bladeAngle) * 6,
			(elbow[1] + tip[1]) / 2 - Math.sin(bladeAngle) * 6,
			tip[0],
			tip[1]
		);
		ctx.quadraticCurveTo((elbow[0] + tip[0]) / 2, (elbow[1] + tip[1]) / 2, elbow[0] + 1, elbow[1] + 1);
		ctx.closePath();
		ctx.fill();
		ctx.restore();
	}
}

// ------------------------------------------------------------ Rage Maw

const MAW_SKIN = '#6b4a63';
const MAW_DARK = '#402a3c';
const MAW_LIGHT = '#8e6a84';

function drawMaw(ctx: CanvasRenderingContext2D, a: Anim) {
	const { time } = a;
	const skin = a.flash ? '#ffffff' : MAW_SKIN;
	const dark = a.flash ? '#ffdddd' : MAW_DARK;
	// Swells before it spits, recoils as it does
	const swell = a.winding ? a.windup * 0.12 : 0;
	const recoil = a.acting ? 1 : 0;
	const pulse = 1 + Math.sin(time * 3) * 0.03 + swell;
	ctx.translate(-recoil * 2, -6 + Math.sin(time * 1.8) * 2);

	// Tentacles trailing behind as it moves
	for (let i = 0; i < 6; i++) {
		const base = -9 + i * 3.6;
		const len = 16 + (i % 2) * 5;
		ctx.strokeStyle = OUTLINE;
		ctx.lineWidth = 3.6 - i * 0.2;
		ctx.beginPath();
		ctx.moveTo(base, -24);
		let px = base;
		let py = -24;
		for (let j = 1; j <= 5; j++) {
			const k = j / 5;
			px = base - a.move * 10 * k + Math.sin(time * 3 + i * 1.3 + j * 0.9) * 3 * k;
			py = -24 + len * k;
			ctx.lineTo(px, py);
		}
		ctx.stroke();
		ctx.strokeStyle = i % 2 ? dark : skin;
		ctx.lineWidth = 2.4 - i * 0.2;
		ctx.stroke();
		// Red glowing tip
		ctx.fillStyle = RED;
		ctx.beginPath();
		ctx.arc(px, py, 0.9, 0, TAU);
		ctx.fill();
	}

	// The bulb: a big, fleshy, veined dome
	ctx.save();
	ctx.translate(0, -36);
	ctx.scale(pulse, pulse);
	const bulb = new Path2D();
	bulb.moveTo(-15, 8);
	bulb.quadraticCurveTo(-19, -12, -2, -16);
	bulb.quadraticCurveTo(16, -17, 17, -2);
	bulb.quadraticCurveTo(17, 10, 8, 12);
	bulb.lineTo(-10, 12);
	bulb.closePath();
	const g = ctx.createLinearGradient(0, -16, 0, 12);
	g.addColorStop(0, a.flash ? '#ffffff' : MAW_LIGHT);
	g.addColorStop(1, skin);
	ctx.fillStyle = g;
	ctx.fill(bulb);
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 1;
	ctx.stroke(bulb);
	// Glowing red veins, brighter with rage
	ctx.save();
	ctx.clip(bulb);
	ctx.strokeStyle = `rgba(255, 60, 60, ${0.35 + 0.4 * a.rage})`;
	ctx.lineWidth = 0.8;
	ctx.beginPath();
	ctx.moveTo(-12, -2);
	ctx.quadraticCurveTo(-6, -10, -4, -15);
	ctx.moveTo(-8, 4);
	ctx.quadraticCurveTo(0, -4, 6, -14);
	ctx.moveTo(-14, 6);
	ctx.quadraticCurveTo(-10, 0, -15, -6);
	ctx.stroke();
	ctx.restore();
	emblem(ctx, -8, -3, 3);

	// Three eyes on the brow
	for (const [ex, ey, r] of [[7, -10, 1.8], [11, -7, 1.4], [3, -12, 1.2]] as const) {
		ctx.fillStyle = '#1a0606';
		ctx.beginPath();
		ctx.arc(ex, ey, r + 0.6, 0, TAU);
		ctx.fill();
		glowEye(ctx, ex, ey, r, r, a.rage + (a.winding ? 0.8 : 0));
	}

	// The mouth: most of its front, opening wide to spit
	const open = 2 + a.snarl * 4 + swell * 30;
	ctx.fillStyle = '#2a0006';
	ctx.beginPath();
	ctx.moveTo(4, 7 - open * 0.5);
	ctx.quadraticCurveTo(17, 4 - open * 0.6, 18, 8);
	ctx.quadraticCurveTo(17, 11 + open * 0.5, 4, 8 + open * 0.3);
	ctx.closePath();
	ctx.fill();
	// A red glow deep in the throat
	ctx.save();
	ctx.shadowColor = RED;
	ctx.shadowBlur = 8;
	ctx.fillStyle = `rgba(255, 60, 40, ${0.5 + 0.5 * (a.winding ? a.windup : 0.2)})`;
	ctx.beginPath();
	ctx.ellipse(9, 8, 2.5, 1 + open * 0.2, 0, 0, TAU);
	ctx.fill();
	ctx.restore();
	// Rows of needle teeth
	ctx.fillStyle = '#f2ead8';
	for (let i = 0; i < 4; i++) {
		const tx = 7 + i * 2.7;
		ctx.beginPath();
		ctx.moveTo(tx, 6 - open * 0.45);
		ctx.lineTo(tx + 0.7, 8 - open * 0.2);
		ctx.lineTo(tx + 1.4, 6 - open * 0.45);
		ctx.fill();
		ctx.beginPath();
		ctx.moveTo(tx, 9 + open * 0.3);
		ctx.lineTo(tx + 0.7, 7.6 + open * 0.1);
		ctx.lineTo(tx + 1.4, 9 + open * 0.3);
		ctx.fill();
	}
	drip(ctx, 12, 9 + open * 0.4, time, 0.6);
	ctx.restore();
}

// ------------------------------------------------------------ constructs in hand

function drawOrb(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, time: number) {
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

function drawSaw(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number) {
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(spin);
	ctx.shadowColor = RED;
	ctx.shadowBlur = 10;
	ctx.fillStyle = RED;
	ctx.beginPath();
	for (let i = 0; i < 16; i++) {
		const ang = (i / 16) * TAU;
		const rr = i % 2 === 0 ? r : r * 0.62;
		ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
	}
	ctx.closePath();
	ctx.fill();
	ctx.restore();
}
