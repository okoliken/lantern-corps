// Mission 4 art: the Interceptor (the Corps' prototype ship from the animated
// series), the rage torpedoes Red Lantern fighters fire at it, and the shots
// from its cannons once Aya wakes up.

import type { Dummy } from '../dummy';
import { GREEN } from './lantern';

const TAU = Math.PI * 2;
const HULL = '#2a3137';
const HULL_LIGHT = '#4a555e';
const HULL_DARK = '#161b1f';
const TRIM = '#c9d3d8';
const OUTLINE = '#05080a';

export interface InterceptorLook {
	/** 0..1 hull left. */
	hull: number;
	/** Seconds of hit flash left. */
	flash: number;
	/** 0 dead in space (lights out, no engines) .. 1 full power. */
	power: number;
	/** 0..1 Aya waking up: her light pulses in the cockpit, brighter as she boots. */
	boot: number;
	destroyed: boolean;
	time: number;
}

/**
 * The Interceptor, side-on, flying right: a long dark arrowhead with green
 * running lights, a canopy up front and twin engines at the back. (x, y) is
 * its ground point; it's drawn floating above it.
 */
export function drawInterceptor(ctx: CanvasRenderingContext2D, x: number, y: number, look: InterceptorLook) {
	const { hull, flash, power, boot, destroyed, time } = look;
	const bob = Math.sin(time * 1.4) * 3 * (0.4 + power * 0.6);
	ctx.save();
	ctx.translate(x, y - 44 + bob);
	if (destroyed) {
		ctx.rotate(-0.2);
		ctx.globalAlpha = 0.55;
	} else if (power < 0.5) {
		// Dead in space: listing a little
		ctx.rotate(0.05 * (1 - power * 2));
	}

	// Engine flames: twin green jets, sputtering when the hull is low
	const sputter = hull < 0.3 ? (Math.sin(time * 21) > 0 ? 0.45 : 1) : 1;
	if (!destroyed && power > 0.05) {
		for (const ey of [-10, 8]) {
			const len = (34 + Math.sin(time * 38 + ey) * 5) * sputter * power;
			const g = ctx.createLinearGradient(-110, ey, -110 - len, ey);
			g.addColorStop(0, 'rgba(234, 255, 240, 0.95)');
			g.addColorStop(0.35, 'rgba(61, 255, 110, 0.75)');
			g.addColorStop(1, 'rgba(61, 255, 110, 0)');
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.moveTo(-108, ey - 6);
			ctx.lineTo(-110 - len, ey);
			ctx.lineTo(-108, ey + 6);
			ctx.closePath();
			ctx.fill();
		}
	}

	ctx.lineJoin = 'round';
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 1.5;
	const tone = (c: string) => (flash > 0 ? '#ffe2e2' : c);

	// Far wing, swept back behind the hull
	ctx.fillStyle = tone(HULL_DARK);
	ctx.beginPath();
	ctx.moveTo(-10, -12);
	ctx.lineTo(-86, -52);
	ctx.lineTo(-70, -14);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();

	// Engine nacelles
	for (const ey of [-10, 8]) {
		ctx.fillStyle = tone(HULL_LIGHT);
		ctx.beginPath();
		ctx.roundRect(-110, ey - 7, 46, 14, 5);
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = power > 0.05 ? `rgba(61, 255, 110, ${0.4 + power * 0.5})` : '#20302a';
		ctx.fillRect(-112, ey - 4, 4, 8);
	}

	// Hull: a long arrowhead, the nose far out front
	const body = new Path2D();
	body.moveTo(122, 4);
	body.lineTo(70, -12);
	body.lineTo(10, -20);
	body.lineTo(-60, -18);
	body.lineTo(-96, -8);
	body.lineTo(-96, 14);
	body.lineTo(-40, 20);
	body.lineTo(40, 16);
	body.lineTo(96, 10);
	body.closePath();
	const shade = ctx.createLinearGradient(0, -20, 0, 20);
	shade.addColorStop(0, tone(HULL_LIGHT));
	shade.addColorStop(0.45, tone(HULL));
	shade.addColorStop(1, tone(HULL_DARK));
	ctx.fillStyle = shade;
	ctx.fill(body);
	ctx.stroke(body);

	// Pale trim along the spine and the belly line
	ctx.strokeStyle = TRIM;
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.moveTo(-88, -10);
	ctx.lineTo(8, -16);
	ctx.lineTo(66, -9);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(-86, 10);
	ctx.lineTo(40, 12);
	ctx.lineTo(92, 7);
	ctx.stroke();

	// Near wing, swept back and down, with a green stripe
	ctx.strokeStyle = OUTLINE;
	ctx.fillStyle = tone(HULL);
	ctx.beginPath();
	ctx.moveTo(20, 8);
	ctx.lineTo(-74, 46);
	ctx.lineTo(-58, 12);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();

	// Running lights: green glow along the flanks, dark when the power's out
	const lit = power > 0.05 ? power * (0.75 + 0.25 * Math.sin(time * 4)) : 0;
	ctx.save();
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 10 * lit;
	ctx.strokeStyle = lit > 0 ? `rgba(61, 255, 110, ${0.35 + lit * 0.6})` : '#1d2a24';
	ctx.lineWidth = 2.5;
	ctx.beginPath();
	ctx.moveTo(8, 12);
	ctx.lineTo(-62, 38);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(-92, 2);
	ctx.lineTo(48, 4);
	ctx.lineTo(104, 5);
	ctx.stroke();
	ctx.restore();

	// Corps emblem on the flank
	ctx.save();
	ctx.translate(-22, -2);
	ctx.strokeStyle = lit > 0 ? GREEN : '#3a5a48';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(0, 0, 7, 0, TAU);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(-9, -5);
	ctx.lineTo(9, -5);
	ctx.moveTo(-9, 5);
	ctx.lineTo(9, 5);
	ctx.stroke();
	ctx.restore();

	// Canopy up front, where Aya's light shows as she wakes
	ctx.fillStyle = '#0b1a14';
	ctx.beginPath();
	ctx.moveTo(84, -8);
	ctx.quadraticCurveTo(58, -24, 30, -18);
	ctx.lineTo(34, -12);
	ctx.quadraticCurveTo(60, -14, 84, -8);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	const aya = boot > 0 ? boot * (0.55 + 0.45 * Math.sin(time * (3 + boot * 5))) : power * 0.35;
	if (aya > 0.02) {
		ctx.save();
		ctx.shadowColor = GREEN;
		ctx.shadowBlur = 14 * aya;
		ctx.fillStyle = `rgba(61, 255, 110, ${0.25 + aya * 0.6})`;
		ctx.beginPath();
		ctx.moveTo(80, -9);
		ctx.quadraticCurveTo(58, -21, 34, -16);
		ctx.lineTo(36, -13);
		ctx.quadraticCurveTo(60, -15, 80, -9);
		ctx.closePath();
		ctx.fill();
		ctx.restore();
	}

	// Damage: smoke when hurt, then sparks
	if (!destroyed && hull < 0.6) {
		const n = hull < 0.3 ? 5 : 3;
		for (let i = 0; i < n; i++) {
			const t = (time * 0.9 + i / n) % 1;
			ctx.fillStyle = `rgba(40, 40, 44, ${0.45 * (1 - t)})`;
			ctx.beginPath();
			ctx.arc(-30 + i * 22 - t * 70, -18 - t * 26, 6 + t * 12, 0, TAU);
			ctx.fill();
		}
		if (hull < 0.3 && Math.sin(time * 17) > 0.3) {
			ctx.fillStyle = '#ffcf5a';
			ctx.fillRect(10 + Math.sin(time * 31) * 20, -4, 3, 3);
		}
	}
	ctx.restore();
}

