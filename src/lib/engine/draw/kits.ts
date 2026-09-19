// Art for Hal's and John's construct kits.
//
// Hal's constructs are big, bright and simple (a boxing glove, an anvil, a
// locomotive). John's are engineered: struts, rivets, plating, working parts
// (a reinforced fist, a wrecking ball, I-beams, Marines, a suit of armor).
// Everything is drawn in ring energy (see `energy` in constructs.ts).

import type { Effect, Projectile, Turret } from '../constructs/system';
import { computeSkeleton, turnScale, HEAD_R, type LanternPose } from '../animation';
import { energy, sparks } from './constructs';
import { GREEN } from './lantern';
import { green, greenCore, GREEN_CORE } from '../../theme';

const TAU = Math.PI * 2;
const CORE = GREEN_CORE;
/** The Lantern figure's drawing scale (matches draw/lantern.ts). */
const FIGURE_SCALE = 1.35;

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

// ------------------------------------------------------------ fists

/** Hal's Boxing Glove, pointing along +x from the wrist. */
export function glovePath(s: number): Path2D {
	const p = new Path2D();
	// Cuff with laces
	p.roundRect(-s * 0.72, -s * 0.3, s * 0.28, s * 0.6, s * 0.08);
	// The big padded mitt
	p.ellipse(s * 0.05, 0, s * 0.56, s * 0.5, 0, 0, TAU);
	// Thumb tucked along the top
	p.ellipse(-s * 0.08, -s * 0.44, s * 0.28, s * 0.14, -0.25, 0, TAU);
	return p;
}

/** John's Reinforced Fist: plated knuckles, struts through the back of the hand, a braced wrist. */
export function ironFistPath(s: number): Path2D {
	const p = new Path2D();
	// Braced wrist: two rails and a collar
	p.rect(-s * 0.7, -s * 0.28, s * 0.42, s * 0.1);
	p.rect(-s * 0.7, s * 0.18, s * 0.42, s * 0.1);
	p.roundRect(-s * 0.32, -s * 0.36, s * 0.1, s * 0.72, s * 0.03);
	// Back of the hand, squared off
	p.roundRect(-s * 0.22, -s * 0.46, s * 0.56, s * 0.92, s * 0.06);
	// Knuckle plates, one per finger
	for (let i = 0; i < 4; i++) {
		const fy = -s * 0.46 + s * 0.23 * i;
		p.roundRect(s * 0.34, fy + s * 0.01, s * 0.3, s * 0.21, s * 0.04);
	}
	// Thumb plate
	p.roundRect(s * 0.02, s * 0.2, s * 0.36, s * 0.18, s * 0.05);
	return p;
}

/** Inner struts and rivets over the Reinforced Fist, so it reads as built, not blown up. */
export function ironFistDetail(ctx: CanvasRenderingContext2D, s: number) {
	ctx.save();
	ctx.strokeStyle = greenCore(0.7);
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	// A cross-brace through the back of the hand
	ctx.moveTo(-s * 0.18, -s * 0.4);
	ctx.lineTo(s * 0.3, s * 0.4);
	ctx.moveTo(-s * 0.18, s * 0.4);
	ctx.lineTo(s * 0.3, -s * 0.4);
	ctx.stroke();
	ctx.fillStyle = CORE;
	for (const [rx, ry] of [
		[-0.16, -0.38],
		[0.28, -0.38],
		[-0.16, 0.38],
		[0.28, 0.38]
	]) {
		ctx.beginPath();
		ctx.arc(s * rx, s * ry, 1.6, 0, TAU);
		ctx.fill();
	}
	ctx.restore();
}

/** The Boxing Glove's spring, from the hand out to the glove. */
export function drawSpring(ctx: CanvasRenderingContext2D, length: number, time: number) {
	const coils = 7;
	const path = new Path2D();
	path.moveTo(0, 0);
	for (let i = 1; i <= coils * 2; i++) {
		path.lineTo((length * i) / (coils * 2), i % 2 === 0 ? -5 : 5);
	}
	energy(ctx, path, { time, edge: 1.4, body: 0 });
}

