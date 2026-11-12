// Season three's story scenes (Parallax): one before every episode. Each is a
// place and a cast on marks; the lines are in story/scenes.ts.

import { OA_GROUND, drawOaBackdrop } from '../draw/oa';
import { THE_GALA, THE_STUDY } from '../../story/scenes';
import { CastScene } from './cast';
import { drawGuardianDais } from './summoned';
import { drawStudiedLantern } from '../missions/studied';
import { drawParallax } from '../draw/parallax';
import { STAGE_GROUND, STAGE_H, STAGE_W, drawFerrisAirfield } from '../draw/stages';
import { drawLantern, type Figure as LanternFigure } from '../draw/lantern';
import { LANTERNS } from '../lanterns';
import { GUESTS, drawCarol, drawGuest, drawJet } from '../missions/gala';
import { createEnemy } from '../enemies/enemies';
import { drawEnemy } from '../draw/enemies';

/** Bars of green light across a Sciencell door. */
function cellBars(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
	ctx.save();
	ctx.fillStyle = 'rgba(10, 30, 20, 0.35)';
	ctx.fillRect(x - 90, y - 260, 180, 260);
	ctx.globalCompositeOperation = 'lighter';
	for (let i = 0; i < 6; i++) {
		ctx.fillStyle = `rgba(90, 255, 150, ${0.35 + 0.15 * Math.sin(time * 3 + i)})`;
		ctx.fillRect(x - 80 + i * 32, y - 255, 6, 255);
	}
	ctx.restore();
	ctx.strokeStyle = '#0b0b0d';
	ctx.lineWidth = 5;
	ctx.strokeRect(x - 90, y - 260, 180, 260);
}

/** The lines Sinestro tells the old war over: the flashback runs across them. */
const FLASH_FROM = 2;
const FLASH_TO = 4;

const clamp = (v: number) => Math.max(0, Math.min(1, v));

