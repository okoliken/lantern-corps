// Start of Act 2, Mission 2: the ring carries John Stewart across the galaxy.
// Earth falls away behind him, the stars stretch into lines, and Oa rises
// ahead: the towers, the Central Battery. He comes down on the plaza in front
// of the Guardians, with Tomar-Re, Kilowog and Hal Jordan waiting.

import { HOVER_SPACE, drawLantern, type LanternPose } from '../draw/lantern';
import { OA_GROUND, OA_H, OA_W, drawLandingDust, drawOaBackdrop } from '../draw/oa';
import { LANTERNS } from '../lanterns';
import { green, greenCore } from '../../theme';
import { TOMAR_RE } from './oaLanding';
import { DialogueScene, type Line } from './scene';

const TAU = Math.PI * 2;
// ---- The timeline, in seconds ----
/** Leaving Earth, then the jump, then Oa ahead. */
const JUMP = [2.6, 5.2];
const OA_APPEARS = 5.2;
const JOHN_LANDS = [5.6, 8.2];
const TALK_STARTS = 8.8;

const FIGURE_SCALE = 1.4;
const JOHN_SPOT = 560;
const HAL_SPOT = 800;
const KILOWOG_SPOT = 960;
const TOMAR_SPOT = 1110;
/** The Guardians' dais, at the back of the plaza. */
const DAIS = { x: 300, y: OA_GROUND - 40 };

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const phase = (t: number, [a, b]: number[]) => clamp01((t - a) / (b - a));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function seeded(seed: number) {
	let s = seed;
	return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const rand = seeded(2814);
const STARS = Array.from({ length: 160 }, () => ({ x: rand() * OA_W, y: rand() * OA_H, r: rand() * 1.4 + 0.3, depth: 0.3 + rand() * 0.7 }));

export class Summoned extends DialogueScene {
	protected readonly stage = { width: OA_W, height: OA_H };
	protected readonly talkStarts = TALK_STARTS;
	/** The Guardians go cold when the Manhunters are mentioned. */
	private chill = 0;

	constructor(lines: Line[]) {
		super(lines);
	}

	protected tick(dt: number) {
		const target = this.lines.slice(0, this.line + 1).some((l) => l.mood === 'alarm') ? 1 : 0;
		this.chill += (target - this.chill) * Math.min(1, dt * 1.5);
	}

	protected drawStage(ctx: CanvasRenderingContext2D, t: number) {
		if (t < OA_APPEARS) {
			this.drawFlight(ctx, t);
			return;
		}
		drawOaBackdrop(ctx, t, 0);
		this.drawDais(ctx, t);
		this.drawWelcome(ctx, t);
		drawLandingDust(ctx, JOHN_SPOT, (t - JOHN_LANDS[1]) / 1.2);
		this.drawJohn(ctx, t);
		// Out of the jump: a flash that clears
		const flash = 1 - clamp01((t - OA_APPEARS) / 0.8);
		if (flash > 0) {
			ctx.fillStyle = greenCore(flash);
			ctx.fillRect(0, 0, OA_W, OA_H + 400);
		}
	}

	// ---------------------------------------------------------------- flight

	/** Space: Earth shrinking behind him, then the stars stretching into the jump. */
	private drawFlight(ctx: CanvasRenderingContext2D, t: number) {
		const jump = phase(t, JUMP);
		ctx.fillStyle = '#02040a';
		ctx.fillRect(0, 0, OA_W, OA_H + 400);

		// Stars: points at first, long streaks toward the middle of the screen in the jump
		const cx = OA_W / 2;
		const cy = OA_H / 2;
		for (const s of STARS) {
			const dx = s.x - cx;
			const dy = s.y - cy;
			const stretch = jump ** 2 * 240 * s.depth;
			const d = Math.hypot(dx, dy) || 1;
			ctx.strokeStyle = `rgba(215, 235, 255, ${0.35 + 0.5 * s.depth})`;
			ctx.lineWidth = s.r;
			ctx.beginPath();
			ctx.moveTo(s.x, s.y);
			ctx.lineTo(s.x + (dx / d) * (stretch + 1), s.y + (dy / d) * (stretch + 1));
			ctx.stroke();
		}

		// Earth, falling away behind him
		const away = easeOut(clamp01(t / JUMP[0]));
		const r = lerp(330, 26, away);
		const ex = lerp(330, 240, away);
		const ey = lerp(620, 470, away);
		if (jump < 0.9) {
			ctx.save();
			ctx.globalAlpha = 1 - jump;
			const globe = ctx.createRadialGradient(ex - r * 0.35, ey - r * 0.35, r * 0.1, ex, ey, r);
			globe.addColorStop(0, '#6fb8ff');
			globe.addColorStop(0.55, '#1f5fb0');
			globe.addColorStop(1, '#061a3a');
			ctx.fillStyle = globe;
			ctx.beginPath();
			ctx.arc(ex, ey, r, 0, TAU);
			ctx.fill();
			// Land and cloud, roughly
			ctx.save();
			ctx.clip();
			ctx.fillStyle = 'rgba(70, 150, 90, 0.75)';
			for (const [lx, ly, lw, lh] of [
				[-0.35, -0.2, 0.42, 0.3],
				[0.15, 0.1, 0.36, 0.42],
				[-0.1, 0.45, 0.3, 0.2]
			]) {
				ctx.beginPath();
				ctx.ellipse(ex + lx * r, ey + ly * r, lw * r, lh * r, 0.5, 0, TAU);
				ctx.fill();
			}
			ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
			for (const [lx, ly, lw] of [
				[-0.2, -0.5, 0.5],
				[0.3, -0.1, 0.4],
				[-0.4, 0.3, 0.45]
			]) {
				ctx.beginPath();
				ctx.ellipse(ex + lx * r, ey + ly * r, lw * r, lw * r * 0.22, -0.3, 0, TAU);
				ctx.fill();
			}
			ctx.restore();
			// Atmosphere
			ctx.strokeStyle = 'rgba(140, 200, 255, 0.5)';
			ctx.lineWidth = Math.max(1, r * 0.03);
			ctx.beginPath();
			ctx.arc(ex, ey, r, 0, TAU);
			ctx.stroke();
			ctx.restore();
		}

		// John: a green comet climbing away, then held in the middle of the jump
		const jx = lerp(420, cx, easeOut(clamp01(t / 2.2)));
		const jy = lerp(520, cy - 20, easeOut(clamp01(t / 2.2)));
		const trail = ctx.createLinearGradient(jx - 260, jy + 130, jx, jy);
		trail.addColorStop(0, green(0));
		trail.addColorStop(1, green(0.55));
		ctx.strokeStyle = trail;
		ctx.lineWidth = 22;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(jx - 260, jy + 130);
		ctx.lineTo(jx, jy);
		ctx.stroke();
		const aura = ctx.createRadialGradient(jx, jy - 30, 6, jx, jy - 30, 120 + jump * 80);
		aura.addColorStop(0, greenCore(0.5 + 0.4 * jump));
		aura.addColorStop(0.4, green(0.35));
		aura.addColorStop(1, green(0));
		ctx.fillStyle = aura;
		ctx.beginPath();
		ctx.arc(jx, jy - 30, 120 + jump * 80, 0, TAU);
		ctx.fill();
		drawLantern(ctx, LANTERNS.john, jx, jy + 20, { ...basePose(1), altitude: 1, lean: 1, glow: true, shadow: false, firing: true, aimX: 0.9, aimY: -0.45 }, t, FIGURE_SCALE);

		// Into the jump: everything goes to light
		if (jump > 0.75) {
			ctx.fillStyle = greenCore((jump - 0.75) / 0.25);
			ctx.fillRect(0, 0, OA_W, OA_H + 400);
		}
	}

	// ------------------------------------------------------------------- Oa

	/** The Guardians on their dais at the back of the plaza: small, blue, in red robes, watching. */
	private drawDais(ctx: CanvasRenderingContext2D, t: number) {
		const { x, y } = DAIS;
		// The dais: a stepped platform with light in its seams
		ctx.fillStyle = '#13201b';
		ctx.strokeStyle = green(0.35);
		ctx.lineWidth = 2;
		for (const [w, h, dy] of [
			[330, 26, 40],
			[260, 22, 18],
			[190, 20, -2]
		]) {
			ctx.beginPath();
			ctx.rect(x - w / 2, y + dy, w, h);
			ctx.fill();
			ctx.stroke();
		}
		const speaking = this.current?.who === 'guardian';
		[-62, 0, 62].forEach((dx, i) => {
			const bob = Math.sin(t * 1.3 + i * 2) * 3;
			drawGuardian(ctx, x + dx, y - 6 + bob - (i === 1 ? 10 : 0), i === 1 && speaking ? 1 : 0, this.chill, t + i);
		});
	}

	/** Hal, Kilowog and Tomar-Re, waiting on the plaza. */
	private drawWelcome(ctx: CanvasRenderingContext2D, t: number) {
		const l = this.current;
		const grin = l?.who === 'hal' && l.mood === 'grin' ? 1 : 0;
		drawLantern(ctx, TOMAR_RE, TOMAR_SPOT, OA_GROUND, basePose(-1), t, FIGURE_SCALE);
		const k = LANTERNS.kilowog;
		drawLantern(ctx, k, KILOWOG_SPOT, OA_GROUND, { ...basePose(-1), build: k.build, hunch: k.hunch }, t, FIGURE_SCALE * (k.figureScale ?? 1));
		drawLantern(ctx, LANTERNS.hal, HAL_SPOT, OA_GROUND, { ...basePose(-1), victory: grin }, t, FIGURE_SCALE);
	}

	private drawJohn(ctx: CanvasRenderingContext2D, t: number) {
		const p = phase(t, JOHN_LANDS);
		// Down out of the sky in a column of the ring's light, onto the plaza
		const x = lerp(JOHN_SPOT - 120, JOHN_SPOT, easeOut(p));
		const y = lerp(-80, OA_GROUND, easeOut(p));
		const altitude = p < 0.85 ? 1 : 1 - (p - 0.85) / 0.15;
		if (altitude > 0) {
			const beam = ctx.createLinearGradient(x - 50, 0, x + 50, 0);
			beam.addColorStop(0, green(0));
			beam.addColorStop(0.5, greenCore(0.35 * altitude));
			beam.addColorStop(1, green(0));
			ctx.fillStyle = beam;
			ctx.fillRect(x - 50, -100, 100, y + 100);
		}
		const l = this.current;
		const salute = l?.who === 'john' && l.mood === 'salute';
		const pose: LanternPose = {
			...basePose(p >= 1 ? (this.current?.who === 'guardian' ? -1 : 1) : 1),
			altitude,
			lean: altitude * 0.4,
			glow: altitude > 0,
			shadow: altitude < 0.3,
			firing: salute,
			aimX: salute ? 0.35 : 1,
			aimY: salute ? -0.95 : 0
		};
		drawLantern(ctx, LANTERNS.john, x, y, pose, t, FIGURE_SCALE);
	}
}

/** A Guardian of the Universe: small, blue, white-haired, in a red robe with the Corps' symbol, floating. */
function drawGuardian(ctx: CanvasRenderingContext2D, x: number, y: number, speaking: number, chill: number, time: number) {
	ctx.save();
	ctx.translate(x, y);
	// The glow they float in: warm normally, cold white when they close ranks
	const glow = ctx.createRadialGradient(0, -34, 4, 0, -34, 70);
	glow.addColorStop(0, chill > 0.5 ? `rgba(220, 235, 255, ${0.3 + 0.15 * speaking})` : green(0.25 + 0.2 * speaking));
	glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
	ctx.fillStyle = glow;
	ctx.beginPath();
	ctx.arc(0, -34, 70, 0, TAU);
	ctx.fill();
	// Robe: a long red bell with a white collar, the symbol on the chest
	ctx.fillStyle = '#a3201c';
	ctx.strokeStyle = '#050101';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.moveTo(-11, -46);
	ctx.quadraticCurveTo(-22, -10, -19, 6);
	ctx.lineTo(19, 6);
	ctx.quadraticCurveTo(22, -10, 11, -46);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#f4efe2';
	ctx.beginPath();
	ctx.ellipse(0, -46, 12, 4.5, 0, 0, TAU);
	ctx.fill();
	ctx.fillStyle = '#e9f7ea';
	ctx.beginPath();
	ctx.arc(0, -26, 5.5, 0, TAU);
	ctx.fill();
	ctx.fillStyle = '#0F4F34';
	ctx.beginPath();
	ctx.arc(0, -26, 3.6, 0, TAU);
	ctx.fill();
	// Head: big, blue, bald on top with white hair round the sides
	ctx.fillStyle = '#f2f2f2';
	ctx.beginPath();
	ctx.ellipse(0, -60, 15, 11, 0, 0, TAU);
	ctx.fill();
	ctx.fillStyle = '#4f86c6';
	ctx.strokeStyle = '#050101';
	ctx.beginPath();
	ctx.ellipse(0, -62, 11.5, 13, 0, 0, TAU);
	ctx.fill();
	ctx.stroke();
	// Eyes: calm, and narrowed when they go cold
	ctx.fillStyle = '#0b1420';
	const lid = 1.8 - chill * 1.1;
	for (const side of [-1, 1]) {
		ctx.beginPath();
		ctx.ellipse(side * 4.4, -62, 2.2, Math.max(0.5, lid), 0, 0, TAU);
		ctx.fill();
	}
	ctx.strokeStyle = '#1a3352';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(-3.5, -54.5);
	ctx.lineTo(3.5, -54.5 + (speaking ? Math.sin(time * 12) * 0.8 : 0));
	ctx.stroke();
	ctx.restore();
}

function basePose(dir: 1 | -1): LanternPose {
	return { dir, walkPhase: 0, altitude: 0, hoverHeight: HOVER_SPACE, lean: 0, glow: false, shadow: true, firing: false, aimX: dir, aimY: 0 };
}
