// Drawing for everything the construct system puts in the world.
//
// Constructs are solid light, so they all share one material (see
// `energy()`): a wide soft glow, a see-through green body, a crisp bright
// edge, a pale inner highlight, and a shimmer that sweeps across. Shapes
// are built as Path2D objects in local space, so the same shape can be
// filled, stroked, and clipped without redrawing the path each time.

import { AUTO_TURRET_HEAD, FIST_OUT_TIME, SENTRY_DRONE_HOVER, type AidStation, type Effect, type Projectile, type Shield, type Trap, type Turret } from '../constructs/system';
import { drawRedEffect } from './redConstructs';
import { isStanding, type Dummy } from '../dummy';
import type { Target } from '../targeting';
import { GREEN } from './lantern';
import { uiFont } from './fonts';

const CORE = '#eafff0';
const TAU = Math.PI * 2;

// --------------------------------------------------------------- material

interface EnergyStyle {
	/** Width of the bright edge. */
	edge?: number;
	/** 0..1 how solid the body looks. */
	body?: number;
	/** Overall opacity. */
	alpha?: number;
	time: number;
}

/** Draw a Path2D (already positioned by the caller's transform) as ring energy. */
function energy(ctx: CanvasRenderingContext2D, path: Path2D, { edge = 2, body = 1, alpha = 1, time }: EnergyStyle) {
	ctx.save();
	ctx.globalAlpha *= alpha;
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';

	// 1. Soft outer glow
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 18;
	ctx.strokeStyle = 'rgba(61, 255, 110, 0.35)';
	ctx.lineWidth = edge * 3.5;
	ctx.stroke(path);

	// 2. See-through body
	ctx.shadowBlur = 0;
	ctx.fillStyle = `rgba(61, 255, 110, ${0.2 * body})`;
	ctx.fill(path);

	// 3. Shimmer: a bright diagonal band sliding across, clipped to the shape
	ctx.save();
	ctx.clip(path);
	const sweep = ((time * 90) % 260) - 130;
	const band = ctx.createLinearGradient(sweep - 30, -60, sweep + 30, 60);
	band.addColorStop(0, 'rgba(234, 255, 240, 0)');
	band.addColorStop(0.5, `rgba(234, 255, 240, ${0.28 * body})`);
	band.addColorStop(1, 'rgba(234, 255, 240, 0)');
	ctx.fillStyle = band;
	ctx.fillRect(-400, -400, 800, 800);
	ctx.restore();

	// 4. Crisp edge and a pale inner line
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 8;
	ctx.strokeStyle = GREEN;
	ctx.lineWidth = edge;
	ctx.stroke(path);
	ctx.shadowBlur = 0;
	ctx.strokeStyle = 'rgba(234, 255, 240, 0.55)';
	ctx.lineWidth = edge * 0.4;
	ctx.stroke(path);
	ctx.restore();
}

/** Tiny sparks drifting off a construct. Deterministic from time, so no state needed. */
function sparks(ctx: CanvasRenderingContext2D, x: number, y: number, spread: number, count: number, time: number, seed = 0) {
	ctx.save();
	ctx.fillStyle = CORE;
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 6;
	for (let i = 0; i < count; i++) {
		const phase = (time * 1.4 + i * 0.37 + seed) % 1;
		const a = i * 2.399 + seed * 10; // golden angle spread
		const r = spread * (0.3 + 0.7 * ((i * 0.618) % 1));
		ctx.globalAlpha = (1 - phase) * 0.8;
		const px = x + Math.cos(a) * r;
		const py = y + Math.sin(a) * r * 0.6 - phase * 14;
		ctx.fillRect(px - 1, py - 1, 2, 2);
	}
	ctx.restore();
}

// ----------------------------------------------------------------- shapes
// All drawn pointing along +x from the origin (the hand).

function swordPath(len: number): Path2D {
	const p = new Path2D();
	// Blade: straight edges tapering to a point
	p.moveTo(10, -4);
	p.lineTo(len - 12, -4);
	p.lineTo(len, 0);
	p.lineTo(len - 12, 4);
	p.lineTo(10, 4);
	p.closePath();
	// Crossguard
	p.rect(6, -11, 4, 22);
	// Grip and pommel
	p.rect(-6, -2.5, 12, 5);
	p.moveTo(-6 + 3.5, 0);
	p.arc(-6, 0, 3.5, 0, TAU);
	return p;
}

function fistPath(size: number): Path2D {
	const s = size;
	const p = new Path2D();
	// Wrist cuff
	p.roundRect(-s * 0.55, -s * 0.34, s * 0.3, s * 0.68, s * 0.08);
	// Back of the hand
	p.roundRect(-s * 0.25, -s * 0.46, s * 0.6, s * 0.92, s * 0.18);
	// Four curled fingers, knuckles forward
	for (let i = 0; i < 4; i++) {
		const fy = -s * 0.46 + s * 0.23 * i;
		p.roundRect(s * 0.3, fy, s * 0.32, s * 0.23, s * 0.1);
	}
	// Thumb wrapping across the front
	p.roundRect(s * 0.02, s * 0.18, s * 0.38, s * 0.2, s * 0.1);
	return p;
}

function minigunPath(): Path2D {
	const p = new Path2D();
	p.roundRect(-8, -8, 22, 16, 4); // body
	p.roundRect(-4, 6, 7, 12, 2); // handle
	p.arc(4, -12, 6, 0, TAU); // ammo drum
	p.rect(14, -7, 4, 14); // front collar
	p.rect(40, -7, 3, 14); // muzzle ring
	return p;
}

function cannonPath(): Path2D {
	const p = new Path2D();
	p.arc(-6, 0, 11, 0, TAU); // breech
	// Tapered barrel
	p.moveTo(0, -10);
	p.lineTo(34, -7);
	p.lineTo(34, 7);
	p.lineTo(0, 10);
	p.closePath();
	// Bands and flared muzzle
	p.rect(12, -10, 3, 20);
	p.rect(24, -9, 3, 18);
	p.moveTo(34, -7);
	p.lineTo(42, -12);
	p.lineTo(42, 12);
	p.lineTo(34, 7);
	p.closePath();
	return p;
}

/** A pump shotgun: stock, receiver, two barrels side by side. */
function shotgunPath(): Path2D {
	const p = new Path2D();
	p.moveTo(-10, -3);
	p.lineTo(-2, -5);
	p.lineTo(-2, 5);
	p.lineTo(-12, 7);
	p.closePath();
	p.roundRect(-2, -6, 14, 11, 2);
	p.rect(12, -5, 24, 4);
	p.rect(12, 0, 24, 4);
	p.roundRect(16, 4, 10, 4, 1.5); // pump
	return p;
}

/** A rocket pod on the forearm: a box with four tube mouths. */
function rocketPodPath(): Path2D {
	const p = new Path2D();
	p.roundRect(-4, -11, 26, 22, 4);
	for (const [y1, y2] of [[-9, -2], [2, 9]]) {
		p.rect(22, y1, 6, y2 - y1);
	}
	for (const y of [-6, 5]) {
		p.moveTo(28 + 2.5, y);
		p.arc(28, y, 2.5, 0, TAU);
	}
	return p;
}

/** A spinning circular saw blade. */
function sawPath(r: number): Path2D {
	const p = new Path2D();
	const teeth = 10;
	for (let i = 0; i < teeth * 2; i++) {
		const a = (i / (teeth * 2)) * TAU;
		const rr = i % 2 === 0 ? r : r * 0.72;
		if (i === 0) p.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
		else p.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
	}
	p.closePath();
	p.moveTo(r * 0.3, 0);
	p.arc(0, 0, r * 0.3, 0, TAU);
	return p;
}

function hookPath(): Path2D {
	const p = new Path2D();
	p.moveTo(-8, 0);
	p.lineTo(4, 0);
	// Three claws
	for (const side of [-1, 0, 1]) {
		p.moveTo(4, 0);
		p.quadraticCurveTo(11, side * 6, 8 + (side === 0 ? 6 : 0), side * 11 || 0);
	}
	return p;
}

// ------------------------------------------------------------ in the hand