/** One of the first Lanterns, a dark shape lit by their ring; `light` 1 green, 0 drained grey. */
function oldLantern(ctx: CanvasRenderingContext2D, x: number, y: number, light: number, aim: { x: number; y: number } | null, spin: number, t: number) {
	const glow = light > 0.05 ? `rgba(${Math.round(150 - 90 * light)}, ${Math.round(150 + 105 * light)}, ${Math.round(150 - 30 * light)}, ` : 'rgba(150, 150, 150, ';
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(spin);
	ctx.scale(1.8, 1.8);
	ctx.globalCompositeOperation = 'lighter';
	const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 46);
	g.addColorStop(0, glow + `${0.35 * light + 0.05})`);
	g.addColorStop(1, glow + '0)');
	ctx.fillStyle = g;
	ctx.beginPath();
	ctx.arc(0, 0, 46, 0, Math.PI * 2);
	ctx.fill();
	ctx.globalCompositeOperation = 'source-over';
	ctx.fillStyle = '#100d08';
	ctx.strokeStyle = glow + `${0.4 + 0.6 * light})`;
	ctx.lineWidth = 2.5;
	// Body flying flat out, legs trailing
	ctx.beginPath();
	ctx.ellipse(0, 4, 9, 22, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(0, -24, 8, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();
	ctx.lineWidth = 6;
	ctx.strokeStyle = '#100d08';
	ctx.beginPath();
	ctx.moveTo(-4, 22);
	ctx.lineTo(-7, 40 + Math.sin(t * 8) * 3);
	ctx.moveTo(4, 22);
	ctx.lineTo(6, 40 + Math.cos(t * 8) * 3);
	ctx.stroke();
	// Ring arm out at the target
	const ax = aim ? aim.x : 1;
	const ay = aim ? aim.y : 0.6;
	ctx.beginPath();
	ctx.moveTo(0, -10);
	ctx.lineTo(ax * 26, -10 + ay * 26);
	ctx.stroke();
	ctx.fillStyle = glow + `${0.5 + 0.5 * light})`;
	ctx.beginPath();
	ctx.arc(ax * 28, -10 + ay * 28, 4, 0, Math.PI * 2);
	ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

function beam(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, a: number, t: number) {
	ctx.save();
	ctx.globalCompositeOperation = 'lighter';
	ctx.lineCap = 'round';
	ctx.strokeStyle = `rgba(60, 255, 110, ${0.35 * a})`;
	ctx.lineWidth = 16;
	ctx.beginPath();
	ctx.moveTo(x0, y0);
	ctx.lineTo(x1, y1);
	ctx.stroke();
	ctx.strokeStyle = `rgba(220, 255, 230, ${0.8 * a})`;
	ctx.lineWidth = 4;
	ctx.stroke();
	const r = 24 + 8 * Math.sin(t * 20);
	const g = ctx.createRadialGradient(x1, y1, 0, x1, y1, r);
	g.addColorStop(0, `rgba(230, 255, 220, ${0.8 * a})`);
	g.addColorStop(1, 'rgba(60, 255, 110, 0)');
	ctx.fillStyle = g;
	ctx.beginPath();
	ctx.arc(x1, y1, r, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

/** A Guardian of the old days, robed, hands raised. */
function oldGuardian(ctx: CanvasRenderingContext2D, x: number, y: number, power: number) {
	ctx.fillStyle = '#7f2a2a';
	ctx.beginPath();
	ctx.moveTo(x - 18, y);
	ctx.lineTo(x - 10, y - 46);
	ctx.lineTo(x + 10, y - 46);
	ctx.lineTo(x + 18, y);
	ctx.fill();
	ctx.fillStyle = '#5d8fd0';
	ctx.beginPath();
	ctx.arc(x, y - 56, 12, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = '#5d8fd0';
	ctx.lineWidth = 5;
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(x - 8, y - 40);
	ctx.lineTo(x - 16, y - 68 - power * 8);
	ctx.moveTo(x + 8, y - 40);
	ctx.lineTo(x + 16, y - 68 - power * 8);
	ctx.stroke();
}

/** Where the five Lanterns hold in the air while they fight it. */
const SQUAD = [
	{ x: 330, y: 200 },
	{ x: 420, y: 420 },
	{ x: 260, y: 560 },
	{ x: 1120, y: 230 },
	{ x: 1080, y: 500 }
];
const PX = { x: 760, y: 330 };
const BATTERY = { x: 760, y: 640 };

/** The old war, over the whole stage, line by line: they fight it, it takes them, the Guardians lock it away. */
function drawFlashback(ctx: CanvasRenderingContext2D, t: number, line: number, age: number) {
	const a = line === FLASH_FROM ? clamp(age / 0.6) : line === FLASH_TO + 1 ? 1 - clamp(age / 0.6) : line > FLASH_FROM && line <= FLASH_TO ? 1 : 0;
	if (a <= 0) return;
	ctx.save();
	ctx.globalAlpha = a;
	// A memory: old gold and black
	const bg = ctx.createRadialGradient(PX.x, PX.y, 40, PX.x, PX.y, STAGE_W * 0.75);
	bg.addColorStop(0, '#3a2608');
	bg.addColorStop(0.5, '#160e04');
	bg.addColorStop(1, '#050302');
	ctx.fillStyle = bg;
	ctx.fillRect(0, 0, STAGE_W, STAGE_H);
	ctx.fillStyle = 'rgba(255, 230, 170, 0.5)';
	for (let i = 0; i < 70; i++) {
		const h = Math.sin(i * 12.9898) * 43758.5453;
		const sx = (h - Math.floor(h)) * STAGE_W;
		const v = Math.sin(i * 78.233) * 12543.137;
		const sy = (v - Math.floor(v)) * STAGE_H;
		ctx.fillRect(sx, sy, 2, 2);
	}

	// Which beat: 0 the fight, 1 the taking, 2 the sealing (holding the last beat as it fades out)
	const beat = Math.min(line, FLASH_TO) - FLASH_FROM;
	const k = line > FLASH_TO ? 1 : age;

	if (beat < 2) {
		// Lanterns: they fly in and fire, then one by one it takes them
		const grabs: { x: number; y: number; k: number }[] = [];
		let hit = 0;
		for (const [i, m] of SQUAD.entries()) {
			const fromLeft = m.x < PX.x;
			const arrive = beat === 0 ? clamp((k - i * 0.25) / 0.9) : 1;
			if (arrive <= 0) continue;
			let x = (fromLeft ? -60 : STAGE_W + 60) + (m.x - (fromLeft ? -60 : STAGE_W + 60)) * (1 - (1 - arrive) ** 2);
			let y = m.y + Math.sin(t * 2 + i) * 8;
			// Taken at its moment in the second beat: reached, drained, dropped
			const takenAt = 0.3 + i * 0.55;
			const held = beat === 1 ? clamp((k - takenAt) / 0.4) : 0;
			const drained = beat === 1 ? clamp((k - takenAt - 0.4) / 0.8) : 0;
			const fall = beat === 1 ? Math.max(0, k - takenAt - 1.3) : 0;
			if (held > 0 && fall <= 0) {
				// Dragged in toward it
				x += (PX.x - x) * 0.25 * drained;
				y += (PX.y - y) * 0.25 * drained;
				grabs.push({ x, y, k: held });
			}
			y += fall * fall * 500;
			if (y > STAGE_H + 80) continue;
			const firing = arrive >= 1 && held < 1;
			const dx = PX.x - x;
			const dy = PX.y - y;
			const n = Math.hypot(dx, dy) || 1;
			if (firing) {
				beam(ctx, x + (dx / n) * 28, y - 10 + (dy / n) * 28, PX.x - (dx / n) * 60, PX.y - (dy / n) * 50, 1, t + i);
				hit += 0.25;
			}
			if (drained > 0 && drained < 1) {
				ctx.save();
				ctx.globalCompositeOperation = 'lighter';
				ctx.strokeStyle = `rgba(255, 220, 120, ${0.8 * (1 - drained)})`;
				ctx.lineWidth = 4;
				ctx.beginPath();
				ctx.arc(x, y, 30 + drained * 70, 0, Math.PI * 2);
				ctx.stroke();
				ctx.restore();
			}
			oldLantern(ctx, x, y, 1 - drained, { x: dx / n, y: dy / n }, (fromLeft ? 1 : -1) * (0.9 + fall * 3), t);
		}
		drawParallax(ctx, PX.x, PX.y, 1.05, t, { grabs, hit: Math.min(1, hit) * 0.6, rage: beat === 1 ? 1 : 0.4 });
	} else {
		// The Guardians pull it down into the battery
		const pull = clamp((k - 0.6) / 2.4);
		const sealed = k >= 3.2;
		const guardians = [300, 390, 480];
		for (const gx of guardians) {
			oldGuardian(ctx, gx, 720, 1);
			beam(ctx, gx + 12, 650, BATTERY.x - 40, BATTERY.y - 30, sealed ? 0.4 : 1, t + gx);
		}
		drawBatteryShape(ctx, BATTERY.x, BATTERY.y, t, sealed ? 1 : 0.5 + 0.3 * Math.sin(t * 10));
		if (!sealed) {
			const s = 1.05 * (1 - pull * 0.9);
			const py = PX.y + (BATTERY.y - 60 - PX.y) * pull * pull;
			drawParallax(ctx, PX.x, py, s, t, { rage: 1, hit: pull, grabs: [{ x: BATTERY.x, y: BATTERY.y, k: 1 }] });
		} else {
			// The slam: a flash, then the yellow stain left inside
			const f = clamp(1 - (k - 3.2) / 0.8);
			ctx.globalCompositeOperation = 'lighter';
			ctx.fillStyle = `rgba(200, 255, 210, ${0.7 * f})`;
			ctx.fillRect(0, 0, STAGE_W, STAGE_H);
			ctx.globalCompositeOperation = 'source-over';
			ctx.fillStyle = `rgba(255, 200, 40, ${0.55 + 0.2 * Math.sin(t * 4)})`;
			ctx.beginPath();
			ctx.ellipse(BATTERY.x, BATTERY.y - 50, 22, 30, 0, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	// The memory's edge
	const v = ctx.createRadialGradient(STAGE_W / 2, STAGE_H / 2, STAGE_H * 0.35, STAGE_W / 2, STAGE_H / 2, STAGE_W * 0.65);
	v.addColorStop(0, 'rgba(0, 0, 0, 0)');
	v.addColorStop(1, 'rgba(0, 0, 0, 0.75)');
	ctx.fillStyle = v;
	ctx.fillRect(0, 0, STAGE_W, STAGE_H);
	ctx.fillStyle = 'rgba(255, 220, 150, 0.8)';
	ctx.font = 'bold 22px system-ui, sans-serif';
	ctx.fillText('LONG AGO', 36, 52);
	ctx.restore();
}

/** The Central Battery, as it stood when it was new. */
function drawBatteryShape(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, glow: number) {
	ctx.save();
	ctx.globalCompositeOperation = 'lighter';
	const g = ctx.createRadialGradient(x, y - 50, 10, x, y - 50, 200);
	g.addColorStop(0, `rgba(120, 255, 150, ${0.5 * glow})`);
	g.addColorStop(1, 'rgba(60, 255, 110, 0)');
	ctx.fillStyle = g;
	ctx.beginPath();
	ctx.arc(x, y - 50, 200, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
	ctx.fillStyle = '#1d2a22';
	ctx.strokeStyle = '#0b0b0d';
	ctx.lineWidth = 5;
	ctx.beginPath();
	ctx.rect(x - 70, y - 130, 140, 130);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = `rgba(110, 255, 150, ${0.5 + 0.4 * glow})`;
	ctx.fillRect(x - 54, y - 116, 108, 100);
	ctx.fillStyle = '#1d2a22';
	ctx.fillRect(x - 84, y - 146, 168, 18);
	ctx.fillRect(x - 84, y - 2, 168, 18);
	ctx.strokeRect(x - 84, y - 146, 168, 18);
	ctx.strokeRect(x - 84, y - 2, 168, 18);
	void t;
}

export const theStudy = () =>
	new CastScene(THE_STUDY, {
		talkStarts: 2.2,
		backdrop: (ctx, t) => {
			drawOaBackdrop(ctx, t, 0);
			// The lantern in its ring, at the back of the plaza
			ctx.save();
			ctx.translate(820, OA_GROUND - 40);
			ctx.scale(0.7, 0.7);
			drawStudiedLantern(ctx, 0, 0, t, 0.85, 9, 9, 0);
			ctx.restore();
		},
		// Sinestro behind the bars of his cell
		front: (ctx, t, scene) => {
			cellBars(ctx, 1200, OA_GROUND + 10, t);
			drawFlashback(ctx, t, scene.line, scene.lineAge);
		},
		cast: [
			{ speaker: 'guardian', figure: { draw: (ctx, gx, gy, _pose, t, speaking) => drawGuardianDais(ctx, gx, gy, t, speaking, 0) }, marks: [{ x: 560, y: OA_GROUND - 40 }] },
			{ speaker: 'kilowog', figure: { lantern: 'kilowog' }, marks: [{ x: 240, y: OA_GROUND + 30, dir: 1 }] },
			{ speaker: 'hal', figure: { lantern: 'hal' }, marks: [{ x: 380, y: OA_GROUND + 40, dir: 1 }] },
			{ speaker: 'sinestro', figure: { enemy: 'sinestro' }, marks: [{ x: 1200, y: OA_GROUND, dir: -1 }] }
		]
	});

// ------------------------------------------------------------- episode 2

const G = STAGE_GROUND;
/** Hal at the gala: no mask, a dinner jacket. */
const HAL_TUX: LanternFigure = {
	id: 'hal',
	look: { ...LANTERNS.hal.look, mask: false },
	outfit: { top: '#16161c', topLit: '#2c2c36', trousers: '#121216', boots: '#0b0b0d' }
};
/** The jet he lifts, where it's parked, and where it ends up (in the hangar wall). */
const GALA_JET = { x: 980, y: G + 125 };
const GALA_WRECK = { x: 330, y: G + 30 };

/** The jet through the scene: parked, lifted by his mind (line 3), flung into the hangar (line 4), burning there after. */
function galaJet(ctx: CanvasRenderingContext2D, t: number, line: number, age: number) {
	ctx.save();
	if (line < 3) drawScaledJet(ctx, GALA_JET.x, GALA_JET.y, 0, 0, false, false);
	else if (line === 3) {
		const alt = Math.min(240, age * 110);
		drawScaledJet(ctx, GALA_JET.x + Math.sin(t * 7) * 6, GALA_JET.y, alt, Math.sin(t * 3) * 0.12, false, true);
	} else {
		const k = line === 4 ? Math.min(1, Math.max(0, (age - 0.6) / 0.7)) : 1;
		if (k < 1) {
			const x = GALA_JET.x + (GALA_WRECK.x - GALA_JET.x) * k * k;
			drawScaledJet(ctx, x, GALA_JET.y + (GALA_WRECK.y - GALA_JET.y) * k, 240 - 140 * k, k * 2.4, false, true);
		} else {
			drawScaledJet(ctx, GALA_WRECK.x, GALA_WRECK.y, 60, 0.5, true, false);
			const since = line === 4 ? age - 1.3 : 9;
			// The crash: a flash and a fireball, then it burns
			if (since < 0.8) {
				ctx.globalCompositeOperation = 'lighter';
				const r = 80 + since * 260;
				const g = ctx.createRadialGradient(GALA_WRECK.x, GALA_WRECK.y - 90, 0, GALA_WRECK.x, GALA_WRECK.y - 90, r);
				g.addColorStop(0, `rgba(255, 240, 200, ${1 - since})`);
				g.addColorStop(0.5, `rgba(255, 140, 40, ${0.8 * (1 - since)})`);
				g.addColorStop(1, 'rgba(255, 80, 0, 0)');
				ctx.fillStyle = g;
				ctx.beginPath();
				ctx.arc(GALA_WRECK.x, GALA_WRECK.y - 90, r, 0, Math.PI * 2);
				ctx.fill();
				ctx.globalCompositeOperation = 'source-over';
			}
			for (let i = 0; i < 5; i++) {
				const fx = GALA_WRECK.x - 60 + i * 30;
				const h = 30 + 20 * Math.sin(t * 9 + i * 2);
				ctx.fillStyle = `rgba(255, ${120 + i * 20}, 30, 0.75)`;
				ctx.beginPath();
				ctx.moveTo(fx - 14, GALA_WRECK.y - 70);
				ctx.quadraticCurveTo(fx, GALA_WRECK.y - 70 - h * 2, fx + 14, GALA_WRECK.y - 70);
				ctx.fill();
			}
		}
	}
	ctx.restore();
}

function drawScaledJet(ctx: CanvasRenderingContext2D, x: number, y: number, alt: number, tilt: number, wreck: boolean, held: boolean) {
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(1.5, 1.5);
	drawJet(ctx, 0, 0, alt / 1.5, tilt, -1, wreck, held);
	ctx.restore();
}

/** The guests on the apron behind them: champagne, then panic. */
function galaGuests(ctx: CanvasRenderingContext2D, t: number, line: number) {
	GUESTS.slice(0, 12).forEach((g, i) => {
		const x = 700 + ((i * 97) % 520);
		const y = G - 20 + ((i * 37) % 50);
		ctx.save();
		ctx.translate(x, y);
		ctx.scale(1.25, 1.25);
		drawGuest(ctx, 0, 0, g, t, line >= 3, i);
		ctx.restore();
	});
}

export const theGala = () => {
	const hammond = createEnemy('hammond', 1250, G + 40);
	hammond.dir = -1;
	return new CastScene(THE_GALA, {
		talkStarts: 2,
		backdrop: (ctx, t, scene) => {
			drawFerrisAirfield(ctx, t, 0);
			galaGuests(ctx, t, scene.line);
		},
		front: (ctx, t, scene) => {
			galaJet(ctx, t, scene.line, scene.lineAge);
			// His mind reaching out, a yellow shimmer over everything while he speaks
			if (scene.line === 3 || scene.line === 4) {
				ctx.fillStyle = `rgba(255, 210, 70, ${0.05 + 0.04 * Math.sin(t * 6)})`;
				ctx.fillRect(0, 0, STAGE_W, STAGE_H);
			}
		},
		cast: [
			{
				speaker: 'carol',
				figure: {
					draw: (ctx, x, y, _pose, t, _speaking, scale) => {
						ctx.save();
						ctx.translate(x, y);
						ctx.scale(scale * 1.3, scale * 1.3);
						drawCarol(ctx, 0, 0, 0, t, false, false);
						ctx.restore();
					}
				},
				marks: [{ x: 560, y: G + 40, dir: 1 }, { line: 5, x: 760, y: G + 30, time: 1.4, dir: -1 }]
			},
			{
				speaker: 'hal',
				figure: { draw: (ctx, x, y, pose, t, _speaking, scale) => drawLantern(ctx, HAL_TUX, x, y, { ...pose, firing: false }, t, scale) },
				changes: { line: 5, figure: { lantern: 'hal' } },
				marks: [{ x: 680, y: G + 50, dir: 1 }, { line: 5, x: 900, y: G + 40, lift: 220, time: 1.6, dir: 1 }]
			},
			{
				speaker: 'hammond',
				figure: {
					draw: (ctx, x, y, _pose, t, speaking, scale) => {
						hammond.brain.state = speaking ? 'act' : 'idle';
						ctx.save();
						ctx.translate(x, y);
						ctx.scale(scale * 0.72, scale * 0.72);
						drawEnemy(ctx, hammond, 0, 0, true, t, false);
						ctx.restore();
					}
				},
				marks: [{ x: 1200, y: G + 40, dir: -1 }]
			}
		]
	});
};
