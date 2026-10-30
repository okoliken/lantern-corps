// Art for John's Armory: the military kit he can swap in (constructs/defs.ts,
// ARMORY). Engineered like the rest of his constructs (draw/kits.ts): plating,
// tracks, rotors, sandbags, all in ring energy.

import type { Effect, Projectile, Trap, Turret } from '../constructs/system';
import { energy, sparks } from './constructs';
import { GREEN } from './lantern';
import { green, greenCore, GREEN_CORE } from '../../theme';

const TAU = Math.PI * 2;
const CORE = GREEN_CORE;

/** Seconds left in a construct's life: flicker in its last second and a half. */
const flicker = (life: number, time: number) => (life < 1.5 ? 0.5 + 0.5 * Math.sin(time * 20) : 1);

// ---------------------------------------------------------------- tank

/** The Battle Tank: side-on, tracks rolling, the turret's gun pointing the way it's going. */
export function drawTank(ctx: CanvasRenderingContext2D, pr: Projectile, x: number, y: number, time: number) {
	const dir = pr.vx >= 0 ? 1 : -1;
	const s = (pr.def.radius ?? 44) / 44;
	ctx.save();
	ctx.translate(x, y);
	// Shadow and dust kicked up behind
	ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
	ctx.beginPath();
	ctx.ellipse(0, 2, 70 * s, 12 * s, 0, 0, TAU);
	ctx.fill();
	ctx.scale(dir * s, s);
	for (let i = 0; i < 4; i++) {
		const t = (time * 2.5 + i / 4) % 1;
		ctx.fillStyle = greenCore(0.22 * (1 - t));
		ctx.beginPath();
		ctx.arc(-62 - t * 70, -6 - t * 14, 6 + t * 12, 0, TAU);
		ctx.fill();
	}

	// Tracks: a long rounded belt, wheels inside it
	const track = new Path2D();
	track.roundRect(-62, -22, 120, 22, 11);
	energy(ctx, track, { time, edge: 2.2, body: 0.9 });
	const roll = (time * 60) % 12;
	ctx.strokeStyle = greenCore(0.55);
	ctx.lineWidth = 1.2;
	for (let tx = -56 + roll; tx < 52; tx += 12) {
		ctx.beginPath();
		ctx.moveTo(tx, -22);
		ctx.lineTo(tx, -18);
		ctx.moveTo(tx, -4);
		ctx.lineTo(tx, 0);
		ctx.stroke();
	}
	for (const wx of [-46, -24, -2, 20, 42]) {
		const wheel = new Path2D();
		wheel.arc(wx, -11, 7, 0, TAU);
		energy(ctx, wheel, { time, edge: 1.4, body: 0.4 });
	}

	// Hull: sloped front, flat back
	const hull = new Path2D();
	hull.moveTo(-60, -22);
	hull.lineTo(-58, -40);
	hull.lineTo(38, -40);
	hull.lineTo(60, -24);
	hull.lineTo(60, -22);
	hull.closePath();
	energy(ctx, hull, { time, edge: 2.4, body: 1.2 });
	// Turret and the main gun
	const turret = new Path2D();
	turret.moveTo(-30, -40);
	turret.lineTo(-26, -58);
	turret.lineTo(18, -58);
	turret.lineTo(26, -40);
	turret.closePath();
	turret.rect(22, -54, 62, 7);
	turret.rect(80, -56, 10, 11);
	// Hatch and the commander's machine gun
	turret.rect(-14, -64, 16, 6);
	turret.rect(0, -68, 18, 3);
	energy(ctx, turret, { time, edge: 2.2, body: 1.2 });
	// Rivets along the hull
	ctx.fillStyle = greenCore(0.7);
	for (let rx = -50; rx <= 30; rx += 16) {
		ctx.beginPath();
		ctx.arc(rx, -31, 1.6, 0, TAU);
		ctx.fill();
	}
	// It fires as it stops: a flash at the muzzle just before it goes
	if (pr.life < 0.12) {
		ctx.shadowColor = GREEN;
		ctx.shadowBlur = 18;
		ctx.fillStyle = CORE;
		ctx.beginPath();
		ctx.arc(94, -50, 9, 0, TAU);
		ctx.fill();
	}
	ctx.restore();
}

