// Season two's story scenes: one before every episode, and the ending. Each
// is a place (draw/stages.ts, or Oa and Detroit from season one) and a cast
// on marks; the lines are in story/scenes.ts.

import { drawDetroit, ROOF } from '../draw/earth';
import { drawLantern, type Figure as LanternFigure } from '../draw/lantern';
import { OA_GROUND, drawOaBackdrop } from '../draw/oa';
import {
	STAGE_GROUND as G,
	drawCentralCity,
	drawCoastHarbour,
	drawFerrisAirfield,
	drawGorillaCrate,
	drawGothamRoof,
	drawKorugarCitadel,
	drawQwardRift,
	drawRain,
	drawSpaceOverVesk,
	drawStorm,
	drawStormRig,
	drawTeleport,
	drawWatchtowerDeck
} from '../draw/stages';
import { LANTERNS } from '../lanterns';
import {
	A_LANTERN_IN_YELLOW,
	BAIT,
	DEAD_CRANE,
	DREAMS_WITH_TEETH,
	LEAGUE_INVITE,
	SIDE_BY_SIDE,
	SEA_COMING_IN,
	SINESTROS_WORLD,
	STILL_BURNING,
	THE_CITADEL,
	THE_NARROWS,
	THE_OTHER_SIDE,
	UNDER_SINESTRO,
	YELLOW_RINGS
} from '../../story/scenes';
import { CastScene, type Actor } from './cast';
import { drawGuardianDais } from './summoned';

/** The Guardians on their dais, the middle one speaking for them all. */
const guardians = (x: number, chill: number): Actor => ({
	speaker: 'guardian',
	figure: { draw: (ctx, gx, gy, _pose, t, speaking) => drawGuardianDais(ctx, gx, gy, t, speaking, chill) },
	marks: [{ x, y: OA_GROUND - 40 }]
});

/** The share of the way through a line someone's on (0 if it isn't theirs). */
const saying = (scene: CastScene, who: string) => (scene.speaking === who ? 1 : 0);

export const leagueInvite = () =>
	new CastScene(LEAGUE_INVITE, {
		talkStarts: 2.2,
		backdrop: (ctx, t) => drawWatchtowerDeck(ctx, t),
		front: (ctx, t) => drawTeleport(ctx, 380, G, (t - 0.3) / 1.4),
		cast: [
			{ speaker: 'john', figure: { lantern: 'john' }, hidden: true, marks: [{ x: 380, y: G, dir: 1 }, { at: 0.9, x: 380, y: G, dir: 1 }] },
			{ speaker: 'superman', figure: { hero: 'superman' }, marks: [{ x: 720, y: G, dir: -1 }] },
			{ speaker: 'wonderwoman', figure: { hero: 'wonderwoman' }, marks: [{ x: 850, y: G + 20, dir: -1 }] },
			// The Flash is somewhere else until he isn't
			{ speaker: 'flash', figure: { hero: 'flash' }, marks: [{ x: 1520, y: G + 40, dir: -1 }, { line: 3, x: 560, y: G + 40, time: 0.25 }] },
			{ speaker: 'hawkgirl', figure: { hero: 'hawkgirl' }, marks: [{ x: 1060, y: G - 10, lift: 90, dir: -1 }, { line: 6, x: 1000, y: G - 10, lift: 0, time: 1 }] }
		]
	});

export const underSinestro = () =>
	new CastScene(UNDER_SINESTRO, {
		talkStarts: 2.6,
		space: true,
		backdrop: (ctx, t) => drawSpaceOverVesk(ctx, t, 1),
		cast: [
			{ speaker: 'sinestro', figure: { lantern: 'sinestro' }, marks: [{ x: -200, y: 300, lift: 60 }, { at: 0.2, x: 820, y: 330, lift: 60, time: 2.2 }, { line: 7, x: 1300, y: 760, lift: 60, time: 1.4 }] },
			{ speaker: 'hal', figure: { lantern: 'hal' }, marks: [{ x: -300, y: 420, lift: 60 }, { at: 0.5, x: 580, y: 400, lift: 60, time: 2.2 }, { line: 7, x: 1150, y: 820, lift: 60, time: 1.7 }] },
			{ speaker: 'kilowog', figure: { lantern: 'kilowog' }, marks: [{ x: -320, y: 560, lift: 60 }, { at: 0.7, x: 520, y: 540, lift: 60, time: 2.2 }, { line: 7, x: 1100, y: 900, lift: 60, time: 1.9 }] }
		]
	});

