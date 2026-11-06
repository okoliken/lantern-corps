// Darkness over the world, with soft holes where there's light (Lights Out:
// Oa with the Central Battery failing). Drawn on a scratch canvas the size of
// the screen, the lights cut out of it, then put over the world in one go: a
// single image draw a frame, no canvas filter.

export interface Light {
	x: number;
	y: number;
	/** How far it reaches, world px. */
	r: number;
	/** 0..1, how much darkness it clears at its middle. */
	strength?: number;
}

let scratch: OffscreenCanvas | HTMLCanvasElement | null = null;

function scratchFor(width: number, height: number) {
	if (!scratch) scratch = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(width, height) : document.createElement('canvas');
	if (scratch.width !== width) scratch.width = width;
	if (scratch.height !== height) scratch.height = height;
	return scratch;
}

/**
 * `ctx` has the camera's transform on it (world coordinates). `amount` 0..1
 * is how dark it is away from any light; `color` is the dark's own colour.
 */
export function drawDarkness(ctx: CanvasRenderingContext2D, lights: readonly Light[], amount: number, color = '2, 5, 10') {
	if (amount <= 0.01 || typeof ctx.getTransform !== 'function') return;
	const { width, height } = ctx.canvas;
	const canvas = scratchFor(width, height);
	const c = canvas.getContext('2d') as CanvasRenderingContext2D | null;
	if (!c) return;
	c.setTransform(1, 0, 0, 1, 0, 0);
	c.globalCompositeOperation = 'source-over';
	c.clearRect(0, 0, width, height);
	c.fillStyle = `rgba(${color}, ${amount})`;
	c.fillRect(0, 0, width, height);
	// The lights, in world coordinates, cut out of it
	c.setTransform(ctx.getTransform());
	c.globalCompositeOperation = 'destination-out';
	for (const l of lights) {
		if (l.r <= 1) continue;
		const g = c.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
		const s = l.strength ?? 1;
		g.addColorStop(0, `rgba(0, 0, 0, ${s})`);
		g.addColorStop(0.55, `rgba(0, 0, 0, ${s * 0.85})`);
		g.addColorStop(1, 'rgba(0, 0, 0, 0)');
		c.fillStyle = g;
		c.beginPath();
		c.arc(l.x, l.y, l.r, 0, Math.PI * 2);
		c.fill();
	}
	ctx.save();
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.drawImage(canvas, 0, 0);
	ctx.restore();
}

/**
 * An anti-matter charge stuck to the plaza: a dark sphere in iron bands, its
 * countdown burning pale through the cracks, faster as it gets close.
 * `left` 0..1 of its fuse still to burn.
 */
export function drawQwardCharge(ctx: CanvasRenderingContext2D, x: number, y: number, left: number, flash: boolean, time: number) {
	const pulse = 0.5 + 0.5 * Math.sin(time * (4 + (1 - left) * 18));
	ctx.save();
	ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
	ctx.beginPath();
	ctx.ellipse(x, y, 26, 8, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.shadowColor = '#e8e3b0';
	ctx.shadowBlur = 8 + 18 * pulse;
	ctx.fillStyle = flash ? '#fffbe0' : '#141410';
	ctx.beginPath();
	ctx.arc(x, y - 24, 20, 0, Math.PI * 2);
	ctx.fill();
	ctx.shadowBlur = 0;
	ctx.strokeStyle = '#4b4a40';
	ctx.lineWidth = 4;
	ctx.beginPath();
	ctx.ellipse(x, y - 24, 20, 6, 0, 0, Math.PI * 2);
	ctx.moveTo(x, y - 44);
	ctx.lineTo(x, y - 4);
	ctx.stroke();
	ctx.strokeStyle = `rgba(232, 227, 176, ${0.4 + 0.6 * pulse})`;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(x - 12, y - 30);
	ctx.lineTo(x - 4, y - 22);
	ctx.lineTo(x - 9, y - 14);
	ctx.moveTo(x + 8, y - 36);
	ctx.lineTo(x + 13, y - 26);
	ctx.stroke();
	// The fuse: a ring burning down round it
	ctx.strokeStyle = '#e8e3b0';
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.arc(x, y - 24, 28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
	ctx.stroke();
	ctx.restore();
}
