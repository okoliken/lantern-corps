// Sinestro's yellow constructs (enemies/fear.ts): solid, glowing, and built
// to frighten. The hounds, the rotary cannon and its rounds, the hand up out
// of the ground, the executioner's frame and blade, and the impalers.

import type { ConstructWorld } from '../constructs/system';
import type { Enemy } from '../enemies/enemies';
import { BLADE, GATLING, HAND, IMPALE, fearOf, type Blade, type Gun, type Hand, type ImpaleLine } from '../enemies/fear';
import type { RedShot } from '../enemies/redConstructs';

const TAU = Math.PI * 2;
const GLOW = '#ffd23a';
const EDGE = '#fff1a6';
/** How tall a hound stands (for its health bar and tells). */
export const FEAR_HOUND_TOP = 80;

const fill = (a: number) => `rgba(255, 212, 58, ${a})`;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** The look every yellow construct shares: a body of light with a bright edge and a glow round it. */
function construct(ctx: CanvasRenderingContext2D, alpha: number, blur = 16) {
	ctx.fillStyle = fill(0.42 * alpha);
	ctx.strokeStyle = `rgba(255, 241, 166, ${alpha})`;
	ctx.lineWidth = 3;
	ctx.lineJoin = 'round';
	ctx.shadowColor = GLOW;
	ctx.shadowBlur = blur * alpha;
}

/** `hand`: where an enemy's ring hand is drawn (the gun hangs from it). */
export function drawFearWorld(ctx: CanvasRenderingContext2D, w: ConstructWorld, hand: (e: Enemy) => [number, number], time: number) {
	const f = fearOf(w);
	for (const l of f.lines) drawImpalers(ctx, l);
	for (const h of f.hands) drawHand(ctx, h, time);
	for (const b of f.blades) drawExecutioner(ctx, b, time);
	for (const g of f.guns) drawGatling(ctx, g, ...hand(g.owner), time);
}

// ------------------------------------------------------------------ gatling

/** A rotary cannon of Korugar hanging beside him: a drum, a housing, six barrels turning, flame at the muzzle. */
function drawGatling(ctx: CanvasRenderingContext2D, g: Gun, x: number, y: number, time: number) {
	const appear = easeOut(clamp01(g.age / 0.15));
	ctx.save();
	ctx.translate(x + Math.cos(g.angle) * 14, y + Math.sin(g.angle) * 14);
	ctx.rotate(g.angle);
	if (Math.cos(g.angle) < 0) ctx.scale(1, -1);
	ctx.scale(appear, appear);
	construct(ctx, 1);
	// Ammo drum under the housing, and the belt into it
	ctx.beginPath();
	ctx.arc(-8, 16, 13, 0, TAU);
	ctx.fill();
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(-8, 16, 5, 0, TAU);
	ctx.stroke();
	// Housing, with a grip and a spine
	ctx.beginPath();
	ctx.moveTo(-24, -10);
	ctx.lineTo(14, -12);
	ctx.lineTo(20, -7);
	ctx.lineTo(20, 7);
	ctx.lineTo(14, 12);
	ctx.lineTo(-24, 10);
	ctx.lineTo(-30, 0);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(-22, -4);
	ctx.lineTo(12, -5);
	ctx.stroke();
	ctx.shadowBlur = 0;
	// Six barrels round a turning axis: the ones in front drawn brighter
	const turn = time * 40 * g.spin;
	const barrels = Array.from({ length: 6 }, (_, k) => {
		const a = turn + (k * TAU) / 6;
		return { off: Math.sin(a) * 7, depth: Math.cos(a) };
	}).sort((p, q) => p.depth - q.depth);
	for (const b of barrels) {
		ctx.strokeStyle = `rgba(255, 241, 166, ${0.45 + 0.5 * (b.depth + 1) / 2})`;
		ctx.lineWidth = 4;
		ctx.beginPath();
		ctx.moveTo(20, b.off);
		ctx.lineTo(GATLING.reach, b.off);
		ctx.stroke();
	}
	// Collars round the barrels
	ctx.strokeStyle = EDGE;
	ctx.lineWidth = 2.5;
	for (const cx of [26, GATLING.reach - 4]) {
		ctx.beginPath();
		ctx.ellipse(cx, 0, 3, 10, 0, 0, TAU);
		ctx.stroke();
	}
	// Flame at the muzzle as each round goes
	if (g.spin >= 1 && g.next > GATLING.gap * 0.5) {
		ctx.fillStyle = 'rgba(255, 250, 220, 0.95)';
		ctx.shadowBlur = 20;
		ctx.beginPath();
		const r = 9 + Math.random() * 6;
		for (let k = 0; k < 8; k++) {
			const a = (k * TAU) / 8;
			const rr = k % 2 ? r * 0.4 : r;
			ctx.lineTo(GATLING.reach + 6 + Math.cos(a) * rr, Math.sin(a) * rr);
		}
		ctx.closePath();
		ctx.fill();
	}
	ctx.restore();
}

