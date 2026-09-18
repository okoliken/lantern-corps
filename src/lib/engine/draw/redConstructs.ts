// Drawing Red Lantern constructs: blasts, saws, barbed chains, slams and roars.
// Same energy language as the green constructs, in angry red and ragged shapes.
// Machines (Manhunters, fighters) fire clean, thin lasers instead.

import type { Effect } from '../constructs/system';
import { ENEMIES } from '../enemies/enemies';
import type { RedBeam, RedCage, RedPuddle, RedShot, RedStrike } from '../enemies/redConstructs';
import { drawSawShape } from './enemies';

const RED = '#ff2a2a';
/** Manhunter lasers and force. */
const AMBER = '#ffb040';
const HOT = '#ffd0d0';
const TAU = Math.PI * 2;
const easeOut = (k: number) => 1 - (1 - k) ** 3;

export function drawRedShot(ctx: CanvasRenderingContext2D, s: RedShot, x: number, y: number, lift: number, time: number) {
	const dy = y - lift;
	const speed = Math.hypot(s.vx, s.vy) || 1;
	const ux = s.vx / speed;
	const uy = s.vy / speed;
	ctx.save();

	if (s.kind === 'saw') {
		drawSawShape(ctx, x, dy, 9, time * 22);
	} else if (s.kind === 'spear') {
		// A long jagged lance with a flickering tail
		ctx.translate(x, dy);
		ctx.rotate(Math.atan2(uy, ux));
		ctx.shadowColor = RED;
		ctx.shadowBlur = 10;
		const tail = ctx.createLinearGradient(-34, 0, 0, 0);
		tail.addColorStop(0, 'rgba(255, 42, 42, 0)');
		tail.addColorStop(1, 'rgba(255, 42, 42, 0.7)');
		ctx.fillStyle = tail;
		ctx.fillRect(-34, -1.2, 34, 2.4);
		ctx.fillStyle = RED;
		ctx.beginPath();
		ctx.moveTo(14, 0);
		ctx.lineTo(2, -4.5);
		ctx.lineTo(4, -1.2);
		ctx.lineTo(-10, -1.6);
		ctx.lineTo(-10, 1.6);
		ctx.lineTo(4, 1.2);
		ctx.lineTo(2, 4.5);
		ctx.closePath();
		ctx.fill();
		ctx.fillStyle = HOT;
		ctx.fillRect(-6, -0.6, 14, 1.2);
	} else if (s.kind === 'skull') {
		drawSkull(ctx, x, dy, ux, uy, time);
	} else if (s.kind === 'plasma') {
		// A burning blob of napalm, wobbling as it flies
		const r = 4 + Math.sin(time * 30 + x) * 1;
		ctx.shadowColor = RED;
		ctx.shadowBlur = 12;
		ctx.fillStyle = 'rgba(255, 60, 30, 0.85)';
		ctx.beginPath();
		ctx.ellipse(x, dy, r * 1.4, r, Math.atan2(uy, ux), 0, TAU);
		ctx.fill();
		ctx.fillStyle = '#ffb070';
		ctx.beginPath();
		ctx.arc(x, dy, r * 0.45, 0, TAU);
		ctx.fill();
	} else if (s.kind === 'orb') {
		// A red sphere with cage bars turning inside it
		ctx.translate(x, dy);
		ctx.shadowColor = RED;
		ctx.shadowBlur = 14;
		ctx.fillStyle = 'rgba(255, 42, 42, 0.35)';
		ctx.beginPath();
		ctx.arc(0, 0, 9, 0, TAU);
		ctx.fill();
		ctx.strokeStyle = RED;
		ctx.lineWidth = 1.6;
		ctx.beginPath();
		ctx.arc(0, 0, 9, 0, TAU);
		ctx.stroke();
		for (let i = 0; i < 3; i++) {
			const k = Math.cos(time * 6 + (i * Math.PI) / 3);
			ctx.beginPath();
			ctx.ellipse(0, 0, Math.abs(k) * 9, 9, 0, 0, TAU);
			ctx.stroke();
		}
	} else if (s.kind === 'laser') {
		// A thin, bright laser bolt: amber from Manhunters, red from Red Lantern fighters
		const color = ENEMIES[s.owner.kind].faction === 'manhunter' ? AMBER : RED;
		ctx.translate(x, dy);
		ctx.rotate(Math.atan2(uy, ux));
		ctx.shadowColor = color;
		ctx.shadowBlur = 10;
		ctx.strokeStyle = color;
		ctx.lineCap = 'round';
		ctx.lineWidth = 3.5;
		ctx.beginPath();
		ctx.moveTo(-26, 0);
		ctx.lineTo(4, 0);
		ctx.stroke();
		ctx.shadowBlur = 0;
		ctx.strokeStyle = '#fff4e8';
		ctx.lineWidth = 1.3;
		ctx.beginPath();
		ctx.moveTo(-20, 0);
		ctx.lineTo(3, 0);
		ctx.stroke();
	} else if (s.kind === 'hook') {
		ctx.translate(x, dy);
		ctx.rotate(Math.atan2(uy, ux));
		ctx.shadowColor = RED;
		ctx.shadowBlur = 10;
		ctx.strokeStyle = RED;
		ctx.lineWidth = 2.5;
		ctx.lineCap = 'round';
		// A barbed hook: a point with two curved barbs
		ctx.beginPath();
		ctx.moveTo(-6, 0);
		ctx.lineTo(7, 0);
		ctx.moveTo(7, 0);
		ctx.quadraticCurveTo(1, -2, -2, -7);
		ctx.moveTo(7, 0);
		ctx.quadraticCurveTo(1, 2, -2, 7);
		ctx.stroke();
	} else {
		// Rage Blast: a ragged, flickering bolt with a smoky red wake
		ctx.translate(x, dy);
		ctx.rotate(Math.atan2(uy, ux));
		const wake = ctx.createLinearGradient(-30, 0, 0, 0);
		wake.addColorStop(0, 'rgba(255, 42, 42, 0)');
		wake.addColorStop(1, 'rgba(255, 42, 42, 0.6)');
		ctx.fillStyle = wake;
		ctx.beginPath();
		ctx.moveTo(-30, Math.sin(time * 40) * 2);
		ctx.lineTo(0, -5);
		ctx.lineTo(0, 5);
		ctx.closePath();
		ctx.fill();
		ctx.shadowColor = RED;
		ctx.shadowBlur = 14;
		ctx.fillStyle = RED;
		ctx.beginPath();
		for (let i = 0; i < 10; i++) {
			const a = (i / 10) * TAU;
			const r = (i % 2 === 0 ? 7 : 4.5) + Math.sin(time * 50 + i) * 0.8;
			ctx.lineTo(Math.cos(a) * r * 1.3, Math.sin(a) * r * 0.8);
		}
		ctx.closePath();
		ctx.fill();
		ctx.fillStyle = HOT;
		ctx.beginPath();
		ctx.ellipse(1, 0, 3.5, 2, 0, 0, TAU);
		ctx.fill();
	}
	ctx.restore();
}

