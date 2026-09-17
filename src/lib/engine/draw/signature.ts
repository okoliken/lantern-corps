// Art for signature abilities: Hal's construct fighter jet and John's
// Fortress dome with its turrets. Same ring-energy look as other constructs,
// but bigger and brighter: these are the big moments.

import type { Fortress } from '../constructs/system';
import type { LanternDef } from '../lanterns';
import { turretPosition } from '../constructs/signature';
import { GREEN } from './lantern';

const CORE = '#eafff0';
const TAU = Math.PI * 2;

// -------------------------------------------------------------------- jet

/**
 * A construct fighter jet with its pilot in the canopy. (x, y) is the middle
 * of the jet; it points along (dx, dy). The pilot's full body isn't drawn
 * during the run: a side-on figure can't point up or down with the jet.
 */
export function drawJet(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	dx: number,
	dy: number,
	time: number,
	pilot: LanternDef
) {
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(Math.atan2(dy, dx));
	// Keep the jet upright when it flies left
	if (dx < 0) ctx.scale(1, -1);

	// Afterburner flames and a light trail behind
	const flicker = 0.8 + 0.2 * Math.sin(time * 60);
	const flame = ctx.createLinearGradient(-110, 0, -38, 0);
	flame.addColorStop(0, 'rgba(61, 255, 110, 0)');
	flame.addColorStop(0.6, `rgba(61, 255, 110, ${0.5 * flicker})`);
	flame.addColorStop(1, CORE);
	ctx.fillStyle = flame;
	ctx.beginPath();
	ctx.moveTo(-38, -6);
	ctx.lineTo(-100 - 12 * flicker, 0);
	ctx.lineTo(-38, 6);
	ctx.closePath();
	ctx.fill();

	// Speed lines
	ctx.strokeStyle = 'rgba(234, 255, 240, 0.35)';
	ctx.lineWidth = 1.5;
	for (let i = 0; i < 5; i++) {
		const off = ((time * 900 + i * 53) % 160) - 80;
		const ly = -26 + i * 13;
		ctx.beginPath();
		ctx.moveTo(-60 - off, ly);
		ctx.lineTo(-100 - off, ly);
		ctx.stroke();
	}

	// Fuselage, delta wings, tail fin, cockpit canopy
	const hull = new Path2D();
	hull.moveTo(58, 0); // nose
	hull.quadraticCurveTo(40, -9, 12, -10);
	hull.lineTo(-10, -30); // top wing tip
	hull.lineTo(-22, -30);
	hull.lineTo(-14, -10);
	hull.lineTo(-34, -9);
	hull.lineTo(-44, -22); // tail fin
	hull.lineTo(-50, -22);
	hull.lineTo(-42, -4);
	hull.lineTo(-42, 4);
	hull.lineTo(-50, 14);
	hull.lineTo(-44, 14);
	hull.lineTo(-34, 9);
	hull.lineTo(-14, 10);
	hull.lineTo(-22, 30); // bottom wing tip
	hull.lineTo(-10, 30);
	hull.lineTo(12, 10);
	hull.quadraticCurveTo(40, 9, 58, 0);
	hull.closePath();

	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 24;
	ctx.fillStyle = 'rgba(61, 255, 110, 0.16)';
	ctx.fill(hull);
	ctx.strokeStyle = GREEN;
	ctx.lineWidth = 2.5;
	ctx.stroke(hull);
	ctx.shadowBlur = 0;
	ctx.strokeStyle = 'rgba(234, 255, 240, 0.6)';
	ctx.lineWidth = 1;
	ctx.stroke(hull);

	// Panel lines and the canopy around Hal
	ctx.strokeStyle = 'rgba(234, 255, 240, 0.35)';
	ctx.beginPath();
	ctx.moveTo(-34, 0);
	ctx.lineTo(50, 0);
	ctx.moveTo(-8, -22);
	ctx.lineTo(4, -10);
	ctx.moveTo(-8, 22);
	ctx.lineTo(4, 10);
	ctx.stroke();
	// Pilot's head under the canopy (seen from the side, nose toward the jet's nose)
	ctx.save();
	ctx.translate(16, 0);
	ctx.fillStyle = pilot.look.skin;
	ctx.beginPath();
	ctx.arc(0, 0, 5.2, 0, TAU);
	ctx.fill();
	ctx.fillStyle = pilot.look.hair;
	ctx.beginPath();
	ctx.arc(-0.8, -0.6, 5.3, Math.PI * 0.95, Math.PI * 1.85);
	ctx.fill();
	if (pilot.look.mask) {
		ctx.fillStyle = '#0F4F34';
		ctx.fillRect(1, -1.8, 4.6, 2.2);
	}
	ctx.restore();

	ctx.strokeStyle = CORE;
	ctx.lineWidth = 1.5;
	ctx.fillStyle = 'rgba(234, 255, 240, 0.12)';
	ctx.beginPath();
	ctx.ellipse(18, 0, 18, 7, 0, 0, TAU);
	ctx.fill();
	ctx.stroke();

	ctx.restore();
}