// ------------------------------------------------------ wrecking ball

/**
 * Wrecking Ball: during the windup the ball is hauled back behind John on its
 * chain; then it swings round in a big arc and lands on the spot ahead.
 * `outTime` is how long it stays out after the windup.
 */
export function drawWreckingBall(ctx: CanvasRenderingContext2D, e: Effect, lift: number, time: number, outTime: number) {
	const windup = e.life - outTime;
	const reach = e.value ?? 120;
	const r = (e.radius ?? 60) * 0.55;
	const aim = e.angle ?? 0;
	const hx = e.x;
	const hy = e.y - lift;
	const swinging = e.age >= windup;
	const k = swinging ? easeOut(Math.min(1, (e.age - windup) / 0.14)) : 0;
	const back = swinging ? 0 : Math.min(1, e.age / Math.max(0.05, windup));
	// Hauled back and up behind, then swung through to the impact spot
	const side = Math.cos(aim) >= 0 ? -1 : 1;
	const from = aim + Math.PI + side * 0.6 * back;
	const angle = swinging ? from + (aim - from) * k : aim + Math.PI - side * 0.6 * back;
	const len = reach * (0.55 + 0.45 * (swinging ? k : 0.3));
	const bx = hx + Math.cos(angle) * len;
	const by = hy + Math.sin(angle) * len * 0.8 - (swinging ? Math.sin(k * Math.PI) * 30 : 20 * back);
	ctx.save();
	ctx.globalAlpha = swinging ? Math.max(0, 1 - Math.max(0, e.age - windup - 0.2) / Math.max(0.1, outTime - 0.2)) : 1;

	// The chain, link by link
	const links = 9;
	for (let i = 1; i <= links; i++) {
		const t = i / links;
		const lx = hx + (bx - hx) * t;
		const ly = hy + (by - hy) * t + Math.sin(t * Math.PI) * 10;
		const link = new Path2D();
		link.ellipse(lx, ly, 4, 2.5, Math.atan2(by - hy, bx - hx) + (i % 2 ? 0 : Math.PI / 2), 0, TAU);
		energy(ctx, link, { time, edge: 1.2, body: 0.4 });
	}
	// The ball: a heavy riveted sphere with a band round it
	ctx.save();
	ctx.translate(bx, by);
	const ball = new Path2D();
	ball.arc(0, 0, r, 0, TAU);
	energy(ctx, ball, { time, edge: 2.6, body: 1.4 });
	ctx.strokeStyle = greenCore(0.7);
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.ellipse(0, 0, r, r * 0.3, 0.4, 0, TAU);
	ctx.stroke();
	ctx.fillStyle = CORE;
	for (let i = 0; i < 6; i++) {
		const a = (i / 6) * TAU + 0.4;
		ctx.beginPath();
		ctx.arc(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, 1.8, 0, TAU);
		ctx.fill();
	}
	ctx.restore();

	// Swoosh while it swings, and a shockwave where it lands
	if (swinging && k < 1) {
		ctx.strokeStyle = green(0.28);
		ctx.lineWidth = r * 0.3;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.arc(hx, hy, len, Math.min(from, angle), Math.max(from, angle));
		ctx.stroke();
	}
	if (swinging && e.age - windup < 0.3) {
		const q = (e.age - windup) / 0.3;
		ctx.globalAlpha = 1 - q;
		ctx.strokeStyle = CORE;
		ctx.lineWidth = 4;
		ctx.beginPath();
		ctx.ellipse(bx, by + r * 0.6, r + q * 50, (r + q * 50) * 0.45, 0, 0, TAU);
		ctx.stroke();
	}
	ctx.restore();
}