/** A construct held at the ring: the minigun while it fires, the cannon right after a shot. */
export function drawHeldConstruct(
	ctx: CanvasRenderingContext2D,
	shape: string,
	x: number,
	y: number,
	aimX: number,
	aimY: number,
	time: number
) {
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(Math.atan2(aimY, aimX));
	// Keep guns upright when aiming left
	if (aimX < 0) ctx.scale(1, -1);

	if (shape === 'minigun') {
		energy(ctx, minigunPath(), { time, edge: 1.6 });
		// Six barrels spinning: draw the three facing us, offset by spin
		const spin = time * 30;
		ctx.save();
		ctx.shadowColor = GREEN;
		ctx.shadowBlur = 8;
		for (let i = 0; i < 6; i++) {
			const a = spin + (i * TAU) / 6;
			const depth = Math.cos(a);
			if (depth < -0.2) continue;
			ctx.globalAlpha = 0.45 + 0.55 * depth;
			ctx.strokeStyle = depth > 0.6 ? CORE : GREEN;
			ctx.lineWidth = 2;
			const off = Math.sin(a) * 5;
			ctx.beginPath();
			ctx.moveTo(18, off);
			ctx.lineTo(41, off);
			ctx.stroke();
		}
		ctx.restore();
		// Muzzle flash flickers on alternate frames
		if (Math.sin(time * 70) > 0) muzzleFlash(ctx, 45, 0, 7);
	} else if (shape === 'cannon') {
		// Kicks back right after firing
		const recoil = Math.max(0, Math.sin(time * 20)) * 3;
		ctx.translate(-recoil, 0);
		energy(ctx, cannonPath(), { time, edge: 2 });
		sparks(ctx, 42, 0, 10, 5, time);
	} else if (shape === 'sniper') {
		energy(ctx, sniperPath(), { time, edge: 1.5 });
	} else if (shape === 'shotgun') {
		energy(ctx, shotgunPath(), { time, edge: 1.5 });
		if (Math.sin(time * 40) > 0.3) muzzleFlash(ctx, 38, 1, 9);
	} else if (shape === 'rockets') {
		energy(ctx, rocketPodPath(), { time, edge: 1.6 });
		sparks(ctx, 30, 0, 8, 4, time);
	}
	ctx.restore();
}

/** A long rifle: stock at the hand, a scope on top, a long barrel with a muzzle brake. */
function sniperPath(): Path2D {
	const p = new Path2D();
	p.moveTo(-14, -3); // stock
	p.lineTo(-4, -4);
	p.lineTo(-2, 4);
	p.lineTo(-12, 6);
	p.closePath();
	p.roundRect(-4, -4, 26, 7, 2); // body
	p.roundRect(2, -10, 14, 4, 2); // scope
	p.rect(6, -6, 2, 2);
	p.rect(22, -1.8, 36, 3.6); // barrel
	p.rect(56, -3.5, 6, 7); // muzzle brake
	p.moveTo(10, 3); // grip
	p.lineTo(14, 3);
	p.lineTo(11, 10);
	p.lineTo(8, 9);
	p.closePath();
	return p;
}

/**
 * The laser sight while the Sniper Rifle charges: a thin line from the ring
 * to where the shot would stop, brighter and steadier as the charge builds.
 */
export function drawLaserSight(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	dx: number,
	dy: number,
	length: number,
	charge: number,
	time: number
) {
	const ex = x + dx * length;
	const ey = y + dy * length;
	ctx.save();
	ctx.lineCap = 'round';
	const full = charge >= 1;
	const flicker = full ? 1 : 0.6 + 0.4 * Math.sin(time * 30);
	ctx.strokeStyle = `rgba(61, 255, 110, ${(0.15 + 0.5 * charge) * flicker})`;
	ctx.lineWidth = 1 + charge * 1.5;
	ctx.setLineDash(full ? [] : [8, 6]);
	ctx.lineDashOffset = -time * 60;
	ctx.beginPath();
	ctx.moveTo(x, y);
	ctx.lineTo(ex, ey);
	ctx.stroke();
	ctx.setLineDash([]);
	// Aim point
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = full ? 14 : 6;
	ctx.fillStyle = full ? CORE : GREEN;
	ctx.beginPath();
	ctx.arc(ex, ey, 2.5 + charge * 2, 0, TAU);
	ctx.fill();
	// Charge ring around the ring hand: fills clockwise, pulses when full
	ctx.strokeStyle = full ? CORE : GREEN;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(x, y, 9 + (full ? Math.sin(time * 12) : 0), -Math.PI / 2, -Math.PI / 2 + TAU * charge);
	ctx.stroke();
	ctx.restore();
}

/** An Auto-Turret construct: tripod legs, a body, and twin barrels that track targets. In space, a Sentry Drone. */
export function drawAutoTurret(ctx: CanvasRenderingContext2D, t: Turret, time: number, space = false) {
	if (space) return drawSentryDrone(ctx, t, time);
	const fading = t.life < 1.5;
	const alpha = fading ? 0.5 + 0.5 * Math.sin(time * 20) : 1;
	const grow = Math.min(1, (t.maxLife - t.life) / 0.25);
	ctx.save();
	ctx.globalAlpha = alpha;
	ctx.translate(t.x, t.y);

	// Glow on the ground
	ctx.fillStyle = 'rgba(61, 255, 110, 0.15)';
	ctx.beginPath();
	ctx.ellipse(0, 0, 18, 6, 0, 0, TAU);
	ctx.fill();

	ctx.scale(grow, grow);
	// Tripod
	const legs = new Path2D();
	legs.moveTo(-12, 2);
	legs.lineTo(0, -AUTO_TURRET_HEAD + 6);
	legs.lineTo(12, 2);
	legs.moveTo(0, -AUTO_TURRET_HEAD + 6);
	legs.lineTo(3, 4);
	energy(ctx, legs, { time, edge: 1.6, body: 0 });

	// Head, turned toward its target. Flipped when aiming left so it never looks upside down.
	ctx.translate(0, -AUTO_TURRET_HEAD);
	ctx.rotate(t.aim);
	if (Math.cos(t.aim) < 0) ctx.scale(1, -1);
	const head = new Path2D();
	head.roundRect(-9, -7, 16, 14, 4);
	head.rect(7, -5, 14, 3);
	head.rect(7, 2, 14, 3);
	head.rect(-5, -10, 8, 3);
	energy(ctx, head, { time, edge: 1.6 });
	// Muzzle flash right after a shot
	if (t.cooldown > 0.25) {
		ctx.shadowColor = GREEN;
		ctx.shadowBlur = 12;
		ctx.fillStyle = CORE;
		ctx.beginPath();
		ctx.arc(23, -3.5, 3, 0, TAU);
		ctx.arc(23, 3.5, 3, 0, TAU);
		ctx.fill();
	}
	ctx.restore();

	// Time left, as a small arc under it
	ctx.save();
	ctx.globalAlpha = alpha;
	ctx.strokeStyle = 'rgba(234, 255, 240, 0.6)';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.ellipse(t.x, t.y, 20, 7, 0, Math.PI * 0.15, Math.PI * 0.15 + Math.PI * 0.7 * (t.life / t.maxLife));
	ctx.stroke();
	ctx.restore();
}

function muzzleFlash(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
	ctx.save();
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 16;
	ctx.fillStyle = CORE;
	ctx.beginPath();
	for (let i = 0; i < 8; i++) {
		const a = (i / 8) * TAU;
		const rr = i % 2 === 0 ? r : r * 0.4;
		ctx.lineTo(x + Math.cos(a) * rr * (i === 0 ? 1.6 : 1), y + Math.sin(a) * rr);
	}
	ctx.closePath();
	ctx.fill();
	ctx.restore();
}

// ------------------------------------------------------------ projectiles

