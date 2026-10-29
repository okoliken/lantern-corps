// Coast City harbour (season two, Ground Level): the water along the top, the
// crane and the cargo lifter's container hanging off it, John's brace on it,
// and crates shaking loose.

import { green, GREEN_CORE, THEME_GREEN } from '../../theme';

/** The harbour along the top of the map: dark water and a lit pier edge. */
export function drawHarbour(ctx: CanvasRenderingContext2D, width: number, edge: number, time: number) {
	ctx.save();
	const water = ctx.createLinearGradient(0, 0, 0, edge);
	water.addColorStop(0, '#081a2a');
	water.addColorStop(1, '#0f2c40');
	ctx.fillStyle = water;
	ctx.fillRect(0, -400, width, edge + 400);
	// Ripples
	ctx.strokeStyle = 'rgba(150, 200, 230, 0.12)';
	ctx.lineWidth = 2;
	for (let y = 30; y < edge - 20; y += 46) {
		ctx.beginPath();
		for (let x = 0; x <= width; x += 40) {
			const yy = y + Math.sin(x * 0.02 + time * 1.3 + y) * 4;
			if (x === 0) ctx.moveTo(x, yy);
			else ctx.lineTo(x, yy);
		}
		ctx.stroke();
	}
	// The pier's edge: a yellow safety line and bollards
	ctx.fillStyle = '#3a3a3c';
	ctx.fillRect(0, edge - 6, width, 14);
	ctx.fillStyle = '#d9b02a';
	for (let x = 0; x < width; x += 60) ctx.fillRect(x, edge + 2, 34, 5);
	ctx.fillStyle = '#1c1c1e';
	for (let x = 80; x < width; x += 320) {
		ctx.beginPath();
		ctx.ellipse(x, edge + 22, 12, 7, 0, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.restore();
}

/** Where the yard's way out is: painted lines and a gate sign. */
export function drawExit(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
	ctx.save();
	ctx.fillStyle = `rgba(80, 220, 120, ${0.16 + 0.06 * Math.sin(time * 3)})`;
	ctx.beginPath();
	ctx.ellipse(x, y, 150, 70, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = 'rgba(80, 220, 120, 0.7)';
	ctx.setLineDash([12, 10]);
	ctx.lineWidth = 3;
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.fillStyle = '#e8f7ea';
	ctx.font = '700 18px system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.fillText('EXIT · SAFE ZONE', x, y + 6);
	ctx.restore();
}

/**
 * The crane and its load. The mast stands right of the container; the arm
 * reaches over it; the container hangs `lift` px above its spot and sways
 * more the closer the lifter is to failing (`strain` 0..1).
 */
export function drawLifter(ctx: CanvasRenderingContext2D, x: number, y: number, strain: number, lowered: number, time: number) {
	const lift = 190 * (1 - lowered);
	const sway = Math.sin(time * (1.6 + strain * 2.4)) * (3 + strain * 18);
	const cx = x + sway;
	const cy = y - lift;
	const mastX = x + 300;
	const armY = y - 420;
	ctx.save();
	// Mast and arm: yellow steel, outlined
	ctx.lineJoin = 'round';
	ctx.strokeStyle = '#141414';
	ctx.lineWidth = 6;
	ctx.fillStyle = '#e0a31d';
	ctx.fillRect(mastX - 18, armY, 36, y - armY + 30);
	ctx.strokeRect(mastX - 18, armY, 36, y - armY + 30);
	ctx.fillRect(x - 140, armY - 14, mastX - x + 160, 28);
	ctx.strokeRect(x - 140, armY - 14, mastX - x + 160, 28);
	// Lattice on the mast
	ctx.strokeStyle = 'rgba(20, 20, 20, 0.6)';
	ctx.lineWidth = 2;
	for (let yy = armY + 10; yy < y + 20; yy += 34) {
		ctx.beginPath();
		ctx.moveTo(mastX - 18, yy);
		ctx.lineTo(mastX + 18, yy + 34);
		ctx.stroke();
	}
	// Cables, taut and shaking
	ctx.strokeStyle = '#2a2a2a';
	ctx.lineWidth = 3;
	for (const off of [-70, 70]) {
		ctx.beginPath();
		ctx.moveTo(x + off * 0.4, armY + 14);
		ctx.lineTo(cx + off, cy - 60 + Math.sin(time * 30 + off) * strain * 2);
		ctx.stroke();
	}
	// The container: a shipping box, red with ribs, ink outline
	ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
	ctx.beginPath();
	ctx.ellipse(x, y + 10, 140, 34, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = '#b8402c';
	ctx.strokeStyle = '#141414';
	ctx.lineWidth = 5;
	ctx.fillRect(cx - 120, cy - 60, 240, 100);
	ctx.strokeRect(cx - 120, cy - 60, 240, 100);
	ctx.strokeStyle = 'rgba(20, 20, 20, 0.45)';
	ctx.lineWidth = 3;
	for (let k = -100; k <= 100; k += 25) {
		ctx.beginPath();
		ctx.moveTo(cx + k, cy - 56);
		ctx.lineTo(cx + k, cy + 36);
		ctx.stroke();
	}
	ctx.restore();
}

/** John's brace: a green beam from his ring up under the container, with a cradle construct on the end. */
export function drawBrace(ctx: CanvasRenderingContext2D, fromX: number, fromY: number, x: number, y: number, power: number, time: number) {
	const tx = x;
	const ty = y - 150;
	ctx.save();
	ctx.shadowColor = THEME_GREEN;
	ctx.shadowBlur = 16;
	ctx.strokeStyle = green(0.35 + 0.4 * power);
	ctx.lineWidth = 10 + 4 * Math.sin(time * 12);
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(fromX, fromY);
	ctx.lineTo(tx, ty);
	ctx.stroke();
	ctx.strokeStyle = GREEN_CORE;
	ctx.lineWidth = 3;
	ctx.stroke();
	// The cradle: a bracket under the box
	ctx.strokeStyle = green(0.8);
	ctx.lineWidth = 8;
	ctx.beginPath();
	ctx.moveTo(tx - 90, ty - 26);
	ctx.lineTo(tx - 90, ty);
	ctx.lineTo(tx + 90, ty);
	ctx.lineTo(tx + 90, ty - 26);
	ctx.stroke();
	ctx.restore();
}

/** A crate on its way down: a warning ring that fills in, and the crate dropping onto it. */
export function drawFallingCrate(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number, radius: number) {
	ctx.save();
	ctx.strokeStyle = `rgba(255, 210, 60, ${0.5 + 0.4 * progress})`;
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.ellipse(x, y, radius, radius * 0.45, 0, 0, Math.PI * 2);
	ctx.stroke();
	ctx.fillStyle = `rgba(255, 210, 60, ${0.12 + 0.2 * progress})`;
	ctx.beginPath();
	ctx.ellipse(x, y, radius * progress, radius * 0.45 * progress, 0, 0, Math.PI * 2);
	ctx.fill();
	// The crate, falling from far above
	const h = (1 - progress) * 520;
	ctx.fillStyle = '#7a5a34';
	ctx.strokeStyle = '#141414';
	ctx.lineWidth = 4;
	ctx.fillRect(x - 26, y - 46 - h, 52, 40);
	ctx.strokeRect(x - 26, y - 46 - h, 52, 40);
	ctx.beginPath();
	ctx.moveTo(x - 26, y - 46 - h);
	ctx.lineTo(x + 26, y - 6 - h);
	ctx.stroke();
	ctx.restore();
}
