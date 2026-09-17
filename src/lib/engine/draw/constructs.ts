// Drawing for everything the construct system puts in the world:
// projectiles, chains, traps, slashes, punches, shockwaves, damage numbers,
// the minigun/cannon in the hand, and the training dummies.
//
// Constructs are made of ring energy, so they share one look: bright green
// outlines with a soft glow and a pale core.

import type { Effect, Projectile, Trap } from '../constructs/system';
import { DUMMY_HP, isStanding, type Dummy } from '../dummy';
import { GREEN } from './lantern';

const CORE = '#eafff0';

function glow(ctx: CanvasRenderingContext2D, blur = 12) {
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = blur;
}

// ------------------------------------------------------------ in the hand

/**
 * A construct held at the ring: the minigun while it's spinning, the cannon
 * right after it fires. (x, y) is the ring in world space.
 */
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
	glow(ctx);
	ctx.strokeStyle = GREEN;
	ctx.fillStyle = 'rgba(61, 255, 110, 0.18)';
	ctx.lineWidth = 2;

	if (shape === 'minigun') {
		// Body, then barrels that appear to spin
		ctx.fillRect(-4, -7, 16, 14);
		ctx.strokeRect(-4, -7, 16, 14);
		const spin = time * 40;
		for (let i = 0; i < 3; i++) {
			const off = Math.sin(spin + (i * Math.PI * 2) / 3) * 4;
			ctx.beginPath();
			ctx.moveTo(12, off);
			ctx.lineTo(34, off);
			ctx.stroke();
		}
	} else if (shape === 'cannon') {
		ctx.fillRect(-6, -9, 36, 18);
		ctx.strokeRect(-6, -9, 36, 18);
		ctx.beginPath();
		ctx.arc(-6, 0, 11, Math.PI / 2, (Math.PI * 3) / 2);
		ctx.stroke();
		ctx.strokeRect(30, -11, 6, 22);
	}
	ctx.restore();
}

// ------------------------------------------------------------ projectiles