// --------------------------------------------------------------- mortar

/** A mortar shell: the mark on the ground, the shell coming down, then the burst. */
export function drawMortarDrop(ctx: CanvasRenderingContext2D, e: Effect, time: number) {
	if (e.age < 0) return;
	const r = e.radius ?? 72;
	const flight = e.life - 0.9;
	ctx.save();
	if (e.age < flight) {
		const k = e.age / flight;
		// Crosshair on the mark, closing in
		ctx.strokeStyle = green(0.45 + 0.4 * Math.sin(time * 18));
		ctx.lineWidth = 2;
		ctx.setLineDash([8, 6]);
		ctx.lineDashOffset = -time * 30;
		ctx.beginPath();
		ctx.ellipse(e.x, e.y, r, r * 0.45, 0, 0, TAU);
		ctx.stroke();
		ctx.setLineDash([]);
		const c = r * (1 - 0.6 * k);
		ctx.beginPath();
		ctx.moveTo(e.x - c, e.y);
		ctx.lineTo(e.x - c * 0.4, e.y);
		ctx.moveTo(e.x + c * 0.4, e.y);
		ctx.lineTo(e.x + c, e.y);
		ctx.moveTo(e.x, e.y - c * 0.45);
		ctx.lineTo(e.x, e.y - c * 0.18);
		ctx.moveTo(e.x, e.y + c * 0.18);
		ctx.lineTo(e.x, e.y + c * 0.45);
		ctx.stroke();
		// The shell, nose down, falling fast at the end
		const fall = 1 - k * k;
		ctx.translate(e.x, e.y - 30 - fall * 520);
		const shell = new Path2D();
		shell.moveTo(0, 10);
		shell.quadraticCurveTo(-6, 4, -5, -10);
		shell.lineTo(-7, -16);
		shell.lineTo(7, -16);
		shell.lineTo(5, -10);
		shell.quadraticCurveTo(6, 4, 0, 10);
		shell.rect(-3, -22, 6, 6);
		energy(ctx, shell, { time, edge: 1.5, body: 0.8, alpha: 0.5 + 0.5 * k });
		// Whistle streak above it
		ctx.strokeStyle = green(0.3);
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(0, -24);
		ctx.lineTo(0, -60);
		ctx.stroke();
	} else {
		const t = (e.age - flight) / 0.9;
		// The burst: a flash, a ring racing out, sparks and a dark scorch
		ctx.fillStyle = `rgba(0, 0, 0, ${0.3 * (1 - t)})`;
		ctx.beginPath();
		ctx.ellipse(e.x, e.y, r * 0.8, r * 0.36, 0, 0, TAU);
		ctx.fill();
		if (t < 0.25) {
			ctx.shadowColor = GREEN;
			ctx.shadowBlur = 24;
			ctx.fillStyle = CORE;
			ctx.globalAlpha = 1 - t / 0.25;
			ctx.beginPath();
			ctx.ellipse(e.x, e.y - 18, r * 0.6, r * 0.5, 0, 0, TAU);
			ctx.fill();
			ctx.globalAlpha = 1;
			ctx.shadowBlur = 0;
		}
		ctx.strokeStyle = CORE;
		ctx.lineWidth = 3;
		ctx.globalAlpha = Math.max(0, 1 - t * 2);
		ctx.beginPath();
		ctx.ellipse(e.x, e.y, r * (0.6 + t), r * (0.6 + t) * 0.42, 0, 0, TAU);
		ctx.stroke();
		sparks(ctx, e.x, e.y - 14, r, 12, time, e.x * 0.013);
	}
	ctx.restore();
}

// -------------------------------------------------------------- gunship

