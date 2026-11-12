// Season three's story scenes (Parallax): one before every episode. Each is a
// place and a cast on marks; the lines are in story/scenes.ts.

import { OA_GROUND, drawOaBackdrop } from '../draw/oa';
import { THE_GALA, THE_STUDY } from '../../story/scenes';
import { CastScene } from './cast';
import { drawGuardian, drawGuardianDais } from './summoned';
import { drawStudiedLantern } from '../missions/studied';
import { drawParallax } from '../draw/parallax';
import { STAGE_GROUND, STAGE_H, STAGE_W, drawFerrisAirfield } from '../draw/stages';
import { FIGURE_HEIGHT, drawLantern, ringPosition, type Figure as LanternFigure, type LanternPose } from '../draw/lantern';
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

/** The first Lanterns, each from a different world: Sinestro's story is of a whole Corps, not five shadows. */
const OLD_LANTERNS: { figure: LanternFigure; scale: number }[] = [
	// A Bolovaxian, bigger than Kilowog
	{ figure: { id: 'old0', look: { skin: '#6f9a8c', hair: '#6f9a8c', hairStyle: 'cropped', mask: false, bolovaxian: true }, bulk: 1.7 }, scale: 1.55 },
	// Avian, crested, from a world near Xudar
	{ figure: { id: 'old1', look: { skin: '#5e86b8', hair: '#d9e4ef', hairStyle: 'cropped', mask: false, avian: { beak: '#e8c060', crest: '#d9e4ef' } }, bulk: 0.9 }, scale: 1.3 },
	// A pale woman with pointed ears and a black bob
	{ figure: { id: 'old2', look: { skin: '#cbb8e0', hair: '#191424', hairStyle: 'bob', mask: true, pointedEars: true }, bulk: 0.9 }, scale: 1.25 },
	// Red-skinned and bald, Abin Sur's people
	{ figure: { id: 'old3', look: { skin: '#b23a48', hair: '#b23a48', hairStyle: 'cropped', mask: false }, bulk: 1.05 }, scale: 1.35 },
	// Golden-skinned, swept white hair, masked
	{ figure: { id: 'old4', look: { skin: '#d6a24a', hair: '#f2ece0', hairStyle: 'swept', mask: true }, bulk: 1 }, scale: 1.3 }
];

/** Where the Lantern's anchor sits so their body is centred on (x, y). */
const oldAnchor = (i: number, y: number) => y + (FIGURE_HEIGHT * OLD_LANTERNS[i].scale) / 2;

function oldPose(dir: 1 | -1, aim: { x: number; y: number }, firing: boolean, struggle: number, falling: boolean): LanternPose {
	return {
		dir,
		walkPhase: 0,
		altitude: 1,
		hoverHeight: 0,
		lean: falling ? 0 : 0.55,
		glow: !falling,
		shadow: false,
		firing,
		aimX: aim.x,
		aimY: aim.y,
		shotKick: firing ? 0.25 : 0,
		hurt: struggle,
		downed: false
	};
}

/** One of the first Lanterns; `light` 1 fighting, 0 drained to grey. Returns where their ring is. */
function oldLantern(ctx: CanvasRenderingContext2D, i: number, x: number, y: number, light: number, aim: { x: number; y: number }, firing: boolean, struggle: number, spin: number, t: number): [number, number] {
	const { figure, scale } = OLD_LANTERNS[i];
	const dir: 1 | -1 = aim.x >= 0 ? 1 : -1;
	const pose = oldPose(dir, aim, firing, struggle, spin !== 0);
	const ay = oldAnchor(i, y);
	// Writhing in its grip
	const shake = struggle > 0 && light > 0 ? Math.sin(t * 31 + i) * 3 * struggle : 0;
	ctx.save();
	ctx.translate(x + shake, y);
	ctx.rotate(spin);
	ctx.translate(-x, -y);
	const base = ctx.globalAlpha;
	if (light < 1) drawLantern(ctx, { ...figure, corps: 'spent' }, x, ay, pose, t, scale);
	if (light > 0) {
		ctx.globalAlpha = base * light;
		drawLantern(ctx, figure, x, ay, pose, t, scale);
	}
	ctx.restore();
	return ringPosition(x, ay, pose, t, scale);
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

/** A Guardian of the old days, both arms raised, pouring will out of their hands. Returns where the light leaves them. */
function oldGuardian(ctx: CanvasRenderingContext2D, x: number, y: number, power: number, t: number): [number, number] {
	const S = 1.7;
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(S, S);
	ctx.translate(-x, -y);
	drawGuardian(ctx, x, y, 0, 0, t);
	const lift = 74 + power * 6 + Math.sin(t * 6) * 1.5;
	ctx.lineCap = 'round';
	for (const side of [-1, 1]) {
		ctx.strokeStyle = '#050101';
		ctx.lineWidth = 6;
		ctx.beginPath();
		ctx.moveTo(x + side * 10, y - 40);
		ctx.quadraticCurveTo(x + side * 20, y - 56, x + side * 13, y - lift);
		ctx.stroke();
		// Red sleeve, then the blue hand
		ctx.strokeStyle = '#a3201c';
		ctx.lineWidth = 4;
		ctx.stroke();
		ctx.fillStyle = '#4f86c6';
		ctx.beginPath();
		ctx.arc(x + side * 13, y - lift, 3, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();
	}
	ctx.globalCompositeOperation = 'lighter';
	const g = ctx.createRadialGradient(x, y - lift - 4, 0, x, y - lift - 4, 22);
	g.addColorStop(0, `rgba(220, 255, 225, ${0.8 * power})`);
	g.addColorStop(1, 'rgba(60, 255, 110, 0)');
	ctx.fillStyle = g;
	ctx.beginPath();
	ctx.arc(x, y - lift - 4, 22, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
	return [x, y - (lift + 4) * S];
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
			const aim = { x: dx / n, y: dy / n };
			if (drained > 0 && drained < 1) {
				ctx.save();
				ctx.globalCompositeOperation = 'lighter';
				ctx.strokeStyle = `rgba(255, 220, 120, ${0.8 * (1 - drained)})`;
				ctx.lineWidth = 4;
				ctx.beginPath();
				ctx.arc(x, y, 40 + drained * 80, 0, Math.PI * 2);
				ctx.stroke();
				ctx.restore();
			}
			const spin = fall > 0 ? (fromLeft ? -1 : 1) * fall * 3 : 0;
			const [rx, ry] = oldLantern(ctx, i, x, y, 1 - drained, aim, firing, held, spin, t);
			if (firing) {
				beam(ctx, rx, ry, PX.x - aim.x * 60, PX.y - aim.y * 50, 1, t + i);
				hit += 0.25;
			}
		}
		drawParallax(ctx, PX.x, PX.y, 1.05, t, { grabs, hit: Math.min(1, hit) * 0.6, rage: beat === 1 ? 1 : 0.4 });
	} else {
		// The Guardians pull it down into the battery
		const pull = clamp((k - 0.6) / 2.4);
		const sealed = k >= 3.2;
		const guardians = [260, 370, 480];
		for (const [i, gx] of guardians.entries()) {
			const [hx, hy] = oldGuardian(ctx, gx, 690 + Math.sin(t * 1.3 + i * 2) * 4, 1, t + i);
			beam(ctx, hx, hy, BATTERY.x - 40, BATTERY.y - 30, sealed ? 0.4 : 1, t + gx);
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