/** A gatling round: a short hot streak along its flight. */
export function drawFearShot(ctx: CanvasRenderingContext2D, s: RedShot, x: number, y: number, lift: number) {
	const v = Math.hypot(s.vx, s.vy) || 1;
	const ux = s.vx / v;
	const uy = s.vy / v;
	ctx.save();
	ctx.lineCap = 'round';
	ctx.shadowColor = GLOW;
	ctx.shadowBlur = 10;
	ctx.strokeStyle = fill(0.9);
	ctx.lineWidth = 5;
	ctx.beginPath();
	ctx.moveTo(x - ux * 22, y - lift - uy * 22);
	ctx.lineTo(x, y - lift);
	ctx.stroke();
	ctx.strokeStyle = '#fffbe6';
	ctx.lineWidth = 2;
	ctx.stroke();
	ctx.restore();
}

// --------------------------------------------------------------- the hand

/** A giant gauntlet up out of the ground: open claws rising while you can still get clear, then a fist. */
function drawHand(ctx: CanvasRenderingContext2D, h: Hand, time: number) {
	const rise = easeOut(clamp01(h.age / HAND.rise));
	const fade = h.gone >= 0 ? 1 - h.gone / HAND.linger : 1;
	ctx.save();
	// Where it comes up: the ground splitting in a ring, tighter as it rises
	if (!h.closed) {
		ctx.strokeStyle = `rgba(255, 210, 58, ${0.5 + 0.4 * rise})`;
		ctx.lineWidth = 3;
		ctx.setLineDash([10, 7]);
		ctx.lineDashOffset = -time * 40;
		ctx.beginPath();
		ctx.ellipse(h.x, h.y, h.radius, h.radius * 0.42, 0, 0, TAU);
		ctx.stroke();
		ctx.setLineDash([]);
		ctx.fillStyle = `rgba(255, 210, 58, ${0.12 + 0.18 * rise})`;
		ctx.fill();
	}
	ctx.translate(h.x, h.y);
	construct(ctx, fade);
	if (!h.closed || (h.gone >= 0 && !h.caught && h.age < HAND.rise + 0.1)) {
		// Open, rising: a broad palm and five clawed fingers spread up out of the ground
		const top = -40 - 80 * rise;
		ctx.beginPath();
		ctx.moveTo(-50, 0);
		ctx.quadraticCurveTo(-58, top * 0.5, -40, top);
		ctx.lineTo(40, top);
		ctx.quadraticCurveTo(58, top * 0.5, 50, 0);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
		for (let k = 0; k < 5; k++) {
			const a = -Math.PI / 2 + (k - 2) * 0.42;
			const bx = (k - 2) * 20;
			const len = (k === 0 || k === 4 ? 46 : 62) * rise + 8;
			const curl = Math.sin(time * 8 + k) * 0.06;
			const tipX = bx + Math.cos(a + curl) * len;
			const tipY = top + Math.sin(a + curl) * len;
			ctx.beginPath();
			ctx.moveTo(bx - 8, top + 2);
			ctx.quadraticCurveTo(bx - 9 + (tipX - bx) * 0.5, top + (tipY - top) * 0.5, tipX, tipY);
			ctx.quadraticCurveTo(bx + 9 + (tipX - bx) * 0.5, top + (tipY - top) * 0.5, bx + 8, top + 2);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
		}
		// A gem of Korugar in the palm
		ctx.fillStyle = `rgba(255, 250, 220, ${0.8 * fade})`;
		ctx.beginPath();
		ctx.arc(0, top * 0.55, 7, 0, TAU);
		ctx.fill();
	} else {
		// Closed: a great fist round whoever it caught, squeezing
		const squeeze = h.caught ? 1 + Math.sin(time * 18) * 0.04 : 1;
		ctx.scale(squeeze, 2 - squeeze);
		ctx.beginPath();
		ctx.moveTo(-58, 0);
		ctx.lineTo(-62, -96);
		ctx.quadraticCurveTo(-60, -132, -30, -134);
		ctx.lineTo(34, -134);
		ctx.quadraticCurveTo(64, -130, 62, -96);
		ctx.lineTo(58, 0);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
		// Knuckles across the top, fingers down the front, the thumb wrapped over
		ctx.shadowBlur = 0;
		for (let k = 0; k < 4; k++) {
			const kx = -45 + k * 30;
			ctx.beginPath();
			ctx.arc(kx, -126, 13, Math.PI, TAU);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(kx - 13, -118);
			ctx.lineTo(kx - 13, -64);
			ctx.stroke();
		}
		ctx.beginPath();
		ctx.moveTo(-62, -70);
		ctx.quadraticCurveTo(-10, -50, 30, -78);
		ctx.stroke();
	}
	ctx.restore();
}

