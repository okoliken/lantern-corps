// Hal's Carrier Strike: a whole aircraft carrier in ring energy, side-on behind
// him, and the wave of jets it launches at his mark (constructs/system.ts).

import { CARRIER, type Effect } from '../constructs/system';
import { energy, sparks } from './constructs';
import { jet } from './armory';
import { green, greenCore } from '../../theme';

const TAU = Math.PI * 2;
/** Hull length. */
const L = 440;
/** How high the jets fly over their mark. */
const JET_ALT = 170;

export function drawCarrier(ctx: CanvasRenderingContext2D, e: Effect, time: number) {
	const bow = -(e.angle ?? -1) as 1 | -1;
	const rise = Math.min(1, e.age / CARRIER.rise);
	const fade = Math.min(1, (e.life - e.age) / 0.6);
	ctx.save();
	ctx.globalAlpha *= fade;

	// The carrier: it surges up out of a pool of green light, stern to bow
	ctx.save();
	ctx.translate(e.x, e.y + (1 - rise) * 50);
	ctx.scale(bow, 1);
	const pool = ctx.createRadialGradient(0, 14, 10, 0, 14, L * 0.65);
	pool.addColorStop(0, green(0.28 * rise));
	pool.addColorStop(1, green(0));
	ctx.fillStyle = pool;
	ctx.beginPath();
	ctx.ellipse(0, 14, L * 0.65, 46, 0, 0, TAU);
	ctx.fill();
	ctx.beginPath();
	ctx.rect(-L / 2 - 20, -200, (L + 80) * rise, 260);
	ctx.clip();
	hull(ctx, time);
	ctx.restore();

	// Its jets: off the bow, down on the mark, and away
	const jets = Math.round((e.life - CARRIER.rise - CARRIER.flight - 0.9) / CARRIER.every);
	const mark = e.mark ?? { x: e.x, y: e.y };
	const sx = e.x + bow * (L / 2 + 10);
	const sy = e.y - 70;
	for (let i = 0; i < jets; i++) {
		const k = (e.age - CARRIER.rise - i * CARRIER.every) / CARRIER.flight;
		if (k < 0 || k > 1.8) continue;
		const to = e.marks?.[i] ?? mark;
		const ex = to.x + Math.sin(i * 2.4) * 40;
		const ey = to.y - JET_ALT;
		const at = (k: number): [number, number] => {
			// Off the catapult and climbing, then the dive onto the mark, then pulling up and away
			if (k <= 1) return [sx + (ex - sx) * k, sy + (ey - sy) * k - Math.sin(k * Math.PI) * 90];
			const d = Math.hypot(ex - sx, ey - sy) || 1;
			const o = (k - 1) * 520;
			return [ex + ((ex - sx) / d) * o, ey + ((ey - sy) / d) * o * 0.3 - o * 0.6];
		};
		const [x, y] = at(k);
		const [nx, ny] = at(k + 0.03);
		ctx.save();
		ctx.globalAlpha *= k > 1.4 ? Math.max(0, (1.8 - k) / 0.4) : 1;
		// Contrail
		ctx.strokeStyle = greenCore(0.25);
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.lineTo(x - (nx - x) * 8, y - (ny - y) * 8);
		ctx.stroke();
		ctx.translate(x, y);
		ctx.rotate(Math.atan2(ny - y, nx - x));
		ctx.scale(0.85, 0.85);
		jet(ctx, time + i);
		ctx.restore();
		// The bomb it lets go of on the dive
		if (k > 0.55 && k < 1) {
			const b = (k - 0.55) / 0.45;
			const bx = x + (to.x - x) * b;
			const by = y + (to.y - y) * b * b;
			const bomb = new Path2D();
			bomb.ellipse(bx, by, 6, 11, 0, 0, TAU);
			energy(ctx, bomb, { time, edge: 1.4, body: 0.8 });
		}
	}

	// A mark on the ground under every target a jet is still on its way to
	const r = (e.radius ?? 120) * 0.8;
	const pending = (e.marks ?? []).slice(e.launched ?? 0);
	if (pending.length === 0 && e.age < CARRIER.rise) pending.push({ x: mark.x, y: mark.y, on: null });
	const seen = new Set<unknown>();
	for (const m of pending) {
		if (m.on && seen.has(m.on)) continue;
		seen.add(m.on);
		ctx.strokeStyle = green(0.75);
		ctx.lineWidth = 3;
		ctx.setLineDash([12, 9]);
		ctx.lineDashOffset = -time * 40;
		ctx.beginPath();
		ctx.ellipse(m.x, m.y, r, r * 0.42, 0, 0, TAU);
		ctx.stroke();
		ctx.setLineDash([]);
		ctx.beginPath();
		ctx.moveTo(m.x - r - 14, m.y);
		ctx.lineTo(m.x - r * 0.5, m.y);
		ctx.moveTo(m.x + r * 0.5, m.y);
		ctx.lineTo(m.x + r + 14, m.y);
		ctx.stroke();
	}
	ctx.restore();
}