// --------------------------------------------------------------- anvil

/** A classic anvil, drawn with its base on the origin. */
function anvilPath(s: number): Path2D {
	const p = new Path2D();
	// Face and horn
	p.moveTo(-s * 0.5, -s * 0.78);
	p.lineTo(s * 0.62, -s * 0.78);
	p.lineTo(s * 0.62, -s * 0.6);
	p.lineTo(s * 0.3, -s * 0.52);
	// Waist
	p.lineTo(s * 0.18, -s * 0.3);
	// Base
	p.lineTo(s * 0.42, -s * 0.12);
	p.lineTo(s * 0.46, 0);
	p.lineTo(-s * 0.46, 0);
	p.lineTo(-s * 0.42, -s * 0.12);
	p.lineTo(-s * 0.18, -s * 0.3);
	p.lineTo(-s * 0.3, -s * 0.52);
	// The horn tapers off to the left
	p.lineTo(-s * 0.95, -s * 0.66);
	p.closePath();
	return p;
}

/** Anvil Drop: a shadow and warning ring grow on the spot, then the anvil falls and flattens it. */
export function drawAnvilDrop(ctx: CanvasRenderingContext2D, e: Effect, time: number) {
	const r = e.radius ?? 62;
	const warning = e.life - 0.9;
	const size = r * 1.3;
	ctx.save();
	if (e.age < warning) {
		const k = e.age / warning;
		// Shadow growing as it falls from way up
		ctx.fillStyle = `rgba(0, 0, 0, ${0.15 + 0.25 * k})`;
		ctx.beginPath();
		ctx.ellipse(e.x, e.y, r * (0.3 + 0.7 * k), r * 0.4 * (0.3 + 0.7 * k), 0, 0, TAU);
		ctx.fill();
		ctx.shadowColor = GREEN;
		ctx.shadowBlur = 10;
		ctx.strokeStyle = green(0.5 + 0.5 * Math.sin(time * 20));
		ctx.lineWidth = 2;
		ctx.setLineDash([10, 6]);
		ctx.lineDashOffset = -time * 40;
		ctx.beginPath();
		ctx.ellipse(e.x, e.y, r, r * 0.45, 0, 0, TAU);
		ctx.stroke();
		ctx.setLineDash([]);
		// The anvil itself, high up and coming down
		const fall = 1 - k;
		ctx.save();
		ctx.translate(e.x, e.y - 60 - fall * 420);
		energy(ctx, anvilPath(size), { time, edge: 2.4, body: 1.3, alpha: 0.4 + 0.6 * k });
		ctx.restore();
	} else {
		const t = (e.age - warning) / 0.9;
		ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
		// Landed: sits squashed a moment, then fades
		const squash = t < 0.1 ? 1 - t * 2 : 0.8 + Math.min(0.2, (t - 0.1) * 1.5);
		ctx.save();
		ctx.translate(e.x, e.y);
		ctx.scale(1 + (1 - squash) * 0.6, squash);
		energy(ctx, anvilPath(size), { time, edge: 2.6, body: 1.4 });
		ctx.restore();
		// Impact ring and a puff of dust
		ctx.strokeStyle = CORE;
		ctx.lineWidth = 3;
		ctx.globalAlpha *= Math.max(0, 1 - t * 2.5);
		ctx.beginPath();
		ctx.ellipse(e.x, e.y, r + t * 60, (r + t * 60) * 0.4, 0, 0, TAU);
		ctx.stroke();
		sparks(ctx, e.x, e.y - 10, r, 10, time, e.x * 0.01);
	}
	ctx.restore();
}

// ---------------------------------------------------------- projectiles

