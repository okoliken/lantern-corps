// The Meridian platform (season two, Undertow): sea water over a deck, the
// breaches in the hull with John's dam going up in them, the lifeboats on
// their davits, and the lab container with the trench find inside.

import { green, GREEN_CORE, THEME_GREEN } from '../../theme';

const TAU = Math.PI * 2;
const OUTLINE = '#0a0c0f';

/** Sea water over a deck, `f` 0..1 deep: darker and rougher the deeper it gets. */
export function drawWater(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, f: number, time: number) {
	ctx.save();
	ctx.fillStyle = `rgba(18, 84, 120, ${0.22 + 0.5 * f})`;
	ctx.fillRect(x, y, w, h);
	// Swell lines rolling across it
	ctx.strokeStyle = `rgba(170, 220, 240, ${0.12 + 0.18 * f})`;
	ctx.lineWidth = 2;
	for (let yy = y + 30; yy < y + h; yy += 54) {
		ctx.beginPath();
		for (let xx = x; xx <= x + w; xx += 40) {
			const wave = Math.sin(xx * 0.015 + time * (1.2 + f) + yy * 0.05) * (3 + 6 * f);
			if (xx === x) ctx.moveTo(xx, yy + wave);
			else ctx.lineTo(xx, yy + wave);
		}
		ctx.stroke();
	}
	// Foam along the top edge, where it slaps the bulkhead
	ctx.fillStyle = `rgba(230, 245, 250, ${0.25 + 0.3 * f})`;
	for (let xx = x + 10; xx < x + w; xx += 34) {
		const r = 4 + 3 * Math.sin(time * 3 + xx);
		ctx.beginPath();
		ctx.ellipse(xx, y + 6 + Math.sin(time * 2 + xx * 0.1) * 3, r * 2, r, 0, 0, TAU);
		ctx.fill();
	}
	ctx.restore();
}

/**
 * A hole in the hull, the sea forcing in through it (`from` the side it's
 * in), and the dam John has built across it: green girders, one more for
 * each fifth of the way to holding.
 */
export function drawBreach(ctx: CanvasRenderingContext2D, x: number, y: number, from: 'south' | 'east', dam: number, open: boolean, flash: boolean, time: number) {
	ctx.save();
	ctx.translate(x, y);
	if (from === 'east') ctx.rotate(-Math.PI / 2);
	// The hole: torn plating curling in round a black gap
	ctx.fillStyle = '#05080b';
	ctx.strokeStyle = '#7d848c';
	ctx.lineWidth = 4;
	ctx.beginPath();
	const points = 14;
	for (let i = 0; i <= points; i++) {
		const a = Math.PI + (i / points) * Math.PI;
		const r = 62 + ((i * 37) % 11) - 4;
		const px = Math.cos(a) * r;
		const py = Math.sin(a) * r * 0.55;
		if (i === 0) ctx.moveTo(px, py);
		else ctx.lineTo(px, py);
	}
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	// The sea coming through, weaker the more the dam holds
	const flow = open ? 1 - dam : 0;
	if (flow > 0.02) {
		for (let i = 0; i < 18; i++) {
			const k = (time * 1.8 + i / 18) % 1;
			const spread = (((i * 53) % 17) / 17 - 0.5) * 110;
			const reach = 40 + 160 * flow;
			const px = spread * (0.4 + k);
			const py = -10 - k * reach;
			ctx.fillStyle = `rgba(210, 240, 250, ${0.75 * (1 - k) * flow})`;
			ctx.beginPath();
			ctx.ellipse(px, py, 7 + 10 * k, 4 + 5 * k, 0, 0, TAU);
			ctx.fill();
		}
	}
	// The dam: green girders across the hole, stacked up from the bottom
	const girders = Math.min(5, Math.ceil(dam * 5 - 0.001));
	ctx.save();
	ctx.shadowColor = THEME_GREEN;
	ctx.shadowBlur = open ? 8 : 16;
	for (let i = 0; i < girders; i++) {
		const gy = -4 - i * 7;
		const shake = open ? Math.sin(time * 30 + i) * (1 - dam) * 2 : 0;
		const width = 120 - i * 8;
		ctx.fillStyle = flash && i === girders - 1 ? GREEN_CORE : green(0.55 + 0.3 * (i === girders - 1 ? dam * 5 - i : 1));
		ctx.fillRect(-width / 2 + shake, gy - 3, width, 6);
		ctx.strokeStyle = green(0.95);
		ctx.lineWidth = 1;
		ctx.strokeRect(-width / 2 + shake, gy - 3, width, 6);
		// The I-beam's flanges
		ctx.fillStyle = GREEN_CORE;
		ctx.fillRect(-width / 2 + shake, gy - 3, width, 1.2);
	}
	ctx.restore();
	ctx.restore();
}