/** The ship itself, bow along +x, waterline at y 0. */
function hull(ctx: CanvasRenderingContext2D, time: number) {
	const h = L / 2;
	// Hull: a flared bow, a square stern, a bulb under the bow
	const body = new Path2D();
	body.moveTo(-h, -52);
	body.lineTo(h + 46, -52);
	body.quadraticCurveTo(h + 20, -20, h - 4, 6);
	body.quadraticCurveTo(h - 30, 14, h - 60, 12);
	body.lineTo(-h + 18, 12);
	body.lineTo(-h, -20);
	body.closePath();
	energy(ctx, body, { time, edge: 2.5, body: 1.1 });

	// The flight deck: a slab overhanging both ends, with the angled landing strip
	const deck = new Path2D();
	deck.moveTo(-h - 14, -64);
	deck.lineTo(h + 58, -64);
	deck.lineTo(h + 50, -52);
	deck.lineTo(-h - 8, -52);
	deck.closePath();
	energy(ctx, deck, { time, edge: 2, body: 1.4 });
	ctx.save();
	ctx.strokeStyle = greenCore(0.6);
	ctx.lineWidth = 1.5;
	ctx.setLineDash([16, 12]);
	ctx.beginPath();
	ctx.moveTo(-h, -58);
	ctx.lineTo(h + 40, -58);
	ctx.stroke();
	ctx.setLineDash([]);
	// Catapult track on the bow, glowing while it launches
	ctx.strokeStyle = greenCore(0.5 + 0.4 * Math.sin(time * 14));
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.moveTo(h - 90, -60);
	ctx.lineTo(h + 46, -60);
	ctx.stroke();
	ctx.restore();

	// The island: bridge, funnel, mast and a turning radar
	const island = new Path2D();
	island.moveTo(-60, -64);
	island.lineTo(-60, -112);
	island.lineTo(-48, -124);
	island.lineTo(-6, -124);
	island.lineTo(-6, -64);
	island.closePath();
	island.rect(-46, -148, 26, 24);
	energy(ctx, island, { time, edge: 2, body: 1.2 });
	ctx.save();
	ctx.fillStyle = greenCore(0.7);
	for (let i = 0; i < 4; i++) ctx.fillRect(-54 + i * 11, -116, 7, 5);
	ctx.strokeStyle = green(0.9);
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(-33, -148);
	ctx.lineTo(-33, -182);
	ctx.moveTo(-44, -168);
	ctx.lineTo(-22, -168);
	ctx.stroke();
	const spin = Math.cos(time * 3);
	ctx.beginPath();
	ctx.ellipse(-33, -184, 13 * Math.abs(spin) + 1, 4, 0, 0, TAU);
	ctx.stroke();
	ctx.restore();

	// Portholes along the hull, and a jet waiting on deck
	ctx.save();
	ctx.fillStyle = greenCore(0.45);
	for (let i = 0; i < 14; i++) ctx.fillRect(-h + 30 + i * 30, -34, 6, 4);
	ctx.restore();
	ctx.save();
	ctx.translate(h - 30, -80);
	ctx.scale(0.6, 0.6);
	jet(ctx, time);
	ctx.restore();

	// Bow wave
	ctx.save();
	ctx.strokeStyle = greenCore(0.35);
	ctx.lineWidth = 2;
	const base = ctx.globalAlpha;
	for (let i = 0; i < 3; i++) {
		const t = (time * 1.5 + i / 3) % 1;
		ctx.globalAlpha = base * (1 - t);
		ctx.beginPath();
		ctx.ellipse(h - 10 + t * 30, 10, 20 + t * 40, 5, 0, Math.PI, TAU);
		ctx.stroke();
	}
	ctx.restore();
	sparks(ctx, 0, -40, h, 10, time, 3.1);
}