/** The Locomotive: a side-on steam engine charging along, wheels spinning, steam behind. */
export function drawTrain(ctx: CanvasRenderingContext2D, pr: Projectile, x: number, y: number, lift: number, time: number) {
	const dir = pr.vx >= 0 ? 1 : -1;
	const s = (pr.def.radius ?? 38) / 38;
	ctx.save();
	ctx.translate(x, y - lift);
	ctx.scale(dir * s, s);

	// Steam puffs streaming back
	for (let i = 0; i < 5; i++) {
		const t = (time * 3 + i / 5) % 1;
		ctx.fillStyle = greenCore(0.35 * (1 - t));
		ctx.beginPath();
		ctx.arc(10 - t * 110, -58 - t * 18, 7 + t * 12, 0, TAU);
		ctx.fill();
	}
	// Speed lines
	ctx.strokeStyle = green(0.35);
	ctx.lineWidth = 2;
	for (const ly of [-40, -22, -4]) {
		ctx.beginPath();
		ctx.moveTo(-70, ly);
		ctx.lineTo(-130 - Math.sin(time * 30 + ly) * 10, ly);
		ctx.stroke();
	}

	const body = new Path2D();
	// Cab at the back
	body.roundRect(-62, -58, 34, 48, 4);
	// Cab roof
	body.rect(-66, -62, 42, 6);
	// Boiler
	body.roundRect(-30, -44, 74, 34, 14);
	// Smokestack
	body.moveTo(20, -44);
	body.lineTo(16, -64);
	body.lineTo(34, -64);
	body.lineTo(30, -44);
	body.closePath();
	// Steam dome
	body.ellipse(-2, -46, 8, 5, 0, Math.PI, TAU);
	// Frame
	body.rect(-64, -12, 118, 7);
	// Cowcatcher up front
	body.moveTo(54, -12);
	body.lineTo(72, 2);
	body.lineTo(48, 2);
	body.closePath();
	energy(ctx, body, { time, edge: 2.4, body: 1.3 });

	// Headlamp
	ctx.save();
	ctx.shadowColor = CORE;
	ctx.shadowBlur = 16;
	ctx.fillStyle = CORE;
	ctx.beginPath();
	ctx.arc(46, -30, 5, 0, TAU);
	ctx.fill();
	ctx.restore();

	// Wheels with spinning spokes, and the rod that drives them
	const spin = time * 18;
	for (const [wx, wr] of [
		[-44, 12],
		[-10, 14],
		[22, 14]
	] as [number, number][]) {
		const wheel = new Path2D();
		wheel.arc(wx, 0, wr, 0, TAU);
		energy(ctx, wheel, { time, edge: 1.8, body: 0.5 });
		ctx.strokeStyle = greenCore(0.7);
		ctx.lineWidth = 1.2;
		for (let i = 0; i < 4; i++) {
			const a = spin + (i * Math.PI) / 4;
			ctx.beginPath();
			ctx.moveTo(wx - Math.cos(a) * wr * 0.8, -Math.sin(a) * wr * 0.8);
			ctx.lineTo(wx + Math.cos(a) * wr * 0.8, Math.sin(a) * wr * 0.8);
			ctx.stroke();
		}
	}
	ctx.strokeStyle = CORE;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(-10 + Math.cos(spin) * 8, Math.sin(spin) * 8);
	ctx.lineTo(22 + Math.cos(spin) * 8, Math.sin(spin) * 8);
	ctx.stroke();
	ctx.restore();
}

/** An I-beam: a steel girder of hard light, flying end-first. */
export function drawGirder(ctx: CanvasRenderingContext2D, pr: Projectile, x: number, y: number, lift: number, time: number) {
	const angle = Math.atan2(pr.vy, pr.vx);
	ctx.save();
	ctx.translate(x, y - lift);
	ctx.rotate(angle);
	// Wake
	const wake = ctx.createLinearGradient(-60, 0, -20, 0);
	wake.addColorStop(0, green(0));
	wake.addColorStop(1, green(0.45));
	ctx.fillStyle = wake;
	ctx.fillRect(-60, -5, 40, 10);
	// Top flange, web, bottom flange
	const beam = new Path2D();
	beam.rect(-22, -7, 46, 3);
	beam.rect(-22, -4, 46, 8);
	beam.rect(-22, 4, 46, 3);
	energy(ctx, beam, { time, edge: 1.4, body: 1.2 });
	// Bolt holes along the web
	ctx.fillStyle = CORE;
	for (let i = 0; i < 4; i++) {
		ctx.beginPath();
		ctx.arc(-15 + i * 11, 0, 1.3, 0, TAU);
		ctx.fill();
	}
	ctx.restore();
}