// ------------------------------------------------------------ executioner

/** A guillotine frame over where you're going: the strip it'll cut on the ground, then the blade coming down. */
function drawExecutioner(ctx: CanvasRenderingContext2D, b: Blade, time: number) {
	const k = clamp01(b.age / BLADE.fall);
	const fade = b.fallen ? 1 - (b.age - BLADE.fall) / BLADE.after : easeOut(clamp01(b.age / 0.2));
	const H = 240;
	ctx.save();
	// The strip it cuts, filling as the blade comes
	if (!b.fallen) {
		ctx.fillStyle = `rgba(255, 120, 40, ${0.12 + 0.25 * k})`;
		ctx.fillRect(b.x - b.half, b.y - BLADE.depth, b.half * 2, BLADE.depth * 2);
		ctx.strokeStyle = `rgba(255, 210, 58, ${0.6 + 0.3 * Math.sin(time * 20)})`;
		ctx.lineWidth = 2;
		ctx.setLineDash([12, 8]);
		ctx.strokeRect(b.x - b.half, b.y - BLADE.depth, b.half * 2, BLADE.depth * 2);
		ctx.setLineDash([]);
	}
	construct(ctx, fade);
	// Two posts and the beam across the top
	for (const side of [-1, 1]) {
		const px = b.x + side * (b.half + 14);
		ctx.beginPath();
		ctx.rect(px - 8, b.y - H, 16, H);
		ctx.fill();
		ctx.stroke();
	}
	ctx.beginPath();
	ctx.rect(b.x - b.half - 26, b.y - H - 18, b.half * 2 + 52, 20);
	ctx.fill();
	ctx.stroke();
	// The blade, slanted, dropping fast at the end
	const drop = b.fallen ? 1 : k * k * k;
	const top = b.y - H + 6 + drop * (H - 52);
	ctx.fillStyle = fill(0.62 * fade);
	ctx.beginPath();
	ctx.moveTo(b.x - b.half, top);
	ctx.lineTo(b.x + b.half, top);
	ctx.lineTo(b.x + b.half, top + 30);
	ctx.lineTo(b.x - b.half, top + 52);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	// Its edge, bright
	ctx.strokeStyle = `rgba(255, 252, 230, ${fade})`;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(b.x + b.half, top + 30);
	ctx.lineTo(b.x - b.half, top + 52);
	ctx.stroke();
	ctx.restore();
}