/** Three orange lifeboats on davits at the north rail, with the muster point painted on the deck. */
export function drawLifeboats(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
	ctx.save();
	ctx.fillStyle = `rgba(80, 220, 120, ${0.14 + 0.05 * Math.sin(time * 3)})`;
	ctx.beginPath();
	ctx.ellipse(x, y + 170, 230, 90, 0, 0, TAU);
	ctx.fill();
	ctx.strokeStyle = 'rgba(80, 220, 120, 0.7)';
	ctx.setLineDash([12, 10]);
	ctx.lineWidth = 3;
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.fillStyle = '#e8f7ea';
	ctx.font = '700 18px system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.fillText('MUSTER STATION · LIFEBOATS', x, y + 176);
	for (const dx of [-480, 0, 480]) {
		const bx = x + dx;
		// Davits
		ctx.strokeStyle = '#5c636b';
		ctx.lineWidth = 6;
		ctx.beginPath();
		ctx.moveTo(bx - 70, y + 70);
		ctx.quadraticCurveTo(bx - 76, y - 10, bx - 50, y - 20);
		ctx.moveTo(bx + 70, y + 70);
		ctx.quadraticCurveTo(bx + 76, y - 10, bx + 50, y - 20);
		ctx.stroke();
		// The boat: an enclosed orange hull
		ctx.fillStyle = '#e8641e';
		ctx.strokeStyle = OUTLINE;
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.moveTo(bx - 80, y + 10);
		ctx.quadraticCurveTo(bx - 90, y + 50, bx - 40, y + 56);
		ctx.lineTo(bx + 40, y + 56);
		ctx.quadraticCurveTo(bx + 90, y + 50, bx + 80, y + 10);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = '#f08a45';
		ctx.beginPath();
		ctx.ellipse(bx, y + 10, 76, 22, 0, Math.PI, TAU);
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = '#1c2a36';
		for (const wx of [-40, -14, 12, 38]) ctx.fillRect(bx + wx - 6, y + 2, 12, 7);
	}
	ctx.restore();
}

/**
 * The lab: a white container on the middle deck, a window onto the trench
 * find (an Atlantean piece glowing sea-green), and the water line climbing
 * its side as the deck floods (`flood` 0..1).
 */
export function drawLab(ctx: CanvasRenderingContext2D, x: number, y: number, flood: number, time: number) {
	const w = 260;
	const h = 120;
	ctx.save();
	ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
	ctx.beginPath();
	ctx.ellipse(x, y, w * 0.6, 26, 0, 0, TAU);
	ctx.fill();
	ctx.fillStyle = '#d9dde2';
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 4;
	ctx.fillRect(x - w / 2, y - h, w, h);
	ctx.strokeRect(x - w / 2, y - h, w, h);
	ctx.strokeStyle = 'rgba(10, 12, 15, 0.25)';
	ctx.lineWidth = 2;
	for (let k = -w / 2 + 20; k < w / 2; k += 22) {
		ctx.beginPath();
		ctx.moveTo(x + k, y - h + 4);
		ctx.lineTo(x + k, y - 4);
		ctx.stroke();
	}
	// The window, and what's behind it
	ctx.fillStyle = '#0c1a22';
	ctx.fillRect(x - 60, y - h + 22, 120, 52);
	const glow = ctx.createRadialGradient(x, y - h + 48, 2, x, y - h + 48, 46);
	glow.addColorStop(0, `rgba(120, 255, 220, ${0.75 + 0.2 * Math.sin(time * 2)})`);
	glow.addColorStop(1, 'rgba(120, 255, 220, 0)');
	ctx.fillStyle = glow;
	ctx.fillRect(x - 60, y - h + 22, 120, 52);
	ctx.fillStyle = '#c9a64a';
	ctx.beginPath();
	ctx.moveTo(x, y - h + 30);
	ctx.lineTo(x + 12, y - h + 48);
	ctx.lineTo(x, y - h + 66);
	ctx.lineTo(x - 12, y - h + 48);
	ctx.closePath();
	ctx.fill();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 2;
	ctx.strokeRect(x - 60, y - h + 22, 120, 52);
	ctx.fillStyle = '#20262c';
	ctx.font = '800 14px system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.fillText('MERIDIAN · TRENCH LAB', x, y - 14);
	// The water line up its side
	if (flood > 0.02) {
		const wl = Math.min(h, flood * 90);
		ctx.fillStyle = 'rgba(18, 84, 120, 0.55)';
		ctx.fillRect(x - w / 2, y - wl, w, wl);
		ctx.strokeStyle = 'rgba(220, 245, 255, 0.6)';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(x - w / 2, y - wl + Math.sin(time * 2) * 2);
		ctx.lineTo(x + w / 2, y - wl + Math.sin(time * 2 + 2) * 2);
		ctx.stroke();
	}
	ctx.restore();
}

/** What a solid thing on the rig is, for drawing it. */
export type RigPart = 'bulkhead' | 'rack' | 'pump' | 'tank';

/**
 * Something solid on the deck, drawn like the world's blocks (a front face
 * `height` tall, its top lifted by that much) but as what it is on a rig:
 * a riveted bulkhead with a hazard band, a pipe rack, a pump housing, a
 * lashed-down tank.
 */
