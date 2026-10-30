// Other Green Lanterns from the show, drawn on the Lantern skeleton:
// Kilowog (the drill sergeant) and the Corps-green tint for a Lantern's
// constructs when one is sparring against you.

import type { Tint } from '../enemies/enemies';
import type { LanternPose } from '../animation';
import { LANTERNS } from '../lanterns';
import { drawLantern, ringPosition, FIGURE_HEIGHT, GREEN, type Figure } from './lantern';
import { computeSkeleton, turnScale } from '../animation';
import { drawChpBody, drawGnortBody, drawGuyBody, drawSalaakBody } from './league';

export type CorpsKind = 'kilowog' | 'sinestro' | 'sparArisia' | 'sparKatma' | 'sparBoodikka' | 'sparHal' | 'sparJohn' | 'tomarSpar' | 'guySpar' | 'kyleSpar' | 'chpSpar' | 'salaakSpar' | 'gnortSpar' | 'enforcer' | 'fearGrunt' | 'scarecrow' | 'thug' | 'weaponer' | 'sinestroYellow' | 'frightened' | 'arkillo';

interface CorpsFigure {
	figure: Figure;
	/** Size next to Hal and John. */
	scale: number;
	build: { leg: number; torso: number; arm: number; neck: number };
	hunch: number;
}

