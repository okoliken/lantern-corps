// Other Green Lanterns from the show, drawn on the Lantern skeleton:
// Kilowog (the drill sergeant) and the Corps-green tint for a Lantern's
// constructs when one is sparring against you.

import type { Tint } from '../enemies/enemies';
import type { LanternPose } from '../animation';
import { LANTERNS } from '../lanterns';
import { drawLantern, ringPosition, FIGURE_HEIGHT, GREEN, type Figure } from './lantern';
import { computeSkeleton, turnScale } from '../animation';
import { drawChpBody, drawGnortBody, drawGuyBody, drawSalaakBody } from './league';

export type CorpsKind = 'kilowog' | 'sinestro' | 'sparArisia' | 'sparKatma' | 'sparBoodikka' | 'sparHal' | 'sparJohn' | 'tomarSpar' | 'guySpar' | 'kyleSpar' | 'chpSpar' | 'salaakSpar' | 'gnortSpar';

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
 * Canvas filters that turn rage red into another colour, and the glow to go
 * with it: Corps green (a sparring Lantern), Gorilla City amber (Grodd's
 * soldiers' tech), and psychic purple (Grodd himself).
 */
const TINTS: Record<Tint, { filter: string; glow: string }> = {
	corps: { filter: 'hue-rotate(128deg) saturate(1.1)', glow: GREEN },
	tech: { filter: 'hue-rotate(38deg) saturate(1.25) brightness(1.15)', glow: '#ffb020' },
	psychic: { filter: 'hue-rotate(-85deg) saturate(1.1) brightness(1.1)', glow: '#b36bff' }
};


/**
 * Draw red Red Lantern art in Corps green: a Green Lantern's constructs from
 * the enemy side (Kilowog sparring). The filter recolors the shapes; the
 * glow (shadow) isn't filtered, so any glow set while drawing is made green.
 */
export function inCorpsGreen(ctx: CanvasRenderingContext2D, draw: () => void) {
	inTint(ctx, 'corps', draw);
}

/** Draw red art in another colour (see TINTS); no tint just draws it. */
export function inTint(ctx: CanvasRenderingContext2D, tint: Tint | undefined, draw: () => void) {
	if (!tint) {
		draw();
		return;
	}
	const { filter, glow } = TINTS[tint];
	const shadowColor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ctx), 'shadowColor')!;
	ctx.save();
	ctx.filter = filter;
	Object.defineProperty(ctx, 'shadowColor', {
		configurable: true,
		get: () => shadowColor.get!.call(ctx),
		set: () => shadowColor.set!.call(ctx, glow)
	});
	try {
		draw();
	} finally {
		delete (ctx as { shadowColor?: string }).shadowColor;
		ctx.restore();
	}
}
