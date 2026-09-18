// Other Green Lanterns from the show, drawn on the Lantern skeleton:
// Kilowog (the drill sergeant) and the Corps-green tint for a Lantern's
// constructs when one is sparring against you.

import type { LanternPose } from '../animation';
import { drawLantern, ringPosition, FIGURE_HEIGHT, GREEN, type Figure } from './lantern';

/**
 * Kilowog of Bolovax Vik: enormous. A barrel chest and gut, arms like tree
 * trunks, short thick legs, a small bald head sunk into his shoulders.
 */
export const KILOWOG: Figure = {
	id: 'kilowog',
	look: { skin: '#b89a9c', hair: '#b89a9c', hairStyle: 'cropped', mask: false, bolovaxian: true },
	bulk: 2.3
};
/** Size next to Hal and John. */
export const KILOWOG_SCALE = 1.45;
const BUILD = { leg: 0.85, torso: 1.35, arm: 1.2, neck: 0.25 };
const HUNCH = 0.05;

export function drawKilowog(ctx: CanvasRenderingContext2D, x: number, y: number, pose: LanternPose, time: number) {
	drawLantern(ctx, KILOWOG, x, y, kilowogPose(pose), time, KILOWOG_SCALE);
}

/** His ring, in world coordinates (where his constructs come from). */
export function kilowogRing(x: number, y: number, pose: LanternPose, time: number): [number, number] {
	return ringPosition(x, y, kilowogPose(pose), time, KILOWOG_SCALE);
}

/** Just above his head. */
export function kilowogTop(y: number, pose: LanternPose): number {
	return y - FIGURE_HEIGHT * KILOWOG_SCALE * BUILD.torso - pose.hoverHeight * pose.altitude * 1.35 * KILOWOG_SCALE;
}

const kilowogPose = (pose: LanternPose): LanternPose => ({ ...pose, build: BUILD, hunch: HUNCH });

/** Canvas filter that turns rage red into Corps green, for a sparring Lantern's constructs. */
const CORPS_TINT = 'hue-rotate(128deg) saturate(1.1)';


/**
 * Draw red Red Lantern art in Corps green: a Green Lantern's constructs from
 * the enemy side (Kilowog sparring). The filter recolors the shapes; the
 * glow (shadow) isn't filtered, so any glow set while drawing is made green.
 */
export function inCorpsGreen(ctx: CanvasRenderingContext2D, draw: () => void) {
	const shadowColor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ctx), 'shadowColor')!;
	ctx.save();
	ctx.filter = CORPS_TINT;
	Object.defineProperty(ctx, 'shadowColor', {
		configurable: true,
		get: () => shadowColor.get!.call(ctx),
		set: () => shadowColor.set!.call(ctx, GREEN)
	});
	try {
		draw();
	} finally {
		delete (ctx as { shadowColor?: string }).shadowColor;
		ctx.restore();
	}
}
