// The constructs of the Green Lanterns you spar with, in the same green
// energy as your own (see energy() in constructs.ts): Kilowog's hammers and
// giant fist, Sinestro's sword and blades. Rules in enemies/corpsConstructs.ts.

import type { Effect } from '../constructs/system';
import type { Enemy } from '../enemies/enemies';
import { ABILITIES, type RedShot, type RedStrike } from '../enemies/redConstructs';
import { energy, fistPath, sparks, swordPath } from './constructs';
import { GREEN } from './lantern';
import { green, greenLight, greenCore } from '../../theme';

const TAU = Math.PI * 2;
const easeOut = (k: number) => 1 - (1 - k) ** 3;

/** A war hammer, head centred on the origin, handle hanging down along +y. `size` is the head's width. */
function hammerPath(size: number): Path2D {
	const p = new Path2D();
	p.roundRect(-size * 0.5, -size * 0.3, size, size * 0.6, size * 0.08);
	// Striking faces
	p.rect(-size * 0.6, -size * 0.36, size * 0.1, size * 0.72);
	p.rect(size * 0.5, -size * 0.36, size * 0.1, size * 0.72);
	// Handle and grip
	p.rect(-size * 0.07, size * 0.3, size * 0.14, size * 1.25);
	p.rect(-size * 0.1, size * 1.4, size * 0.2, size * 0.2);
	return p;
}

/** A hammer drawn at (x, y), turned by `angle` (0 = head up, handle down). */
function hammerAt(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, angle: number, time: number, alpha = 1) {
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(angle);
	energy(ctx, hammerPath(size), { time, edge: Math.max(2, size / 22), alpha });
	ctx.restore();
}

// ---------------------------------------------------------------- windups

/**
 * The construct forming in the hand during the windup, so you can see what's
 * coming: the Giant Hammer growing overhead, a fist, a sword, a fan of blades.
 */
export function drawCorpsWindup(ctx: CanvasRenderingContext2D, e: Enemy, hand: [number, number], top: number, time: number) {
	const b = e.brain;
	if (b.state !== 'windup' || !b.ability) return;
	const a = ABILITIES[b.ability];
	const k = Math.min(1, 1 - b.timer / a.windup);
	const [hx, hy] = hand;
	const aim = Math.atan2(b.aimY, b.aimX);
	const facing = b.aimX >= 0 ? 1 : -1;
	switch (b.ability) {
		case 'bigHammer':
			// Raised high over his head, growing as he winds up
			hammerAt(ctx, hx - facing * 10, top - 30 - k * 20, 40 + 60 * k, -facing * (0.3 + 0.4 * k), time);
			break;
		case 'hammerSpin':
			hammerAt(ctx, hx + facing * 22, hy - 10, 46, facing * (1.2 + k), time);
			break;
		case 'hammerThrow':
			hammerAt(ctx, hx - facing * 14, hy - 26, 36 + 10 * k, -facing * (0.6 + 0.8 * k), time);
			break;
		case 'hammerRain':
			// Hammers gathering in the sky above him
			for (let i = 0; i < 3; i++) hammerAt(ctx, hx + (i - 1) * 34, top - 50 - i * 8, 24 * k + 8, Math.PI + (i - 1) * 0.2, time, 0.4 + 0.6 * k);
			break;
		case 'bigFist':
			ctx.save();
			ctx.translate(hx, hy);
			ctx.rotate(aim);
			energy(ctx, fistPath(20 + 26 * k), { time, edge: 2.4 });
			ctx.restore();
			break;
		case 'sword':
			ctx.save();
			ctx.translate(hx, hy);
			ctx.rotate(aim - facing * (1.2 - 0.6 * k));
			energy(ctx, swordPath(60 + 20 * k), { time, edge: 2 });
			ctx.restore();
			break;
		case 'bladeFan':
			ctx.save();
			ctx.translate(hx, hy);
			for (let i = -3; i <= 3; i++) {
				ctx.save();
				ctx.rotate(aim + i * 0.11 * k);
				energy(ctx, swordPath(30 + 8 * k), { time, edge: 1.4, alpha: 0.5 + 0.5 * k });
				ctx.restore();
			}
			ctx.restore();
			break;
		case 'bladeStorm': {
			// A ring of blades turning around him, pointing out
			ctx.save();
			ctx.translate(e.x, (hy + top) / 2);
			for (let i = 0; i < 16; i++) {
				ctx.save();
				ctx.rotate((i / 16) * TAU + time * 3);
				ctx.translate(28 + 20 * k, 0);
				energy(ctx, swordPath(22), { time, edge: 1.2, alpha: k });
				ctx.restore();
			}
			ctx.restore();
			break;
		}
	}
}

