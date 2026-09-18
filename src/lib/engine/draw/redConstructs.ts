// Drawing Red Lantern constructs: blasts, saws, barbed chains, slams and roars.
// Same energy language as the green constructs, in angry red and ragged shapes.
// Machines (Manhunters, fighters) fire clean, thin lasers instead.

import { drawFallingHammer, drawHammerWarning } from './corpsConstructs';
import type { Effect } from '../constructs/system';
import { ENEMIES, type Enemy } from '../enemies/enemies';
import type { Obstacle } from '../map';
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
	} else if (s.kind === 'shell') {
		// Rage Cannon shell: a heavy, smoking red ball
		for (let i = 1; i <= 4; i++) {
			ctx.globalAlpha = 0.3 * (1 - i / 5);
			ctx.fillStyle = '#5a1010';
			ctx.beginPath();
			ctx.arc(x - ux * i * 9, dy - uy * i * 9 - i * 1.5, 7 + i, 0, TAU);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
		ctx.translate(x, dy);
		ctx.rotate(time * 6);
		rage(ctx, macePath(6), time, 1.4);
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
		if (s.kind === 'hammer') {
			drawHammerWarning(ctx, s, time);
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
		if (s.kind === 'hammer') drawFallingHammer(ctx, s, time);
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
		case 'redAxe': {
			// A huge jagged battle-axe sweeping across the front, trailing ghosts
			const cy = e.y - lift;
			const aim = e.angle ?? 0;
			const facing = Math.cos(aim) >= 0 ? 1 : -1;
			const sweep = -1.3 + easeOut(Math.min(1, t / 0.5)) * 2.6;
			ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
			for (let ghost = 2; ghost >= 0; ghost--) {
				ctx.save();
				ctx.globalAlpha *= ghost === 0 ? 1 : 0.3 / ghost;
				ctx.translate(e.x, cy);
				ctx.scale(facing, 1);
				ctx.rotate(sweep - ghost * 0.3);
				rage(ctx, axePath(r * 0.9), time);
				ctx.restore();
			}
			break;
		}
		case 'redMace': {
			// A spiked mace raised and brought down on the spot ahead
			const aim = e.angle ?? 0;
			const reach = e.value ?? 55;
			const hx = e.x;
			const hy = e.y - lift;
			const ix = e.x + Math.cos(aim) * reach;
			const iy = e.y + Math.sin(aim) * reach - 6;
			const k = easeOut(Math.min(1, t / 0.35));
			const upX = hx - Math.cos(aim) * 10;
			const upY = hy - 50;
			const mx = upX + (ix - upX) * k;
			const my = upY + (iy - upY) * k;
			ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
			const handle = new Path2D();
			handle.moveTo(hx, hy);
			handle.lineTo(mx, my);
			rage(ctx, handle, time, 2.5);
			ctx.save();
			ctx.translate(mx, my);
			rage(ctx, macePath((e.radius ?? 58) * 0.35), time);
			ctx.restore();
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

// ------------------------------------------------------------ rage constructs
// Red Lanterns build constructs just like the Green Lanterns do, but out of
// rage: a dark, blood-red body with a hot, flickering, jagged edge.

/** Draw a Path2D (positioned by the caller) as red rage energy. */
export function rage(ctx: CanvasRenderingContext2D, path: Path2D, time: number, edge = 2) {
	ctx.save();
	ctx.lineJoin = 'miter';
	ctx.lineCap = 'round';
	const flicker = 0.75 + 0.25 * Math.sin(time * 37);
	// Smouldering outer glow
	ctx.shadowColor = RED;
	ctx.shadowBlur = 16 * flicker;
	ctx.strokeStyle = 'rgba(255, 42, 42, 0.35)';
	ctx.lineWidth = edge * 3.2;
	ctx.stroke(path);
	// Dark, blood-red body
	ctx.shadowBlur = 0;
	ctx.fillStyle = 'rgba(120, 8, 8, 0.55)';
	ctx.fill(path);
	// Hot veins flickering across the inside
	ctx.save();
	ctx.clip(path);
	ctx.strokeStyle = `rgba(255, 120, 90, ${0.35 * flicker})`;
	ctx.lineWidth = 0.8;
	for (let i = 0; i < 3; i++) {
		const y = Math.sin(time * 3 + i * 2.1) * 12;
		ctx.beginPath();
		ctx.moveTo(-60, y);
		for (let x = -60; x <= 60; x += 12) ctx.lineTo(x, y + Math.sin(x * 0.3 + time * 9 + i) * 3);
		ctx.stroke();
	}
	ctx.restore();
	// Jagged bright edge
	ctx.shadowColor = RED;
	ctx.shadowBlur = 8;
	ctx.strokeStyle = RED;
	ctx.lineWidth = edge;
	ctx.stroke(path);
	ctx.shadowBlur = 0;
	ctx.strokeStyle = `rgba(255, 208, 208, ${0.5 * flicker})`;
	ctx.lineWidth = edge * 0.35;
	ctx.stroke(path);
	ctx.restore();
}

/** A battle-axe pointing along +x: haft from the origin, a big bearded blade at the end. */
export function axePath(len: number): Path2D {
	const p = new Path2D();
	p.rect(0, -1.6, len, 3.2);
	const bx = len * 0.78;
	p.moveTo(bx - 6, -2);
	p.lineTo(bx + 4, -len * 0.34);
	p.lineTo(bx + 12, -len * 0.3);
	p.quadraticCurveTo(bx + 20, 0, bx + 12, len * 0.3);
	p.lineTo(bx + 4, len * 0.34);
	p.lineTo(bx - 6, 2);
	p.closePath();
	// A spike on the back
	p.moveTo(bx - 8, -2);
	p.lineTo(bx - 16, -8);
	p.lineTo(bx - 10, 1);
	p.closePath();
	return p;
}

/** A spiked ball, centred on the origin. */
export function macePath(r: number): Path2D {
	const p = new Path2D();
	const spikes = 10;
	for (let i = 0; i < spikes * 2; i++) {
		const a = (i / (spikes * 2)) * TAU;
		const rr = i % 2 === 0 ? r * 1.55 : r;
		if (i === 0) p.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
		else p.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
	}
	p.closePath();
	return p;
}

/** A crude, jagged cannon pointing along +x. */
export function rageCannonPath(): Path2D {
	const p = new Path2D();
	p.moveTo(-6, -8);
	p.lineTo(30, -6);
	p.lineTo(36, -11);
	p.lineTo(38, 0);
	p.lineTo(36, 11);
	p.lineTo(30, 6);
	p.lineTo(-6, 8);
	p.lineTo(-10, 0);
	p.closePath();
	for (const x of [6, 18]) {
		p.moveTo(x, -8);
		p.lineTo(x + 3, -13);
		p.lineTo(x + 6, -7);
	}
	return p;
}

/**
 * A Rage Wall: a row of jagged red crystal spikes standing along its
 * footprint, cracking as it's damaged, flickering before it burns out.
 */
export function drawRageWall(ctx: CanvasRenderingContext2D, o: Obstacle, time: number) {
	const health = o.hp !== undefined && o.maxHp ? o.hp / o.maxHp : 1;
	const age = (o.maxLife ?? 0) - (o.life ?? 0);
	const grow = Math.min(1, age / 0.2);
	const fading = (o.life ?? 99) < 1.5 && Math.sin(time * 30) > 0;
	const along = o.w >= o.h;
	const len = along ? o.w : o.h;
	const cx = o.x + o.w / 2;
	const cy = o.y + o.h / 2;
	// Lying along the screen it shows its face; running up/down it's seen more edge-on
	const count = along ? 7 : 5;
	const p = new Path2D();
	for (let i = 0; i < count; i++) {
		const k = (i + 0.5) / count - 0.5;
		const bx = along ? cx + k * len : cx;
		const by = along ? cy : cy + k * len;
		// Seen edge-on (running up/down the screen) the spikes are lower and even, like a row of stakes
		const tall = (along ? 32 + ((i * 7919 + Math.floor(o.seed * 100)) % 5) * 5 : 26 + (i % 2) * 6) * grow;
		const half = along ? (len / count) * 0.6 : 9;
		p.moveTo(bx - half, by);
		p.lineTo(bx - half * 0.3, by - tall * 0.6);
		p.lineTo(bx, by - tall);
		p.lineTo(bx + half * 0.3, by - tall * 0.55);
		p.lineTo(bx + half, by);
		p.closePath();
	}
	ctx.save();
	ctx.globalAlpha = fading ? 0.4 : 1;
	rage(ctx, p, time + o.seed * 10, 1.6);
	// Cracks as it takes damage
	if (health < 0.7) {
		ctx.strokeStyle = 'rgba(20, 0, 0, 0.8)';
		ctx.lineWidth = 1.2;
		for (let i = 0; i < Math.ceil((1 - health) * 6); i++) {
			const k = ((i * 0.37 + o.seed) % 1) - 0.5;
			const x = along ? cx + k * len : cx;
			const y = along ? cy - 12 : cy + k * len - 12;
			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.lineTo(x + 4, y - 8);
			ctx.lineTo(x - 2, y - 14);
			ctx.stroke();
		}
	}
	ctx.restore();
}

/** A Rage Shield around an enemy: a jagged red bubble that pulses and cracks as it weakens. */
export function drawWard(ctx: CanvasRenderingContext2D, x: number, cy: number, r: number, hpFrac: number, time: number) {
	ctx.save();
	const flicker = 0.7 + 0.3 * Math.sin(time * 20 + x);
	const g = ctx.createRadialGradient(x, cy, r * 0.3, x, cy, r);
	g.addColorStop(0, 'rgba(255, 42, 42, 0)');
	g.addColorStop(1, `rgba(255, 42, 42, ${0.25 * flicker})`);
	ctx.fillStyle = g;
	ctx.beginPath();
	for (let i = 0; i <= 16; i++) {
		const a = (i / 16) * TAU;
		const rr = r * (i % 2 === 0 ? 1 : 0.94);
		ctx.lineTo(x + Math.cos(a) * rr, cy + Math.sin(a) * rr);
	}
	ctx.closePath();
	ctx.fill();
	ctx.shadowColor = RED;
	ctx.shadowBlur = 10;
	ctx.strokeStyle = `rgba(255, 60, 60, ${0.4 + 0.5 * hpFrac})`;
	ctx.lineWidth = 1.5 + hpFrac;
	ctx.stroke();
	ctx.restore();
}

/**
 * A Rage Turret: a black-and-red spiked tower (in space it floats on a
 * jagged base) with a barrel that swings toward its target.
 */
export function drawRageTurret(ctx: CanvasRenderingContext2D, e: Enemy, x: number, y: number, hasGround: boolean, time: number) {
	const b = e.brain;
	const defeated = e.hp <= 0 || e.down > 0;
	const burningOut = b.lifeLeft < 2 && Math.sin(time * 25) > 0;
	ctx.save();
	ctx.globalAlpha = defeated ? Math.min(1, e.down / 0.5) : burningOut ? 0.5 : 1;
	if (hasGround) {
		ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
		ctx.beginPath();
		ctx.ellipse(x, y, 16, 5, 0, 0, TAU);
		ctx.fill();
	}
	ctx.translate(x, y - (hasGround ? 0 : 8 + Math.sin(time * 2) * 2));
	ctx.scale(1.35, 1.35);
	// Spiked base and tower
	const tower = new Path2D();
	tower.moveTo(-14, 0);
	tower.lineTo(-18, -8);
	tower.lineTo(-9, -6);
	tower.lineTo(-7, -36);
	tower.lineTo(-12, -44);
	tower.lineTo(0, -40);
	tower.lineTo(12, -44);
	tower.lineTo(7, -36);
	tower.lineTo(9, -6);
	tower.lineTo(18, -8);
	tower.lineTo(14, 0);
	tower.closePath();
	ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#1c0707';
	ctx.fill(tower);
	rage(ctx, tower, time + x, 1.4);
	// The Red Lantern emblem on the front
	ctx.fillStyle = '#120404';
	ctx.beginPath();
	ctx.arc(0, -22, 4, 0, TAU);
	ctx.fill();
	ctx.strokeStyle = RED;
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.arc(0, -22, 2.8, 0, TAU);
	ctx.stroke();
	// Barrel, swinging toward what it aims at, glowing hot when it's about to fire
	const aim = Math.atan2(b.aimY, b.aimX);
	const hot = b.state === 'windup' || b.state === 'act';
	ctx.save();
	ctx.translate(0, -44);
	ctx.rotate(aim);
	if (Math.cos(aim) < 0) ctx.scale(1, -1);
	const barrel = new Path2D();
	barrel.moveTo(-6, -5);
	barrel.lineTo(16, -3);
	barrel.lineTo(20, -6);
	barrel.lineTo(20, 6);
	barrel.lineTo(16, 3);
	barrel.lineTo(-6, 5);
	barrel.closePath();
	rage(ctx, barrel, time, hot ? 2 : 1.3);
	if (hot) {
		ctx.shadowColor = RED;
		ctx.shadowBlur = 14;
		ctx.fillStyle = HOT;
		ctx.beginPath();
		ctx.arc(20, 0, 2.5 + Math.sin(time * 40), 0, TAU);
		ctx.fill();
	}
	ctx.restore();
	ctx.restore();
}
