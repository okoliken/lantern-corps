// Every scene draws with the scene clock. A frame's timestamp can land a hair
// before the performance.now() the driver started from, so the clock briefly
// went negative and `(time * 0.3) % 1` (the Blood Altar ripples) came out
// negative — Chrome throws IndexSizeError on a negative ellipse radius and the
// finale went black. This runs every scene, including from a negative clock,
// and fails on any negative radius.

import { describe, expect, it } from 'vitest';
import { BloodOath } from './bloodOath';
import { BloodWorld } from './bloodWorld';
import { Confession } from './confession';
import { DeadSector } from './deadSector';
import { JohnChosen } from './johnChosen';
import { LastLight } from './lastLight';
import { OaLanding } from './oaLanding';
import { RedDawn } from './redDawn';
import { Summoned } from './summoned';
import { TheFirst } from './theFirst';
import { TheSignal } from './theSignal';
import { TheTrail } from './theTrail';
import type { DialogueScene, Line } from './scene';
import * as STORY from '../../story/scenes';

const bad: string[] = [];

function note(kind: string, rx: number, ry: number) {
	const where = (new Error().stack ?? '').split('\n').slice(3, 6).join(' | ');
	bad.push(`${kind} rx=${rx} ry=${ry} @ ${where}`);
}

const PATH_METHODS = ['moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo', 'arcTo', 'rect', 'roundRect', 'closePath'];

class FakePath {
	ellipse(_x: number, _y: number, rx: number, ry: number) {
		if (!(rx >= 0) || !(ry >= 0)) note('Path2D.ellipse', rx, ry);
	}
	arc(_x: number, _y: number, r: number) {
		if (!(r >= 0)) note('Path2D.arc', r, r);
	}
}
for (const m of PATH_METHODS) (FakePath.prototype as unknown as Record<string, () => void>)[m] = () => {};
globalThis.Path2D = FakePath as unknown as typeof Path2D;

/** A canvas context that draws nothing and complains about negative radii. */
function makeCtx(): CanvasRenderingContext2D {
	const gradient = { addColorStop() {} };
	const ctx: Record<string, unknown> = {
		canvas: { width: 1600, height: 900 },
		measureText: () => ({ width: 10 }),
		getLineDash: () => [],
		createLinearGradient: () => gradient,
		createRadialGradient: () => gradient,
		createConicGradient: () => gradient,
		createPattern: () => null,
		getImageData: () => ({ data: new Uint8ClampedArray(4) }),
		ellipse(_x: number, _y: number, rx: number, ry: number) {
			if (!(rx >= 0) || !(ry >= 0)) note('ellipse', rx, ry);
		},
		arc(_x: number, _y: number, r: number) {
			if (!(r >= 0)) note('arc', r, r);
		}
	};
	for (const m of ['save', 'restore', 'translate', 'scale', 'rotate', 'transform', 'setTransform', 'resetTransform', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo', 'arcTo', 'rect', 'roundRect', 'fill', 'stroke', 'clip', 'fillRect', 'strokeRect', 'clearRect', 'fillText', 'strokeText', 'setLineDash', 'drawImage', 'putImageData']) {
		ctx[m] = () => {};
	}
	return ctx as unknown as CanvasRenderingContext2D;
}

const SCENES: [string, (lines: Line[]) => DialogueScene, Line[]][] = [
	['JohnChosen', (l) => new JohnChosen(l), STORY.JOHN_CHOSEN],
	['Summoned', (l) => new Summoned(l), STORY.SUMMONED],
	['Confession', (l) => new Confession(l), STORY.CONFESSION],
	['TheSignal', (l) => new TheSignal(l), STORY.THE_SIGNAL],
	['TheFirst', (l) => new TheFirst(l), STORY.THE_FIRST],
	['RedDawn', (l) => new RedDawn(l), STORY.RED_DAWN],
	['TheTrail', (l) => new TheTrail(l), STORY.THE_TRAIL],
	['DeadSector', (l) => new DeadSector(l), STORY.DEAD_SECTOR],
	['BloodWorld', (l) => new BloodWorld(l), STORY.BLOOD_WORLD],
	['BloodOath', (l) => new BloodOath(l), STORY.BLOOD_OATH],
	['LastLight', (l) => new LastLight(l), STORY.LAST_LIGHT],
	['OaLanding', (l) => new OaLanding(l, 0.7), STORY.OA_LANDING]
];

const VIEW = { width: 1600, height: 900 } as never;

function play(scene: DialogueScene, clickEvery: number) {
	const ctx = makeCtx();
	// The first frame the driver saw: a timestamp a hair behind its own start
	scene.update(-0.0009);
	scene.draw(ctx, VIEW);
	for (let i = 0; i < 60 * 300 && !scene.done; i++) {
		scene.update(1 / 60);
		if (clickEvery && i % clickEvery === 0) scene.advance();
		scene.draw(ctx, VIEW);
	}
}

describe('story scenes never draw a negative radius', () => {
	for (const [name, make, lines] of SCENES) {
		for (const [how, clickEvery] of [
			['read through', 0],
			['clicked fast', 2]
		] as const) {
			it(`${name}, ${how}`, () => {
				bad.length = 0;
				play(make(lines), clickEvery);
				expect([...new Set(bad)].slice(0, 6)).toEqual([]);
			});
		}
	}
});
