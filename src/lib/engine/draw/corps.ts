// Other Green Lanterns from the show, drawn on the Lantern skeleton:
// Kilowog (the drill sergeant) and the Corps-green tint for a Lantern's
// constructs when one is sparring against you.

import type { Tint } from '../enemies/enemies';
import type { LanternPose } from '../animation';
import { LANTERNS } from '../lanterns';
import { drawLantern, ringPosition, FIGURE_HEIGHT, GREEN, type Figure } from './lantern';

export type CorpsKind = 'kilowog' | 'sinestro';

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
	}
};

export const isCorpsKind = (kind: string): kind is CorpsKind => kind in CORPS;

const posed = (kind: CorpsKind, pose: LanternPose): LanternPose => ({ ...pose, build: CORPS[kind].build, hunch: CORPS[kind].hunch });

export function drawCorpsLantern(ctx: CanvasRenderingContext2D, kind: CorpsKind, x: number, y: number, pose: LanternPose, time: number) {
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