// ------------------------------------------------------------ projectiles

/** Thrown hammers, giant fists and blades in flight. */
export function drawCorpsShot(ctx: CanvasRenderingContext2D, s: RedShot, x: number, y: number, lift: number, time: number) {
	const dy = y - lift;
	const angle = Math.atan2(s.vy, s.vx);
	ctx.save();
	if (s.kind === 'hammer') {
		// Spinning end over end
		hammerAt(ctx, x, dy, 44, time * 16, time);
	} else if (s.kind === 'fist') {
		// The fist, and a fading arm of energy behind it
		ctx.translate(x, dy);
		ctx.rotate(angle);
		const trail = ctx.createLinearGradient(-90, 0, 0, 0);
		trail.addColorStop(0, green(0));
		trail.addColorStop(1, green(0.45));
		ctx.fillStyle = trail;
		ctx.fillRect(-90, -12, 90, 24);
		energy(ctx, fistPath(48), { time, edge: 2.6 });
	} else {
		ctx.translate(x, dy);
		ctx.rotate(angle);
		energy(ctx, swordPath(34), { time, edge: 1.5 });
	}
	ctx.restore();
}

// ------------------------------------------------------------ hammer drop

/** Where a hammer will land: a green ring filling in. */
export function drawHammerWarning(ctx: CanvasRenderingContext2D, s: RedStrike, time: number) {
	const k = 1 - s.delay / s.warning;
	ctx.save();
	ctx.strokeStyle = GREEN;
	ctx.lineWidth = 2;
	ctx.globalAlpha = 0.9;
	ctx.setLineDash([7, 5]);
	ctx.lineDashOffset = -time * 40;
	ctx.beginPath();
	ctx.ellipse(s.x, s.y, s.radius, s.radius * 0.55, 0, 0, TAU);
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.fillStyle = green(0.08 + 0.25 * k);
	ctx.beginPath();
	ctx.ellipse(s.x, s.y, s.radius * k, s.radius * 0.55 * k, 0, 0, TAU);
	ctx.fill();
	ctx.restore();
}

/** A hammer falling out of the sky in its last moment. */
export function drawFallingHammer(ctx: CanvasRenderingContext2D, s: RedStrike, time: number) {
	const FALL = 0.35;
	if (s.delay > FALL) return;
	const k = 1 - s.delay / FALL;
	hammerAt(ctx, s.x, s.y - (1 - k) * 380 - 30, 54, Math.PI, time);
}

// ---------------------------------------------------------------- effects

