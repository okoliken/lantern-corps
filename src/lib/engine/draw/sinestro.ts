// Art for Sinestro's own kit (constructs/defs.ts, LOADOUTS.sinestro): the
// Korugar kit. Where Hal builds jets and John builds hardware, Sinestro builds
// what a ruler would: a duelling sabre, crystal needles and cells, obelisks,
// an honour guard. Everything is long, sharp and symmetrical.

import { FLIER_HOVER, type Effect, type Projectile, type Trap, type Turret } from '../constructs/system';
import { energy, sparks } from './constructs';
import { GREEN } from './lantern';
import { green, greenCore, GREEN_CORE } from '../../theme';

const TAU = Math.PI * 2;
const CORE = GREEN_CORE;
const easeOut = (k: number) => 1 - (1 - k) ** 3;
const fadeOf = (t: Turret, time: number) => (t.life < 1.5 ? 0.5 + 0.5 * Math.sin(time * 20) : 1);

// ------------------------------------------------------------ Korugar Saber

/** A long sabre along +x: basket hilt at the hand, a blade with a slight upward curve to a fine point. */
export function saberPath(len: number): Path2D {
	const p = new Path2D();
	// Grip and pommel
	p.roundRect(-10, -2, 12, 4, 2);
	p.arc(-11, 0, 2.6, 0, TAU);
	// Basket guard: a cupped arc round the hand
	p.moveTo(2, -7);
	p.quadraticCurveTo(-8, -9, -9, 3);
	p.moveTo(2, -7);
	p.lineTo(2, 7);
	// The blade: thick at the forte, curving up and in to the point
	p.moveTo(3, -2.6);
	p.quadraticCurveTo(len * 0.6, -4, len, -len * 0.09);
	p.quadraticCurveTo(len * 0.62, 1.2, 3, 2.6);
	p.closePath();
	return p;
}

/** The sabre's cut: a wide, thin crescent and the blade drawn through it. */
export function drawSaberSlash(ctx: CanvasRenderingContext2D, e: Effect, lift: number, time: number) {
	const t = e.age / e.life;
	const reach = e.radius ?? 98;
	const aim = e.angle ?? 0;
	const swing = easeOut(Math.min(1, t / 0.45));
	const start = aim - 1.3;
	const current = start + swing * 2.6;
	const hy = e.y - lift;

	// A thin crescent: the sabre cuts a line, it doesn't bludgeon
	ctx.globalAlpha = 1 - t;
	const trail = new Path2D();
	trail.arc(e.x, hy, reach, start, current);
	trail.arc(e.x, hy, reach * 0.82, current, start, true);
	trail.closePath();
	ctx.fillStyle = green(0.3);
	ctx.fill(trail);
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 12;
	ctx.strokeStyle = CORE;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(e.x, hy, reach, Math.max(start, current - 1.2), current);
	ctx.stroke();
	ctx.shadowBlur = 0;

	for (let i = 2; i >= 0; i--) {
		ctx.save();
		ctx.translate(e.x, hy);
		ctx.rotate(current - i * 0.18 * (1 - t));
		energy(ctx, saberPath(reach), { time, edge: 1.5, alpha: i === 0 ? 1 - t * 0.5 : 0.16 * (1 - t) });
		ctx.restore();
	}
}

// ------------------------------------------------------------ Seizing Talon

/** A clawed hand along +x, three talons and a thumb; `open` 0 (shut) to 1 (spread). */
function talonPath(open: number): Path2D {
	const p = new Path2D();
	// Palm, wider at the knuckles
	p.moveTo(-8, -6);
	p.lineTo(4, -9);
	p.lineTo(4, 9);
	p.lineTo(-8, 6);
	p.closePath();
	// Talons: long, jointed, hooked at the tip
	for (const [i, side] of [
		[-1, -1],
		[0, 0],
		[1, 1]
	] as const) {
		const spread = (0.2 + 0.45 * open) * side;
		const bx = 4;
		const by = i * 6;
		const mx = bx + Math.cos(spread) * 10;
		const my = by + Math.sin(spread) * 10;
		const hook = spread + (1 - open) * 0.9 * (side === 0 ? 1 : -side) + 0.5 * (side === 0 ? 0 : -side * open);
		const tx = mx + Math.cos(hook) * 11;
		const ty = my + Math.sin(hook) * 11;
		p.moveTo(bx, by - 1.6);
		p.lineTo(mx, my - 1.4);
		p.lineTo(tx, ty);
		p.lineTo(mx, my + 1.4);
		p.lineTo(bx, by + 1.6);
	}
	// Thumb, from the bottom of the palm
	p.moveTo(-4, 6);
	p.lineTo(4 + open * 4, 14 + open * 4);
	p.lineTo(-1, 7);
	return p;
}