/** Projectiles live on the ground plane; `lift` raises them to hand height for drawing. */
export function drawProjectile(ctx: CanvasRenderingContext2D, pr: Projectile, x: number, y: number, lift: number) {
	const dy = y - lift;
	ctx.save();
	glow(ctx, pr.kind === 'shell' ? 20 : 10);

	if (pr.kind === 'bullet') {
		// A short streak pointing the way it's going
		const len = Math.hypot(pr.vx, pr.vy) || 1;
		ctx.strokeStyle = CORE;
		ctx.lineWidth = 2.5;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(x - (pr.vx / len) * 12, dy - (pr.vy / len) * 12);
		ctx.lineTo(x, dy);
		ctx.stroke();
	} else if (pr.kind === 'shell') {
		ctx.fillStyle = GREEN;
		ctx.beginPath();
		ctx.arc(x, dy, 9, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = CORE;
		ctx.beginPath();
		ctx.arc(x, dy, 4, 0, Math.PI * 2);
		ctx.fill();
	} else {
		drawHook(ctx, x, dy, Math.atan2(pr.vy, pr.vx));
	}
	ctx.restore();
}

function drawHook(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number) {
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(angle);
	ctx.strokeStyle = GREEN;
	ctx.lineWidth = 2.5;
	ctx.beginPath();
	ctx.moveTo(-6, 0);
	ctx.lineTo(4, 0);
	ctx.moveTo(4, 0);
	ctx.quadraticCurveTo(10, -8, 2, -9);
	ctx.moveTo(4, 0);
	ctx.quadraticCurveTo(10, 8, 2, 9);
	ctx.stroke();
	ctx.restore();
}

/** A chain of links between two points. */
export function drawChain(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
	const len = Math.hypot(x2 - x1, y2 - y1);
	const angle = Math.atan2(y2 - y1, x2 - x1);
	const links = Math.max(1, Math.floor(len / 9));
	ctx.save();
	glow(ctx, 8);
	ctx.strokeStyle = GREEN;
	ctx.lineWidth = 1.8;
	for (let i = 0; i < links; i++) {
		const t = (i + 0.5) / links;
		ctx.save();
		ctx.translate(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t);
		ctx.rotate(angle);
		ctx.beginPath();
		// Alternate flat and edge-on links, like a real chain
		if (i % 2 === 0) ctx.ellipse(0, 0, 5, 3, 0, 0, Math.PI * 2);
		else ctx.moveTo(-5, 0), ctx.lineTo(5, 0);
		ctx.stroke();
		ctx.restore();
	}
	ctx.restore();
}

// ------------------------------------------------------------------ traps

export function drawTrap(ctx: CanvasRenderingContext2D, t: Trap, time: number) {
	const pulse = 0.6 + 0.4 * Math.sin(time * 5);
	ctx.save();
	glow(ctx, 8);
	ctx.strokeStyle = `rgba(61, 255, 110, ${0.5 * pulse + 0.2})`;
	ctx.lineWidth = 2;
	// Base ring on the ground
	ctx.beginPath();
	ctx.ellipse(t.x, t.y, t.radius, t.radius * 0.45, 0, 0, Math.PI * 2);
	ctx.stroke();
	// Short bars poking up: the cage waiting to close
	for (let i = 0; i < 10; i++) {
		const a = (i / 10) * Math.PI * 2;
		const bx = t.x + Math.cos(a) * t.radius;
		const by = t.y + Math.sin(a) * t.radius * 0.45;
		ctx.beginPath();
		ctx.moveTo(bx, by);
		ctx.lineTo(bx, by - 8 * pulse);
		ctx.stroke();
	}
	ctx.restore();
}

/** Full cage around something that's been caught. (x, y) is its base. */
function drawCageBars(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
	const w = 26;
	const h = 58;
	ctx.save();
	glow(ctx, 10);
	ctx.strokeStyle = GREEN;
	ctx.lineWidth = 2;
	ctx.fillStyle = `rgba(61, 255, 110, ${0.08 + 0.04 * Math.sin(time * 6)})`;
	ctx.fillRect(x - w, y - h, w * 2, h);
	ctx.strokeRect(x - w, y - h, w * 2, h);
	for (let i = 1; i < 5; i++) {
		const bx = x - w + (i * w * 2) / 5;
		ctx.beginPath();
		ctx.moveTo(bx, y - h);
		ctx.lineTo(bx, y);
		ctx.stroke();
	}
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
		ctx.ellipse(x, y, 12, 4, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = '#6b4a2a';
		ctx.fillRect(x - 3, y - 8, 6, 8);
		ctx.strokeStyle = 'rgba(216, 245, 224, 0.4)';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(x, y - 30, 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - d.down / 3));
		ctx.stroke();
		ctx.restore();
		return;
	}

	const bob = onGround ? 0 : Math.sin(time * 2 + d.homeX) * 3 - 8;
	if (onGround) {
		ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
		ctx.beginPath();
		ctx.ellipse(x, y, 13, 4, 0, 0, Math.PI * 2);
		ctx.fill();
		// Post
		ctx.fillStyle = '#6b4a2a';
		ctx.fillRect(x - 3, y - 24, 6, 24);
	}

	const cy = y - 38 + bob;
	// Straw body
	ctx.fillStyle = d.flash > 0 ? '#ffffff' : '#c9a55a';
	ctx.beginPath();
	ctx.ellipse(x, cy, 12, 16, 0, 0, Math.PI * 2);
	ctx.fill();
	// Bullseye
	const rings = d.flash > 0 ? ['#ffffff', '#ffffff', '#ffffff'] : ['#d23a3a', '#f3efe2', '#d23a3a'];
	[9, 6, 3].forEach((r, i) => {
		ctx.fillStyle = rings[i];
		ctx.beginPath();
		ctx.arc(x, cy, r, 0, Math.PI * 2);
		ctx.fill();
	});
	// Head
	ctx.fillStyle = d.flash > 0 ? '#ffffff' : '#b8934a';
	ctx.beginPath();
	ctx.arc(x, cy - 22, 7, 0, Math.PI * 2);
	ctx.fill();

	// Health bar once it's been hurt
	if (d.hp < DUMMY_HP) {
		ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
		ctx.fillRect(x - 16, cy - 38, 32, 4);
		ctx.fillStyle = '#e8c86a';
		ctx.fillRect(x - 16, cy - 38, 32 * (d.hp / DUMMY_HP), 4);
	}
	ctx.restore();

	if (d.caged > 0) drawCageBars(ctx, x, y + (onGround ? 0 : bob), time);
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
			// A crescent sweeping across the aim direction
			const r = e.radius ?? 70;
			const a = e.angle ?? 0;
			const sweep = -0.95 + t * 1.9;
			ctx.globalAlpha = 1 - t;
			glow(ctx, 16);
			ctx.strokeStyle = GREEN;
			ctx.lineCap = 'round';
			ctx.lineWidth = 10 * (1 - t) + 2;
			ctx.beginPath();
			ctx.arc(e.x, e.y - lift, r * 0.85, a - 0.95, a + sweep);
			ctx.stroke();
			// The blade itself at the leading edge
			const bx = e.x + Math.cos(a + sweep) * r;
			const by = e.y - lift + Math.sin(a + sweep) * r;
			ctx.strokeStyle = CORE;
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.moveTo(e.x + Math.cos(a + sweep) * 14, e.y - lift + Math.sin(a + sweep) * 14);
			ctx.lineTo(bx, by);
			ctx.stroke();
			break;
		}
		case 'fist': {
			// Winds up close to the body, then punches out and fades
			const windup = e.life - 0.25;
			const out = e.age < windup ? 0.15 : Math.min(1, (e.age - windup) / 0.08);
			const fade = e.age < windup ? 1 : 1 - (e.age - windup) / 0.25;
			const reach = 18 + out * 55;
			drawFist(ctx, e.x, e.y - lift, e.angle ?? 0, reach, (e.radius ?? 40) * (0.6 + out * 0.4), Math.max(0, fade));
			break;
		}
		case 'shockwave':
		case 'blast': {
			const r = (e.radius ?? 100) * (0.2 + t * 0.8);
			ctx.globalAlpha = 1 - t;
			glow(ctx, 20);
			ctx.strokeStyle = GREEN;
			ctx.lineWidth = (e.kind === 'blast' ? 8 : 6) * (1 - t) + 1;
			ctx.beginPath();
			ctx.ellipse(e.x, e.y - (e.kind === 'blast' ? lift : 0), r, r * (e.kind === 'blast' ? 1 : 0.5), 0, 0, Math.PI * 2);
			ctx.stroke();
			if (e.kind === 'blast') {
				ctx.fillStyle = `rgba(234, 255, 240, ${0.6 * (1 - t)})`;
				ctx.beginPath();
				ctx.arc(e.x, e.y - lift, r * 0.5, 0, Math.PI * 2);
				ctx.fill();
			}
			break;
		}
		case 'burst': {
			// Splinters flying out and a flash
			ctx.globalAlpha = 1 - t;
			ctx.strokeStyle = GREEN;
			ctx.lineWidth = 3 * (1 - t);
			ctx.beginPath();
			ctx.arc(e.x, e.y, 8 + t * 40, 0, Math.PI * 2);
			ctx.stroke();
			ctx.fillStyle = '#8a6636';
			for (let i = 0; i < 9; i++) {
				const a = (i / 9) * Math.PI * 2 + i;
				const d = t * (30 + (i % 3) * 14);
				ctx.fillRect(e.x + Math.cos(a) * d - 3, e.y + Math.sin(a) * d * 0.6 - Math.sin(t * Math.PI) * 14 - 1.5, 6, 3);
			}
			break;
		}
		case 'fizzle': {
			// A construct dissolving into green sparks
			ctx.globalAlpha = 1 - t;
			glow(ctx, 8);
			ctx.fillStyle = GREEN;
			for (let i = 0; i < 12; i++) {
				const a = (i / 12) * Math.PI * 2;
				const d = 6 + t * 30;
				ctx.fillRect(e.x + Math.cos(a) * d - 1.5, e.y + Math.sin(a) * d * 0.5 - t * 20 - 1.5, 3, 3);
			}
			break;
		}
		case 'snap': {
			// A construct forming: a quick bright ring
			ctx.globalAlpha = 1 - t;
			glow(ctx, 14);
			ctx.strokeStyle = CORE;
			ctx.lineWidth = 2;
			const r = (e.radius ?? 40) * (1.4 - t * 0.4);
			ctx.beginPath();
			ctx.ellipse(e.x, e.y, r, r * 0.5, 0, 0, Math.PI * 2);
			ctx.stroke();
			break;
		}
		case 'impact': {
			ctx.globalAlpha = 1 - t;
			glow(ctx, 10);
			ctx.fillStyle = CORE;
			ctx.beginPath();
			ctx.arc(e.x, e.y - lift, 4 + t * 6, 0, Math.PI * 2);
			ctx.fill();
			break;
		}
		case 'number': {
			// Floats up and fades
			ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
			ctx.font = '700 13px system-ui, sans-serif';
			ctx.textAlign = 'center';
			ctx.lineWidth = 3;
			ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
			ctx.fillStyle = '#fff3b0';
			const ny = e.y - 64 - t * 26;
			ctx.strokeText(String(e.value), e.x, ny);
			ctx.fillText(String(e.value), e.x, ny);
			break;
		}
	}
	ctx.restore();
	void time;
}