export function drawCorpsEffect(ctx: CanvasRenderingContext2D, e: Effect, lift: number, time: number) {
	const t = e.age / e.life;
	const r = e.radius ?? 100;
	ctx.save();
	switch (e.kind) {
		case 'bigHammer': {
			// The hammer comes down from overhead onto the spot ahead, then the ground shakes
			const a = e.angle ?? 0;
			const reach = e.value ?? 95;
			const ix = e.x + Math.cos(a) * reach;
			const iy = e.y + Math.sin(a) * reach;
			const facing = Math.cos(a) >= 0 ? 1 : -1;
			const swing = easeOut(Math.min(1, t / 0.15));
			const hx = e.x - facing * 20 + (ix - e.x + facing * 20) * swing;
			// Head over, then down onto the ground; the handle ends up pointing back up at his hand
			const hy = e.y - lift - 150 + (iy - 25 - (e.y - lift - 150)) * swing;
			hammerAt(ctx, hx, hy, 100, facing * (-0.5 + swing * Math.PI * 0.85), time, Math.max(0, 1 - Math.max(0, t - 0.5) / 0.5));
			if (swing >= 1) {
				const k = (t - 0.15) / 0.85;
				shockwave(ctx, ix, iy, r, k, 1);
				shockwave(ctx, ix, iy, r + 80, Math.min(1, k * 1.3), 0.5);
				cracks(ctx, ix, iy, r, k, e.x + e.y);
				sparks(ctx, ix, iy - 20, r * 0.8, 18, time, e.x);
			}
			break;
		}
		case 'hammerSpin': {
			// Two hammers whirling around him on long handles, with a blur of the circle
			const a = e.angle ?? 0;
			const cy = e.y - lift;
			ctx.strokeStyle = green(0.25);
			ctx.lineWidth = 10;
			ctx.beginPath();
			ctx.ellipse(e.x, cy, r, r * 0.45, 0, 0, TAU);
			ctx.stroke();
			for (const side of [0, Math.PI]) {
				const ang = a + side;
				const x = e.x + Math.cos(ang) * r * 0.85;
				const y = cy + Math.sin(ang) * r * 0.38;
				hammerAt(ctx, x, y, 40, ang + Math.PI / 2, time);
			}
			break;
		}
		case 'hammerDrop': {
			shockwave(ctx, e.x, e.y, r, t, 1);
			cracks(ctx, e.x, e.y, r * 0.8, t, e.x);
			hammerAt(ctx, e.x, e.y - 30, 54, Math.PI, time, 1 - t);
			break;
		}
		case 'swordArc': {
			// A bright crescent where the blade passed (value = 1: a full ring)
			const a = e.angle ?? 0;
			const full = e.value === 1;
			const cy = e.y - lift;
			ctx.globalAlpha = 1 - t;
			ctx.shadowColor = GREEN;
			ctx.shadowBlur = 16;
			ctx.strokeStyle = greenCore(0.9);
			ctx.lineWidth = 5 * (1 - t) + 1;
			ctx.beginPath();
			if (full) ctx.ellipse(e.x, cy, r * (0.6 + t * 0.8), r * 0.45 * (0.6 + t * 0.8), 0, 0, TAU);
			else ctx.ellipse(e.x, cy, r, r * 0.55, 0, a - 1.1, a - 1.1 + 2.2 * easeOut(Math.min(1, t * 3)));
			ctx.stroke();
			ctx.strokeStyle = GREEN;
			ctx.lineWidth = 2;
			ctx.stroke();
			break;
		}
	}
	ctx.restore();
}

/** An expanding ring on the ground. */
function shockwave(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, k: number, strength: number) {
	if (k <= 0 || k >= 1) return;
	ctx.save();
	ctx.globalAlpha = (1 - k) * strength;
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 14;
	ctx.strokeStyle = GREEN;
	ctx.lineWidth = 6 * (1 - k) + 1;
	ctx.beginPath();
	ctx.ellipse(x, y, r * (0.3 + 0.7 * easeOut(k)), r * 0.55 * (0.3 + 0.7 * easeOut(k)), 0, 0, TAU);
	ctx.stroke();
	ctx.restore();
}

/** Glowing cracks in the ground from an impact. */
function cracks(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, k: number, seed: number) {
	ctx.save();
	ctx.globalAlpha = Math.max(0, 1 - k);
	ctx.strokeStyle = greenLight(0.8);
	ctx.lineWidth = 2;
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 8;
	for (let i = 0; i < 7; i++) {
		const a = (i / 7) * TAU + seed;
		const len = r * (0.6 + 0.4 * Math.abs(Math.sin(seed + i * 3.1)));
		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.lineTo(x + Math.cos(a) * len * 0.5 + Math.sin(i) * 6, y + Math.sin(a) * len * 0.5 * 0.55);
		ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len * 0.55);
		ctx.stroke();
	}
	ctx.restore();
}