/** Projectiles live on the ground plane; `lift` raises them to hand height for drawing. */
export function drawProjectile(ctx: CanvasRenderingContext2D, pr: Projectile, x: number, y: number, lift: number, time: number) {
	const dy = y - lift;
	const speed = Math.hypot(pr.vx, pr.vy) || 1;
	const ux = pr.vx / speed;
	const uy = pr.vy / speed;
	ctx.save();
	ctx.lineCap = 'round';

	if (pr.kind === 'bolt') {
		// Ring shot: a bright capsule of energy with a short glowing wake
		const angle = Math.atan2(uy, ux);
		ctx.translate(x, dy);
		ctx.rotate(angle);
		const wake = ctx.createLinearGradient(-26, 0, 0, 0);
		wake.addColorStop(0, 'rgba(61, 255, 110, 0)');
		wake.addColorStop(1, 'rgba(61, 255, 110, 0.55)');
		ctx.fillStyle = wake;
		ctx.beginPath();
		ctx.moveTo(-26, 0);
		ctx.lineTo(0, -4);
		ctx.lineTo(0, 4);
		ctx.closePath();
		ctx.fill();
		ctx.shadowColor = GREEN;
		ctx.shadowBlur = 14;
		ctx.fillStyle = GREEN;
		ctx.beginPath();
		ctx.ellipse(0, 0, 9, 3.6, 0, 0, TAU);
		ctx.fill();
		ctx.fillStyle = CORE;
		ctx.beginPath();
		ctx.ellipse(1, 0, 5, 1.8, 0, 0, TAU);
		ctx.fill();
	} else if (pr.kind === 'bullet') {
		// Tracer: fading tail, hot head
		const tail = ctx.createLinearGradient(x - ux * 22, dy - uy * 22, x, dy);
		tail.addColorStop(0, 'rgba(61, 255, 110, 0)');
		tail.addColorStop(1, 'rgba(61, 255, 110, 0.9)');
		ctx.strokeStyle = tail;
		ctx.lineWidth = 4;
		ctx.beginPath();
		ctx.moveTo(x - ux * 22, dy - uy * 22);
		ctx.lineTo(x, dy);
		ctx.stroke();
		ctx.shadowColor = GREEN;
		ctx.shadowBlur = 10;
		ctx.fillStyle = CORE;
		ctx.beginPath();
		ctx.arc(x, dy, 2.2, 0, TAU);
		ctx.fill();
	} else if (pr.kind === 'missile') {
		// A small energy rocket with a flickering exhaust
		ctx.translate(x, dy);
		ctx.rotate(Math.atan2(uy, ux));
		const exhaust = ctx.createLinearGradient(-22, 0, -6, 0);
		exhaust.addColorStop(0, 'rgba(61, 255, 110, 0)');
		exhaust.addColorStop(1, CORE);
		ctx.fillStyle = exhaust;
		ctx.beginPath();
		ctx.moveTo(-6, -2.5);
		ctx.lineTo(-20 - Math.sin(time * 70) * 3, 0);
		ctx.lineTo(-6, 2.5);
		ctx.closePath();
		ctx.fill();
		const body = new Path2D();
		body.moveTo(10, 0);
		body.lineTo(4, -3);
		body.lineTo(-6, -3);
		body.lineTo(-9, -6);
		body.lineTo(-9, 6);
		body.lineTo(-6, 3);
		body.lineTo(4, 3);
		body.closePath();
		energy(ctx, body, { time, edge: 1.4 });
	} else if (pr.kind === 'shell') {
		// Energy orb with a swirling core and a trail of sparks
		for (let i = 1; i <= 4; i++) {
			ctx.globalAlpha = 0.35 * (1 - i / 5);
			ctx.fillStyle = GREEN;
			ctx.beginPath();
			ctx.arc(x - ux * i * 9, dy - uy * i * 9, 9 - i * 1.5, 0, TAU);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
		const orb = ctx.createRadialGradient(x, dy, 1, x, dy, 12);
		orb.addColorStop(0, CORE);
		orb.addColorStop(0.45, 'rgba(61, 255, 110, 0.9)');
		orb.addColorStop(1, 'rgba(61, 255, 110, 0)');
		ctx.fillStyle = orb;
		ctx.beginPath();
		ctx.arc(x, dy, 12, 0, TAU);
		ctx.fill();
		ctx.strokeStyle = CORE;
		ctx.lineWidth = 1.5;
		for (let i = 0; i < 2; i++) {
			ctx.beginPath();
			ctx.arc(x, dy, 6, time * 12 + i * Math.PI, time * 12 + i * Math.PI + 1.6);
			ctx.stroke();
		}
	} else if (pr.kind === 'saw') {
		// Buzzsaw: spinning fast, a faint ghost trail behind it
		ctx.translate(x, dy);
		ctx.globalAlpha = 0.3;
		ctx.fillStyle = GREEN;
		ctx.beginPath();
		ctx.arc(-ux * 10, -uy * 10, 10, 0, TAU);
		ctx.fill();
		ctx.globalAlpha = 1;
		ctx.rotate(time * 25);
		energy(ctx, sawPath(pr.def.radius ?? 14), { time, edge: 1.6 });
	} else {
		ctx.translate(x, dy);
		ctx.rotate(Math.atan2(uy, ux));
		energy(ctx, hookPath(), { time, edge: 2.2, body: 0 });
	}
	ctx.restore();
}

/** A chain of glowing links between two points, sagging slightly. */
export function drawChain(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, time: number) {
	const len = Math.hypot(x2 - x1, y2 - y1);
	const angle = Math.atan2(y2 - y1, x2 - x1);
	const links = Math.max(2, Math.floor(len / 8));
	const sag = Math.min(12, len * 0.04);

	ctx.save();
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 8;
	for (let i = 0; i < links; i++) {
		const t = (i + 0.5) / links;
		const bow = Math.sin(t * Math.PI) * sag;
		const lx = x1 + (x2 - x1) * t;
		const ly = y1 + (y2 - y1) * t + bow;
		ctx.save();
		ctx.translate(lx, ly);
		ctx.rotate(angle);
		ctx.lineWidth = 2;
		// Each link glints as a pulse travels down the chain
		const glint = 0.5 + 0.5 * Math.sin(time * 14 - i * 0.8);
		ctx.strokeStyle = glint > 0.85 ? CORE : GREEN;
		ctx.beginPath();
		if (i % 2 === 0) {
			ctx.ellipse(0, 0, 5.5, 3.2, 0, 0, TAU);
		} else {
			ctx.moveTo(-5, 0);
			ctx.lineTo(5, 0);
		}
		ctx.stroke();
		ctx.restore();
	}
	ctx.restore();
}

// ------------------------------------------------------------------ traps

/** An armed cage trap: a slowly turning rune circle with bars waiting to spring. */
export function drawTrap(ctx: CanvasRenderingContext2D, t: Trap, time: number) {
	if (t.kind === 'mine') {
		drawMine(ctx, t, time);
		return;
	}
	const pulse = 0.6 + 0.4 * Math.sin(time * 4);
	const r = t.radius;
	ctx.save();
	ctx.translate(t.x, t.y);
	ctx.scale(1, 0.45); // lie flat on the ground
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 10;
	ctx.strokeStyle = `rgba(61, 255, 110, ${0.5 + 0.4 * pulse})`;

	ctx.lineWidth = 2.5;
	ctx.beginPath();
	ctx.arc(0, 0, r, 0, TAU);
	ctx.stroke();
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.arc(0, 0, r * 0.72, 0, TAU);
	ctx.stroke();

	// Turning tick marks between the rings
	ctx.save();
	ctx.rotate(time * 0.8);
	for (let i = 0; i < 16; i++) {
		const a = (i / 16) * TAU;
		ctx.beginPath();
		ctx.moveTo(Math.cos(a) * r * 0.76, Math.sin(a) * r * 0.76);
		ctx.lineTo(Math.cos(a) * r * (i % 4 === 0 ? 0.98 : 0.88), Math.sin(a) * r * (i % 4 === 0 ? 0.98 : 0.88));
		ctx.stroke();
	}
	ctx.restore();

	// Four diamonds in the middle, turning the other way
	ctx.rotate(-time * 1.2);
	ctx.fillStyle = `rgba(234, 255, 240, ${0.4 + 0.4 * pulse})`;
	for (let i = 0; i < 4; i++) {
		const a = (i / 4) * TAU;
		ctx.save();
		ctx.translate(Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35);
		ctx.rotate(a);
		ctx.beginPath();
		ctx.moveTo(-4, 0);
		ctx.lineTo(0, -3);
		ctx.lineTo(4, 0);
		ctx.lineTo(0, 3);
		ctx.closePath();
		ctx.fill();
		ctx.restore();
	}
	ctx.restore();

	// Bar tips poking up around the edge (drawn un-flattened so they stand up)
	ctx.save();
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 6;
	ctx.strokeStyle = GREEN;
	ctx.lineWidth = 2;
	for (let i = 0; i < 10; i++) {
		const a = (i / 10) * TAU;
		const bx = t.x + Math.cos(a) * r;
		const by = t.y + Math.sin(a) * r * 0.45;
		ctx.beginPath();
		ctx.moveTo(bx, by);
		ctx.lineTo(bx, by - 6 - 5 * pulse);
		ctx.stroke();
	}
	ctx.restore();
}

/** A mine: a flat green disc with a blinking light, and a faint trigger ring. */
function drawMine(ctx: CanvasRenderingContext2D, t: Trap, time: number) {
	const blink = Math.sin(time * 6 + t.x) > 0.6;
	ctx.save();
	ctx.translate(t.x, t.y);
	ctx.scale(1, 0.45);
	ctx.strokeStyle = 'rgba(61, 255, 110, 0.18)';
	ctx.setLineDash([4, 5]);
	ctx.lineDashOffset = -time * 10;
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.arc(0, 0, t.radius, 0, TAU);
	ctx.stroke();
	ctx.setLineDash([]);
	const disc = new Path2D();
	disc.arc(0, 0, 11, 0, TAU);
	disc.moveTo(6, 0);
	disc.arc(0, 0, 6, 0, TAU);
	energy(ctx, disc, { time, edge: 1.6 });
	ctx.restore();
	ctx.save();
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = blink ? 12 : 3;
	ctx.fillStyle = blink ? CORE : GREEN;
	ctx.beginPath();
	ctx.arc(t.x, t.y - 3, blink ? 2.4 : 1.6, 0, TAU);
	ctx.fill();
	ctx.restore();
}

/**
 * John's Aid Station: a healing circle on the ground with a beacon in the
 * middle, green crosses rising from it. In space it's a floating Med Beacon.
 */
export function drawAidStation(ctx: CanvasRenderingContext2D, a: AidStation, time: number, space: boolean) {
	const fade = Math.min(1, a.life / 0.6) * Math.min(1, (a.maxLife - a.life) / 0.25 + 0.2);
	const pulse = 0.5 + 0.5 * Math.sin(time * 3);
	ctx.save();
	ctx.globalAlpha = fade;
	// The healing area
	ctx.save();
	ctx.translate(a.x, a.y);
	ctx.scale(1, 0.5);
	const g = ctx.createRadialGradient(0, 0, 4, 0, 0, a.radius);
	g.addColorStop(0, 'rgba(61, 255, 110, 0.18)');
	g.addColorStop(1, 'rgba(61, 255, 110, 0.04)');
	ctx.fillStyle = g;
	ctx.beginPath();
	ctx.arc(0, 0, a.radius, 0, TAU);
	ctx.fill();
	ctx.strokeStyle = `rgba(61, 255, 110, ${0.4 + 0.3 * pulse})`;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(0, 0, a.radius, 0, TAU);
	ctx.stroke();
	// A ring of light washing outward
	const k = (time * 0.7) % 1;
	ctx.globalAlpha = fade * (1 - k) * 0.6;
	ctx.beginPath();
	ctx.arc(0, 0, a.radius * k, 0, TAU);
	ctx.stroke();
	ctx.restore();

	// The beacon: a post (a floating capsule in space) topped with a glowing cross
	const top = space ? 44 + Math.sin(time * 2) * 3 : 46;
	const beacon = new Path2D();
	if (!space) beacon.rect(-2, -top + 10, 4, top - 10);
	else beacon.roundRect(-6, -top + 6, 12, 16, 5);
	ctx.save();
	ctx.translate(a.x, a.y);
	energy(ctx, beacon, { time, edge: 1.4 });
	const cross = new Path2D();
	cross.rect(-3, -top - 8, 6, 18);
	cross.rect(-9, -top - 2, 18, 6);
	energy(ctx, cross, { time, edge: 1.6, body: 1.5 });
	// Crosses drifting up
	ctx.fillStyle = CORE;
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 6;
	for (let i = 0; i < 5; i++) {
		const t = (time * 0.6 + i / 5) % 1;
		const px = Math.cos(i * 2.4) * a.radius * 0.6;
		const py = Math.sin(i * 2.4) * a.radius * 0.3 - t * 40;
		ctx.globalAlpha = fade * (1 - t) * 0.8;
		ctx.fillRect(px - 1, py - 4, 2, 8);
		ctx.fillRect(px - 4, py - 1, 8, 2);
	}
	ctx.restore();
	ctx.restore();
}

/** A full cage around something that's been caught. (x, y) is its base. */
function drawCage(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
	const w = 24;
	const h = 60;
	ctx.save();
	ctx.translate(x, y);

	// Built as one path: bottom and top rings (ellipses) plus bars
	const cage = new Path2D();
	cage.ellipse(0, 0, w, w * 0.4, 0, 0, TAU);
	cage.ellipse(0, -h, w, w * 0.4, 0, 0, TAU);
	for (let i = 0; i < 8; i++) {
		const a = (i / 8) * TAU;
		const bx = Math.cos(a) * w;
		const by = Math.sin(a) * w * 0.4;
		cage.moveTo(bx, by);
		cage.lineTo(bx, by - h);
	}
	// Dome cap
	cage.moveTo(-w, -h);
	cage.quadraticCurveTo(0, -h - 26, w, -h);

	energy(ctx, cage, { time, edge: 2, body: 0 });
	sparks(ctx, 0, -h / 2, w, 6, time, x * 0.01);
	ctx.restore();
}

// ---------------------------------------------------------------- shields

/** A bubble shield around a Lantern. (x, y) is their anchor; `lift` raises it to their body. */
export function drawShield(
	ctx: CanvasRenderingContext2D,
	s: Shield,
	x: number,
	y: number,
	lift: number,
	/** How tall the character is, so the bubble fits around them. */
	bodyHeight: number,
	time: number,
	reduceFlashing = false
) {
	// Centred on the body, big enough to hold the whole figure with room to spare
	const cx = x;
	const cy = y - lift - bodyHeight * 0.5;
	const hitRipple = s.ripple / 0.3;
	const r = bodyHeight * 0.66 + hitRipple * 4 + Math.sin(time * 3) * 1;
	const health = s.hp / s.maxHp;
	// Blink in the last two seconds so you know it's about to go (a gentle fade instead, with reduced flashing)
	const blink = s.life < 2 ? (reduceFlashing ? 0.55 + 0.45 * (s.life / 2) : Math.sin(time * 18) > 0 ? 0.45 : 1) : 1;

	ctx.save();
	ctx.globalAlpha = blink;

	// Sphere body: clear in the middle, greener at the rim
	const body = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
	body.addColorStop(0, 'rgba(234, 255, 240, 0.10)');
	body.addColorStop(0.7, `rgba(61, 255, 110, ${0.08 + 0.06 * health})`);
	body.addColorStop(1, `rgba(61, 255, 110, ${0.3 + 0.25 * health + hitRipple * 0.3})`);
	ctx.fillStyle = body;
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, TAU);
	ctx.fill();

	// Hex lattice across the surface, slowly drifting
	ctx.save();
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, TAU);
	ctx.clip();
	ctx.strokeStyle = `rgba(234, 255, 240, ${0.12 + 0.1 * health})`;
	ctx.lineWidth = 1;
	const hex = 10;
	const drift = (time * 6) % (hex * 3);
	for (let row = -6; row <= 6; row++) {
		for (let col = -6; col <= 6; col++) {
			const hx = cx + col * hex * 1.5 + drift - hex * 1.5;
			const hy = cy + row * hex * 1.732 + (col % 2 ? hex * 0.866 : 0);
			ctx.beginPath();
			for (let k = 0; k < 6; k++) {
				const a = (k / 6) * TAU;
				ctx.lineTo(hx + Math.cos(a) * hex * 0.55, hy + Math.sin(a) * hex * 0.55);
			}
			ctx.closePath();
			ctx.stroke();
		}
	}
	ctx.restore();

	// Rim
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 16;
	ctx.strokeStyle = GREEN;
	ctx.lineWidth = 2 + hitRipple * 2;
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, TAU);
	ctx.stroke();

	// Highlight glint turning around the top-left
	ctx.shadowBlur = 0;
	ctx.strokeStyle = 'rgba(234, 255, 240, 0.7)';
	ctx.lineWidth = 2.5;
	const g = -2.3 + Math.sin(time * 0.8) * 0.3;
	ctx.beginPath();
	ctx.arc(cx, cy, r * 0.82, g, g + 0.7);
	ctx.stroke();

	// Remaining time as a thin arc under the bubble
	ctx.strokeStyle = 'rgba(61, 255, 110, 0.6)';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(cx, cy, r + 5, Math.PI * 0.25, Math.PI * 0.25 + Math.PI * 0.5 * (s.life / s.maxLife));
	ctx.stroke();
	ctx.restore();
}