// --------------------------------------------------------------- fortress

/**
 * The back half of the dome and its ground ring. Drawn BEFORE characters,
 * so John stands inside it.
 */
export function drawFortressBack(ctx: CanvasRenderingContext2D, f: Fortress, time: number) {
	const fade = Math.min(1, f.life / 1.5);
	const grow = Math.min(1, (f.maxLife - f.life) / 0.35);
	const r = f.radius * easeOut(grow);
	ctx.save();
	ctx.globalAlpha = fade;

	// Glowing ring on the ground with turning tick marks
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 16;
	ctx.strokeStyle = GREEN;
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.ellipse(f.x, f.y, r, r * 0.5, 0, 0, TAU);
	ctx.stroke();
	ctx.shadowBlur = 0;
	ctx.strokeStyle = 'rgba(234, 255, 240, 0.35)';
	ctx.lineWidth = 1.5;
	for (let i = 0; i < 24; i++) {
		const a = (i / 24) * TAU + time * 0.4;
		ctx.beginPath();
		ctx.moveTo(f.x + Math.cos(a) * r * 0.9, f.y + Math.sin(a) * r * 0.45);
		ctx.lineTo(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r * 0.5);
		ctx.stroke();
	}

	// Back of the dome: a faint arc behind John
	ctx.fillStyle = 'rgba(61, 255, 110, 0.06)';
	ctx.beginPath();
	ctx.ellipse(f.x, f.y, r, r * 0.95, 0, Math.PI, TAU);
	ctx.fill();
	ctx.restore();
}

