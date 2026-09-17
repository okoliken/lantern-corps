// Ring energy and the things around it: the beam, the Lantern battery,
// the recharge link, and the HUD.

import { BATTERY_MAX_CHARGE, MAX_WILLPOWER, RESTART_THRESHOLD, type Battery } from '../willpower';
import { GREEN } from './lantern';

const BOTTLE_GREEN = '#0F4F34';

// ------------------------------------------------------------------ beam

/** A beam from (x, y) along (dx, dy) for `length` px, with a hot white core. */
export function drawBeam(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	dx: number,
	dy: number,
	length: number,
	hitSomething: boolean,
	time: number
) {
	const ex = x + dx * length;
	const ey = y + dy * length;
	const flicker = 0.85 + 0.15 * Math.sin(time * 60);

	ctx.save();
	ctx.lineCap = 'round';
	ctx.shadowColor = GREEN;

	// Outer glow
	ctx.shadowBlur = 18;
	ctx.strokeStyle = `rgba(61, 255, 110, ${0.35 * flicker})`;
	ctx.lineWidth = 11;
	line(ctx, x, y, ex, ey);

	// Body
	ctx.shadowBlur = 8;
	ctx.strokeStyle = GREEN;
	ctx.lineWidth = 5 * flicker;
	line(ctx, x, y, ex, ey);

	// Core
	ctx.shadowBlur = 0;
	ctx.strokeStyle = '#eafff0';
	ctx.lineWidth = 1.6;
	line(ctx, x, y, ex, ey);

	// Impact: a flaring spark where it hits
	if (hitSomething) {
		ctx.shadowBlur = 20;
		ctx.fillStyle = '#d9ffe3';
		const r = 5 + Math.sin(time * 40) * 2;
		ctx.beginPath();
		ctx.arc(ex, ey, r, 0, Math.PI * 2);
		ctx.fill();
		// A few short rays spinning around the impact point
		ctx.strokeStyle = GREEN;
		ctx.lineWidth = 2;
		for (let i = 0; i < 5; i++) {
			const a = time * 9 + (i * Math.PI * 2) / 5;
			line(ctx, ex, ey, ex + Math.cos(a) * 12, ey + Math.sin(a) * 12);
		}
	}
	ctx.restore();
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);
	ctx.stroke();
}

// --------------------------------------------------------------- battery

/**
 * The Lantern battery: the classic lantern shape. It glows brighter the more
 * charge it has. On a planet it stands on the ground; in space it floats.
 */
export function drawBattery(ctx: CanvasRenderingContext2D, b: Battery, onGround: boolean, time: number) {
	const fill = b.charge / BATTERY_MAX_CHARGE;
	const bob = onGround ? 0 : Math.sin(time * 1.5) * 3 - 10;
	const pulse = 0.8 + 0.2 * Math.sin(time * 3);

	ctx.save();
	ctx.translate(b.x, b.y);

	if (onGround) {
		ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
		ctx.beginPath();
		ctx.ellipse(0, 0, 22, 6, 0, 0, Math.PI * 2);
		ctx.fill();
	}

	ctx.translate(0, bob);

	// Glow around it, scaled by charge
	const glow = ctx.createRadialGradient(0, -30, 4, 0, -30, 70);
	glow.addColorStop(0, `rgba(61, 255, 110, ${0.45 * fill * pulse})`);
	glow.addColorStop(1, 'rgba(61, 255, 110, 0)');
	ctx.fillStyle = glow;
	ctx.beginPath();
	ctx.arc(0, -30, 70, 0, Math.PI * 2);
	ctx.fill();

	// Base
	ctx.fillStyle = BOTTLE_GREEN;
	ctx.beginPath();
	ctx.moveTo(-20, 0);
	ctx.lineTo(20, 0);
	ctx.lineTo(15, -8);
	ctx.lineTo(-15, -8);
	ctx.closePath();
	ctx.fill();

	// Glass body with the energy inside
	ctx.fillStyle = `rgba(61, 255, 110, ${0.25 + 0.6 * fill * pulse})`;
	ctx.fillRect(-11, -46, 22, 38);
	ctx.fillStyle = `rgba(234, 255, 240, ${0.5 * fill})`;
	ctx.fillRect(-4, -42, 8, 30);

	// Frame bars
	ctx.fillStyle = BOTTLE_GREEN;
	ctx.fillRect(-13, -48, 4, 42);
	ctx.fillRect(9, -48, 4, 42);
	ctx.fillRect(-1.5, -48, 3, 42);

	// Top cap and handle
	ctx.beginPath();
	ctx.moveTo(-16, -46);
	ctx.lineTo(16, -46);
	ctx.lineTo(10, -56);
	ctx.lineTo(-10, -56);
	ctx.closePath();
	ctx.fill();
	ctx.strokeStyle = BOTTLE_GREEN;
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.arc(0, -58, 8, Math.PI, 0);
	ctx.stroke();

	// Charge meter under the base
	ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
	ctx.fillRect(-20, 6, 40, 4);
	ctx.fillStyle = GREEN;
	ctx.fillRect(-20, 6, 40 * fill, 4);

	ctx.restore();
}

