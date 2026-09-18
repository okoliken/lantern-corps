// Ring energy and the things around it: the beam, the Lantern battery,
// the recharge link, and the HUD.

import { BATTERY_MAX_CHARGE, RESTART_THRESHOLD, type Battery } from '../willpower';
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

	// Energy spiralling around the beam: a sine wave travelling outward
	if (length > 10) {
		const nx = -dy;
		const ny = dx;
		ctx.strokeStyle = 'rgba(234, 255, 240, 0.55)';
		ctx.lineWidth = 1.2;
		for (const phase of [0, Math.PI]) {
			ctx.beginPath();
			for (let d = 0; d <= length; d += 6) {
				const wave = Math.sin(d * 0.08 - time * 30 + phase) * 4.5;
				const px = x + dx * d + nx * wave;
				const py = y + dy * d + ny * wave;
				if (d === 0) ctx.moveTo(px, py);
				else ctx.lineTo(px, py);
			}
			ctx.stroke();
		}
	}

	// Bloom where it leaves the ring
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 18;
	ctx.fillStyle = '#eafff0';
	ctx.beginPath();
	ctx.arc(x, y, 4 + Math.sin(time * 50) * 1, 0, Math.PI * 2);
	ctx.fill();

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
	/** Short label for inside the slot box. */
	short: string;
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
	/** Shown next to the name when progression is on. */
	level: number | null;
	health: number;
	maxHealth: number;
	downed: boolean;
	downTimer: number;
	willpower: number;
	maxWillpower: number;
	exhausted: boolean;
	charging: boolean;
	slots: HudSlot[];
	selected: number;
	shield: { key: string; cooldown: number; affordable: boolean; active: boolean };
	/** Signature ability meter. */
	surge: { fill: number; name: string; key: string; active: boolean };
	/** What they're targeting, e.g. "🔒 Dummy · 🛡 John Stewart". */
	targetLabel: string;
}

/**
 * Willpower bar and construct slots, in screen space. Player 1 bottom-left,
 * player 2 bottom-right, so co-op players can each find their own.
 */