// ---------------------------------------------------------------- reticles

/**
 * Marks what a Lantern is targeting. Locked attack targets get a tight
 * rotating reticle; automatic picks get a faint ring; a locked ally gets a
 * protective double ring.
 */
export function drawReticle(ctx: CanvasRenderingContext2D, t: Target, x: number, y: number, locked: boolean, time: number) {
	ctx.save();
	ctx.translate(x, y);
	ctx.shadowColor = GREEN;

	if (t.kind === 'ally') {
		ctx.shadowBlur = 10;
		ctx.strokeStyle = GREEN;
		ctx.lineWidth = 2;
		ctx.setLineDash([6, 4]);
		ctx.lineDashOffset = -time * 20;
		ctx.beginPath();
		ctx.ellipse(0, 0, 26, 10, 0, 0, TAU);
		ctx.stroke();
		ctx.setLineDash([]);
		ctx.strokeStyle = 'rgba(234, 255, 240, 0.6)';
		ctx.beginPath();
		ctx.ellipse(0, 0, 32, 13, 0, 0, TAU);
		ctx.stroke();
		ctx.restore();
		return;
	}

	// Attack targets: bracket reticle on the ground, raised to the body
	const cy = t.kind === 'enemy' ? -34 : -18;
	ctx.translate(0, cy);

	if (!locked) {
		ctx.globalAlpha = 0.45;
		ctx.strokeStyle = GREEN;
		ctx.lineWidth = 1.2;
		ctx.setLineDash([3, 5]);
		ctx.lineDashOffset = time * 12;
		ctx.beginPath();
		ctx.arc(0, 0, 24, 0, TAU);
		ctx.stroke();
		ctx.restore();
		return;
	}

	const pulse = 1 + Math.sin(time * 6) * 0.06;
	ctx.scale(pulse, pulse);
	ctx.rotate(time * 1.5);
	ctx.shadowBlur = 12;
	ctx.strokeStyle = GREEN;
	ctx.lineWidth = 2.5;
	for (let i = 0; i < 4; i++) {
		ctx.save();
		ctx.rotate((i * Math.PI) / 2);
		ctx.beginPath();
		ctx.moveTo(22, 10);
		ctx.lineTo(22, 22);
		ctx.lineTo(10, 22);
		ctx.stroke();
		ctx.restore();
	}
	ctx.rotate(-time * 3);
	ctx.strokeStyle = CORE;
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.arc(0, 0, 5, 0, TAU);
	ctx.stroke();
	ctx.restore();
}