/** The talon in flight, spread wide to grab. */
export function drawTalonHead(ctx: CanvasRenderingContext2D, pr: Projectile, x: number, y: number, lift: number, time: number) {
	ctx.save();
	ctx.translate(x, y - lift);
	ctx.rotate(Math.atan2(pr.vy, pr.vx));
	ctx.scale(1.25, 1.25);
	energy(ctx, talonPath(1), { time, edge: 1.4 });
	ctx.restore();
}

/**
 * The arm behind the talon: plated segments from his hand to it, each one a
 * little narrower, with a knuckle between. With `closed`, the talon is shut
 * round whatever it caught.
 */
export function drawTalonArm(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, time: number, closed = false) {
	const len = Math.hypot(x2 - x1, y2 - y1);
	const angle = Math.atan2(y2 - y1, x2 - x1);
	ctx.save();
	ctx.translate(x1, y1);
	ctx.rotate(angle);
	const segs = Math.max(2, Math.round(len / 26));
	const arm = new Path2D();
	for (let i = 0; i < segs; i++) {
		const a = (i / segs) * len;
		const b = ((i + 1) / segs) * len - 4;
		const h = 4.5 - (i / segs) * 1.8;
		arm.moveTo(a + 3, -h);
		arm.lineTo(b - 2, -h * 0.8);
		arm.lineTo(b, 0);
		arm.lineTo(b - 2, h * 0.8);
		arm.lineTo(a + 3, h);
		arm.lineTo(a, 0);
		arm.closePath();
	}
	energy(ctx, arm, { time, edge: 1.2, body: 0.8 });
	// A pulse running down the arm toward the hand: it's pulling
	const k = (time * 2.2) % 1;
	ctx.fillStyle = greenCore(0.8 * (1 - k));
	ctx.beginPath();
	ctx.arc(len * (1 - k), 0, 3, 0, TAU);
	ctx.fill();
	if (closed) {
		ctx.translate(len, 0);
		ctx.scale(1.25, 1.25);
		energy(ctx, talonPath(0), { time, edge: 1.4 });
	}
	ctx.restore();
}

// ------------------------------------------------------------ Needle Volley

/** A crystal needle: long, four-faceted, with a short bright wake. */
export function drawNeedle(ctx: CanvasRenderingContext2D, pr: Projectile, x: number, y: number, lift: number, time: number) {
	ctx.save();
	ctx.translate(x, y - lift);
	ctx.rotate(Math.atan2(pr.vy, pr.vx));
	const wake = ctx.createLinearGradient(-70, 0, -14, 0);
	wake.addColorStop(0, green(0));
	wake.addColorStop(1, green(0.5));
	ctx.fillStyle = wake;
	ctx.beginPath();
	ctx.moveTo(-70, 0);
	ctx.lineTo(-14, -2.5);
	ctx.lineTo(-14, 2.5);
	ctx.closePath();
	ctx.fill();
	const needle = new Path2D();
	needle.moveTo(26, 0);
	needle.lineTo(4, -3.6);
	needle.lineTo(-16, 0);
	needle.lineTo(4, 3.6);
	needle.closePath();
	energy(ctx, needle, { time, edge: 1.2, body: 1.4 });
	// The ridge down the middle catches the light
	ctx.strokeStyle = CORE;
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(-14, 0);
	ctx.lineTo(24, 0);
	ctx.stroke();
	ctx.restore();
}