const CORPS: Record<CorpsKind, CorpsFigure> = {
	/**
	 * Kilowog of Bolovax Vik: enormous. A barrel chest and gut, arms like tree
	 * trunks, short thick legs, a small bald head sunk into his shoulders.
	 */
	kilowog: {
		figure: LANTERNS.kilowog,
		scale: LANTERNS.kilowog.figureScale!,
		build: LANTERNS.kilowog.build!,
		hunch: LANTERNS.kilowog.hunch!
	},
	/**
	 * Sinestro of Korugar, the Corps' greatest Lantern (for now): tall and lean,
	 * magenta skin, black hair slicked to a widow's peak, a pencil mustache.
	 */
	sinestro: {
		figure: { id: 'sinestro', look: { skin: '#c4427a', hair: '#141018', hairStyle: 'peak', mask: false, mustache: true }, bulk: 0.95 },
		scale: 1.12,
		build: { leg: 1.12, torso: 1.05, arm: 1.08, neck: 1.1 },
		hunch: -0.04
	},
	/**
	 * Sinestro's police on Korugar (season two): Korugarians, magenta like him,
	 * in his black-and-purple uniform and a dark helmet. No ring: his weapons.
	 */
	enforcer: {
		figure: {
			id: 'enforcer',
			look: { skin: '#b84a82', hair: '#141018', hairStyle: 'cropped', mask: false },
			outfit: { top: '#2a1838', topLit: '#4b2a63', trousers: '#140c1c', boots: '#0b070f', hardHat: '#1c1026' }
		},
		scale: 1,
		build: { leg: 1.05, torso: 1, arm: 1, neck: 1.05 },
		hunch: 0
	},
	/**
	 * A soldier of the Sinestro Corps (season two): an alien the yellow ring
	 * chose for the fear it could cause, in Sinestro's gold and black.
	 */
	fearGrunt: {
		figure: { id: 'fearGrunt', look: { skin: '#7d93a3', hair: '#1a1f26', hairStyle: 'cropped', mask: true }, corps: 'yellow', bulk: 1.05 },
		scale: 1.04,
		build: { leg: 1, torso: 1.05, arm: 1.05, neck: 0.95 },
		hunch: 0.04
	},
	/** Scarecrow: the burlap mask, straw sticking out of it, a battered hat and a long coat. */
	scarecrow: {
		figure: {
			id: 'scarecrow',
			look: { skin: '#b69660', hair: '#d9c27a', hairStyle: 'swept', mask: true },
			outfit: { top: '#4a3b26', topLit: '#6e5a3a', trousers: '#2e2a22', boots: '#1d1812', hardHat: '#3a2e1e' }
		},
		scale: 1.08,
		build: { leg: 1.15, torso: 0.95, arm: 1.1, neck: 1.15 },
		hunch: 0.08
	},
	/** A Gotham thug: a hoodie, jeans, a cap pulled down. */
	thug: {
		figure: {
			id: 'thug',
			look: { skin: '#c99a76', hair: '#2a2420', hairStyle: 'cropped', mask: false },
			outfit: { top: '#3d4450', topLit: '#58606e', trousers: '#2b3346', boots: '#16161a', hardHat: '#20232a' }
		},
		scale: 1,
		build: { leg: 1, torso: 1.05, arm: 1.02, neck: 0.95 },
		hunch: 0.06
	},
	/** A Weaponer of Qward: grey-blue skin, a deep hood, a smith's heavy robe. */
	weaponer: {
		figure: {
			id: 'weaponer',
			look: { skin: '#6c8198', hair: '#20262e', hairStyle: 'cropped', mask: false },
			outfit: { top: '#33302b', topLit: '#524c43', trousers: '#24221e', boots: '#151412', hardHat: '#2b2925' }
		},
		scale: 1.06,
		build: { leg: 0.95, torso: 1.1, arm: 1.1, neck: 0.85 },
		hunch: 0.12
	},
	/** Sinestro with the yellow ring (season two): the same man, in his own Corps' gold and black. */
	sinestroYellow: {
		figure: { id: 'sinestroYellow', look: { skin: '#c4427a', hair: '#141018', hairStyle: 'peak', mask: false, mustache: true }, bulk: 0.95, corps: 'yellow' },
		scale: 1.12,
		build: { leg: 1.12, torso: 1.05, arm: 1.08, neck: 1.1 },
		hunch: -0.04
	},
	/** Ray Doyle, the man the yellow ring found first: an ordinary build, a ring's uniform he never asked for. */
	frightened: {
		figure: { id: 'frightened', look: { skin: '#d9a77f', hair: '#6b5a48', hairStyle: 'cropped', mask: false }, corps: 'yellow', bulk: 1.02 },
		scale: 1,
		build: { leg: 1, torso: 1, arm: 1, neck: 1 },
		hunch: 0.12
	},
	/** Arkillo of Vorn: bigger than Kilowog, grey-violet hide, a heavy brow, in Sinestro's gold and black. */
	arkillo: {
		figure: { id: 'arkillo', look: { skin: '#8a6f9c', hair: '#8a6f9c', hairStyle: 'cropped', mask: false, bolovaxian: true }, corps: 'yellow', bulk: 1.95 },
		scale: 1.28,
		build: LANTERNS.kilowog.build!,
		hunch: LANTERNS.kilowog.hunch!
	},
	// Lanterns you spar with in the ring. Same figures the Corps fights beside,
	// drawn from the other side of the fight.
	sparArisia: fromCrew('arisia'),
	sparKatma: fromCrew('katma'),
	sparBoodikka: fromCrew('boodikka'),
	sparHal: fromCrew('hal'),
	sparJohn: fromCrew('john'),
	/** Tomar-Re of Xudar: tall, lean, orange-skinned, the beak and the crest. */
	tomarSpar: {
		figure: { id: 'tomarSpar', look: { skin: '#e8933a', hair: '#d9633a', hairStyle: 'cropped', mask: false, avian: { beak: '#f2c14e', crest: '#d9633a' } }, bulk: 0.9 },
		scale: 1.06,
		build: { leg: 1.1, torso: 1.06, arm: 1.1, neck: 1.2 },
		hunch: -0.02
	},
	/** Guy Gardner: built like a bouncer, the red bowl cut, no mask, and a jaw that leads. */
	guySpar: {
		figure: { id: 'guySpar', look: { skin: '#e6b892', hair: '#c8461e', hairStyle: 'cropped', mask: false }, bulk: 1.18 },
		scale: 1.05,
		build: { leg: 0.98, torso: 1.06, arm: 1.12, neck: 0.9 },
		hunch: 0.05
	},
	/** Ch'p of H'lven: a squirrel, a third the size of anyone, and never where you are aiming. */
	chpSpar: {
		figure: { id: 'chpSpar', look: { skin: '#a56a3a', hair: '#6b4324', hairStyle: 'cropped', mask: true }, bulk: 0.9 },
		scale: 0.55,
		build: { leg: 0.8, torso: 0.9, arm: 0.85, neck: 0.6 },
		hunch: 0.1
	},
	/** Salaak of Slyggia: tall, thin, pinkish-orange, the long sloping head, and four arms. */
	salaakSpar: {
		figure: { id: 'salaakSpar', look: { skin: '#e2825e', hair: '#e2825e', hairStyle: 'cropped', mask: false }, bulk: 0.85 },
		scale: 1.12,
		build: { leg: 1.15, torso: 1.1, arm: 1.15, neck: 1.3 },
		hunch: -0.02
	},
	/** G'nort of G'newt: a red-furred dog on two legs, the ears, the moustache, and the best of intentions. */
	gnortSpar: {
		figure: { id: 'gnortSpar', look: { skin: '#d8462c', hair: '#d8462c', hairStyle: 'cropped', mask: false }, bulk: 1.05 },
		scale: 1.02,
		build: { leg: 0.95, torso: 1.02, arm: 1.05, neck: 1 },
		hunch: 0.06
	},
	/** Kyle Rayner: the artist. Lean and loose, black hair in his eyes, the crab mask. */
	kyleSpar: {
		figure: { id: 'kyleSpar', look: { skin: '#e2b892', hair: '#13111a', hairStyle: 'swept', mask: true }, bulk: 0.95 },
		scale: 1,
		build: { leg: 1.04, torso: 1, arm: 1.04, neck: 1.02 },
		hunch: -0.03
	}
};