// ---------------------------------------------------------------- dummies

/** A training dummy: a post with a bullseye. In space it floats instead. */
export function drawDummy(
	ctx: CanvasRenderingContext2D,
	d: Dummy,
	x: number,
	y: number,
	onGround: boolean,
	time: number,
	reduceFlashing = false
) {
	ctx.save();
	if (!isStanding(d)) {
		// Knocked down: a stump and a ring counting down to respawn
		ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
		ctx.beginPath();
		ctx.ellipse(x, y, 12, 4, 0, 0, TAU);
		ctx.fill();
		ctx.fillStyle = '#6b4a2a';
		ctx.fillRect(x - 3, y - 8, 6, 8);
		ctx.strokeStyle = 'rgba(216, 245, 224, 0.4)';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(x, y - 30, 8, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - d.down / 3));
		ctx.stroke();
		ctx.restore();
		return;
	}

	const bob = onGround ? 0 : Math.sin(time * 2 + d.homeX) * 3 - 8;
	if (onGround) {
		ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
		ctx.beginPath();
		ctx.ellipse(x, y, 13, 4, 0, 0, TAU);
		ctx.fill();
		ctx.fillStyle = '#6b4a2a';
		ctx.fillRect(x - 3, y - 24, 6, 24);
	}

	const cy = y - 38 + bob;
	const flash = d.flash > 0 && !reduceFlashing;
	ctx.fillStyle = flash ? '#ffffff' : '#c9a55a';
	ctx.beginPath();
	ctx.ellipse(x, cy, 12, 16, 0, 0, TAU);
	ctx.fill();
	const rings = flash ? ['#ffffff', '#ffffff', '#ffffff'] : ['#d23a3a', '#f3efe2', '#d23a3a'];
	[9, 6, 3].forEach((r, i) => {
		ctx.fillStyle = rings[i];
		ctx.beginPath();
		ctx.arc(x, cy, r, 0, TAU);
		ctx.fill();
	});
	ctx.fillStyle = flash ? '#ffffff' : '#b8934a';
	ctx.beginPath();
	ctx.arc(x, cy - 22, 7, 0, TAU);
	ctx.fill();

	if (d.hp < d.maxHp) {
		ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
		ctx.fillRect(x - 16, cy - 38, 32, 4);
		ctx.fillStyle = '#e8c86a';
		ctx.fillRect(x - 16, cy - 38, 32 * (d.hp / d.maxHp), 4);
	}
	ctx.restore();

	if (d.caged > 0) drawCage(ctx, x, y + (onGround ? 0 : bob), time);
	if (d.stun > 0) drawDizzy(ctx, x, y - 70 + bob, time);
}

// ---------------------------------------------------------------- effects

/**
 * One-off visuals. `lift` raises effects tied to a Lantern (slashes,
 * punches) to their hand height.
 */