// --------------------------------------------------------------- Prism Cell

function hexPoints(r: number, squash: number, turn = 0): [number, number][] {
	const pts: [number, number][] = [];
	for (let i = 0; i < 6; i++) {
		const a = turn + (i / 6) * TAU;
		pts.push([Math.cos(a) * r, Math.sin(a) * r * squash]);
	}
	return pts;
}

/** Waiting on the ground: a hexagon of light with a slowly turning triangle inside, crystal tips at the corners. */
export function drawPrismTrap(ctx: CanvasRenderingContext2D, t: Trap, time: number) {
	const r = t.radius;
	const pulse = 0.6 + 0.4 * Math.sin(time * 3.5);
	ctx.save();
	ctx.translate(t.x, t.y);
	const hex = hexPoints(r, 0.45);
	const floor = new Path2D();
	hex.forEach(([x, y], i) => (i ? floor.lineTo(x, y) : floor.moveTo(x, y)));
	floor.closePath();
	ctx.fillStyle = green(0.08 + 0.06 * pulse);
	ctx.fill(floor);
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 8;
	ctx.strokeStyle = green(0.55 + 0.35 * pulse);
	ctx.lineWidth = 2;
	ctx.stroke(floor);
	ctx.shadowBlur = 0;
	// Two triangles turning opposite ways: a star that never settles
	ctx.lineWidth = 1.2;
	for (const dir of [1, -1]) {
		const tri = hexPoints(r * 0.62, 0.45, dir * time * 0.7).filter((_, i) => i % 2 === 0);
		ctx.strokeStyle = greenCore(0.35 + 0.3 * pulse);
		ctx.beginPath();
		tri.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
		ctx.closePath();
		ctx.stroke();
	}
	// Crystal tips standing at each corner
	for (const [x, y] of hex) {
		const tip = new Path2D();
		tip.moveTo(x - 3, y);
		tip.lineTo(x, y - 9 - 4 * pulse);
		tip.lineTo(x + 3, y);
		tip.closePath();
		ctx.fillStyle = green(0.5);
		ctx.fill(tip);
		ctx.strokeStyle = CORE;
		ctx.lineWidth = 1;
		ctx.stroke(tip);
	}
	ctx.restore();
}

/** Closed round its catch: a standing hexagonal crystal, faces catching the light, cracking as time runs out. */
export function drawPrismCell(ctx: CanvasRenderingContext2D, e: Effect, time: number) {
	const r = Math.max(26, (e.radius ?? 46) * 0.62);
	const h = 82;
	const rise = easeOut(Math.min(1, e.age / 0.14));
	const left = e.life - e.age;
	const flick = left < 1 ? 0.55 + 0.45 * Math.sin(time * 26) : 1;
	const base = hexPoints(r, 0.4);
	ctx.save();
	ctx.translate(e.x, e.y);
	ctx.globalAlpha = flick;
	const top = -h * rise;
	// Faces: the front three drawn a little brighter than the back
	for (let i = 0; i < 6; i++) {
		const [ax, ay] = base[i];
		const [bx, by] = base[(i + 1) % 6];
		const front = ay + by > 0;
		ctx.fillStyle = green(front ? 0.16 : 0.08);
		ctx.beginPath();
		ctx.moveTo(ax, ay);
		ctx.lineTo(bx, by);
		ctx.lineTo(bx, by + top);
		ctx.lineTo(ax, ay + top);
		ctx.closePath();
		ctx.fill();
	}
	const frame = new Path2D();
	base.forEach(([x, y], i) => (i ? frame.lineTo(x, y) : frame.moveTo(x, y)));
	frame.closePath();
	base.forEach(([x, y], i) => (i ? frame.lineTo(x, y + top) : frame.moveTo(x, y + top)));
	frame.closePath();
	for (const [x, y] of base) {
		frame.moveTo(x, y);
		frame.lineTo(x, y + top);
	}
	// The pointed cap
	for (const [x, y] of base) {
		frame.moveTo(x, y + top);
		frame.lineTo(0, top - 16 * rise);
	}
	energy(ctx, frame, { time, edge: 1.6, body: 0 });
	// A glint climbing one edge
	const g = (time * 0.9) % 1;
	ctx.fillStyle = greenCore(0.9);
	ctx.beginPath();
	ctx.arc(base[1][0], base[1][1] + top * g, 2.2, 0, TAU);
	ctx.fill();
	// Cracks, as it's about to give
	if (left < 1.4) {
		ctx.strokeStyle = greenCore(0.8);
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(-r * 0.3, top * 0.3);
		ctx.lineTo(-r * 0.1, top * 0.45);
		ctx.lineTo(-r * 0.25, top * 0.6);
		ctx.moveTo(r * 0.4, top * 0.7);
		ctx.lineTo(r * 0.2, top * 0.55);
		ctx.stroke();
	}
	ctx.restore();
	sparks(ctx, e.x, e.y - h * 0.5, r, 5, time, e.x * 0.01);
}