function drawSkull(ctx: CanvasRenderingContext2D, x: number, y: number, ux: number, uy: number, time: number) {
	// Smoky wake
	for (let i = 1; i <= 5; i++) {
		ctx.globalAlpha = 0.3 * (1 - i / 6);
		ctx.fillStyle = RED;
		ctx.beginPath();
		ctx.arc(x - ux * i * 6, y - uy * i * 6 + Math.sin(time * 20 + i) * 1.5, 6 - i * 0.8, 0, TAU);
		ctx.fill();
	}
	ctx.globalAlpha = 1;
	ctx.translate(x, y);
	ctx.scale(ux < 0 ? -1 : 1, 1);
	ctx.shadowColor = RED;
	ctx.shadowBlur = 12;
	ctx.fillStyle = RED;
	ctx.beginPath();
	ctx.arc(0, -1, 7, Math.PI * 0.9, Math.PI * 2.1);
	ctx.lineTo(5, 4);
	ctx.lineTo(3, 7);
	ctx.lineTo(-3, 7);
	ctx.lineTo(-5, 4);
	ctx.closePath();
	ctx.fill();
	ctx.shadowBlur = 0;
	ctx.fillStyle = '#2a0000';
	ctx.beginPath();
	ctx.arc(-2.5, 0, 1.8, 0, TAU);
	ctx.arc(3, 0, 1.8, 0, TAU);
	ctx.fill();
	ctx.fillStyle = HOT;
	ctx.beginPath();
	ctx.arc(3, 0, 0.8, 0, TAU);
	ctx.fill();
}