/** A wavy strand of energy from the battery to a charging Lantern. */
export function drawChargeLink(
	ctx: CanvasRenderingContext2D,
	b: Battery,
	onGround: boolean,
	tx: number,
	ty: number,
	time: number
) {
	const sx = b.x;
	const sy = b.y - 30 + (onGround ? 0 : Math.sin(time * 1.5) * 3 - 10);
	const len = Math.hypot(tx - sx, ty - sy);
	// Perpendicular direction, for the wobble
	const nx = -(ty - sy) / len;
	const ny = (tx - sx) / len;

	ctx.save();
	ctx.strokeStyle = 'rgba(61, 255, 110, 0.7)';
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 10;
	ctx.lineWidth = 2;
	ctx.beginPath();
	const steps = 14;
	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const wobble = Math.sin(t * Math.PI) * Math.sin(t * 12 - time * 14) * 5;
		const px = sx + (tx - sx) * t + nx * wobble;
		const py = sy + (ty - sy) * t + ny * wobble;
		if (i === 0) ctx.moveTo(px, py);
		else ctx.lineTo(px, py);
	}
	ctx.stroke();
	ctx.restore();
}

// ------------------------------------------------------------------- HUD

export interface HudSlot {
	name: string;
	/** Key that selects it, e.g. "1". */
	key: string;
	/** 0 = ready, 1 = just used. */
	cooldown: number;
	/** Enough willpower to use it right now. */
	affordable: boolean;
}

export interface HudPlayer {
	name: string;
	slot: number;
	willpower: number;
	exhausted: boolean;
	charging: boolean;
	slots: HudSlot[];
	selected: number;
}

/**
 * Willpower bar and construct slots, in screen space. Player 1 bottom-left,
 * player 2 bottom-right, so co-op players can each find their own.
 */
export function drawHud(ctx: CanvasRenderingContext2D, players: HudPlayer[], width: number, height: number, time: number) {
	const margin = 18;
	const box = 40;
	const gap = 5;
	const slotsW = 5 * box + 4 * gap;
	const barW = slotsW;
	const barH = 10;

	for (const p of players) {
		const right = p.slot === 1;
		const x = right ? width - margin - barW : margin;
		const slotsY = height - margin - box;
		const barY = slotsY - 14 - barH;
		const labelY = barY - 5;
		const low = p.exhausted || p.willpower < RESTART_THRESHOLD;

		ctx.save();

		// ---- Name and willpower number ----
		ctx.font = '600 12px system-ui, sans-serif';
		ctx.textBaseline = 'bottom';
		ctx.fillStyle = 'rgba(216, 245, 224, 0.9)';
		ctx.textAlign = 'left';
		ctx.fillText(`${p.name} · ${p.slots[p.selected].name}`, x, labelY);
		ctx.font = '11px ui-monospace, monospace';
		ctx.textAlign = 'right';
		ctx.fillStyle = low ? '#ffb86b' : 'rgba(216, 245, 224, 0.7)';
		ctx.fillText(`${p.charging ? '⚡ ' : ''}${p.exhausted ? 'EXHAUSTED ' : ''}${Math.floor(p.willpower)}`, x + barW, labelY);

		// ---- Willpower bar ----
		ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
		ctx.fillRect(x - 2, barY - 2, barW + 4, barH + 4);
		ctx.fillStyle = BOTTLE_GREEN;
		ctx.fillRect(x, barY, barW, barH);
		const blink = low && Math.sin(time * 10) > 0;
		ctx.fillStyle = blink ? '#ffb86b' : GREEN;
		ctx.shadowColor = GREEN;
		ctx.shadowBlur = low ? 0 : 8;
		ctx.fillRect(x, barY, barW * (p.willpower / MAX_WILLPOWER), barH);
		ctx.shadowBlur = 0;
		// Tick where exhaustion lifts
		ctx.fillStyle = 'rgba(216, 245, 224, 0.5)';
		ctx.fillRect(x + barW * (RESTART_THRESHOLD / MAX_WILLPOWER), barY, 1.5, barH);

		// ---- Construct slots ----
		p.slots.forEach((s, i) => {
			const sx = x + i * (box + gap);
			const selected = i === p.selected;
			ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
			ctx.fillRect(sx, slotsY, box, box);

			// Cooldown shade drains downward as it recharges
			if (s.cooldown > 0) {
				ctx.fillStyle = 'rgba(15, 79, 52, 0.85)';
				ctx.fillRect(sx, slotsY + box * (1 - s.cooldown), box, box * s.cooldown);
			}

			ctx.strokeStyle = selected ? GREEN : 'rgba(61, 255, 110, 0.25)';
			ctx.lineWidth = selected ? 2 : 1;
			if (selected) {
				ctx.shadowColor = GREEN;
				ctx.shadowBlur = 10;
			}
			ctx.strokeRect(sx + 0.5, slotsY + 0.5, box - 1, box - 1);
			ctx.shadowBlur = 0;

			// Short name in the middle, key number in the corner
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.font = '600 9px system-ui, sans-serif';
			ctx.fillStyle = s.affordable ? 'rgba(216, 245, 224, 0.95)' : 'rgba(216, 245, 224, 0.35)';
			ctx.fillText(abbreviate(s.name), sx + box / 2, slotsY + box / 2 + 3);
			ctx.textAlign = 'left';
			ctx.textBaseline = 'top';
			ctx.font = '9px ui-monospace, monospace';
			ctx.fillStyle = 'rgba(216, 245, 224, 0.55)';
			ctx.fillText(s.key, sx + 3, slotsY + 2);
		});

		ctx.restore();
	}
}

/** Fit a construct name in a small slot box. */
function abbreviate(name: string): string {
	const last = name.split(' ').pop() ?? name;
	return last.length > 7 ? last.slice(0, 6) + '.' : last;
}