export function drawRigPart(ctx: CanvasRenderingContext2D, part: RigPart, x: number, y: number, w: number, h: number, height: number, time: number) {
	const front = y + h - height;
	const top = y - height;
	ctx.save();
	ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
	ctx.fillRect(x + 6, y + h - 4, w, 10);
	switch (part) {
		case 'bulkhead': {
			ctx.fillStyle = '#48505a';
			ctx.fillRect(x, front, w, height);
			// Stiffeners and rivets
			ctx.fillStyle = '#3a4149';
			for (let k = x + 30; k < x + w - 10; k += 60) ctx.fillRect(k, front, 8, height);
			ctx.fillStyle = '#7d868f';
			for (let k = x + 14; k < x + w; k += 30) {
				ctx.fillRect(k, front + 6, 2, 2);
				ctx.fillRect(k, front + height - 26, 2, 2);
			}
			// Hazard band along the foot
			ctx.save();
			ctx.beginPath();
			ctx.rect(x, front + height - 16, w, 12);
			ctx.clip();
			ctx.fillStyle = '#d9b02a';
			ctx.fillRect(x, front + height - 16, w, 12);
			ctx.fillStyle = '#16181b';
			for (let k = x - 20; k < x + w + 20; k += 24) {
				ctx.beginPath();
				ctx.moveTo(k, front + height - 4);
				ctx.lineTo(k + 12, front + height - 16);
				ctx.lineTo(k + 20, front + height - 16);
				ctx.lineTo(k + 8, front + height - 4);
				ctx.closePath();
				ctx.fill();
			}
			ctx.restore();
			ctx.fillStyle = '#5c646e';
			ctx.fillRect(x, top, w, h);
			ctx.fillStyle = '#d9b02a';
			ctx.fillRect(x, top + h - 3, w, 3);
			break;
		}
		case 'rack': {
			// A low frame with pipes running its length
			ctx.fillStyle = '#2b3036';
			for (const k of [x + 6, x + w / 2 - 4, x + w - 14]) ctx.fillRect(k, front, 8, height);
			const colours = ['#b8402c', '#d9b02a', '#8a9099', '#2a8c8c'];
			colours.forEach((c, i) => {
				const py = top + 8 + i * ((h - 16) / 3);
				ctx.fillStyle = c;
				ctx.fillRect(x - 4, py - 5, w + 8, 10);
				ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
				ctx.fillRect(x - 4, py - 4, w + 8, 2);
				ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
				ctx.beginPath();
				ctx.ellipse(x + w + 4, py, 3, 5, 0, 0, TAU);
				ctx.fill();
			});
			break;
		}
		case 'pump': {
			ctx.fillStyle = '#3b5248';
			ctx.fillRect(x, front, w, height);
			ctx.fillStyle = '#2b3d35';
			ctx.fillRect(x + 8, front + 10, w - 16, height - 20);
			ctx.fillStyle = '#e8e2c8';
			ctx.fillRect(x + w / 2 - 22, front + height / 2 - 7, 44, 14);
			ctx.fillStyle = '#20262c';
			ctx.font = '800 9px system-ui, sans-serif';
			ctx.textAlign = 'center';
			ctx.fillText('BILGE PUMP', x + w / 2, front + height / 2 + 3);
			ctx.fillStyle = '#4b6a5d';
			ctx.fillRect(x, top, w, h);
			// The fan turning under its grille
			const cx = x + w / 2;
			const cy = top + h / 2;
			const r = Math.min(w, h) * 0.32;
			ctx.fillStyle = '#1c2622';
			ctx.beginPath();
			ctx.arc(cx, cy, r, 0, TAU);
			ctx.fill();
			ctx.strokeStyle = '#8fa69b';
			ctx.lineWidth = 3;
			for (let i = 0; i < 3; i++) {
				const a = time * 6 + (i * TAU) / 3;
				ctx.beginPath();
				ctx.moveTo(cx, cy);
				ctx.lineTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9);
				ctx.stroke();
			}
			break;
		}
		case 'tank': {
			// A white pressure tank on its side, strapped down
			ctx.fillStyle = '#2b3036';
			ctx.fillRect(x + w * 0.2, front + height - 14, 10, 14);
			ctx.fillRect(x + w * 0.75, front + height - 14, 10, 14);
			const ty = front;
			const th = height - 10;
			ctx.fillStyle = '#d9dde2';
			ctx.beginPath();
			ctx.roundRect(x, ty, w, th, th / 2);
			ctx.fill();
			ctx.fillStyle = '#e8ebef';
			ctx.beginPath();
			ctx.roundRect(x, top, w, h + th * 0.3, Math.min(h, th) / 2);
			ctx.fill();
			ctx.fillStyle = '#b8402c';
			ctx.fillRect(x + w * 0.3, ty, 8, th);
			ctx.fillRect(x + w * 0.7, ty, 8, th);
			break;
		}
	}
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 2;
	ctx.strokeRect(x, front, w, height);
	ctx.restore();
}