/** The Attack Helicopter: a gunship hovering on his wing, rotor a blur, chin gun on its target. */
export function drawGunship(ctx: CanvasRenderingContext2D, t: Turret, time: number, space: boolean) {
	const grow = Math.min(1, (t.maxLife - t.life) / 0.3);
	const hover = space ? 50 : 120;
	const bob = Math.sin(time * 2.4 + (t.follow?.dx ?? 0)) * 5;
	const face = Math.cos(t.aim) >= 0 ? 1 : -1;
	ctx.save();
	ctx.globalAlpha = flicker(t.life, time) * (t.hp < t.maxHp * 0.4 ? 0.75 : 1);
	if (!space) {
		// Its shadow, and the rotor wash flattening the ground
		ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
		ctx.beginPath();
		ctx.ellipse(t.x, t.y, 34, 8, 0, 0, TAU);
		ctx.fill();
		ctx.strokeStyle = green(0.12);
		ctx.lineWidth = 2;
		const wash = (time * 1.6) % 1;
		ctx.beginPath();
		ctx.ellipse(t.x, t.y, 30 + wash * 40, (30 + wash * 40) * 0.3, 0, 0, TAU);
		ctx.stroke();
	}
	ctx.translate(t.x, t.y - hover + bob);
	ctx.scale(grow * face, grow);
	// Nose down a touch, the way a gunship sits when it's firing
	ctx.rotate(0.08);
	const body = new Path2D();
	// Cockpit and cabin: a teardrop
	body.moveTo(30, 4);
	body.quadraticCurveTo(34, -12, 14, -16);
	body.lineTo(-14, -16);
	body.quadraticCurveTo(-24, -12, -24, 0);
	body.quadraticCurveTo(-20, 10, 0, 10);
	body.closePath();
	// Tail boom and fin
	body.moveTo(-22, -8);
	body.lineTo(-70, -6);
	body.lineTo(-70, -2);
	body.lineTo(-22, 2);
	body.moveTo(-64, -6);
	body.lineTo(-74, -22);
	body.lineTo(-68, -22);
	body.lineTo(-60, -6);
	// Stub wings with rocket pods
	body.rect(-10, 2, 22, 4);
	body.roundRect(-8, 6, 16, 6, 3);
	// Skids
	body.moveTo(-16, 10);
	body.lineTo(-18, 18);
	body.moveTo(12, 10);
	body.lineTo(14, 18);
	body.moveTo(-26, 18);
	body.lineTo(24, 18);
	// Rotor mast
	body.rect(-3, -22, 6, 6);
	energy(ctx, body, { time, edge: 1.7, body: 0.7 });
	// Canopy glass
	ctx.strokeStyle = greenCore(0.6);
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(8, -14);
	ctx.quadraticCurveTo(26, -10, 28, 2);
	ctx.stroke();
	// Main rotor: a blur with two blades flicking through it
	ctx.strokeStyle = green(0.25);
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.ellipse(0, -23, 62, 5, 0, 0, TAU);
	ctx.stroke();
	ctx.strokeStyle = greenCore(0.7);
	ctx.lineWidth = 2;
	const spin = Math.cos(time * 40);
	ctx.beginPath();
	ctx.moveTo(-62 * spin, -23);
	ctx.lineTo(62 * spin, -23);
	ctx.stroke();
	// Tail rotor
	ctx.beginPath();
	ctx.arc(-72, -14, 7, 0, TAU);
	ctx.stroke();
	// Chin gun, and its flash
	ctx.fillStyle = greenCore(0.8);
	ctx.fillRect(26, 6, 12, 3);
	if (t.cooldown > 0.06) {
		ctx.shadowColor = GREEN;
		ctx.shadowBlur = 12;
		ctx.fillStyle = CORE;
		ctx.beginPath();
		ctx.moveTo(38, 7.5);
		ctx.lineTo(48, 3);
		ctx.lineTo(45, 7.5);
		ctx.lineTo(48, 12);
		ctx.closePath();
		ctx.fill();
	}
	ctx.restore();
}

// ------------------------------------------------------------ claymore

