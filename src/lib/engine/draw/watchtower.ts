// The Watchtower's training deck: the Earth filling the window along the top
// wall, the gantry over it, and the four stations the League watch from.

const TAU = Math.PI * 2;

/**
 * The window: the whole top wall of the deck is glass, and the Earth is on
 * the other side of it, turning slowly, with the sun on one edge.
 */
export function drawEarthWindow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, time: number) {
	ctx.save();
	// Space
	ctx.fillStyle = '#02040c';
	ctx.fillRect(x, y, w, h);
	ctx.fillStyle = '#dfe9ff';
	for (let i = 0; i < 90; i++) {
		const sx = x + ((i * 373) % w);
		const sy = y + ((i * 197) % h);
		ctx.globalAlpha = 0.25 + 0.6 * Math.abs(Math.sin(time * 1.5 + i));
		ctx.fillRect(sx, sy, 1.5, 1.5);
	}
	ctx.globalAlpha = 1;
	// The Earth: a big blue limb rising past the bottom of the glass
	const r = w * 0.55;
	const ex = x + w * 0.5;
	const ey = y + h + r * 0.62;
	ctx.save();
	ctx.beginPath();
	ctx.rect(x, y, w, h);
	ctx.clip();
	const globe = ctx.createRadialGradient(ex - r * 0.4, ey - r * 0.5, r * 0.1, ex, ey, r);
	globe.addColorStop(0, '#4f9fe8');
	globe.addColorStop(0.5, '#1b58ad');
	globe.addColorStop(1, '#082a5e');
	ctx.fillStyle = globe;
	ctx.beginPath();
	ctx.arc(ex, ey, r, 0, TAU);
	ctx.fill();
	// Land and cloud, turning
	ctx.save();
	ctx.beginPath();
	ctx.arc(ex, ey, r, 0, TAU);
	ctx.clip();
	const spin = (time * 0.012) % 1;
	// Continents: darker than the sea, so the glass reads as a planet even close up
	ctx.fillStyle = 'rgba(46, 118, 64, 0.85)';
	for (const [lx, ly, lw, lh] of [
		[-0.5, -0.55, 0.36, 0.22],
		[-0.05, -0.68, 0.28, 0.18],
		[0.35, -0.5, 0.42, 0.26],
		[0.75, -0.62, 0.24, 0.16]
	]) {
		const px = ex + ((lx + spin * 1.6) % 1.6) * r - r * 0.3;
		ctx.beginPath();
		ctx.ellipse(px, ey + ly * r, lw * r, lh * r, 0.3, 0, TAU);
		ctx.fill();
	}
	ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
	for (const [lx, ly, lw] of [
		[-0.3, -0.75, 0.5],
		[0.2, -0.58, 0.44],
		[0.6, -0.72, 0.36]
	]) {
		const px = ex + ((lx + spin * 2.2) % 1.6) * r - r * 0.3;
		ctx.beginPath();
		ctx.ellipse(px, ey + ly * r, lw * r, lw * r * 0.2, -0.2, 0, TAU);
		ctx.fill();
	}
	ctx.restore();
	// Atmosphere, and the sun on the limb
	ctx.strokeStyle = 'rgba(150, 210, 255, 0.55)';
	ctx.lineWidth = 6;
	ctx.beginPath();
	ctx.arc(ex, ey, r + 2, 0, TAU);
	ctx.stroke();
	ctx.restore();
	// The glass: mullions and a faint reflection
	ctx.strokeStyle = 'rgba(180, 200, 240, 0.35)';
	ctx.lineWidth = 8;
	ctx.strokeRect(x, y, w, h);
	ctx.lineWidth = 3;
	ctx.beginPath();
	for (let i = 1; i < 6; i++) {
		ctx.moveTo(x + (w * i) / 6, y);
		ctx.lineTo(x + (w * i) / 6, y + h);
	}
	ctx.stroke();
	const sheen = ctx.createLinearGradient(x, y, x + w, y + h);
	sheen.addColorStop(0, 'rgba(255, 255, 255, 0.06)');
	sheen.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
	sheen.addColorStop(1, 'rgba(255, 255, 255, 0.04)');
	ctx.fillStyle = sheen;
	ctx.fillRect(x, y, w, h);
	ctx.restore();
}

/** A station on the deck: a lit ring on the floor where one of them stands to watch. */
export function drawStation(ctx: CanvasRenderingContext2D, x: number, y: number, lit: boolean, time: number) {
	ctx.save();
	ctx.strokeStyle = lit ? `rgba(120, 190, 255, ${0.55 + 0.25 * Math.sin(time * 3)})` : 'rgba(120, 150, 200, 0.22)';
	ctx.lineWidth = lit ? 3 : 2;
	ctx.beginPath();
	ctx.ellipse(x, y, 60, 22, 0, 0, TAU);
	ctx.stroke();
	ctx.beginPath();
	ctx.ellipse(x, y, 44, 16, 0, 0, TAU);
	ctx.stroke();
	ctx.restore();
}

/** The ring in the middle of the deck: where the sparring happens. */
export function drawRing(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, hot: number, time: number) {
	ctx.save();
	ctx.strokeStyle = `rgba(120, 190, 255, ${0.28 + 0.2 * hot})`;
	ctx.lineWidth = 4;
	ctx.setLineDash([26, 18]);
	ctx.lineDashOffset = -time * 40;
	ctx.beginPath();
	ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
	ctx.stroke();
	ctx.restore();
}
