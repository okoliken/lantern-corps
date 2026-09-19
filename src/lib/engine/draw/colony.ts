// Mission 3 art: Mirrow Colony, a farming settlement. Crop fields, the domed
// shelters the colonists hid in, and the evacuation shuttles on the pad.
// The colonists themselves are drawn on the Lantern skeleton in everyday
// clothes (see Figure.outfit).

import type { LanternPose } from '../animation';
import { GREEN, HOVER_PLANET, drawLantern, type Figure } from './lantern';
import { green } from '../../theme';

const TAU = Math.PI * 2;

/** A field of crops in rows. Drawn flat on the ground. */
export function drawField(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number) {
	ctx.save();
	ctx.fillStyle = '#3d4526';
	ctx.fillRect(x, y, w, h);
	ctx.strokeStyle = seed > 0.5 ? '#6f8a3a' : '#8a7d3a';
	ctx.lineWidth = 3;
	for (let ry = y + 10; ry < y + h - 4; ry += 14) {
		ctx.beginPath();
		ctx.moveTo(x + 6, ry);
		ctx.lineTo(x + w - 6, ry);
		ctx.stroke();
	}
	ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
	ctx.lineWidth = 2;
	ctx.strokeRect(x, y, w, h);
	ctx.restore();
}

/** A colony shelter: a low dome with a door. `open` once its colonists have left. */
export function drawShelter(ctx: CanvasRenderingContext2D, x: number, y: number, open: boolean, time: number) {
	ctx.save();
	ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
	ctx.beginPath();
	ctx.ellipse(x, y, 78, 18, 0, 0, TAU);
	ctx.fill();
	const dome = ctx.createLinearGradient(x, y - 90, x, y);
	dome.addColorStop(0, '#d8d4c6');
	dome.addColorStop(1, '#8f8a7c');
	ctx.fillStyle = dome;
	ctx.strokeStyle = '#2b2924';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.ellipse(x, y, 72, 86, 0, Math.PI, TAU);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	// Panel seams
	ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
	for (const k of [0.35, 0.65]) {
		ctx.beginPath();
		ctx.ellipse(x, y, 72 * k, 86, 0, Math.PI, TAU);
		ctx.stroke();
	}
	// Door
	ctx.fillStyle = open ? '#1a1712' : '#5a564b';
	ctx.beginPath();
	ctx.roundRect(x - 14, y - 40, 28, 40, 6);
	ctx.fill();
	ctx.stroke();
	// Emergency light over the door, blinking until they're out
	if (!open) {
		const on = Math.sin(time * 5 + x) > 0;
		ctx.fillStyle = on ? '#ffb040' : '#5a3a10';
		ctx.shadowColor = '#ffb040';
		ctx.shadowBlur = on ? 12 : 0;
		ctx.beginPath();
		ctx.arc(x, y - 50, 4, 0, TAU);
		ctx.fill();
	}
	ctx.restore();
}

/**
 * An evacuation shuttle on its pad. `launch` (0..1) lifts it off and away;
 * `hit` flashes it when fire gets through.
 */
export function drawShuttle(ctx: CanvasRenderingContext2D, x: number, y: number, launch: number, hit: boolean, time: number) {
	ctx.save();
	// The pad
	ctx.strokeStyle = 'rgba(255, 190, 80, 0.5)';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.ellipse(x, y, 70, 20, 0, 0, TAU);
	ctx.stroke();
	if (launch >= 1) {
		ctx.restore();
		return;
	}
	const rise = launch * launch * 700;
	ctx.fillStyle = `rgba(0, 0, 0, ${0.35 * (1 - launch)})`;
	ctx.beginPath();
	ctx.ellipse(x, y, 52, 13, 0, 0, TAU);
	ctx.fill();
	ctx.translate(x, y - 24 - rise);
	// Engine glow while lifting off
	if (launch > 0) {
		const g = ctx.createLinearGradient(0, 16, 0, 60);
		g.addColorStop(0, 'rgba(255, 220, 140, 0.9)');
		g.addColorStop(1, 'rgba(255, 140, 40, 0)');
		ctx.fillStyle = g;
		ctx.fillRect(-18, 16, 36, 44 + Math.sin(time * 40) * 4);
	}
	ctx.fillStyle = hit ? '#ffffff' : '#c9ccd2';
	ctx.strokeStyle = '#23262c';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(-50, 14);
	ctx.quadraticCurveTo(-54, -18, -10, -26);
	ctx.quadraticCurveTo(44, -24, 56, 6);
	ctx.lineTo(50, 16);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#2d5a7a';
	ctx.beginPath();
	ctx.roundRect(8, -18, 30, 12, 4);
	ctx.fill();
	ctx.fillStyle = '#d9772e';
	ctx.fillRect(-44, 2, 90, 5);
	ctx.restore();
}

// ------------------------------------------------------------- colonists

const LOOKS = [
	{ skin: '#e0b18c', hair: '#3a2615' },
	{ skin: '#8a5a3c', hair: '#1a120c' },
	{ skin: '#c9a0e0', hair: '#f0e8f8' },
	{ skin: '#d6c07a', hair: '#6a4a20' }
];
const CLOTHES = [
	{ top: '#5d6f3a', topLit: '#7d914f', trousers: '#4a3b2a', boots: '#2e2218' },
	{ top: '#7a4a3a', topLit: '#9a6450', trousers: '#34405a', boots: '#2e2218' },
	{ top: '#46607a', topLit: '#5f7d99', trousers: '#4a3b2a', boots: '#2e2218' }
];

/** One colonist figure: everyday clothes on the Lantern skeleton, a bit smaller. */
export function colonist(i: number): Figure {
	const look = LOOKS[i % LOOKS.length];
	return {
		id: `colonist${i}`,
		look: { ...look, hairStyle: i % 2 ? 'swept' : 'cropped', mask: false },
		outfit: CLOTHES[i % CLOTHES.length]
	};
}

/** A colonist walking (or standing, `walking` false), facing `dir`. */
export function drawColonist(ctx: CanvasRenderingContext2D, fig: Figure, x: number, y: number, dir: 1 | -1, walking: boolean, time: number) {
	const pose: LanternPose = {
		dir,
		walkPhase: walking ? time * 11 : 0,
		altitude: 0,
		hoverHeight: HOVER_PLANET,
		lean: 0,
		glow: false,
		shadow: true,
		firing: false,
		aimX: dir,
		aimY: 0
	};
	drawLantern(ctx, fig, x, y, pose, time, 0.8);
}

/** A bubble over a group of colonists. `health` 0..1 dims it as it's worn down. */
export function drawGroupBubble(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, health: number, time: number) {
	ctx.save();
	const cy = y - 30;
	ctx.fillStyle = green(0.06 + 0.08 * health);
	ctx.strokeStyle = GREEN;
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 14;
	ctx.lineWidth = 2 + Math.sin(time * 4) * 0.4;
	ctx.beginPath();
	ctx.ellipse(x, cy, r, r * 0.75, 0, 0, TAU);
	ctx.fill();
	ctx.stroke();
	ctx.restore();
}