export const deadCrane = () =>
	new CastScene(DEAD_CRANE, {
		talkStarts: 2.4,
		backdrop: (ctx, t) => drawCoastHarbour(ctx, t, 0.6),
		cast: [
			// Under the far end of the container, holding it up
			{ speaker: 'superman', figure: { hero: 'superman' }, pose: { firing: true, aimX: -0.15, aimY: -1 }, marks: [{ x: 640, y: G - 34, dir: -1 }] },
			{ speaker: 'john', figure: { lantern: 'john' }, marks: [{ x: 260, y: G + 40, lift: 420, dir: 1 }, { at: 0.4, x: 330, y: G + 40, lift: 0, time: 1.6, dir: 1 }] }
		]
	});

export const seaComingIn = () =>
	new CastScene(SEA_COMING_IN, {
		talkStarts: 2.4,
		backdrop: (ctx, t, scene) => drawStormRig(ctx, t, saying(scene, 'manta')),
		front: (ctx, t) => drawStorm(ctx, t),
		cast: [
			{ speaker: 'john', figure: { lantern: 'john' }, marks: [{ x: 300, y: G + 40, lift: 300, dir: 1 }, { at: 0.3, x: 520, y: G + 40, lift: 0, time: 1.8, dir: 1 }] },
			// Up out of the sea and over the rail
			{ speaker: 'aquaman', figure: { hero: 'aquaman' }, hidden: true, marks: [{ x: 1000, y: G + 40, lift: 170, dir: -1 }, { line: 1, x: 1000, y: G + 40, lift: 170, dir: -1 }, { wait: 0.15, x: 820, y: G + 40, lift: 0, time: 1, dir: -1 }] }
		]
	});

export const sinestrosWorld = () =>
	new CastScene(SINESTROS_WORLD, {
		talkStarts: 2,
		backdrop: (ctx, t) => drawOaBackdrop(ctx, t, 0),
		cast: [
			guardians(300, 0.6),
			{ speaker: 'hal', figure: { lantern: 'hal' }, marks: [{ x: 680, y: OA_GROUND, dir: -1 }] },
			{ speaker: 'kilowog', figure: { lantern: 'kilowog' }, marks: [{ x: 880, y: OA_GROUND, dir: -1 }] }
		]
	});

export const theNarrows = () =>
	new CastScene(THE_NARROWS, {
		talkStarts: 2.6,
		backdrop: (ctx, t, scene) => drawGothamRoof(ctx, t, 0.5 + 0.5 * saying(scene, 'scarecrow')),
		front: (ctx, t) => drawRain(ctx, t),
		cast: [
			{ speaker: 'batman', figure: { hero: 'batman' }, marks: [{ x: 300, y: G + 20, dir: 1 }] },
			{ speaker: 'john', figure: { lantern: 'john' }, marks: [{ x: 900, y: G + 20, lift: 380, dir: -1 }, { at: 0.5, x: 720, y: G + 20, lift: 0, time: 1.8, dir: -1 }] }
		]
	});

export const theOtherSide = () =>
	new CastScene(THE_OTHER_SIDE, {
		talkStarts: 2,
		space: true,
		backdrop: (ctx, t) => drawQwardRift(ctx, t),
		cast: [
			{ speaker: 'hal', figure: { lantern: 'hal' }, marks: [{ x: 460, y: 420, lift: 60, dir: 1 }, { line: 6, x: 1000, y: 400, lift: 60, time: 2.2 }] },
			{ speaker: 'kilowog', figure: { lantern: 'kilowog' }, marks: [{ x: 600, y: 540, lift: 60, dir: 1 }, { line: 6, x: 1000, y: 430, lift: 60, time: 1.8 }] }
		]
	});