export function drawHud(ctx: CanvasRenderingContext2D, players: HudPlayer[], width: number, height: number, time: number) {
	const margin = 18;
	const count = players[0]?.slots.length ?? 10;
	const gap = 4;
	// Construct slots, a gap, then the shield box. Smaller boxes when two HUDs share a narrow screen.
	const room = width / Math.max(1, players.length) - margin * 2 - 30;
	const box = Math.max(24, Math.min(38, Math.floor((room - count * gap - 8) / (count + 1))));
	const slotsW = (count + 1) * box + count * gap + 8;
	const barW = slotsW;
	const barH = 10;

	for (const p of players) {
		const right = p.slot === 1;
		const x = right ? width - margin - barW : margin;
		const slotsY = height - margin - box;
		const surgeY = slotsY - 11;
		const barY = surgeY - 8 - barH;
		const healthY = barY - 9;
		const labelY = healthY - 5;
		const low = p.exhausted || p.willpower < RESTART_THRESHOLD;

		ctx.save();

		// ---- Name and willpower number ----
		ctx.font = '600 12px system-ui, sans-serif';
		ctx.textBaseline = 'bottom';
		ctx.fillStyle = 'rgba(216, 245, 224, 0.9)';
		ctx.textAlign = 'left';
		const level = p.level !== null ? ` · Lv ${p.level}` : '';
		ctx.fillText(`${p.name}${level} · ${p.slots[p.selected].name}`, x, labelY);
		ctx.font = '11px ui-monospace, monospace';
		ctx.textAlign = 'right';
		ctx.fillStyle = low ? '#ffb86b' : 'rgba(216, 245, 224, 0.7)';
		ctx.fillText(`${p.charging ? '⚡ ' : ''}${p.exhausted ? 'EXHAUSTED ' : ''}${Math.floor(p.willpower)}`, x + barW, labelY);

		// ---- Health bar: thin, red, above willpower ----
		const hurtFrac = p.health / p.maxHealth;
		ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
		ctx.fillRect(x - 1, healthY - 1, barW + 2, 7);
		ctx.fillStyle = '#3a0c0c';
		ctx.fillRect(x, healthY, barW, 5);
		ctx.fillStyle = hurtFrac < 0.3 && Math.sin(time * 10) > 0 ? '#ff9a9a' : '#ff3b3b';
		ctx.fillRect(x, healthY, barW * hurtFrac, 5);

		// ---- Willpower bar ----
		ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
		ctx.fillRect(x - 2, barY - 2, barW + 4, barH + 4);
		ctx.fillStyle = BOTTLE_GREEN;
		ctx.fillRect(x, barY, barW, barH);
		const blink = low && Math.sin(time * 10) > 0;
		ctx.fillStyle = blink ? '#ffb86b' : GREEN;
		ctx.shadowColor = GREEN;
		ctx.shadowBlur = low ? 0 : 8;
		ctx.fillRect(x, barY, barW * (p.willpower / p.maxWillpower), barH);
		ctx.shadowBlur = 0;
		// Tick where exhaustion lifts
		ctx.fillStyle = 'rgba(216, 245, 224, 0.5)';
		ctx.fillRect(x + barW * (RESTART_THRESHOLD / p.maxWillpower), barY, 1.5, barH);

		// ---- Surge meter: thin bar under willpower; glows and names the ability when full ----
		const ready = p.surge.fill >= 1;
		ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
		ctx.fillRect(x - 1, surgeY - 1, barW + 2, 7);
		const surgeGrad = ctx.createLinearGradient(x, 0, x + barW, 0);
		surgeGrad.addColorStop(0, '#9cffb8');
		surgeGrad.addColorStop(1, '#eafff0');
		ctx.fillStyle = surgeGrad;
		if (ready) {
			ctx.shadowColor = GREEN;
			ctx.shadowBlur = 10 + Math.sin(time * 6) * 6;
		}
		ctx.fillRect(x, surgeY, barW * p.surge.fill, 5);
		ctx.shadowBlur = 0;
		ctx.font = '700 10px system-ui, sans-serif';
		ctx.textBaseline = 'bottom';
		if (ready || p.surge.active) {
			ctx.textAlign = 'center';
			ctx.fillStyle = GREEN;
			const pulse = 0.7 + 0.3 * Math.sin(time * 6);
			ctx.globalAlpha = p.surge.active ? 1 : pulse;
			const label = p.surge.active ? `${p.surge.name.toUpperCase()}!` : `${p.surge.key}  ${p.surge.name.toUpperCase()} READY`;
			ctx.fillText(label, x + barW / 2, surgeY - 1);
			ctx.globalAlpha = 1;
		}

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
			ctx.font = `600 ${box < 34 ? 8 : 9}px system-ui, sans-serif`;
			ctx.fillStyle = s.affordable ? 'rgba(216, 245, 224, 0.95)' : 'rgba(216, 245, 224, 0.35)';
			ctx.fillText(abbreviate(s.short, box < 34 ? 6 : 7), sx + box / 2, slotsY + box / 2 + 3);
			// The key, big enough to read at a glance (with quick cast it's the button that fires it)
			ctx.textAlign = 'left';
			ctx.textBaseline = 'top';
			ctx.font = '800 11px ui-monospace, monospace';
			ctx.fillStyle = selected ? GREEN : 'rgba(216, 245, 224, 0.8)';
			ctx.fillText(s.key, sx + 3, slotsY + 2);
		});

		// ---- Shield box ----
		const shx = x + p.slots.length * (box + gap) + 8;
		ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
		ctx.fillRect(shx, slotsY, box, box);
		if (p.shield.cooldown > 0) {
			ctx.fillStyle = 'rgba(15, 79, 52, 0.85)';
			ctx.fillRect(shx, slotsY + box * (1 - p.shield.cooldown), box, box * p.shield.cooldown);
		}
		// Bubble icon, bright while a shield is up on you
		ctx.strokeStyle = p.shield.active ? GREEN : p.shield.affordable ? 'rgba(61, 255, 110, 0.7)' : 'rgba(61, 255, 110, 0.25)';
		ctx.lineWidth = 2;
		if (p.shield.active) {
			ctx.shadowColor = GREEN;
			ctx.shadowBlur = 10;
		}
		ctx.beginPath();
		ctx.arc(shx + box / 2, slotsY + box / 2 + 2, 11, 0, Math.PI * 2);
		ctx.stroke();
		ctx.shadowBlur = 0;
		ctx.strokeStyle = 'rgba(61, 255, 110, 0.4)';
		ctx.lineWidth = 1;
		ctx.strokeRect(shx + 0.5, slotsY + 0.5, box - 1, box - 1);
		ctx.textAlign = 'left';
		ctx.textBaseline = 'top';
		ctx.font = '9px ui-monospace, monospace';
		ctx.fillStyle = 'rgba(216, 245, 224, 0.55)';
		ctx.fillText(p.shield.key, shx + 3, slotsY + 2);

		// ---- Target line above the name ----
		if (p.targetLabel) {
			ctx.font = '11px system-ui, sans-serif';
			ctx.textAlign = 'left';
			ctx.textBaseline = 'bottom';
			ctx.fillStyle = 'rgba(216, 245, 224, 0.75)';
			ctx.fillText(`◎ ${p.targetLabel}`, x, labelY - 16);
		}

		ctx.restore();
	}
}