// ---------------------------------------------------------- Korugar Spires

/** Where the obelisks come up: one in the middle, five round it. */
function spireSpots(x: number, y: number, r: number): [number, number, number][] {
	const spots: [number, number, number][] = [[x, y, 1]];
	for (let i = 0; i < 5; i++) {
		const a = (i / 5) * TAU + 0.3;
		spots.push([x + Math.cos(a) * r * 0.66, y + Math.sin(a) * r * 0.33, 0.6 + 0.15 * (i % 3)]);
	}
	// Back ones first, so the front ones stand over them
	return spots.sort((a, b) => a[1] - b[1]);
}

/** A Korugar sigil glows and cracks open, then obelisks burst up out of the ground. */
export function drawSpires(ctx: CanvasRenderingContext2D, e: Effect, time: number) {
	const r = e.radius ?? 78;
	const warning = e.life - 0.9;
	ctx.save();
	if (e.age < warning) {
		// The sigil: two rings, a six-point star, lines out from the middle
		const k = Math.max(0, e.age / warning);
		ctx.translate(e.x, e.y);
		ctx.scale(1, 0.5);
		ctx.shadowColor = GREEN;
		ctx.shadowBlur = 8;
		ctx.strokeStyle = green(0.4 + 0.5 * k);
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(0, 0, r, 0, TAU * k);
		ctx.stroke();
		ctx.lineWidth = 1.2;
		ctx.beginPath();
		ctx.arc(0, 0, r * 0.7, -time, -time + TAU * k);
		ctx.stroke();
		ctx.shadowBlur = 0;
		ctx.strokeStyle = greenCore(0.3 + 0.5 * k);
		ctx.beginPath();
		for (let i = 0; i < 6; i++) {
			const a = (i / 6) * TAU + time * 0.4;
			const b = a + (2 / 6) * TAU;
			ctx.moveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
			ctx.lineTo(Math.cos(b) * r * 0.7, Math.sin(b) * r * 0.7);
		}
		ctx.stroke();
		ctx.fillStyle = green(0.06 + 0.16 * k);
		ctx.beginPath();
		ctx.arc(0, 0, r * k, 0, TAU);
		ctx.fill();
		ctx.restore();
		return;
	}

	const after = e.age - warning;
	const up = easeOut(Math.min(1, after / 0.1));
	const sink = after < 0.5 ? 0 : Math.min(1, (after - 0.5) / 0.4);
	// The ground cracking out from the middle
	ctx.globalAlpha = 1 - sink;
	ctx.strokeStyle = greenCore(0.7);
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	for (let i = 0; i < 8; i++) {
		const a = (i / 8) * TAU + 0.2;
		ctx.moveTo(e.x, e.y);
		ctx.lineTo(e.x + Math.cos(a) * r * 0.5, e.y + Math.sin(a) * r * 0.25);
		ctx.lineTo(e.x + Math.cos(a + 0.15) * r, e.y + Math.sin(a + 0.15) * r * 0.5);
	}
	ctx.stroke();
	if (after < 0.35) {
		const k = after / 0.35;
		ctx.globalAlpha = 1 - k;
		ctx.strokeStyle = CORE;
		ctx.lineWidth = 3 * (1 - k) + 1;
		ctx.beginPath();
		ctx.ellipse(e.x, e.y, r * (0.7 + k * 0.6), r * 0.5 * (0.7 + k * 0.6), 0, 0, TAU);
		ctx.stroke();
	}
	ctx.globalAlpha = 1;

	for (const [sx, sy, size] of spireSpots(e.x, e.y, r)) {
		const tall = 92 * size * up * (1 - sink * 0.8);
		const half = 10 * size;
		ctx.save();
		ctx.globalAlpha = 1 - sink;
		ctx.translate(sx, sy);
		// An obelisk: a tapering shaft, a pyramid on top, a band near the base
		const ob = new Path2D();
		ob.moveTo(-half, 0);
		ob.lineTo(-half * 0.7, -tall * 0.82);
		ob.lineTo(0, -tall);
		ob.lineTo(half * 0.7, -tall * 0.82);
		ob.lineTo(half, 0);
		ob.closePath();
		ob.moveTo(-half * 0.92, -tall * 0.15);
		ob.lineTo(half * 0.92, -tall * 0.15);
		ob.moveTo(-half * 0.7, -tall * 0.82);
		ob.lineTo(half * 0.7, -tall * 0.82);
		energy(ctx, ob, { time, edge: 1.7, body: 1.2 });
		// A slit of light up the face
		ctx.strokeStyle = greenCore(0.7);
		ctx.lineWidth = 1.2;
		ctx.beginPath();
		ctx.moveTo(0, -tall * 0.2);
		ctx.lineTo(0, -tall * 0.75);
		ctx.stroke();
		ctx.restore();
	}
	if (after < 0.3) sparks(ctx, e.x, e.y - 30, r * 0.8, 10, time, e.x * 0.01);
	ctx.restore();
}