/** The front of the dome (see-through lattice), its turrets, and the timer. Drawn AFTER characters. */
export function drawFortressFront(ctx: CanvasRenderingContext2D, f: Fortress, time: number) {
	const fade = Math.min(1, f.life / 1.5);
	const grow = Math.min(1, (f.maxLife - f.life) / 0.35);
	const r = f.radius * easeOut(grow);
	const blink = f.life < 2 && Math.sin(time * 16) > 0 ? 0.55 : 1;
	ctx.save();
	ctx.globalAlpha = fade * blink;

	// Dome shell: a half-ellipse rising from the ground ring
	const dome = new Path2D();
	dome.ellipse(f.x, f.y, r, r * 0.95, 0, Math.PI, TAU);
	dome.ellipse(f.x, f.y, r, r * 0.5, 0, 0, Math.PI);
	const shell = ctx.createLinearGradient(f.x, f.y - r, f.x, f.y);
	shell.addColorStop(0, 'rgba(61, 255, 110, 0.22)');
	shell.addColorStop(1, 'rgba(61, 255, 110, 0.06)');
	ctx.fillStyle = shell;
	ctx.fill(dome);

	// Lattice: latitude and longitude lines, the longitudes turning slowly
	ctx.save();
	ctx.clip(dome);
	ctx.strokeStyle = 'rgba(234, 255, 240, 0.22)';
	ctx.lineWidth = 1.2;
	for (let i = 1; i <= 3; i++) {
		const k = i / 4;
		ctx.beginPath();
		ctx.ellipse(f.x, f.y - r * 0.95 * k, r * Math.sqrt(1 - k * k), r * 0.5 * Math.sqrt(1 - k * k), 0, 0, TAU);
		ctx.stroke();
	}
	for (let i = 0; i < 8; i++) {
		const a = (i / 8) * Math.PI + time * 0.3;
		const rx = r * Math.cos(a);
		ctx.beginPath();
		ctx.ellipse(f.x, f.y, Math.abs(rx), r * 0.95, 0, Math.PI, TAU);
		ctx.stroke();
	}
	// Shimmer sweeping over the top
	const sweep = f.x - r + ((time * 120) % (r * 2 + 80)) - 40;
	const band = ctx.createLinearGradient(sweep - 30, 0, sweep + 30, 0);
	band.addColorStop(0, 'rgba(234, 255, 240, 0)');
	band.addColorStop(0.5, 'rgba(234, 255, 240, 0.25)');
	band.addColorStop(1, 'rgba(234, 255, 240, 0)');
	ctx.fillStyle = band;
	ctx.fillRect(f.x - r, f.y - r, r * 2, r * 1.5);
	ctx.restore();

	// Dome outline
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 18;
	ctx.strokeStyle = GREEN;
	ctx.lineWidth = 2.5;
	ctx.beginPath();
	ctx.ellipse(f.x, f.y, r, r * 0.95, 0, Math.PI, TAU);
	ctx.stroke();
	ctx.shadowBlur = 0;

	// Turrets on the rim, barrels tracking their targets
	if (grow >= 1) {
		for (const t of f.turrets) {
			const pos = turretPosition(f, t.angle);
			drawTurret(ctx, pos.x, pos.y, t.aim, t.cooldown, time);
		}
	}

	// Time left, as an arc along the ground ring
	ctx.strokeStyle = 'rgba(234, 255, 240, 0.7)';
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.ellipse(f.x, f.y, r + 8, (r + 8) * 0.5, 0, Math.PI * 0.2, Math.PI * 0.2 + Math.PI * 0.6 * (f.life / f.maxLife));
	ctx.stroke();
	ctx.restore();
}

function drawTurret(ctx: CanvasRenderingContext2D, x: number, y: number, aim: number, cooldown: number, time: number) {
	ctx.save();
	ctx.translate(x, y - 14);
	// Post
	ctx.strokeStyle = GREEN;
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.moveTo(0, 14);
	ctx.lineTo(0, 2);
	ctx.stroke();
	// Rotating head with a barrel
	ctx.rotate(aim);
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 10;
	ctx.fillStyle = 'rgba(61, 255, 110, 0.3)';
	ctx.strokeStyle = GREEN;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(0, 0, 7, 0, TAU);
	ctx.fill();
	ctx.stroke();
	ctx.beginPath();
	ctx.rect(4, -2.5, 14, 5);
	ctx.fill();
	ctx.stroke();
	// Muzzle flash right after a shot
	if (cooldown > 0.24) {
		ctx.fillStyle = CORE;
		ctx.beginPath();
		ctx.arc(20, 0, 3 + Math.sin(time * 80), 0, TAU);
		ctx.fill();
	}
	ctx.restore();
}

// ---------------------------------------------------------------- callout

/** The big ability name that pops up over a Lantern's head. */
export function drawCallout(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, t: number) {
	const pop = t < 0.12 ? 0.6 + (t / 0.12) * 0.55 : t < 0.2 ? 1.15 - ((t - 0.12) / 0.08) * 0.15 : 1;
	const alpha = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
	ctx.save();
	ctx.globalAlpha = Math.max(0, alpha);
	ctx.translate(x, y - t * 20);
	ctx.scale(pop, pop);
	ctx.font = '900 22px system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.lineWidth = 5;
	ctx.strokeStyle = 'rgba(3, 6, 10, 0.85)';
	ctx.strokeText(text, 0, 0);
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 16;
	ctx.fillStyle = CORE;
	ctx.fillText(text, 0, 0);
	ctx.restore();
}

const easeOut = (k: number) => 1 - (1 - k) ** 3;