/**
 * A green grenade, lobbed: it arcs up and comes down where it'll go off,
 * with its shadow on the ground below and a fuse spark.
 */
export function drawGrenade(ctx: CanvasRenderingContext2D, pr: Projectile, x: number, y: number, lift: number, time: number) {
	const total = pr.startLife ?? pr.life;
	const k = total > 0 ? 1 - pr.life / total : 1;
	const arc = Math.sin(Math.min(1, Math.max(0, k)) * Math.PI) * 70;
	ctx.save();
	// Shadow on the ground plane
	ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
	ctx.beginPath();
	ctx.ellipse(x, y, 7, 3, 0, 0, TAU);
	ctx.fill();
	ctx.translate(x, y - lift - arc);
	ctx.rotate(time * 12);
	const body = new Path2D();
	body.arc(0, 0, 7, 0, TAU);
	body.rect(-3, -10, 6, 3);
	energy(ctx, body, { time, edge: 1.4, body: 1.4 });
	ctx.strokeStyle = greenCore(0.7);
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(-7, 0);
	ctx.lineTo(7, 0);
	ctx.stroke();
	// Fuse spark
	ctx.fillStyle = Math.sin(time * 40) > 0 ? CORE : GREEN;
	ctx.beginPath();
	ctx.arc(0, -12, 2, 0, TAU);
	ctx.fill();
	ctx.restore();
}

// ------------------------------------------------------------- Marines

/**
 * One of John's construct Marines: a small soldier in helmet and vest,
 * rifle up and aimed at its target. Side-on like everyone else. In space it
 * floats (no shadow, a slow bob).
 */
export function drawMarine(ctx: CanvasRenderingContext2D, t: Turret, time: number, space: boolean) {
	const fading = t.life < 1.5;
	const alpha = fading ? 0.5 + 0.5 * Math.sin(time * 20) : 1;
	const grow = Math.min(1, (t.maxLife - t.life) / 0.25);
	const facing = Math.cos(t.aim) >= 0 ? 1 : -1;
	const bob = space ? Math.sin(time * 2 + t.follow!.dx) * 3 - 16 : 0;
	const hurt = t.hp < t.maxHp * 0.4;
	ctx.save();
	ctx.globalAlpha = alpha * (hurt ? 0.75 : 1);
	if (!space) {
		ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
		ctx.beginPath();
		ctx.ellipse(t.x, t.y, 13, 4, 0, 0, TAU);
		ctx.fill();
	}
	ctx.translate(t.x, t.y + bob);
	ctx.scale(facing * grow, grow);

	const body = new Path2D();
	// Legs: a wide stance, or striding when it's on the move
	const m = t.march;
	const step = m?.moving ? Math.sin(m.stride) * 4 : 0;
	body.roundRect(-8 + step, -20, 5, 20, 2);
	body.roundRect(2 - step, -20, 5, 20, 2);
	// Torso in a plate carrier
	body.roundRect(-8, -40, 16, 22, 3);
	// Helmet and visor line
	body.ellipse(0, -47, 7, 6.5, 0, 0, TAU);
	body.rect(-8, -47, 16, 2.5);
	energy(ctx, body, { time, edge: 1.4, body: 1.3 });

	// Rifle up at the shoulder, pointed at the target
	ctx.save();
	ctx.translate(2, -34);
	const aimUp = Math.atan2(Math.sin(t.aim), Math.abs(Math.cos(t.aim)));
	ctx.rotate(aimUp);
	const rifle = new Path2D();
	rifle.rect(-6, -2.5, 14, 5); // stock and receiver
	rifle.rect(8, -1.5, 16, 3); // barrel
	rifle.rect(2, 2.5, 3, 5); // magazine
	rifle.rect(4, -5, 6, 2.5); // sight
	energy(ctx, rifle, { time, edge: 1.2, body: 1.2 });
	// Muzzle flash right after a shot
	if (t.cooldown > 0.5) {
		ctx.fillStyle = CORE;
		ctx.shadowColor = GREEN;
		ctx.shadowBlur = 10;
		ctx.beginPath();
		ctx.arc(26, 0, 3.5, 0, TAU);
		ctx.fill();
	}
	ctx.restore();
	ctx.restore();
}