// --------------------------------------------------------------- impalers

/** A crack running out along the ground, and spikes tearing up out of it one after another. */
function drawImpalers(ctx: CanvasRenderingContext2D, l: ImpaleLine) {
	const live = l.spikes.filter((s) => Number.isFinite(s.at));
	if (live.length === 0) return;
	const end = live[live.length - 1];
	ctx.save();
	ctx.strokeStyle = `rgba(255, 200, 50, ${clamp01(l.age / 0.2) * 0.7})`;
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.moveTo(live[0].x - l.ux * 30, live[0].y - l.uy * 30);
	live.forEach((s, i) => ctx.lineTo(s.x + (i % 2 ? 6 : -6) * l.uy, s.y - (i % 2 ? 6 : -6) * l.ux));
	ctx.lineTo(end.x, end.y);
	ctx.stroke();
	for (const s of live) {
		const t = l.age - s.at;
		if (t < 0) continue;
		const up = t < IMPALE.life * 0.6 ? easeOut(clamp01(t / 0.08)) : 1 - (t - IMPALE.life * 0.6) / (IMPALE.life * 0.4);
		if (up <= 0) continue;
		const h = 90 * up;
		construct(ctx, Math.min(1, up * 1.4), 12);
		// Two blades of a spike, the back one darker, so it reads as solid
		ctx.beginPath();
		ctx.moveTo(s.x - 16, s.y);
		ctx.lineTo(s.x + 4, s.y - h);
		ctx.lineTo(s.x + 14, s.y);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = `rgba(184, 138, 16, ${0.5 * up})`;
		ctx.beginPath();
		ctx.moveTo(s.x + 4, s.y - h);
		ctx.lineTo(s.x + 14, s.y);
		ctx.lineTo(s.x + 2, s.y - 4);
		ctx.closePath();
		ctx.fill();
	}
	ctx.restore();
}

// ------------------------------------------------------------------ hound