/** A claymore: a curved plate on splayed legs, facing out, its trigger arc in front. */
export function drawClaymore(ctx: CanvasRenderingContext2D, t: Trap, time: number) {
	const blink = Math.sin(time * 5 + t.x) > 0.7;
	ctx.save();
	ctx.translate(t.x, t.y);
	ctx.save();
	ctx.scale(1, 0.45);
	ctx.strokeStyle = green(0.16);
	ctx.setLineDash([4, 6]);
	ctx.lineDashOffset = -time * 8;
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.arc(0, 0, t.radius, 0, TAU);
	ctx.stroke();
	ctx.restore();
	const mine = new Path2D();
	// The plate, bowed toward the enemy
	mine.moveTo(-13, -20);
	mine.quadraticCurveTo(0, -14, 13, -20);
	mine.lineTo(13, -8);
	mine.quadraticCurveTo(0, -2, -13, -8);
	mine.closePath();
	// Scissor legs
	mine.moveTo(-8, -6);
	mine.lineTo(-12, 2);
	mine.moveTo(8, -6);
	mine.lineTo(12, 2);
	// Sight on top
	mine.rect(-2, -24, 4, 4);
	energy(ctx, mine, { time, edge: 1.4, body: 0.7 });
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = blink ? 10 : 2;
	ctx.fillStyle = blink ? CORE : GREEN;
	ctx.beginPath();
	ctx.arc(9, -16, blink ? 2 : 1.4, 0, TAU);
	ctx.fill();
	ctx.restore();
}

// --------------------------------------------------------------- sentry

/** The Sentry Gun: a machine gun on a tripod behind a ring of sandbags, belt and all. */
export function drawSentryGun(ctx: CanvasRenderingContext2D, t: Turret, time: number) {
	const grow = Math.min(1, (t.maxLife - t.life) / 0.25);
	ctx.save();
	ctx.globalAlpha = flicker(t.life, time);
	ctx.translate(t.x, t.y);
	ctx.fillStyle = green(0.12);
	ctx.beginPath();
	ctx.ellipse(0, 0, 34, 11, 0, 0, TAU);
	ctx.fill();
	ctx.scale(grow, grow);
	// Sandbags: two rows of fat lozenges in a half-ring in front
	const bags = new Path2D();
	for (const [row, n, w] of [
		[0, 5, 14],
		[1, 4, 14]
	] as const) {
		for (let i = 0; i < n; i++) {
			const bx = (i - (n - 1) / 2) * w;
			bags.roundRect(bx - w / 2 + 1, -8 - row * 8, w - 2, 8, 4);
		}
	}
	energy(ctx, bags, { time, edge: 1.4, body: 0.6 });
	// Tripod and the gun, turned toward its target
	ctx.translate(0, -26);
	const legs = new Path2D();
	legs.moveTo(-10, 18);
	legs.lineTo(0, 0);
	legs.lineTo(10, 18);
	energy(ctx, legs, { time, edge: 1.4, body: 0 });
	ctx.rotate(t.aim);
	if (Math.cos(t.aim) < 0) ctx.scale(1, -1);
	const gun = new Path2D();
	gun.roundRect(-12, -5, 22, 10, 2);
	// Barrel with its cooling jacket
	gun.rect(10, -3, 18, 6);
	gun.rect(28, -1.5, 8, 3);
	// Shield plate, and the ammo box hanging off the side
	gun.rect(6, -12, 3, 24);
	gun.rect(-10, 5, 10, 8);
	energy(ctx, gun, { time, edge: 1.5, body: 0.9 });
	if (t.cooldown > 0.1) {
		ctx.shadowColor = GREEN;
		ctx.shadowBlur = 12;
		ctx.fillStyle = CORE;
		ctx.beginPath();
		ctx.arc(39, 0, 3.5, 0, TAU);
		ctx.fill();
	}
	ctx.restore();
	// Time left
	ctx.save();
	ctx.globalAlpha = flicker(t.life, time);
	ctx.strokeStyle = greenCore(0.6);
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.ellipse(t.x, t.y, 28, 9, 0, Math.PI * 0.15, Math.PI * 0.15 + Math.PI * 0.7 * (t.life / t.maxLife));
	ctx.stroke();
	ctx.restore();
}