/** A giant construct fist, knuckles forward, at `reach` along `angle`. */
function drawFist(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, reach: number, size: number, alpha: number) {
	ctx.save();
	ctx.globalAlpha = alpha;
	ctx.translate(x, y);
	ctx.rotate(angle);
	glow(ctx, 18);
	ctx.strokeStyle = GREEN;
	ctx.fillStyle = 'rgba(61, 255, 110, 0.22)';
	ctx.lineWidth = 2.5;

	// Forearm
	ctx.beginPath();
	ctx.moveTo(4, -size * 0.25);
	ctx.lineTo(reach - size * 0.4, -size * 0.3);
	ctx.lineTo(reach - size * 0.4, size * 0.3);
	ctx.lineTo(4, size * 0.25);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();

	// Fist block with knuckle lines
	const fx = reach - size * 0.45;
	ctx.beginPath();
	ctx.roundRect(fx, -size * 0.5, size * 0.9, size, size * 0.2);
	ctx.fill();
	ctx.stroke();
	for (let i = 1; i < 4; i++) {
		const ky = -size * 0.5 + (i * size) / 4;
		ctx.beginPath();
		ctx.moveTo(fx + size * 0.55, ky);
		ctx.lineTo(fx + size * 0.9, ky);
		ctx.stroke();
	}
	// Thumb
	ctx.beginPath();
	ctx.roundRect(fx + size * 0.1, -size * 0.62, size * 0.45, size * 0.22, size * 0.1);
	ctx.stroke();
	ctx.restore();
}