/** A Fear Hound: a great yellow hunting beast, spined along its back, jaws that open as it lunges. */
export function drawFearHound(ctx: CanvasRenderingContext2D, e: Enemy, x: number, y: number, hasGround: boolean, time: number) {
	const b = e.brain;
	const speed = Math.hypot(e.vx, e.vy);
	const run = time * (6 + speed / 22);
	const stride = Math.min(1, speed / 160);
	const biting = b.ability === 'fangs' && (b.state === 'windup' || b.state === 'act');
	const jaw = biting ? (b.state === 'act' ? 0.15 : 0.55 + 0.1 * Math.sin(time * 30)) : 0.12;
	// Fades in when built, and out as it burns away
	const born = clamp01((16 - b.lifeLeft) / 0.3);
	const dying = e.down > 0 ? clamp01(1 - e.down) : clamp01(b.lifeLeft / 0.8);
	const alpha = Math.min(born, dying, 1);
	if (alpha <= 0) return;
	ctx.save();
	if (hasGround) {
		ctx.fillStyle = `rgba(0, 0, 0, ${0.3 * alpha})`;
		ctx.beginPath();
		ctx.ellipse(x, y, 38, 9, 0, 0, TAU);
		ctx.fill();
	}
	ctx.translate(x, y);
	ctx.scale(e.dir, 1);
	construct(ctx, alpha, e.flash > 0 ? 18 : 8);
	if (e.flash > 0) ctx.fillStyle = `rgba(255, 250, 220, ${0.75 * alpha})`;
	const bob = Math.abs(Math.sin(run)) * 3 * stride;
	// Legs: far pair first, near pair after the body
	const leg = (hx: number, phase: number) => {
		const a = Math.sin(run + phase) * 0.6 * stride;
		const kx = hx + Math.sin(a) * 14;
		ctx.beginPath();
		ctx.moveTo(hx - 5, -30 - bob);
		ctx.lineTo(kx - 3, -14);
		ctx.lineTo(kx + Math.sin(a) * 10 - 2, 0);
		ctx.lineTo(kx + Math.sin(a) * 10 + 8, 0);
		ctx.lineTo(kx + 5, -14);
		ctx.lineTo(hx + 7, -30 - bob);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
	};
	leg(-22, Math.PI);
	leg(20, 0);
	// Tail, whipping
	ctx.beginPath();
	ctx.moveTo(-34, -40 - bob);
	ctx.quadraticCurveTo(-56, -52 - bob, -64 + Math.sin(time * 9) * 4, -62 - bob);
	ctx.lineWidth = 5;
	ctx.stroke();
	ctx.lineWidth = 3;
	// Body: deep chest, tucked waist
	ctx.beginPath();
	ctx.moveTo(-38, -40 - bob);
	ctx.quadraticCurveTo(-30, -56 - bob, 0, -54 - bob);
	ctx.quadraticCurveTo(24, -58 - bob, 34, -48 - bob);
	ctx.quadraticCurveTo(34, -28 - bob, 18, -24 - bob);
	ctx.quadraticCurveTo(-6, -32 - bob, -30, -28 - bob);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	// Spines down the back
	ctx.shadowBlur = 0;
	for (let k = 0; k < 5; k++) {
		const sx = -26 + k * 12;
		const sy = -54 - bob + Math.abs(k - 2) * 1.5;
		ctx.beginPath();
		ctx.moveTo(sx - 4, sy + 2);
		ctx.lineTo(sx + 2, sy - 12 + Math.abs(k - 2) * 2);
		ctx.lineTo(sx + 6, sy + 2);
		ctx.stroke();
	}
	// Head, low and forward, ears swept back
	ctx.save();
	ctx.translate(36, -48 - bob);
	ctx.rotate(biting ? -0.15 : 0.08);
	ctx.beginPath();
	ctx.moveTo(-8, -10);
	ctx.lineTo(-16, -26);
	ctx.lineTo(-2, -14);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	// Skull and upper jaw
	ctx.beginPath();
	ctx.moveTo(-6, -12);
	ctx.quadraticCurveTo(10, -16, 32, -6);
	ctx.lineTo(34, 0);
	ctx.lineTo(-4, 4);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	// Lower jaw, hinged open
	ctx.save();
	ctx.translate(-2, 4);
	ctx.rotate(jaw);
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.lineTo(30, 0);
	ctx.lineTo(26, 7);
	ctx.lineTo(2, 8);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.strokeStyle = `rgba(255, 252, 230, ${alpha})`;
	ctx.lineWidth = 1.5;
	for (let k = 0; k < 4; k++) {
		ctx.beginPath();
		ctx.moveTo(8 + k * 6, 0);
		ctx.lineTo(10 + k * 6, -5);
		ctx.stroke();
	}
	ctx.restore();
	// Eye: a dark slit
	ctx.shadowBlur = 0;
	ctx.fillStyle = `rgba(40, 24, 0, ${alpha})`;
	ctx.beginPath();
	ctx.ellipse(10, -8, 4, 1.8, -0.2, 0, TAU);
	ctx.fill();
	ctx.restore();
	ctx.fillStyle = fill(0.42 * alpha);
	if (e.flash > 0) ctx.fillStyle = `rgba(255, 250, 220, ${0.75 * alpha})`;
	leg(-14, 0);
	leg(28, Math.PI);
	ctx.restore();
}