export function drawEffect(ctx: CanvasRenderingContext2D, e: Effect, lift: number, time: number, space = false) {
	const t = e.age / e.life; // 0..1
	ctx.save();

	switch (e.kind) {
		case 'slash': {
			// The sword sweeps across the aim, leaving a crescent trail and afterimages
			const reach = e.radius ?? 75;
			const aim = e.angle ?? 0;
			const swing = easeOut(Math.min(1, t / 0.55));
			const start = aim - 1.1;
			const current = start + swing * 2.2;
			const hy = e.y - lift;

			// Crescent trail
			ctx.globalAlpha = 1 - t;
			ctx.shadowColor = GREEN;
			ctx.shadowBlur = 16;
			const trail = new Path2D();
			trail.arc(e.x, hy, reach, start, current);
			trail.arc(e.x, hy, reach * 0.55, current, start, true);
			trail.closePath();
			ctx.fillStyle = 'rgba(61, 255, 110, 0.28)';
			ctx.fill(trail);
			ctx.strokeStyle = 'rgba(234, 255, 240, 0.6)';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.arc(e.x, hy, reach, start, current);
			ctx.stroke();

			// Afterimages then the blade
			for (let i = 3; i >= 0; i--) {
				const a = current - i * 0.22 * (1 - t);
				ctx.save();
				ctx.translate(e.x, hy);
				ctx.rotate(a);
				energy(ctx, swordPath(reach), { time, edge: 1.8, alpha: i === 0 ? 1 - t * 0.6 : 0.18 * (1 - t) });
				ctx.restore();
			}
			break;
		}
		case 'fist': {
			// Wind up close, punch out with speed lines, flash on impact, fade
			const windup = e.life - FIST_OUT_TIME;
			const size = e.radius ?? 42;
			const hy = e.y - lift;
			const punching = e.age >= windup;
			const out = punching ? easeOut(Math.min(1, (e.age - windup) / 0.1)) : 0;
			const fade = punching ? 1 - Math.max(0, (e.age - windup - 0.12) / (FIST_OUT_TIME - 0.12)) : 1;
			const shake = punching ? 0 : Math.sin(e.age * 80) * 1.5;
			const reach = 16 + out * 62;

			ctx.translate(e.x, hy);
			ctx.rotate(e.angle ?? 0);
			ctx.globalAlpha = Math.max(0, fade);

			if (punching) {
				ctx.strokeStyle = 'rgba(234, 255, 240, 0.6)';
				ctx.lineWidth = 2;
				for (let i = -2; i <= 2; i++) {
					ctx.beginPath();
					ctx.moveTo(reach - size * 0.6 - 26 - Math.abs(i) * 6, i * size * 0.18);
					ctx.lineTo(reach - size * 0.6 - 6, i * size * 0.18);
					ctx.stroke();
				}
			}
			ctx.save();
			ctx.translate(reach, shake);
			const scale = 0.55 + out * 0.45;
			ctx.scale(scale, scale);
			energy(ctx, fistPath(size), { time, edge: 2.4 });
			ctx.restore();

			// Impact ring right as it lands
			if (punching && e.age - windup < 0.2) {
				const k = (e.age - windup) / 0.2;
				ctx.globalAlpha = 1 - k;
				ctx.strokeStyle = CORE;
				ctx.lineWidth = 3;
				ctx.beginPath();
				ctx.ellipse(reach + size * 0.5, 0, 8 + k * size, (8 + k * size) * 0.7, 0, 0, TAU);
				ctx.stroke();
			}
			break;
		}
		case 'hammer': {
			// Raised overhead through the windup, then brought down onto the ground ahead
			const windup = e.life - FIST_OUT_TIME;
			const size = e.radius ?? 60;
			const a = e.angle ?? 0;
			const reach = e.value ?? 80;
			const hx = e.x;
			const hy = e.y - lift;
			const facing = Math.cos(a) >= 0 ? 1 : -1;
			const ix = e.x + Math.cos(a) * reach;
			const iy = e.y + Math.sin(a) * reach;
			const swinging = e.age >= windup;
			const k = swinging ? easeOut(Math.min(1, (e.age - windup) / 0.1)) : 0;
			const raise = swinging ? 0 : Math.min(1, e.age / Math.max(0.05, windup));
			// Head position: from high up behind the shoulder, round onto the impact spot
			const upX = hx - facing * 18;
			const upY = hy - 58 - raise * 8;
			const headX = upX + (ix - upX) * k;
			const headY = upY + (iy - 8 - upY) * k;
			ctx.globalAlpha = swinging ? Math.max(0, 1 - Math.max(0, e.age - windup - 0.15) / (FIST_OUT_TIME - 0.15)) : 1;
			const handle = new Path2D();
			handle.moveTo(hx, hy);
			handle.lineTo(headX, headY);
			energy(ctx, handle, { time, edge: 3, body: 0 });
			ctx.save();
			ctx.translate(headX, headY);
			ctx.rotate(Math.atan2(headY - hy, headX - hx) + Math.PI / 2);
			const head = new Path2D();
			head.roundRect(-size * 0.42, -size * 0.2, size * 0.84, size * 0.4, 4);
			head.rect(-size * 0.5, -size * 0.24, size * 0.08, size * 0.48);
			head.rect(size * 0.42, -size * 0.24, size * 0.08, size * 0.48);
			energy(ctx, head, { time, edge: 2.4 });
			ctx.restore();
			// Swoosh arc while it comes down
			if (swinging && k < 1) {
				ctx.strokeStyle = 'rgba(234, 255, 240, 0.5)';
				ctx.lineWidth = 3;
				ctx.beginPath();
				ctx.moveTo(upX, upY);
				ctx.quadraticCurveTo(ix + facing * 20, upY, headX, headY);
				ctx.stroke();
			}
			break;
		}
		case 'afterimage': {
			// A fading green ghost streaking behind Hal's Afterburner
			const k = e.age / e.life;
			ctx.globalAlpha = 0.45 * (1 - k);
			ctx.translate(e.x, e.y - lift - 10);
			ctx.rotate(Math.cos(e.angle ?? 0) >= 0 ? 0 : Math.PI);
			ctx.fillStyle = GREEN;
			ctx.shadowColor = GREEN;
			ctx.shadowBlur = 12;
			ctx.beginPath();
			ctx.ellipse(-8 * k, 0, 16, 26, 0, 0, TAU);
			ctx.fill();
			break;
		}
		case 'shockwave': {
			// Two rings racing out along the ground, with radial streaks
			const r = e.radius ?? 150;
			ctx.shadowColor = GREEN;
			ctx.shadowBlur = 20;
			for (const [delay, width] of [
				[0, 7],
				[0.15, 3]
			] as const) {
				const k = Math.max(0, (t - delay) / (1 - delay));
				if (k <= 0) continue;
				ctx.globalAlpha = 1 - k;
				ctx.strokeStyle = delay === 0 ? GREEN : CORE;
				ctx.lineWidth = width * (1 - k) + 1;
				ctx.beginPath();
				ctx.ellipse(e.x, e.y, r * easeOut(k), r * easeOut(k) * 0.5, 0, 0, TAU);
				ctx.stroke();
			}
			ctx.globalAlpha = 1 - t;
			ctx.strokeStyle = 'rgba(61, 255, 110, 0.7)';
			ctx.lineWidth = 2;
			for (let i = 0; i < 16; i++) {
				const a = (i / 16) * TAU;
				const r1 = r * easeOut(t) * 0.55;
				const r2 = r * easeOut(t) * 0.95;
				ctx.beginPath();
				ctx.moveTo(e.x + Math.cos(a) * r1, e.y + Math.sin(a) * r1 * 0.5);
				ctx.lineTo(e.x + Math.cos(a) * r2, e.y + Math.sin(a) * r2 * 0.5);
				ctx.stroke();
			}
			break;
		}
		case 'blast': {
			const r = e.radius ?? 60;
			const hy = e.y - lift;
			ctx.globalAlpha = 1 - t;
			const flash = ctx.createRadialGradient(e.x, hy, 0, e.x, hy, r);
			flash.addColorStop(0, `rgba(234, 255, 240, ${0.9 * (1 - t)})`);
			flash.addColorStop(0.5, `rgba(61, 255, 110, ${0.5 * (1 - t)})`);
			flash.addColorStop(1, 'rgba(61, 255, 110, 0)');
			ctx.fillStyle = flash;
			ctx.beginPath();
			ctx.arc(e.x, hy, r * (0.4 + t * 0.8), 0, TAU);
			ctx.fill();
			ctx.shadowColor = GREEN;
			ctx.shadowBlur = 18;
			ctx.strokeStyle = GREEN;
			ctx.lineWidth = 5 * (1 - t) + 1;
			ctx.beginPath();
			ctx.arc(e.x, hy, r * easeOut(t), 0, TAU);
			ctx.stroke();
			// Shards flying out
			ctx.fillStyle = CORE;
			for (let i = 0; i < 12; i++) {
				const a = (i / 12) * TAU + i;
				const d = r * 1.2 * easeOut(t);
				ctx.fillRect(e.x + Math.cos(a) * d - 1.5, hy + Math.sin(a) * d - 1.5, 3, 3);
			}
			break;
		}
		case 'burst': {
			// Splinters flying out and a flash
			ctx.globalAlpha = 1 - t;
			ctx.strokeStyle = GREEN;
			ctx.lineWidth = 3 * (1 - t);
			ctx.beginPath();
			ctx.arc(e.x, e.y, 8 + t * 40, 0, TAU);
			ctx.stroke();
			ctx.fillStyle = '#8a6636';
			for (let i = 0; i < 12; i++) {
				const a = (i / 12) * TAU + i;
				const d = t * (30 + (i % 3) * 16);
				ctx.save();
				ctx.translate(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d * 0.6 - Math.sin(t * Math.PI) * 16);
				ctx.rotate(t * 8 + i);
				ctx.fillRect(-3.5, -1.5, 7, 3);
				ctx.restore();
			}
			break;
		}
		case 'fizzle': {
			// A construct dissolving into rising green sparks
			ctx.globalAlpha = 1 - t;
			ctx.shadowColor = GREEN;
			ctx.shadowBlur = 8;
			ctx.fillStyle = GREEN;
			for (let i = 0; i < 18; i++) {
				const a = (i / 18) * TAU;
				const d = 6 + t * (24 + (i % 4) * 6);
				ctx.fillRect(e.x + Math.cos(a) * d - 1.5, e.y + Math.sin(a) * d * 0.5 - t * 30 - 1.5, 3, 3);
			}
			break;
		}
		case 'pop': {
			// A bubble shield breaking: hex shards flying out from the body
			// (lift here is the body-centre height, see Game)
			const hy = e.y - lift;
			ctx.globalAlpha = 1 - t;
			ctx.shadowColor = GREEN;
			ctx.shadowBlur = 10;
			ctx.strokeStyle = GREEN;
			ctx.lineWidth = 1.5;
			for (let i = 0; i < 14; i++) {
				const a = (i / 14) * TAU;
				const d = (e.radius ?? 48) + easeOut(t) * 40;
				ctx.save();
				ctx.translate(e.x + Math.cos(a) * d, hy + Math.sin(a) * d);
				ctx.rotate(t * 6 + i);
				ctx.beginPath();
				for (let k = 0; k < 6; k++) {
					const ha = (k / 6) * TAU;
					ctx.lineTo(Math.cos(ha) * 5, Math.sin(ha) * 5);
				}
				ctx.closePath();
				ctx.stroke();
				ctx.restore();
			}
			break;
		}
		case 'snap': {
			// A construct forming: sparks rush inward and a bright ring closes
			const r = e.radius ?? 40;
			ctx.shadowColor = GREEN;
			ctx.shadowBlur = 14;
			ctx.globalAlpha = 1 - t;
			ctx.strokeStyle = CORE;
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.ellipse(e.x, e.y, r * (1.5 - t * 0.5), r * (1.5 - t * 0.5) * 0.5, 0, 0, TAU);
			ctx.stroke();
			ctx.fillStyle = GREEN;
			for (let i = 0; i < 12; i++) {
				const a = (i / 12) * TAU;
				const d = r * 1.8 * (1 - easeOut(t));
				ctx.fillRect(e.x + Math.cos(a) * d - 1.5, e.y + Math.sin(a) * d * 0.5 - 1.5, 3, 3);
			}
			break;
		}
		case 'impact': {
			const hy = e.y - lift;
			ctx.globalAlpha = 1 - t;
			ctx.shadowColor = GREEN;
			ctx.shadowBlur = 10;
			ctx.fillStyle = CORE;
			ctx.beginPath();
			ctx.arc(e.x, hy, 3 + t * 5, 0, TAU);
			ctx.fill();
			ctx.strokeStyle = GREEN;
			ctx.lineWidth = 1.5;
			for (let i = 0; i < 4; i++) {
				const a = (i / 4) * TAU + e.x;
				ctx.beginPath();
				ctx.moveTo(e.x + Math.cos(a) * 4, hy + Math.sin(a) * 4);
				ctx.lineTo(e.x + Math.cos(a) * (8 + t * 8), hy + Math.sin(a) * (8 + t * 8));
				ctx.stroke();
			}
			break;
		}
		case 'snipe': {
			// The shot: a blinding line along its whole path, then a fading trail
			const len = e.value ?? 600;
			const a = e.angle ?? 0;
			const hy = e.y - lift;
			const ex = e.x + Math.cos(a) * len;
			const ey = hy + Math.sin(a) * len;
			const power = 0.5 + 0.5 * (e.radius ?? 1);
			ctx.lineCap = 'round';
			ctx.shadowColor = GREEN;
			ctx.shadowBlur = 20;
			ctx.globalAlpha = (1 - t) * power;
			ctx.strokeStyle = GREEN;
			ctx.lineWidth = (10 * (1 - t) + 2) * power;
			ctx.beginPath();
			ctx.moveTo(e.x, hy);
			ctx.lineTo(ex, ey);
			ctx.stroke();
			ctx.shadowBlur = 0;
			ctx.globalAlpha = 1 - t;
			ctx.strokeStyle = CORE;
			ctx.lineWidth = 2.5 * (1 - t) + 0.5;
			ctx.beginPath();
			ctx.moveTo(e.x, hy);
			ctx.lineTo(ex, ey);
			ctx.stroke();
			// Rings rippling out along the line
			ctx.strokeStyle = `rgba(234, 255, 240, ${0.5 * (1 - t)})`;
			ctx.lineWidth = 1.5;
			for (let i = 1; i <= 5; i++) {
				const k = i / 6;
				ctx.beginPath();
				ctx.ellipse(e.x + Math.cos(a) * len * k, hy + Math.sin(a) * len * k, 4 + t * 14, 2 + t * 7, a, 0, TAU);
				ctx.stroke();
			}
			break;
		}
		case 'claw': {
			// Three red slash marks raking across the aim direction
			const a = e.angle ?? 0;
			const reach = (e.radius ?? 50) * 0.9;
			const hy = e.y - lift;
			ctx.globalAlpha = 1 - t;
			ctx.shadowColor = '#ff2a2a';
			ctx.shadowBlur = 14;
			ctx.strokeStyle = t < 0.3 ? '#ffffff' : '#ff2a2a';
			ctx.lineCap = 'round';
			for (let i = -1; i <= 1; i++) {
				ctx.lineWidth = 3.5 * (1 - t) + 1;
				const off = i * 9;
				const nx = -Math.sin(a) * off;
				const ny = Math.cos(a) * off;
				const sweep = easeOut(Math.min(1, t * 3));
				ctx.beginPath();
				ctx.moveTo(e.x + nx + Math.cos(a - 0.6) * reach * 0.3, hy + ny + Math.sin(a - 0.6) * reach * 0.3);
				ctx.lineTo(
					e.x + nx + Math.cos(a - 0.6 + 1.2 * sweep) * reach,
					hy + ny + Math.sin(a - 0.6 + 1.2 * sweep) * reach
				);
				ctx.stroke();
			}
			break;
		}
		case 'roar':
		case 'slamMark':
		case 'redBlast':
		case 'redImpact':
		case 'scythe':
		case 'spikeBurst':
		case 'redTrail':
		case 'redAxe':
		case 'redMace':
		case 'pulse':
			drawRedEffect(ctx, e, lift, time);
			break;
		case 'text': {
			// Small floating note, e.g. "+25 XP"
			ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
			ctx.font = uiFont(700, 12);
			ctx.textAlign = 'center';
			ctx.lineWidth = 3;
			ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
			ctx.fillStyle = '#b8ffcf';
			const ty = e.y - lift - easeOut(t) * 26;
			ctx.strokeText(e.text ?? '', e.x, ty);
			ctx.fillText(e.text ?? '', e.x, ty);
			break;
		}
		case 'pillars': {
			if (space) drawViceCrush(ctx, e, time);
			else drawPillarDrop(ctx, e, time);
			break;
		}
		case 'number': {
			// Pops up, floats, fades
			const pop = t < 0.15 ? 1 + (1 - t / 0.15) * 0.5 : 1;
			ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
			ctx.translate(e.x, e.y - 64 - easeOut(t) * 30);
			ctx.scale(pop, pop);
			ctx.font = uiFont(800, 15, true);
			ctx.textAlign = 'center';
			ctx.lineWidth = 3.5;
			ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
			ctx.fillStyle = e.hurt ? '#ff5a5a' : (e.value ?? 0) >= 30 ? '#ffe066' : '#fff3b0';
			ctx.strokeText(String(e.value), 0, 0);
			ctx.fillText(String(e.value), 0, 0);
			break;
		}
	}
	ctx.restore();
}