/**
 * A rage torpedo: a red spike of light pointing where it's going, with a
 * burning trail. Drawn at its drift height, like an asteroid.
 */
export function drawRageTorpedo(ctx: CanvasRenderingContext2D, d: Dummy, x: number, y: number, time: number) {
	if (!d.drift) return;
	const { radius: r, float } = d.drift;
	const angle = Math.atan2(d.vy, d.vx);
	const breaking = d.hp <= 0;
	ctx.save();
	ctx.translate(x, y - float);
	ctx.globalAlpha = breaking ? 0.4 : 1;
	ctx.rotate(angle);

	// Trail
	const trail = ctx.createLinearGradient(-r * 0.6, 0, -r * 4, 0);
	trail.addColorStop(0, 'rgba(255, 90, 60, 0.8)');
	trail.addColorStop(1, 'rgba(255, 42, 42, 0)');
	ctx.fillStyle = trail;
	ctx.beginPath();
	ctx.moveTo(-r * 0.5, -r * 0.45);
	ctx.lineTo(-r * 4 - Math.sin(time * 40 + d.homeX) * 4, 0);
	ctx.lineTo(-r * 0.5, r * 0.45);
	ctx.closePath();
	ctx.fill();

	// Body: a jagged red spike
	ctx.shadowColor = '#ff2a2a';
	ctx.shadowBlur = 12;
	ctx.fillStyle = d.flash > 0 ? '#ffffff' : '#ff3b2f';
	ctx.strokeStyle = '#3a0303';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.moveTo(r * 1.3, 0);
	ctx.lineTo(r * 0.2, -r * 0.55);
	ctx.lineTo(-r * 0.2, -r * 0.3);
	ctx.lineTo(-r * 0.7, -r * 0.6);
	ctx.lineTo(-r * 0.5, 0);
	ctx.lineTo(-r * 0.7, r * 0.6);
	ctx.lineTo(-r * 0.2, r * 0.3);
	ctx.lineTo(r * 0.2, r * 0.55);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();

	// Hot core, pulsing
	ctx.shadowBlur = 0;
	ctx.fillStyle = `rgba(255, 230, 200, ${0.6 + 0.4 * Math.sin(time * 20 + d.homeY)})`;
	ctx.beginPath();
	ctx.ellipse(r * 0.2, 0, r * 0.45, r * 0.2, 0, 0, TAU);
	ctx.fill();
	ctx.restore();
}

/** A shot from the Interceptor's cannons: a bright green streak, fading over its short life. */
export function drawCannonShot(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, fade: number) {
	ctx.save();
	ctx.globalAlpha = fade;
	ctx.lineCap = 'round';
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 14;
	ctx.strokeStyle = GREEN;
	ctx.lineWidth = 5;
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);
	ctx.stroke();
	ctx.shadowBlur = 0;
	ctx.strokeStyle = 'rgba(234, 255, 240, 0.9)';
	ctx.lineWidth = 2;
	ctx.stroke();
	ctx.restore();
}