// ------------------------------------------------------------------ Verdict

/** A slender lance held along +x: butt cap, a long shaft, a winged leaf head. */
function lancePath(): Path2D {
	const p = new Path2D();
	p.arc(-18, 0, 2.5, 0, TAU);
	p.rect(-16, -1.4, 58, 2.8);
	// Wings below the head
	p.moveTo(40, -1.4);
	p.lineTo(36, -7);
	p.lineTo(46, -1.4);
	p.moveTo(40, 1.4);
	p.lineTo(36, 7);
	p.lineTo(46, 1.4);
	// The head: a long leaf
	p.moveTo(44, 0);
	p.quadraticCurveTo(54, -6, 72, 0);
	p.quadraticCurveTo(54, 6, 44, 0);
	p.closePath();
	return p;
}

/** Drawn back, charging: the lance in his hand, rings tightening round the head. */
export function drawVerdictHeld(ctx: CanvasRenderingContext2D, time: number) {
	energy(ctx, lancePath(), { time, edge: 1.4, body: 1.2 });
	ctx.strokeStyle = greenCore(0.6);
	ctx.lineWidth = 1;
	for (let i = 0; i < 2; i++) {
		const k = (time * 1.6 + i * 0.5) % 1;
		ctx.globalAlpha = k;
		ctx.beginPath();
		ctx.ellipse(58, 0, 4 + (1 - k) * 14, 2 + (1 - k) * 9, 0, 0, TAU);
		ctx.stroke();
	}
	ctx.globalAlpha = 1;
}

