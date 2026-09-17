// Keeps a <canvas> sized to its container and sharp on retina screens.
//
// A canvas has two sizes: its CSS size (how big it looks) and its pixel
// buffer (canvas.width/height). On a retina screen devicePixelRatio is 2,
// so we make the buffer 2x bigger and scale the drawing context. Game code
// then draws in normal CSS pixels and never has to think about it.

export interface View {
	/** Drawable width in CSS pixels. */
	width: number;
	/** Drawable height in CSS pixels. */
	height: number;
}

export interface FitCanvas {
	ctx: CanvasRenderingContext2D;
	/** Always holds the current size; updated in place on resize. */
	view: View;
	destroy: () => void;
}

export function fitCanvas(canvas: HTMLCanvasElement): FitCanvas {
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('2D canvas is not supported');

	const view: View = { width: 0, height: 0 };

	const resize = () => {
		const dpr = window.devicePixelRatio || 1;
		const rect = canvas.getBoundingClientRect();
		view.width = rect.width;
		view.height = rect.height;
		canvas.width = Math.round(rect.width * dpr);
		canvas.height = Math.round(rect.height * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	};

	resize();
	const observer = new ResizeObserver(resize);
	observer.observe(canvas);

	return { ctx, view, destroy: () => observer.disconnect() };
}