/**
 * The Auto-Turret's SPACE form: a Sentry Drone. Nothing to stand a tripod on,
 * so it hovers: a core with twin barrels, a spinning stabiliser ring, and
 * little thruster flames underneath.
 */
function drawSentryDrone(ctx: CanvasRenderingContext2D, t: Turret, time: number) {
	const fading = t.life < 1.5;
	const alpha = fading ? 0.5 + 0.5 * Math.sin(time * 20) : 1;
	const grow = Math.min(1, (t.maxLife - t.life) / 0.25);
	const bob = Math.sin(time * 3 + t.x) * 2.5;
	ctx.save();
	ctx.globalAlpha = alpha;
	ctx.translate(t.x, t.y - SENTRY_DRONE_HOVER + bob);
	ctx.scale(grow, grow);

	// Thrusters
	const flame = 4 + Math.sin(time * 40) * 1.5;
	ctx.fillStyle = 'rgba(61, 255, 110, 0.6)';
	for (const side of [-1, 1]) {
		ctx.beginPath();
		ctx.moveTo(side * 7 - 2, 6);
		ctx.lineTo(side * 7, 6 + flame + 4);
		ctx.lineTo(side * 7 + 2, 6);
		ctx.closePath();
		ctx.fill();
	}

	// Spinning stabiliser ring
	const ring = new Path2D();
	ring.ellipse(0, 2, 16, 5, 0, 0, Math.PI * 2);
	energy(ctx, ring, { time, edge: 1.4, body: 0 });
	ctx.fillStyle = CORE;
	const spin = time * 6;
	ctx.beginPath();
	ctx.arc(Math.cos(spin) * 16, 2 + Math.sin(spin) * 5, 1.8, 0, TAU);
	ctx.fill();

	// Core and barrels, turned toward the target
	ctx.rotate(t.aim);
	if (Math.cos(t.aim) < 0) ctx.scale(1, -1);
	const body = new Path2D();
	body.arc(0, 0, 8, 0, Math.PI * 2);
	body.rect(6, -5, 13, 3);
	body.rect(6, 2, 13, 3);
	energy(ctx, body, { time, edge: 1.6 });
	ctx.fillStyle = CORE;
	ctx.beginPath();
	ctx.arc(2, 0, 2.5, 0, TAU);
	ctx.fill();
	if (t.cooldown > 0.25) {
		ctx.shadowColor = GREEN;
		ctx.shadowBlur = 12;
		ctx.beginPath();
		ctx.arc(21, -3.5, 3, 0, TAU);
		ctx.arc(21, 3.5, 3, 0, TAU);
		ctx.fill();
	}
	ctx.restore();

	// Time left
	ctx.save();
	ctx.globalAlpha = alpha * 0.8;
	ctx.strokeStyle = 'rgba(234, 255, 240, 0.6)';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(t.x, t.y - SENTRY_DRONE_HOVER + bob, 22, Math.PI * 0.2, Math.PI * 0.2 + Math.PI * 0.6 * (t.life / t.maxLife));
	ctx.stroke();
	ctx.restore();
}