export const bait = () =>
	new CastScene(BAIT, {
		talkStarts: 2.2,
		backdrop: (ctx, t, scene) => {
			drawCentralCity(ctx, t, 0);
			drawGorillaCrate(ctx, 420, G - 40, t);
			drawGorillaCrate(ctx, 1180, G - 30, t);
			// Grodd's voice in John's head: the world goes violet at the edges
			const k = saying(scene, 'grodd');
			if (k) {
				const v = ctx.createRadialGradient(700, 400, 200, 700, 400, 900);
				v.addColorStop(0, 'rgba(150, 90, 255, 0)');
				v.addColorStop(1, `rgba(150, 90, 255, ${0.45 + 0.1 * Math.sin(t * 5)})`);
				ctx.fillStyle = v;
				ctx.fillRect(0, 0, 1400, 1200);
			}
		},
		cast: [
			{ speaker: 'john', figure: { lantern: 'john' }, marks: [{ x: 640, y: G + 40, dir: 1 }] },
			{ speaker: 'flash', figure: { hero: 'flash' }, marks: [{ x: 860, y: G + 30, dir: -1 }] },
			{ speaker: 'hawkgirl', figure: { hero: 'hawkgirl' }, marks: [{ x: 1300, y: G - 20, lift: 300, dir: -1 }, { at: 0.3, x: 1020, y: G + 10, lift: 0, time: 1.6, dir: -1 }] }
		]
	});

/** Hal off duty at Ferris Air: the flight jacket, until the ring calls. */
const HAL_PILOT: LanternFigure = {
	id: 'hal',
	look: { ...LANTERNS.hal.look, mask: false },
	outfit: { top: '#6b4a2f', topLit: '#8f6844', trousers: '#2f3a4a', boots: '#2a221c' }
};

export const aLanternInYellow = () =>
	new CastScene(A_LANTERN_IN_YELLOW, {
		talkStarts: 3,
		backdrop: (ctx, t, scene) => drawFerrisAirfield(ctx, t, saying(scene, 'ring')),
		cast: [
			{
				speaker: 'hal',
				figure: { draw: (ctx, x, y, pose, t, _speaking, scale) => drawLantern(ctx, HAL_PILOT, x, y, { ...pose, firing: false }, t, scale) },
				changes: { line: 6, figure: { lantern: 'hal' } },
				marks: [{ x: 330, y: G + 30, dir: 1 }, { at: 0.3, x: 760, y: G + 30, time: 2.6 }, { line: 6, x: 1300, y: G - 200, lift: 420, time: 2.4 }]
			}
		]
	});

/** Detroit from John's roof; the ground there is the roof's. */
export const dreamsWithTeeth = () =>
	new CastScene(DREAMS_WITH_TEETH, {
		talkStarts: 2.4,
		backdrop: (ctx, t, scene) => {
			drawDetroit(ctx, t, 0);
			// The riverfront glowing yellow below the skyline, worse when Ray cries out
			const k = 0.35 + 0.4 * saying(scene, 'ray');
			const y = ctx.createLinearGradient(0, ROOF - 160, 0, ROOF);
			y.addColorStop(0, 'rgba(255, 210, 58, 0)');
			y.addColorStop(1, `rgba(255, 210, 58, ${k * (0.8 + 0.2 * Math.sin(t * 3))})`);
			ctx.fillStyle = y;
			ctx.fillRect(0, ROOF - 160, 1400, 160);
		},
		cast: [
			{ speaker: 'john', figure: { lantern: 'john' }, marks: [{ x: 560, y: ROOF + 40, dir: 1 }] },
			{ speaker: 'wonderwoman', figure: { hero: 'wonderwoman' }, marks: [{ x: 1200, y: ROOF + 30, lift: 360, dir: -1 }, { at: 0.2, x: 820, y: ROOF + 30, lift: 0, time: 1.8, dir: -1 }] }
		]
	});