/** Let go: the lance streaks the whole length of the shot, chevrons left hanging in the air behind it. */
export function drawVerdictShot(ctx: CanvasRenderingContext2D, e: Effect, lift: number, time: number) {
	const t = e.age / e.life;
	const len = e.value ?? 600;
	const a = e.angle ?? 0;
	const hy = e.y - lift;
	const power = 0.5 + 0.5 * (e.radius ?? 1);
	const reach = len * easeOut(Math.min(1, t * 4));
	ctx.translate(e.x, hy);
	ctx.rotate(a);
	ctx.lineCap = 'round';
	// The line it cut: a thin hard core in a soft wash
	ctx.globalAlpha = (1 - t) * power;
	ctx.strokeStyle = green(0.5);
	ctx.lineWidth = 9 * (1 - t) + 2;
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.lineTo(reach, 0);
	ctx.stroke();
	ctx.globalAlpha = 1 - t;
	ctx.strokeStyle = CORE;
	ctx.lineWidth = 1.6;
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.lineTo(reach, 0);
	ctx.stroke();
	// Chevrons, pointing the way it went
	ctx.strokeStyle = greenCore(0.7 * (1 - t));
	ctx.lineWidth = 1.5;
	for (let x = 60; x < reach - 30; x += 70) {
		const s = 6 + t * 8;
		ctx.beginPath();
		ctx.moveTo(x - s, -s);
		ctx.lineTo(x, 0);
		ctx.lineTo(x - s, s);
		ctx.stroke();
	}
	// The lance itself, at the front
	if (t < 0.4) {
		ctx.save();
		ctx.translate(reach - 72, 0);
		energy(ctx, lancePath(), { time, edge: 1.4, alpha: 1 - t * 2 });
		ctx.restore();
	}
}

// ---------------------------------------------------------- Sentinel Blades

/** A dagger along +x: a narrow double-edged blade, a crossguard, a ring pommel. */
function daggerPath(): Path2D {
	const p = new Path2D();
	p.moveTo(22, 0);
	p.lineTo(4, -3);
	p.lineTo(4, 3);
	p.closePath();
	p.rect(2, -6, 2.5, 12);
	p.rect(-6, -1.3, 8, 2.6);
	p.arc(-8.5, 0, 2.5, 0, TAU);
	return p;
}

/** Three daggers circling high over his shoulder, all pointing at what he's fighting. */
export function drawSentinels(ctx: CanvasRenderingContext2D, t: Turret, time: number, space: boolean) {
	const grow = Math.min(1, (t.maxLife - t.life) / 0.25);
	const hover = FLIER_HOVER.wingman[space ? 1 : 0];
	const hurt = t.hp < t.maxHp * 0.4;
	ctx.save();
	ctx.globalAlpha = fadeOf(t, time) * (hurt ? 0.75 : 1);
	if (!space) {
		ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
		ctx.beginPath();
		ctx.ellipse(t.x, t.y, 22, 5, 0, 0, TAU);
		ctx.fill();
	}
	const cy = t.y - hover + Math.sin(time * 2.4 + t.follow!.dx) * 4;
	// The orbit, faint
	ctx.strokeStyle = green(0.25);
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.ellipse(t.x, cy, 26 * grow, 10 * grow, 0, 0, TAU);
	ctx.stroke();
	// The one that just threw a shard is out front, bright
	const fired = t.cooldown > 0.2;
	for (let i = 0; i < 3; i++) {
		const a = time * 2.2 + (i / 3) * TAU;
		const x = t.x + Math.cos(a) * 26 * grow;
		const y = cy + Math.sin(a) * 10 * grow;
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(t.aim);
		ctx.scale(grow, grow);
		energy(ctx, daggerPath(), { time, edge: 1.2, body: 1.2, alpha: Math.sin(a) < 0 ? 0.7 : 1 });
		if (fired && i === 0) {
			ctx.fillStyle = CORE;
			ctx.beginPath();
			ctx.arc(24, 0, 3, 0, TAU);
			ctx.fill();
		}
		ctx.restore();
	}
	ctx.restore();
}

/** A shard thrown by a Sentinel Blade: a thin, bright sliver. */
export function drawShard(ctx: CanvasRenderingContext2D, pr: Projectile, x: number, y: number, lift: number) {
	ctx.save();
	ctx.translate(x, y - lift);
	ctx.rotate(Math.atan2(pr.vy, pr.vx));
	ctx.fillStyle = green(0.35);
	ctx.fillRect(-26, -1.5, 18, 3);
	ctx.fillStyle = CORE;
	ctx.beginPath();
	ctx.moveTo(10, 0);
	ctx.lineTo(-6, -2.4);
	ctx.lineTo(-10, 0);
	ctx.lineTo(-6, 2.4);
	ctx.closePath();
	ctx.fill();
	ctx.strokeStyle = GREEN;
	ctx.lineWidth = 1;
	ctx.stroke();
	ctx.restore();
}