// --------------------------------------------------------- Power Armor

/**
 * John's Power Armor, built over the Lantern figure: a helmet, a chest plate,
 * shoulder pads, and the arm cannon along the ring arm. Drawn from the same
 * skeleton as the figure, so it follows every pose. `k` is 0..1 of time left
 * (it flickers as it runs out).
 */
export function drawArmorSuit(ctx: CanvasRenderingContext2D, x: number, y: number, pose: LanternPose, time: number, scale: number, k: number) {
	const sk = computeSkeleton(pose, time);
	const s = FIGURE_SCALE * scale;
	const flicker = k < 0.2 ? (Math.sin(time * 30) > 0 ? 0.5 : 1) : 1;
	ctx.save();
	ctx.globalAlpha = flicker;
	ctx.translate(x, y);
	ctx.scale(pose.dir * turnScale(pose) * s, s);

	const [nx, ny] = sk.neck;
	const [hx, hy] = sk.hip;
	const [cx, cy] = sk.headCenter;
	const suit = new Path2D();
	// Helmet over the head, with a visor slit
	suit.ellipse(cx, cy, HEAD_R * 1.55, HEAD_R * 1.45, sk.headAngle, 0, TAU);
	// Chest and abdomen plates, following the torso
	const tx = (nx + hx) / 2;
	const ty = (ny + hy) / 2;
	const tall = Math.hypot(nx - hx, ny - hy);
	suit.moveTo(tx, ty);
	const plate = new Path2D();
	plate.roundRect(-8.5, -tall / 2 - 1, 17, tall * 0.62, 3);
	plate.roundRect(-7, tall * 0.14, 14, tall * 0.36, 3);
	const m = new DOMMatrix().translate(tx, ty).rotate(((sk.torsoAngle * 180) / Math.PI) * 1);
	suit.addPath(plate, m);
	// Shoulder pads
	for (const side of [sk.back, sk.front]) {
		const [sx, sy] = side.shoulder;
		suit.ellipse(sx, sy, 5.5, 4, 0, 0, TAU);
	}
	// Thigh and shin guards
	for (const side of [sk.back, sk.front]) {
		const [kx, ky] = side.knee;
		const [fx, fy] = side.foot;
		suit.moveTo(kx, ky);
		suit.addPath(guard(kx, ky, fx, fy, 3.2));
		suit.addPath(guard(side.hipJoint[0], side.hipJoint[1], kx, ky, 3.6));
	}
	energy(ctx, suit, { time, edge: 1.1, body: 1.1, alpha: 0.85 });

	// Visor
	ctx.save();
	ctx.shadowColor = CORE;
	ctx.shadowBlur = 6;
	ctx.strokeStyle = CORE;
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.moveTo(cx - 1, cy - 1);
	ctx.lineTo(cx + HEAD_R * 1.3, cy - 1 + HEAD_R * 0.2);
	ctx.stroke();
	ctx.restore();

	// Arm cannon over the ring arm: a barrel with ribs, past the hand
	const [ex, ey] = sk.front.elbow;
	const [hx2, hy2] = sk.front.hand;
	const a = Math.atan2(hy2 - ey, hx2 - ex);
	ctx.save();
	ctx.translate(ex, ey);
	ctx.rotate(a);
	const len = Math.hypot(hx2 - ex, hy2 - ey);
	const gun = new Path2D();
	gun.roundRect(-2, -4, len + 4, 8, 2);
	gun.rect(len + 2, -3, 9, 6);
	energy(ctx, gun, { time, edge: 1.1, body: 1.3 });
	ctx.strokeStyle = greenCore(0.7);
	ctx.lineWidth = 0.8;
	for (let i = 1; i < 4; i++) {
		ctx.beginPath();
		ctx.moveTo((len * i) / 4, -4);
		ctx.lineTo((len * i) / 4, 4);
		ctx.stroke();
	}
	ctx.restore();
	ctx.restore();
}