/** Yellow rings streaking across Oa's sky, out to find their bearers. */
function drawRingsFlyingOut(ctx: CanvasRenderingContext2D, t: number) {
	ctx.save();
	ctx.lineCap = 'round';
	for (let i = 0; i < 14; i++) {
		const k = (t * 0.25 + i * 0.137) % 1;
		const x = -100 + k * 1600;
		const y = 60 + ((i * 97) % 300) - k * 60;
		ctx.strokeStyle = 'rgba(255, 210, 58, 0.4)';
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.moveTo(x - 70, y + 14);
		ctx.lineTo(x, y);
		ctx.stroke();
		ctx.fillStyle = '#ffe57a';
		ctx.beginPath();
		ctx.arc(x, y, 3, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.restore();
}

export const yellowRings = () =>
	new CastScene(YELLOW_RINGS, {
		talkStarts: 2,
		backdrop: (ctx, t) => {
			drawOaBackdrop(ctx, t, 0);
			drawRingsFlyingOut(ctx, t);
		},
		cast: [
			guardians(300, 0.8),
			{ speaker: 'hal', figure: { lantern: 'hal' }, hurt: 0.35, marks: [{ x: 700, y: OA_GROUND, dir: -1 }] },
			{ speaker: 'kilowog', figure: { lantern: 'kilowog' }, marks: [{ x: 900, y: OA_GROUND, dir: -1 }] }
		]
	});

export const sideBySide = () =>
	new CastScene(SIDE_BY_SIDE, {
		talkStarts: 2.4,
		backdrop: (ctx, t, scene) => drawWatchtowerDeck(ctx, t, scene.line >= 4 ? 1 : 0),
		cast: [
			{ speaker: 'john', figure: { lantern: 'john' }, marks: [{ x: 560, y: G + 30, dir: 1 }] },
			{ speaker: 'hal', figure: { lantern: 'hal' }, marks: [{ x: 1500, y: G + 30, lift: 260, dir: -1 }, { at: 0.2, x: 820, y: G + 30, lift: 0, time: 1.9, dir: -1 }] }
		]
	});

export const theCitadel = () =>
	new CastScene(THE_CITADEL, {
		talkStarts: 3,
		backdrop: (ctx, t) => drawKorugarCitadel(ctx, t, 1),
		cast: [
			{ speaker: 'kilowog', figure: { lantern: 'kilowog' }, marks: [{ x: -100, y: G + 30 }, { at: 0.3, x: 260, y: G + 30, time: 2.4, dir: 1 }] },
			{ speaker: 'hal', figure: { lantern: 'hal' }, marks: [{ x: -60, y: G + 60 }, { at: 0.2, x: 430, y: G + 60, time: 2.4, dir: 1 }] },
			{ speaker: 'john', figure: { lantern: 'john' }, marks: [{ x: -120, y: G + 10 }, { at: 0.5, x: 360, y: G + 10, time: 2.4, dir: 1 }] },
			{ speaker: 'sinestro', figure: { enemy: 'sinestroYellow' }, marks: [{ x: 880, y: G + 20, lift: 140, dir: -1 }] }
		]
	});

/** The ending: Sinestro beaten in his own plaza, and the lantern behind him still burning. */
export const stillBurning = () =>
	new CastScene(STILL_BURNING, {
		talkStarts: 2.4,
		backdrop: (ctx, t, scene) => drawKorugarCitadel(ctx, t, 0.6 + (scene.line >= 2 ? 0.4 : 0)),
		cast: [
			{ speaker: 'sinestro', figure: { enemy: 'sinestroYellow' }, downed: true, marks: [{ x: 760, y: G + 40, dir: -1 }] },
			{ speaker: 'kilowog', figure: { lantern: 'kilowog' }, marks: [{ x: 320, y: G + 30, dir: 1 }] },
			{ speaker: 'john', figure: { lantern: 'john' }, marks: [{ x: 460, y: G + 60, dir: 1 }] },
			{ speaker: 'hal', figure: { lantern: 'hal' }, aimUp: true, marks: [{ x: 580, y: G + 20, dir: 1 }] }
		]
	});