/** Ground layer: burning puddles, and circles where meteors are about to land. */
export function drawRedGround(ctx: CanvasRenderingContext2D, puddles: readonly RedPuddle[], strikes: readonly RedStrike[], time: number) {
	for (const pd of puddles) {
		const fade = Math.min(1, pd.life / 0.6) * Math.min(1, (pd.maxLife - pd.life) / 0.15 + 0.3);
		ctx.save();
		ctx.globalAlpha = fade;
		const g = ctx.createRadialGradient(pd.x, pd.y, 2, pd.x, pd.y, pd.radius);
		g.addColorStop(0, 'rgba(255, 170, 80, 0.8)');
		g.addColorStop(0.5, 'rgba(255, 50, 30, 0.6)');
		g.addColorStop(1, 'rgba(120, 0, 0, 0)');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.ellipse(pd.x, pd.y, pd.radius, pd.radius * 0.55, 0, 0, TAU);
		ctx.fill();
		// Bubbles and licks of flame
		ctx.fillStyle = '#ffb070';
		for (let i = 0; i < 3; i++) {
			const k = (time * 1.5 + i / 3 + pd.x * 0.01) % 1;
			const bx = pd.x + Math.cos(i * 2.1 + pd.y) * pd.radius * 0.5;
			ctx.globalAlpha = fade * (1 - k);
			ctx.beginPath();
			ctx.ellipse(bx, pd.y - k * 14, 1.6, 2.6 * (1 - k) + 0.5, 0, 0, TAU);
			ctx.fill();
		}
		ctx.restore();
	}
	for (const s of strikes) {
		if (s.kind === 'bomb') {
			drawBomb(ctx, s, time);
			continue;
		}
		if (s.kind !== 'meteor') continue;
		const k = 1 - s.delay / s.warning;
		ctx.save();
		ctx.strokeStyle = RED;
		ctx.lineWidth = 2;
		ctx.globalAlpha = 0.9;
		ctx.setLineDash([7, 5]);
		ctx.lineDashOffset = -time * 40;
		ctx.beginPath();
		ctx.ellipse(s.x, s.y, s.radius, s.radius * 0.55, 0, 0, TAU);
		ctx.stroke();
		ctx.setLineDash([]);
		ctx.fillStyle = `rgba(255, 42, 42, ${0.1 + 0.3 * k})`;
		ctx.beginPath();
		ctx.ellipse(s.x, s.y, s.radius * k, s.radius * 0.55 * k, 0, 0, TAU);
		ctx.fill();
		ctx.restore();
	}
}

/** A rage bomb dropped by a fighter: falls, lands, blinks faster and faster, then goes off. */
function drawBomb(ctx: CanvasRenderingContext2D, s: RedStrike, time: number) {
	const k = 1 - s.delay / s.warning;
	const fall = Math.max(0, 1 - k / 0.3); // first 30%: dropping from the ship
	ctx.save();
	// Danger ring on the ground
	ctx.strokeStyle = RED;
	ctx.globalAlpha = 0.35 + 0.5 * k;
	ctx.lineWidth = 1.5;
	ctx.setLineDash([5, 4]);
	ctx.beginPath();
	ctx.ellipse(s.x, s.y, s.radius, s.radius * 0.55, 0, 0, TAU);
	ctx.stroke();
	ctx.setLineDash([]);
	// The bomb itself, blinking faster as it's about to blow
	const blink = Math.sin(time * (10 + 40 * k)) > 0;
	const by = s.y - 4 - fall * 50;
	ctx.globalAlpha = 1;
	ctx.fillStyle = '#2a0606';
	ctx.beginPath();
	ctx.ellipse(s.x, by, 5, 4, 0, 0, TAU);
	ctx.fill();
	ctx.shadowColor = RED;
	ctx.shadowBlur = blink ? 12 : 0;
	ctx.fillStyle = blink ? HOT : RED;
	ctx.beginPath();
	ctx.arc(s.x, by - 1, 1.8, 0, TAU);
	ctx.fill();
	ctx.restore();
}