/** Fit a construct name in a small slot box. */
function abbreviate(name: string, max = 7): string {
	const last = name.split(' ').pop() ?? name;
	return last.length > max ? last.slice(0, max - 1) + '.' : last;
}

/**
 * The mouse crosshair: a ring with a gap-cross and a centre dot, dark outline
 * underneath so it stays visible on any background.
 */
export function drawCrosshair(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
	const r = 10 + Math.sin(time * 4) * 0.8;
	ctx.save();
	ctx.lineCap = 'round';
	for (const [color, width] of [
		['rgba(0, 0, 0, 0.7)', 4],
		[GREEN, 2]
	] as const) {
		ctx.strokeStyle = color;
		ctx.lineWidth = width;
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI * 2);
		ctx.stroke();
		ctx.beginPath();
		for (const [dx, dy] of [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1]
		]) {
			ctx.moveTo(x + dx * (r - 4), y + dy * (r - 4));
			ctx.lineTo(x + dx * (r + 6), y + dy * (r + 6));
		}
		ctx.stroke();
	}
	ctx.fillStyle = '#eafff0';
	ctx.beginPath();
	ctx.arc(x, y, 1.8, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

/** Big centred notice while a Lantern is down. */
export function drawDownedNotice(ctx: CanvasRenderingContext2D, name: string, secondsLeft: number, width: number, height: number) {
	ctx.save();
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = 'rgba(40, 0, 0, 0.25)';
	ctx.fillRect(0, 0, width, height);
	ctx.font = '900 28px system-ui, sans-serif';
	ctx.lineWidth = 6;
	ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
	ctx.fillStyle = '#ff5a5a';
	ctx.strokeText(`${name.toUpperCase()} IS DOWN`, width / 2, height * 0.38);
	ctx.fillText(`${name.toUpperCase()} IS DOWN`, width / 2, height * 0.38);
	ctx.font = '600 15px system-ui, sans-serif';
	ctx.fillStyle = '#ffe0e0';
	ctx.strokeText(`Back up in ${Math.ceil(secondsLeft)}…`, width / 2, height * 0.38 + 30);
	ctx.fillText(`Back up in ${Math.ceil(secondsLeft)}…`, width / 2, height * 0.38 + 30);
	ctx.restore();
}