/** A sparring partner built from the Lantern the Corps already knows. */
function fromCrew(id: 'arisia' | 'katma' | 'boodikka' | 'hal' | 'john'): CorpsFigure {
	const def = LANTERNS[id];
	return {
		figure: def,
		scale: def.figureScale ?? 1,
		build: def.build ?? { leg: 1, torso: 1, arm: 1, neck: 1 },
		hunch: def.hunch ?? 0
	};
}

export const isCorpsKind = (kind: string): kind is CorpsKind => kind in CORPS;

const posed = (kind: CorpsKind, pose: LanternPose): LanternPose => ({ ...pose, build: CORPS[kind].build, hunch: CORPS[kind].hunch });

export function drawCorpsLantern(ctx: CanvasRenderingContext2D, kind: CorpsKind, x: number, y: number, pose: LanternPose, time: number) {
	// Their own bodies, on the same skeleton: Guy's suit, and the aliens
	const own = kind === 'guySpar' ? drawGuyBody : kind === 'chpSpar' ? drawChpBody : kind === 'salaakSpar' ? drawSalaakBody : kind === 'gnortSpar' ? drawGnortBody : null;
	if (own) {
		const p = posed(kind, pose);
		const s = 1.35 * CORPS[kind].scale;
		const sk = computeSkeleton(p, time);
		ctx.save();
		ctx.translate(x, y);
		ctx.scale(s, s);
		if (p.shadow) {
			const k = 1 - 0.35 * p.altitude;
			ctx.fillStyle = `rgba(0, 0, 0, ${0.45 * k})`;
			ctx.beginPath();
			ctx.ellipse(0, 0, 12 * k * 1.18, 3.8 * k, 0, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.scale(p.dir * turnScale(p), 1);
		ctx.lineJoin = 'round';
		ctx.lineCap = 'round';
		own(ctx, sk, CORPS[kind].figure.look, time, p);
		ctx.restore();
		return;
	}
	drawLantern(ctx, CORPS[kind].figure, x, y, posed(kind, pose), time, CORPS[kind].scale);
}

/** Their ring, in world coordinates (where their constructs come from). */
export function corpsRing(kind: CorpsKind, x: number, y: number, pose: LanternPose, time: number): [number, number] {
	return ringPosition(x, y, posed(kind, pose), time, CORPS[kind].scale);
}

/** Just above their head. */
export function corpsTop(kind: CorpsKind, y: number, pose: LanternPose): number {
	const c = CORPS[kind];
	return y - FIGURE_HEIGHT * c.scale * c.build.torso - pose.hoverHeight * pose.altitude * 1.35 * c.scale;
}

export const drawKilowog = (ctx: CanvasRenderingContext2D, x: number, y: number, pose: LanternPose, time: number) =>
	drawCorpsLantern(ctx, 'kilowog', x, y, pose, time);

/**
 * How rage red turns into another colour, and the glow to go with it: Corps
 * green (a sparring Lantern), Gorilla City amber (Grodd's soldiers' tech),
 * psychic purple (Grodd himself) and fear yellow. The same maths as the CSS
 * filters hue-rotate, saturate and brightness, done on each colour as it's
 * set rather than by a canvas filter: a filter is a GPU pass per stroke, and
 * with a few tinted things on screen that stalled the browser for seconds.
 */
const TINTS: Record<Tint, { hue: number; saturate: number; brightness: number; glow: string }> = {
	corps: { hue: 128, saturate: 1.1, brightness: 1, glow: GREEN },
	tech: { hue: 38, saturate: 1.25, brightness: 1.15, glow: '#ffb020' },
	psychic: { hue: -85, saturate: 1.1, brightness: 1.1, glow: '#b36bff' },
	// Fear: the yellow of Sinestro's ring and Scarecrow's toxin
	fear: { hue: 58, saturate: 1.6, brightness: 1.4, glow: '#ffd23a' }
};

type Matrix = [number, number, number, number, number, number, number, number, number];

function times(a: Matrix, b: Matrix): Matrix {
	const m = [0, 0, 0, 0, 0, 0, 0, 0, 0] as Matrix;
	for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) m[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
	return m;
}

/** The colour matrix for a tint: hue-rotate, then saturate, then brightness (the order the filters were listed). */
function tintMatrix({ hue, saturate: s, brightness: b }: (typeof TINTS)[Tint]): Matrix {
	const r = (hue * Math.PI) / 180;
	const cos = Math.cos(r);
	const sin = Math.sin(r);
	const rotate: Matrix = [
		0.213 + cos * 0.787 - sin * 0.213,
		0.715 - cos * 0.715 - sin * 0.715,
		0.072 - cos * 0.072 + sin * 0.928,
		0.213 - cos * 0.213 + sin * 0.143,
		0.715 + cos * 0.285 + sin * 0.14,
		0.072 - cos * 0.072 - sin * 0.283,
		0.213 - cos * 0.213 - sin * 0.787,
		0.715 - cos * 0.715 + sin * 0.715,
		0.072 + cos * 0.928 + sin * 0.072
	];
	const sat: Matrix = [
		0.213 + 0.787 * s,
		0.715 - 0.715 * s,
		0.072 - 0.072 * s,
		0.213 - 0.213 * s,
		0.715 + 0.285 * s,
		0.072 - 0.072 * s,
		0.213 - 0.213 * s,
		0.715 - 0.715 * s,
		0.072 + 0.928 * s
	];
	return times([b, 0, 0, 0, b, 0, 0, 0, b], times(sat, rotate));
}

const MATRICES = Object.fromEntries(Object.entries(TINTS).map(([k, t]) => [k, tintMatrix(t)])) as Record<Tint, Matrix>;
const recoloured = new Map<string, string>();

function parseColor(color: string): [number, number, number, number] | null {
	const c = color.trim();
	if (c[0] === '#') {
		const h = c.slice(1);
		const full = h.length <= 4 ? [...h].map((ch) => ch + ch).join('') : h;
		if (full.length !== 6 && full.length !== 8) return null;
		const n = (i: number) => parseInt(full.slice(i, i + 2), 16);
		return [n(0), n(2), n(4), full.length === 8 ? n(6) / 255 : 1];
	}
	const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(c);
	if (!m) return null;
	const alpha = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
	return [+m[1], +m[2], +m[3], alpha];
}

/** A colour as the tint shows it. Anything it can't read (a named colour) is left alone. */
export function tintColor(color: string, tint: Tint): string {
	const key = `${tint}|${color}`;
	const known = recoloured.get(key);
	if (known) return known;
	const rgba = parseColor(color);
	let out = color;
	if (rgba) {
		const [r, g, b, a] = rgba;
		const m = MATRICES[tint];
		const ch = (i: number) => Math.round(Math.max(0, Math.min(255, m[i] * r + m[i + 1] * g + m[i + 2] * b)));
		out = `rgba(${ch(0)}, ${ch(3)}, ${ch(6)}, ${a})`;
	}
	// Colours built from changing numbers (fades) would pile up: start over now and then
	if (recoloured.size > 4000) recoloured.clear();
	recoloured.set(key, out);
	return out;
}

/**
 * Draw red Red Lantern art in Corps green: a Green Lantern's constructs from
 * the enemy side (Kilowog sparring).
 */
export function inCorpsGreen(ctx: CanvasRenderingContext2D, draw: () => void) {
	inTint(ctx, 'corps', draw);
}

const STYLES = ['fillStyle', 'strokeStyle'] as const;
const GRADIENTS = ['createLinearGradient', 'createRadialGradient', 'createConicGradient'] as const;

/**
 * Draw red art in another colour (see TINTS); no tint just draws it. While
 * `draw` runs, every colour it sets (fills, strokes, gradient stops) is
 * recoloured, and any glow is the tint's own.
 */
export function inTint(ctx: CanvasRenderingContext2D, tint: Tint | undefined, draw: () => void) {
	if (!tint) {
		draw();
		return;
	}
	const { glow } = TINTS[tint];
	const proto = Object.getPrototypeOf(ctx);
	const shadowColor = Object.getOwnPropertyDescriptor(proto, 'shadowColor')!;
	ctx.save();
	Object.defineProperty(ctx, 'shadowColor', {
		configurable: true,
		get: () => shadowColor.get!.call(ctx),
		set: () => shadowColor.set!.call(ctx, glow)
	});
	for (const prop of STYLES) {
		const d = Object.getOwnPropertyDescriptor(proto, prop)!;
		Object.defineProperty(ctx, prop, {
			configurable: true,
			get: () => d.get!.call(ctx),
			set: (v: unknown) => d.set!.call(ctx, typeof v === 'string' ? tintColor(v, tint) : v)
		});
	}
	for (const make of GRADIENTS) {
		const original = proto[make] as ((...a: number[]) => CanvasGradient) | undefined;
		if (!original) continue;
		Object.defineProperty(ctx, make, {
			configurable: true,
			value: (...args: number[]) => {
				const g = original.apply(ctx, args);
				const add = g.addColorStop.bind(g);
				g.addColorStop = (offset: number, color: string) => add(offset, tintColor(color, tint));
				return g;
			}
		});
	}
	try {
		draw();
	} finally {
		const own = ctx as unknown as Record<string, unknown>;
		delete own.shadowColor;
		for (const prop of STYLES) delete own[prop];
		for (const make of GRADIENTS) delete own[make];
		ctx.restore();
	}
}