// --------------------------------------------------------------- Honor Guard

/**
 * One of Korugar's honour guard: greaves and a long tabard, a helm with a
 * tall swept crest, a tower shield in front, and a javelin raised to throw.
 */
export function drawHonorGuard(ctx: CanvasRenderingContext2D, t: Turret, time: number, space: boolean) {
	const grow = Math.min(1, (t.maxLife - t.life) / 0.25);
	const facing = Math.cos(t.aim) >= 0 ? 1 : -1;
	const bob = space ? Math.sin(time * 2 + t.follow!.dx) * 3 - 16 : 0;
	const hurt = t.hp < t.maxHp * 0.4;
	ctx.save();
	ctx.globalAlpha = fadeOf(t, time) * (hurt ? 0.75 : 1);
	if (!space) {
		ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
		ctx.beginPath();
		ctx.ellipse(t.x, t.y, 14, 4, 0, 0, TAU);
		ctx.fill();
	}
	ctx.translate(t.x, t.y + bob);
	ctx.scale(facing * grow, grow);

	// The javelin arm, behind the body: drawn back after a throw, then a fresh one forms
	const thrown = t.cooldown > 0.55;
	const aimUp = Math.atan2(Math.sin(t.aim), Math.abs(Math.cos(t.aim)));
	ctx.save();
	ctx.translate(-3, -42);
	ctx.rotate(aimUp - (thrown ? 0.5 : 0.15));
	if (!thrown) {
		const jav = new Path2D();
		jav.rect(-16, -1, 36, 2);
		jav.moveTo(20, -3);
		jav.lineTo(28, 0);
		jav.lineTo(20, 3);
		jav.closePath();
		energy(ctx, jav, { time, edge: 1, body: 1.2 });
	}
	ctx.restore();

	const m = t.march;
	const step = m?.moving ? Math.sin(m.stride) * 4 : 0;
	const body = new Path2D();
	// Greaved legs
	body.roundRect(-7 + step, -20, 5, 20, 2);
	body.roundRect(2 - step, -20, 5, 20, 2);
	// Tabard, flaring at the hem; a breastplate above
	body.moveTo(-8, -22);
	body.lineTo(-6, -40);
	body.lineTo(6, -40);
	body.lineTo(8, -22);
	body.closePath();
	body.roundRect(-8, -44, 16, 8, 3);
	// Helm, cheek guards, and the crest swept back in a long fin
	body.ellipse(0, -51, 6.5, 7, 0, 0, TAU);
	body.moveTo(-5, -50);
	body.lineTo(-5, -45);
	body.moveTo(-2, -58);
	body.quadraticCurveTo(-8, -68, -18, -62);
	body.quadraticCurveTo(-10, -62, -6, -54);
	energy(ctx, body, { time, edge: 1.3, body: 1.3 });

	// Tower shield in front, with the Corps' emblem on it
	const shield = new Path2D();
	shield.moveTo(6, -46);
	shield.lineTo(16, -44);
	shield.lineTo(16, -18);
	shield.quadraticCurveTo(11, -10, 6, -14);
	shield.closePath();
	energy(ctx, shield, { time, edge: 1.3, body: 1.6 });
	ctx.strokeStyle = greenCore(0.7);
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.arc(11, -31, 3.5, 0, TAU);
	ctx.moveTo(8, -36);
	ctx.lineTo(14, -36);
	ctx.moveTo(8, -26);
	ctx.lineTo(14, -26);
	ctx.stroke();
	ctx.restore();
}

/** A javelin thrown by the Honor Guard. */
export function drawJavelin(ctx: CanvasRenderingContext2D, pr: Projectile, x: number, y: number, lift: number, time: number) {
	ctx.save();
	ctx.translate(x, y - lift);
	ctx.rotate(Math.atan2(pr.vy, pr.vx));
	ctx.fillStyle = green(0.3);
	ctx.fillRect(-46, -1.5, 24, 3);
	const jav = new Path2D();
	jav.rect(-22, -1, 30, 2);
	jav.moveTo(8, -3.5);
	jav.lineTo(18, 0);
	jav.lineTo(8, 3.5);
	jav.closePath();
	energy(ctx, jav, { time, edge: 1, body: 1.4 });
	ctx.restore();
}