/** Falling meteors: a burning rock streaking down in the last moments before it lands. */
export function drawFallingMeteors(ctx: CanvasRenderingContext2D, strikes: readonly RedStrike[], time: number) {
	const FALL = 0.4;
	for (const s of strikes) {
		if (s.kind !== 'meteor' || s.delay > FALL) continue;
		const k = 1 - s.delay / FALL; // 0 high up .. 1 landing
		const height = (1 - k) * 420;
		const mx = s.x + (1 - k) * 160;
		const my = s.y - height;
		ctx.save();
		const trail = ctx.createLinearGradient(mx + 60, my - 150, mx, my);
		trail.addColorStop(0, 'rgba(255, 42, 42, 0)');
		trail.addColorStop(1, 'rgba(255, 120, 60, 0.85)');
		ctx.strokeStyle = trail;
		ctx.lineWidth = 9;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(mx + 60, my - 150);
		ctx.lineTo(mx, my);
		ctx.stroke();
		ctx.shadowColor = RED;
		ctx.shadowBlur = 20;
		ctx.fillStyle = RED;
		ctx.beginPath();
		for (let i = 0; i < 9; i++) {
			const a = (i / 9) * TAU + time * 3;
			const r = (i % 2 ? 9 : 13) * (0.8 + 0.2 * k);
			ctx.lineTo(mx + Math.cos(a) * r, my + Math.sin(a) * r);
		}
		ctx.closePath();
		ctx.fill();
		ctx.fillStyle = HOT;
		ctx.beginPath();
		ctx.arc(mx, my, 5, 0, TAU);
		ctx.fill();
		ctx.restore();
	}
}

/** A Rage Beam from the enemy's hand: a hot core in a ragged, flickering red ray. */
export function drawRedBeam(ctx: CanvasRenderingContext2D, bm: RedBeam, hx: number, hy: number, time: number) {
	const len = bm.length;
	if (len < 4) return;
	if (bm.style === 'laser') {
		drawLaserBeam(ctx, len, bm.angle, hx, hy, time);
		return;
	}
	ctx.save();
	ctx.translate(hx, hy);
	ctx.rotate(bm.angle);
	ctx.lineCap = 'round';
	ctx.shadowColor = RED;
	ctx.shadowBlur = 18;
	ctx.strokeStyle = 'rgba(255, 42, 42, 0.45)';
	ctx.lineWidth = 16 + Math.sin(time * 40) * 3;
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.lineTo(len, 0);
	ctx.stroke();
	ctx.strokeStyle = RED;
	ctx.lineWidth = 7;
	ctx.beginPath();
	ctx.moveTo(0, 0);
	for (let d = 20; d < len; d += 20) ctx.lineTo(d, Math.sin(time * 50 + d * 0.3) * 2.5);
	ctx.lineTo(len, 0);
	ctx.stroke();
	ctx.shadowBlur = 0;
	ctx.strokeStyle = HOT;
	ctx.lineWidth = 2.5;
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.lineTo(len, 0);
	ctx.stroke();
	// Burning splash where it hits
	ctx.fillStyle = HOT;
	ctx.shadowColor = RED;
	ctx.shadowBlur = 16;
	ctx.beginPath();
	ctx.arc(len, 0, 6 + Math.sin(time * 35) * 2, 0, TAU);
	ctx.fill();
	ctx.restore();
}

/** A Manhunter Laser Sweep: a thin, steady amber line, nothing like the ragged Rage Beam. */
function drawLaserBeam(ctx: CanvasRenderingContext2D, len: number, angle: number, hx: number, hy: number, time: number) {
	ctx.save();
	ctx.translate(hx, hy);
	ctx.rotate(angle);
	ctx.lineCap = 'round';
	ctx.shadowColor = AMBER;
	ctx.shadowBlur = 12;
	ctx.strokeStyle = 'rgba(255, 176, 64, 0.35)';
	ctx.lineWidth = 7 + Math.sin(time * 60) * 1;
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.lineTo(len, 0);
	ctx.stroke();
	ctx.strokeStyle = AMBER;
	ctx.lineWidth = 2.6;
	ctx.stroke();
	ctx.shadowBlur = 0;
	ctx.strokeStyle = '#fff4e0';
	ctx.lineWidth = 1;
	ctx.stroke();
	ctx.fillStyle = '#fff4e0';
	ctx.shadowColor = AMBER;
	ctx.shadowBlur = 12;
	ctx.beginPath();
	ctx.arc(len, 0, 3.5 + Math.sin(time * 45) * 1, 0, TAU);
	ctx.fill();
	ctx.restore();
}

/** A Rage Prison around a Lantern: red bars, glowing and closing in. `top` is the top of their head. */
export function drawRedCage(ctx: CanvasRenderingContext2D, c: RedCage, x: number, feetY: number, top: number, time: number) {
	const k = Math.min(1, (c.maxTime - c.time) / 0.15);
	const fade = Math.min(1, c.time / 0.2);
	const w = 30;
	const h = feetY - top + 16;
	const y0 = feetY + 4 - h * k;
	ctx.save();
	ctx.globalAlpha = fade;
	ctx.shadowColor = RED;
	ctx.shadowBlur = 12;
	ctx.strokeStyle = RED;
	ctx.lineWidth = 2.2;
	for (let i = 0; i <= 5; i++) {
		const bx = x - w + (i * 2 * w) / 5;
		ctx.beginPath();
		ctx.moveTo(bx, feetY + 4);
		ctx.lineTo(bx + Math.sin(time * 20 + i) * 0.8, y0);
		ctx.stroke();
	}
	ctx.lineWidth = 3;
	for (const yy of [feetY + 4, y0]) {
		ctx.beginPath();
		ctx.ellipse(x, yy, w, 6, 0, 0, TAU);
		ctx.stroke();
	}
	ctx.restore();
}

