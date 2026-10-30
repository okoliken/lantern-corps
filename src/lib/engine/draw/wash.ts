// Recolouring a figure without a canvas filter. A filter is applied to every
// stroke and fill drawn under it, one GPU pass each: on a whole character
// that's dozens a frame per figure, enough to stall the browser for seconds
// (and freeze a laptop). Instead the figure is drawn once into a small
// scratch canvas, washed with a colour there, and stamped onto the scene.

let scratch: HTMLCanvasElement | OffscreenCanvas | null = null;

function scratchOf(w: number, h: number): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null {
	if (!scratch) {
		if (typeof OffscreenCanvas !== 'undefined') scratch = new OffscreenCanvas(w, h);
		else if (typeof document !== 'undefined') scratch = document.createElement('canvas');
		else return null;
	}
	if (scratch.width < w) scratch.width = w;
	if (scratch.height < h) scratch.height = h;
	return scratch.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
}

export interface Wash {
	/** The colour laid over the figure. */
	color: string;
	/** How much of it: 1 is a flat silhouette, lower keeps some of the figure's own shading. */
	amount: number;
}

/**
 * Draw `draw` (a figure around world point x, y) washed in a colour. `box` is
 * how far the figure reaches from (x, y), in world px: left/right, up, down.
 */
export function drawWashed(ctx: CanvasRenderingContext2D, x: number, y: number, box: { side: number; up: number; down: number }, wash: Wash, draw: (c: CanvasRenderingContext2D) => void) {
	// No scratch canvas to work in (tests, an old browser): plain colours are better than nothing
	if (typeof ctx.getTransform !== 'function') {
		draw(ctx);
		return;
	}
	const m = ctx.getTransform();
	const sx = Math.hypot(m.a, m.b);
	const sy = Math.hypot(m.c, m.d);
	const w = Math.ceil(box.side * 2 * sx) + 4;
	const h = Math.ceil((box.up + box.down) * sy) + 4;
	const s = scratchOf(w, h);
	if (!s || w > 4096 || h > 4096) {
		draw(ctx);
		return;
	}
	// Where the box's top-left corner lands on the screen
	const left = m.a * (x - box.side) + m.c * (y - box.up) + m.e;
	const top = m.b * (x - box.side) + m.d * (y - box.up) + m.f;
	const ox = Math.floor(left) - 2;
	const oy = Math.floor(top) - 2;
	s.setTransform(1, 0, 0, 1, 0, 0);
	s.globalCompositeOperation = 'source-over';
	s.globalAlpha = 1;
	s.clearRect(0, 0, w, h);
	s.setTransform(m.a, m.b, m.c, m.d, m.e - ox, m.f - oy);
	draw(s as CanvasRenderingContext2D);
	s.setTransform(1, 0, 0, 1, 0, 0);
	s.globalCompositeOperation = 'source-atop';
	s.globalAlpha = wash.amount;
	s.fillStyle = wash.color;
	s.fillRect(0, 0, w, h);
	s.globalCompositeOperation = 'source-over';
	s.globalAlpha = 1;
	ctx.save();
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.drawImage(scratch as CanvasImageSource, 0, 0, w, h, ox, oy, w, h);
	ctx.restore();
}
