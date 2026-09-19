// Mission art: Tomar-Re's Green Lantern Corps cruiser, and the asteroids of
// the storm (and the debris when they break).

import type { Effect, Shield } from '../constructs/system';
import type { Dummy } from '../dummy';
import { GREEN } from './lantern';
import { green, greenLight, greenCore } from '../../theme';

const TAU = Math.PI * 2;
const HULL = '#dfe8e2';
const HULL_SHADE = '#9fb1a8';
const BOTTLE = '#0F4F34';
const OUTLINE = '#07100c';

/** A tiny seeded random generator so each rock keeps its shape. */
function seeded(seed: number) {
	let s = Math.floor(seed * 2147483646) + 1;
	return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/**
 * Tomar-Re's cruiser, side-on, flying right. (x, y) is its ground point; it's
 * drawn floating above it. As the hull drops it trails smoke, then sparks and
 * fire. `destroyed` draws the wreck.
 */
export function drawEscortShip(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	hull: number,
	flash: number,
	destroyed: boolean,
	time: number,
	/** Story scenes: set down on its legs with the engines off; `empty` once the pilot has climbed out. */
	scene: { landed?: boolean; empty?: boolean; hatch?: number } = {}
) {
	const bob = scene.landed ? 0 : Math.sin(time * 1.6) * 3;
	ctx.save();
	ctx.translate(x, y - 40 + bob);
	if (destroyed) {
		ctx.rotate(0.25);
		ctx.globalAlpha = 0.55;
	}

	// Engine flames: green, steady when healthy, sputtering when hurt
	const sputter = hull < 0.3 ? (Math.sin(time * 23) > 0 ? 0.4 : 1) : 1;
	if (!destroyed && !scene.landed) {
		for (const ey of [-8, 9]) {
			const len = (26 + Math.sin(time * 40 + ey) * 4) * sputter;
			const g = ctx.createLinearGradient(-92, ey, -92 - len, ey);
			g.addColorStop(0, greenCore(0.95));
			g.addColorStop(0.4, green(0.7));
			g.addColorStop(1, green(0));
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.moveTo(-90, ey - 5);
			ctx.lineTo(-92 - len, ey);
			ctx.lineTo(-90, ey + 5);
			ctx.closePath();
			ctx.fill();
		}
	}

	ctx.lineJoin = 'round';
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 1.5;

	// Far fin (behind the hull)
	ctx.fillStyle = HULL_SHADE;
	ctx.beginPath();
	ctx.moveTo(-40, -14);
	ctx.lineTo(-78, -40);
	ctx.lineTo(-62, -14);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();

	// Engine pods
	for (const ey of [-8, 9]) {
		ctx.fillStyle = HULL_SHADE;
		ctx.beginPath();
		ctx.roundRect(-94, ey - 6, 30, 12, 5);
		ctx.fill();
		ctx.stroke();
	}

	// The hull: a long, sleek body with a pointed nose
	const hullPath = new Path2D();
	hullPath.moveTo(96, 2);
	hullPath.quadraticCurveTo(70, -20, 20, -20);
	hullPath.lineTo(-70, -16);
	hullPath.quadraticCurveTo(-86, -4, -70, 16);
	hullPath.lineTo(30, 18);
	hullPath.quadraticCurveTo(76, 16, 96, 2);
	hullPath.closePath();
	const shade = ctx.createLinearGradient(0, -20, 0, 18);
	shade.addColorStop(0, flash > 0 ? '#ffffff' : HULL);
	shade.addColorStop(1, flash > 0 ? '#ffdddd' : HULL_SHADE);
	ctx.fillStyle = shade;
	ctx.fill(hullPath);
	ctx.stroke(hullPath);

	// Bottle-green Corps livery down the side, with a glowing line
	ctx.save();
	ctx.clip(hullPath);
	ctx.fillStyle = BOTTLE;
	ctx.fillRect(-90, 2, 190, 8);
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 8;
	ctx.strokeStyle = GREEN;
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.moveTo(-80, 2);
	ctx.lineTo(90, 2);
	ctx.stroke();
	ctx.restore();

	// Green Lantern emblem
	ctx.save();
	ctx.translate(-20, -4);
	ctx.fillStyle = '#0b1a12';
	ctx.beginPath();
	ctx.arc(0, 0, 8, 0, TAU);
	ctx.fill();
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 10;
	ctx.strokeStyle = GREEN;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(0, 0, 5, 0, TAU);
	ctx.stroke();
	ctx.fillStyle = GREEN;
	ctx.fillRect(-7, -7.5, 14, 2);
	ctx.fillRect(-7, 5.5, 14, 2);
	ctx.restore();

	// Landing legs
	if (scene.landed) {
		ctx.strokeStyle = OUTLINE;
		ctx.fillStyle = HULL_SHADE;
		ctx.lineWidth = 1.5;
		for (const lx of [-50, 40]) {
			ctx.beginPath();
			ctx.moveTo(lx, 14);
			ctx.lineTo(lx - 8, 40);
			ctx.lineTo(lx + 6, 40);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
		}
	}

	// Side hatch, glowing as it opens
	if (scene.hatch) {
		ctx.fillStyle = greenCore(0.3 + 0.6 * scene.hatch);
		ctx.shadowColor = GREEN;
		ctx.shadowBlur = 14 * scene.hatch;
		ctx.fillRect(4, 14 - 22 * scene.hatch, 16, 22 * scene.hatch);
		ctx.shadowBlur = 0;
		ctx.strokeStyle = OUTLINE;
		ctx.lineWidth = 1;
		ctx.strokeRect(4, -8, 16, 22);
	}

	// Canopy, with the pilot inside: Tomar-Re (a beaked, crested alien)
	ctx.save();
	const canopy = new Path2D();
	canopy.moveTo(64, -12);
	canopy.quadraticCurveTo(46, -34, 22, -19);
	canopy.closePath();
	ctx.fillStyle = greenLight(0.28);
	ctx.fill(canopy);
	ctx.clip(canopy);
	if (scene.empty) ctx.globalAlpha = 0;
	ctx.fillStyle = '#e07a3a';
	ctx.beginPath();
	ctx.ellipse(40, -20, 5, 6, 0, 0, TAU);
	ctx.fill();
	ctx.fillStyle = '#f2c14e';
	ctx.beginPath();
	ctx.moveTo(44, -21);
	ctx.lineTo(51, -19);
	ctx.lineTo(44, -17);
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = '#b8412a';
	ctx.beginPath();
	ctx.moveTo(36, -24);
	ctx.lineTo(31, -30);
	ctx.lineTo(38, -26);
	ctx.closePath();
	ctx.fill();
	ctx.restore();
	ctx.strokeStyle = greenCore(0.7);
	ctx.lineWidth = 1;
	ctx.stroke(canopy);

	// Near fin (under the hull)
	ctx.fillStyle = flash > 0 ? '#ffffff' : HULL;
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.moveTo(-30, 14);
	ctx.lineTo(-66, 38);
	ctx.lineTo(-54, 14);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();

	// Damage: scorch marks, smoke, sparks, fire
	if (hull < 0.75) {
		ctx.fillStyle = 'rgba(30, 20, 15, 0.55)';
		ctx.beginPath();
		ctx.ellipse(10, -8, 10, 5, 0.3, 0, TAU);
		ctx.fill();
	}
	if (hull < 0.6 || destroyed) {
		for (let i = 0; i < 5; i++) {
			const k = (time * 0.8 + i / 5) % 1;
			ctx.fillStyle = `rgba(70, 70, 70, ${0.45 * (1 - k)})`;
			ctx.beginPath();
			ctx.arc(-40 - k * 90, -16 - k * 30 + Math.sin(i * 3 + time) * 4, 5 + k * 12, 0, TAU);
			ctx.fill();
		}
	}
	if (hull < 0.3 && !destroyed) {
		const flicker = 0.6 + 0.4 * Math.sin(time * 30);
		ctx.fillStyle = `rgba(255, 140, 40, ${0.8 * flicker})`;
		ctx.beginPath();
		ctx.moveTo(0, -18);
		ctx.quadraticCurveTo(-6, -32 - flicker * 6, -16, -18);
		ctx.closePath();
		ctx.fill();
		if (Math.sin(time * 17) > 0.5) {
			ctx.strokeStyle = '#fff2b0';
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(18, -4);
			ctx.lineTo(24, -12);
			ctx.moveTo(18, -4);
			ctx.lineTo(12, -13);
			ctx.stroke();
		}
	}
	ctx.restore();
}

/** An asteroid of the storm: a lumpy, cratered, spinning rock that cracks as it's hit. */
/**
 * A bubble shield stretched around the whole ship. (x, y) is the middle of the
 * hull; `length` is half its width. Blinks in its last two seconds, like a
 * Lantern's bubble.
 */
export function drawShipShield(ctx: CanvasRenderingContext2D, s: Shield, x: number, y: number, length: number, time: number) {
	const ripple = s.ripple / 0.3;
	const health = s.hp / s.maxHp;
	const rx = length + ripple * 5;
	const ry = length * 0.46 + ripple * 3;
	const cy = y - 6;
	const blink = s.life < 2 ? (Math.sin(time * 18) > 0 ? 0.45 : 1) : 1;

	ctx.save();
	ctx.globalAlpha = blink;
	const body = ctx.createRadialGradient(x - rx * 0.3, cy - ry * 0.4, 4, x, cy, rx);
	body.addColorStop(0, greenCore(0.06));
	body.addColorStop(0.75, green(0.06 + 0.06 * health));
	body.addColorStop(1, green(0.28 + 0.22 * health + ripple * 0.3));
	ctx.fillStyle = body;
	ctx.beginPath();
	ctx.ellipse(x, cy, rx, ry, 0, 0, TAU);
	ctx.fill();

	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 16;
	ctx.strokeStyle = GREEN;
	ctx.lineWidth = 2 + ripple * 2;
	ctx.stroke();

	// Glint sliding over the top
	ctx.shadowBlur = 0;
	ctx.strokeStyle = greenCore(0.6);
	ctx.lineWidth = 2.5;
	const g = -2.2 + Math.sin(time * 0.8) * 0.3;
	ctx.beginPath();
	ctx.ellipse(x, cy, rx * 0.86, ry * 0.8, 0, g, g + 0.6);
	ctx.stroke();

	// Time left along the bottom
	ctx.strokeStyle = green(0.6);
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.ellipse(x, cy, rx + 6, ry + 6, 0, Math.PI * 0.3, Math.PI * 0.3 + Math.PI * 0.4 * (s.life / s.maxLife));
	ctx.stroke();
	ctx.restore();
}

export function drawSpaceRock(ctx: CanvasRenderingContext2D, d: Dummy, x: number, y: number, time: number) {
	if (!d.drift) return;
	const { radius: r, float, spin, seed } = d.drift;
	const rand = seeded(seed);
	const angle = time * spin + seed * TAU;
	const cy = y - float;

	// A faint streak behind it, showing where it's heading
	const speed = Math.hypot(d.vx, d.vy);
	if (speed > 1) {
		const ux = d.vx / speed;
		const uy = d.vy / speed;
		const g = ctx.createLinearGradient(x, cy, x - ux * r * 3, cy - uy * r * 3);
		g.addColorStop(0, 'rgba(255, 190, 120, 0.25)');
		g.addColorStop(1, 'rgba(255, 190, 120, 0)');
		ctx.strokeStyle = g;
		ctx.lineWidth = r * 1.2;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(x, cy);
		ctx.lineTo(x - ux * r * 3, cy - uy * r * 3);
		ctx.stroke();
	}

	ctx.save();
	ctx.translate(x, cy);
	ctx.rotate(angle);
	// Lumpy outline
	const points = 12;
	const lumps: number[] = [];
	for (let i = 0; i < points; i++) lumps.push(0.8 + rand() * 0.28);
	const body = new Path2D();
	for (let i = 0; i < points; i++) {
		const a = (i / points) * TAU;
		const px = Math.cos(a) * r * lumps[i];
		const py = Math.sin(a) * r * lumps[i];
		if (i === 0) body.moveTo(px, py);
		else body.lineTo(px, py);
	}
	body.closePath();
	const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r * 1.1);
	g.addColorStop(0, d.flash > 0 ? '#ffffff' : '#8a7d70');
	g.addColorStop(1, d.flash > 0 ? '#ffe0e0' : '#3b332d');
	ctx.fillStyle = g;
	ctx.fill(body);
	ctx.strokeStyle = '#1a1512';
	ctx.lineWidth = 1.2;
	ctx.stroke(body);
	// Craters
	for (let i = 0; i < 3 + Math.floor(r / 12); i++) {
		const a = rand() * TAU;
		const dist = rand() * r * 0.55;
		const cr = r * (0.1 + rand() * 0.14);
		ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
		ctx.beginPath();
		ctx.arc(Math.cos(a) * dist, Math.sin(a) * dist, cr, 0, TAU);
		ctx.fill();
	}
	// Cracks, glowing hot, as it takes damage
	const damage = 1 - d.hp / d.maxHp;
	if (damage > 0.15) {
		ctx.strokeStyle = `rgba(255, 150, 60, ${0.4 + damage * 0.5})`;
		ctx.lineWidth = 1.2;
		for (let i = 0; i < Math.ceil(damage * 4); i++) {
			const a = (i * 2.1 + seed * 5) % TAU;
			ctx.beginPath();
			ctx.moveTo(Math.cos(a) * r * 0.1, Math.sin(a) * r * 0.1);
			ctx.lineTo(Math.cos(a + 0.3) * r * 0.5, Math.sin(a + 0.3) * r * 0.5);
			ctx.lineTo(Math.cos(a - 0.1) * r * 0.85, Math.sin(a - 0.1) * r * 0.85);
			ctx.stroke();
		}
	}
	ctx.restore();

	// A health bar on the big ones once they're hurt
	if (r > 25 && d.hp < d.maxHp) {
		ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
		ctx.fillRect(x - r, cy - r - 10, r * 2, 4);
		ctx.fillStyle = '#ffb060';
		ctx.fillRect(x - r, cy - r - 10, r * 2 * (d.hp / d.maxHp), 4);
	}
}

/** Chunks of rock flying apart where an asteroid broke. */
export function drawDebris(ctx: CanvasRenderingContext2D, e: Effect, lift: number) {
	const t = e.age / e.life;
	const r = e.radius ?? 20;
	const rand = seeded(Math.abs(e.x * 0.013 + e.y * 0.007) % 1);
	ctx.save();
	ctx.globalAlpha = 1 - t;
	for (let i = 0; i < 8; i++) {
		const a = rand() * TAU;
		const dist = r * (0.3 + t * (1.4 + rand()));
		const size = r * (0.12 + rand() * 0.15) * (1 - t * 0.5);
		ctx.fillStyle = i % 3 === 0 ? '#8a7d70' : '#4a3f37';
		ctx.beginPath();
		ctx.arc(e.x + Math.cos(a) * dist, e.y - lift + Math.sin(a) * dist, size, 0, TAU);
		ctx.fill();
	}
	// A dusty puff
	ctx.fillStyle = `rgba(160, 140, 120, ${0.35 * (1 - t)})`;
	ctx.beginPath();
	ctx.arc(e.x, e.y - lift, r * (0.6 + t), 0, TAU);
	ctx.fill();
	ctx.restore();
}