/** A barbed red chain between two points, twitching with tension. */
export function drawRedChain(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, time: number) {
	const dx = x2 - x1;
	const dy = y2 - y1;
	const len = Math.hypot(dx, dy);
	if (len < 2) return;
	const nx = -dy / len;
	const ny = dx / len;
	const links = Math.max(2, Math.floor(len / 9));
	ctx.save();
	ctx.shadowColor = RED;
	ctx.shadowBlur = 8;
	ctx.strokeStyle = RED;
	ctx.lineWidth = 1.8;
	for (let i = 0; i < links; i++) {
		const k = (i + 0.5) / links;
		const jitter = Math.sin(time * 35 + i * 1.7) * 1.2;
		const cx = x1 + dx * k + nx * jitter;
		const cy = y1 + dy * k + ny * jitter;
		ctx.beginPath();
		ctx.ellipse(cx, cy, 4, 2.2, Math.atan2(dy, dx) + (i % 2 ? Math.PI / 2 : 0), 0, TAU);
		ctx.stroke();
		// Barbs on every third link
		if (i % 3 === 1) {
			ctx.beginPath();
			ctx.moveTo(cx, cy);
			ctx.lineTo(cx + nx * 5 - (dx / len) * 3, cy + ny * 5 - (dy / len) * 3);
			ctx.stroke();
		}
	}
	ctx.restore();
}

