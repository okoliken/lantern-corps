// What dread looks like (see dread.ts): the edges of the screen closing in,
// a sickly yellow at the rim, and a meter so you know how afraid you are.

/** Screen space. `dread` 0..1. */
export function drawDread(ctx: CanvasRenderingContext2D, dread: number, width: number, height: number, time: number, touch: boolean) {
	ctx.save();
	// Darkness closing in from the edges, breathing a little
	const breathe = 1 + Math.sin(time * 2.2) * 0.04 * dread;
	const inner = Math.min(width, height) * (0.62 - 0.32 * dread) * breathe;
	const outer = Math.hypot(width, height) * 0.6;
	const g = ctx.createRadialGradient(width / 2, height / 2, inner, width / 2, height / 2, outer);
	g.addColorStop(0, 'rgba(0, 0, 0, 0)');
	g.addColorStop(0.55, `rgba(16, 12, 0, ${0.45 * dread})`);
	g.addColorStop(1, `rgba(40, 34, 0, ${0.92 * dread})`);
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, width, height);

	// The meter: top middle on a phone, above the hotbar otherwise
	const w = 160;
	const x = touch ? width / 2 - w / 2 : 18;
	const y = touch ? 10 : height - 156;
	ctx.fillStyle = 'rgba(4, 18, 10, 0.85)';
	ctx.strokeStyle = '#04120a';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.roundRect(x, y, w, 22, 11);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = dread > 0.7 ? '#ffb02e' : '#ffd23a';
	ctx.beginPath();
	ctx.roundRect(x + 3, y + 3, (w - 6) * dread, 16, 8);
	ctx.fill();
	ctx.fillStyle = '#fff8d6';
	ctx.font = '800 11px system-ui, sans-serif';
	ctx.textBaseline = 'middle';
	ctx.fillText(dread > 0.7 ? 'DREAD: HOLD YOUR SHIELD' : 'DREAD', x + 10, y + 11.5);
	ctx.restore();
}