// ------------------------------------------------------------ Crescent Glaive

/** Two crescents back to back round a grip ring: it spins as it flies. */
function glavePath(r: number): Path2D {
	const p = new Path2D();
	for (const side of [0, Math.PI]) {
		p.moveTo(Math.cos(side - 1.3) * r * 0.45, Math.sin(side - 1.3) * r * 0.45);
		p.arc(0, 0, r * 1.25, side - 1.15, side + 1.15);
		p.quadraticCurveTo(Math.cos(side) * r * 0.9, Math.sin(side) * r * 0.9, Math.cos(side - 1.3) * r * 0.45, Math.sin(side - 1.3) * r * 0.45);
		p.closePath();
	}
	p.moveTo(r * 0.42, 0);
	p.arc(0, 0, r * 0.42, 0, TAU);
	return p;
}

export function drawGlaive(ctx: CanvasRenderingContext2D, pr: Projectile, x: number, y: number, lift: number, time: number) {
	const r = pr.def.radius ?? 20;
	const speed = Math.hypot(pr.vx, pr.vy) || 1;
	ctx.save();
	ctx.translate(x, y - lift);
	// A blur of the spin behind it
	ctx.strokeStyle = green(0.3);
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.arc((-pr.vx / speed) * 8, (-pr.vy / speed) * 8, r * 1.25, 0, TAU);
	ctx.stroke();
	ctx.scale(1, 0.7);
	ctx.rotate(time * 18);
	energy(ctx, glavePath(r), { time, edge: 1.5, body: 1.2 });
	ctx.restore();
}

// ------------------------------------------------------------------- Rebuke

/** Blades thrust up out of the ground in a widening ring round him, then sink back. */
export function drawRebuke(ctx: CanvasRenderingContext2D, e: Effect, time: number) {
	const t = e.age / e.life;
	const r = e.radius ?? 160;
	const ring = r * easeOut(Math.min(1, t * 1.6));
	ctx.save();
	// The ground ring they come up along
	ctx.globalAlpha = 1 - t;
	ctx.strokeStyle = green(0.6);
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.ellipse(e.x, e.y, ring, ring * 0.5, 0, 0, TAU);
	ctx.stroke();
	const blades = 14;
	const order: number[] = [];
	for (let i = 0; i < blades; i++) order.push(i);
	// Back blades first
	order.sort((a, b) => Math.sin((a / blades) * TAU) - Math.sin((b / blades) * TAU));
	for (const i of order) {
		const a = (i / blades) * TAU;
		const bx = e.x + Math.cos(a) * ring;
		const by = e.y + Math.sin(a) * ring * 0.5;
		const k = Math.max(0, Math.min(1, (t - (i % 2) * 0.05) / 0.18));
		const tall = (34 + (i % 3) * 10) * easeOut(k) * (1 - Math.max(0, (t - 0.55) / 0.45));
		if (tall < 1) continue;
		// Leaning out, away from him
		const lean = Math.cos(a) * 0.35;
		ctx.save();
		ctx.translate(bx, by);
		ctx.rotate(lean);
		const blade = new Path2D();
		blade.moveTo(-5, 0);
		blade.lineTo(-1.5, -tall);
		blade.lineTo(0, -tall - 6);
		blade.lineTo(1.5, -tall);
		blade.lineTo(5, 0);
		blade.closePath();
		ctx.fillStyle = green(0.35);
		ctx.fill(blade);
		ctx.strokeStyle = Math.sin(a) > 0 ? CORE : GREEN;
		ctx.lineWidth = 1.4;
		ctx.stroke(blade);
		ctx.restore();
	}
	ctx.restore();
	if (t < 0.3) sparks(ctx, e.x, e.y - 20, ring, 10, time, e.x * 0.02);
}