/** Red construct effects. `lift` is the effect's own height above the ground. */
export function drawRedEffect(ctx: CanvasRenderingContext2D, e: Effect, lift: number, time: number) {
	const t = e.age / e.life;
	const r = e.radius ?? 60;
	switch (e.kind) {
		case 'slamMark': {
			// Where the Rage Slam will land: a ring that fills in as it falls
			ctx.globalAlpha = 0.9;
			ctx.strokeStyle = RED;
			ctx.lineWidth = 2;
			ctx.setLineDash([8, 6]);
			ctx.lineDashOffset = -time * 30;
			ctx.beginPath();
			ctx.ellipse(e.x, e.y, r, r * 0.55, 0, 0, TAU);
			ctx.stroke();
			ctx.setLineDash([]);
			ctx.fillStyle = `rgba(255, 42, 42, ${0.12 + 0.25 * t})`;
			ctx.beginPath();
			ctx.ellipse(e.x, e.y, r * t, r * 0.55 * t, 0, 0, TAU);
			ctx.fill();
			break;
		}
		case 'redBlast': {
			// Slam impact: a cracked red shockwave on the ground
			const k = easeOut(t);
			ctx.globalAlpha = 1 - t;
			ctx.shadowColor = RED;
			ctx.shadowBlur = 16;
			ctx.strokeStyle = t < 0.2 ? HOT : RED;
			ctx.lineWidth = 5 * (1 - t) + 1;
			ctx.beginPath();
			ctx.ellipse(e.x, e.y, r * (0.4 + 0.8 * k), r * 0.55 * (0.4 + 0.8 * k), 0, 0, TAU);
			ctx.stroke();
			ctx.lineWidth = 2;
			for (let i = 0; i < 8; i++) {
				const a = (i / 8) * TAU + 0.3;
				ctx.beginPath();
				ctx.moveTo(e.x + Math.cos(a) * r * 0.2, e.y + Math.sin(a) * r * 0.11);
				ctx.lineTo(e.x + Math.cos(a) * r * k, e.y + Math.sin(a) * r * 0.55 * k);
				ctx.stroke();
			}
			break;
		}
		case 'pulse': {
			// Manhunter repulse: clean, even rings of amber force (machines, not rage)
			const k = easeOut(t);
			const cy = e.y - lift;
			ctx.shadowColor = AMBER;
			ctx.shadowBlur = 14;
			for (let ring = 0; ring < 3; ring++) {
				const rk = Math.max(0, k - ring * 0.12);
				ctx.globalAlpha = (1 - t) * (1 - ring * 0.3);
				ctx.strokeStyle = ring === 0 && t < 0.25 ? '#fff4d6' : AMBER;
				ctx.lineWidth = 3 * (1 - t) + 0.8;
				ctx.beginPath();
				ctx.ellipse(e.x, cy, r * rk, r * 0.55 * rk, 0, 0, TAU);
				ctx.stroke();
			}
			break;
		}
		case 'roar': {
			// Jagged rings of fury bursting outward
			const k = easeOut(t);
			const cy = e.y - lift;
			ctx.shadowColor = RED;
			ctx.shadowBlur = 18;
			for (let ring = 0; ring < 2; ring++) {
				const rk = Math.max(0, k - ring * 0.18);
				ctx.globalAlpha = (1 - t) * (ring === 0 ? 1 : 0.6);
				ctx.strokeStyle = ring === 0 && t < 0.25 ? HOT : RED;
				ctx.lineWidth = 4 * (1 - t) + 1;
				ctx.beginPath();
				for (let i = 0; i <= 24; i++) {
					const a = (i / 24) * TAU;
					const jag = i % 2 === 0 ? 1 : 0.88;
					ctx.lineTo(e.x + Math.cos(a) * r * rk * jag, cy + Math.sin(a) * r * 0.55 * rk * jag);
				}
				ctx.stroke();
			}
			break;
		}
		case 'scythe': {
			// A giant crescent blade whipping all the way round
			const cy = e.y - lift;
			const spin = (e.angle ?? 0) + easeOut(t) * TAU * 1.1;
			ctx.shadowColor = RED;
			ctx.shadowBlur = 16;
			for (let ghost = 0; ghost < 4; ghost++) {
				const a = spin - ghost * 0.45;
				ctx.globalAlpha = (1 - t) * (1 - ghost * 0.22);
				ctx.fillStyle = ghost === 0 && t < 0.3 ? HOT : RED;
				ctx.beginPath();
				ctx.ellipse(e.x, cy, r, r * 0.55, 0, a - 0.9, a);
				ctx.ellipse(e.x, cy, r * 0.72, r * 0.4, 0, a - 0.1, a - 0.8, true);
				ctx.closePath();
				ctx.fill();
			}
			break;
		}
		case 'spikeBurst': {
			// Jagged spikes jutting out of the ground, then crumbling
			const up = t < 0.2 ? easeOut(t / 0.2) : 1 - Math.max(0, (t - 0.55) / 0.45);
			ctx.shadowColor = RED;
			ctx.shadowBlur = 10;
			ctx.fillStyle = t < 0.15 ? HOT : RED;
			for (let i = -2; i <= 2; i++) {
				const bx = e.x + i * r * 0.32;
				const h = (26 - Math.abs(i) * 7) * up * (r / 30);
				ctx.beginPath();
				ctx.moveTo(bx - 5, e.y);
				ctx.lineTo(bx + i * 1.5, e.y - h);
				ctx.lineTo(bx + 5, e.y);
				ctx.closePath();
				ctx.fill();
			}
			ctx.globalAlpha = 0.5 * (1 - t);
			ctx.strokeStyle = RED;
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.ellipse(e.x, e.y, r, r * 0.5, 0, 0, TAU);
			ctx.stroke();
			break;
		}
		case 'redTrail': {
			// Afterimage streak left by a Rage Charge
			const a = e.angle ?? 0;
			ctx.globalAlpha = 0.5 * (1 - t);
			ctx.strokeStyle = RED;
			ctx.shadowColor = RED;
			ctx.shadowBlur = 10;
			ctx.lineCap = 'round';
			ctx.lineWidth = 10 * (1 - t);
			ctx.beginPath();
			ctx.moveTo(e.x, e.y - lift);
			ctx.lineTo(e.x - Math.cos(a) * 30, e.y - lift - Math.sin(a) * 30);
			ctx.stroke();
			break;
		}
		case 'redImpact': {
			ctx.globalAlpha = 1 - t;
			ctx.shadowColor = RED;
			ctx.shadowBlur = 12;
			ctx.fillStyle = t < 0.3 ? HOT : RED;
			const size = 4 + 10 * easeOut(t);
			ctx.beginPath();
			for (let i = 0; i < 10; i++) {
				const a = (i / 10) * TAU;
				const rr = i % 2 === 0 ? size : size * 0.4;
				ctx.lineTo(e.x + Math.cos(a) * rr, e.y - lift + Math.sin(a) * rr);
			}
			ctx.closePath();
			ctx.fill();
			break;
		}
	}
}