/**
 * Pillar Drop's SPACE form: Vice Crush. Nothing falls in space, so two giant
 * construct slabs appear on either side of the target and slam together.
 *  1. A lock-on reticle closes in (the warning time).
 *  2. The slabs rush in from both sides and meet with a flash.
 *  3. They hold, then break apart into sparks.
 */
function drawViceCrush(ctx: CanvasRenderingContext2D, e: Effect, time: number) {
	const r = e.radius ?? 75;
	const warning = e.life - 0.9;
	const cy = e.y - 30;

	if (e.age < warning) {
		const k = e.age / warning;
		ctx.save();
		ctx.translate(e.x, cy);
		ctx.shadowColor = GREEN;
		ctx.shadowBlur = 10;
		ctx.strokeStyle = `rgba(61, 255, 110, ${0.6 + 0.4 * Math.sin(time * 20)})`;
		ctx.lineWidth = 2;
		// Brackets closing in on the target
		const gap = r * (1.3 - 0.5 * k);
		for (const side of [-1, 1]) {
			ctx.beginPath();
			ctx.moveTo(side * gap, -r * 0.6);
			ctx.lineTo(side * (gap + 10), -r * 0.6);
			ctx.lineTo(side * (gap + 10), r * 0.6);
			ctx.lineTo(side * gap, r * 0.6);
			ctx.stroke();
		}
		ctx.setLineDash([6, 6]);
		ctx.lineDashOffset = -time * 40;
		ctx.beginPath();
		ctx.ellipse(0, 30, r, r * 0.5, 0, 0, TAU);
		ctx.stroke();
		ctx.restore();
		return;
	}

	const after = e.age - warning;
	const close = Math.min(1, after / 0.08);
	const fade = after < 0.45 ? 1 : 1 - (after - 0.45) / 0.45;
	const slabW = 26;
	const slabH = r * 1.4;
	// Slab inner edges start far apart and meet a little either side of centre
	const gap = 6 + (1 - easeOut(close)) * (r + 90);

	ctx.save();
	ctx.globalAlpha = Math.max(0, fade);
	for (const side of [-1, 1]) {
		ctx.save();
		ctx.translate(e.x + side * (gap + slabW / 2), cy);
		const slab = new Path2D();
		slab.roundRect(-slabW / 2, -slabH / 2, slabW, slabH, 4);
		// Grip ridges on the inside face
		for (let i = -2; i <= 2; i++) slab.rect(-side * (slabW / 2) - (side > 0 ? 0 : 4), i * 12 - 2, 4, 4);
		energy(ctx, slab, { time, edge: 2.2 });
		ctx.restore();
	}
	ctx.restore();

	// Flash where they meet
	if (close >= 1 && after < 0.35) {
		const k = (after - 0.08) / 0.27;
		ctx.save();
		ctx.globalAlpha = Math.max(0, 1 - k);
		ctx.shadowColor = GREEN;
		ctx.shadowBlur = 24;
		ctx.fillStyle = CORE;
		ctx.beginPath();
		ctx.ellipse(e.x, cy, 10 + k * 20, slabH * 0.5 * (1 - k * 0.5), 0, 0, TAU);
		ctx.fill();
		ctx.restore();
	}
	if (fade < 1) sparks(ctx, e.x, cy, r * 0.6, 10, time, e.x);
}

/** Stars circling a stunned target's head. */
function drawDizzy(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
	ctx.save();
	ctx.fillStyle = '#fff3b0';
	ctx.shadowColor = '#ffe066';
	ctx.shadowBlur = 6;
	for (let i = 0; i < 3; i++) {
		const a = time * 5 + (i * TAU) / 3;
		const sx = x + Math.cos(a) * 12;
		const sy = y + Math.sin(a) * 4;
		ctx.beginPath();
		for (let k = 0; k < 10; k++) {
			const r = k % 2 === 0 ? 4 : 1.7;
			const ang = (k / 10) * TAU - Math.PI / 2;
			ctx.lineTo(sx + Math.cos(ang) * r, sy + Math.sin(ang) * r);
		}
		ctx.closePath();
		ctx.fill();
	}
	ctx.restore();
}

/** Where the pillars land within the strike circle: a triangle around the centre. */
function pillarSpots(x: number, y: number, radius: number): [number, number][] {
	return [-90, 30, 150].map((deg) => {
		const a = (deg * Math.PI) / 180;
		return [x + Math.cos(a) * radius * 0.45, y + Math.sin(a) * radius * 0.45 * 0.5];
	});
}

/**
 * Pillar Drop, from warning to rubble:
 *  1. A warning circle fills in on the ground (the charge time).
 *  2. Three construct pillars plunge from above and slam down with a dust ring.
 *  3. They stand a moment, then crumble into sparks.
 */
function drawPillarDrop(ctx: CanvasRenderingContext2D, e: Effect, time: number) {
	const r = e.radius ?? 75;
	const warning = e.life - 0.9;
	const spots = pillarSpots(e.x, e.y, r);

	if (e.age < warning) {
		const k = e.age / warning;
		ctx.shadowColor = GREEN;
		ctx.shadowBlur = 10;
		ctx.strokeStyle = `rgba(61, 255, 110, ${0.5 + 0.5 * Math.sin(time * 20)})`;
		ctx.lineWidth = 2;
		ctx.setLineDash([10, 6]);
		ctx.lineDashOffset = -time * 40;
		ctx.beginPath();
		ctx.ellipse(e.x, e.y, r, r * 0.5, 0, 0, TAU);
		ctx.stroke();
		ctx.setLineDash([]);
		ctx.fillStyle = `rgba(61, 255, 110, ${0.08 + 0.18 * k})`;
		ctx.beginPath();
		ctx.ellipse(e.x, e.y, r * k, r * 0.5 * k, 0, 0, TAU);
		ctx.fill();
		// Shadows of the pillars growing as they come down
		ctx.shadowBlur = 0;
		ctx.fillStyle = `rgba(0, 0, 0, ${0.15 + 0.3 * k})`;
		for (const [px, py] of spots) {
			ctx.beginPath();
			ctx.ellipse(px, py, 12 * k + 4, (12 * k + 4) * 0.45, 0, 0, TAU);
			ctx.fill();
		}
		return;
	}

	const after = e.age - warning;
	const fall = Math.min(1, after / 0.08);
	const fade = after < 0.45 ? 1 : 1 - (after - 0.45) / 0.45;
	const height = 60;

	// Dust / impact ring as they land
	if (fall >= 1) {
		const k = Math.min(1, (after - 0.08) / 0.4);
		ctx.globalAlpha = 1 - k;
		ctx.strokeStyle = CORE;
		ctx.lineWidth = 4 * (1 - k) + 1;
		ctx.beginPath();
		ctx.ellipse(e.x, e.y, r * (0.6 + k * 0.6), r * 0.5 * (0.6 + k * 0.6), 0, 0, TAU);
		ctx.stroke();
		ctx.globalAlpha = 1;
	}

	for (const [px, py] of spots) {
		ctx.save();
		ctx.globalAlpha = Math.max(0, fade);
		// Drop from high above to the ground
		const drop = (1 - fall) * 260;
		ctx.translate(px, py - drop);
		const pillar = new Path2D();
		pillar.rect(-9, -height, 18, height);
		pillar.rect(-12, -height - 6, 24, 6); // capital
		pillar.rect(-12, -5, 24, 5); // base
		energy(ctx, pillar, { time, edge: 2 });
		ctx.restore();
		if (fade < 1) sparks(ctx, px, py - height / 2, 16, 6, time, px);
	}
}

const easeOut = (k: number) => 1 - (1 - k) ** 3;
