// Drawing for everything the construct system puts in the world.
//
// Constructs are solid light, so they all share one material (see
// `energy()`): a wide soft glow, a see-through green body, a crisp bright
// edge, a pale inner highlight, and a shimmer that sweeps across. Shapes
// are built as Path2D objects in local space, so the same shape can be
// filled, stroked, and clipped without redrawing the path each time.

import { FIST_OUT_TIME, type Effect, type Projectile, type Shield, type Trap } from '../constructs/system';
import { DUMMY_HP, isStanding, type Dummy } from '../dummy';
import type { Target } from '../targeting';
import { GREEN } from './lantern';

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
	}
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

	if (pr.kind === 'bullet') {
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
export function drawShield(ctx: CanvasRenderingContext2D, s: Shield, x: number, y: number, lift: number, time: number) {
	const cx = x;
	const cy = y - lift - 30;
	const hitRipple = s.ripple / 0.3;
	const r = 38 + hitRipple * 4 + Math.sin(time * 3) * 1;
	const health = s.hp / s.maxHp;
	// Blink in the last two seconds so you know it's about to go
	const blink = s.life < 2 && Math.sin(time * 18) > 0 ? 0.45 : 1;

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
	for (let row = -5; row <= 5; row++) {
		for (let col = -5; col <= 5; col++) {
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
export function drawDummy(ctx: CanvasRenderingContext2D, d: Dummy, x: number, y: number, onGround: boolean, time: number) {
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
	const flash = d.flash > 0;
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

	if (d.hp < DUMMY_HP) {
		ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
		ctx.fillRect(x - 16, cy - 38, 32, 4);
		ctx.fillStyle = '#e8c86a';
		ctx.fillRect(x - 16, cy - 38, 32 * (d.hp / DUMMY_HP), 4);
	}
	ctx.restore();

	if (d.caged > 0) drawCage(ctx, x, y + (onGround ? 0 : bob), time);
}

// ---------------------------------------------------------------- effects

/**
 * One-off visuals. `lift` raises effects tied to a Lantern (slashes,
 * punches) to their hand height.
 */
export function drawEffect(ctx: CanvasRenderingContext2D, e: Effect, lift: number, time: number) {
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
			const hy = e.y - lift - 30;
			ctx.globalAlpha = 1 - t;
			ctx.shadowColor = GREEN;
			ctx.shadowBlur = 10;
			ctx.strokeStyle = GREEN;
			ctx.lineWidth = 1.5;
			for (let i = 0; i < 14; i++) {
				const a = (i / 14) * TAU;
				const d = 38 + easeOut(t) * 40;
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
		case 'number': {
			// Pops up, floats, fades
			const pop = t < 0.15 ? 1 + (1 - t / 0.15) * 0.5 : 1;
			ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
			ctx.translate(e.x, e.y - 64 - easeOut(t) * 30);
			ctx.scale(pop, pop);
			ctx.font = '800 14px system-ui, sans-serif';
			ctx.textAlign = 'center';
			ctx.lineWidth = 3.5;
			ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
			ctx.fillStyle = (e.value ?? 0) >= 30 ? '#ffe066' : '#fff3b0';
			ctx.strokeText(String(e.value), 0, 0);
			ctx.fillText(String(e.value), 0, 0);
			break;
		}
	}
	ctx.restore();
}

const easeOut = (k: number) => 1 - (1 - k) ** 3;