/** A plate along a limb, from (x1, y1) to (x2, y2). */
function guard(x1: number, y1: number, x2: number, y2: number, w: number): Path2D {
	const p = new Path2D();
	const len = Math.hypot(x2 - x1, y2 - y1);
	const plate = new Path2D();
	plate.roundRect(0, -w, len, w * 2, w * 0.8);
	p.addPath(plate, new DOMMatrix().translate(x1, y1).rotate((Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI));
	return p;
}

// ------------------------------------------------------- held constructs

/** John's Assault Rifle: stock, receiver, magazine, rail and a long barrel. Along +x from the hand. */
export function riflePath(): Path2D {
	const p = new Path2D();
	p.roundRect(-14, -3, 12, 7, 2); // stock
	p.rect(-2, -5, 20, 9); // receiver
	p.rect(18, -2.5, 20, 4); // barrel
	p.rect(38, -3.5, 4, 6); // muzzle brake
	p.rect(4, 4, 5, 9); // magazine
	p.rect(0, -8, 14, 3); // rail and sight
	return p;
}

/** Industrial Cutter: an arm with a guard, and the spinning blade out at `reach`. */
export function drawCutter(ctx: CanvasRenderingContext2D, reach: number, radius: number, time: number) {
	const arm = new Path2D();
	arm.rect(0, -3, reach - radius * 0.2, 6);
	arm.rect(reach * 0.35, -7, 8, 14);
	energy(ctx, arm, { time, edge: 1.3, body: 1.2 });
	ctx.save();
	ctx.translate(reach, 0);
	// Guard over the top half
	const guardPath = new Path2D();
	guardPath.arc(0, 0, radius + 5, Math.PI * 1.05, Math.PI * 1.95);
	guardPath.arc(0, 0, radius + 1, Math.PI * 1.95, Math.PI * 1.05, true);
	guardPath.closePath();
	energy(ctx, guardPath, { time, edge: 1.4, body: 1.3 });
	// Blade: teeth all round, spinning fast
	ctx.rotate(time * 30);
	const blade = new Path2D();
	const teeth = 16;
	for (let i = 0; i < teeth; i++) {
		const a0 = (i / teeth) * TAU;
		const a1 = ((i + 0.6) / teeth) * TAU;
		const r0 = radius * 0.86;
		if (i === 0) blade.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0);
		blade.lineTo(Math.cos(a1) * radius, Math.sin(a1) * radius);
		blade.lineTo(Math.cos(((i + 1) / teeth) * TAU) * r0, Math.sin(((i + 1) / teeth) * TAU) * r0);
	}
	blade.closePath();
	blade.moveTo(radius * 0.25, 0);
	blade.arc(0, 0, radius * 0.25, 0, TAU);
	energy(ctx, blade, { time, edge: 1.4, body: 0.9 });
	ctx.restore();
	sparks(ctx, reach + radius * 0.6, radius * 0.4, 14, 8, time * 3);
}
