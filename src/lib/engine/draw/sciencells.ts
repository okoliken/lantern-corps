// The Sciencells of Oa (season two, Breakout): the cell block's back wall,
// each cell in it with its force-field door (shut, with someone behind it,
// or open and empty), the gate out of the block, and the Book of Parallax
// floating at Lyssa Drak's shoulder.

import { green, GREEN_CORE, THEME_GREEN } from '../../theme';

const TAU = Math.PI * 2;
const OUTLINE = '#04100b';

/** The block's back wall: dark Oan stone, green light running in the seams. */
export function drawBlockWall(ctx: CanvasRenderingContext2D, width: number, depth: number, time: number) {
	ctx.save();
	const g = ctx.createLinearGradient(0, 0, 0, depth);
	g.addColorStop(0, '#0a1712');
	g.addColorStop(1, '#16281f');
	ctx.fillStyle = g;
	ctx.fillRect(0, -400, width, depth + 400);
	ctx.strokeStyle = green(0.15 + 0.05 * Math.sin(time * 1.5));
	ctx.lineWidth = 2;
	for (let y = 20; y < depth; y += 40) {
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(width, y);
		ctx.stroke();
	}
	ctx.restore();
}

/** A pillar between two cells: carved stone with a light strip down its face. */
export function drawPillar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, height: number, time: number) {
	ctx.save();
	ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
	ctx.fillRect(x + 6, y + h - 4, w, 10);
	ctx.fillStyle = '#1c3027';
	ctx.fillRect(x, y + h - height, w, height);
	ctx.fillStyle = '#26402f';
	ctx.fillRect(x, y - height, w, h);
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 2;
	ctx.strokeRect(x, y + h - height, w, height);
	ctx.fillStyle = green(0.5 + 0.2 * Math.sin(time * 2 + x));
	ctx.fillRect(x + w / 2 - 3, y + h - height + 12, 6, height - 24);
	ctx.restore();
}

/**
 * A cell: the alcove floor, whoever is in it (drawn by `inside`), and the
 * door, a sheet of green light when it's shut, a dead frame when it's open.
 * `opening` (0..1) flickers the door as it fails.
 */
export function drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, shut: boolean, opening: number, inside: (() => void) | null, time: number) {
	ctx.save();
	ctx.fillStyle = '#0d1a14';
	ctx.fillRect(x, y, w, h);
	ctx.strokeStyle = green(0.18);
	ctx.lineWidth = 1;
	for (let k = x + 20; k < x + w; k += 30) {
		ctx.beginPath();
		ctx.moveTo(k, y);
		ctx.lineTo(k, y + h);
		ctx.stroke();
	}
	inside?.();
	// The door at the front of the cell
	const fy = y + h;
	if (shut) {
		const flicker = opening > 0 ? (Math.sin(time * 40) > 0 ? 0.2 : 0.8) : 1;
		ctx.fillStyle = green(0.22 * flicker);
		ctx.fillRect(x, y + h * 0.15, w, h * 0.85);
		ctx.shadowColor = THEME_GREEN;
		ctx.shadowBlur = 14 * flicker;
		ctx.strokeStyle = green(0.85 * flicker);
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.moveTo(x, fy);
		ctx.lineTo(x + w, fy);
		ctx.stroke();
		ctx.strokeStyle = green(0.4 * flicker);
		ctx.lineWidth = 2;
		for (let k = x + 16; k < x + w; k += 22) {
			ctx.beginPath();
			ctx.moveTo(k, y + h * 0.15);
			ctx.lineTo(k, fy);
			ctx.stroke();
		}
		ctx.shadowBlur = 0;
	} else {
		ctx.strokeStyle = '#3a4a42';
		ctx.lineWidth = 3;
		ctx.setLineDash([10, 8]);
		ctx.beginPath();
		ctx.moveTo(x, fy);
		ctx.lineTo(x + w, fy);
		ctx.stroke();
		ctx.setLineDash([]);
		ctx.fillStyle = 'rgba(232, 214, 120, 0.85)';
		ctx.font = '800 13px system-ui, sans-serif';
		ctx.textAlign = 'center';
		ctx.fillText('OPEN', x + w / 2, fy - 8);
	}
	ctx.restore();
}

/** The gate out of the block: a heavy door in the far wall, standing open. Anyone who reaches it is gone. */
export function drawBlockGate(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
	ctx.save();
	ctx.fillStyle = 'rgba(255, 210, 58, 0.12)';
	ctx.beginPath();
	ctx.ellipse(x, y, 170, 60, 0, 0, TAU);
	ctx.fill();
	ctx.strokeStyle = `rgba(255, 210, 58, ${0.5 + 0.3 * Math.sin(time * 4)})`;
	ctx.setLineDash([12, 8]);
	ctx.lineWidth = 3;
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.fillStyle = '#e8d690';
	ctx.font = '800 16px system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.fillText('BLOCK GATE · OPEN', x, y + 6);
	ctx.restore();
}

/** The Book of Parallax: a heavy black tome bound in gold, chained to its keeper, its pages lit yellow from inside. */
export function drawBook(ctx: CanvasRenderingContext2D, x: number, y: number, holderX: number, holderY: number, reading: number, time: number) {
	ctx.save();
	ctx.strokeStyle = '#8a7a3a';
	ctx.lineWidth = 2;
	ctx.setLineDash([4, 3]);
	ctx.beginPath();
	ctx.moveTo(holderX, holderY);
	ctx.quadraticCurveTo((holderX + x) / 2, Math.max(holderY, y) + 20, x, y);
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.translate(x, y + Math.sin(time * 2) * 3);
	ctx.rotate(-0.15);
	ctx.shadowColor = '#ffd23a';
	ctx.shadowBlur = 10 + 20 * reading;
	ctx.fillStyle = '#141214';
	ctx.fillRect(-16, -12, 32, 24);
	ctx.shadowBlur = 0;
	ctx.strokeStyle = '#d9b03a';
	ctx.lineWidth = 2;
	ctx.strokeRect(-16, -12, 32, 24);
	ctx.fillStyle = '#d9b03a';
	ctx.beginPath();
	ctx.arc(0, 0, 4, 0, TAU);
	ctx.fill();
	if (reading > 0) {
		// Open, its pages throwing yellow light
		ctx.fillStyle = `rgba(255, 230, 140, ${0.7 * reading})`;
		ctx.beginPath();
		ctx.moveTo(-16, -12);
		ctx.lineTo(0, -26 * reading);
		ctx.lineTo(16, -12);
		ctx.closePath();
		ctx.fill();
		ctx.fillStyle = GREEN_CORE;
	}
	ctx.restore();
}
